// The daily screens (Dashboard, Today, Leads, Follow-up, Lead Analyzer, Find bar) share the Command Center
// helpers instead of keeping their own copies, and the Dashboard API counts each open follow-up once.
//
// Rule under test: an open task is "overdue" when it was due before this moment (the same test the pages
// use to mark a row overdue), and "due today" when it is due from this moment to the end of the Pacific
// business day. A task due earlier today that is still open is overdue only. Overdue wins.
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as dashboard from '../functions/internal/api/dashboard.js';

const pass = (message) => console.log(`PASS: ${message}`);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// ── Static: shared helpers are used, local copies are gone ──
const pages = {
  today: 'src/pages/internal/today.astro',
  index: 'src/pages/internal/index.astro',
  leads: 'src/pages/internal/leads.astro',
  followUp: 'src/pages/internal/follow-up.astro',
  analyze: 'src/pages/internal/leads/analyze.astro',
  find: 'src/components/internal/FindBar.astro',
};
for (const [name, path] of Object.entries(pages)) {
  const source = read(path);
  assert.match(source, /from '(\.\.\/)+lib\/internal-fetch'/, `${name} imports the shared fetch helper`);
  assert.match(source, /fetchJson(<\w+>)?\(/, `${name} loads through fetchJson`);
  assert.match(source, /loadFailedNode\(/, `${name} shows an in-place Try again on failure`);
  assert.match(source, /from '(\.\.\/)+lib\/load-failed'/, `${name} imports the shared load-failed helper`);
  assert.doesNotMatch(source, /(const|let|function)\s+(esc|escapeHtml)\b/, `${name} has no local escape function`);
  assert.doesNotMatch(source, /createElement\('div'\);\s*d\.textContent[^;]*;\s*return d\.innerHTML/, `${name} has no hand-copied escape`);
  assert.doesNotMatch(source, /Intl\.NumberFormat\([^)]*currency/, `${name} has no hand-rolled money formatter`);
}
for (const name of ['today', 'index', 'leads', 'followUp', 'analyze']) {
  assert.match(read(pages[name]), /\besc\b/, `${name} escapes with the shared esc`);
}
for (const name of ['today', 'index']) {
  assert.match(read(pages[name]), /formatCents/, `${name} formats money with the shared helper`);
}
assert.match(read(pages.find), /formatCents/, 'the Find bar formats money with the shared helper');
// Reads go through fetchJson. The raw fetches left are writes (Done buttons, Follow-up's create form) that keep their own wording.
for (const [name, path] of Object.entries(pages)) {
  const raw = read(path).match(/\bfetch\(/g) || [];
  const wrapped = read(path).match(/fetchJson(<\w+>)?\(/g) || [];
  assert.ok(wrapped.length > 0, `${name} uses fetchJson`);
  const writes = { today: 1, index: 1, followUp: 2 }[name] || 0; // Done / create: pinned by test:recent-fixes and test:command-center
  assert.ok(raw.length <= writes, `${name} has no unwrapped read (found ${raw.length} raw fetches, ${writes} allowed)`);
}
pass('daily pages use fetchJson, loadFailedNode, the shared esc and the shared money helper');

// ── Dashboard: each open follow-up is counted once ──
const CLOCK = '2026-10-10T19:00:00.000Z'; // Saturday noon Pacific; the Pacific day runs 07:00Z to 07:00Z next day
const db = createD1({ schemaFiles: ['functions/api/_data/schema.sql', 'internal/db/schema.sql'] });
const env = { QUOTES_DB: db };
mock.timers.enable({ apis: ['Date'], now: new Date(CLOCK) });
try {
  // First call creates the follow-up table (and everything else the dashboard needs).
  assert.equal((await dashboard.onRequestGet({ env, request: new Request('https://x.test/internal/api/dashboard') })).status, 200);
  const insert = db.raw.prepare(`INSERT INTO follow_up_tasks (created_at, updated_at, title, due_at, status) VALUES (?, ?, ?, ?, ?)`);
  const tasks = [
    ['due 5am Pacific today, still open', '2026-10-10T12:00:00.000Z', 'open'], // before now: overdue only
    ['due exactly now', CLOCK, 'open'], //                                       not yet overdue: today only
    ['due this afternoon', '2026-10-10T22:00:00.000Z', 'open'], //               today only
    ['due last minute of today', '2026-10-11T06:59:59.999Z', 'open'], //          today only
    ['due midnight tomorrow', '2026-10-11T07:00:00.000Z', 'open'], //             neither
    ['due yesterday', '2026-10-09T20:00:00.000Z', 'open'], //                     overdue only
    ['no due date', null, 'open'], //                                            neither
    ['done earlier today', '2026-10-10T08:00:00.000Z', 'done'], //                not counted
  ];
  for (const [title, dueAt, status] of tasks) insert.run(CLOCK, CLOCK, title, dueAt, status);

  const response = await dashboard.onRequestGet({ env, request: new Request('https://x.test/internal/api/dashboard') });
  const { counts } = await response.json();
  assert.equal(Number(counts.open_tasks), 7);
  assert.equal(Number(counts.tasks_overdue), 2, 'overdue: due before now');
  assert.equal(Number(counts.tasks_today), 3, 'due today: due from now to the end of the Pacific day');
  assert.equal(Number(counts.tasks_today) + Number(counts.tasks_overdue), 5, 'no task is counted in both');

  // Every open task falls in at most one bucket, checked row by row against the same boundaries.
  const now = CLOCK;
  const end = '2026-10-11T07:00:00.000Z';
  for (const row of db.raw.prepare(`SELECT title, due_at FROM follow_up_tasks WHERE status = 'open' AND due_at IS NOT NULL`).all()) {
    const overdue = row.due_at < now;
    const today = row.due_at >= now && row.due_at < end;
    assert.ok(!(overdue && today), `"${row.title}" is in at most one list`);
  }
  pass('dashboard: a task due earlier today that is still open is overdue only (overdue wins); due-today starts at now');
} finally {
  mock.timers.reset();
}
