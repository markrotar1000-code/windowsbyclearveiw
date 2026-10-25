// The Setup check says plainly which settings are in place, and never shows a value.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createD1 } from './_lib/d1-sqlite.mjs';
import { checkSetup } from '../functions/internal/_lib/setup-check.mjs';
import * as api from '../functions/internal/api/setup-check.js';

process.removeAllListeners('warning');
const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const pass = (m) => console.log(`PASS: ${m}`);
const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]));

// 1. Nothing set: every item says no, the core ones say they are required.
{
  const items = byId(await checkSetup({}));
  assert.ok(Object.values(items).every((item) => item.ok === false));
  assert.deepEqual(Object.values(items).filter((item) => item.required).map((item) => item.id), ['database', 'sign_in']);
  for (const item of Object.values(items)) { assert.ok(item.label && item.unlocks && item.fix, `${item.id} says what it is, what it unlocks and where to fix it`); }
  pass('with nothing set up every item says so, the core ones are marked required, and each says what it unlocks and where to fix it');
}

// 2. Each setting turns its own item on, and only that one.
{
  const db = createD1();
  const secrets = { GROQ_API_KEY: 'SECRET-groq-111', GEMINI_API_KEY: 'SECRET-gem-222', RESEND_API_KEY: 'SECRET-resend-333', INTERNAL_PASSWORD: 'SECRET-pw-444', INTERNAL_SESSION_SECRET: 'SECRET-sess-555', LEAD_ALERT_NTFY_TOPIC: 'SECRET-topic-666', TURNSTILE_SECRET_KEY: 'SECRET-ts-777' };
  const full = byId(await checkSetup({ ...secrets, QUOTES_DB: db, AI: { run() {} }, JOB_PHOTOS: {} }));
  assert.ok(Object.values(full).every((item) => item.ok), 'everything configured: everything ok');
  assert.equal(full.drafting.note, 'Both providers are set, so one can back up the other.');
  const only = async (extra, id) => { const items = byId(await checkSetup(extra)); assert.deepEqual(Object.values(items).filter((item) => item.ok).map((item) => item.id), [id], `only ${id} is on`); };
  await only({ AI: { run() {} } }, 'voice');
  await only({ GROQ_API_KEY: 'x' }, 'drafting');
  await only({ GEMINI_API_KEY: 'x' }, 'drafting');
  await only({ RESEND_API_KEY: 'x' }, 'email');
  await only({ LEAD_ALERT_NTFY_TOPIC: 'x' }, 'phone_alert');
  await only({ JOB_PHOTOS: {} }, 'photo_backup');
  await only({ TURNSTILE_SECRET_KEY: 'x' }, 'spam_guard');
  await only({ QUOTES_DB: db }, 'database');
  // Blank values are not "set".
  assert.equal(byId(await checkSetup({ GROQ_API_KEY: '   ', RESEND_API_KEY: '' })).drafting.ok, false);
  // A binding that is not what it claims is not "voice".
  assert.equal(byId(await checkSetup({ AI: {} })).voice.ok, false);
  pass('each setting turns on only its own item; blank values and a fake binding do not count');
}

// 3. Sign-in needs a secret AND a way in; the misspelled legacy name still works and says so.
{
  const only = byId(await checkSetup({ INTERNAL_PASSWORD: 'pw' })).sign_in; assert.equal(only.ok, false, 'a password with no session secret cannot sign anyone in');
  const secretOnly = byId(await checkSetup({ INTERNAL_SESSION_SECRET: 's' })).sign_in; assert.equal(secretOnly.ok, false, 'a secret with no password cannot either');
  const good = byId(await checkSetup({ INTERNAL_PASSWORD: 'pw', INTERNAL_SESSION_SECRET: 's' })).sign_in; assert.equal(good.ok, true); assert.equal(good.note, '');
  const legacy = byId(await checkSetup({ INTERNAL_PASSWORD: 'pw', INTERNAL_SESSION_SECRE: 's' })).sign_in;
  assert.equal(legacy.ok, true, 'production really does use the misspelled name; it works'); assert.match(legacy.note, /misspelled name.*INTERNAL_SESSION_SECRET/);
  pass('sign-in needs both a secret and a way in; the legacy misspelled secret still works and is flagged');
}

// 4. A database that fails its test query is not "connected".
{
  const broken = { prepare() { throw new Error('boom'); } };
  assert.equal(byId(await checkSetup({ QUOTES_DB: broken })).database.ok, false);
  assert.equal(byId(await checkSetup({ QUOTES_DB: { prepare: () => ({ first: async () => null }) } })).database.ok, false);
  pass('a database that cannot answer a test query is reported as not connected');
}

// 5. The endpoint never leaks a value.
{
  const values = ['SECRET-groq-111', 'SECRET-gem-222', 'SECRET-resend-333', 'SECRET-pw-444', 'SECRET-sess-555', 'SECRET-topic-666', 'SECRET-ts-777', 'SECRET-legacy-888'];
  const env = { GROQ_API_KEY: values[0], GEMINI_API_KEY: values[1], RESEND_API_KEY: values[2], INTERNAL_PASSWORD: values[3], INTERNAL_SESSION_SECRE: values[7], LEAD_ALERT_NTFY_TOPIC: values[5], TURNSTILE_SECRET_KEY: values[6], QUOTES_DB: createD1(), AI: { run() {} }, JOB_PHOTOS: {} };
  const res = await api.onRequestGet({ env });
  const text = await res.text();
  for (const value of values) assert.ok(!text.includes(value), `the response never contains a setting's value (${value})`);
  const body = JSON.parse(text);
  assert.equal(body.allRequiredOk, true); assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal((await (await api.onRequestGet({ env: {} })).json()).allRequiredOk, false);
  assert.equal((await api.onRequest({ request: new Request('https://x', { method: 'POST' }) })).status, 405);
  pass('the endpoint answers yes or no, never a value, and refuses other methods');
}

// 6. The page shows it, and checks what only the phone can know.
{
  const tools = read('src/pages/internal/tools/index.astro');
  assert.match(tools, /data-setup/); assert.match(tools, /\/internal\/api\/setup-check/); assert.match(tools, /Yes or no only\. No keys, passwords or values are ever shown here/);
  assert.match(tools, /method: 'HEAD'/); assert.match(tools, /permissions-policy/); assert.match(tools, /Microphone allowed on these pages/);
  assert.match(tools, /Tap Check again to try again/); assert.ok(!/innerHTML/.test(tools.slice(tools.indexOf('function initSetup'), tools.indexOf('initSetup();'))), 'the card builds its rows without innerHTML');
  pass('the Tools page shows the check, reads the microphone policy from the page itself, and recovers from a failed load');
}

console.log('\nAll setup check checks passed.');
