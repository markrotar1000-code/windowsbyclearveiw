// Static checks for the Jobs, Schedule and Payments pages: they share the Command Center fetch, escape and
// failure helpers instead of keeping their own copies, and Schedule never reads a body before checking r.ok.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../src/pages/internal/${path}`, import.meta.url), 'utf8');
const pages = ['jobs/index.astro', 'jobs/view.astro', 'jobs/field.astro', 'jobs/closeout.astro', 'jobs/prepare.astro', 'schedule.astro', 'payments.astro'];
// An escape written by hand: a throwaway div read back through innerHTML, or a lone .replace(/</g, ...).
const adHocEscape = /createElement\('div'\)[\s\S]{0,120}innerHTML\.replace|replace\(\/<\/g/;

for (const path of pages) {
  const source = read(path);
  assert.match(source, /from '(\.\.\/)+lib\/internal-fetch'/, `${path} should import the shared fetchJson/esc`);
  assert.match(source, /fetchJson\(/, `${path} should load through fetchJson`);
  assert.doesNotMatch(source, adHocEscape, `${path} should not keep its own escape`);
  assert.doesNotMatch(source, /const esc\s*=/, `${path} should not define its own esc`);
}

for (const path of ['jobs/index.astro', 'schedule.astro', 'payments.astro']) {
  assert.match(read(path), /loadFailedNode\(/, `${path} should show a failed load in place with Try again`);
}
for (const path of ['jobs/view.astro', 'jobs/field.astro', 'jobs/closeout.astro', 'jobs/prepare.astro']) {
  const source = read(path);
  assert.match(source, /loadFailedNode\(/, `${path} should offer Try again when the page cannot load`);
  assert.match(source, /failBox\(loadFailureMessage\(/, `${path} should route load failures through failBox`);
}

// Schedule: a JSON body is never read before the response is known to be good (that showed "Unexpected token <").
const schedule = read('schedule.astro');
assert.doesNotMatch(schedule, /\br\.json\(\)/, 'schedule should not call r.json() directly');
assert.doesNotMatch(schedule, /await fetch\(/, 'schedule should not use a bare fetch');

// Money goes through the shared formatter on the pages that show it.
for (const path of ['jobs/index.astro', 'jobs/view.astro', 'jobs/prepare.astro', 'payments.astro']) {
  assert.match(read(path), /from '(\.\.\/)+lib\/money'/, `${path} should format money with the shared helper`);
}

// Payments: the append-only history and the paid-to-date save are still there.
const payments = read('payments.astro');
assert.match(payments, /historyHtml/, 'payments should keep its payment history');
assert.match(payments, /method:'PATCH'/, 'payments should keep saving through PATCH');

// Field mode keeps its offline photo and evidence logic.
const field = read('jobs/field.astro');
assert.match(field, /openPhotoDb/, 'field should keep the offline photo database');

console.log('pages-jobs checks passed');
