// Static checks: the Tools, Google tools, Ask activity and Copilot pages use the shared fetch, failure, escape and money helpers.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../src/pages/internal/${file}`, import.meta.url), 'utf8');
const pass = (message) => console.log(`PASS: ${message}`);
const pages = ['tools/index.astro', 'tools/measurements.astro', 'tools/photos.astro', 'google-tools.astro', 'ask-logs.astro', 'copilot.astro'];

// No page keeps its own escape; the three that escape text import the shared one (which also escapes quotes).
for (const file of pages) {
  assert.doesNotMatch(read(file), /(const|function)\s+esc\b/, `${file} defines its own esc`);
}
for (const file of ['tools/index.astro', 'tools/measurements.astro', 'tools/photos.astro']) {
  assert.match(read(file), /import \{[^}]*\besc\b[^}]*\} from '[./]+\/lib\/internal-fetch'/, `${file} imports the shared esc`);
}
pass('no page defines its own esc; tools, measurements and photos import the shared one');

// Pages that talk to the server go through fetchJson.
for (const file of ['tools/index.astro', 'tools/photos.astro', 'google-tools.astro', 'ask-logs.astro', 'copilot.astro']) {
  assert.match(read(file), /\bfetchJson\b/, `${file} uses fetchJson`);
}
pass('server calls use fetchJson');

// Ask activity names an expired sign-in and offers Try again in place.
const ask = read('ask-logs.astro');
assert.match(ask, /fetchJson\('\/internal\/api\/ask-logs'\)/);
assert.match(ask, /loadFailedNode/);
assert.match(ask, /loadFailureMessage\(error/);
assert.doesNotMatch(ask, /await fetch\(/);
pass('Ask activity uses fetchJson and loadFailedNode, passing the session-expired message through');

// Google tools show money with the shared formatter and keep the failure node for connections.
const google = read('google-tools.astro');
assert.match(google, /formatCents\(e\.amount_cents\)/);
assert.doesNotMatch(google, /amount_cents\/100/);
assert.match(google, /loadFailedNode/);
assert.match(google, /loadFailureMessage\(error/);
pass('Google tools use formatCents and the shared failure node');

// The cards other tests own are still there.
const tools = read('tools/index.astro');
assert.match(tools, /\/internal\/api\/setup-check/);
assert.match(tools, /\/internal\/api\/feature-usage/);
pass('Setup check and feature-usage cards untouched');
