// Write guards on the plan, permit, lead and logout handlers: a cross-site request is refused, an oversized body is
// refused where a cap applies, a method the handler does not support gets a JSON 405, and a valid request still works.
// Real handlers over in-memory SQLite; no network.
import assert from 'node:assert/strict';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as quotesIndex from '../functions/internal/api/quotes/index.js';
import * as buildPlan from '../functions/internal/api/build-plan.js';
import * as planState from '../functions/internal/api/build-plan-state.js';
import * as supplier from '../functions/internal/api/supplier-permits.js';
import * as mailPilot from '../functions/internal/api/mail-pilot.js';
import * as permitLeads from '../functions/internal/api/permit-leads.js';
import * as leads from '../functions/internal/api/leads.js';
import * as logout from '../functions/internal/api/logout.js';

process.removeAllListeners('warning');
const pass = (m) => console.log(`PASS: ${m}`);
const ORIGIN = 'https://x.test';
const CROSS = { Origin: 'https://evil.test' };

const env = { QUOTES_DB: createD1({ schemaFiles: ['functions/api/_data/schema.sql', 'internal/db/schema.sql'] }) };
async function call(handler, { method = 'POST', path = '/', body, raw, headers = {} } = {}) {
  const request = new Request(`${ORIGIN}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await handler({ request, env, params: {}, waitUntil() {} });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, json };
}

// A quote and a generated plan to act on (valid-request path).
const created = await call(quotesIndex.onRequestPost, { path: '/internal/api/quotes', body: {
  customer: { name: 'Pat Doe', phone: '3605550100', city: 'Camas' },
  items: [{ label: 'Slider, fin', quantity: 1, unitPriceCents: 1000 }], signatureMethod: 'pen' } });
assert.equal(created.status, 201);
const quoteId = created.json.id;
const gen = await call(buildPlan.onRequestGet, { method: 'GET', path: `/internal/api/build-plan?quoteId=${quoteId}` });
assert.equal(gen.status, 200);

// build-plan
{
  const path = '/internal/api/build-plan';
  const body = { quoteId, plan: gen.json.plan };
  assert.equal((await call(buildPlan.onRequestPost, { path, body, headers: CROSS })).status, 403);
  assert.equal((await call(buildPlan.onRequestPost, { path, raw: JSON.stringify({ quoteId, pad: 'x'.repeat(1024 * 1024 + 10) }) })).status, 413);
  const m = await call(buildPlan.onRequest, { method: 'DELETE', path });
  assert.equal(m.status, 405); assert.equal(m.headers.get('allow'), 'GET, POST');
  assert.equal((await call(buildPlan.onRequestPost, { path, body })).status, 200);
  assert.equal((await call(buildPlan.onRequestPost, { path, raw: 'not json' })).status, 400);
  pass('build-plan: 403 cross-origin, 413 oversized, 405 wrong method, valid save, 400 bad JSON');
}

// build-plan-state (POST and PUT)
{
  const path = '/internal/api/build-plan-state';
  const body = { quoteId, action: 'submit-review' };
  for (const h of [planState.onRequestPost, planState.onRequestPut]) {
    assert.equal((await call(h, { path, body, headers: CROSS })).status, 403);
    assert.equal((await call(h, { path, raw: JSON.stringify({ quoteId, pad: 'x'.repeat(70 * 1024) }) })).status, 413);
  }
  assert.equal((await call(planState.onRequest, { method: 'DELETE', path })).status, 405);
  const ok = await call(planState.onRequestPost, { path, body });
  assert.equal(ok.status, 200); assert.equal(ok.json.status, 'review');
  pass('build-plan-state: 403, 413, 405, valid transition');
}

// supplier-permits
{
  const path = '/internal/api/supplier-permits';
  const body = { action: 'block', phone: '3605550142', reason: 'asked not to be called' };
  assert.equal((await call(supplier.onRequest, { path, body, headers: CROSS })).status, 403);
  assert.equal((await call(supplier.onRequest, { path, raw: JSON.stringify({ action: 'log', pad: 'x'.repeat(70 * 1024) }) })).status, 413);
  const m = await call(supplier.onRequest, { method: 'DELETE', path });
  assert.equal(m.status, 405); assert.equal(m.headers.get('allow'), 'GET, HEAD, POST');
  const ok = await call(supplier.onRequest, { path, body });
  assert.equal(ok.status, 200); assert.equal(ok.json.blocked, true);
  pass('supplier-permits: 403, 413, 405, valid block');
}

// mail-pilot, permit-leads, leads: read-only, so wrong method and a valid read
for (const [name, mod, path, allow] of [
  ['mail-pilot', mailPilot, '/internal/api/mail-pilot', 'GET, HEAD'],
  ['permit-leads', permitLeads, '/internal/api/permit-leads', 'GET, HEAD'],
  ['leads', leads, '/internal/api/leads', 'GET, HEAD'],
]) {
  const m = await call(mod.onRequest, { method: 'POST', path, body: {} });
  assert.equal(m.status, 405, `${name} POST`); assert.equal(m.headers.get('allow'), allow);
  assert.match(m.headers.get('content-type'), /json/);
  assert.equal((await call(mod.onRequestGet, { method: 'GET', path })).status, 200, `${name} GET`);
  pass(`${name}: JSON 405 on a write, GET still served`);
}

// logout: a same-origin form POST still clears the cookie and redirects
{
  const path = '/internal/api/logout';
  const form = { method: 'POST', path, raw: '', headers: { 'content-type': 'application/x-www-form-urlencoded' } };
  const cross = await call(logout.onRequestPost, { ...form, headers: { ...form.headers, ...CROSS } });
  assert.equal(cross.status, 403);
  assert.equal(cross.headers.get('set-cookie'), null);
  const ok = await call(logout.onRequestPost, { ...form, headers: { ...form.headers, Origin: ORIGIN } });
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get('location'), `${ORIGIN}/internal/login`);
  assert.match(ok.headers.get('set-cookie'), /Max-Age=0/i);
  assert.equal((await call(logout.onRequestPost, form)).status, 303, 'no Origin header (a tool) still works');
  assert.equal((await call(logout.onRequest, { method: 'GET', path })).status, 405);
  pass('logout: 403 cross-origin, same-origin form POST clears cookie and redirects, 405 on GET');
}
