import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PDFDocument,PDFPage} from 'pdf-lib';
import {quotePdf} from '../functions/internal/_lib/quote-pdf.mjs';
import {loadPdfAssets} from '../functions/internal/_lib/pdf-fonts.mjs';
import {createD1} from './_lib/d1-sqlite.mjs';
import * as quotes from '../functions/internal/api/quotes/index.js';
import * as quoteById from '../functions/internal/api/quotes/[id].js';
import * as delivery from '../functions/internal/api/quote-delivery.js';
import * as webhook from '../functions/api/document-delivery-webhook.js';
import {deliveryHistory} from '../functions/internal/_lib/document-delivery.mjs';
import {freezeSignedQuote} from '../functions/internal/_lib/quote-documents.mjs';
const db=createD1({schemaFiles:['internal/db/schema.sql']});
const env={QUOTES_DB:db,RESEND_API_KEY:'fixture',ASSETS:{fetch:async request=>{try{return new Response(fs.readFileSync(new URL('../public'+new URL(request.url).pathname,import.meta.url)));}catch{return new Response('',{status:404});}}}};
const call=async(fn,method,body,params={},query='')=>{const response=await fn({env,params,request:new Request('https://example.test/internal/api/document'+query,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})});return {status:response.status,body:await response.json()};};
const original=globalThis.fetch;const sends=[];
globalThis.fetch=async(url,options)=>{sends.push(options);return Response.json({id:'email-fixture-'+sends.length});};
try{
  const customer={name:'José Іванов',phone:'5550100100',email:'customer@example.com'};
  const created=await call(quotes.onRequestPost,'POST',{customer,signatureMethod:'pen',items:[{label:'Slider insert',quantity:1,unitPriceCents:100000}]});
  const id=created.body.id;assert.equal(created.status,201);
  const assets=await loadPdfAssets(env);
  const drawnText=[];const drawText=PDFPage.prototype.drawText;
  PDFPage.prototype.drawText=function(value,...args){drawnText.push(value);return drawText.call(this,value,...args);};
  try{
    for(const [kind,label] of [['change-order','CHANGE ORDER'],['revision','REVISED QUOTE']]){
      drawnText.length=0;
      await quotePdf({id,created_at:'2026-11-03',revision_of:'Q-SIGNED-SOURCE',revision_kind:kind,status:'draft'},[],assets);
      assert.ok(drawnText.includes(label));assert.ok(drawnText.includes('Source quote: Q-SIGNED-SOURCE'));
    }
  }finally{PDFPage.prototype.drawText=drawText;}

  let drawn=0;const draw=PDFPage.prototype.drawSvgPath;
  PDFPage.prototype.drawSvgPath=function(...args){drawn++;return draw.apply(this,args);};
  try{await quotePdf({id,created_at:'2026-11-03',customer_name:'José Іванов',status:'finalized',signature_name:'José Іванов',signature_svg:'<svg><path d="M10 10 L20 20"/><path d="M30 30 L40 40"/></svg>'},[],assets);assert.equal(drawn,2,'all signature strokes are rendered');}finally{PDFPage.prototype.drawSvgPath=draw;}
  const supplierPdf=await PDFDocument.load(await quotePdf({id,created_at:'2026-11-03',customer_name:'PRIVATE CUSTOMER NAME'},[],{supplier:true,...assets}));
  assert.equal(supplierPdf.getTitle(),`Supplier RFQ ${id}`,'supplier metadata excludes customer identity');

  const body={quoteId:id,kind:'customer',requestId:'delivery-fixture-1234'};
  assert.equal((await call(delivery.onRequestPost,'POST',body)).status,200);
  assert.match(JSON.parse(sends[0].body).text,/https:\/\/windowsbyclearview.com\/sign#[\w-]+/);
  assert.equal((await call(delivery.onRequestPost,'POST',body)).body.replayed,true);
  assert.equal(sends.length,1,'same successful attempt does not resend');
  assert.ok(sends[0].headers['Idempotency-Key']);
  const stableFetch=globalThis.fetch;let interruptedBody;
  globalThis.fetch=async(url,options)=>{interruptedBody=options.body;throw new Error('response lost');};
  const retryBody={quoteId:id,kind:'customer',requestId:'delivery-retry-fixture'};
  assert.equal((await call(delivery.onRequestPost,'POST',retryBody)).status,502);
  globalThis.fetch=async(url,options)=>{assert.equal(options.body,interruptedBody,'retry uses identical encrypted-persisted payload');return Response.json({id:'email-retry'});};
  assert.equal((await call(delivery.onRequestPost,'POST',retryBody)).status,200);
  globalThis.fetch=stableFetch;

  const history=await deliveryHistory(db,'quote',id);assert.ok(history.every(row=>row.status==='accepted'));assert.ok(!JSON.stringify(history).includes('sealed_payload'));
  const raw=db.raw.prepare('SELECT sealed_payload FROM document_deliveries').get().sealed_payload;assert.ok(!raw.includes('sign#'),'token-bearing payload encrypted at rest');
  // Signing preserves a Unicode customer, frozen terms and signature evidence.
  db.raw.prepare("UPDATE quotes SET signature_method='pen',revision_of='Q-SIGNED-SOURCE',revision_kind='change-order' WHERE id=?").run(id);
  const signed=await call(quoteById.onRequestPatch,'PATCH',{confirmPen:true,signatureName:'José Іванов'},{id});assert.equal(signed.status,200,JSON.stringify(signed.body));
  const a=await freezeSignedQuote(env,id);const snapshot=JSON.parse(a.snapshot_json);assert.equal(snapshot.quote.customer_name,customer.name);assert.equal(snapshot.quote.signature_name,customer.name);assert.equal(snapshot.quote.revision_of,'Q-SIGNED-SOURCE');assert.equal(snapshot.quote.revision_kind,'change-order');
  db.raw.prepare("UPDATE quotes SET customer_name='Changed internal row' WHERE id=?").run(id);
  const b=await freezeSignedQuote(env,id);assert.equal(a.sha256,b.sha256);assert.equal(a.pdf_base64,b.pdf_base64);
  assert.throws(()=>db.raw.prepare("UPDATE quote_document_snapshots SET sha256='changed'").run(),/immutable/);
  // Verified webhook updates are durable and replay-safe; unsigned callbacks cannot change status.
  const secret=crypto.getRandomValues(new Uint8Array(32));env.RESEND_WEBHOOK_SECRET='whsec_'+btoa(String.fromCharCode(...secret));
  const eventBody=JSON.stringify({type:'email.delivered',data:{email_id:'email-fixture-1'}}),eventId='event-fixture-1',timestamp=String(Math.floor(Date.now()/1000));
  const key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${eventId}.${timestamp}.${eventBody}`)))));
  const event=()=>({env,request:new Request('https://example.test/api/document-delivery-webhook',{method:'POST',headers:{'svix-id':eventId,'svix-timestamp':timestamp,'svix-signature':'v1,'+signature},body:eventBody})});
  assert.equal((await webhook.onRequestPost(event())).status,200);assert.equal((await webhook.onRequestPost(event())).status,200);
  assert.ok((await deliveryHistory(db,'quote',id)).some(row=>row.provider_id==='email-fixture-1'&&row.status==='delivered'));
  assert.equal(db.raw.prepare("SELECT count(*) AS n FROM document_delivery_events WHERE webhook_id=?").get(eventId).n,1);
  assert.equal((await webhook.onRequestPost({env,request:new Request('https://example.test/api/webhook',{method:'POST',body:eventBody})})).status,401);
  const raceId='early-provider-event',raceEmail='early-provider-email';
  async function raceEvent(){
    const text=JSON.stringify({type:'email.delivered',created_at:new Date().toISOString(),data:{email_id:raceEmail}});
    const sig=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${raceId}.${timestamp}.${text}`)))));
    return webhook.onRequestPost({env,request:new Request('https://example.test/api/document-delivery-webhook',{method:'POST',headers:{'svix-id':raceId,'svix-timestamp':timestamp,'svix-signature':'v1,'+sig},body:text})});
  }
  globalThis.fetch=async()=>{
    assert.equal((await raceEvent()).status,200);
    assert.equal((await raceEvent()).status,200,'duplicate early event is safe');
    assert.equal(db.raw.prepare('SELECT count(*) AS n FROM document_provider_events WHERE webhook_id=?').get(raceId).n,1,'unmatched verified event persisted');
    return Response.json({id:raceEmail});
  };
  const racing=await call(delivery.onRequestPost,'POST',{quoteId:id,kind:'supplier',to:'supplier@example.com',requestId:'delivery-webhook-race'});
  assert.equal(racing.status,200,JSON.stringify(racing.body));
  const raceHistory=await deliveryHistory(db,'supplier',id);
  assert.equal(raceHistory.find(row=>row.provider_id===raceEmail).status,'delivered','local accepted after early delivered must not downgrade status');
  assert.equal(db.raw.prepare('SELECT count(*) AS n FROM document_delivery_events WHERE webhook_id=?').get(raceId).n,1,'early callback reconciled exactly once');

  console.log('PASS: PDF + signing link, retry idempotency, encrypted delivery attempts, Unicode frozen signed documents, immutable hash, verified replay-safe delivery events');
}finally{globalThis.fetch=original;}

await import('./test-delivery-signing-links.mjs');
