import { ensureSkipTables, propertyEligibility } from './skip-trace.mjs';
import { CONTACT_DDL } from './supplier-permits.mjs';

export const CALL_HEADERS = ['Call ID','Lead ID','Session ID','Caller','Call date and time','Number dialed','Outcome','Homeowner name','Best phone','Property address','City and ZIP','Project type','Main concern','Scope and quantity','Preferences','Project timing','Estimator questions','Appointment status','Appointment requested for','Follow-up permission','Follow-up date','Assigned to','Handoff details','Notes','Approved to sync','Sync status','Synced at'];
export const OUTCOMES = {'No answer':'attempted','Voicemail':'attempted','Connected':'connected','Interested':'interested','Not interested':'not_interested','Wrong number':'researching','Do not contact':'do_not_contact'};
export const CALL_DDL = `CREATE TABLE IF NOT EXISTS skip_trace_calls (call_id TEXT PRIMARY KEY, prospect_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)`;
export function parseCall(row) {
  if (row[24] !== 'Yes') return null;
  const values=Array.from({length:24},(_,i)=>String(row[i]??'').trim());
  if(values.some(v=>v.length>2000)||JSON.stringify(values).length>14000)throw Error('Call fields are too long');
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(values[0])||!/^[a-zA-Z0-9_-]{1,100}$/.test(values[1]))throw Error('Supply a unique Call ID and exact Lead ID');
  if(!['Keith','Robert'].includes(values[3])||!Object.hasOwn(OUTCOMES,values[6]))throw Error('Check caller and outcome');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(values[4])||!Number.isFinite(Date.parse(values[4])))throw Error('Use an ISO call time including timezone');
  if(new Date(values[4].slice(0,10)).toISOString().slice(0,10)!==values[4].slice(0,10)||Number(values[4].slice(11,13))>23||Number(values[4].slice(14,16))>59)throw Error('Invalid call date or time');
  if(values[20]&&(!/^\d{4}-\d{2}-\d{2}$/.test(values[20])||!Number.isFinite(Date.parse(values[20]))||new Date(values[20]).toISOString().slice(0,10)!==values[20]))throw Error('Use a valid YYYY-MM-DD follow-up date');
  const phone=values[5].replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');
  if(!/^[2-9]\d{2}[2-9]\d{6}$/.test(phone))throw Error('Check the number dialed');
  return {id:values[0],leadId:values[1],status:OUTCOMES[values[6]],phone,values,payload:JSON.stringify(values)};
}
export async function applyCall(db,call,expectedVersion,now=new Date().toISOString()) {
  await ensureSkipTables(db);await db.prepare(CALL_DDL).run();
  const previous=await db.prepare('SELECT payload FROM skip_trace_calls WHERE call_id=?').bind(call.id).first();
  if(previous){if(previous.payload!==call.payload)throw Error('Call ID already used with different details');return {replayed:true};}
  const current=await db.prepare('SELECT * FROM skip_trace_prospects WHERE id=?').bind(call.leadId).first();
  if(!current)throw Error('Lead ID not found');
  if(!Number.isInteger(expectedVersion)||current.version!==expectedVersion)throw Error('Conflict: review newer Command Center details');
  const enrich=await db.prepare('SELECT data_json FROM skip_trace_enrichment WHERE prospect_id=?').bind(call.leadId).first();
  if(call.status!=='do_not_contact'&&propertyEligibility(enrich?JSON.parse(enrich.data_json):null).status!=='eligible')throw Error('Property hold: review this call manually');
  if(current.status==='do_not_contact'&&call.status!=='do_not_contact')throw Error('Do-not-contact cannot be removed');
  const details=call.values.map((v,i)=>v&&i>=2&&i!==20?`${CALL_HEADERS[i]}: ${v}`:'').filter(Boolean).join('\n');
  const notes=[current.notes,`[Call ${call.id}]\n${details}`].filter(Boolean).join('\n\n');
  if(notes.length>4000)throw Error('Notes need review before appending this call');
  for(const sql of CONTACT_DDL)await db.prepare(sql).run();
  const phones=call.status==='do_not_contact'?[...new Set([call.phone,...JSON.parse(current.data_json).phones.filter(p=>p.valid).map(p=>p.number)])]:[];
  const result=await db.batch([
    db.prepare('INSERT INTO skip_trace_calls (call_id,prospect_id,payload,created_at) SELECT ?,?,?,? FROM skip_trace_prospects WHERE id=? AND version=?').bind(call.id,call.leadId,call.payload,now,call.leadId,expectedVersion),
    db.prepare('UPDATE skip_trace_prospects SET status=?,notes=?,follow_up=?,version=version+1,updated_at=? WHERE id=? AND version=? AND EXISTS (SELECT 1 FROM skip_trace_calls WHERE call_id=? AND created_at=?)').bind(call.status,notes,call.values[20]||current.follow_up,now,call.leadId,expectedVersion,call.id,now),
    db.prepare('INSERT INTO skip_trace_history (prospect_id,status,notes,follow_up,created_at) SELECT id,status,notes,follow_up,updated_at FROM skip_trace_prospects WHERE id=? AND version=? AND updated_at=?').bind(call.leadId,expectedVersion+1,now),
    ...phones.map(phone=>db.prepare("INSERT OR IGNORE INTO supplier_contact_blocks (phone,reason,note,created_at) SELECT ?, 'asked_not_to_call', 'Call log removal request', ? FROM skip_trace_prospects WHERE id=? AND version=? AND updated_at=? AND status='do_not_contact'").bind(phone,now,call.leadId,expectedVersion+1,now))
  ]);
  if(!result[1].meta.changes)throw Error('Conflict: record changed while saving');
  return {version:expectedVersion+1,notes,follow_up:call.values[20]||current.follow_up,status:call.status,updated_at:now};
}
