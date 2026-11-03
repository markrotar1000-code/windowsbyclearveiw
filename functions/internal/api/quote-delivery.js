import { guardWrite, methodNotAllowed } from '../_lib/request-guard.mjs';
import { json } from '../_lib/quotes.mjs';
import { quotePdf } from '../_lib/quote-pdf.mjs';
import { loadPdfAssets } from '../_lib/pdf-fonts.mjs';
import { customerDocumentBytes, bytesToBase64, freezeSignedQuote } from '../_lib/quote-documents.mjs';
import { sendDocumentEmail, deliveryHistory, ensureDeliverySchema } from '../_lib/document-delivery.mjs';
import { ensureSigningSchema, hashToken, LINK_TTL_DAYS } from '../_lib/quote-signing.mjs';

async function supplierContacts(db){await db.prepare('CREATE TABLE IF NOT EXISTS supplier_contacts(email TEXT PRIMARY KEY,name TEXT NOT NULL,updated_at TEXT NOT NULL)').run();return (await db.prepare('SELECT email,name FROM supplier_contacts ORDER BY name LIMIT 200').all()).results||[];}
async function load(env,id){const quote=await env.QUOTES_DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first();if(!quote)return null;const {results:items}=await env.QUOTES_DB.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order ASC, id ASC').bind(id).all();return{quote,items};}
async function document(record,supplier,env){if(!supplier)return customerDocumentBytes(env,record);const bytes=await quotePdf(record.quote,record.items,{supplier:true,...await loadPdfAssets(env)});const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(record.items)))),b=>b.toString(16).padStart(2,'0')).join('');return{bytes,version:hash};}
async function signingLink(env,quote,id,{allowCreate=true}={}){
  await ensureSigningSchema(env.QUOTES_DB);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.INTERNAL_SESSION_SECRET||env.RESEND_API_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const raw=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`quote-delivery:${quote.id}:${id}`)));
  const token=bytesToBase64(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const hash=await hashToken(token),now=new Date(),expires=new Date(now.getTime()+LINK_TTL_DAYS*86400000);
  const existing=await env.QUOTES_DB.prepare('SELECT quote_id,revoked_at,signed_at,expires_at FROM quote_sign_links WHERE token_hash=?').bind(hash).first();
  // A saved send may outlive its signing link: Mark can replace/revoke it while
  // an email response is interrupted. Never resurrect that token or revoke the
  // newer link merely because the old provider request is being retried.
  if(existing){
    if(existing.quote_id!==quote.id||existing.revoked_at||existing.signed_at||Date.parse(existing.expires_at)<=now.getTime())return null;
    return `https://windowsbyclearview.com/sign#${token}`;
  }
  // A sealed/accepted send must reference the link in its original payload.
  // Missing it (including after a signing-key change) requires a new send.
  if(!allowCreate)return null;
  await env.QUOTES_DB.batch([
    env.QUOTES_DB.prepare('UPDATE quote_sign_links SET revoked_at=? WHERE quote_id=? AND token_hash<>? AND signed_at IS NULL AND revoked_at IS NULL').bind(now.toISOString(),quote.id,hash),
    env.QUOTES_DB.prepare('INSERT OR IGNORE INTO quote_sign_links(token_hash,quote_id,created_at,expires_at) VALUES(?,?,?,?)').bind(hash,quote.id,now.toISOString(),expires.toISOString()),
    env.QUOTES_DB.prepare("UPDATE quotes SET signature_method='digital' WHERE id=? AND status='draft'").bind(quote.id),
  ]);
  return `https://windowsbyclearview.com/sign#${token}`;
}
export async function onRequestGet({env,request}){
  const url=new URL(request.url),id=url.searchParams.get('quoteId')||'';
  if(url.searchParams.get('contacts')==='1')return json({contacts:await supplierContacts(env.QUOTES_DB)});
  if(!/^Q-[\w-]{1,80}$/.test(id))return json({error:'Choose a quote.'},400);
  const record=await load(env,id);if(!record)return json({error:'Quote not found.'},404);
  if(url.searchParams.get('history')==='1')return json({history:await deliveryHistory(env.QUOTES_DB,'quote',id),supplierHistory:await deliveryHistory(env.QUOTES_DB,'supplier',id)});
  if(url.searchParams.get('snapshot')==='1'){const snapshot=record.quote.status==='finalized'?await freezeSignedQuote(env,id):null;return json({snapshot:snapshot?{sha256:snapshot.sha256,templateVersion:snapshot.template_version,createdAt:snapshot.created_at}:null});}
  const supplier=url.searchParams.get('kind')==='supplier',result=await document(record,supplier,env);
  return new Response(result.bytes,{headers:{'content-type':'application/pdf','content-disposition':`${url.searchParams.get('inline')==='1'?'inline':'attachment'}; filename="ClearView-${supplier?'Supplier-Spec':'Quote'}-${id}.pdf"`,'cache-control':'private, no-store','x-content-type-options':'nosniff','x-document-sha256':result.version}});
}
export async function onRequestPost(context){
  const guard=await guardWrite(context);if(!guard.ok)return guard.response;
  const {env}=context,body=guard.body;
  if(body?.action==='save-supplier'){const email=String(body.email||'').trim(),name=String(body.name||email).trim().slice(0,120);if(!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)||email.length>254)return json({error:'Enter a valid supplier email.'},400);await supplierContacts(env.QUOTES_DB);await env.QUOTES_DB.prepare('INSERT INTO supplier_contacts(email,name,updated_at) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at').bind(email,name,new Date().toISOString()).run();return json({ok:true});}
  if(!body||!['customer','supplier'].includes(body.kind)||typeof body.quoteId!=='string')return json({error:'Choose a quote and document type.'},400);
  const record=await load(env,body.quoteId);if(!record)return json({error:'Quote not found.'},404);
  const supplier=body.kind==='supplier',to=String(body.to||(!supplier?record.quote.customer_email:'')||'').trim();
  if(to.length>254||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to))return json({error:'Enter one valid recipient email address.'},400);
  if(!env.RESEND_API_KEY)return json({error:'Email delivery is not configured yet (RESEND_API_KEY).'},503);
  const requestId=body.requestId||crypto.randomUUID();
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))return json({error:'Invalid delivery request id.'},400);
  const result=await document(record,supplier,env);
  await ensureDeliverySchema(env.QUOTES_DB);
  const prior=await env.QUOTES_DB.prepare('SELECT * FROM document_deliveries WHERE id=?').bind(requestId).first();
  if(prior && (prior.document_kind!==(supplier?'supplier':'quote')||prior.document_id!==record.quote.id||prior.document_version!==result.version||prior.recipient!==to))return json({error:'This send belongs to a different document or recipient. Start a new send.',status:409},409);
  let link='';
  if(!supplier&&record.quote.status==='draft'){
    link=await signingLink(env,record.quote,requestId,{allowCreate:!prior?.provider_id&&!prior?.sealed_payload});
    if(!link)return json({error:'The signing link for this email was replaced, revoked or expired. Click Email quote + signing link again to start a new send.',code:'DELIVERY_LINK_UNAVAILABLE',resetDelivery:true},409);
  }
  const subject=supplier?`ClearView supplier pricing request - ${record.quote.id}`:`${record.quote.status==='finalized'?'Your signed ClearView quote':'Your ClearView quote'} - ${record.quote.id}`;
  const message=supplier?'Please review the attached opening specification and return itemized pricing, availability, lead time and any exceptions. This is a pricing request. Confirm final specifications with Mark before ordering.':record.quote.status==='finalized'?'Your signed ClearView quote is attached for your records.':`Your quote is attached. Review and sign securely: ${link}`;
  const payload={from:env.RESEND_FROM||'Clearview Windows <estimates@windowsbyclearveiw.com>',to:[to],reply_to:env.INVOICE_REPLY_TO||env.NOTIFY_EMAIL||'owner@windowsbyclearveiw.com',subject,text:`${message}\n\nClearView Windows & Trim LLC\n(564) 208-0801`,...(link?{html:`<p>Your ClearView quote PDF is attached.</p><p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#17616a;color:#fff;text-decoration:none;border-radius:6px">Review and sign your quote</a></p><p>Questions? Reply to this email or call (564) 208-0801.</p>`}:{}),attachments:[{filename:`ClearView-${supplier?'Supplier-Spec':'Quote'}-${record.quote.id}.pdf`,content:bytesToBase64(result.bytes)}]};
  const sent=await sendDocumentEmail(env,{requestId,documentKind:supplier?'supplier':'quote',documentId:record.quote.id,documentVersion:result.version,to,payload});
  return json(sent,sent.status||200);
}
export async function onRequest(context){const handler={GET:onRequestGet,POST:onRequestPost}[context.request.method];return handler?handler(context):methodNotAllowed(['GET','POST']);}
