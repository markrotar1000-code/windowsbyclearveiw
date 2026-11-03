import { guardWrite, methodNotAllowed } from '../_lib/request-guard.mjs';
import { json } from '../_lib/quotes.mjs';
import { quotePdf } from '../_lib/quote-pdf.mjs';

async function load(env, id) {
  const quote = await env.QUOTES_DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first();
  if (!quote) return null;
  const { results: items } = await env.QUOTES_DB.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order ASC, id ASC').bind(id).all();
  return { quote, items };
}
async function documentBytes(record, supplier, env) {
  let logoBytes;
  try { const response = env.ASSETS ? await env.ASSETS.fetch(new Request('https://windowsbyclearview.com/logo/lockup-on-white.png')) : await fetch('https://windowsbyclearview.com/logo/lockup-on-white.png'); if (response.ok) logoBytes = await response.arrayBuffer(); } catch {}
  return quotePdf(record.quote, record.items, { supplier, logoBytes });
}
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url), id = url.searchParams.get('quoteId') || '';
  if (!/^Q-[\w-]{1,80}$/.test(id)) return json({ error: 'Choose a quote.' }, 400);
  const record = await load(env, id);
  if (!record) return json({ error: 'Quote not found.' }, 404);
  const supplier = url.searchParams.get('kind') === 'supplier';
  const bytes = await documentBytes(record, supplier, env);
  return new Response(bytes, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="ClearView-${supplier ? 'Supplier-Spec' : 'Quote'}-${id}.pdf"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}
export async function onRequestPost(context) {
  const guard = await guardWrite(context);
  if (!guard.ok) return guard.response;
  const { env } = context, body = guard.body;
  if (!body || !['customer', 'supplier'].includes(body.kind) || typeof body.quoteId !== 'string') return json({ error: 'Choose a quote and document type.' }, 400);
  const record = await load(env, body.quoteId);
  if (!record) return json({ error: 'Quote not found.' }, 404);
  const supplier = body.kind === 'supplier';
  const to = String(body.to || (!supplier ? record.quote.customer_email : '') || '').trim();
  if (to.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)) return json({ error: 'Enter one valid recipient email address.' }, 400);
  if (!env.RESEND_API_KEY) return json({ error: 'Email delivery is not configured yet (RESEND_API_KEY).' }, 503);
  const bytes = await documentBytes(record, supplier, env);
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  const subject = supplier ? `ClearView supplier pricing request - ${record.quote.id}` : `Your ClearView quote - ${record.quote.id}`;
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({
    from: env.RESEND_FROM || 'Clearview Windows <estimates@windowsbyclearveiw.com>', to: [to], reply_to: env.INVOICE_REPLY_TO || env.NOTIFY_EMAIL || 'owner@windowsbyclearveiw.com', subject,
    text: supplier ? 'Please review the attached opening specification and return itemized pricing, availability, lead time and any exceptions. This is a pricing request. Please confirm final specifications with Mark before ordering.\n\nClearView Windows & Trim LLC\n(564) 208-0801' : 'Please find your ClearView quote attached as a PDF. Reply to this email or call (564) 208-0801 with any questions.\n\nClearView Windows & Trim LLC',
    attachments: [{ filename: `ClearView-${supplier ? 'Supplier-Spec' : 'Quote'}-${record.quote.id}.pdf`, content: btoa(binary) }],
  }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: 'Email provider did not accept the message. Please try again.' }, 502);
  return json({ ok: true, to, providerId: result.id || null });
}
export async function onRequest(context) {
  const handler = { GET: onRequestGet, POST: onRequestPost }[context.request.method];
  return handler ? handler(context) : methodNotAllowed(['GET', 'POST']);
}
