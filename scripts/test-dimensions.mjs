// Window sizes the way the trade writes them: inches, width first, fractions with a slash ("35 1/2 x 47 3/4").
// Covers the parser (written and spoken forms), the dictation endpoint, the quote line label, the Build Plan prefill,
// and the Measurements and Field mode inputs. Exact sixteenths only: nothing here uses floating point for a size.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { formatInches, formatSize, parseInches, extractSizes, normalizeSizes, sizeKey } from '../functions/_lib/dimensions.mjs';
import * as dictation from '../functions/internal/api/quote-dictation.js';
import { generatePlan } from '../functions/internal/api/build-plan.js';
import { createD1 } from './_lib/d1-sqlite.mjs';

process.removeAllListeners('warning');
const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const pass = (m) => console.log(`PASS: ${m}`);
const lib = await import(new URL('src/lib/size-input.ts', root).href);
const notesLib = await import(new URL('src/lib/quote-notes-lines.ts', root).href);
const { pricing } = await import(new URL('src/data/pricing.ts', root).href);

// 1. Every way a size is written or said comes out the one standard way.
{
  const same = (input, expected) => assert.equal(normalizeSizes(input), expected, input);
  for (const input of [
    '35 1/2 by 47 3/4', '35 1/2 x 47 3/4', '35 1/2x47 3/4', '35-1/2 x 47-3/4', '35.5 by 47.75', '35½ by 47¾', '35 1 / 2 by 47 3 / 4',
    'thirty five and a half by forty seven and three quarters', 'thirty-five and a half by forty-seven and three-quarters',
    '35 and a half by 47 and three quarters', 'thirty five and one half times forty seven and three fourths'.replace('three fourths', 'three quarters'),
  ]) same(input, '35 1/2 x 47 3/4');
  same('36 by 48', '36 x 48'); same('thirty-six by forty-eight', '36 x 48'); same('36x48', '36 x 48'); same('36 inches by 48 inches', '36 x 48');
  same('23 7/8 by 35 3/4', '23 7/8 x 35 3/4'); same('forty-seven and five sixteenths by twenty three and seven eighths', '47 5/16 x 23 7/8');
  same('71 1/4 X 59 5/8', '71 1/4 x 59 5/8'); same('a hundred and ten by forty eight', '110 x 48');
  same('three foot by five foot', '36 x 60'); same('3 foot 6 by 5 foot', '42 x 60'); same('three feet six inches by four feet', '42 x 48');
  same('Kitchen, two double-hungs, 36 by 48, fin. Den 23 7/8 by 35 3/4.', 'Kitchen, two double-hungs, 36 x 48, fin. Den 23 7/8 x 35 3/4.');
  pass('written and spoken sizes all come out as "W x H" with a slash fraction');
}

// 2. What is not a window size is left alone.
{
  for (const input of ['2 by 4 blocking', 'I need 3 by 5 feet of flashing'.replace('3 by 5 feet', '3 by 5'), 'two windows by the door', 'by 48', '36 by', '1500 by 2000', 'call 360 555 0142']) {
    assert.equal(normalizeSizes(input), input, `${input} is not a size`);
  }
  assert.deepEqual(extractSizes('The 2x4 framing, then 36 by 48').map(formatSize), ['36 x 48']);
  pass('lumber, prices, phone numbers and half sentences are not mistaken for sizes');
}

// 3. Exact arithmetic: a number that is not a multiple of 1/16 is rounded and says so, never kept as a float.
{
  assert.equal(formatInches(568), '35 1/2'); assert.equal(formatInches(16), '1'); assert.equal(formatInches(4), '1/4'); assert.equal(formatInches(1), '1/16');
  assert.equal(formatInches(35 * 16 + 6), '35 3/8'); assert.equal(formatInches(0), '0');
  const [exact] = extractSizes('35.375 by 48');
  assert.equal(exact.rounded, false); assert.equal(formatSize(exact), '35 3/8 x 48');
  const [off] = extractSizes('35.3 by 48');
  assert.equal(off.rounded, true, 'a decimal that is not a multiple of 1/16 is flagged');
  assert.equal(formatSize(off), '35 5/16 x 48');
  assert.equal(sizeKey(extractSizes('36 by 48')[0]), sizeKey(extractSizes('thirty six x forty eight')[0]));
  pass('sizes are exact sixteenths, and a rounded one is flagged');
}

// 4. One typed dimension (Measurements and Field mode).
{
  assert.equal(parseInches('35 1/2').sixteenths, 568); assert.equal(parseInches('35-1/2').sixteenths, 568); assert.equal(parseInches('35.5').sixteenths, 568);
  assert.equal(parseInches('thirty five and a half').sixteenths, 568); assert.equal(parseInches(' 36 ').sixteenths, 576); assert.equal(parseInches('3 foot 6').sixteenths, 672);
  assert.equal(parseInches('abc'), null); assert.equal(parseInches('35 1/'), null); assert.equal(parseInches('35 1'), null); assert.equal(parseInches('1/0'), null);
  assert.equal(parseInches('4 1/2'), null, 'by default only window-sized values count');
  assert.equal(lib.readInches('4 1/2'), 4.5, 'a field that holds any measurement (depth, sill) accepts small ones');
  assert.equal(lib.readInches('1 1/4'), 1.25); assert.equal(lib.readInches('35-1/2'), 35.5); assert.equal(lib.readInches('x'), null);
  assert.equal(lib.showInches(35.5), '35 1/2'); assert.equal(lib.showInches(47.75), '47 3/4'); assert.equal(lib.showInches(36), '36'); assert.equal(lib.showInches(''), ''); assert.equal(lib.showInches(undefined), '');
  assert.equal(lib.showInches(35.38), '35.38', 'an older decimal that is not a multiple of 1/16 is shown as saved, not quietly changed');
  assert.equal(lib.showInches(35.375), '35 3/8');
  // Round trip: what is typed is what is stored and what is shown.
  for (const text of ['35 1/2', '47 3/4', '23 7/8', '71 1/4', '59 5/8', '36', '1 1/16']) assert.equal(lib.showInches(lib.readInches(text)), text);
  pass('a typed size is read, stored as exact inches, and shown back the same way');
}

// 5. The dictation endpoint rewrites sizes by code and reads them back.
{
  const audio = new Uint8Array(5000);
  const ctx = (text) => ({ request: new Request('https://windowsbyclearview.com/internal/api/quote-dictation', { method: 'POST', headers: { 'content-type': 'audio/webm' }, body: audio }), env: { AI: { run: async () => ({ text }) }, QUOTES_DB: createD1() } });
  let body = await (await dictation.onRequestPost(ctx('Kitchen. Two double hungs, thirty five and a half by forty seven and three quarters. Den 36-1/4 by 48.'))).json();
  assert.equal(body.text, 'Kitchen. Two double hungs, 35 1/2 x 47 3/4. Den 36 1/4 x 48.');
  assert.deepEqual(body.sizes, ['35 1/2 x 47 3/4', '36 1/4 x 48']);
  assert.equal(body.roundedSizes, 0);
  body = await (await dictation.onRequestPost(ctx('Slider 71.3 by 59'))).json();
  assert.equal(body.roundedSizes, 1, 'a rounded size is reported so the page can ask Mark to say it again');
  body = await (await dictation.onRequestPost(ctx('Window quote notes. Sizes are width by height in inches, with fractions: 35 1/2 by 47 3/4'))).json();
  assert.equal(body.empty, true, 'Whisper repeating its own hint on silence is treated as nothing said');
  const src = read('functions/internal/api/quote-dictation.js');
  assert.match(src, /Sizes are width by height in inches, with fractions/, 'the transcription hint teaches the standard form');
  pass('dictation: sizes are normalised by code, read back, and a repeated hint counts as silence');
}

// 6. The size shows on the quote line and prefills (never confirms) the Build Plan.
{
  const catalog = {
    openings: pricing.openings.map((o) => ({ id: o.id, label: o.label, low: o.low, high: o.high, isDoor: !!o.isDoor, quotePrice: 'quotePrice' in o ? o.quotePrice : null })),
    materials: pricing.materials.map((m) => ({ id: m.id, label: m.label, multiplier: m.multiplier })),
    brands: pricing.brands.map((b) => ({ id: b.id, label: b.label, low: b.low, high: b.high })),
  };
  const line = { type: 'window', openingId: 'double-hung', materialId: 'vinyl', brandId: 'cascade', method: 'fin', quantity: 2, room: 'Kitchen', size: '35 1/2 x 47 3/4', note: '', heard: '' };
  const item = notesLib.draftLineToItem(line, catalog, 'windows');
  assert.equal(item.label, 'Kitchen: Double-hung — Vinyl — Cascade — fin — 35 1/2 x 47 3/4');
  assert.equal(notesLib.draftLineToItem({ ...line, size: '' }, catalog, 'windows').label, 'Kitchen: Double-hung — Vinyl — Cascade — fin');
  const plan = generatePlan({ customer_name: 'Dana', notes: '' }, [{ label: item.label, quantity: 2, description: '' }, { label: 'Slider', quantity: 1, description: '' }]);
  assert.equal(plan.openings.length, 3);
  assert.match(plan.openings[0].dimensions, /^35 1\/2 x 47 3\/4 \(width x height, inches; from the quote line; VERIFY at site\)$/);
  assert.match(plan.openings[1].dimensions, /^35 1\/2 x 47 3\/4/);
  assert.equal(plan.openings[2].dimensions, 'VERIFY at site', 'a line with no size stays VERIFY');
  assert.ok(plan.openings.every((o) => /verify/i.test(o.dimensions)), 'a size from the quote is never treated as verified');
  pass('the quote line shows the size; the Build Plan prefills it and still says VERIFY at site');
}

// 7. The pages take sizes with a slash, not a decimal.
{
  const measure = read('src/pages/internal/tools/measurements.astro');
  assert.ok(!/data-field="width"[^>]*type="number"|type="number"[^>]*data-field="width"/.test(measure), 'Measurements width is not a number input');
  assert.match(measure, /data-field="width" data-size/); assert.match(measure, /data-field="height" data-size/);
  assert.match(measure, /showInches\(opening\.width\)/); assert.match(measure, /bindFractionBar/); assert.match(measure, /data-frac="1\/2"/);
  assert.ok(!/fmt\(w\)|fmt\(h\)/.test(measure), 'the unusual-size warning shows the size the standard way');
  const field = read('src/pages/internal/jobs/field.astro');
  for (const key of ['width', 'height', 'depth', 'sill']) {
    assert.match(field, new RegExp(`data-measure="${key}" data-size type="text"`), `Field mode ${key} is a text field`);
    assert.ok(!new RegExp(`data-measure="${key}"[^>]*type="number"`).test(field), `Field mode ${key} is not a number input`);
  }
  assert.match(field, /readInches\(i\.value\)/); assert.match(field, /showInches\(ev\.measurements/); assert.match(field, /type inches like 35 1\/2/);
  const quote = read('src/pages/internal/quotes/new.astro');
  assert.match(quote, /data-sizes-heard/); assert.match(quote, /Sizes heard \(width x height, inches\)/);
  pass('Measurements and Field mode take and show sizes with a slash fraction; the quote page lists the sizes it heard');
}

console.log('\nAll dimension checks passed.');
