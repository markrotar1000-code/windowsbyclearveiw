// Fin naming, Mark's own fin prices, and price edits on a quote until it is signed.
// Runs the real handlers on real SQLite, like test-quote-signing.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as quotesIndex from '../functions/internal/api/quotes/index.js';
import * as quoteById from '../functions/internal/api/quotes/[id].js';
import * as buildPlan from '../functions/internal/api/build-plan.js';
import * as planState from '../functions/internal/api/build-plan-state.js';
import { requireApprovedBuildPlan } from '../functions/internal/_lib/quote-gates.mjs';
import { sameSource, sourceSnapshot } from '../functions/_lib/build-plan-rules.mjs';

process.removeAllListeners('warning');
const root = new URL('../', import.meta.url);
const pass = (m) => console.log(`PASS: ${m}`);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');

// ── A vinyl Cascade slider starts at $850 whether it is an insert or a fin install ──────────────────────
{
  const { pricing } = await import(pathToFileURL(`${root.pathname}src/data/pricing.ts`).href);
  const { suggestedUnitPrice } = await import(pathToFileURL(`${root.pathname}src/lib/quote-pricing.ts`).href);
  const slider = pricing.openings.find((o) => o.id === 'slider');
  const casement = pricing.openings.find((o) => o.id === 'casement');
  const cascade = pricing.brands.find((b) => b.id === 'cascade');
  const milgard = pricing.brands.find((b) => b.id === 'milgard');
  const fiberglass = pricing.materials.find((m) => m.id === 'fiberglass');

  assert.equal(slider.quotePrice, 850);
  assert.equal(suggestedUnitPrice({ opening: slider, materialMultiplier: 1, brand: cascade }), 850);
  assert.equal(suggestedUnitPrice({ opening: slider, materialMultiplier: 1, brand: milgard }), 950, 'brand step-up still adds on top');
  assert.equal(suggestedUnitPrice({ opening: slider, materialMultiplier: fiberglass.multiplier, brand: cascade }), 1190, 'material multiplier still applies');
  assert.equal(casement.quotePrice, undefined, 'no invented prices for openings Mark has not given');
  assert.equal(suggestedUnitPrice({ opening: casement, materialMultiplier: 1, brand: cascade }), 1100, 'other openings keep the range midpoint');

  // Fin is a name, not a price: the builder never adds a frame allowance for it.
  const builder = read('src/pages/internal/quotes/new.astro');
  assert.ok(!/fullFrame|finAllowance|finPrice/.test(builder + read('src/lib/quote-pricing.ts')), 'the method never reaches the price math');
  pass('a vinyl Cascade slider suggests $850 for any install method; fin does not change the price');
}

// ── "Fin" everywhere Mark looks ─────────────────────────────────────────────────────────────────────────
{
  const builder = read('src/pages/internal/quotes/new.astro');
  assert.match(builder, /<option value="fin">Fin<\/option>/);
  assert.ok(!/full-frame|Full-frame/.test(builder), 'quote builder never says full-frame');
  assert.match(builder, /isFin \? 'fin' : 'insert'/, 'the saved line label says fin');
  const planPage = read('src/pages/internal/quotes/build-plan.astro');
  assert.match(planPage, /<option value="fin"[^>]*>Fin<\/option>/);
  assert.ok(!/>Full-frame</.test(planPage), 'Build Plan method list says Fin');
  const { generatePlan } = await import('../functions/internal/api/build-plan.js');
  for (const label of ['Slider — Vinyl — Cascade — fin', 'Slider, full-frame (old quote)']) {
    const plan = generatePlan({}, [{ label, quantity: 1 }]);
    assert.equal(plan.openings[0].installationMethod, 'fin', `plan reads "${label}" as a fin install`);
  }
  pass('the builder, the Build Plan and plan generation say fin; old full-frame labels still read as fin');
}

// ── A price can change at any time before signing, even after the Build Plan is approved ────────────────
const env = { QUOTES_DB: createD1({ schemaFiles: ['functions/api/_data/schema.sql', 'internal/db/schema.sql'] }) };
async function call(handler, { method = 'GET', path = '/', body, params = {} } = {}) {
  const request = new Request(`https://windowsbyclearview.com${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const waits = [];
  const response = await handler({ request, env, params, waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  return { status: response.status, body: await response.json() };
}
const customer = { name: 'Joey Padilla', phone: '(360) 555-0100', email: 'joey@example.com', address: '9407 NE 105th Ave', city: 'Vancouver' };
const put = (id, items, extra = {}) => call(quoteById.onRequestPut, { method: 'PUT', params: { id }, body: { customer, items, signatureMethod: 'pen', ...extra } });
const planStatus = (id) => call(planState.onRequestGet, { path: `/internal/api/build-plan-state?quoteId=${id}` });

{
  const items = [{ label: 'Slider — Vinyl — Cascade — fin', quantity: 1, unitPriceCents: 85000 }];
  const created = await call(quotesIndex.onRequestPost, { method: 'POST', body: { customer, items, signatureMethod: 'pen' } });
  const id = created.body.id;
  assert.equal(created.body.totalCents, 85000);
  const gen = await call(buildPlan.onRequestGet, { path: `/internal/api/build-plan?quoteId=${id}` });
  await call(buildPlan.onRequestPost, { method: 'POST', body: { quoteId: id, plan: gen.body.plan } });
  await call(planState.onRequestPost, { method: 'POST', body: { quoteId: id, action: 'submit-review' } });
  assert.equal((await call(planState.onRequestPost, { method: 'POST', body: { quoteId: id, action: 'approve' } })).status, 200);

  // Mark changes the price of the approved line, and adds a line, at the last moment.
  const edited = await put(id, [{ ...items[0], unitPriceCents: 91000 }]);
  assert.equal(edited.status, 200);
  assert.equal(edited.body.totalCents, 91000);
  const after = await planStatus(id);
  assert.equal(after.body.stale, false, 'a price change does not make the approved Build Plan stale');
  assert.equal(after.body.status, 'approved');
  assert.equal(await requireApprovedBuildPlan(env.QUOTES_DB, id), null, 'the signing gate still passes');

  // A change to what is installed still does.
  const moved = await put(id, [{ ...items[0], quantity: 2, unitPriceCents: 91000 }]);
  assert.equal(moved.status, 200);
  assert.equal((await planStatus(id)).body.stale, true, 'changing quantity still requires the plan to be re-approved');
  assert.equal((await requireApprovedBuildPlan(env.QUOTES_DB, id))?.code, 'BUILD_PLAN_STALE');
  pass('Mark can reprice an approved quote; only install-relevant changes reopen the Build Plan');
}

{
  // Snapshots saved before this change carried the line total; they must keep matching an unchanged quote.
  const legacy = [{ index: 0, label: 'Slider', quantity: 1, description: '', lineTotalCents: 85000 }];
  const now = sourceSnapshot([{ label: 'Slider', quantity: 1, description: '', line_total_cents: 91000 }]);
  assert.ok(sameSource(legacy, now), 'old saved snapshots compare equal when only the price moved');
  assert.ok(!sameSource(legacy, sourceSnapshot([{ label: 'Slider', quantity: 2, description: '', line_total_cents: 85000 }])));
  pass('Build Plans approved before this change are not stranded');
}

// ── A signed quote is a record: it still cannot be repriced ─────────────────────────────────────────────
{
  const created = await call(quotesIndex.onRequestPost, { method: 'POST', body: { customer, items: [{ label: 'Siding labor', quantity: 100, unitPriceCents: 500 }], workType: 'siding', signatureMethod: 'pen' } });
  const id = created.body.id;
  await env.QUOTES_DB.prepare(`UPDATE quotes SET status = 'finalized' WHERE id = ?`).bind(id).run();
  const blocked = await put(id, [{ label: 'Siding labor', quantity: 100, unitPriceCents: 400 }], { workType: 'siding' });
  assert.equal(blocked.status, 409);
  pass('a finalized quote cannot be repriced');
}
