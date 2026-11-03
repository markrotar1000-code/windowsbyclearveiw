import { guardWrite, methodNotAllowed } from '../_lib/request-guard.mjs';
import { json } from '../_lib/quotes.mjs';
import { readProductSpecs } from '../_lib/supplier-specs.mjs';
import { readMeasurements } from '../_lib/quote-measurements.mjs';
async function contextFor(env, id) {
  await env.QUOTES_DB.prepare(`CREATE TABLE IF NOT EXISTS supplier_responses (id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id TEXT NOT NULL, at TEXT NOT NULL, supplier TEXT NOT NULL, reference TEXT, amount_cents INTEGER, lead_time TEXT, valid_until TEXT, notes TEXT, source_hash TEXT NOT NULL, source_json TEXT NOT NULL)`).run();
  const quote = await env.QUOTES_DB.prepare('SELECT id FROM quotes WHERE id = ?').bind(id).first();
  if (!quote) return null;
  const { results } = await env.QUOTES_DB.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order ASC, id ASC').bind(id).all();
  const source = JSON.stringify(results.map(i => ({ label: i.label, description: i.description, quantity: i.quantity, productSpecs: readProductSpecs(i), measurements: readMeasurements(i) })));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return { source, hash: [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('') };
}
export async function onRequestGet({ env, request }) {
  const id = new URL(request.url).searchParams.get('quoteId') || '';
  const current = await contextFor(env, id); if (!current) return json({ error: 'Quote not found.' }, 404);
  const { results } = await env.QUOTES_DB.prepare('SELECT id, at, supplier, reference, amount_cents, lead_time, valid_until, notes, source_hash FROM supplier_responses WHERE quote_id = ? ORDER BY id DESC LIMIT 100').bind(id).all();
  return json({ sourceHash: current.hash, responses: results.map(r => ({ ...r, current: r.source_hash === current.hash })) });
}
export async function onRequestPost(context) {
  const guard = await guardWrite(context); if (!guard.ok) return guard.response;
  const body = guard.body;
  if (!body || typeof body.quoteId !== 'string' || typeof body.supplier !== 'string' || !body.supplier.trim()) return json({ error: 'Choose a quote and enter the supplier.' }, 400);
  const current = await contextFor(context.env, body.quoteId); if (!current) return json({ error: 'Quote not found.' }, 404);
  if (body.sourceHash !== current.hash) return json({ error: 'The specifications changed. Refresh and check the supplier response against the current request.' }, 409);
  const amount = body.amountCents === null || body.amountCents === undefined || body.amountCents === '' ? null : Number(body.amountCents);
  if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0 || amount > 500000000)) return json({ error: 'Enter a valid supplier total in cents.' }, 400);
  const valid = String(body.validUntil || '');
  if (valid && (!/^\d{4}-\d{2}-\d{2}$/.test(valid) || (!Number.isFinite(Date.parse(valid)) || new Date(valid).toISOString().slice(0,10) !== valid))) return json({ error: 'Enter a valid expiry date.' }, 400);
  const clean = (value, max) => String(value || '').trim().slice(0, max);
  await context.env.QUOTES_DB.prepare('INSERT INTO supplier_responses (quote_id,at,supplier,reference,amount_cents,lead_time,valid_until,notes,source_hash,source_json) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(body.quoteId, new Date().toISOString(), clean(body.supplier, 200), clean(body.reference, 120), amount, clean(body.leadTime, 200), valid || null, clean(body.notes, 2000), current.hash, current.source).run();
  return json({ ok: true }, 201);
}
export async function onRequest(context) { return context.request.method === 'GET' ? onRequestGet(context) : context.request.method === 'POST' ? onRequestPost(context) : methodNotAllowed(['GET', 'POST']); }
