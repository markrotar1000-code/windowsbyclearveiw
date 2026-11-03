import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bytesToBase64, base64ToBytes } from '../functions/internal/_lib/document-bytes.mjs';
import { quotePdf } from '../functions/internal/_lib/quote-pdf.mjs';
import { loadPdfAssets } from '../functions/internal/_lib/pdf-fonts.mjs';
import { sendDocumentEmail } from '../functions/internal/_lib/document-delivery.mjs';
import { createD1 } from './_lib/d1-sqlite.mjs';

for (const length of [0, 1, 2, 3, 32767, 32768, 32769, 1500000]) {
  const bytes=Uint8Array.from({length},(_,i)=>i%256);
  const encoded=bytesToBase64(bytes);
  assert.equal(encoded,Buffer.from(bytes).toString('base64'));
  assert.deepEqual(base64ToBytes(encoded),bytes);
}
const env={QUOTES_DB:createD1({schemaFiles:['internal/db/schema.sql']}),RESEND_API_KEY:'fixture-byte-budget',ASSETS:{fetch:async request=>new Response(fs.readFileSync(new URL('../public'+new URL(request.url).pathname,import.meta.url)))}};
const assets=await loadPdfAssets(env);
assert.ok(assets.fontBytes?.length && assets.boldFontBytes?.length && assets.logoBytes?.length,'real deployed assets load');
const quote={id:'Q-QA-BUDGET',created_at:'2026-11-03',customer_name:'José Test',status:'draft',total_cents:24690,subtotal_cents:24690};
const items=[{label:'QA slider',quantity:2,unit_price_cents:12345,line_total_cents:24690,measurements_json:JSON.stringify([{width:'35 1/2',height:'47 3/4',kind:'rough-opening'},{width:'36 1/8',height:'48 1/4',kind:'unit-size'}])}];
const originalFetch=globalThis.fetch;let sends=0,lastBody;
globalThis.fetch=async(_url,options)=>{sends++;lastBody=JSON.parse(options.body);return Response.json({id:'budget-provider-'+sends});};
try {
  for(const supplier of [false,true]){
    const pdf=await quotePdf(quote,items,{...assets,supplier});
    assert.ok(pdf.length<500000,`real branded ${supplier?'supplier':'customer'} PDF is ${pdf.length} bytes`);
    const payload={to:['delivered@resend.dev'],subject:'QA byte budget',attachments:[{filename:'fixture.pdf',content:bytesToBase64(pdf)}]};
    const request={requestId:`budget-${supplier?'supplier':'customer'}`,documentKind:'quote',documentId:quote.id,to:'delivered@resend.dev',payload};
    assert.equal((await sendDocumentEmail(env,request)).ok,true);
    const row=env.QUOTES_DB.raw.prepare('SELECT sealed_payload FROM document_deliveries WHERE id=?').get(request.requestId);
    assert.ok(row.sealed_payload.length<900000,'encrypted persisted payload leaves ample D1 headroom');
    assert.deepEqual(Buffer.from(lastBody.attachments[0].content,'base64'),Buffer.from(pdf));
    console.log(`PASS: real ${supplier?'supplier':'customer'} PDF ${pdf.length} bytes; encrypted payload ${row.sealed_payload.length} bytes`);
  }
  // The byte codec is compatible with the IV + AES-GCM ciphertext format
  // persisted by the previous implementation; retries keep the original body.
  const legacy={to:['delivered@resend.dev'],text:'original legacy payload'};
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.RESEND_API_KEY));
  const key=await crypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt']);
  const iv=new Uint8Array(12);const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(legacy))));
  const oldSealed=Buffer.concat([Buffer.from(iv),Buffer.from(encrypted)]).toString('base64');
  env.QUOTES_DB.raw.prepare("INSERT INTO document_deliveries(id,document_kind,document_id,document_version,recipient,created_at,sealed_payload) VALUES ('legacy-budget','quote','Q-QA-BUDGET','1','delivered@resend.dev','2026-11-03',?)").run(oldSealed);
  assert.equal((await sendDocumentEmail(env,{requestId:'legacy-budget',documentKind:'quote',documentId:quote.id,to:'delivered@resend.dev',payload:{text:'changed'}})).ok,true);
  assert.deepEqual(lastBody,legacy);
  // Already-frozen PDFs retain the old full lockup; do not reject the known
  // 1.104MB document size merely because new documents are now much smaller.
  const frozenAttachment={attachments:[{filename:'legacy.pdf',content:Buffer.alloc(1103909).toString('base64')}]};
  assert.equal((await sendDocumentEmail(env,{requestId:'legacy-pdf-budget',documentKind:'quote',documentId:quote.id,to:'delivered@resend.dev',payload:frozenAttachment})).ok,true);
  const before=sends;
  const oversized=await sendDocumentEmail(env,{requestId:'oversized-budget',documentKind:'quote',documentId:quote.id,to:'delivered@resend.dev',payload:{text:'x'.repeat(1500000)}});
  assert.equal(oversized.status,413);assert.equal(sends,before,'oversized payload is never sent without durable storage');
  assert.equal(env.QUOTES_DB.raw.prepare("SELECT sealed_payload FROM document_deliveries WHERE id='oversized-budget'").get().sealed_payload,null);
  console.log('PASS: byte boundaries, legacy encryption compatibility and oversized delivery refusal');
} finally {globalThis.fetch=originalFetch;}
