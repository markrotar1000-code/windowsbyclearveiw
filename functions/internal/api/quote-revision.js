import { onRequestPost as createQuote } from './quotes/index.js';
import { guardWrite, methodNotAllowed } from '../_lib/request-guard.mjs';
import { json } from '../_lib/quotes.mjs';
import { ensureQuoteRevisionSchema } from '../_lib/quote-concurrency.mjs';
import { readMeasurements } from '../_lib/quote-measurements.mjs';

export async function onRequestPost(context) {
  const checked = await guardWrite(context);
  if (!checked.ok) return checked.response;
  const body = checked.body;
  const kind = body?.kind || 'revision';
  if (!['revision', 'change-order'].includes(kind) || typeof body?.quoteId !== 'string') return json({ error: 'Choose a signed source quote and revision type.' }, 400);
  const db = context.env.QUOTES_DB;
  await ensureQuoteRevisionSchema(db);
  const source = await db.prepare('SELECT * FROM quotes WHERE id = ?').bind(body.quoteId).first();
  if (!source) return json({ error: 'Source quote not found.' }, 404);
  if (source.status !== 'finalized') return json({ error: 'Use Edit quote for an unsigned draft. Revisions start from a signed quote.' }, 409);
  const { results: rows } = await db.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order, id').bind(source.id).all();
  // A change order must specify its additional scope explicitly; never duplicate the original
  // contract amount as an additional charge. The normal revision starts from the original.
  if (kind === 'change-order' && !Array.isArray(body.items)) return json({ error: 'Enter the change-order line items and prices. Original contract items are not additional charges.' }, 400);
  const items = kind === 'change-order' ? body.items : rows.map(row => ({ label: row.label, description: row.description, quantity: row.quantity, unitPriceCents: row.unit_price_cents, measurements: readMeasurements(row), productSpecs: (() => { try { return JSON.parse(row.product_specs_json || '{}'); } catch { return {}; } })() }));
  const request = new Request(context.request.url, { method: 'POST', headers: context.request.headers, body: JSON.stringify({
    customer: { name: source.customer_name, phone: source.customer_phone, email: source.customer_email, address: source.customer_address, city: source.customer_city, role: source.customer_role },
    items, workType: source.work_type, signatureMethod: source.signature_method,
    discountCents: kind === 'revision' ? source.discount_cents : (body.discountCents || 0),
    discountReason: kind === 'revision' ? source.discount_reason : body.discountReason,
    notes: source.notes, leadId: source.lead_id, revisionOf: source.id, revisionKind: kind,
  }) });
  return createQuote({ ...context, request });
}
export async function onRequest(context) { return context.request.method === 'POST' ? onRequestPost(context) : methodNotAllowed(['POST']); }
