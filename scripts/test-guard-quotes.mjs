// Quote and invoice write handlers: same-origin, bounded JSON body, JSON 405, and unchanged behavior
// for a valid request. Real handlers over in-memory SQLite; no network.
import assert from 'node:assert/strict';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as quotes from '../functions/internal/api/quotes/index.js';
import * as quoteById from '../functions/internal/api/quotes/[id].js';
import * as share from '../functions/internal/api/quote-share.js';
import * as quoteLead from '../functions/internal/api/quote-lead.js';
import * as invoices from '../functions/internal/api/invoices/index.js';
import * as invoiceById from '../functions/internal/api/invoices/[id].js';

const pass = (message) => console.log(`PASS: ${message}`);
const ORIGIN = 'https://x.test';
const env = { QUOTES_DB: createD1({ schemaFiles: ['functions/api/_data/schema.sql', 'internal/db/schema.sql'] }) };

async function call(handler, { method = 'POST', path = '/', body, raw, headers = {}, params = {} } = {}) {
  const init = { method, headers: { 'content-type': 'application/json', ...headers } };
  if (raw !== undefined) init.body = raw;
  else if (body !== undefined) init.body = JSON.stringify(body);
  const response = await handler({ request: new Request(`${ORIGIN}${path}`, init), env, params, waitUntil() {} });
  return { status: response.status, headers: response.headers, body: await response.json() };
}

const validQuote = { workType: 'siding', customer: { name: 'Test Customer', phone: '3605550100' }, items: [{ label: 'Test item', quantity: 1, unitPriceCents: 100 }] };
const newQuote = async (extra = {}) => (await call(quotes.onRequestPost, { path: '/internal/api/quotes', body: { ...validQuote, ...extra } })).body.id;

// Every state-changing handler: [name, handler, method, path, params-builder, valid-body]
const writes = [
  ['quotes POST', quotes.onRequestPost, 'POST', '/internal/api/quotes', () => ({}), validQuote],
  ['quotes/[id] PUT', quoteById.onRequestPut, 'PUT', '/internal/api/quotes/x', (id) => ({ id }), validQuote],
  ['quotes/[id] PATCH', quoteById.onRequestPatch, 'PATCH', '/internal/api/quotes/x', (id) => ({ id }), { confirmPen: true, signatureName: 'x' }],
  ['quotes/[id] DELETE', quoteById.onRequestDelete, 'DELETE', '/internal/api/quotes/x', (id) => ({ id }), undefined],
  ['quote-share POST', share.onRequestPost, 'POST', '/internal/api/quote-share', () => ({}), { quoteId: 'x' }],
  ['quote-share DELETE', share.onRequestDelete, 'DELETE', '/internal/api/quote-share?quoteId=x', () => ({}), undefined],
  ['quote-lead POST', quoteLead.onRequestPost, 'POST', '/internal/api/quote-lead', () => ({}), { quoteId: 'x', leadId: null }],
  ['invoices POST', invoices.onRequestPost, 'POST', '/internal/api/invoices', () => ({}), { quoteId: 'x' }],
  ['invoices/[id] POST', invoiceById.onRequestPost, 'POST', '/internal/api/invoices/x', (id) => ({ id }), { action: 'email' }],
];

const anchor = await newQuote();
for (const [name, handler, method, path, paramsFor, valid] of writes) {
  const base = { method, path, params: paramsFor(anchor) };
  const cross = await call(handler, { ...base, body: valid, headers: { Origin: 'https://evil.test' } });
  assert.equal(cross.status, 403, `${name}: cross-origin refused`);
  const site = await call(handler, { ...base, body: valid, headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(site.status, 403, `${name}: cross-site fetch refused`);
  if (valid !== undefined) {
    const big = await call(handler, { ...base, raw: JSON.stringify({ pad: 'a'.repeat(method === 'PATCH' ? 600 * 1024 : 70 * 1024) }) });
    assert.equal(big.status, 413, `${name}: oversized refused`);
    const bad = await call(handler, { ...base, raw: '{not json' });
    assert.equal(bad.status, 400, `${name}: invalid JSON refused`);
  }
  pass(`${name} guarded`);
}

// Wrong method: JSON 405 with an allow header, from every file.
for (const [name, mod, allow, method, params] of [
  ['quotes', quotes, 'GET, POST', 'PUT', {}],
  ['quotes/[id]', quoteById, 'GET, PUT, DELETE, PATCH', 'POST', { id: anchor }],
  ['quote-share', share, 'GET, POST, DELETE', 'PUT', {}],
  ['quote-lead', quoteLead, 'GET, POST', 'DELETE', {}],
  ['invoices', invoices, 'GET, POST', 'DELETE', {}],
  ['invoices/[id]', invoiceById, 'GET, POST', 'PUT', { id: anchor }],
]) {
  const res = await call(mod.onRequest, { method, params });
  assert.equal(res.status, 405, `${name}: 405`);
  assert.equal(res.headers.get('allow'), allow, `${name}: allow header`);
  assert.equal(res.body.error, 'Method not allowed.');
  pass(`${name} 405`);
}

// Valid requests keep their shape and status.
{
  const created = await call(quotes.onRequestPost, { path: '/internal/api/quotes', body: validQuote });
  assert.equal(created.status, 201);
  assert.deepEqual(Object.keys(created.body).sort(), ['id', 'invoiceId', 'leadId', 'status', 'totalCents', 'workType']);
  const id = created.body.id;

  const put = await call(quoteById.onRequestPut, { method: 'PUT', params: { id }, body: validQuote });
  assert.equal(put.status, 200);
  assert.deepEqual(Object.keys(put.body).sort(), ['id', 'signLinkRevoked', 'totalCents']);

  const shared = await call(share.onRequestPost, { body: { quoteId: id } });
  assert.equal(shared.status, 201);
  assert.ok(shared.body.url.startsWith('https://windowsbyclearview.com/sign#'));
  const revoked = await call(share.onRequestDelete, { method: 'DELETE', path: `/internal/api/quote-share?quoteId=${id}` });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.ok, true);

  const linked = await call(quoteLead.onRequestPost, { body: { quoteId: id, leadId: null } });
  assert.equal(linked.status, 200);
  assert.deepEqual(Object.keys(linked.body).sort(), ['lead', 'leadId', 'ok', 'quoteId']);

  const invoice = await call(invoices.onRequestPost, { body: { quoteId: id } });
  assert.equal(invoice.status, 201);
  const unsupported = await call(invoiceById.onRequestPost, { params: { id: 'x' }, body: { action: 'nope' } });
  assert.equal(unsupported.status, 400);
  assert.equal(unsupported.body.error, 'Unsupported invoice action.');

  const penId = await newQuote();
  const signed = await call(quoteById.onRequestPatch, { method: 'PATCH', params: { id: penId }, body: { confirmPen: true, signatureName: 'Test Customer' } });
  assert.equal(signed.status, 200);
  assert.equal(signed.body.ok, true);

  const second = await newQuote();
  const deleted = await call(quoteById.onRequestDelete, { method: 'DELETE', params: { id: second } });
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.body, { ok: true });
  pass('valid requests keep their response shape and status');
}

// The body cap does not trip on a normal request.
{
  const res = await call(quotes.onRequestPost, { path: '/internal/api/quotes', body: { ...validQuote, notes: 'n'.repeat(2000) } });
  assert.equal(res.status, 201);
  pass('a normal body is under the cap');
}
