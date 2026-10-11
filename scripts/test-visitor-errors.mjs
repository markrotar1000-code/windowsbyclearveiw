// A visitor must never be shown the browser's own network-error text ("Failed to fetch", "Load failed").
//
// Found 2026-10-10 by cutting the connection during a submit in a real browser: the estimate form (the one
// page that earns the business) printed "Failed to fetch" under the button, with no hint to call. The
// quote-signing page did the same. `visitorMessage` (src/lib/visitor-errors.ts) is the rule; this test pins
// it and keeps any public file that reads an Error's message from skipping it.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { visitorMessage } = await import(pathToFileURL(`${root}src/lib/visitor-errors.ts`).href);

// Our server's own text is shown; the browser's network text and anything else is replaced.
assert.equal(visitorMessage(new Error('Fix the highlighted fields.'), 'fallback'), 'Fix the highlighted fields.');
for (const browserText of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.']) {
  assert.equal(visitorMessage(new TypeError(browserText), 'fallback'), 'fallback', `${browserText} must not reach a visitor`);
}
assert.equal(visitorMessage(new Error('   '), 'fallback'), 'fallback', 'a blank message is no message');
assert.equal(visitorMessage('string', 'fallback'), 'fallback');
assert.equal(visitorMessage(undefined, 'fallback'), 'fallback');
assert.equal(visitorMessage(null, 'fallback'), 'fallback');

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(astro|ts|mjs)$/.test(name)) yield path;
  }
}
const rel = (path) => relative(root, path).replaceAll('\\', '/');
// Pages Mark uses from the Command Center show errors to him and are not covered by this rule.
const internal = (path) => /^src\/(pages\/internal\/|layouts\/InternalLayout|scripts\/internal-pwa|lib\/photo-sync)/.test(path);

const offenders = [];
let scanned = 0;
for (const file of walk(join(root, 'src'))) {
  const path = rel(file);
  if (internal(path) || path === 'src/lib/visitor-errors.ts') continue;
  const text = readFileSync(file, 'utf8');
  // A file that reads an Error's text, or already routes it through the helper, is in scope.
  if (!/instanceof Error|\bvisitorMessage\b|\b(?:error|err|e)\.message\b/.test(text)) continue;
  scanned++;
  if (!/visitorMessage|instanceof TypeError/.test(text)) offenders.push(path);
}
assert.deepEqual(offenders, [], 'These public files read an Error message without handling the browser network TypeError. Use visitorMessage() from src/lib/visitor-errors.ts.');
assert.ok(scanned >= 4, `expected the estimate form, signing page, Ask page and callback form to be scanned, got ${scanned}`);

// The three customer forms that call our API must use the helper itself.
for (const path of ['src/components/EstimateForm.astro', 'src/pages/sign.astro', 'src/scripts/ask-callback.ts']) {
  assert.match(readFileSync(join(root, path), 'utf8'), /visitorMessage\(error,/, `${path} should pass its catch error through visitorMessage`);
}
console.log(`PASS  visitor errors (${scanned} public files scanned)`);
