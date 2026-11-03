import assert from 'node:assert/strict';
import {createD1} from './_lib/d1-sqlite.mjs';
import * as quotes from '../functions/internal/api/quotes/index.js';
import * as quote from '../functions/internal/api/quotes/[id].js';
import * as jobs from '../functions/internal/api/jobs.js';
import * as payments from '../functions/internal/api/payments.js';
import * as invoices from '../functions/internal/api/invoices/[id].js';
async function fixture(){
 const env={QUOTES_DB:createD1({schemaFiles:['internal/db/schema.sql']}),ASSETS:{fetch:async()=>new Response('',{status:404})}};
 const call=async(fn,method,body,params={},query='')=>{const r=await fn({env,params,waitUntil(){},request:new Request('https://example.test/x'+query,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})});return{status:r.status,body:await r.json()};};
 const create=async(extra={})=>{const c=await call(quotes.onRequestPost,'POST',{customer:{name:'Finance race fixture',phone:'5550100100'},signatureMethod:'pen',items:[{label:'Slider',quantity:1,unitPriceCents:10000}],...extra});assert.equal(c.status,201);await call(quote.onRequestPatch,'PATCH',{confirmPen:true,signatureName:'Finance race fixture'},{id:c.body.id});return c.body;};
 const source=await create(),job=await call(jobs.onRequestPost,'POST',{quoteId:source.id});assert.equal(job.status,201);
 return{env,call,create,source,job:job.body};
}
function interceptFinanceBatch(db,mode,inject){const originalPrepare=db.prepare,originalBatch=db.batch,tags=new WeakMap();let armed=true;
 const track=(statement,sql,args=[])=>{tags.set(statement,{sql,args});const bind=statement.bind;statement.bind=(...next)=>track(bind(...next),sql,next);return statement;};
 db.prepare=sql=>track(originalPrepare(sql),sql);
 db.batch=async statements=>{if(armed&&statements.some(s=>{const tag=tags.get(s);return tag?.sql.includes('INSERT INTO invoice_finance_guards')&&tag.args[3]===mode;})){armed=false;await inject();}return originalBatch(statements);};
 return()=>{db.prepare=originalPrepare;db.batch=originalBatch;};
}
// First-ever payment appears after the void request read a zero payment balance.
{
 const {env,call,source,job}=await fixture();assert.equal(env.QUOTES_DB.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='job_payments'").get().n,0);
 const restore=interceptFinanceBatch(env.QUOTES_DB,'unpaid',async()=>assert.equal((await call(payments.onRequestPatch,'PATCH',{amountPaidCents:1000},{},'?jobId='+job.id)).status,200));
 let response;try{response=await call(invoices.onRequestPost,'POST',{action:'void',reason:'Race test',requestId:'finance-void-race-001'},{id:source.invoiceId});}finally{restore();}
 assert.equal(response.status,409);assert.equal(response.body.code,'INVOICE_HAS_PAYMENTS');assert.equal(env.QUOTES_DB.raw.prepare('SELECT status FROM invoices WHERE id=?').get(source.invoiceId).status,'open');assert.equal(env.QUOTES_DB.raw.prepare("SELECT COUNT(*) AS n FROM invoice_adjustments WHERE invoice_id=? AND kind='void'").get(source.invoiceId).n,0);
}
// An invoice is voided after a payment request reads it as open but before that payment batch writes.
{
 const {env,call,source,job}=await fixture();
 const restore=interceptFinanceBatch(env.QUOTES_DB,'payment',async()=>assert.equal((await call(invoices.onRequestPost,'POST',{action:'void',reason:'Race test',requestId:'finance-void-race-002'},{id:source.invoiceId})).status,200));
 let response;try{response=await call(payments.onRequestPatch,'PATCH',{amountPaidCents:1000},{},'?jobId='+job.id);}finally{restore();}
 assert.equal(response.status,409);assert.equal(response.body.code,'INVOICE_VOID_CONFLICT');assert.equal(env.QUOTES_DB.raw.prepare('SELECT amount_paid_cents FROM job_payments WHERE job_id=?').get(job.id).amount_paid_cents,0);assert.equal(env.QUOTES_DB.raw.prepare('SELECT COUNT(*) AS n FROM job_payment_log WHERE job_id=?').get(job.id).n,0);
}
// First-ever payment races with replacement release; no supersede history or replacement claim survives.
{
 const {env,call,create,source,job}=await fixture();const replacement=await create({revisionOf:source.id,revisionKind:'revision'});
 const restore=interceptFinanceBatch(env.QUOTES_DB,'unpaid',async()=>assert.equal((await call(payments.onRequestPatch,'PATCH',{amountPaidCents:1000},{},'?jobId='+job.id)).status,200));
 let response;try{response=await call(invoices.onRequestPost,'POST',{action:'reconcile-revision',reason:'Replacement race test'},{id:replacement.invoiceId});}finally{restore();}
 assert.equal(response.status,409);assert.equal(response.body.code,'INVOICE_HAS_PAYMENTS');assert.ok(env.QUOTES_DB.raw.prepare('SELECT review_hold FROM invoices WHERE id=?').get(replacement.invoiceId).review_hold);assert.equal(env.QUOTES_DB.raw.prepare('SELECT COUNT(*) AS n FROM invoice_replacements WHERE source_invoice_id=?').get(source.invoiceId).n,0);
}
console.log('PASS: forced first-payment/void/replacement races refuse conflicts transactionally without partial payment/history/replacement mutations');
