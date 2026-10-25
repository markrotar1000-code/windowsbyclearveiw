// Runs the AI and mail Command Center handlers (copilot, copilot-summary, lead-analyzer,
// mail-test) for real over in-memory SQLite. Providers and Resend are stubbed through a fake
// global fetch: no network, no real keys, no email sent. Fixture names are obviously fake.
import assert from 'node:assert/strict';
import { createD1 } from './_lib/d1-sqlite.mjs';
import { ensureFollowUpSchema } from '../functions/internal/_lib/quote-follow-ups.mjs';
import * as copilot from '../functions/internal/api/copilot.js';
import * as summary from '../functions/internal/api/copilot-summary.js';
import * as analyzer from '../functions/internal/api/lead-analyzer.js';
import * as mailTest from '../functions/internal/api/mail-test.js';

const pass = (m) => console.log(`PASS: ${m}`);
const ORIGIN = 'https://x.test';
const realFetch = globalThis.fetch;

// -- Fake network ------------------------------------------------------------
let calls = [];
let script = {};
const ok = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const groqOk = (text) => () => ok({ choices: [{ message: { content: text } }] });
const geminiOk = (text) => () => ok({ candidates: [{ content: { parts: [{ text }] } }] });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const kind = u.includes('api.groq.com') ? 'groq' : u.includes('generativelanguage.googleapis.com') ? 'gemini' : u.includes('api.resend.com') ? 'resend' : 'other';
  calls.push({ kind, url: u, init });
  if (kind === 'other' || !script[kind]) throw new Error(`unexpected network call: ${u}`);
  return script[kind](u, init);
};
const reset = (s = {}) => { calls = []; script = s; };
const count = (kind) => calls.filter((c) => c.kind === kind).length;

// -- Helpers -----------------------------------------------------------------
function freshEnv(extra = {}) {
  const QUOTES_DB = createD1({ schemaFiles: ['functions/api/_data/schema.sql', 'internal/db/schema.sql'] });
  // follow_up_tasks is created lazily by other handlers; create it so read-only checks cover it.
  QUOTES_DB.raw.exec("CREATE TABLE follow_up_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, lead_id INTEGER, title TEXT NOT NULL, due_at TEXT, status TEXT NOT NULL DEFAULT 'open', notes TEXT, created_by TEXT NOT NULL DEFAULT 'mark')");
  return { QUOTES_DB, ...extra };
}
const KEYS = { GROQ_API_KEY: 'test-groq-key-not-real', GEMINI_API_KEY: 'test-gemini-key-not-real' };
async function call(handler, env, { method = 'POST', body, rawBody, headers = {}, path = '/internal/api/x' } = {}) {
  const init = { method, headers: { 'content-type': 'application/json', ...headers } };
  if (method !== 'GET' && method !== 'OPTIONS') {
    if (rawBody !== undefined) init.body = rawBody;
    else if (body !== undefined) init.body = JSON.stringify(body);
  }
  const response = await handler({ request: new Request(`${ORIGIN}${path}`, init), env, params: {}, waitUntil() {} });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: response.status, body: parsed, text, headers: response.headers };
}
const BIZ_TABLES = ['leads', 'quotes', 'jobs', 'follow_up_tasks', 'payments'];
function dump(env) {
  const out = {};
  const existing = new Set(env.QUOTES_DB.raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name));
  for (const t of BIZ_TABLES.filter((n) => existing.has(n))) {
    out[t] = env.QUOTES_DB.raw.prepare(`SELECT * FROM ${t} ORDER BY 1`).all().map((r) => ({ ...r }));
  }
  return JSON.stringify(out);
}
async function seedLeads(env, n = 3) {
  for (let i = 1; i <= n; i++) {
    await env.QUOTES_DB.prepare('INSERT INTO leads (created_at,name,city,role,notes,page_views_json,visit_count) VALUES (?,?,?,?,?,?,?)')
      .bind(`2026-10-${String(i).padStart(2, '0')}T10:00:00.000Z`, `Test Lead ${i}`, 'Testville', 'Homeowner', `note ${i}`, JSON.stringify([{ title: 'Page', path: '/p' }]), i).run();
  }
}
const LEAD_MSG = 'Analyze these leads and what follow up they need';

// -- copilot.js --------------------------------------------------------------
{
  const env = freshEnv(KEYS);
  await seedLeads(env);
  const before = dump(env);

  reset({ groq: groqOk('Groq says hi') });
  let r = await call(copilot.onRequest, env, { body: { message: 'what needs attention today' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.answer, 'Groq says hi');
  assert.equal(r.body.provider, 'groq');
  assert.equal(r.body.readOnly, true);
  assert.equal(r.body.degraded, false);
  assert.equal(count('gemini'), 0, 'no fan-out when primary works');
  assert.ok(!r.text.includes(KEYS.GROQ_API_KEY), 'response never echoes provider keys');
  const groqCall = calls[0];
  assert.equal(groqCall.init.headers.authorization, `Bearer ${KEYS.GROQ_API_KEY}`, 'key travels in a header');
  assert.ok(!groqCall.url.includes(KEYS.GROQ_API_KEY), 'key is never in the URL');
  assert.equal(JSON.parse(groqCall.init.body).max_tokens, 900, 'output token cap is sent');
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  pass('copilot: groq answer, read-only flag, key only in header, token cap sent');

  reset({ groq: () => ok({}, 500), gemini: geminiOk('Gemini says hi') });
  r = await call(copilot.onRequest, env, { body: { message: 'hello' } });
  assert.equal(r.body.provider, 'gemini');
  assert.equal(r.body.answer, 'Gemini says hi');
  assert.equal(count('groq'), 1);
  assert.equal(count('gemini'), 1, 'one primary plus one fallback only');
  reset({ groq: () => { throw new Error('boom'); }, gemini: () => ok({}, 503) });
  r = await call(copilot.onRequest, env, { body: { message: 'hello' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.provider, 'degraded');
  assert.equal(r.body.degraded, true);
  assert.match(r.body.answer, /couldn't complete the AI response/);
  assert.ok(r.body.verify.length >= 1);
  reset({ groq: groqOk('   '), gemini: () => ok({ candidates: [] }) });
  r = await call(copilot.onRequest, env, { body: { message: 'hello' } });
  assert.equal(r.body.degraded, true, 'empty provider text counts as failure');
  pass('copilot: provider failure falls down groq -> gemini -> degraded message');

  reset({});
  r = await call(copilot.onRequest, freshEnv(), { body: { message: 'hello' } });
  assert.equal(r.body.degraded, true);
  assert.equal(calls.length, 0, 'no keys means no provider calls');
  reset({ gemini: geminiOk('only gemini') });
  r = await call(copilot.onRequest, freshEnv({ GEMINI_API_KEY: KEYS.GEMINI_API_KEY }), { body: { message: 'hello' } });
  assert.equal(r.body.provider, 'gemini');
  assert.equal(count('groq'), 0);
  pass('copilot: missing keys skip the provider without a call');

  reset({ groq: groqOk('ok') });
  const history = Array.from({ length: 25 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `h${i} ${'z'.repeat(3000)}` }));
  r = await call(copilot.onRequest, env, { body: { message: 'm'.repeat(5000), history } });
  assert.equal(r.status, 200);
  const sent = JSON.parse(calls[0].init.body).messages;
  assert.equal(sent.length, 12, 'system + 10 history + user');
  assert.equal(sent.at(-1).content.length, 1000, 'message capped at 1000');
  assert.ok(sent.slice(1, -1).every((m) => m.content.length <= 1000), 'history items capped at 1000');
  assert.ok(sent[1].content.startsWith('h15'), 'only the newest history is kept');
  r = await call(copilot.onRequest, env, { body: { message: '   \u0001 ' } });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'Message is required.');
  r = await call(copilot.onRequest, env, { rawBody: '{nope' });
  assert.equal(r.status, 400);
  r = await call(copilot.onRequest, env, { body: { message: 'x'.repeat(100 * 1024) } });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'Request too large.');
  pass('copilot: message/history/body caps and empty/invalid input');

  reset({ groq: groqOk('ok') });
  r = await call(copilot.onRequest, env, { body: { message: 'hi' }, headers: { origin: 'https://evil.test' } });
  assert.equal(r.status, 403);
  assert.equal(calls.length, 0, 'cross-origin never reaches a provider');
  r = await call(copilot.onRequest, env, { body: { message: 'hi' }, headers: { origin: 'not a url' } });
  assert.equal(r.status, 403);
  r = await call(copilot.onRequest, env, { body: { message: 'hi' }, headers: { origin: ORIGIN } });
  assert.equal(r.status, 200);
  r = await call(copilot.onRequest, env, { method: 'GET' });
  assert.equal(r.status, 405);
  r = await call(copilot.onRequest, env, { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  pass('copilot: same-origin refusal and method handling');

  assert.equal(dump(env), before, 'copilot never changes business rows');
  pass('copilot: D1 rows unchanged');
}

// -- copilot-summary.js ------------------------------------------------------
{
  const env = freshEnv(KEYS);
  // follow_up_tasks is created lazily by the dashboard/tasks handlers, not by copilot-summary.
  await ensureFollowUpSchema(env.QUOTES_DB);
  await seedLeads(env, 2);

  reset({ groq: groqOk('Summary text') });
  let r = await call(summary.onRequest, env, { body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.body.answer, 'Summary text');
  assert.equal(r.body.provider, 'groq');
  assert.equal(r.body.readOnly, true);
  assert.equal(r.body.verify, true);
  const userMsg = JSON.parse(calls[0].init.body).messages.find((m) => m.role === 'user').content;
  assert.match(userMsg, /Test Lead 1/, 'snapshot data is supplied to the model');
  assert.equal(JSON.parse(calls[0].init.body).max_tokens, 700);
  // schema bootstrap has run; baseline for the read-only check
  const before = dump(env);
  pass('summary: groq answer built from the D1 snapshot');

  reset({ groq: () => ok({}, 500), gemini: geminiOk('Gemini summary') });
  r = await call(summary.onRequest, env, { body: {} });
  assert.equal(r.body.provider, 'gemini');
  reset({ groq: () => { throw new Error('down'); }, gemini: () => { throw new Error('down'); } });
  r = await call(summary.onRequest, env, { body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.body.degraded, true);
  assert.equal(r.body.provider, 'degraded');
  assert.match(r.body.answer, /currently unavailable/);
  reset({});
  r = await call(summary.onRequest, { QUOTES_DB: env.QUOTES_DB }, { body: {} });
  assert.equal(r.body.degraded, true);
  assert.equal(calls.length, 0, 'missing keys make no calls');
  pass('summary: fail-down and missing keys');

  reset({ groq: groqOk('x') });
  r = await call(summary.onRequest, env, { body: {}, headers: { origin: 'https://evil.test' } });
  assert.equal(r.status, 403);
  assert.equal(calls.length, 0);
  r = await call(summary.onRequest, env, { rawBody: '{bad' });
  assert.equal(r.status, 400);
  r = await call(summary.onRequest, env, { rawBody: JSON.stringify({ pad: 'x'.repeat(40 * 1024) }) });
  assert.equal(r.status, 413);
  assert.equal(calls.length, 0);
  r = await call(summary.onRequest, { ...env, QUOTES_DB: undefined }, { body: {} });
  assert.equal(r.status, 503);
  r = await call(summary.onRequest, env, { method: 'GET' });
  assert.equal(r.status, 405);
  r = await call(summary.onRequest, env, { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  pass('summary: same-origin, body cap, invalid JSON, missing DB, methods');

  assert.equal(dump(env), before, 'summary never changes business rows');
  pass('summary: D1 rows unchanged');
}

// -- lead-analyzer.js --------------------------------------------------------
{
  const env = freshEnv(KEYS);
  await seedLeads(env, 3);
  const before = dump(env);

  reset({ groq: groqOk('Lead analysis') });
  let r = await call(analyzer.onRequest, env, { body: { message: LEAD_MSG } });
  assert.equal(r.status, 200);
  assert.equal(r.body.provider, 'groq');
  assert.equal(r.body.leadCount, 3);
  assert.equal(r.body.route, 'lead-analyzer');
  assert.equal(r.body.readOnly, true);
  assert.equal(JSON.parse(calls[0].init.body).max_tokens, 800);
  pass('analyzer: groq answer over all recent leads');

  reset({ groq: groqOk('Lead analysis') });
  r = await call(analyzer.onRequest, env, { body: { message: LEAD_MSG, leadIds: [1, '2', '3; DROP TABLE leads', 'abc', 1.5] } });
  assert.equal(r.body.leadCount, 2, 'only integer ids are used');
  const userMsg = JSON.parse(calls[0].init.body).messages.find((m) => m.role === 'user').content;
  assert.ok(userMsg.includes('Test Lead 1') && !userMsg.includes('Test Lead 3'));
  r = await call(analyzer.onRequest, env, { body: { message: LEAD_MSG, leadIds: ['abc'] } });
  assert.equal(r.status, 404);
  r = await call(analyzer.onRequest, env, { body: { message: LEAD_MSG, leadIds: [9999] } });
  assert.equal(r.status, 404, 'unknown lead ids give 404');
  assert.equal(env.QUOTES_DB.raw.prepare('SELECT COUNT(*) c FROM leads').get().c, 3);
  pass('analyzer: lead id sanitising and 404s');

  const big = freshEnv(KEYS);
  await seedLeads(big, 30);
  reset({ groq: groqOk('ok') });
  r = await call(analyzer.onRequest, big, { body: { message: LEAD_MSG } });
  assert.equal(r.body.leadCount, 25, 'at most 25 leads analysed');
  r = await call(analyzer.onRequest, big, { body: { message: LEAD_MSG, leadIds: Array.from({ length: 30 }, (_, i) => i + 1) } });
  assert.equal(r.body.leadCount, 25);
  pass('analyzer: lead budget capped at 25');

  reset({ groq: () => ok({}, 429), gemini: geminiOk('Gem analysis') });
  r = await call(analyzer.onRequest, env, { body: { message: LEAD_MSG } });
  assert.equal(r.body.provider, 'gemini', 'provider rate limit (429) falls to gemini');
  reset({ groq: () => { throw new Error('x'); }, gemini: () => ok({}, 500) });
  r = await call(analyzer.onRequest, env, { body: { message: LEAD_MSG } });
  assert.equal(r.status, 200);
  assert.equal(r.body.degraded, true);
  assert.match(r.body.answer, /currently unavailable/);
  reset({});
  r = await call(analyzer.onRequest, freshEnv(), { body: { message: LEAD_MSG } });
  assert.equal(r.status, 404, 'no leads in a fresh DB');
  const nk = freshEnv();
  await seedLeads(nk, 1);
  r = await call(analyzer.onRequest, nk, { body: { message: LEAD_MSG } });
  assert.equal(r.body.degraded, true);
  assert.equal(calls.length, 0, 'missing keys make no calls');
  pass('analyzer: fail-down, 429 fallback, missing keys');

  reset({ groq: groqOk('x') });
  r = await call(analyzer.onRequest, env, { body: { message: 'draw me a mockup rendering' } });
  assert.equal(r.status, 400);
  assert.equal(calls.length, 0, 'non lead-analysis requests never reach a provider');
  r = await call(analyzer.onRequest, env, { rawBody: 'nope' });
  assert.equal(r.status, 400);
  r = await call(analyzer.onRequest, env, { rawBody: JSON.stringify({ pad: 'x'.repeat(70 * 1024) }) });
  assert.equal(r.status, 413);
  r = await call(analyzer.onRequest, env, { body: { message: LEAD_MSG }, headers: { origin: 'https://evil.test' } });
  assert.equal(r.status, 403);
  r = await call(analyzer.onRequest, { ...env, QUOTES_DB: undefined }, { body: { message: LEAD_MSG } });
  assert.equal(r.status, 503);
  r = await call(analyzer.onRequest, env, { method: 'GET' });
  assert.equal(r.status, 405);
  r = await call(analyzer.onRequest, env, { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  pass('analyzer: route gate, body cap, same-origin, missing DB, methods');

  assert.equal(dump(env), before, 'analyzer never changes business rows');
  pass('analyzer: D1 rows unchanged');
}

// -- mail-test.js ------------------------------------------------------------
{
  const SECRET = 're_test_secret_not_real';
  const RESEND_OK = () => ok({ id: 'msg_test_1' }, 200);

  reset({});
  for (const fn of [mailTest.onRequestPost, mailTest.onRequestGet]) {
    const r = await call(fn, {}, {});
    assert.equal(r.status, 503);
    assert.match(r.body.error, /not configured/);
  }
  assert.equal(calls.length, 0, 'no key means no network call');
  pass('mail-test: unconfigured refuses without any network call');

  reset({ resend: RESEND_OK });
  let r = await call(mailTest.onRequestPost, { RESEND_API_KEY: SECRET, NOTIFY_EMAIL: 'someone@example.test', RESEND_FROM: 'Test <from@example.test>' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.messageId, 'msg_test_1');
  assert.equal(count('resend'), 1);
  const sentBody = JSON.parse(calls[0].init.body);
  assert.deepEqual(sentBody.to, ['someone@example.test']);
  assert.equal(sentBody.from, 'Test <from@example.test>');
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${SECRET}`);
  assert.ok(!r.text.includes(SECRET), 'api key never in response');
  assert.ok(!r.text.includes('someone@example.test'), 'recipient is redacted');
  assert.equal(r.body.recipient, 's***@example.test');
  pass('mail-test: sends once when configured, redacts recipient, hides key');

  reset({ resend: RESEND_OK });
  await call(mailTest.onRequestPost, { RESEND_API_KEY: SECRET });
  const dflt = JSON.parse(calls[0].init.body);
  assert.match(dflt.from, /@windowsbyclearveiw\.com>$/, 'legacy mail domain is preserved');
  assert.match(dflt.to[0], /@windowsbyclearveiw\.com$/);
  pass('mail-test: defaults stay on the legacy mail domain');

  reset({ resend: () => ok({ message: 'domain not verified' }, 403) });
  r = await call(mailTest.onRequestPost, { RESEND_API_KEY: SECRET, NOTIFY_EMAIL: 'someone@example.test', RESEND_FROM: 'from@example.test' });
  assert.equal(r.status, 502);
  assert.equal(r.body.ok, false);
  assert.equal(r.body.resendStatus, 403);
  assert.ok(!r.text.includes(SECRET) && !r.text.includes('someone@example.test') && !r.text.includes('from@example.test'));
  reset({ resend: () => new Response('not json', { status: 500 }) });
  r = await call(mailTest.onRequestPost, { RESEND_API_KEY: SECRET });
  assert.equal(r.status, 502);
  assert.match(r.body.error, /rejected/);
  pass('mail-test: Resend failure gives 502 with no secrets');

  reset({
    resend: (u) => (u.includes('/domains')
      ? ok({ data: [{ id: 'd1', name: 'example.test', status: 'verified', region: 'us-east-1', secret: SECRET }] })
      : ok({ data: [{ id: 'e1', to: ['someone@example.test'], from: 'from@example.test', subject: 'S', created_at: 'T', last_event: 'delivered' }] })),
  });
  r = await call(mailTest.onRequestGet, { RESEND_API_KEY: SECRET }, { method: 'GET' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.ok(calls.every((c) => (c.init.method || 'GET') === 'GET'), 'GET never sends mail');
  assert.ok(!r.text.includes(SECRET) && !r.text.includes('someone@example.test') && !r.text.includes('from@example.test'));
  assert.equal(r.body.domains[0].name, 'example.test');
  reset({ resend: (u) => (u.includes('/domains') ? ok({ data: [] }) : ok({ message: 'nope' }, 401)) });
  r = await call(mailTest.onRequestGet, { RESEND_API_KEY: SECRET }, { method: 'GET' });
  assert.equal(r.status, 502);
  assert.equal(r.body.ok, false);
  pass('mail-test: GET is read-only and redacted');
}

globalThis.fetch = realFetch;
console.log('All AI and mail handler tests passed.');
