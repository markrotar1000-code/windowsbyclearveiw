import { sendDocumentEmail, deliveryHistory } from './document-delivery.mjs';
import { loadPdfAssets } from './pdf-fonts.mjs';
import { invoicePdf } from './invoice-pdf.mjs';
import { customerLineText } from './quote-measurements.mjs';
import { clean } from './quotes.mjs';
import { formatCents } from './money.mjs';
import { ensureQuoteWorkTypeColumn, workTypeOf } from './work-types.mjs';

const FROM = 'Clearview Windows <estimates@windowsbyclearveiw.com>';
const REPLY_TO = 'owner@windowsbyclearveiw.com';

const invoiceTypeReady = new WeakSet();

export async function ensureInvoiceSchema(db) {
  await ensureInvoiceTables(db);
  // An invoice carries its quote's type ('windows' | 'siding') so lists can filter and label it
  // without joining. Added lazily, like every column added after the first release.
  if (invoiceTypeReady.has(db)) return;
  try {
    await db.prepare(`ALTER TABLE invoices ADD COLUMN work_type TEXT NOT NULL DEFAULT 'windows'`).run();
  } catch (error) {
    if (!/duplicate column/i.test(String(error?.message))) throw error;
  }
  for (const sql of ["ALTER TABLE invoices ADD COLUMN review_hold TEXT", "ALTER TABLE invoices ADD COLUMN due_date TEXT", "ALTER TABLE invoices ADD COLUMN payment_instructions TEXT NOT NULL DEFAULT ''"]) {
    try { await db.prepare(sql).run(); } catch (error) { if (!/duplicate column/i.test(String(error?.message))) throw error; }
  }
  await db.prepare(`CREATE TABLE IF NOT EXISTS invoice_adjustments (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id TEXT NOT NULL REFERENCES invoices(id), at TEXT NOT NULL, kind TEXT NOT NULL, amount_cents INTEGER NOT NULL DEFAULT 0, reason TEXT NOT NULL, actor TEXT NOT NULL DEFAULT 'mark', request_id TEXT UNIQUE)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS invoice_replacements (source_invoice_id TEXT PRIMARY KEY, replacement_invoice_id TEXT NOT NULL UNIQUE, at TEXT NOT NULL)`).run();
  invoiceTypeReady.add(db);
}

async function ensureInvoiceTables(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      quote_id TEXT NOT NULL UNIQUE REFERENCES quotes(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      customer_email TEXT,
      customer_address TEXT,
      customer_city TEXT,
      subtotal_cents INTEGER NOT NULL DEFAULT 0,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      discount_reason TEXT,
      total_cents INTEGER NOT NULL DEFAULT 0,
      sent_at TEXT,
      paid_at TEXT,
      voided_at TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_cents INTEGER NOT NULL,
      line_total_cents INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)`),
  ]);
}

function invoiceIdForQuote(quoteId) { return `INV-${quoteId.replace(/^Q-/, '')}`; }
function invoiceNumberForQuote(quoteId) { return `INV-${quoteId.replace(/^Q-/, '')}`; }
const money = formatCents;
function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function invoiceFinancials(db, invoice, today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })) {
  let paid = 0;
  try { const row = await db.prepare('SELECT COALESCE(SUM(p.amount_paid_cents),0) AS paid FROM jobs j JOIN job_payments p ON p.job_id=j.id WHERE j.quote_id = ?').bind(invoice.quote_id).first(); paid=Number(row?.paid)||0; }
  catch(error) { if(!/no such table/i.test(String(error?.message)))throw error; }
  const credits=await db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS credited FROM invoice_adjustments WHERE invoice_id=? AND kind='credit'").bind(invoice.id).first();
  const credited=Number(credits?.credited)||0,total=Math.max(0,Number(invoice.total_cents)||0),net=Math.max(0,total-credited),balance=invoice.status==='void'?0:Math.max(0,net-paid);
  return { amount_paid_cents:paid,credited_cents:credited,net_total_cents:net,balance_cents:balance,credit_balance_cents:Math.max(0,paid-net),overdue:Boolean(invoice.due_date&&invoice.due_date<today&&balance>0&&!['draft','void'].includes(invoice.status)) };
}

export async function invoiceDocument(context, record) {
  return invoicePdf(record.invoice,record.items,await loadPdfAssets(context.env));
}

export async function getInvoice(db, invoiceId) {
  await ensureInvoiceSchema(db);
  const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first();
  if (!invoice) return null;
  const finance = await invoiceFinancials(db, invoice);
  Object.assign(invoice, finance);
  if(!['draft','void'].includes(invoice.status)&&finance.balance_cents===0)invoice.status='paid';
  const { results: adjustments } = await db.prepare('SELECT * FROM invoice_adjustments WHERE invoice_id = ? ORDER BY id DESC').bind(invoiceId).all();
  const { results: items } = await db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC').bind(invoiceId).all();
  return { invoice, adjustments, deliveries:await deliveryHistory(db,'invoice',invoiceId), items: items.map(item => ({ ...item, label: customerLineText(item.label), description: customerLineText(item.description) })) };
}

export async function ensureInvoiceForQuote(db, quoteId, { finalize = false } = {}) {
  await ensureInvoiceSchema(db);
  await ensureQuoteWorkTypeColumn(db);
  const quote = await db.prepare('SELECT * FROM quotes WHERE id = ?').bind(quoteId).first();
  if (!quote) throw new Error('Quote not found.');
  const workType = workTypeOf(quote);

  const invoice = await db.prepare('SELECT * FROM invoices WHERE quote_id = ?').bind(quoteId).first();
  if (invoice && invoice.status !== 'draft') return getInvoice(db, invoice.id);

  const now = new Date().toISOString();
  const id = invoice?.id || invoiceIdForQuote(quoteId);
  const invoiceNumber = invoice?.invoice_number || invoiceNumberForQuote(quoteId);
  const revisionHold=quote.revision_kind==='revision'&&quote.revision_of?`Replacement for ${quote.revision_of}: reconcile the original invoice before issuing this replacement.`:null;
  const nextStatus = finalize && !revisionHold ? 'open' : 'draft';
  const { results: quoteItems } = await db.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order ASC').bind(quoteId).all();

  await db.batch([
    invoice
      ? db.prepare(`UPDATE invoices SET updated_at = ?, status = ?, customer_name = ?, customer_phone = ?, customer_email = ?, customer_address = ?, customer_city = ?, subtotal_cents = ?, discount_cents = ?, discount_reason = ?, total_cents = ?, work_type = ? WHERE id = ?`)
          .bind(now, nextStatus, quote.customer_name, quote.customer_phone, quote.customer_email, quote.customer_address, quote.customer_city, quote.subtotal_cents, quote.discount_cents, quote.discount_reason, quote.total_cents, workType, id)
      : db.prepare(`INSERT INTO invoices (id, invoice_number, quote_id, created_at, updated_at, status, customer_name, customer_phone, customer_email, customer_address, customer_city, subtotal_cents, discount_cents, discount_reason, total_cents, work_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id, invoiceNumber, quoteId, now, now, nextStatus, quote.customer_name, quote.customer_phone, quote.customer_email, quote.customer_address, quote.customer_city, quote.subtotal_cents, quote.discount_cents, quote.discount_reason, quote.total_cents, workType),
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').bind(id),
    ...quoteItems.map((item, index) => db.prepare(`INSERT INTO invoice_items (invoice_id, sort_order, label, description, quantity, unit_price_cents, line_total_cents) VALUES (?,?,?,?,?,?,?)`)
      .bind(id, index, customerLineText(item.label), customerLineText(item.description), item.quantity, item.unit_price_cents, item.line_total_cents)),
  ]);

  if(revisionHold)await db.prepare('UPDATE invoices SET review_hold=? WHERE id=?').bind(revisionHold,id).run();
  return getInvoice(db, id);
}

function renderEmail(invoice, items) {
  const itemRows = items.map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">${esc(item.label)}${item.description ? `<div style="margin-top:3px;color:#6b7280;font-size:12px;">${esc(item.description)}</div>` : ''}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;">${Number(item.quantity) || 0}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;">${money(item.unit_price_cents)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#111827;">${money(item.line_total_cents)}</td>
    </tr>`).join('');
  const address = [invoice.customer_address, invoice.customer_city].filter(Boolean).map(esc).join(', ');
  const discount = Number(invoice.discount_cents || 0) > 0
    ? `<tr><td colspan="3" style="padding:7px 0;text-align:right;font-family:Arial,Helvetica,sans-serif;color:#6b7280;">${esc(invoice.discount_reason ? `Discount — ${invoice.discount_reason}` : 'Discount')}</td><td style="padding:7px 0;text-align:right;font-family:Arial,Helvetica,sans-serif;color:#111827;">-${money(invoice.discount_cents)}</td></tr>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:28px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e5e7eb;"><tr><td style="padding:28px 30px;border-bottom:2px solid #111827;font-family:Arial,Helvetica,sans-serif;"><img src="https://windowsbyclearview.com/logo/lockup-on-white.png?v=20261028" width="180" alt="ClearView Windows and Trim" style="display:block;max-width:100%;height:auto;margin-bottom:12px;" /><div style="font-size:22px;font-weight:700;color:#111827;">Clearview Windows</div><div style="margin-top:4px;font-size:12px;color:#6b7280;">Clearview Windows &amp; Trim LLC · (564) 208-0801</div></td></tr><tr><td style="padding:26px 30px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">${invoice.balance_cents===0?'Payment receipt':'Invoice'}</div><div style="margin-top:4px;font-size:26px;font-weight:700;color:#111827;">${esc(invoice.invoice_number)}</div><div style="margin-top:6px;font-size:13px;color:#6b7280;">Issued ${new Date(invoice.created_at).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}</div></td></tr><tr><td style="padding:0 30px 24px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Bill to</div><div style="margin-top:6px;font-size:16px;font-weight:700;color:#111827;">${esc(invoice.customer_name)}</div><div style="margin-top:4px;font-size:13px;color:#4b5563;">${address || 'Address on file'}</div><div style="margin-top:3px;font-size:13px;color:#4b5563;">${esc(invoice.customer_email || '')}</div></td></tr><tr><td style="padding:0 30px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><thead><tr><th align="left" style="padding-bottom:8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;color:#6b7280;">Description</th><th align="center" style="padding-bottom:8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;color:#6b7280;">Qty</th><th align="right" style="padding-bottom:8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;color:#6b7280;">Unit</th><th align="right" style="padding-bottom:8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;color:#6b7280;">Amount</th></tr></thead><tbody>${itemRows}</tbody></table></td></tr><tr><td style="padding:14px 30px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td colspan="3" style="padding:5px 0;text-align:right;font-family:Arial,Helvetica,sans-serif;color:#6b7280;">Subtotal</td><td style="padding:5px 0;text-align:right;font-family:Arial,Helvetica,sans-serif;color:#111827;">${money(invoice.subtotal_cents)}</td></tr>${discount}<tr><td colspan="3" style="padding:12px 0 0;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#111827;border-top:2px solid #111827;">Amount due</td><td style="padding:12px 0 0;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#111827;border-top:2px solid #111827;">${money(invoice.balance_cents)}</td></tr><tr><td colspan="3">Payments received</td><td>${money(invoice.amount_paid_cents)}</td></tr><tr><td colspan="3">Credits</td><td>${money(invoice.credited_cents)}</td></tr></table></td></tr><tr><td style="padding:22px 30px;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#4b5563;">${invoice.due_date?`Due ${esc(invoice.due_date)}. `:''}${invoice.payment_instructions?esc(invoice.payment_instructions)+'<br>':''}This invoice was generated from your finalized Clearview quote. Payment terms and project terms remain those shown on the signed agreement. Questions? Reply to this email or call (564) 208-0801.</td></tr></table></td></tr></table></body></html>`;
}

export async function emailInvoice(context, invoiceId, { requestId } = {}) {
  const { env } = context;
  const record = await getInvoice(env.QUOTES_DB, invoiceId);
  if (!record) return { error: 'Invoice not found.', status: 404 };
  const { invoice, items } = record;
  if(invoice.review_hold)return {error:invoice.review_hold,status:409};
  if (invoice.status === 'draft') return { error: 'Finalize the quote before emailing the invoice.', status: 409 };
  if (invoice.status === 'void') return { error: 'A void invoice cannot be emailed.', status: 409 };
  if (!invoice.customer_email) return { error: 'This customer does not have an email address on the invoice.', status: 400 };
  const key = env?.RESEND_API_KEY;
  if (!key) return { error: 'RESEND_API_KEY is not configured.', status: 503 };
  const from = env?.RESEND_FROM || FROM;
  const replyTo = env?.INVOICE_REPLY_TO || env?.NOTIFY_EMAIL || REPLY_TO;
  const bytes = await invoiceDocument(context, record);
  let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  const versionData=JSON.stringify({number:invoice.invoice_number,customer:[invoice.customer_name,invoice.customer_address,invoice.customer_city,invoice.customer_email],total:invoice.total_cents,paid:invoice.amount_paid_cents,credit:invoice.credited_cents,balance:invoice.balance_cents,due:invoice.due_date,instructions:invoice.payment_instructions,items});
  const version=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(versionData)))].map(v=>v.toString(16).padStart(2,'0')).join('');
  const result = await sendDocumentEmail(env,{requestId,documentKind:'invoice',documentId:invoice.id,documentVersion:version,to:invoice.customer_email,payload:{from,to:[invoice.customer_email],reply_to:replyTo,subject:`${invoice.balance_cents===0?'Receipt':'Invoice'} ${invoice.invoice_number} from Clearview Windows`,html:renderEmail(invoice,items),attachments:[{filename:`${invoice.invoice_number}${invoice.balance_cents===0?'-receipt':''}.pdf`,content:btoa(binary)}]}});
  if(!result.ok)return result;
  const now = new Date().toISOString();
  await env.QUOTES_DB.prepare(`UPDATE invoices SET status = CASE WHEN status = 'paid' THEN 'paid' ELSE 'sent' END, sent_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, invoiceId).run();
  return { ...result, ok: true, sentAt: now };
}
