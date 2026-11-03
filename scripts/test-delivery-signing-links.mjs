import assert from 'node:assert/strict';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as quotes from '../functions/internal/api/quotes/index.js';
import * as delivery from '../functions/internal/api/quote-delivery.js';
import * as share from '../functions/internal/api/quote-share.js';
import * as signing from '../functions/api/quote-sign.js';
import { hashToken } from '../functions/internal/_lib/quote-signing.mjs';

const db=createD1({schemaFiles:['internal/db/schema.sql']});
const env={QUOTES_DB:db,RESEND_API_KEY:'fixture',ASSETS:{fetch:async()=>new Response('',{status:404})}};
const call=async(fn,body)=>{const response=await fn({env,request:new Request('https://example.test/internal/api/test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})});return {status:response.status,body:await response.json()};};
const original=globalThis.fetch,sends=[];
globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');sends.push(JSON.parse(options.body));return Response.json({id:`signing-test-${sends.length}`});};
try{
  for(const phase of ['before-seal','sealed','accepted','expired','missing-sealed']){
    const created=await call(quotes.onRequestPost,{customer:{name:'QA ONLY',phone:'3605550100',email:'fixture@example.com'},items:[{label:'QA ONLY slider',quantity:1,unitPriceCents:100}]});
    assert.equal(created.status,201);
    const quoteId=created.body.id,requestId=`signing-link-${phase}`,body={quoteId,kind:'customer',requestId};
    assert.equal((await call(delivery.onRequestPost,body)).status,200);
    const token=sends.at(-1).text.match(/\/sign#([\w-]+)/)[1],hash=await hashToken(token);
    if(phase==='before-seal')db.raw.prepare('UPDATE document_deliveries SET sealed_payload=NULL,provider_id=NULL WHERE id=?').run(requestId);
    if(['sealed','expired','missing-sealed'].includes(phase))db.raw.prepare('UPDATE document_deliveries SET provider_id=NULL WHERE id=?').run(requestId);
    let manualHash;
    if(phase==='expired')db.raw.prepare("UPDATE quote_sign_links SET expires_at='2000-01-01T00:00:00Z' WHERE token_hash=?").run(hash);
    else if(phase==='missing-sealed')db.raw.prepare('DELETE FROM quote_sign_links WHERE token_hash=?').run(hash);
    else {
      const manual=await call(share.onRequestPost,{quoteId});assert.equal(manual.status,201);
      manualHash=await hashToken(manual.body.url.split('#')[1]);
    }
    const count=sends.length,retry=await call(delivery.onRequestPost,body);
    assert.equal(retry.status,409,phase);
    assert.equal(retry.body.code,'DELIVERY_LINK_UNAVAILABLE',phase);
    assert.equal(retry.body.resetDelivery,true);
    assert.equal(sends.length,count,'invalid original link is never emailed or falsely reported accepted');
    if(manualHash){
      assert.ok(db.raw.prepare('SELECT revoked_at FROM quote_sign_links WHERE token_hash=?').get(hash).revoked_at,'original stays revoked');
      assert.equal(db.raw.prepare('SELECT revoked_at FROM quote_sign_links WHERE token_hash=?').get(manualHash).revoked_at,null,'retry does not revoke the newer manual link');
    }
    const fresh=await call(delivery.onRequestPost,{...body,requestId:requestId+'-fresh'});assert.equal(fresh.status,200,phase);
    const freshToken=sends.at(-1).text.match(/\/sign#([\w-]+)/)[1];assert.notEqual(freshToken,token);
    const opened=await signing.onRequestGet({env,request:new Request('https://example.test/api/quote-sign',{headers:{'x-sign-token':freshToken}})});
    assert.equal(opened.status,200,'new explicit send contains a usable customer link');
  }
  console.log('PASS: revoked, expired and missing signing links block old email retries; explicit new sends produce usable links without reactivating revoked tokens');
}finally{globalThis.fetch=original;}
