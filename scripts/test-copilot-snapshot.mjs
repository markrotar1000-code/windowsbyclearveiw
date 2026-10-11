// The Copilot's "Summarize my day" counts must agree with the dashboard's.
//
// Found 2026-10-10: the snapshot compared stored ISO timestamps ("2026-10-10T13:00:00.000Z") with SQLite's
// datetime('now') ("2026-10-10 15:00:00"). As text, "T" sorts after " ", so a follow-up due two hours ago was
// not "overdue" until the UTC date changed, and the leads window started up to a day early. Runs the real
// query against a real SQLite engine with the clock pinned.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createD1 } from './_lib/d1-sqlite.mjs';
import { copilotSnapshot } from '../functions/internal/_lib/copilot-snapshot.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const db = createD1();
db.raw.exec(`
  CREATE TABLE leads (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL);
  CREATE TABLE quotes (id TEXT PRIMARY KEY, status TEXT NOT NULL);
  CREATE TABLE follow_up_tasks (id INTEGER PRIMARY KEY, status TEXT NOT NULL, due_at TEXT);
  CREATE TABLE jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL);
`);
const now = new Date('2026-10-10T15:00:00.000Z'); // Saturday 8:00 am Pacific

const task = db.raw.prepare('INSERT INTO follow_up_tasks (status, due_at) VALUES (?, ?)');
for (const [status, dueAt] of [
  ['open', '2026-10-10T13:00:00.000Z'], // two hours ago, same UTC date: overdue (the old query missed it)
  ['open', '2026-10-10T14:59:59.999Z'], // one millisecond ago: overdue
  ['open', '2026-10-09T23:00:00.000Z'], // yesterday: overdue
  ['open', '2026-10-10T15:00:00.000Z'], // exactly now: not yet overdue
  ['open', '2026-10-10T16:00:00.000Z'], // in an hour: not overdue
  ['open', null], //                       no due date: not overdue
  ['done', '2026-10-01T00:00:00.000Z'], // finished: not counted at all
]) task.run(status, dueAt);

const lead = db.raw.prepare('INSERT INTO leads (created_at) VALUES (?)');
for (const createdAt of [
  '2026-10-03T14:59:59.999Z', // a millisecond before the 7-day window (same UTC date as its start): outside
  '2026-10-03T15:00:00.000Z', // exactly 7 days ago: inside
  '2026-10-09T08:00:00.000Z', // yesterday: inside
  '2026-10-10T14:00:00.000Z', // an hour ago: inside
  '2026-09-01T12:00:00.000Z', // last month: outside
]) lead.run(createdAt);

db.raw.exec(`
  INSERT INTO quotes VALUES ('Q1','draft'), ('Q2','draft'), ('Q3','finalized');
  INSERT INTO jobs VALUES ('J1','ready'), ('J2','in-progress'), ('J3','completed'), ('J4','cancelled');
`);

const snapshot = await copilotSnapshot(db, now);
assert.deepEqual({ ...snapshot }, {
  new_leads: 3,
  draft_quotes: 2,
  finalized_quotes: 1,
  open_tasks: 6,
  overdue_tasks: 3,
  active_jobs: 2,
});

// With no clock passed it uses the real one and must still run.
assert.equal(typeof (await copilotSnapshot(db)).overdue_tasks, 'number');

// No code may compare a stored timestamp with SQLite's own clock again.
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(js|mjs)$/.test(name)) yield path;
  }
}
const offenders = [];
for (const file of walk(join(root, 'functions'))) {
  const text = readFileSync(file, 'utf8');
  if (/\b[a-z_]+_(?:at|date)\b\s*(?:<|>|<=|>=|=)\s*(?:datetime|date|strftime)\s*\(/i.test(text)) offenders.push(relative(root, file));
}
assert.deepEqual(offenders, [], "Compare stored ISO timestamps with an ISO bound parameter, not datetime('now'): 'T' sorts after ' ' (see functions/internal/_lib/copilot-snapshot.mjs).");

console.log('PASS  copilot snapshot (overdue and 7-day counts agree with the dashboard)');
