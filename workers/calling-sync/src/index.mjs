import {accountConfig,googleToken,googleJson} from '../../../functions/internal/_lib/google-auth.mjs';
import {CALL_HEADERS,CALL_DDL,parseCall,applyCall} from '../../../functions/internal/_lib/skip-trace-calls.mjs';
import {propertyEligibility} from '../../../functions/internal/_lib/skip-trace.mjs';
export const PROSPECT_HEADERS=['Lead ID','Homeowner','Property address','City','ZIP','Calling eligibility','Status','Assigned to','Follow-up date','Current notes','Year built','Property hold reason','Source batch','Record version','Last updated','Sync status'];
export const PHONE_HEADERS=['Homeowner','Phone number','Phone restriction','Property eligibility','Lead ID','Phone type','Registry checked on','Phone-owner verified on','Verification source','Approved to call'];

// Fixed workbook and fixed tabs. Credentials never reach a browser or a Sheet cell.
export async function syncCalls(env,fetchImpl=fetch) {
  if(env.CALLING_SYNC_ENABLED!=='true')return {enabled:false};
  const account=accountConfig(env.CALLING_GOOGLE_SERVICE_ACCOUNT_JSON);
  if(!account||!env.QUOTES_DB||!/^[\w-]{20,100}$/.test(env.CALLING_SHEET_ID||''))throw Error('Calling sync configuration missing');
  const token=await googleToken(account,'https://www.googleapis.com/auth/spreadsheets',fetchImpl);
  const base=`https://sheets.googleapis.com/v4/spreadsheets/${env.CALLING_SHEET_ID}`;
  const headers={authorization:`Bearer ${token}`,'content-type':'application/json'};
  const read=range=>googleJson(`${base}/values/${encodeURIComponent(range)}`,{headers},fetchImpl);
  const write=data=>googleJson(`${base}/values:batchUpdate`,{method:'POST',headers,body:JSON.stringify({valueInputOption:'RAW',data})},fetchImpl);
  const [log,source,phones]=await Promise.all([read("'Call log'!A1:AA1000"),read("'Prospects'!A1:P1000"),read("'Phone review'!A1:J1000")]);
  if(JSON.stringify(log.values?.[0])!==JSON.stringify(CALL_HEADERS))throw Error('Call log headers changed');
  if(JSON.stringify(source.values?.[0])!==JSON.stringify(PROSPECT_HEADERS))throw Error('Prospects headers changed');
  if(JSON.stringify(phones.values?.[0])!==JSON.stringify(PHONE_HEADERS))throw Error('Phone review headers changed');
  const versions=new Map();for(const row of (source.values||[]).slice(1)){if(versions.has(row[0]))throw Error('Duplicate prospect IDs in workbook');versions.set(row[0],Number(row[13]));}
  const rows=(log.values||[]).slice(1);const counts=new Map();for(const row of rows)if(row[0])counts.set(row[0],(counts.get(row[0])||0)+1);
  let saved=0,errors=0;
  // Bounded per run; a full log must be archived deliberately rather than silently truncated.
  if(rows.length>=999)throw Error('Call log capacity reached; archive completed sessions');
  for(let i=0,processed=0;i<rows.length&&processed<20;i++){
    const row=rows[i];if(row[24]!=='Yes'||row[25]==='Synced'||String(row[25]||'').startsWith('Error:'))continue;
    processed++;
    let message='Synced',at=new Date().toISOString();
    try {
      if(counts.get(row[0])!==1)throw Error('Duplicate Call ID in sheet');
      const call=parseCall(row);const result=await applyCall(env.QUOTES_DB,call,versions.get(call.leadId),at);
      if(result.version)versions.set(call.leadId,result.version);
      if(!result.replayed)saved++;
    }catch(error){message=`Error: ${error.message}`;at='';errors++;}
    // Recheck identity and inputs before acknowledging a row that may have moved or changed.
    const fresh=(await read(`'Call log'!A${i+2}:AA${i+2}`)).values?.[0]||[];
    if(JSON.stringify(fresh.slice(0,25))!==JSON.stringify(row.slice(0,25)))continue;
    await write([{range:`'Call log'!Z${i+2}:AA${i+2}`,values:[[message,at||row[26]||'']]}]);
  }
  const db=env.QUOTES_DB;
  await db.prepare(CALL_DDL).run();
  const {results:prospects}=await db.prepare('SELECT p.*, e.data_json AS research_json, (SELECT payload FROM skip_trace_calls c WHERE c.prospect_id=p.id ORDER BY created_at DESC,call_id DESC LIMIT 1) AS latest_call FROM skip_trace_prospects p LEFT JOIN skip_trace_enrichment e ON e.prospect_id=p.id ORDER BY p.id LIMIT 1001').all();
  if(prospects.length>999)throw Error('Prospect capacity exceeded');
  const values=prospects.map(p=>{const d=JSON.parse(p.data_json),r=p.research_json?JSON.parse(p.research_json):null,e=propertyEligibility(r),last=p.latest_call?JSON.parse(p.latest_call):null;return [p.id,d.name||d.ownerName||'',d.address,d.city,d.zip,e.status==='excluded'?'Excluded':p.status==='do_not_contact'||Object.values(d.flags||{}).some(Boolean)?'Contact hold':e.status==='eligible'?'Phone review needed':'Property hold',p.status,last?.[21]||'Unassigned',p.follow_up,p.notes,r?.yearBuilt||'',e.status==='hold'?e.reason:'',p.batch,p.version,p.updated_at,'Current'];});
  const {results:blocks}=await db.prepare('SELECT phone FROM supplier_contact_blocks').all();
  const suppressed=new Set(blocks.map(p=>p.phone));
  const phoneValues=prospects.flatMap((p,index)=>{const d=JSON.parse(p.data_json);return d.phones.map(phone=>[d.name||d.ownerName||'',phone.number,suppressed.has(phone.number)||p.status==='do_not_contact'?'Company do-not-contact':phone.dnc?'DNC - do not call':!phone.valid?'Invalid number':'Unverified - do not call',values[index][5],p.id,phone.type,'','','',false]);});
  if(phoneValues.length>999)throw Error('Phone table capacity exceeded');
  while(values.length<(source.values?.length||1)-1)values.push(Array(16).fill(''));
  while(phoneValues.length<(phones.values?.length||1)-1)phoneValues.push(Array(10).fill(''));
  // Prospects is an explicitly protected read-only mirror; edits belong in the append-only Call log.
  await write([{range:`'Prospects'!A2:P${Math.max(2,values.length+1)}`,values:values.length?values:[Array(16).fill('')]},{range:`'Phone review'!A2:J${Math.max(2,phoneValues.length+1)}`,values:phoneValues.length?phoneValues:[Array(10).fill('')]},{range:"'Start here'!B26",values:[[`Last sync: ${new Date().toISOString()}. ${saved} calls saved; ${errors} need review.`]]}]);
  return {enabled:true,saved,errors,prospects:values.length};
}
export default {
  async scheduled(event,env,ctx){ctx.waitUntil(syncCalls(env).then(r=>console.log('calling-sync',JSON.stringify(r))).catch(()=>console.error('calling-sync-failed: check connection or workbook layout')));},
  async fetch(){return new Response('Not found',{status:404});}
};


