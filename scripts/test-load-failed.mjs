// Command Center screens must say so when their data does not arrive.
//
// Found 2026-10-18 by running every /internal page in a real browser with the API answering 500 and then
// with the connection dropped (scripts/audit-command-center.mjs, "failure pass"): 13 page views were still
// printing "Loading…" or "Checking…" 1.5 s later. Today, the home screen, kept "Loading…" in both panels
// with its only message at the very bottom of the page; the quote screen never left "Loading…" with no
// signal (an unhandled fetch rejection); the approval screen and Google tools kept every placeholder. This
// pins the pieces the fix is made of; the browser pass is the proof that no page regressed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const pass = (message) => console.log(`PASS: ${message}`);
const { loadFailureMessage, NO_SIGNAL_MESSAGE } = await import(`${root}/src/lib/load-failed.ts`);

// 1. The browser's own network wording never reaches Mark; a server sentence does.
for (const raw of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.', 'Network request failed', '']) {
  assert.equal(loadFailureMessage(new Error(raw)), NO_SIGNAL_MESSAGE, `"${raw}" becomes the no-signal sentence`);
}
assert.equal(loadFailureMessage(undefined), NO_SIGNAL_MESSAGE);
assert.equal(loadFailureMessage(new Error('No quote with that id.')), 'No quote with that id.');
assert.equal(loadFailureMessage(new Error(' '), 'custom'), 'custom');
pass('a dropped connection reads as one plain sentence; a server message is kept');

// 2. Each fixed screen handles the failure where the placeholder is.
const today = read('src/pages/internal/today.astro');
assert.match(today, /loadFailedNode\(message, ?load\)/, 'Today replaces both "Loading…" panels with a message and a retry');
const quoteView = read('src/pages/internal/quotes/view.astro');
assert.match(quoteView, /try \{\s*response = await fetch\(`\/internal\/api\/quotes\//, 'the quote screen survives a dropped connection');
const approval = read('src/pages/internal/quotes/build-plan-approval.astro');
assert.match(approval, /Quality checks did not load/, 'the approval screen clears its "Loading quality checks…" line');
const google = read('src/pages/internal/google-tools.astro');
assert.match(google, /el\.textContent='Not checked'/, 'Google tools stops saying "Checking connection…"');
pass('Today, the quote screen, the approval screen and Google tools each leave "Loading…" on failure');

// 3. The layout: a failed page no longer keeps a "Loading…" subtitle; one switch honours reduced motion.
const layout = read('src/layouts/InternalLayout.astro');
assert.match(layout, /function settleLoadingSubtitles\(\)/);
assert.match(layout, /new MutationObserver\(settleLoadingSubtitles\)/);
assert.ok(layout.includes('.internal :global(*)') && layout.includes('transition-duration:.01ms!important'), 'reduced motion switches off every transition and animation under .internal');
assert.match(layout, /@keyframes internal-settle/);
pass('the layout settles stale subtitles and has one reduced-motion switch');
console.log('load failed: ok');
