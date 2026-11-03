import { guardedInvoiceFinanceBatch } from '../_lib/invoice-finance-guard.mjs';
import { guardWrite, methodNotAllowed } from '../_lib/request-guard.mjs';
import { ensureInvoiceSchema, invoiceFinancials } from '../_lib/invoices.mjs';
import { ensureJobsSchema } from '../_lib/jobs-schema.mjs';
import { formatCents } from '../_lib/money.mjs';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}

/**
 * The invoice for a job's quote is the accounting record of what's owed;
 * job_payments is where Mark actually records what came in. Nothing else
 * connects them, so an invoice could sit at 'open'/'sent' forever even after
 * the balance was paid in full. Mirror the payment total onto the invoice
 * here — the one place a payment amount changes — rather than making every
 * invoice reader recompute it from job_payments.
 */
async function syncInvoiceStatus(db, quoteId, amountPaidCents, now) {
  if (!quoteId) return;
  const invoice = await db.prepare('SELECT id, status, total_cents, sent_at FROM invoices WHERE quote_id = ?').bind(quoteId).first();
  if (!invoice || invoice.status === 'void' || invoice.status === 'draft') return;

  const credits=await db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS n FROM invoice_adjustments WHERE invoice_id=? AND kind='credit'").bind(invoice.id).first();
  const total = Math.max(0, (Number(invoice.total_cents) || 0)-(Number(credits?.n)||0));
  const fullyPaid = amountPaidCents >= total;

  if (fullyPaid && invoice.status !== 'paid') {
    await db.prepare(`UPDATE invoices SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, invoice.id).run();
  } else if (!fullyPaid && invoice.status === 'paid') {
    // A correction dropped the recorded payment back below the total —
    // revert to wherever the invoice was before it was marked paid.
    const revertStatus = invoice.sent_at ? 'sent' : 'open';
    await db.prepare(`UPDATE invoices SET status = ?, paid_at = NULL, updated_at = ? WHERE id = ?`).bind(revertStatus, now, invoice.id).run();
  }
}

async function ensureSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS job_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      amount_paid_cents INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT,
      notes TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_job_payments_job ON job_payments(job_id)`),
    // Append-only: one row each time the paid amount or method changes, so a correction never erases what was recorded before it.
    db.prepare(`CREATE TABLE IF NOT EXISTS job_payment_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      at TEXT NOT NULL,
      previous_cents INTEGER NOT NULL,
      new_cents INTEGER NOT NULL,
      method TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_job_payment_log_job ON job_payment_log(job_id, id)`),
  ]);
  await ensureJobsSchema(db);
}

async function ensurePayment(db, jobId) {
  const now = new Date().toISOString();
  await db.prepare(`INSERT OR IGNORE INTO job_payments (job_id, created_at, updated_at, amount_paid_cents) VALUES (?, ?, ?, 0)`).bind(jobId, now, now).run();
  return db.prepare(`SELECT * FROM job_payments WHERE job_id = ?`).bind(jobId).first();
}

const HISTORY_PER_JOB = 8;

/** The newest changes for these jobs, newest first, at most HISTORY_PER_JOB each. A missing table reads as no history. */
async function readHistory(db, jobIds) {
  const byJob = new Map();
  if (!jobIds.length) return byJob;
  try {
    const marks = jobIds.map(() => '?').join(',');
    const rows = await db.prepare(`SELECT job_id, at, previous_cents, new_cents, method FROM job_payment_log WHERE job_id IN (${marks}) ORDER BY id DESC LIMIT 2000`).bind(...jobIds).all();
    for (const row of rows.results || []) {
      const list = byJob.get(row.job_id) || [];
      if (list.length < HISTORY_PER_JOB) list.push({ at: row.at, previous_cents: Number(row.previous_cents) || 0, new_cents: Number(row.new_cents) || 0, method: row.method || null });
      byJob.set(row.job_id, list);
    }
  } catch { /* no history yet */ }
  return byJob;
}

function buildRecord(job, payment) {
  const total = Math.max(0, Number(job?.total_cents) || 0);
  const paid = Math.max(0, Number(payment?.amount_paid_cents) || 0);
  const balance = Math.max(0, total - paid);
  const status = paid <= 0 ? 'unpaid' : balance <= 0 ? 'paid' : 'partial';
  return { ...payment, status, total_cents: total, balance_cents: balance };
}

export async function onRequestGet(context) {
  const { env } = context;
  await ensureSchema(env.QUOTES_DB);
  await ensureInvoiceSchema(env.QUOTES_DB);
  const url = new URL(context.request.url);
  const jobId = url.searchParams.get('jobId');

  if (jobId) {
    const job = await env.QUOTES_DB.prepare(`SELECT j.*, COALESCE(q.total_cents, j.agreed_cents) AS total_cents FROM jobs j LEFT JOIN quotes q ON q.id = j.quote_id WHERE j.id = ?`).bind(jobId).first();
    if (!job) return json({ error: 'Job not found.' }, 404);
    const payment = await ensurePayment(env.QUOTES_DB, jobId);
    const built=buildRecord(job,payment);
    if(job.quote_id){const invoice=await env.QUOTES_DB.prepare('SELECT * FROM invoices WHERE quote_id=?').bind(job.quote_id).first();if(invoice){const f=await invoiceFinancials(env.QUOTES_DB,invoice);Object.assign(built,{balance_cents:f.balance_cents,credited_cents:f.credited_cents,credit_balance_cents:f.credit_balance_cents,status:f.balance_cents===0?'paid':built.amount_paid_cents>0?'partial':'unpaid'});}}
    return json({ job, payment: built, history: (await readHistory(env.QUOTES_DB, [jobId])).get(jobId) || [] });
  }

  const result = await env.QUOTES_DB.prepare(`
    SELECT j.id, j.quote_id, j.status AS job_status, j.work_type, j.scheduled_date, j.customer_name, j.customer_city,
           COALESCE(q.total_cents, j.agreed_cents) AS total_cents, p.id AS payment_id, p.amount_paid_cents, p.payment_method, p.notes, p.updated_at AS payment_updated_at
    FROM jobs j
    LEFT JOIN quotes q ON q.id = j.quote_id
    LEFT JOIN job_payments p ON p.job_id = j.id
    WHERE j.status <> 'cancelled'
    ORDER BY CASE WHEN j.status = 'completed' THEN 1 ELSE 0 END, COALESCE(j.scheduled_date, '9999-12-31') ASC, j.created_at DESC
  `).all();

  const history = await readHistory(env.QUOTES_DB, (result.results || []).map((row) => row.id));
  const jobs = (result.results || []).map((row) => {
    const total = Math.max(0, Number(row.total_cents) || 0);
    const paid = Math.max(0, Number(row.amount_paid_cents) || 0);
    return { ...row, amount_paid_cents: paid, balance_cents: Math.max(0, total - paid), payment_status: paid <= 0 ? 'unpaid' : paid >= total ? 'paid' : 'partial', history: history.get(row.id) || [] };
  });
  for(const row of jobs){if(row.quote_id){const invoice=await env.QUOTES_DB.prepare('SELECT * FROM invoices WHERE quote_id=?').bind(row.quote_id).first();if(invoice){const finance=await invoiceFinancials(env.QUOTES_DB,invoice);Object.assign(row,{balance_cents:finance.balance_cents,credited_cents:finance.credited_cents,credit_balance_cents:finance.credit_balance_cents,payment_status:finance.balance_cents===0?'paid':row.amount_paid_cents>0?'partial':'unpaid'});}}}
  const page=Math.max(1,Number.parseInt(url.searchParams.get('page')||'1',10)||1),pageSize=50,search=(url.searchParams.get('search')||'').trim().toLowerCase().slice(0,120),filter=url.searchParams.get('filter')||'all';
  const filtered=jobs.filter(row=>(!search||`${row.customer_name} ${row.customer_city||''} ${row.id}`.toLowerCase().includes(search))&&(filter==='all'||filter==='paid'&&row.payment_status==='paid'||filter==='outstanding'&&row.balance_cents>0));
  const summary={totalCents:jobs.reduce((n,j)=>n+(Number(j.total_cents)||0),0),paidCents:jobs.reduce((n,j)=>n+j.amount_paid_cents,0),balanceCents:jobs.reduce((n,j)=>n+j.balance_cents,0),outstandingCount:jobs.filter(j=>j.balance_cents>0).length};
  return json({ jobs:filtered.slice((page-1)*pageSize,page*pageSize),page,pageSize,total:filtered.length,totalPages:Math.ceil(filtered.length/pageSize),summary });
}

export async function onRequestPatch(context) {
  const { env } = context;
  const guard = await guardWrite(context);
  if (!guard.ok) return guard.response;
  const body = guard.body; if (body === null || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Body must be a JSON object.' }, 400);
  await ensureSchema(env.QUOTES_DB);
  await ensureInvoiceSchema(env.QUOTES_DB);
  const jobId = new URL(context.request.url).searchParams.get('jobId');
  if (!jobId) return json({ error: 'jobId is required.' }, 400);

  const job = await env.QUOTES_DB.prepare(`SELECT j.*, COALESCE(q.total_cents, j.agreed_cents) AS total_cents FROM jobs j LEFT JOIN quotes q ON q.id = j.quote_id WHERE j.id = ?`).bind(jobId).first();
  if (!job) return json({ error: 'Job not found.' }, 404);
  if(job.quote_id){const invoice=await env.QUOTES_DB.prepare('SELECT status FROM invoices WHERE quote_id=?').bind(job.quote_id).first();if(invoice?.status==='void')return json({error:'This invoice is void. Resolve the invoice before recording payment.'},409);}
  if (job.status === 'cancelled') return json({ error: 'Cancelled jobs cannot receive payment records.' }, 409);


  const total = Math.max(0, Number(job.total_cents) || 0);
  const current = await ensurePayment(env.QUOTES_DB, jobId);
  let amountPaid = current.amount_paid_cents;
  if (body.amountPaidCents !== undefined) {
    // Number('') / Number(null) / Number(true) coerce to 0 or 1 and would silently wipe or
    // rewrite a payment record; only a real number or numeric string is an amount.
    const raw = body.amountPaidCents;
    const numeric = typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '');
    amountPaid = numeric ? Number(raw) : NaN;
    if (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > total) {
      return json({ error: `Amount paid must be between $0 and ${formatCents(total)}.` }, 400);
    }
    amountPaid = Math.round(amountPaid);
  }
  const method = typeof body.paymentMethod === 'string' ? body.paymentMethod.trim().slice(0, 80) || null : current.payment_method;
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 4000) : current.notes;
  const now = new Date().toISOString();

  // The update and its history row go in together: a payment change is never saved without its record.
  const changed = amountPaid !== current.amount_paid_cents || (method || null) !== (current.payment_method || null);
  const statements = [env.QUOTES_DB.prepare(`UPDATE job_payments SET updated_at = ?, amount_paid_cents = ?, payment_method = ?, notes = ? WHERE job_id = ?`).bind(now, amountPaid, method, notes, jobId)];
  if (changed) statements.push(env.QUOTES_DB.prepare(`INSERT INTO job_payment_log (job_id, at, previous_cents, new_cents, method) VALUES (?, ?, ?, ?, ?)`).bind(jobId, now, Number(current.amount_paid_cents) || 0, amountPaid, method));
  try { await guardedInvoiceFinanceBatch(env.QUOTES_DB,{quoteId:job.quote_id||null,mode:'payment'},statements); } catch(error) { if(/INVOICE_VOID_CONFLICT/.test(String(error?.message||error)))return json({error:'The invoice was voided while this payment was being saved. Reload before reconciling the payment.',code:'INVOICE_VOID_CONFLICT'},409);throw error; }

  if (job.quote_id) await syncInvoiceStatus(env.QUOTES_DB, job.quote_id, amountPaid, now);

  const payment = await env.QUOTES_DB.prepare(`SELECT * FROM job_payments WHERE job_id = ?`).bind(jobId).first();
  const built=buildRecord(job,payment);
  if(job.quote_id){const invoice=await env.QUOTES_DB.prepare('SELECT * FROM invoices WHERE quote_id=?').bind(job.quote_id).first();if(invoice){const f=await invoiceFinancials(env.QUOTES_DB,invoice);Object.assign(built,{balance_cents:f.balance_cents,credited_cents:f.credited_cents,credit_balance_cents:f.credit_balance_cents,status:f.balance_cents===0?'paid':built.amount_paid_cents>0?'partial':'unpaid'});}}
  return json({ ok: true, payment: built, history: (await readHistory(env.QUOTES_DB, [jobId])).get(jobId) || [] });
}

// Dispatches by method and answers anything else with a JSON 405.
export async function onRequest(context) {
  const handler = ({ GET: onRequestGet, PATCH: onRequestPatch })[context.request.method];
  return handler ? handler(context) : methodNotAllowed(['GET', 'PATCH']);
}
