import { quotePdf } from './quote-pdf.mjs';
import { getContractTerms } from './pdf-terms.mjs';
import { customerLineText } from './quote-measurements.mjs';
import { loadPdfAssets } from './pdf-fonts.mjs';
export const QUOTE_TEMPLATE_VERSION='2026-11-03.3';
import { bytesToBase64, base64ToBytes } from './document-bytes.mjs';
export { bytesToBase64, base64ToBytes } from './document-bytes.mjs';
export async function ensureDocumentSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS quote_document_snapshots (quote_id TEXT PRIMARY KEY, template_version TEXT NOT NULL, terms_version TEXT, snapshot_json TEXT NOT NULL, pdf_base64 TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL)`).run();
  await db.prepare(`CREATE TRIGGER IF NOT EXISTS quote_document_snapshot_immutable BEFORE UPDATE ON quote_document_snapshots BEGIN SELECT RAISE(ABORT,'Signed document snapshots are immutable.'); END`).run();
}
export async function freezeSignedQuote(env,id) {
  const db=env.QUOTES_DB;await ensureDocumentSchema(db);
  const existing=await db.prepare('SELECT * FROM quote_document_snapshots WHERE quote_id=?').bind(id).first();
  if(existing)return existing;
  const quote=await db.prepare('SELECT * FROM quotes WHERE id=?').bind(id).first();
  if(!quote||quote.status!=='finalized')return null;
  const terms=getContractTerms(quote.terms_version ?? null);
  if(!terms)throw new Error('The archived terms for this signed quote are unavailable. Restore the matching terms version before generating its PDF.');
  const {results:items}=await db.prepare('SELECT * FROM quote_items WHERE quote_id=? ORDER BY sort_order ASC,id ASC').bind(id).all();
  const safeQuote={};
  for(const key of ['id','created_at','status','customer_name','customer_phone','customer_email','customer_address','customer_city','subtotal_cents','discount_cents','discount_reason','total_cents','terms_version','signature_method','signature_svg','signature_name','signed_at','revision_of','revision_kind'])safeQuote[key]=quote[key]??null;
  const safeItems=(items||[]).map(item=>({label:customerLineText(item.label),description:customerLineText(item.description),quantity:item.quantity,unit_price_cents:item.unit_price_cents,line_total_cents:item.line_total_cents}));
  const snapshot={quote:safeQuote,items:safeItems,terms,templateVersion:QUOTE_TEMPLATE_VERSION};
  const assets=await loadPdfAssets(env);
  const pdf=await quotePdf(safeQuote,safeItems,{...assets,terms:snapshot.terms});
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pdf)),b=>b.toString(16).padStart(2,'0')).join('');
  await db.prepare(`INSERT OR IGNORE INTO quote_document_snapshots(quote_id,template_version,terms_version,snapshot_json,pdf_base64,sha256,created_at) VALUES(?,?,?,?,?,?,?)`).bind(id,QUOTE_TEMPLATE_VERSION,quote.terms_version||null,JSON.stringify(snapshot),bytesToBase64(pdf),sha,new Date().toISOString()).run();
  return db.prepare('SELECT * FROM quote_document_snapshots WHERE quote_id=?').bind(id).first();
}
export async function customerDocumentBytes(env,record) {
  if(record.quote.status==='finalized'){const snapshot=await freezeSignedQuote(env,record.quote.id);return {bytes:base64ToBytes(snapshot.pdf_base64),version:snapshot.sha256,snapshot};}
  const terms=getContractTerms(record.quote.terms_version ?? null);
  if(!terms)throw new Error('The saved contract terms are unavailable. Edit and save this draft before generating its PDF.');
  const bytes=await quotePdf(record.quote,record.items,{...await loadPdfAssets(env),terms});
  const q=record.quote; const source=JSON.stringify({id:q.id,revisionOf:q.revision_of||null,revisionKind:q.revision_kind||null,customer:[q.customer_name,q.customer_phone,q.customer_email,q.customer_address,q.customer_city],totals:[q.subtotal_cents,q.discount_cents,q.total_cents],terms:q.terms_version,items:record.items.map(i=>({label:customerLineText(i.label),description:customerLineText(i.description),quantity:i.quantity,unit:i.unit_price_cents,total:i.line_total_cents}))});
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source))),b=>b.toString(16).padStart(2,'0')).join('');
  return {bytes,version:hash,snapshot:null};
}
