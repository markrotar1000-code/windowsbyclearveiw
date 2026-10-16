// Regression tests for the 2026-10-08 audit of the Command Center (/internal) and its phone app.
// Real handlers on real SQLite, no network. Each block names the bug it pins:
//   1. a malformed session cookie must send the person to sign in, not 500 every /internal page
//   2. the Build Plan editor must never be able to set approval state (CLAUDE.md rule 4)
//   3. Field mode must send the body the evidence API reads, or the Verify gate can never be passed
//   4. the quote builder must refuse a bad quantity out loud instead of blocking the save in silence
//   5. the Mail pilot break-even box must only name a problem with something that was typed
//   6. a saved quote must say what to do next and link to the Build Plan; the pen copy must be printable as a contract
//   8. the quote, plan and job handlers answer a literal JSON null body with a 400, not an unhandled 500
//   7. a quote must refuse an amount that cannot be a real price (a pasted phone number, an overflow) instead of saving a NULL or imprecise total
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createD1 } from './_lib/d1-sqlite.mjs';
import { onRequest as middleware } from '../functions/internal/_middleware.js';
import { createSessionToken, readCookie } from '../functions/internal/_lib/session.mjs';
import * as quotesIndex from '../functions/internal/api/quotes/index.js';
import * as quoteById from '../functions/internal/api/quotes/[id].js';
import * as buildPlan from '../functions/internal/api/build-plan.js';
import * as planState from '../functions/internal/api/build-plan-state.js';
import * as jobsApi from '../functions/internal/api/jobs.js';
import * as checklistApi from '../functions/internal/api/job-checklist.js';
import * as evidenceApi from '../functions/internal/api/job-evidence.js';

process.removeAllListeners('warning');
const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, 'utf8').replace(/\r\n/g, '\n');
const { evidencePayload } = await import(pathToFileURL(`${root}src/lib/field-evidence.ts`).href);
const { wholeQuantity, QUANTITY_MESSAGE } = await import(pathToFileURL(`${root}src/lib/quote-lines.ts`).href);
const { breakEven, breakEvenProblem } = await import(pathToFileURL(`${root}src/lib/mail-pilot.ts`).href);
const pass = (message) => console.log(`PASS: ${message}`);
const ORIGIN = 'https://windowsbyclearview.com';

async function call(handler, env, { method = 'GET', path = '/', body, params = {} } = {}) {
  const request = new Request(`${ORIGIN}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const response = await handler({ request, env, params, waitUntil() {} });
  return { status: response.status, body: await response.json() };
}
const freshEnv = () => ({ QUOTES_DB: createD1({ schemaFiles: ['functions/api/_data/schema.sql', 'internal/db/schema.sql'] }) });
const customer = { name: 'Pat Doe', phone: '(360) 555-0100', email: 'pat@example.com', address: '1 Main St', city: 'Camas' };
const windowItems = [{ label: 'Milgard vinyl slider, full-frame', quantity: 1, unitPriceCents: 90000 }];

async function draftQuote(env) {
  const created = await call(quotesIndex.onRequestPost, env, { method: 'POST', body: { customer, items: windowItems, signatureMethod: 'pen' } });
  assert.equal(created.status, 201);
  return created.body.id;
}
const generatedPlan = async (env, id) => (await call(buildPlan.onRequestGet, env, { path: `/p?quoteId=${id}` })).body.plan;
const savePlan = (env, quoteId, plan) => call(buildPlan.onRequestPost, env, { method: 'POST', body: { quoteId, plan } });
const transition = (env, quoteId, action) => call(planState.onRequestPost, env, { method: 'POST', body: { quoteId, action } });
const sign = (env, id) => call(quoteById.onRequestPatch, env, { method: 'PATCH', params: { id }, body: { confirmPen: true, signatureName: 'Pat Doe' } });
const planRow = (env, id) => env.QUOTES_DB.prepare('SELECT * FROM quote_build_plans WHERE quote_id = ?').bind(id).first();

// ── 1. Malformed session cookie ────────────────────────────────────────────
{
  const bad = ['cv_session=%E0%A4%A', 'cv_session=%', 'cv_session=%zz', 'a=1; cv_session=%C3%28'];
  for (const header of bad) {
    assert.doesNotThrow(() => readCookie(new Request(ORIGIN, { headers: { cookie: header } }), 'cv_session'), `readCookie survives ${header}`);
    assert.equal(readCookie(new Request(ORIGIN, { headers: { cookie: header } }), 'cv_session'), '', `${header} is not a session`);
  }
  assert.equal(readCookie(new Request(ORIGIN, { headers: { cookie: 'x=1; cv_session=abc%2Edef; y=2' } }), 'cv_session'), 'abc.def', 'a well-formed cookie still decodes');
  const env = { INTERNAL_SESSION_SECRET: 'audit-secret-audit-secret' };
  const run = (cookie) => middleware({ request: new Request(`${ORIGIN}/internal/today`, { headers: cookie ? { cookie } : {} }), env, next: async () => new Response('page') });
  for (const header of bad) {
    const response = await run(header);
    assert.equal(response.status, 302, `${header} is sent to sign in`);
    assert.match(response.headers.get('location'), /\/internal\/login\?next=%2Finternal%2Ftoday$/);
  }
  const token = await createSessionToken(env.INTERNAL_SESSION_SECRET);
  const ok = await run(`cv_session=${encodeURIComponent(token)}`);
  assert.equal(ok.status, 200, 'a real session still gets through');
  assert.equal(await ok.text(), 'page');
  pass('a malformed cv_session cookie redirects to sign in instead of throwing');
}

// ── 2. Build Plan editor cannot set approval state ─────────────────────────
{
  const env = freshEnv();
  const id = await draftQuote(env);
  const forged = await generatedPlan(env, id);
  Object.assign(forged, { status: 'approved', approvedAt: '2026-01-01T00:00:00.000Z', approvedBy: 'someone', stateHistory: [{ from: 'review', to: 'approved', actor: 'someone', at: '2026-01-01T00:00:00.000Z' }] });
  const saved = await savePlan(env, id, forged);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.status, 'draft', 'the editor answers with the real state, not the one it was sent');
  const row = await planRow(env, id);
  assert.equal(row.state, 'draft', 'a new plan starts as a draft whatever the request says');
  assert.equal(row.approved_at, null);
  assert.equal(row.approved_by, null);
  const stored = JSON.parse(row.plan_json);
  assert.equal(stored.status, 'draft');
  assert.equal(stored.approvedAt, null, 'the copy inside plan_json does not carry a forged approval time');
  assert.equal(stored.approvedBy, null);
  assert.deepEqual(stored.stateHistory, [], 'nor a forged history');
  const state = await call(planState.onRequestGet, env, { path: `/s?quoteId=${id}` });
  assert.equal(state.body.status, 'draft');
  assert.equal(state.body.approvedAt, null);
  assert.deepEqual(state.body.stateHistory, []);
  const signed = await sign(env, id);
  assert.notEqual(signed.status, 200, 'a forged plan cannot unlock signing');
  assert.equal((await call(jobsApi.onRequestPost, env, { method: 'POST', body: { quoteId: id } })).status >= 400, true, 'nor a job');
  // The real route still works, and from there the editor is locked and cannot change the state either.
  assert.equal((await transition(env, id, 'submit-review')).status, 200);
  assert.equal((await savePlan(env, id, { ...forged, status: 'draft' })).body.status, 'review', 'a save during review keeps review, not what the browser asked for');
  assert.equal((await planRow(env, id)).state, 'review');
  const approved = await transition(env, id, 'approve');
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  const approvedRow = await planRow(env, id);
  assert.equal(approvedRow.state, 'approved');
  assert.ok(approvedRow.approved_at, 'a real approval records its time');
  const locked = await savePlan(env, id, { ...forged, status: 'draft', approvedAt: null });
  assert.equal(locked.status, 409, 'an approved plan is still locked against the editor');
  const after = await planRow(env, id);
  assert.equal(after.state, 'approved');
  assert.equal(after.approved_at, approvedRow.approved_at);
  assert.equal((await sign(env, id)).status, 200, 'and the real approval still unlocks signing');
  pass('the Build Plan editor ignores client-supplied state, approver, time and history; the real approval path still works');
}

// ── 3. Field mode evidence: the page's own body, through the real handler ──
{
  const env = freshEnv();
  const id = await draftQuote(env);
  await savePlan(env, id, await generatedPlan(env, id));
  assert.equal((await transition(env, id, 'submit-review')).status, 200);
  assert.equal((await transition(env, id, 'approve')).status, 200);
  assert.equal((await sign(env, id)).status, 200);
  const made = await call(jobsApi.onRequestPost, env, { method: 'POST', body: { quoteId: id } });
  assert.ok(made.status === 200 || made.status === 201, JSON.stringify(made.body));
  const jobId = made.body.id;
  const checklist = await call(checklistApi.onRequestGet, env, { path: `/c?jobId=${jobId}` });
  assert.equal(checklist.status, 200);
  const gates = checklist.body.items.filter((item) => item.section === 'Opening 01').sort((a, b) => a.position - b.position);
  assert.deepEqual(gates.map((g) => g.label), ['Verify', 'Remove', 'Prep', 'Install', 'Flash / Seal', 'Operate', 'Photograph', 'Complete'], 'opening 1 has its eight field gates');
  const check = (item, notes) => call(checklistApi.onRequestPatch, env, { method: 'PATCH', path: `/c?id=${item.id}`, body: notes === undefined ? { checked: true } : { checked: true, notes } });
  const patchEvidence = (body) => call(evidenceApi.onRequestPatch, env, { method: 'PATCH', path: `/e?jobId=${jobId}`, body });
  // Without measurements the Verify gate stays shut.
  const early = await call(checklistApi.onRequestPatch, env, { method: 'PATCH', path: `/c?id=${gates[0].id}`, body: { checked: true } });
  assert.equal(early.status, 409);
  assert.equal(early.body.code, 'FIELD_MEASUREMENTS_REQUIRED');
  // The body the page builds: measurements typed on the phone, everything else at its defaults.
  const payload = evidencePayload({ openingIndex: 0, measurements: { width: 35.5, height: 47.25 }, notes: 'Stucco returns, no rot', exceptionStatus: undefined, exceptionNotes: undefined, materialUsage: { 'Backer rod': 2.5 } });
  const saved = await patchEvidence(payload);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.evidence.opening_index, 0);
  assert.deepEqual(saved.body.evidence.measurements, { width: 35.5, height: 47.25 });
  assert.equal(saved.body.evidence.exception_status, 'none');
  assert.deepEqual(saved.body.evidence.materialUsage, { 'Backer rod': 2.5 });
  assert.equal((await check(gates[0], 'Measured at the rough opening')).status, 200, 'Verify passes once the measurements are saved');
  // A documented exception travels in the same body.
  const flagged = await patchEvidence(evidencePayload({ openingIndex: 0, measurements: { width: 35.5, height: 47.25 }, exceptionStatus: 'punchlist', exceptionNotes: 'Sill needs repair', materialUsage: {} }));
  assert.equal(flagged.status, 200, JSON.stringify(flagged.body));
  assert.equal(flagged.body.evidence.exception_status, 'punchlist');
  assert.equal(flagged.body.evidence.exception_notes, 'Sill needs repair');
  // The photo counts the page adds after reading the phone's photo store.
  const photographed = await patchEvidence(evidencePayload({ openingIndex: 0, measurements: { width: 35.5, height: 47.25 }, materialUsage: {}, photoSummary: { before: 1, during: 1, after: 1, issue: 0 } }));
  assert.equal(photographed.status, 200, JSON.stringify(photographed.body));
  assert.deepEqual(photographed.body.evidence.photoSummary, { before: 1, during: 1, after: 1, issue: 0 });
  // Every gate in order, ending with Complete.
  for (const gate of gates.slice(1)) {
    const result = await check(gate);
    assert.equal(result.status, 200, `${gate.label}: ${JSON.stringify(result.body)}`);
  }
  // The body the page sent before the fix is refused, so this test would have caught it.
  const old = await patchEvidence({ opening_index: 0, measurements: { width: 30, height: 40 }, notes: '', exception_status: 'none', exception_notes: '', materialUsage: {} });
  assert.equal(old.status, 400);
  assert.match(old.body.error, /openingIndex/);
  // The keys the page sends are exactly keys the handler reads.
  const handler = read('functions/internal/api/job-evidence.js');
  for (const key of Object.keys(evidencePayload({ openingIndex: 0, measurements: {}, materialUsage: {}, photoSummary: {} }))) {
    assert.ok(handler.includes(`body.${key}`), `job-evidence.js reads body.${key}`);
  }
  const page = read('src/pages/internal/jobs/field.astro');
  assert.ok(page.includes('evidencePayload('), 'Field mode builds its body with evidencePayload');
  const collect = page.slice(page.indexOf('function collectEvidence'), page.indexOf('async function saveEvidence'));
  assert.ok(collect.length > 100 && collect.includes('evidencePayload('), 'found the body the page sends');
  for (const wrong of ['opening_index', 'exception_status', 'exception_notes']) assert.ok(!collect.includes(wrong), `Field mode no longer sends ${wrong}`);
  pass('Field mode evidence save: the page body is accepted, Verify passes after it, every gate completes');
}

// ── 4. Quote builder quantities ────────────────────────────────────────────
{
  const good = [['1', 1], ['12', 12], [' 7 ', 7], [3, 3], ['0012', 12]];
  for (const [raw, value] of good) assert.equal(wholeQuantity(raw), value, `${JSON.stringify(raw)} is a quantity`);
  const bad = ['', ' ', '0', '-1', '2.5', '12.5', '1e2', '1,000', 'abc', null, undefined, NaN, 0, -3, 2.5, '9'.repeat(30)];
  for (const raw of bad) assert.equal(wholeQuantity(raw), null, `${JSON.stringify(raw)} is refused`);
  assert.match(QUANTITY_MESSAGE, /whole number/);
  const page = read('src/pages/internal/quotes/new.astro');
  assert.ok(page.includes("from '../../../lib/quote-lines'"), 'the builder uses the shared rule');
  assert.ok(!/Math\.max\(1, Number\([^)]*\) \|\| 1\)/.test(page), 'no quantity is clamped or defaulted to 1 any more');
  assert.ok((page.match(/wholeQuantity\(/g) || []).length >= 4, 'catalog add, custom add, line item and submit all check the quantity');
  assert.ok(page.includes('data-line-qty'), 'line item quantity inputs are marked for the submit check');
  assert.ok(/addEventListener\('invalid'/.test(page), 'the browser\'s own step check explains itself');
  // What the server would accept is wider, which is why the page has to be the one to say no.
  const env = freshEnv();
  const fractional = await call(quotesIndex.onRequestPost, env, { method: 'POST', body: { customer, items: [{ label: 'Trim', quantity: 12.5, unitPriceCents: 1000 }], signatureMethod: 'pen' } });
  assert.equal(fractional.status, 201, 'the server stores a fractional quantity (a decision for the owner, not changed here)');
  pass('quote builder: only whole quantities of 1 or more get onto a line, and the page says so');
}

// ── 5. Mail pilot break-even message ───────────────────────────────────────
{
  assert.equal(breakEvenProblem({}), null, 'nothing typed: only the "fill in" line');
  assert.equal(breakEvenProblem({ pieces: 500 }), null, 'pieces typed, profit not: no complaint about profit');
  assert.equal(breakEvenProblem({ pieces: 0, marginPct: 30 }), null, 'a bad piece count is not a profit problem');
  assert.equal(breakEvenProblem({ marginPct: 150 }), 'Profit has to be a percent from 1 to 100.');
  assert.equal(breakEvenProblem({ marginPct: 0 }), 'Profit has to be a percent from 1 to 100.');
  assert.equal(breakEvenProblem({ marginPct: 30 }), null);
  assert.equal(breakEvenProblem(null), null);
  assert.equal(breakEven({ pieces: 500, costPerPiece: 0.85, jobValue: 15000, marginPct: 30, closePct: 20 }).jobsNeeded, 1);
  const page = read('src/pages/internal/mail-pilot.astro');
  assert.ok(page.includes('breakEvenProblem(inputs)'), 'the page asks the shared rule what to say');
  assert.ok(!page.includes("Fill in the first four boxes to see the result. Profit has to be"), 'no fixed profit sentence is glued to every empty result');
  pass('mail pilot: the profit sentence appears only when the profit box is the problem');
}

// ── 6. Saved quote: next step, phone layout and the printed pen copy ───────
{
  const view = read('src/pages/internal/quotes/view.astro');
  // Nothing on the saved quote used to link to the Build Plan, and a window quote cannot be signed without it.
  assert.ok(view.includes('data-next-panel') && view.includes('loadNextStep(quote)'), 'a draft quote shows a "next step" panel');
  assert.ok(view.includes('/internal/quotes/build-plan?quoteId=') && view.includes('/internal/quotes/build-plan-approval?quoteId='), 'it links to the Build Plan and to its approval');
  assert.ok(view.includes("quote.work_type === 'siding'") && view.includes('Siding quotes skip the Build Plan'), 'a siding quote is told it has no plan');
  assert.ok(!view.includes('Approve the Build Plan before sending a signing link.'), 'the duplicate blocked message is gone (the next-step panel says it)');
  // Phone: "$1,00 / 0" split across two lines was measured at 390 px.
  assert.ok(/contract-items td:not\(:first-child\)[\s\S]{0,160}white-space: nowrap/.test(view), 'quantity, unit and total never wrap');
  // Print: the signature page must name the quote and total, keep the cancellation notice with the signature, and have a company line.
  assert.ok(/data-sig-quote-id/.test(view) && /data-sig-total/.test(view) && /\.sig-print-id\s*\{\s*display: block !important/.test(view), 'the printed signature block carries quote id, customer and total');
  assert.ok(/\.contract-signature\s*\{\s*break-inside: avoid/.test(view) && /contract-terms h3 ~ p/.test(view), 'the notice of right to cancel and the signature are not split across pages');
  assert.ok(view.includes('For {site.legalName} (signature, printed name, date)'), 'the pen copy has a line for Clearview');
  pass('saved quote: next step links to the Build Plan, money does not wrap on a phone, the pen copy prints as a signable contract');
}

// ── 7. Quote amounts that cannot be real ───────────────────────────────────
{
  const env = freshEnv();
  const post = (items) => call(quotesIndex.onRequestPost, env, { method: 'POST', body: { customer, items, signatureMethod: 'pen' } });
  const overflow = await post([{ label: 'x', quantity: 1e308, unitPriceCents: 1e308 }]);
  assert.equal(overflow.status, 400, 'quantity x price that overflows to Infinity used to save a quote with a NULL total');
  const imprecise = await post([{ label: 'x', quantity: 1e15, unitPriceCents: 90000 }]);
  assert.equal(imprecise.status, 400, 'a total past the safe-integer range used to be saved as an imprecise float');
  const phone = await post([{ label: 'Slider', quantity: 1, unitPriceCents: 360555010000 }]);
  assert.equal(phone.status, 400, 'a phone number pasted into the price box ($3,605,550,100) is refused');
  assert.match(phone.body.error, /too large/i, 'and the message says why');
  const sum = await post(Array.from({ length: 6 }, (_, i) => ({ label: `L${i}`, quantity: 1, unitPriceCents: 100_000_000 })));
  assert.equal(sum.status, 400, 'lines that are each fine but add up past the ceiling are refused');
  const ok = await post([{ label: 'Slider', quantity: 1, unitPriceCents: 90000 }, { label: 'Siding labor', quantity: 2400, unitPriceCents: 300 }]);
  assert.equal(ok.status, 201, 'ordinary quotes (including 2,400 sq ft of siding) are unaffected');
  const edit = await call(quoteById.onRequestPut ?? quoteById.onRequestPatch, env, { method: 'PUT', params: { id: ok.body.id }, body: { customer, items: [{ label: 'x', quantity: 1e15, unitPriceCents: 90000 }], signatureMethod: 'pen' } });
  assert.ok(edit.status >= 400 && edit.status < 500, 'editing a draft goes through the same check');
  pass('quote amounts: overflow, imprecise totals and a pasted phone number are refused with a clear message');
}

// ── 8. A JSON `null` body ──────────────────────────────────────────────────
{
  const env = freshEnv();
  for (const [name, handler] of [['build plan', buildPlan.onRequestPost], ['build plan state', planState.onRequestPost], ['jobs', jobsApi.onRequestPost]]) {
    let result;
    try { result = await call(handler, env, { method: 'POST', body: null }); } catch (error) { assert.fail(`${name}: a null body threw ${error.message} instead of answering 400`); }
    assert.equal(result.status, 400, `${name}: a null body is a client mistake, not a server error`);
  }
  pass('build plan, build plan state and jobs: a JSON null body answers 400 instead of an unhandled error');
}

console.log('\nAll internal audit regression tests passed.');
