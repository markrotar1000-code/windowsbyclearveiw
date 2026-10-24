// A quote line that is not a window or door (rot repair, trim, haul-away) must not become a Build Plan opening:
// Field mode and closeout ask for evidence on every opening, so a phantom one blocks finalizing a real job.
// One-sided on purpose: doubtful lines stay openings, and extras are listed in VERIFY so nothing vanishes.
import assert from 'node:assert/strict';
import { generatePlan } from '../functions/internal/api/build-plan.js';
import { isOpeningLine, lintPlan, splitQuoteLines } from '../functions/_lib/build-plan-rules.mjs';

const pass = (m) => console.log(`PASS: ${m}`);

{
  for (const label of ['Kitchen: Double-hung — Vinyl — Cascade — fin', 'Living room: Slider — Vinyl — Cascade', 'Sliding patio door', 'French door', 'Picture / fixed', 'Bay or bow window', 'Casement, egress', 'Kitchen window', 'Bathroom obscure 24x36', 'Unit A', 'Trim around the new window', 'Remove old window and haul away', 'Window with rot repair at sill']) {
    assert.equal(isOpeningLine(label), true, `${label} stays an opening`);
  }
  for (const label of ['Rot repair at sill', 'Back bedroom: Rot repair at sill', 'Trim', 'New interior trim', 'Haul-away and disposal', 'Permit fee', 'Paint and caulk', 'Siding repair', 'Delivery', 'Labor allowance']) {
    assert.equal(isOpeningLine(label), false, `${label} is an extra`);
  }
  assert.equal(isOpeningLine(''), true, 'an unlabeled line stays an opening');
  assert.equal(isOpeningLine(undefined), true);
  pass('only lines that clearly name an extra, and no window or door, are left out');
}

{
  const items = [
    { label: 'Kitchen: Double-hung — Vinyl — Cascade — fin', quantity: 2, description: '' },
    { label: 'Living room: Slider — Vinyl — Cascade', quantity: 1, description: '' },
    { label: 'Back bedroom: Rot repair at sill', quantity: 1, description: '' },
    { label: 'New interior trim', quantity: 3, description: '' },
  ];
  const plan = generatePlan({ customer_name: 'Dana', notes: '' }, items);
  assert.equal(plan.openings.length, 3, 'two double-hungs and a slider; the extras are not openings');
  assert.deepEqual(plan.openings.map((o) => o.opening), [1, 2, 3]);
  assert.ok(plan.openings.every((o) => !/rot|trim/i.test(o.sourceItemLabel)));
  const listed = plan.verify.filter((v) => v.startsWith('Quoted extra'));
  assert.equal(listed.length, 2, 'every extra is listed for Mark to confirm');
  assert.match(listed[0], /Rot repair at sill \(quantity 1\)/);
  assert.match(listed[1], /New interior trim \(quantity 3\)/);
  assert.equal(plan.sourceItems.length, 4, 'the source snapshot still covers every quoted line, so stale detection is unchanged');
  const lint = lintPlan(plan, items);
  assert.ok(!lint.warnings.some((w) => /Quote quantity/.test(w)), 'quantity check counts only openings');
  pass('a plan has one opening per window or door and lists the extras in VERIFY');
}

{
  // The quantity check still catches a real mismatch.
  const items = [{ label: 'Slider', quantity: 2, description: '' }, { label: 'Trim', quantity: 1, description: '' }];
  const plan = generatePlan({ customer_name: 'Dana', notes: '' }, items);
  plan.openings.pop();
  assert.ok(lintPlan(plan, items).warnings.some((w) => /Quote quantity \(2\) and opening schedule \(1\)/.test(w)));
  const { openings, extras } = splitQuoteLines(items);
  assert.equal(openings.length, 1); assert.equal(extras.length, 1);
  pass('the quote-quantity check still catches a real mismatch');
}

console.log('\nAll plan-extras checks passed.');
