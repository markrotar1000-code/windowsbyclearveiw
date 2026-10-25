// Measurements worksheet -> quote builder. Every worksheet type has a defined result (a priced window line or an
// unpriced custom line, never silently skipped), sizes come out "35 1/2 x 47 3/4", bad saved data cannot break the page,
// and the Build Plan can read the size off the imported line.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generatePlan } from '../functions/internal/api/build-plan.js';

process.removeAllListeners('warning');
const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const pass = (m) => console.log(`PASS: ${m}`);
const lib = await import(new URL('src/lib/measurement-lines.ts', root).href);
const notesLib = await import(new URL('src/lib/quote-notes-lines.ts', root).href);
const { pricing } = await import(new URL('src/data/pricing.ts', root).href);
const catalog = {
  openings: pricing.openings.map((o) => ({ id: o.id, label: o.label, low: o.low, high: o.high, isDoor: !!o.isDoor, quotePrice: 'quotePrice' in o ? o.quotePrice : null })),
  materials: pricing.materials.map((m) => ({ id: m.id, label: m.label, multiplier: m.multiplier })),
  brands: pricing.brands.map((b) => ({ id: b.id, label: b.label, low: b.low, high: b.high })),
};
const sheet = (openings, extra = {}) => lib.readWorksheet(JSON.stringify({ jobName: 'Whitfield kitchen', jobAddress: '12 Oak St', jobNotes: 'Dog in back yard.', openings, ...extra }));
const TYPES = ['Single-hung', 'Double-hung', 'Slider', 'Casement', 'Picture', 'Awning', 'Bay / bow', 'Patio door', 'Entry door', 'Other'];

// 1. Every type the worksheet offers has a defined outcome.
{
  const s = sheet(TYPES.map((type, i) => ({ room: `Room ${i + 1}`, type, width: 35.5, height: 47.75, quantity: 2, notes: '' })));
  const { lines, unpriced } = lib.worksheetToLines(s);
  assert.equal(lines.length, TYPES.length, 'no opening is dropped');
  const windows = lines.filter((l) => l.type === 'window').map((l) => l.openingId);
  assert.deepEqual(windows, ['single-hung', 'double-hung', 'slider', 'casement', 'picture', 'awning', 'bay-bow', 'sliding-door']);
  for (const id of windows) assert.ok(pricing.openings.some((o) => o.id === id), `${id} is a price-book opening`);
  assert.equal(unpriced, 2, 'an entry door and Other have no price-book entry and come in unpriced');
  const items = lines.map((l) => notesLib.draftLineToItem(l, catalog, 'windows'));
  assert.ok(items.every(Boolean));
  assert.equal(items[2].label, 'Room 3: Slider — 35 1/2 x 47 3/4');
  assert.equal(items[2].unitPrice, 850, "Mark's own slider price");
  assert.equal(items[8].label, 'Room 9: Entry door — 35 1/2 x 47 3/4'); assert.equal(items[8].unitPrice, 0);
  assert.equal(items[9].label, 'Room 10: Other opening — 35 1/2 x 47 3/4'); assert.equal(items[9].quantity, 2);
  assert.ok(items.every((i) => !/"|×|\d\.\d/.test(i.label)), 'no inch marks, multiplication signs or decimals in a label');
  pass('every worksheet type comes in as a priced window line or an unpriced custom line, sizes with a slash');
}

// 2. Sizes: exact sixteenths, a missing or odd size is called out, never invented.
{
  const s = sheet([
    { room: 'Kitchen', type: 'Double-hung', width: 35.5, height: 47.75, quantity: 1, notes: 'wants grids' },
    { room: 'Den', type: 'Picture', width: 48, height: null, quantity: 1, notes: '' },
    { room: 'Bath', type: 'Awning', width: null, height: null, quantity: 1, notes: '' },
    { room: 'Hall', type: 'Slider', width: 35.38, height: 59, quantity: 1, notes: '' },
    { room: 'Attic', type: 'Casement', width: 3, height: 500, quantity: 1, notes: '' },
  ]);
  const { lines, checks } = lib.worksheetToLines(s);
  assert.equal(lines[0].size, '35 1/2 x 47 3/4');
  assert.equal(lines[1].size, '', 'one measured dimension is not a size');
  assert.equal(lines[2].size, '');
  assert.equal(lines[3].size, '35 3/8 x 59'); assert.equal(lines[3].sizeRounded, true, '35.38 is rounded to the nearest 1/16 and flagged');
  assert.ok(checks.some((c) => /Den: only the width \(48\)/.test(c)));
  assert.ok(checks.some((c) => /Bath: no size measured yet/.test(c)));
  assert.ok(checks.some((c) => /Hall: 35\.38 x 59 is not a multiple of 1\/16/.test(c)));
  assert.ok(checks.some((c) => /Attic: 3 x 500 is an unusual size/.test(c)));
  pass('a half-measured or rounded size is called out, never filled in');
}

// 3. Bad saved data cannot break the page.
{
  for (const raw of [null, '', 'nope', '{}', '{"openings":"x"}', '{"openings":[]}', '[]', 'null']) assert.equal(lib.readWorksheet(raw), null, String(raw));
  const s = lib.readWorksheet(JSON.stringify({ openings: [{ room: 5, type: {}, width: '35', height: -4, quantity: 'many', notes: null }, null, 7] }));
  assert.equal(s.openings.length, 3);
  assert.deepEqual(s.openings[0], { room: '', type: 'Other', width: null, height: null, quantity: 1, notes: '' }, 'wrong types become safe empties');
  assert.equal(lib.readWorksheet(JSON.stringify({ openings: [{ quantity: 5000 }] })).openings[0].quantity, 99, 'quantity is capped');
  assert.equal(lib.readWorksheet(JSON.stringify({ openings: Array.from({ length: 500 }, () => ({})) })).openings.length, 200, 'at most 200 openings');
  pass('a corrupt or hostile saved worksheet reads as safe values or nothing');
}

// 4. Notes block: internal only, written once.
{
  const s = sheet([{ room: 'Kitchen', type: 'Slider', width: 36, height: 48, quantity: 1, notes: 'rot at sill' }]);
  const block = lib.measurementNotes(s);
  assert.match(block, /^Field measurement notes:\nJob: Whitfield kitchen\nDog in back yard\.\n- Kitchen: rot at sill$/);
  const once = notesLib.mergeNotes('Existing', block);
  assert.equal(notesLib.mergeNotes(once, block), once, 'importing twice adds nothing');
  assert.equal(lib.measurementNotes(sheet([{ type: 'Slider', width: 36, height: 48 }], { jobName: '', jobNotes: '' })), '', 'nothing to say, nothing written');
  pass('job and opening notes go to the internal notes once');
}

// 5. The Build Plan reads the imported size and still says VERIFY.
{
  const s = sheet([{ room: 'Kitchen', type: 'Double-hung', width: 35.5, height: 47.75, quantity: 2, notes: '' }, { room: 'Den', type: 'Picture', width: null, height: null, quantity: 1, notes: '' }]);
  const items = lib.worksheetToLines(s).lines.map((l) => notesLib.draftLineToItem(l, catalog, 'windows')).map((i) => ({ label: i.label, quantity: i.quantity, description: '' }));
  const plan = generatePlan({ customer_name: 'Dana', notes: '' }, items);
  assert.equal(plan.openings.length, 3);
  assert.match(plan.openings[0].dimensions, /^35 1\/2 x 47 3\/4 \(width x height, inches; from the quote line; VERIFY at site\)$/);
  assert.equal(plan.openings[2].dimensions, 'VERIFY at site');
  pass('the Build Plan reads the size off an imported line and keeps VERIFY');
}

// 6. The page uses it; the old layout hack is gone.
{
  const quote = read('src/pages/internal/quotes/new.astro');
  assert.match(quote, /data-measure-add/); assert.match(quote, /data-measure-undo/); assert.match(quote, /readWorksheet\(store\.get\(MEASUREMENT_KEY\)\)/);
  assert.match(quote, /Check every price and quantity before you save/);
  const layout = read('src/layouts/InternalLayout.astro');
  assert.ok(!/mountMeasurementImport|measurement-import-bar|Number\(opening\.width\)\.toLocaleString/.test(layout), 'the old decimal import hack is removed from the layout');
  pass('the quote page owns the handoff and the old decimal hack is gone');
}

console.log('\nAll measurement handoff checks passed.');
