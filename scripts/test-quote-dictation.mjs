// Rough notes -> draft quote lines (voice or typed). Runs the real handlers with stubbed providers.
// Contract: .ai/workflows/quote-dictation/CONTEXT.md. The model never prices and never invents a size.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as notesApi from '../functions/internal/api/quote-notes.js';
import * as dictationApi from '../functions/internal/api/quote-dictation.js';
import { OPENING_IDS, MATERIAL_IDS, BRAND_IDS, METHODS, MAX_LINES, extractionPrompt, parseModelJson, validateDraft } from '../functions/internal/_lib/quote-notes.mjs';

process.removeAllListeners('warning');
const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const pass = (m) => console.log(`PASS: ${m}`);
const { pricing } = await import(new URL('src/data/pricing.ts', root).href);
const lib = await import(new URL('src/lib/quote-notes-lines.ts', root).href);

const NOTES = 'Kitchen, two double-hungs, 36 by 48, fin. Living room slider, vinyl Cascade. Some rot at the sill in the back bedroom. Call Dana on 360-555-0142.';
const ctx = (url, init, env) => ({ request: new Request(`https://windowsbyclearview.com${url}`, init), env });
const postJson = (url, body, env, headers = {}) => ctx(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }, env);

// 1. The id lists stay equal to the price book (Functions cannot import src/).
{
  assert.deepEqual(OPENING_IDS, pricing.openings.map((o) => o.id), 'opening ids equal src/data/pricing.ts');
  assert.deepEqual(MATERIAL_IDS, pricing.materials.map((m) => m.id), 'material ids');
  assert.deepEqual(BRAND_IDS, pricing.brands.map((b) => b.id), 'brand ids');
  assert.deepEqual(METHODS, ['insert', 'fin']);
  assert.match(read('src/pages/internal/quotes/new.astro'), /<option value="insert">Insert<\/option>/);
  pass('opening, material, brand and method ids equal the price book');
}

// 2. The prompt forbids prices and sizes it was not told.
{
  const prompt = extractionPrompt();
  assert.match(prompt, /NEVER output a price/);
  assert.match(prompt, /NEVER invent a size/);
  for (const id of OPENING_IDS) assert.ok(prompt.includes(id));
  pass('prompt lists the price-book ids and forbids prices and invented sizes');
}

// 3. Model JSON parsing tolerates fences and refuses non-objects.
{
  assert.deepEqual(parseModelJson('```json\n{"lines":[]}\n```'), { lines: [] });
  assert.equal(parseModelJson('no json here'), null);
  assert.equal(parseModelJson('[1,2]'), null);
  assert.equal(parseModelJson('{broken'), null);
  assert.equal(parseModelJson(undefined), null);
  pass('parseModelJson');
}

// 4. validateDraft: the deterministic gate.
{
  const good = { type: 'window', openingId: 'double-hung', materialId: 'vinyl', brandId: '', method: 'fin', quantity: 2, room: 'Kitchen', size: '36 by 48', note: 'wants grids', heard: 'two double-hungs, 36 by 48' };
  const raw = {
    customer: { name: 'Dana Whitfield', phone: '(360) 555-0142', address: '', city: 'Camas' },
    lines: [
      good,
      { ...good, openingId: 'skylight' },                                 // not in the price book
      { ...good, quantity: 0 }, { ...good, quantity: 100 }, { ...good, quantity: 'many' },
      { ...good, size: '40 by 60' },                                     // numbers not in the notes
      { ...good, heard: 'a phrase nobody said' },                        // evidence not in the notes
      { ...good, materialId: 'steel', brandId: 'andersen', method: 'weld', price: 9999, unitPriceCents: 999900 },
      { type: 'custom', label: 'Rot repair at sill', quantity: 1, room: 'Back bedroom', price: 450, unitPrice: 450 },
      { type: 'custom', label: '', quantity: 1 },
      { type: 'wizard' }, null, 'text',
    ],
  };
  const v = validateDraft(raw, NOTES);
  assert.equal(v.lines.length, 5, `kept lines: ${JSON.stringify(v.lines.map((l) => l.type + (l.openingId || l.label)))}`);
  assert.equal(v.dropped, 8);
  assert.equal(v.lines[0].size, '36 by 48');
  assert.equal(v.lines[0].heard, 'two double-hungs, 36 by 48');
  assert.equal(v.lines[0].method, 'fin');
  assert.equal(v.lines[0].brandId, null);
  assert.equal(v.lines[1].size, '', 'a size not in the notes is removed, never kept');
  assert.equal(v.lines[2].heard, '', 'evidence not in the notes is removed');
  assert.deepEqual([v.lines[3].materialId, v.lines[3].brandId, v.lines[3].method], [null, null, null], 'unknown enums become empty');
  for (const line of v.lines) for (const key of Object.keys(line)) assert.ok(!/price|cents|cost|amount|\$/i.test(key), `no price field on a line (${key})`);
  assert.equal(v.lines[4].type, 'custom');
  // The notes say "Dana" and the phone, not a surname or Camas: the phone is kept as digits, the name is kept only
  // because its first word is spoken, and a city the notes never mention is dropped.
  assert.equal(v.customer.phone, '3605550142');
  assert.equal(v.customer.name, 'Dana Whitfield');
  assert.equal(v.customer.city, undefined, 'a city not in the notes is not kept');
  // A customer fact the notes do not contain is dropped.
  const invented = validateDraft({ customer: { name: 'Pat Smith', phone: '5035551212', city: 'Salem' }, lines: [] }, NOTES);
  assert.deepEqual(invented.customer, {}, 'nothing about the customer is guessed');
  // A flood of lines is capped.
  const many = validateDraft({ lines: Array.from({ length: MAX_LINES + 5 }, () => good) }, NOTES);
  assert.equal(many.lines.length, MAX_LINES);
  assert.equal(many.dropped, 5);
  assert.deepEqual(validateDraft(null, NOTES), { lines: [], customer: {}, dropped: 0 });
  pass('validateDraft drops invented sizes, ids, quantities, evidence and customer facts, and never carries a price');
}

// 5. quote-notes handler.
{
  const realFetch = globalThis.fetch;
  const draftJson = JSON.stringify({ customer: { name: 'Dana' }, lines: [{ type: 'window', openingId: 'slider', materialId: 'vinyl', brandId: 'cascade', method: '', quantity: 1, room: 'Living room', size: '', note: '', heard: 'Living room slider, vinyl Cascade' }] });
  let calls = [];
  const stub = (handler) => { globalThis.fetch = async (url, init) => { calls.push(String(url)); return handler(String(url), init); }; };
  const groqOk = () => new Response(JSON.stringify({ choices: [{ message: { content: draftJson } }] }), { status: 200 });
  const geminiOk = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: draftJson }] } }] }), { status: 200 });
  const env = () => ({ GROQ_API_KEY: 'g', GEMINI_API_KEY: 'm', QUOTES_DB: createD1() });
  try {
    stub((url) => (url.includes('groq') ? groqOk() : geminiOk()));
    let res = await notesApi.onRequestPost(postJson('/internal/api/quote-notes', { notes: NOTES }, env()));
    let body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.provider, 'groq');
    assert.equal(body.lines[0].openingId, 'slider');
    assert.equal(body.readOnly, true);
    assert.equal(calls.length, 1, 'one model call on the happy path');
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    const sent = JSON.parse(String((await (async () => { let captured; globalThis.fetch = async (u, i) => { captured = i.body; return groqOk(); }; await notesApi.onRequestPost(postJson('/internal/api/quote-notes', { notes: NOTES }, env())); return captured; })())));
    assert.equal(sent.max_tokens, 1400, 'output budget');
    assert.equal(sent.messages.at(-1).content, NOTES, 'only the notes are sent, no customer record');

    calls = [];
    stub((url) => (url.includes('groq') ? new Response('boom', { status: 500 }) : geminiOk()));
    res = await notesApi.onRequestPost(postJson('/internal/api/quote-notes', { notes: NOTES }, env()));
    body = await res.json();
    assert.equal(body.provider, 'gemini', 'falls back to Gemini');
    assert.equal(calls.length, 2, 'at most one primary plus one fallback');

    stub(() => new Response('nope', { status: 500 }));
    res = await notesApi.onRequestPost(postJson('/internal/api/quote-notes', { notes: NOTES }, env()));
    body = await res.json();
    assert.equal(res.status, 503); assert.equal(body.degraded, true); assert.equal(body.lines, undefined, 'no guessed lines when both providers fail');

    stub(() => new Response(JSON.stringify({ choices: [{ message: { content: 'not json at all' } }] }), { status: 200 }));
    res = await notesApi.onRequestPost(postJson('/internal/api/quote-notes', { notes: NOTES }, { QUOTES_DB: createD1(), GROQ_API_KEY: 'g' }));
    assert.equal(res.status, 503, 'malformed model output is a failure, never a result');

    res = await notesApi.onRequestPost(postJson('/internal/api/quote-notes', { notes: NOTES }, { QUOTES_DB: createD1() }));
    assert.equal(res.status, 503, 'no provider keys');

    stub((url) => groqOk());
    assert.equal((await notesApi.onRequestPost(postJson('/internal/api/quote-notes', { notes: '   ' }, env()))).status, 400);
    assert.equal((await notesApi.onRequestPost(postJson('/internal/api/quote-notes', { notes: 'x'.repeat(4001) }, env()))).status, 413);
    assert.equal((await notesApi.onRequestPost(postJson('/internal/api/quote-notes', { notes: 5 }, env()))).status, 400);
    assert.equal((await notesApi.onRequestPost(ctx('/internal/api/quote-notes', { method: 'POST', body: '{nope' }, env()))).status, 400);
    assert.equal((await notesApi.onRequestPost(postJson('/internal/api/quote-notes', { notes: NOTES }, env(), { origin: 'https://evil.example' }))).status, 403);
    assert.equal((await notesApi.onRequest(ctx('/internal/api/quote-notes', { method: 'GET' }, env()))).status, 405);

    const limitedEnv = env();
    let last;
    for (let i = 0; i < 31; i += 1) last = await notesApi.onRequestPost(postJson('/internal/api/quote-notes', { notes: NOTES }, limitedEnv));
    assert.equal(last.status, 429, '31st request in 15 minutes is refused');
  } finally {
    globalThis.fetch = realFetch;
  }
  pass('quote-notes handler: Groq, Gemini fallback, safe failure, bounds, origin, method and rate limit');
}

// 6. quote-dictation handler.
{
  const clip = new Uint8Array(70_000).map((_, i) => i % 251);
  const audioReq = (env, { type = 'audio/webm;codecs=opus', body = clip, headers = {} } = {}) =>
    ctx('/internal/api/quote-dictation', { method: 'POST', headers: { 'content-type': type, ...headers }, body }, env);
  let seen;
  const aiOk = { run: async (model, input) => { seen = { model, input }; return { text: '  Kitchen,  two double-hungs.  ' }; } };
  const env = (ai) => ({ AI: ai, QUOTES_DB: createD1() });

  let res = await dictationApi.onRequestPost(audioReq(env(aiOk)));
  let body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.text, 'Kitchen, two double-hungs.');
  assert.equal(seen.model, '@cf/openai/whisper-large-v3-turbo');
  assert.deepEqual(Uint8Array.from(Buffer.from(seen.input.audio, 'base64')), clip, 'the clip reaches the model byte for byte');
  assert.match(seen.input.initial_prompt, /double-hung/i);
  assert.ok(!/\$|\bprice|\bcost/i.test(seen.input.initial_prompt), 'the vocabulary hint carries no prices');
  assert.equal(res.headers.get('cache-control'), 'private, no-store');

  body = await (await dictationApi.onRequestPost(audioReq(env({ run: async () => ({ text: '  ' }) })))).json();
  assert.equal(body.empty, true, 'silence is reported, not swallowed');

  res = await dictationApi.onRequestPost(audioReq(env({ run: async () => { throw new Error('quota'); } })));
  assert.equal(res.status, 502); assert.equal((await res.json()).degraded, true);

  assert.equal((await dictationApi.onRequestPost(audioReq({ QUOTES_DB: createD1() }))).status, 503, 'no AI binding degrades with a message');
  assert.equal((await dictationApi.onRequestPost(audioReq(env(aiOk), { type: 'text/plain' }))).status, 415);
  assert.equal((await dictationApi.onRequestPost(audioReq(env(aiOk), { body: new Uint8Array(dictationApi.MAX_AUDIO_BYTES + 1) }))).status, 413);
  assert.equal((await dictationApi.onRequestPost(audioReq(env(aiOk), { body: new Uint8Array(0) }))).status, 400);
  assert.equal((await dictationApi.onRequestPost(audioReq(env(aiOk), { headers: { origin: 'https://evil.example' } }))).status, 403);
  assert.equal((await dictationApi.onRequest(ctx('/internal/api/quote-dictation', { method: 'GET' }, env(aiOk)))).status, 405);

  const src = read('functions/internal/api/quote-dictation.js').replace(/\/\/.*$/gm, '');
  assert.ok(!/R2|JOB_PHOTOS|QUOTES_DB\.prepare|\.put\(/.test(src), 'audio is never stored');
  assert.ok(!/console\.(log|error)\([^)]*(audio|text)/.test(src), 'neither audio nor transcript is logged');

  const limited = env(aiOk);
  let last;
  for (let i = 0; i < 91; i += 1) last = await dictationApi.onRequestPost(audioReq(limited));
  assert.equal(last.status, 429, 'the 91st clip in an hour is refused');
  pass('quote-dictation handler: byte-exact audio, empty/failed/missing AI, type, size, origin, method, no storage, rate limit');
}

// 7. The page-side line mapping (prices come from the price book, never the AI).
{
  const catalog = {
    openings: pricing.openings.map((o) => ({ id: o.id, label: o.label, low: o.low, high: o.high, isDoor: !!o.isDoor, quotePrice: 'quotePrice' in o ? o.quotePrice : null })),
    materials: pricing.materials.map((m) => ({ id: m.id, label: m.label, multiplier: m.multiplier })),
    brands: pricing.brands.map((b) => ({ id: b.id, label: b.label, low: b.low, high: b.high })),
  };
  const slider = { type: 'window', openingId: 'slider', materialId: 'vinyl', brandId: 'cascade', method: null, quantity: 2, room: 'Living room', size: '', note: '', heard: '' };
  const item = lib.draftLineToItem(slider, catalog, 'windows');
  assert.equal(item.unitPrice, 850, "Mark's own slider price, via the same function as Add line");
  assert.equal(item.quantity, 2);
  assert.equal(item.label, 'Living room: Slider — Vinyl — Cascade');
  assert.ok(!/insert/i.test(item.label), 'an unstated method is not guessed (the Build Plan reads it as VERIFY)');
  assert.match(lib.draftLineToItem({ ...slider, method: 'fin' }, catalog, 'windows').label, /— fin$/);
  const door = lib.draftLineToItem({ ...slider, openingId: 'sliding-door', brandId: null }, catalog, 'windows');
  assert.ok(!/Cascade|Milgard/.test(door.label), 'doors carry no window brand');
  assert.equal(lib.draftLineToItem({ ...slider, openingId: 'skylight' }, catalog, 'windows'), null);
  const custom = lib.draftLineToItem({ type: 'custom', label: 'Rot repair at sill', quantity: 1, room: 'Back bedroom', size: '', note: '', heard: '' }, catalog, 'windows');
  assert.equal(custom.unitPrice, 0); assert.equal(lib.needsPrice(custom), true); assert.equal(lib.needsPrice(item), false);
  assert.equal(lib.draftLineToItem(slider, catalog, 'siding').unitPrice, 0, 'siding quotes are priced by Mark per square foot');
  assert.equal(item.description, '', 'no size or remark is printed on the contract line');

  const block = lib.notesBlock(NOTES, [{ ...slider, size: '36x48', note: 'wants grids' }]);
  assert.match(block, /size heard 36x48 \(confirm at measure\)/);
  const once = lib.mergeNotes('Existing note', block);
  assert.equal(lib.mergeNotes(once, block), once, 'drafting twice does not repeat the notes');
  assert.ok(lib.mergeNotes('y'.repeat(3990), block).length <= lib.NOTES_MAX);
  pass('draft lines use price-book prices and stay clean on the contract');
}

// 8. The page is wired to the endpoints and keeps the human gates.
{
  const page = read('src/pages/internal/quotes/new.astro');
  assert.match(page, /\/internal\/api\/quote-notes/);
  assert.match(page, /\/internal\/api\/quote-dictation/);
  assert.match(page, /data-draft-undo/);
  assert.match(page, /Washington needs everyone/);
  assert.match(page, /Check every price and quantity before you save/);
  assert.match(page, /qb-row-unpriced/);
  const draftHandler = page.slice(page.indexOf('data-draft-go]'), page.indexOf("const customLabel"));
  assert.ok(!/requestSubmit|\/internal\/api\/quotes/.test(draftHandler), 'drafting never saves the quote');
  assert.ok(!read('functions/internal/api/quote-notes.js').includes('QUOTES_DB.prepare'), 'the notes endpoint writes nothing');
  pass('the page drafts into the editable table and never saves by itself');
}

console.log('\nAll quote-dictation checks passed.');
