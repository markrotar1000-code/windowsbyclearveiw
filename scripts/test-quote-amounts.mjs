// A quote's money, executed against the real create and edit handlers on real SQLite. The totals are
// recomputed on the server (a browser slip must never become the number on a contract), but until now
// nothing bounded them: a price or quantity typo such as 1e300 was stored and printed as "1e+300", and
// a sum past 2^53 cents silently lost precision. A line or quote over the ceiling is refused with a
// message that names the likely cause; every ordinary quote is unchanged.
import assert from 'node:assert/strict';
import { createD1 } from './_lib/d1-sqlite.mjs';
import { MAX_QUOTE_CENTS, parseQuoteBody } from '../functions/internal/_lib/quotes.mjs';
import * as quotesIndex from '../functions/internal/api/quotes/index.js';

process.removeAllListeners('warning');
const pass = (message) => console.log(`PASS: ${message}`);
const customer = { name: 'Pat Doe', phone: '(360) 555-0100' };
const parse = (items, extra = {}) => parseQuoteBody({ customer, workType: 'windows', items, ...extra });
const line = (quantity, unitPriceCents) => ({ label: 'Window', quantity, unitPriceCents });

assert.equal(typeof MAX_QUOTE_CENTS, 'number', 'the ceiling is exported so the tool and the test agree');
assert.ok(MAX_QUOTE_CENTS >= 10_000_000 && MAX_QUOTE_CENTS < Number.MAX_SAFE_INTEGER / 1000, 'a ceiling far above any real job and far below 2^53');

// 1. Ordinary quotes are untouched, including a large whole-house job and fractional quantities.
const normal = parse([line(12, 105000), line(0.5, 1)]);
assert.equal(normal.error, undefined);
assert.equal(normal.totalCents, 12 * 105000 + 1);
assert.equal(parse([line(1, MAX_QUOTE_CENTS)]).error, undefined, 'exactly the ceiling is allowed');
pass('ordinary quotes and the ceiling itself are accepted');

// 2. The typos that used to be stored.
for (const [name, items] of [
  ['a price of 1e300', [line(1, 1e300)]],
  ['a quantity of 1e15', [line(1e15, 105000)]],
  ['one cent over the ceiling', [line(1, MAX_QUOTE_CENTS + 1)]],
  ['a price with extra zeros', [line(5, 1_050_000_000)]],
]) {
  const result = parse(items);
  assert.ok(result.error, `${name} must be refused`);
  assert.match(result.error, /^Line 1: /, `${name}: the message names the line`);
  assert.match(result.error, /\$5,000,000|typo|check/i, `${name}: the message says what to check`);
}
pass('a line over the ceiling is refused and names the line');

// 3. Many large lines cannot add up past the ceiling either.
const half = Math.floor(MAX_QUOTE_CENTS / 2) + 1;
const summed = parse([line(1, half), line(1, half)]);
assert.ok(summed.error && /total|quote/i.test(summed.error), 'two lines that together pass the ceiling are refused');
assert.equal(parse([line(1, half), line(1, half)], { discountCents: half }).error !== undefined, true, 'a discount does not hide an oversized subtotal');
pass('a subtotal over the ceiling is refused');

// 4. Through the real handler: refused with a 400 and nothing is stored.
const env = { QUOTES_DB: createD1({ schemaFiles: ['functions/api/_data/schema.sql', 'internal/db/schema.sql'] }) };
const post = (items) => quotesIndex.onRequestPost({
  request: new Request('https://windowsbyclearview.com/internal/api/quotes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customer, items }) }),
  env, params: {}, waitUntil() {},
});
const bad = await post([line(1, 1e300)]);
assert.equal(bad.status, 400);
assert.match((await bad.json()).error, /Line 1/);
const count = async () => (await env.QUOTES_DB.prepare('SELECT COUNT(*) AS n FROM quotes').first()).n;
assert.equal(await count(), 0, 'an oversized quote is not stored');
const ok = await post([line(3, 105000)]);
assert.equal(ok.status, 201);
assert.equal(await count(), 1);
pass('the handler refuses an oversized quote and stores a normal one');
console.log('quote amounts: ok');
