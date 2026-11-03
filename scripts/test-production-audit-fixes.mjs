import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as create from '../functions/internal/api/quotes/index.js';
import * as quote from '../functions/internal/api/quotes/[id].js';
import * as jobs from '../functions/internal/api/jobs.js';
import * as operations from '../functions/internal/api/quote-operations.js';
import * as revisions from '../functions/internal/api/quote-revision.js';
const db = createD1({ schemaFiles: ['internal/db/schema.sql'] });
const env = { QUOTES_DB: db, ASSETS: { fetch: async request => {
  const file = new URL(request.url).pathname;
  try { return new Response(fs.readFileSync('public' + file)); } catch { return new Response('', { status: 404 }); }
} } };
const waits = [];
const call = async (fn, method, body, params = {}, query = '') => {
  const response = await fn({ env, params, request: new Request('https://example.test/internal/api/test' + query, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }), waitUntil(p) { waits.push(p); } });
  return { status: response.status, body: await response.json() };
};
const customer = { name: 'Production regression', phone: '5550100200' };
async function make(quantity = 1) {
  const r = await call(create.onRequestPost, 'POST', { customer, signatureMethod: 'pen', items: [{ label: 'Slider insert', quantity, unitPriceCents: 100000 }] });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.id;
}
async function sign(id) { const r = await call(quote.onRequestPatch, 'PATCH', { confirmPen: true, signatureName: customer.name }, { id }); assert.equal(r.status, 200, JSON.stringify(r.body)); }

const big = await make(51); await sign(big);
const started = await call(jobs.onRequestPost, 'POST', { quoteId: big });
assert.equal(started.status, 201, JSON.stringify(started.body));
assert.equal(JSON.parse(db.raw.prepare('SELECT build_plan_json FROM jobs WHERE id=?').get(started.body.id).build_plan_json).openings.length, 51);
const tooBig = await make(101); await sign(tooBig);
const refused = await call(jobs.onRequestPost, 'POST', { quoteId: tooBig });
assert.equal(refused.status, 413);
assert.match(refused.body.blockers.join(' '), /100 openings/);
const id = await make(); await sign(id);
const raced = await Promise.all([call(jobs.onRequestPost, 'POST', { quoteId: id }), call(jobs.onRequestPost, 'POST', { quoteId: id })]);
assert.deepEqual(raced.map(r => r.status).sort(), [200, 201]);
assert.equal(raced[0].body.id, raced[1].body.id);
const before = db.raw.prepare('SELECT * FROM quotes WHERE id=?').get(id);
let op = await call(operations.onRequestGet, 'GET', undefined, {}, '?quoteId=' + id);
const item = op.body.items[0];
assert.equal((await call(operations.onRequestPost, 'POST', { quoteId: id, expectedRevision: op.body.revision, items: [{ itemId: item.id, measurements: [] }] })).status, 400, 'private corrections require an audit reason');
const fixed = await call(operations.onRequestPost, 'POST', { quoteId: id, expectedRevision: op.body.revision, items: [{ itemId: item.id, measurements: [{ width: '35 1/2', height: '47 3/4', kind: 'rough-opening', location: 'Kitchen' }] }], note: 'Site remeasure' });
assert.equal(fixed.status, 200, JSON.stringify(fixed.body));
assert.equal(fixed.body.buildPlanVersion, 2);
const after = db.raw.prepare('SELECT * FROM quotes WHERE id=?').get(id);
for (const field of ['status', 'signature_name', 'signed_at', 'updated_at', 'total_cents', 'subtotal_cents']) assert.equal(after[field], before[field], field + ' remains part of the original signed agreement');
const plan = JSON.parse(db.raw.prepare('SELECT build_plan_json FROM jobs WHERE id=?').get(raced[0].body.id).build_plan_json);
assert.match(plan.openings[0].dimensions, /35 1\/2 x 47 3\/4/);
assert.equal(db.raw.prepare('SELECT count(*) AS n FROM quote_operation_changes WHERE quote_id=?').get(id).n, 1);
assert.equal((await call(operations.onRequestPost, 'POST', { quoteId: id, expectedRevision: op.body.revision, items: [{ itemId: item.id, measurements: [] }] })).status, 409);
// Force Start production into the private-correction window after the absence read.
const correctionRaceId = await make(); await sign(correctionRaceId);
const correctionRace = await call(operations.onRequestGet, 'GET', undefined, {}, '?quoteId=' + correctionRaceId);
const correctionBatch = db.batch.bind(db);
let createDuringCorrection = true;
db.batch = async statements => {
  if (createDuringCorrection && statements.length === 5) {
    createDuringCorrection = false;
    assert.equal((await call(jobs.onRequestPost, 'POST', { quoteId: correctionRaceId })).status, 201);
  }
  return correctionBatch(statements);
};
const correctionConflict = await call(operations.onRequestPost, 'POST', { quoteId: correctionRaceId, expectedRevision: correctionRace.body.revision, note: 'Remeasure', items: [{ itemId: correctionRace.body.items[0].id, measurements: [{ width: '36', height: '48', kind: 'unit' }] }] });
db.batch = correctionBatch;
assert.equal(createDuringCorrection, false, 'test injected production after correction observed no job');
assert.equal(correctionConflict.status, 409, 'a newly created job forces correction reload instead of divergent snapshots');
assert.equal(db.raw.prepare('SELECT measurements_json FROM quote_items WHERE quote_id=?').get(correctionRaceId).measurements_json, '[]', 'conflicting correction rolled back');
const draft = await make();
let loaded = await call(quote.onRequestGet, 'GET', undefined, { id: draft });
const originalRevision = loaded.body.quote.revision;
const editBody = { customer, expectedRevision: originalRevision, signatureMethod: 'pen', items: [{ label: 'Slider insert', quantity: 1, unitPriceCents: 120000 }] };
assert.equal((await call(quote.onRequestPut, 'PUT', editBody, { id: draft })).status, 200);
assert.equal((await call(quote.onRequestPut, 'PUT', editBody, { id: draft })).status, 409);
assert.equal((await call(quote.onRequestPatch, 'PATCH', { confirmPen: true, signatureName: customer.name, expectedRevision: originalRevision }, { id: draft })).status, 409);
// Force the signer to win after the edit loaded a draft but before its transaction.
const racingDraft = await make();
const realBatch = db.batch.bind(db);
let injectRace = true;
db.batch = async statements => {
  if (injectRace && statements.length === 6) { injectRace = false; await sign(racingDraft); }
  return realBatch(statements);
};
const racedEdit = await call(quote.onRequestPut, 'PUT', { ...editBody, expectedRevision: 1 }, { id: racingDraft });
db.batch = realBatch;
assert.equal(injectRace, false, 'test injected the signature in the edit window');
assert.equal(racedEdit.status, 409);
const signedOriginal = db.raw.prepare('SELECT status,total_cents FROM quotes WHERE id=?').get(racingDraft);
assert.equal(signedOriginal.status, 'finalized'); assert.equal(signedOriginal.total_cents, 100000);
const revision = await call(revisions.onRequestPost, 'POST', { quoteId: id, kind: 'revision' });
assert.equal(revision.status, 201, JSON.stringify(revision.body));
const newQuote = db.raw.prepare('SELECT * FROM quotes WHERE id=?').get(revision.body.id);
assert.equal(newQuote.status, 'draft'); assert.equal(newQuote.revision_of, id); assert.equal(newQuote.signature_name, null);
await sign(newQuote.id);
const heldProduction = await call(jobs.onRequestPost, 'POST', { quoteId: newQuote.id });
assert.equal(heldProduction.status, 409, 'a full replacement must reconcile its original invoice first');
assert.equal(heldProduction.body.code, 'INVOICE_RECONCILIATION_REQUIRED');
const change = await call(revisions.onRequestPost, 'POST', { quoteId: id, kind: 'change-order', items: [{ label: 'Additional trim finish', quantity: 1, unitPriceCents: 5000 }] });
assert.equal(change.status, 201); assert.equal(change.body.totalCents, 5000);
assert.equal((await call(revisions.onRequestPost, 'POST', { quoteId: id, kind: 'change-order' })).status, 400);
await Promise.all(waits);
console.log('PASS: 51 openings preserved, explicit 100 limit, concurrent production retry, signed measurement correction/history/job version, stale edits/signatures refused, separate unsigned revision and delta change-order');
