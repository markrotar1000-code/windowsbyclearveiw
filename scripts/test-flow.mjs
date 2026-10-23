// "Where is this customer on the way from quote to paid, and what is the one thing to do next?" The pure path logic,
// then the same question answered from real records on real SQLite through the real handlers, then the page wiring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createD1 } from './_lib/d1-sqlite.mjs';
import { computeFlow, pacificDate, readFlow } from '../functions/internal/_lib/flow.mjs';
import * as flowApi from '../functions/internal/api/flow.js';
import * as quotesIndex from '../functions/internal/api/quotes/index.js';
import * as quoteById from '../functions/internal/api/quotes/[id].js';
import * as jobsApi from '../functions/internal/api/jobs.js';
import * as paymentsApi from '../functions/internal/api/payments.js';
import * as planState from '../functions/internal/api/build-plan-state.js';
import * as planApi from '../functions/internal/api/build-plan.js';

process.removeAllListeners('warning');
const pass = (m) => console.log(`PASS: ${m}`);
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const TODAY = '2026-10-23';
const keys = (flow) => flow.steps.map((s) => `${s.key}:${s.state[0]}`).join(' ');

// ── pure: windows ────────────────────────────────────────────────────────────────────────────────
const quote = (over = {}) => ({ id: 'Q-1', status: 'draft', signatureMethod: 'digital', ...over });
let f = computeFlow({ kind: 'windows', quote: quote() }, TODAY);
assert.equal(keys(f), 'quote:d plan:c approved:t signed:t job:t scheduled:t field:t closed:t paid:t');
assert.equal(f.next.label, 'Build the Build Plan');
assert.equal(f.next.href, '/internal/quotes/build-plan?quoteId=Q-1');

f = computeFlow({ kind: 'windows', quote: quote(), plan: { exists: true, state: 'draft', stale: true } }, TODAY);
assert.equal(f.next.label, 'Save the Build Plan again', 'a plan that no longer matches the quote is saved again, not approved');
f = computeFlow({ kind: 'windows', quote: quote(), plan: { exists: true, state: 'draft', stale: false } }, TODAY);
assert.equal(keys(f).split(' ').slice(0, 3).join(' '), 'quote:d plan:d approved:c');
assert.equal(f.next.href, '/internal/quotes/build-plan-approval?quoteId=Q-1');
f = computeFlow({ kind: 'windows', quote: quote(), plan: { exists: true, state: 'approved', stale: false } }, TODAY);
assert.equal(f.steps.find((s) => s.state === 'current').key, 'signed');
assert.match(f.next.hint, /sign it on screen/i);
f = computeFlow({ kind: 'windows', quote: quote({ signatureMethod: 'pen' }), plan: { exists: true, state: 'approved', stale: false } }, TODAY);
assert.match(f.next.hint, /signed in pen/i);
f = computeFlow({ kind: 'windows', quote: quote({ status: 'finalized' }), plan: { exists: true, state: 'approved', stale: false } }, TODAY);
assert.deepEqual([f.next.key, f.next.action, f.next.quoteId], ['job', 'create-job', 'Q-1']);
pass('a window quote goes plan, approve, sign, then create the job, and a stale plan is saved again first');

// ── pure: the job ────────────────────────────────────────────────────────────────────────────────
const signed = quote({ status: 'finalized' });
const job = (over = {}) => ({ id: 'J-1', status: 'ready', scheduledDate: '', ...over });
f = computeFlow({ kind: 'windows', quote: signed, job: job(), money: { totalCents: 100000, paidCents: 0 } }, TODAY);
assert.deepEqual([f.next.label, f.next.href], ['Schedule the install', '/internal/jobs/view?id=J-1']);
f = computeFlow({ kind: 'windows', quote: signed, job: job({ status: 'scheduled', scheduledDate: '2026-10-30' }), money: { totalCents: 1, paidCents: 0 } }, TODAY);
assert.deepEqual([f.next.label, f.next.href], ['Prepare for the install', '/internal/jobs/prepare?id=J-1'], 'before the install date: prep');
f = computeFlow({ kind: 'windows', quote: signed, job: job({ status: 'scheduled', scheduledDate: TODAY }), money: { totalCents: 1, paidCents: 0 } }, TODAY);
assert.deepEqual([f.next.label, f.next.href], ['Open field mode', '/internal/jobs/field?id=J-1'], 'on the day: field mode');
f = computeFlow({ kind: 'windows', quote: signed, job: job({ status: 'in-progress', scheduledDate: TODAY }), money: { totalCents: 1, paidCents: 0 } }, TODAY);
assert.equal(f.next.label, 'Continue in field mode');
assert.equal(f.next.also[0].href, '/internal/jobs/closeout?id=J-1');
assert.equal(f.steps.find((s) => s.state === 'current').key, 'closed');
f = computeFlow({ kind: 'windows', quote: signed, job: job({ status: 'completed', scheduledDate: TODAY }), money: { totalCents: 553518, paidCents: 200000 } }, TODAY);
assert.deepEqual([f.next.label, f.next.hint, f.next.href], ['Record the payment', '$3,535.18 is still due.', '/internal/payments']);
f = computeFlow({ kind: 'windows', quote: signed, job: job({ status: 'completed', scheduledDate: TODAY }), money: { totalCents: 553518, paidCents: 553518 } }, TODAY);
assert.equal(f.next, null);
assert.equal(f.note, 'Paid in full. Nothing left to do.');
assert.ok(f.steps.every((s) => s.state === 'done'));
f = computeFlow({ kind: 'windows', quote: signed, job: job({ status: 'cancelled' }), money: { totalCents: 1, paidCents: 0 } }, TODAY);
assert.equal(f.next, null);
assert.equal(f.note, 'This job is cancelled.');
f = computeFlow({ kind: 'windows', quote: signed, job: job({ status: 'scheduled', scheduledDate: TODAY }), money: { totalCents: 100000, paidCents: 100000 } }, TODAY);
assert.notEqual(f.steps.find((s) => s.key === 'paid').state, 'done', 'a deposit paid before the job is finished does not mark it Paid');
pass('after signing: schedule, prep before the day, field mode on it, closeout, payment, and a plain end');

// ── pure: siding and general jobs ────────────────────────────────────────────────────────────────
f = computeFlow({ kind: 'siding', quote: quote() }, TODAY);
assert.equal(keys(f), 'quote:d signed:c job:t scheduled:t closed:t paid:t', 'siding skips the Build Plan');
assert.equal(f.next.label, 'Sign the quote');
f = computeFlow({ kind: 'siding', quote: signed, job: job({ status: 'scheduled', scheduledDate: '2026-10-30' }), money: { totalCents: 360000, paidCents: 0 } }, TODAY);
assert.equal(f.next.label, 'Mark the job complete', 'a siding job has no field mode or closeout');
f = computeFlow({ kind: 'general', job: job(), money: { totalCents: 480050, paidCents: 0 } }, TODAY);
assert.equal(keys(f), 'job:d scheduled:c closed:t paid:t');
assert.equal(f.next.label, 'Schedule the install');
pass('siding and general jobs skip the steps they do not have');

assert.equal(pacificDate(new Date('2026-10-23T05:00:00Z')), '2026-10-22', 'the business day is Pacific time');
assert.equal(pacificDate(new Date('2026-10-23T16:00:00Z')), '2026-10-23');

// ── real records ─────────────────────────────────────────────────────────────────────────────────
const db = createD1({ schemaFiles: ['functions/api/_data/schema.sql', 'internal/db/schema.sql'] });
const env = { QUOTES_DB: db };
const call = async (mod, method, url, body) => {
  const response = await (mod.onRequest || mod[`onRequest${method[0] + method.slice(1).toLowerCase()}`])({ request: new Request(`https://example.test${url}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), env, params: {} });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};
const flowOf = async (query) => (await call(flowApi, 'GET', `/internal/api/flow${query}`)).body;

const created = await call(quotesIndex, 'POST', '/internal/api/quotes', { customer: { name: 'Pat Doe', phone: '(360) 555-0100', city: 'Camas' }, workType: 'windows', signatureMethod: 'digital', items: [{ label: 'Slider', quantity: 2, unitPriceCents: 85000 }] });
assert.equal(created.status, 201, JSON.stringify(created.body));
const qid = created.body.id;
let live = await flowOf(`?quoteId=${qid}`);
assert.equal(live.status, 'ok');
assert.equal(live.kind, 'windows');
assert.equal(live.next.label, 'Build the Build Plan', 'a new window quote starts at the Build Plan');

assert.equal((await call(flowApi, 'GET', '/internal/api/flow')).status, 400);
assert.equal((await call(flowApi, 'GET', '/internal/api/flow?quoteId=Q-NOPE')).status, 404);
assert.equal((await call(flowApi, 'GET', '/internal/api/flow?quoteId=' + encodeURIComponent("x'; DROP TABLE quotes; --"))).status, 400, 'an id with odd characters is refused, not queried');
assert.equal((await call(flowApi, 'POST', '/internal/api/flow')).status, 405);
const resp = await flowApi.onRequest({ request: new Request('https://example.test/internal/api/flow?quoteId=' + qid), env });
assert.equal(resp.headers.get('cache-control'), 'private, no-store');
assert.equal((await flowApi.onRequest({ request: new Request('https://example.test/internal/api/flow?quoteId=x'), env: {} })).status, 503);

// A siding quote and a general job, from records.
const siding = await call(quotesIndex, 'POST', '/internal/api/quotes', { customer: { name: 'Sam', phone: '(503) 555-0111' }, workType: 'siding', signatureMethod: 'pen', items: [{ label: 'Siding, existing home', quantity: 1200, unitPriceCents: 950 }] });
assert.equal((await flowOf(`?quoteId=${siding.body.id}`)).kind, 'siding');
assert.equal((await flowOf(`?quoteId=${siding.body.id}`)).next.label, 'Sign the quote');
const general = await call(jobsApi, 'POST', '/internal/api/jobs', { workType: 'general', customerName: 'Gale', workDescription: 'Deck repair', agreedAmount: '4800.50' });
const gjob = general.body.id;
live = await flowOf(`?jobId=${gjob}`);
assert.deepEqual([live.kind, live.next.label], ['general', 'Schedule the install']);
await call(jobsApi, 'PATCH', `/internal/api/jobs?id=${gjob}`, { status: 'completed' });
await call(paymentsApi, 'PATCH', `/internal/api/payments?jobId=${gjob}`, { amountPaidCents: 100000, paymentMethod: 'check' });
live = await flowOf(`?jobId=${gjob}`);
assert.equal(live.next.label, 'Record the payment');
assert.equal(live.next.hint, '$3,800.50 is still due.', 'the amount still due comes from the agreed amount less what was recorded');
await call(paymentsApi, 'PATCH', `/internal/api/payments?jobId=${gjob}`, { amountPaidCents: 480050, paymentMethod: 'check' });
assert.equal((await flowOf(`?jobId=${gjob}`)).next, null);
pass('the same answers come from real records: new quote, siding, and a general job through to paid');

// ── page wiring ──────────────────────────────────────────────────────────────────────────────────
const bar = read('src/components/internal/FlowBar.astro');
assert.ok(!/innerHTML/.test(bar), 'built as nodes');
assert.ok(!/data-loading/.test(bar.replace(/data-flow-loading/g, '')), 'the bar must not use the data-loading attribute the pages use for their own Loading line');
assert.ok(/\/internal\/api\/flow\?/.test(bar) && /create-job/.test(bar) && /\/internal\/api\/jobs/.test(bar), 'it reads the flow and can create the job');
assert.ok(/aria-current/.test(bar) && /You are on this step/.test(bar), 'the current step is marked for screen readers, and a step shown on its own page offers no button to itself');
for (const page of ['quotes/view', 'quotes/build-plan', 'quotes/build-plan-approval', 'jobs/view', 'jobs/prepare', 'jobs/field', 'jobs/closeout']) assert.ok(/<FlowBar/.test(read(`src/pages/internal/${page}.astro`)), `${page} shows the path and the next step`);
pass('the stepper and the next step are on the quote and job pages');
console.log('Flow checks passed.');
