import assert from 'node:assert/strict';
import {createD1} from './_lib/d1-sqlite.mjs';
import {SKIP_DDL} from '../functions/internal/_lib/skip-trace.mjs';
import {parseCall,applyCall} from '../functions/internal/_lib/skip-trace-calls.mjs';
import {syncCalls,PROSPECT_HEADERS,PHONE_HEADERS} from '../workers/calling-sync/src/index.mjs';
const db=createD1();for(const sql of SKIP_DDL)await db.prepare(sql).run();
await db.prepare('INSERT INTO skip_trace_prospects (id,batch,data_json,updated_at) VALUES (?,?,?,?)').bind('test','synthetic',JSON.stringify({phones:[{number:'3605550101',valid:true}]}),'2026-10-27T00:00:00Z').run();
await db.prepare('INSERT INTO skip_trace_enrichment VALUES (?,?,?)').bind('test',JSON.stringify({yearBuilt:1985,confidence:'high'}),'2026-10-27').run();
const row=Array(27).fill('');Object.assign(row,{0:'test-call-0001',1:'test',2:'test-session',3:'Robert',4:'2026-10-27T10:00:00-07:00',5:'3605550101',6:'Interested',12:'Asked about windows',24:'Yes'});
assert.equal(parseCall([]),null);assert.throws(()=>parseCall({...row,4:'yesterday'}),/ISO/);assert.throws(()=>parseCall({...row,20:'2026-02-30'}),/valid/);
let result=await applyCall(db,parseCall(row),0);assert.equal(result.version,1);assert.match(result.notes,/Asked about windows/);
assert.equal((await applyCall(db,parseCall(row),0)).replayed,true);
await assert.rejects(()=>applyCall(db,parseCall({...row,12:'Changed'}),1),/different/);
await assert.rejects(()=>applyCall(db,parseCall({...row,0:'test-call-0002'}),0),/Conflict/);
assert.equal((await db.prepare('SELECT COUNT(*) n FROM skip_trace_calls').first()).n,1);
assert.equal((await db.prepare('SELECT COUNT(*) n FROM skip_trace_history').first()).n,1);
await applyCall(db,parseCall({...row,0:'test-call-0002',6:'Do not contact'}),1);
assert.equal((await db.prepare('SELECT COUNT(*) n FROM supplier_contact_blocks').first()).n,1);
await assert.rejects(()=>applyCall(db,parseCall({...row,0:'test-call-0003'}),2),/Do-not-contact/);
await db.prepare('UPDATE skip_trace_enrichment SET data_json=?').bind(JSON.stringify({yearBuilt:1978,confidence:'high'})).run();
await assert.rejects(()=>applyCall(db,parseCall({...row,0:'test-call-0003'}),2),/Property hold/);
await applyCall(db,parseCall({...row,0:'test-call-0003',6:'Do not contact'}),2);
assert.deepEqual(await syncCalls({}),{enabled:false});
await assert.rejects(()=>syncCalls({CALLING_SYNC_ENABLED:'true'}),/configuration/);
console.log('Call sync: validation, replay, conflicts, history, cutoff, suppression and disabled-state checks passed.');

// Exercise the actual Sheets adapter against local SQLite and a fake Google transport.
const {generateKeyPairSync}=await import('node:crypto');
const {CALL_HEADERS}=await import('../functions/internal/_lib/skip-trace-calls.mjs');
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
const syncDb=createD1();for(const sql of SKIP_DDL)await syncDb.prepare(sql).run();
await syncDb.prepare('INSERT INTO skip_trace_prospects (id,batch,data_json,updated_at) VALUES (?,?,?,?)').bind('test','synthetic',JSON.stringify({name:'Test',address:'Test',city:'Test',zip:'00000',flags:{},phones:[]}),'2026-10-27').run();
await syncDb.prepare('INSERT INTO skip_trace_enrichment VALUES (?,?,?)').bind('test',JSON.stringify({yearBuilt:1985,confidence:'high'}),'2026-10-27').run();
const env={CALLING_SYNC_ENABLED:'true',CALLING_SHEET_ID:'synthetic_workbook_123456789',QUOTES_DB:syncDb,CALLING_GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'synthetic@example.test',private_key:privateKey})};
const sourceHeader=PROSPECT_HEADERS;
let log=[CALL_HEADERS,[...row]],source=[sourceHeader,['test','','','','','','new','','','','','','',0]],writes=[];
const transport=async(url,init)=>{
 if(url.includes('oauth2.googleapis.com'))return Response.json({access_token:'synthetic-token'});
 if(url.endsWith('values:batchUpdate')){const body=JSON.parse(init.body);writes.push(...body.data);for(const d of body.data){if(d.range==="'Call log'!Z2:AA2")Object.assign(log[1],{25:d.values[0][0],26:d.values[0][1]});if(d.range.startsWith("'Prospects'!A2"))source=[sourceHeader,...d.values];}return Response.json({});}
 const range=decodeURIComponent(url.split('/values/')[1]);
 return Response.json({values:range==="'Call log'!A1:AA1000"?log:range==="'Prospects'!A1:P1000"?source:range==="'Phone review'!A1:J1000"?[PHONE_HEADERS]:[log[1]]});
};
assert.equal((await syncCalls(env,transport)).saved,1);assert.equal(log[1][25],'Synced');assert.equal(source[1][6],'interested');assert.equal(source[1][13],1);
assert.equal((await syncCalls(env,transport)).saved,0);assert.equal((await syncDb.prepare('SELECT COUNT(*) n FROM skip_trace_history').first()).n,1);
log[1]=[...row];log[1][0]='test-call-0005';source[1][13]=0;
assert.equal((await syncCalls(env,transport)).errors,1);assert.match(log[1][25],/Error: Conflict/);
assert.equal((await syncCalls(env,transport)).saved,0); // errors remain held even after mirror refresh
log[1][25]='';assert.equal((await syncCalls(env,transport)).saved,1);
log[0]=['Wrong schema'];await assert.rejects(()=>syncCalls(env,transport),/headers/);
assert.throws(()=>parseCall({...row,4:'2026-02-30T10:00:00-07:00'}),/Invalid call/);
console.log('Sheets adapter: save, mirror refresh, acknowledgement, replay, conflict hold, explicit retry and schema checks passed.');
