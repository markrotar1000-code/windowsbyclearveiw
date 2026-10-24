import assert from 'node:assert/strict';
import { formatSupplierRequest, supplierCsv, supplierMailto, supplierLines, SUPPLIER_LIMIT } from '../src/lib/supplier-list.ts';

const source = { customer: { name: 'PRIVATE CUSTOMER', phone: 'PRIVATE PHONE', address: 'PRIVATE ADDRESS' }, notes: 'PRIVATE INTERNAL NOTES', discount: 12345, total: 98765,
  reference: 'TEST-Q-101', workType: 'windows', message: 'Please confirm delivery options.',
  lines: [{ label: 'Kitchen: Double-hung — Vinyl — Cascade — 35 1/2 x 47 3/4', quantity: 2, unit: 'each', details: 'White frame\nTempered glass: confirm', unitPrice: 4321.98, description: 'PRIVATE DESCRIPTION', unitPriceCents: 432198 }],
};
const before = JSON.stringify(source);
const text = formatSupplierRequest(source);
const csv = supplierCsv(source);
for (const output of [text, csv]) {
  for (const secret of ['PRIVATE', '4321', '432198', '98765', '12345']) assert.ok(!output.includes(secret), `must exclude ${secret}`);
  assert.match(output, /35 1\/2 x 47 3\/4/);
  assert.match(output, /White frame/);
}
assert.match(text, /Quantity: 2 each/);
assert.match(text, /not an order/);
assert.match(text, /Please confirm delivery options/);
assert.equal(JSON.stringify(source), before, 'formatting must not change quote state');
console.log('PASS supplier export uses only selected product fields and leaves quote data unchanged');

for (const quantity of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => supplierLines([{ label: 'Window', quantity }]), /whole quantity/);
assert.throws(() => supplierLines([]), /Choose at least one/);
assert.throws(() => supplierLines([{ label: ' ', quantity: 1 }]), /description/);
assert.throws(() => supplierLines(Array.from({ length: SUPPLIER_LIMIT + 1 }, () => ({ label: 'Window', quantity: 1 }))), /lines or fewer/);
console.log('PASS empty, invalid and oversized lists are refused');

const missing = formatSupplierRequest({ lines: [{ label: 'Picture window', quantity: 1 }] });
assert.match(missing, /Not provided/);
assert.match(missing, /Confirm sizes/);
assert.match(missing, /1 \(as quoted\)/);
assert.ok(!/\b(?:36|48)\b/.test(missing), 'no invented dimensions');
const siding = formatSupplierRequest({ workType: 'siding', lines: [{ label: 'Siding', quantity: 1200, unit: 'sq ft of wall area' }] });
assert.match(siding, /not purchase quantities/);
console.log('PASS missing specifications remain explicit and siding is not a material takeoff');

const formula = supplierCsv({ reference: ' =SUM(1,2)', lines: [{ label: '=HYPERLINK("bad")', quantity: 1, unit: '@unit', details: '-1+2\nnext, "quoted"' }] });
assert.match(formula, /"'=SUM\(1,2\)"/);
assert.match(formula, /"'=HYPERLINK\(""bad""\)"/);
assert.match(formula, /"'@unit"/);
assert.match(formula, /"'-1\+2\nnext, ""quoted"""/);
assert.ok(formula.startsWith('\uFEFF'));
console.log('PASS CSV escapes quotes, multiline details and formula prefixes');

const mail = supplierMailto('Window A\nQty 2\nA&B?', 'Test & ref');
const parsed = new URL(mail);
assert.equal(parsed.protocol, 'mailto:');
assert.equal(parsed.pathname, '', 'no recipient is guessed');
assert.equal(parsed.searchParams.get('body'), 'Window A\nQty 2\nA&B?');
assert.match(parsed.searchParams.get('subject'), /Test & ref/);
assert.equal(supplierMailto('x'.repeat(5000)), null, 'long drafts use copy/download instead of truncating');
assert.equal(supplierMailto('\ud800'), null);
console.log('PASS email draft encodes complete content or falls back without truncation');
