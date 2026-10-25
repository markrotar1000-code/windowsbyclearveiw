// Every change to what was paid leaves a record. Runs the real payments handler on real SQLite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as payments from '../functions/internal/api/payments.js';

process.removeAllListeners('warning');
const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const pass = (m) => console.log(`PASS: ${m}`);

const db = createD1({ schemaFiles: ['functions/api/_data/schema.sql', 'internal/db/schema.sql'] });
const env = { QUOTES_DB: db };
const call = (method, qs = '', body) => payments[`onRequest${method}`]({ env, request: new Request(`https://windowsbyclearview.com/internal/api/payments${qs}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }) });
await call('Get'); // creates the schemas
const now = '2026-10-25T10:00:00.000Z';
await db.prepare(`INSERT INTO jobs (id, created_at, updated_at, status, customer_name, agreed_cents) VALUES ('J-1', ?, ?, 'ready', 'Pat Doe', 500000)`).bind(now, now).run();
await db.prepare(`INSERT INTO jobs (id, created_at, updated_at, status, customer_name, agreed_cents) VALUES ('J-2', ?, ?, 'ready', 'Dana Whitfield', 100000)`).bind(now, now).run();
const patch = async (job, body) => { const r = await call('Patch', `?jobId=${job}`, body); return { status: r.status, body: await r.json() }; };
const log = async (job) => (await db.prepare('SELECT previous_cents, new_cents, method FROM job_payment_log WHERE job_id = ? ORDER BY id').bind(job).all()).results;

// 1. A deposit, the balance, then a correction: all three are on record, in order.
{
  let r = await patch('J-1', { amountPaidCents: 200000, paymentMethod: 'Check', notes: 'deposit' });
  assert.equal(r.status, 200); assert.equal(r.body.history.length, 1);
  assert.deepEqual(r.body.history[0], { at: r.body.history[0].at, previous_cents: 0, new_cents: 200000, method: 'Check' });
  await patch('J-1', { amountPaidCents: 500000, paymentMethod: 'Card' });
  await patch('J-1', { amountPaidCents: 450000, paymentMethod: 'Card' }); // a correction
  assert.deepEqual(await log('J-1'), [
    { previous_cents: 0, new_cents: 200000, method: 'Check' },
    { previous_cents: 200000, new_cents: 500000, method: 'Card' },
    { previous_cents: 500000, new_cents: 450000, method: 'Card' },
  ]);
  const got = await (await call('Get', '?jobId=J-1')).json();
  assert.equal(got.history.length, 3); assert.equal(got.history[0].new_cents, 450000, 'newest first');
  pass('a deposit, a payment and a correction are all on record, in order');
}

// 2. Saving the same thing again, or only a note, writes nothing.
{
  const before = (await log('J-1')).length;
  await patch('J-1', { amountPaidCents: 450000, paymentMethod: 'Card', notes: 'a new note only' });
  await patch('J-1', { amountPaidCents: 450000 });
  assert.equal((await log('J-1')).length, before, 'no change, no row');
  await patch('J-1', { paymentMethod: 'Cash' });
  const rows = await log('J-1');
  assert.equal(rows.length, before + 1, 'a method change is recorded');
  assert.deepEqual(rows.at(-1), { previous_cents: 450000, new_cents: 450000, method: 'Cash' });
  pass('only real changes are logged (amount or method); a note alone is not');
}

// 3. A refused change leaves no trace and changes nothing.
{
  const before = (await log('J-2')).length;
  for (const body of [{ amountPaidCents: -1 }, { amountPaidCents: 100001 }, { amountPaidCents: 'abc' }, { amountPaidCents: '' }, { amountPaidCents: null }]) {
    assert.equal((await patch('J-2', body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await log('J-2')).length, before, 'refused changes write no history');
  assert.equal((await (await call('Get', '?jobId=J-2')).json()).payment.amount_paid_cents, 0, 'and no money moved');
  pass('a refused change writes no history and changes nothing');
}

// 4. The list carries each job its own history, capped, and jobs do not mix.
{
  for (let i = 1; i <= 12; i += 1) await patch('J-2', { amountPaidCents: i * 1000 });
  const list = await (await call('Get')).json();
  const j1 = list.jobs.find((j) => j.id === 'J-1'); const j2 = list.jobs.find((j) => j.id === 'J-2');
  assert.equal(j2.history.length, 8, 'at most the newest eight are listed');
  assert.equal(j2.history[0].new_cents, 12000); assert.ok(j2.history.every((h) => h.previous_cents !== undefined));
  assert.equal(j1.history.length, 4); assert.ok(j1.history.every((h) => [0, 200000, 500000, 450000].includes(h.new_cents)), "one job's history never shows another's");
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM job_payment_log WHERE job_id = ?').bind('J-2').first()).n, 12, 'the full record is kept even though only eight are listed');
  pass('each job lists its own newest changes; the full record is kept');
}

// 5. The invoice still follows the payment, and the table cannot be edited through the API.
{
  const src = read('functions/internal/api/payments.js');
  assert.match(src, /env\.QUOTES_DB\.batch\(statements\)/, 'the update and its history row are written together');
  assert.ok(!/UPDATE job_payment_log|DELETE FROM job_payment_log/.test(src), 'history is append-only: nothing updates or deletes it');
  const page = read('src/pages/internal/payments.astro');
  assert.match(page, /taken off \(correction\)/); assert.match(page, /History \(\$\{h\.length\}\)/);
  pass('history is written with the change, append-only, and shown on the Payments page');
}

console.log('\nAll payment history checks passed.');
