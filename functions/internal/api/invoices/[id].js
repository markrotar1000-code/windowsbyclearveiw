import { ensurePaymentInvoiceGuards, guardedInvoiceFinanceBatch } from '../../_lib/invoice-finance-guard.mjs';
import { json } from '../../_lib/quotes.mjs';
import { emailInvoice, getInvoice, invoiceDocument } from '../../_lib/invoices.mjs';
import { guardWrite, methodNotAllowed } from '../../_lib/request-guard.mjs';

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = String(params.id || '');
  const record = await getInvoice(env.QUOTES_DB, id);
  if (!record) return json({ error: 'Invoice not found.' }, 404);
  if (new URL(context.request.url).searchParams.get('format') === 'pdf') {
    const bytes = await invoiceDocument(context, record);
    return new Response(bytes, { headers: { 'content-type':'application/pdf', 'content-disposition':`attachment; filename="${record.invoice.invoice_number}.pdf"`, 'cache-control':'private, no-store', 'x-content-type-options':'nosniff' } });
  }
  return json(record);
}

export async function onRequestPost(context) {
  const { params } = context;
  const guard = await guardWrite(context);
  if (!guard.ok) return guard.response;
  const body = guard.body;
  const id = String(params.id || '');

  if(body?.action==='reconcile-revision') {
    const db=context.env.QUOTES_DB,record=await getInvoice(db,id);
    if(!record)return json({error:'Invoice not found.'},404);
    if(!record.invoice.review_hold)return json({error:'This invoice is not awaiting revision reconciliation.'},409);
    const revision=await db.prepare('SELECT revision_of,revision_kind,status FROM quotes WHERE id=?').bind(record.invoice.quote_id).first();
    if(!revision||revision.status!=='finalized'||revision.revision_kind!=='revision')return json({error:'Sign the replacement quote before issuing its invoice.'},409);
    const source=await db.prepare('SELECT id FROM invoices WHERE quote_id=?').bind(revision.revision_of).first();
    if(!source)return json({error:'The source invoice must be available for reconciliation.'},409);
    await ensurePaymentInvoiceGuards(db);
    const original=await getInvoice(db,source.id);
    if(original.invoice.status==='void')return json({error:'The original invoice has already been voided or superseded. Review its correction history before issuing another replacement.'},409);
    if(original.invoice.amount_paid_cents>0)return json({error:'The original invoice has payments. Keep this replacement on hold until the payment/refund or separate delta billing is reconciled. No second full balance has been issued.'},409);
    const reason=typeof body.reason==='string'?body.reason.trim().slice(0,1000):'';
    if(!reason)return json({error:'Enter the reason for replacing the original invoice.'},400);
    const now=new Date().toISOString();
    const noPayments=" AND NOT EXISTS (SELECT 1 FROM jobs j JOIN job_payments p ON p.job_id=j.id WHERE j.quote_id=(SELECT quote_id FROM invoices WHERE id=?) AND p.amount_paid_cents>0)";
    const claim="EXISTS (SELECT 1 FROM invoice_replacements WHERE source_invoice_id=? AND replacement_invoice_id=?)";
    try { await guardedInvoiceFinanceBatch(db,{invoiceId:source.id,mode:'unpaid'},[
      db.prepare("INSERT OR IGNORE INTO invoice_replacements(source_invoice_id,replacement_invoice_id,at) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM invoices WHERE id=? AND status NOT IN ('paid','void'))"+noPayments).bind(source.id,id,now,source.id,...(noPayments?[source.id]:[])),
      db.prepare(`UPDATE invoices SET status='void',voided_at=?,updated_at=? WHERE id=? AND ${claim}`).bind(now,now,source.id,source.id,id),
      db.prepare(`UPDATE invoices SET status='open',review_hold=NULL,updated_at=? WHERE id=? AND review_hold IS NOT NULL AND ${claim}`).bind(now,id,source.id,id),
      db.prepare(`INSERT INTO invoice_adjustments(invoice_id,at,kind,reason) SELECT ?,?,'superseded',? WHERE ${claim}`).bind(source.id,now,`Replaced by ${id}: ${reason}`,source.id,id),
      db.prepare(`INSERT INTO invoice_adjustments(invoice_id,at,kind,reason) SELECT ?,?,'revision-release',? WHERE ${claim}`).bind(id,now,`Replaces ${source.id}: ${reason}`,source.id,id),
    ]); } catch(error) { if(/INVOICE_HAS_PAYMENTS/.test(String(error?.message||error)))return json({error:'A payment was recorded on the original invoice. The replacement remains on hold until reconciliation.',code:'INVOICE_HAS_PAYMENTS'},409);throw error; }
    const released=await getInvoice(db,id);
    if(released.invoice.review_hold)return json({error:'Another replacement has already claimed the original invoice. This invoice remains on hold.'},409);
    return json(await getInvoice(db,id));
  }
  if (body?.action === 'details' || body?.action === 'credit' || (body?.action === 'void' && body.reason)) {
    const record=await getInvoice(context.env.QUOTES_DB,id);
    if(!record)return json({error:'Invoice not found.'},404);
    const db=context.env.QUOTES_DB, now=new Date().toISOString();
    if(body.action==='details') {
      const due=body.dueDate===null||body.dueDate===''?null:body.dueDate;
      if(due!==null && (typeof due!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due+'T12:00:00Z'))||new Date(due+'T12:00:00Z').toISOString().slice(0,10)!==due))return json({error:'Choose a valid due date, or leave it blank.'},400);
      const instructions=typeof body.paymentInstructions==='string'?body.paymentInstructions.trim().slice(0,2000):'';
      await db.batch([db.prepare('UPDATE invoices SET due_date=?,payment_instructions=?,updated_at=? WHERE id=?').bind(due,instructions,now,id),db.prepare("INSERT INTO invoice_adjustments (invoice_id,at,kind,reason) VALUES (?,?,'details',?)").bind(id,now,JSON.stringify({dueDate:due,paymentInstructions:instructions}))]);
    } else {
      if(['draft','void'].includes(record.invoice.status))return json({error:'Only an issued, active invoice can be corrected.'},409);
      const reason=typeof body.reason==='string'?body.reason.trim().slice(0,1000):'';
      if(!reason)return json({error:'Enter the reason for this correction.'},400);
      if(typeof body.requestId!=='string'||!/^[\w-]{16,100}$/.test(body.requestId))return json({error:'A correction reference is required. Reload and try again.'},400);
      const prior=await db.prepare('SELECT invoice_id FROM invoice_adjustments WHERE request_id=?').bind(body.requestId).first();
      if(prior)return prior.invoice_id===id?json(await getInvoice(db,id)):json({error:'Correction reference belongs to another invoice.'},409);
      if(body.action==='void') {
        if(record.invoice.amount_paid_cents>0)return json({error:'This invoice has recorded payments. Use a credit so the customer balance remains traceable.'},409);
        try { await guardedInvoiceFinanceBatch(db,{invoiceId:id,mode:'unpaid'},[db.prepare("UPDATE invoices SET status='void',voided_at=?,updated_at=? WHERE id=? AND status NOT IN ('draft','void')").bind(now,now,id),db.prepare("INSERT INTO invoice_adjustments (invoice_id,at,kind,reason,request_id) VALUES (?,?,'void',?,?)").bind(id,now,reason,body.requestId)]); } catch(error) { if(/INVOICE_HAS_PAYMENTS/.test(String(error?.message||error)))return json({error:'A payment was recorded while this invoice was being voided. Use an audited credit instead.',code:'INVOICE_HAS_PAYMENTS'},409);throw error; }
      } else {
        const cents=body.amountCents;
        if(!Number.isSafeInteger(cents)||cents<=0||cents>record.invoice.net_total_cents)return json({error:'Credit must be a positive whole-cent amount no larger than the uncredited contract total.'},400);
        const result=await db.prepare("INSERT INTO invoice_adjustments (invoice_id,at,kind,amount_cents,reason,request_id) SELECT ?,?,'credit',?,?,? WHERE ? <= (SELECT total_cents-COALESCE((SELECT SUM(amount_cents) FROM invoice_adjustments WHERE invoice_id=? AND kind='credit'),0) FROM invoices WHERE id=? AND status NOT IN ('draft','void'))").bind(id,now,cents,reason,body.requestId,cents,id,id).run();
        if(!result.meta?.changes)return json({error:'Invoice changed. Reload before applying this credit.'},409);
      }
    }
    return json(await getInvoice(db,id));
  }
  if (body?.action !== 'email') return json({ error: 'Unsupported invoice action.' }, 400);

  try {
    const result = await emailInvoice(context, id, {requestId:body.requestId});
    return json(result, result.status || 200);
  } catch (error) {
    console.error('invoice-action-failed', error);
    return json({ error: 'Could not send the invoice.' }, 500);
  }
}

export async function onRequest(context) {
  const handler = new Map([['GET', onRequestGet], ['POST', onRequestPost]]).get(context.request.method);
  return handler ? handler(context) : methodNotAllowed(['GET', 'POST']);
}
