import assert from 'node:assert/strict';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as quotes from '../functions/internal/api/quotes/index.js';
import * as quoteById from '../functions/internal/api/quotes/[id].js';
import * as share from '../functions/internal/api/quote-share.js';
import * as delivery from '../functions/internal/api/quote-delivery.js';
import { freezeSignedQuote, customerDocumentBytes } from '../functions/internal/_lib/quote-documents.mjs';
import { TERMS_VERSION, getContractTerms } from '../functions/internal/_lib/pdf-terms.mjs';
const db=createD1({schemaFiles:['internal/db/schema.sql']});
const env={QUOTES_DB:db,RESEND_API_KEY:'fixture',ASSETS:{fetch:async()=>new Response('',{status:404})}};
const body={customer:{name:'QA terms fixture',phone:'3605550100',email:'fixture@example.com'},signatureMethod:'pen',items:[{label:'QA slider',quantity:1,unitPriceCents:10000}]};
const call=async(fn,method='POST',input=body,params={},query='')=>{const response=await fn({env,params,request:new Request('https://example.test/internal/api/test'+query,{method,headers:{'content-type':'application/json'},body:method==='GET'?undefined:JSON.stringify(input)})});return{status:response.status,body:await response.json()};};
const created=await call(quotes.onRequestPost);assert.equal(created.status,201);const id=created.body.id;
assert.equal(db.raw.prepare('SELECT terms_version FROM quotes WHERE id=?').get(id).terms_version,TERMS_VERSION);
const link=await call(share.onRequestPost,'POST',{quoteId:id});assert.equal(link.status,201);
db.raw.prepare("UPDATE quotes SET terms_version='2026-08-28' WHERE id=?").run(id);
const before=db.raw.prepare('SELECT * FROM quotes WHERE id=?').get(id);
const blockedSignature=await call(quoteById.onRequestPatch,'PATCH',{confirmPen:true,signatureName:'QA fixture'},{id});
assert.equal(blockedSignature.status,409);assert.equal(blockedSignature.body.code,'TERMS_CHANGED');
const shareRead=await call(share.onRequestGet,'GET',null,{},'?quoteId='+id);
assert.equal(shareRead.body.canCreate,false);assert.equal(shareRead.body.blockedBy.code,'TERMS_CHANGED');
const blockedShare=await call(share.onRequestPost,'POST',{quoteId:id});assert.equal(blockedShare.status,409);assert.equal(blockedShare.body.code,'TERMS_CHANGED');
const originalFetch=globalThis.fetch;let sent=0;
globalThis.fetch=async()=>{sent++;return Response.json({id:'fixture-send'});};
try{
  const blockedEmail=await call(delivery.onRequestPost,'POST',{quoteId:id,kind:'customer'});
  assert.equal(blockedEmail.status,409);assert.equal(blockedEmail.body.code,'TERMS_CHANGED');assert.equal(sent,0);
  assert.deepEqual(db.raw.prepare('SELECT * FROM quotes WHERE id=?').get(id),before,'blocked reads/sends never change the saved terms');
  const updated=await call(quoteById.onRequestPut,'PUT',body,{id});assert.equal(updated.status,200);
  assert.equal(db.raw.prepare('SELECT terms_version FROM quotes WHERE id=?').get(id).terms_version,TERMS_VERSION);
  assert.equal(db.raw.prepare('SELECT count(*) AS n FROM quote_sign_links WHERE quote_id=? AND revoked_at IS NULL').get(id).n,0,'edit-save revokes the old terms link');
  assert.equal((await call(share.onRequestPost,'POST',{quoteId:id})).status,201);
  const currentEmail=await call(delivery.onRequestPost,'POST',{quoteId:id,kind:'customer'});assert.equal(currentEmail.status,200);assert.equal(sent,1);
}finally{globalThis.fetch=originalFetch;}
for(const version of ['2026-08-28',TERMS_VERSION]){
  const record=await call(quotes.onRequestPost);const recordId=record.body.id;
  db.raw.prepare("UPDATE quotes SET terms_version=?,status='finalized',signature_name='QA fixture',signed_at='2026-11-03T20:00:00Z' WHERE id=?").run(version,recordId);
  const frozen=await freezeSignedQuote(env,recordId);const snapshot=JSON.parse(frozen.snapshot_json);
  assert.deepEqual(snapshot.terms,getContractTerms(version));
  assert.equal(snapshot.terms.warranty.includes('will assist in facilitating'),version==='2026-08-28','legacy promise is preserved only in the archived agreement');
  if(version==='2026-08-28')assert.match(snapshot.terms.warranty,/Workmanship is warranted for 1 year/,'archived agreements retain the original workmanship promise');
  else assert.doesNotMatch(snapshot.terms.warranty,/workmanship|\b1 year\b|\bone.year\b/i,'current agreements add no voluntary workmanship warranty');
  assert.equal((await freezeSignedQuote(env,recordId)).sha256,frozen.sha256,'subsequent reads keep signed bytes immutable');
}
const unknown=await call(quotes.onRequestPost);db.raw.prepare("UPDATE quotes SET terms_version='unknown' WHERE id=?").run(unknown.body.id);
await assert.rejects(customerDocumentBytes(env,{quote:db.raw.prepare('SELECT * FROM quotes WHERE id=?').get(unknown.body.id),items:[]}),/saved contract terms are unavailable/);
console.log('PASS: old drafts cannot send signing links; edit-save upgrades terms and revokes links; signed archives retain original terms and immutable PDFs');
