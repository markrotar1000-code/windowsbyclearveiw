// Counts only: is voice quoting being used? Nothing here may hold audio, words, customers or anything identifying.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as usageApi from '../functions/internal/api/feature-usage.js';
import * as dictation from '../functions/internal/api/quote-dictation.js';
import * as notesApi from '../functions/internal/api/quote-notes.js';
import { FEATURES, CLIENT_FEATURES, readUsage, recordUsage } from '../functions/internal/_lib/feature-usage.mjs';

process.removeAllListeners('warning');
const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const pass = (m) => console.log(`PASS: ${m}`);
const day = (offset = 0, from = new Date('2026-10-25T12:00:00Z')) => new Date(from.getTime() + offset * 86_400_000);
const NOW = new Date('2026-10-25T12:00:00Z');

// 1. Recording and reading.
{
  const db = createD1(); const env = { QUOTES_DB: db };
  assert.equal(await recordUsage(env, 'dictation_clip', 'ok', NOW), true);
  await recordUsage(env, 'dictation_clip', 'ok', NOW); await recordUsage(env, 'dictation_clip', 'degraded', NOW);
  await recordUsage(env, 'quote_draft', 'ok', day(-3, NOW));
  await recordUsage(env, 'quote_draft', 'ok', day(-40, NOW));        // outside a 30 day window
  const usage = await readUsage(db, 30, NOW);
  assert.deepEqual(usage.features.dictation_clip, { ok: 2, degraded: 1, days: 1 });
  assert.deepEqual(usage.features.quote_draft, { ok: 1, degraded: 0, days: 1 }, 'a count from 40 days ago is not in a 30 day window');
  assert.equal((await readUsage(db, 90, NOW)).features.quote_draft.ok, 2, 'but is in a 90 day window');
  assert.deepEqual(usage.features.measurements_imported, { ok: 0, degraded: 0, days: 0 });
  assert.equal(Object.keys(usage.features).length, FEATURES.length);
  assert.equal(await recordUsage(env, 'not_a_feature', 'ok', NOW), false, 'unknown features are not counted');
  assert.equal(await recordUsage({}, 'dictation_clip', 'ok', NOW), false, 'no database: not counted, no error');
  assert.equal(await recordUsage({ QUOTES_DB: { prepare() { throw new Error('boom'); } } }, 'dictation_clip', 'ok', NOW), false, 'a failing database never throws');
  pass('counts per day and feature, windowed, unknown features and a broken database are harmless');
}

// 2. Nothing identifying can be stored: the table has no room for it.
{
  const db = createD1(); await recordUsage({ QUOTES_DB: db }, 'quote_draft', 'ok', NOW);
  const columns = (await db.prepare('PRAGMA table_info(feature_usage)').all()).results.map((c) => c.name);
  assert.deepEqual(columns, ['day', 'feature', 'ok', 'degraded'], 'the table holds a day, a feature and two counts, nothing else');
  const src = read('functions/internal/_lib/feature-usage.mjs').replace(/\/\/.*$/gm, '');
  assert.ok(!/\b(request|headers|cf-connecting-ip|ip|phone|email|audio|transcript|customer|body)\b/i.test(src), 'the module never touches a request, person or content');
  pass('the usage table can only hold a day, a feature and two counts');
}

// 3. The endpoints count what happens.
{
  const db = createD1(); const env = { QUOTES_DB: db };
  const audio = new Uint8Array(5000);
  const clip = (ai) => ({ request: new Request('https://windowsbyclearview.com/internal/api/quote-dictation', { method: 'POST', headers: { 'content-type': 'audio/webm' }, body: audio }), env: { ...env, AI: ai } });
  await dictation.onRequestPost(clip({ run: async () => ({ text: 'Kitchen two double-hungs.' }) }));
  await dictation.onRequestPost(clip({ run: async () => ({ text: '  ' }) }));
  await dictation.onRequestPost(clip({ run: async () => { throw new Error('quota'); } }));
  await dictation.onRequestPost(clip(undefined));
  let u = await readUsage(db, 30);
  assert.deepEqual([u.features.dictation_clip.ok, u.features.dictation_clip.degraded], [1, 3], 'one clip worked; silence, a model error and a missing binding are counted as not working');

  const realFetch = globalThis.fetch;
  const draft = (lines) => JSON.stringify({ customer: {}, lines });
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: draft([{ type: 'window', openingId: 'slider', quantity: 1, room: 'Den' }]) } }] }), { status: 200 });
    const post = (notes, e) => notesApi.onRequestPost({ request: new Request('https://windowsbyclearview.com/internal/api/quote-notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notes }) }), env: { ...e, QUOTES_DB: db, GROQ_API_KEY: 'g' } });
    await post('Den slider.', {});
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: draft([]) } }] }), { status: 200 });
    await post('Nothing quotable.', {});
    globalThis.fetch = async () => new Response('nope', { status: 500 });
    await post('Den slider.', {});
  } finally { globalThis.fetch = realFetch; }
  u = await readUsage(db, 30);
  assert.deepEqual([u.features.quote_draft.ok, u.features.quote_draft.degraded], [1, 2], 'a draft with lines worked; no lines and a provider failure are counted as not working');
  pass('clips and drafts are counted by what happened to them');
}

// 4. The usage endpoint: allowlisted reports, same origin, read.
{
  const db = createD1(); const env = { QUOTES_DB: db };
  const post = (body, headers = {}) => usageApi.onRequestPost({ request: new Request('https://windowsbyclearview.com/internal/api/feature-usage', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env });
  assert.equal((await post({ feature: 'quote_saved_with_draft' })).status, 200);
  assert.equal((await post({ feature: 'measurements_imported' })).status, 200);
  for (const feature of ['dictation_clip', 'quote_draft', 'nope', '', 5, null]) assert.equal((await post({ feature })).status, 400, `the browser cannot report ${feature}`);
  assert.equal((await post('{nope')).status, 400);
  assert.equal((await post({ feature: 'quote_saved_with_draft' }, { origin: 'https://evil.example' })).status, 403);
  assert.deepEqual(CLIENT_FEATURES, ['quote_saved_with_draft', 'measurements_imported']);
  const got = await (await usageApi.onRequestGet({ request: new Request('https://windowsbyclearview.com/internal/api/feature-usage?days=30'), env })).json();
  assert.equal(got.features.quote_saved_with_draft.ok, 1); assert.equal(got.features.measurements_imported.ok, 1); assert.equal(got.days, 30);
  assert.equal((await (await usageApi.onRequestGet({ request: new Request('https://windowsbyclearview.com/internal/api/feature-usage?days=99999'), env })).json()).days, 365, 'the window is capped');
  assert.equal((await usageApi.onRequestGet({ request: new Request('https://windowsbyclearview.com/internal/api/feature-usage'), env: {} })).status, 503);
  assert.equal((await usageApi.onRequest({ request: new Request('https://windowsbyclearview.com/internal/api/feature-usage', { method: 'DELETE' }), env })).status, 405);
  pass('the browser can report only two allowlisted events; the window is capped; wrong method and origin are refused');
}

// 5. Quote count scale, and the page.
{
  const db = createD1({ schemaFiles: [] });
  await db.prepare('CREATE TABLE quotes (id TEXT, created_at TEXT)').run();
  await db.prepare('INSERT INTO quotes VALUES (?, ?)').bind('Q-1', NOW.toISOString()).run();
  await db.prepare('INSERT INTO quotes VALUES (?, ?)').bind('Q-0', day(-90, NOW).toISOString()).run();
  assert.equal((await readUsage(db, 30, NOW)).quotesSaved, 1, 'quotes saved in the window give the counts their scale');
  const quote = read('src/pages/internal/quotes/new.astro');
  assert.match(quote, /kept\.draft = \(\) => allDrafted\.some/); assert.match(quote, /kept\.measure = \(\) => importedItems\.some/);
  assert.match(quote, /\/internal\/api\/feature-usage/); assert.match(quote, /keepalive: true/);
  const tools = read('src/pages/internal/tools/index.astro');
  assert.match(tools, /data-usage/); assert.match(tools, /Counts only\. No audio, words, customers or phone numbers/); assert.match(tools, /Tap Refresh to try again/);
  pass('the quote page reports a count only when drafted or imported lines are kept; the Tools page shows it with a retry');
}

console.log('\nAll feature usage checks passed.');
