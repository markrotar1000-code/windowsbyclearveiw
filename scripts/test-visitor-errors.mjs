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
const { visitorMessage, fallbackAnswer } = await import(pathToFileURL(`${root}src/lib/visitor-errors.ts`).href);

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

// Found 2026-10-11: when the model behind /ask answers 503, the body carries the fallback answer (the phone
// number and the estimate link). The page threw on every non-OK response and showed "Something went wrong."
// instead, so the one moment the assistant is down was the moment a visitor was not told how to reach us.
assert.equal(fallbackAnswer({ answer: 'Call us at (564) 208-0801.' }), 'Call us at (564) 208-0801.');
for (const none of [{ error: 'Too many' }, { answer: '' }, { answer: '   ' }, { answer: 42 }, {}, null, undefined, 'text']) {
  assert.equal(fallbackAnswer(none), null, `${JSON.stringify(none)} carries no fallback answer`);
}
const askPage = readFileSync(join(root, 'src/pages/ask.astro'), 'utf8');
assert.match(askPage, /import \{ fallbackAnswer \} from '\.\.\/lib\/visitor-errors'/, 'the Ask page must import fallbackAnswer');
assert.ok(askPage.includes("if(!r.ok&&!fallbackAnswer(result))throw new Error(result.error||'Something went wrong.')"), 'the Ask page must show a failed reply\'s fallback answer instead of throwing on it');
// The server side of that contract: every 503 from the chat endpoint carries the fallback answer.
const chat = readFileSync(join(root, 'functions/ask/api/chat.js'), 'utf8');
const failures = [...chat.matchAll(/json\(\{([^}]*)\},503\)/g)];
assert.ok(failures.length >= 3, `expected the chat endpoint's 503 responses, found ${failures.length}`);
for (const [, body] of failures) assert.ok(/answer:UNAVAILABLE_ANSWER/.test(body), `a 503 from /ask/api/chat must carry answer: UNAVAILABLE_ANSWER, found {${body.slice(0, 60)}}`);

console.log(`PASS  visitor errors (${scanned} public files scanned)`);
