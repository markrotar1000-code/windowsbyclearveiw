import { json } from '../../_lib/quotes.mjs';
import { ensureInvoiceForQuote, ensureInvoiceSchema, invoiceFinancials } from '../../_lib/invoices.mjs';
import { WORK_TYPES } from '../../_lib/work-types.mjs';
import { guardWrite, methodNotAllowed } from '../../_lib/request-guard.mjs';

export async function onRequestGet(context) {
  const { env } = context;
  await ensureInvoiceSchema(env.QUOTES_DB);
  const url = new URL(context.request.url);
  const quoteId = url.searchParams.get('quoteId');
  const workType = url.searchParams.get('workType');
  if (workType && !WORK_TYPES.includes(workType)) return json({ error: 'Choose Windows or Siding.' }, 400);

  if (quoteId) {
    const quote = await env.QUOTES_DB.prepare('SELECT id, status FROM quotes WHERE id = ?').bind(quoteId).first();
    if (!quote) return json({ error: 'Quote not found.' }, 404);
    if (quote.status !== 'finalized') {
      const draftInvoice = await env.QUOTES_DB.prepare('SELECT * FROM invoices WHERE quote_id = ?').bind(quoteId).first();
      return json({ invoice: draftInvoice || null, finalized: false });
    }
    const record = await ensureInvoiceForQuote(env.QUOTES_DB, quoteId, { finalize: true });
    return json({ ...record, finalized: true });
  }

  const page=Math.max(1,Number.parseInt(url.searchParams.get('page')||'1',10)||1),pageSize=50;
  const status=url.searchParams.get('status')||'',search=(url.searchParams.get('search')||'').trim().slice(0,120);
  if(status&&!['draft','open','sent','paid','void','overdue','outstanding'].includes(status))return json({error:'Choose a valid invoice status.'},400);
  const conditions=[],bindings=[];
  if(workType){conditions.push('work_type=?');bindings.push(workType);}
  if(search){conditions.push("INSTR(LOWER(customer_name||' '||invoice_number||' '||COALESCE(customer_city,'')),LOWER(?))>0");bindings.push(search);}
  if(status&&!['overdue','outstanding','paid','open','sent'].includes(status)){conditions.push('status=?');bindings.push(status);}
  if(status==='paid')conditions.push("balance_cents=0 AND status NOT IN ('draft','void')");
  if(status==='open'||status==='sent'){conditions.push('status=? AND balance_cents>0');bindings.push(status);}
  const tables=await env.QUOTES_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('jobs','job_payments')").all();
  const canReadPayments=(tables.results||[]).length===2;
  const paid=canReadPayments?"COALESCE((SELECT SUM(p.amount_paid_cents) FROM jobs j JOIN job_payments p ON p.job_id=j.id WHERE j.quote_id=i.quote_id),0)":'0';
  const credits="COALESCE((SELECT SUM(amount_cents) FROM invoice_adjustments a WHERE a.invoice_id=i.id AND kind='credit'),0)";
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'});
  const inner=`SELECT i.*,${paid} AS amount_paid_cents,${credits} AS credited_cents FROM invoices i`;
  const finance=`SELECT x.*,MAX(0,total_cents-credited_cents) AS net_total_cents,CASE WHEN status='void' THEN 0 ELSE MAX(0,total_cents-credited_cents-amount_paid_cents) END AS balance_cents,MAX(0,amount_paid_cents-MAX(0,total_cents-credited_cents)) AS credit_balance_cents FROM (${inner}) x`;
  if(status==='outstanding')conditions.push("balance_cents>0 AND status NOT IN ('draft','void')");
  if(status==='overdue'){conditions.push("balance_cents>0 AND status NOT IN ('draft','void') AND due_date < ?");bindings.push(today);}
  const where=conditions.length?'WHERE '+conditions.join(' AND '):'';
  const filtered=`SELECT * FROM (${finance}) f ${where}`;
  const count=await env.QUOTES_DB.prepare(`SELECT COUNT(*) AS total FROM (${filtered})`).bind(...bindings).first();
  const rows=await env.QUOTES_DB.prepare(`${filtered} ORDER BY created_at DESC,id ASC LIMIT ? OFFSET ?`).bind(...bindings,pageSize,(page-1)*pageSize).all();
  const invoices=(rows.results||[]).map(invoice=>({...invoice,status:invoice.balance_cents===0&&!['draft','void'].includes(invoice.status)?'paid':invoice.status,overdue:Boolean(invoice.due_date&&invoice.due_date<today&&invoice.balance_cents>0&&!['draft','void'].includes(invoice.status))}));
  const overdue=await env.QUOTES_DB.prepare(`SELECT id,invoice_number,due_date,balance_cents FROM (${finance}) WHERE balance_cents>0 AND status NOT IN ('draft','void') AND due_date < ? ORDER BY due_date ASC LIMIT 50`).bind(today).all();
  const reminders=(overdue.results||[]).map(i=>({invoiceId:i.id,invoiceNumber:i.invoice_number,dueDate:i.due_date,balanceCents:i.balance_cents,href:`/internal/invoices/view?id=${encodeURIComponent(i.id)}`}));
  return json({invoices,page,pageSize,total:Number(count?.total)||0,totalPages:Math.ceil((Number(count?.total)||0)/pageSize),reminders});

}

export async function onRequestPost(context) {
  const { env } = context;
  const guard = await guardWrite(context);
  if (!guard.ok) return guard.response;
  const body = guard.body;
  const quoteId = String(body?.quoteId || '').trim();
  if (!quoteId) return json({ error: 'quoteId is required.' }, 400);

  const quote = await env.QUOTES_DB.prepare('SELECT status FROM quotes WHERE id = ?').bind(quoteId).first();
  if (!quote) return json({ error: 'Quote not found.' }, 404);

  try {
    const record = await ensureInvoiceForQuote(env.QUOTES_DB, quoteId, { finalize: quote.status === 'finalized' });
    return json(record, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not create the invoice.' }, 400);
  }
}

export async function onRequest(context) {
  const handler = new Map([['GET', onRequestGet], ['POST', onRequestPost]]).get(context.request.method);
  return handler ? handler(context) : methodNotAllowed(['GET', 'POST']);
}
