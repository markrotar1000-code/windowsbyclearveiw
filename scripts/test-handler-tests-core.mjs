// Command Center auth and invoice handlers, run for real: the middleware redirect/pass-through rules,
// the login and logout session cookies, and the invoice endpoint over in-memory SQLite. The Access
// (Cloudflare) paths live in test-access.mjs; this file covers what that one does not.
// Fixture amounts are arbitrary integers used only to prove integer-cent handling.
import assert from 'node:assert/strict';
import { createD1 } from './_lib/d1-sqlite.mjs';
import { onRequest as middleware } from '../functions/internal/_middleware.js';
import { onRequestPost as login, onRequestGet as loginGet } from '../functions/internal/api/login.js';
import { onRequestPost as logout } from '../functions/internal/api/logout.js';
import * as invoiceApi from '../functions/internal/api/invoices/[id].js';
import { createSessionToken, readCookie, verifySessionToken } from '../functions/internal/_lib/session.mjs';
import { ensureInvoiceForQuote } from '../functions/internal/_lib/invoices.mjs';

const pass = (message) => console.log(`PASS: ${message}`);
const ORIGIN = 'https://windowsbyclearview.com';
const env = { INTERNAL_PASSWORD: 'fixture-password', INTERNAL_SESSION_SECRET: 'fixture-secret-fixture-secret' };

// ── Middleware: redirect, pass-through, headers ───────────────────────────
{
  const run = (path, headers = {}, e = env) => middleware({
    request: new Request(`${ORIGIN}${path}`, { headers }),
    env: e,
    next: async () => new Response('page'),
  });
  const cookie = `cv_session=${encodeURIComponent(await createSessionToken(env.INTERNAL_SESSION_SECRET))}`;

  const anon = await run('/internal/jobs?id=7');
  assert.equal(anon.status, 302);
  const to = new URL(anon.headers.get('location'));
  assert.equal(to.pathname, '/internal/login');
  assert.equal(to.searchParams.get('next'), '/internal/jobs?id=7', 'the redirect remembers where the visitor was going');
  assert.equal((await run('/internal/api/invoices/INV-1')).status, 302, 'API paths are protected too');

  for (const path of ['/internal/login', '/internal/login/', '/internal/api/login']) {
    const res = await run(path);
    assert.equal(res.status, 200, `${path} stays public`);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal((await run('/internal/login-fake')).status, 302, 'only the exact public paths are public');

  const signedIn = await run('/internal/today', { cookie });
  assert.equal(signedIn.status, 200);
  assert.equal(signedIn.headers.get('x-robots-tag'), 'noindex, nofollow', 'privacy headers on protected pages');
  assert.equal(signedIn.headers.get('cache-control'), 'private, no-store');

  const other = `cv_session=${encodeURIComponent(await createSessionToken('some-other-secret'))}`;
  assert.equal((await run('/internal/today', { cookie: other })).status, 302, 'a token signed with another secret is refused');
  assert.equal((await run('/internal/today', { cookie: 'cv_session=9999999999.deadbeef' })).status, 302, 'a forged mac is refused');
  assert.equal((await run('/internal/today', { cookie: 'cv_session=%E0%A4%A' })).status, 302, 'a bad percent escape is just signed out, not a 500');
  assert.equal((await run('/internal/today', { cookie }, { INTERNAL_PASSWORD: 'x' })).status, 302, 'no signing secret: nobody is signed in');

  const expired = `${Math.floor(Date.now() / 1000) - 10}.abc`;
  assert.equal(await verifySessionToken(expired, env.INTERNAL_SESSION_SECRET), false, 'expired token');
  assert.equal(readCookie(new Request(ORIGIN, { headers: { cookie: 'a=1; cv_session=abc; b=2' } }), 'cv_session'), 'abc');
  pass('middleware redirects the signed-out, passes public and signed-in paths, sets privacy headers');
}

// ── Login: cookie attributes, wrong password ──────────────────────────────
{
  const post = (fields, e = env) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    return login({ env: e, request: new Request(`${ORIGIN}/internal/api/login`, { method: 'POST', body: form }) });
  };
  const good = await post({ password: env.INTERNAL_PASSWORD, next: '/internal/jobs' });
  assert.equal(good.status, 303);
  assert.equal(new URL(good.headers.get('location')).pathname, '/internal/jobs');
  const set = good.headers.get('set-cookie');
  assert.match(set, /^cv_session=/);
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/internal']) assert.ok(set.includes(attr), `login cookie has ${attr}`);
  assert.match(set, /Max-Age=\d+/);
  assert.equal(good.headers.get('cache-control'), 'no-store');
  const token = decodeURIComponent(set.split(';')[0].slice('cv_session='.length));
  assert.equal(await verifySessionToken(token, env.INTERNAL_SESSION_SECRET), true, 'the issued cookie verifies');

  const offsite = await post({ password: env.INTERNAL_PASSWORD, next: 'https://evil.example/x' });
  assert.equal(new URL(offsite.headers.get('location')).origin, ORIGIN, 'next must stay on this site');
  assert.equal(new URL(offsite.headers.get('location')).pathname, '/internal/quotes');

  for (const [label, fields] of [['wrong password', { password: 'nope' }], ['empty password', { password: '' }], ['no password', {}]]) {
    const res = await post(fields);
    assert.equal(res.status, 303, label);
    assert.equal(res.headers.get('set-cookie'), null, `${label}: no cookie issued`);
    assert.equal(new URL(res.headers.get('location')).searchParams.get('error'), 'wrong-password', label);
  }
  const unconfigured = await post({ password: env.INTERNAL_PASSWORD }, { INTERNAL_SESSION_SECRET: env.INTERNAL_SESSION_SECRET });
  assert.equal(new URL(unconfigured.headers.get('location')).searchParams.get('error'), 'not-configured');
  assert.equal(unconfigured.headers.get('set-cookie'), null);
  assert.equal((await loginGet()).status, 405, 'login is POST only');
  pass('login issues an HttpOnly Secure SameSite=Lax session cookie only for the right password');
}

// ── Logout ────────────────────────────────────────────────────────────────
{
  const res = await logout({ request: new Request(`${ORIGIN}/internal/api/logout`, { method: 'POST' }) });
  assert.equal(res.status, 303);
  assert.equal(new URL(res.headers.get('location')).pathname, '/internal/login');
  const set = res.headers.get('set-cookie');
  assert.match(set, /^cv_session=;/, 'cookie value is emptied');
  assert.match(set, /Max-Age=0/, 'and expired immediately');
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/internal']) assert.ok(set.includes(attr), `clearing cookie keeps ${attr}`);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  pass('logout clears the session cookie and returns to the login page');
}

// ── Invoice endpoint over SQLite ──────────────────────────────────────────
{
  const db = createD1({ schemaFiles: ['functions/api/_data/schema.sql', 'internal/db/schema.sql'] });
  const now = new Date().toISOString();
  const quote = async (id, status, email) => {
    await db.prepare(`INSERT INTO quotes (id, created_at, updated_at, status, customer_name, customer_email, subtotal_cents, discount_cents, total_cents) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(id, now, now, status, 'Test Customer', email, 351, 51, 300).run();
    await db.prepare(`INSERT INTO quote_items (quote_id, sort_order, label, quantity, unit_price_cents, line_total_cents) VALUES (?,?,?,?,?,?)`).bind(id, 0, 'Item A', 3, 117, 351).run();
  };
  await quote('Q-20260101-AAAA', 'finalized', 'customer@example.com');
  await quote('Q-20260101-BBBB', 'draft', 'customer@example.com');
  await quote('Q-20260101-CCCC', 'finalized', null);
  await ensureInvoiceForQuote(db, 'Q-20260101-AAAA', { finalize: true });
  await ensureInvoiceForQuote(db, 'Q-20260101-BBBB');
  await ensureInvoiceForQuote(db, 'Q-20260101-CCCC', { finalize: true });

  const ctx = (method, id, body, e = {}) => ({
    request: new Request(`${ORIGIN}/internal/api/invoices/${id}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }),
    env: { QUOTES_DB: db, ...e },
    params: { id },
    waitUntil() {},
  });
  const get = async (id) => { const r = await invoiceApi.onRequestGet(ctx('GET', id)); return { status: r.status, body: await r.json() }; };
  const post = async (id, body, e) => { const r = await invoiceApi.onRequestPost(ctx('POST', id, body, e)); return { status: r.status, body: await r.json() }; };

  const found = await get('INV-20260101-AAAA');
  assert.equal(found.status, 200);
  assert.equal(found.body.invoice.status, 'open');
  assert.equal(found.body.items.length, 1);
  for (const key of ['subtotal_cents', 'discount_cents', 'total_cents']) assert.ok(Number.isInteger(found.body.invoice[key]), `${key} is an integer`);
  for (const key of ['quantity', 'unit_price_cents', 'line_total_cents']) assert.ok(Number.isInteger(found.body.items[0][key]), `item ${key} is an integer`);
  assert.equal(found.body.invoice.subtotal_cents - found.body.invoice.discount_cents, found.body.invoice.total_cents, 'totals reconcile in cents');
  assert.equal(found.body.items[0].quantity * found.body.items[0].unit_price_cents, found.body.items[0].line_total_cents);
  assert.equal((await get('INV-DOES-NOT-EXIST')).status, 404);
  assert.equal((await get('INV-DOES-NOT-EXIST')).body.error, 'Invoice not found.');

  // Invalid payloads are refused and change nothing.
  const before = (await get('INV-20260101-AAAA')).body.invoice;
  for (const body of [{}, { action: 'void' }, { action: 'paid' }, 'not json', '[]']) {
    const res = await post('INV-20260101-AAAA', body);
    assert.equal(res.status, 400, `rejected: ${JSON.stringify(body)}`);
    // A body that is not JSON is refused by the shared request guard before the action is read.
    assert.equal(res.body.error, body === 'not json' ? 'Invalid JSON.' : 'Unsupported invoice action.');
  }
  assert.deepEqual((await get('INV-20260101-AAAA')).body.invoice, before, 'rejected payloads leave the invoice untouched');

  // Email action guards (no network reached).
  assert.equal((await post('INV-NOPE', { action: 'email' })).status, 404);
  assert.equal((await post('INV-20260101-BBBB', { action: 'email' }, { RESEND_API_KEY: 'k' })).status, 409, 'a draft cannot be emailed');
  assert.equal((await post('INV-20260101-CCCC', { action: 'email' }, { RESEND_API_KEY: 'k' })).status, 400, 'no customer email');
  assert.equal((await post('INV-20260101-AAAA', { action: 'email' })).status, 503, 'no mail key configured');
  assert.equal((await get('INV-20260101-AAAA')).body.invoice.status, 'open', 'a failed send does not mark it sent');

  // Successful send with a stubbed mail API: status moves to sent, amounts untouched and integer.
  const realFetch = globalThis.fetch;
  const quiet = console.error;
  let sent;
  globalThis.fetch = async (url, init) => { sent = { url: String(url), body: JSON.parse(init.body) }; return new Response(JSON.stringify({ id: 'stub' }), { status: 200 }); };
  try {
    const ok = await post('INV-20260101-AAAA', { action: 'email' }, { RESEND_API_KEY: 'k' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.ok, true);
    assert.deepEqual(sent.body.to, ['customer@example.com']);
    assert.equal(sent.url, 'https://api.resend.com/emails');
    const after = (await get('INV-20260101-AAAA')).body.invoice;
    assert.equal(after.status, 'sent');
    assert.ok(after.sent_at);
    assert.equal(after.total_cents, before.total_cents);
    assert.ok(Number.isInteger(after.total_cents));

    // A provider failure is a 502 and the status stays as it was.
    await db.prepare(`UPDATE invoices SET status = 'open', sent_at = NULL WHERE id = ?`).bind('INV-20260101-AAAA').run();
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'bad' }), { status: 500 });
    console.error = () => {};
    const failed = await post('INV-20260101-AAAA', { action: 'email' }, { RESEND_API_KEY: 'k' });
    assert.equal(failed.status, 502);
    assert.equal((await get('INV-20260101-AAAA')).body.invoice.status, 'open');
  } finally {
    console.error = quiet;
    globalThis.fetch = realFetch;
  }

  // A void invoice cannot be emailed.
  await db.prepare(`UPDATE invoices SET status = 'void' WHERE id = ?`).bind('INV-20260101-AAAA').run();
  assert.equal((await post('INV-20260101-AAAA', { action: 'email' }, { RESEND_API_KEY: 'k' })).status, 409);
  pass('invoice GET/POST over SQLite: 404, invalid payloads, email guards, integer cents preserved');
}

console.log('handler-tests-core: ok');
