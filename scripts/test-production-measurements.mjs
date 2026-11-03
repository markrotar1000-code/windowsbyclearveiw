import assert from 'node:assert/strict';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as create from '../functions/internal/api/quotes/index.js';
import * as quote from '../functions/internal/api/quotes/[id].js';
import * as jobs from '../functions/internal/api/jobs.js';
import { publicQuote } from '../functions/internal/_lib/quote-signing.mjs';
import { getInvoice } from '../functions/internal/_lib/invoices.mjs';
import { generatePlan } from '../functions/internal/api/build-plan.js';
import { sourceSnapshot } from '../functions/_lib/build-plan-rules.mjs';
import { customerLineText } from '../functions/internal/_lib/quote-measurements.mjs';

const env = { QUOTES_DB: createD1({ schemaFiles: ['internal/db/schema.sql'] }) };
const call = async (handler, method, body, params = {}) => {
  const r = await handler({ env, params, request: new Request('https://example.test/internal/api/test', {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }), waitUntil() {} });
  return { status: r.status, body: await r.json() };
};
const customer = { name: 'Private size test', phone: '5550100200' };
const measurements = [
  { width: '35 1/2', height: '47 3/4', kind: 'rough-opening', location: 'Kitchen' },
  { width: '36', height: '48', kind: 'unit', location: 'Bedroom' },
];
const items = [{ label: 'Cascade slider — insert', quantity: 2, unitPriceCents: 85000, measurements }];
const created = await call(create.onRequestPost, 'POST', { customer, items, signatureMethod: 'pen' });
assert.equal(created.status, 201, JSON.stringify(created.body));
const id = created.body.id;
let loaded = await call(quote.onRequestGet, 'GET', undefined, { id });
assert.deepEqual(JSON.parse(loaded.body.items[0].measurements_json), measurements);
const plan = generatePlan(loaded.body.quote, loaded.body.items);
assert.equal(plan.openings.length, 2);
assert.match(plan.openings[0].dimensions, /35 1\/2 x 47 3\/4/);
assert.match(plan.openings[1].dimensions, /36 x 48/);
assert.equal(plan.openings[0].installationMethod, 'insert');
const exposed = JSON.stringify(publicQuote(loaded.body.quote, loaded.body.items));
assert.ok(!exposed.includes('35 1/2') && !exposed.includes('measurements') && !exposed.includes('Kitchen'));
const invoice = await getInvoice(env.QUOTES_DB, created.body.invoiceId);
assert.ok(!JSON.stringify(invoice).includes('35 1/2'));
const bad = await call(create.onRequestPost, 'POST', { customer, items: [{ ...items[0], measurements: [{ ...measurements[0], width: '35.13' }] }] });
assert.equal(bad.status, 400);
const before = sourceSnapshot(loaded.body.items);
const updated = [{ ...items[0], measurements: [{ ...measurements[0], width: '35 3/4' }, measurements[1]] }];
assert.equal((await call(quote.onRequestPut, 'PUT', { customer, items: updated, signatureMethod: 'pen' }, { id })).status, 200);
loaded = await call(quote.onRequestGet, 'GET', undefined, { id });
assert.notDeepEqual(sourceSnapshot(loaded.body.items), before);
assert.equal((await call(jobs.onRequestPost, 'POST', { quoteId: id })).status, 409, 'unsigned quote cannot start production');
assert.equal((await call(quote.onRequestPatch, 'PATCH', { confirmPen: true, signatureName: 'Sample Customer' }, { id })).status, 200, 'sign with no build plan');
const job = await call(jobs.onRequestPost, 'POST', { quoteId: id });
assert.equal(job.status, 201, JSON.stringify(job.body));
const row = env.QUOTES_DB.raw.prepare('SELECT build_plan_json FROM jobs WHERE id=?').get(job.body.id);
const snapshot = JSON.parse(row.build_plan_json);
assert.equal(snapshot.openings.length, 2);
assert.match(snapshot.openings[0].dimensions, /35 3\/4/);
assert.equal(snapshot.status, 'production');
assert.equal((await call(jobs.onRequestPost, 'POST', { quoteId: id })).body.id, job.body.id);
assert.equal(customerLineText('Kitchen — slider — 35½ x 47¾'), 'Kitchen — slider');
const legacy = await call(create.onRequestPost, 'POST', { customer, items: [{ label: 'Slider 35 1/2 x 47 3/4', quantity: 1, unitPriceCents: 100 }] });
const old = await call(quote.onRequestGet, 'GET', undefined, { id: legacy.body.id });
assert.equal(old.body.items[0].label, 'Slider');
assert.match(old.body.items[0].measurements_json, /35 1\/2/);
console.log('PASS: private measurements, exact validation, per-opening handoff, customer/invoice privacy, direct signing, unsigned guard, duplicate start, legacy size extraction');
