// "Find a customer": the search behind the box on the Dashboard and Today, run on real SQLite with the real
// schemas. Names, phones and addresses are made up.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createD1 } from './_lib/d1-sqlite.mjs';
import { cleanQuery, findRecords, MAX_QUERY } from '../functions/internal/_lib/find.mjs';
import * as api from '../functions/internal/api/search.js';
import { ensureJobsSchema } from '../functions/internal/_lib/jobs-schema.mjs';

process.removeAllListeners('warning');
const pass = (m) => console.log(`PASS: ${m}`);
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── query cleaning ───────────────────────────────────────────────────────────────────────────────
assert.equal(cleanQuery('  Pat   Doe '), 'Pat Doe');
assert.equal(cleanQuery('p'), '', 'one character is not a search');
assert.equal(cleanQuery(null), '');
assert.equal(cleanQuery('x'.repeat(500)).length, MAX_QUERY, 'a very long query is capped');
pass('queries are tidied, too-short ones are empty, long ones are capped');

// ── data ─────────────────────────────────────────────────────────────────────────────────────────
const db = createD1({ schemaFiles: ['functions/api/_data/schema.sql', 'internal/db/schema.sql'] });
await ensureJobsSchema(db);
const D = db.raw;
const now = '2026-10-20T12:00:00.000Z';
D.prepare('INSERT INTO leads (created_at,name,phone,email,city,role) VALUES (?,?,?,?,?,?)').run(now, 'Pat Doe', '(360) 555-0100', 'pat@example.com', 'Camas', 'Homeowner');
D.prepare('INSERT INTO leads (created_at,name,phone,email,city,role) VALUES (?,?,?,?,?,?)').run('2026-10-19T12:00:00.000Z', 'Sam 100% Builder_Co', '503-555-0111', 'sam@example.com', 'Vancouver', 'Builder / GC');
D.prepare("INSERT INTO quotes (id,created_at,updated_at,status,customer_name,customer_phone,customer_city,customer_address,total_cents) VALUES (?,?,?,?,?,?,?,?,?)").run('Q-20261020-AAAA', now, now, 'finalized', 'Pat Doe', '(360) 555-0100', 'Camas', '1 Main St', 553518);
D.prepare("INSERT INTO quotes (id,created_at,updated_at,status,customer_name,customer_phone,customer_city,customer_address,total_cents) VALUES (?,?,?,?,?,?,?,?,?)").run('Q-20261018-BBBB', '2026-10-18T12:00:00.000Z', now, 'draft', 'Dana Ruiz', '3605550123', 'Washougal', '22 Oak Ave', 100000);
D.prepare("INSERT INTO jobs (id,created_at,updated_at,quote_id,status,customer_name,customer_phone,customer_city,customer_address,scheduled_date) VALUES (?,?,?,?,?,?,?,?,?,?)").run('J-20261021-CCCC', now, now, 'Q-20261020-AAAA', 'scheduled', 'Pat Doe', '(360) 555-0100', 'Camas', '1 Main St', '2026-10-22');

const names = (r) => ({ leads: r.leads.map((x) => x.name), quotes: r.quotes.map((x) => x.id), jobs: r.jobs.map((x) => x.id) });

// ── matching ─────────────────────────────────────────────────────────────────────────────────────
let r = await findRecords(db, 'pat');
assert.deepEqual(names(r), { leads: ['Pat Doe'], quotes: ['Q-20261020-AAAA'], jobs: ['J-20261021-CCCC'] }, 'a first name finds the lead, the quote and the job');
assert.equal(r.quotes[0].totalCents, 553518);
assert.equal(r.jobs[0].scheduledDate, '2026-10-22');

r = await findRecords(db, '(360) 555-0100');
assert.equal(r.leads.length, 1, 'a phone typed with punctuation finds a number stored with it');
r = await findRecords(db, '3605550123');
assert.deepEqual(names(r).quotes, ['Q-20261018-BBBB'], 'digits find a number stored without punctuation');
r = await findRecords(db, '555 0111');
assert.deepEqual(names(r).leads, ['Sam 100% Builder_Co'], 'a partial number with a space still matches');
r = await findRecords(db, 'Q-20261018');
assert.deepEqual(names(r).quotes, ['Q-20261018-BBBB'], 'a quote number finds the quote');
r = await findRecords(db, 'oak ave');
assert.deepEqual(names(r).quotes, ['Q-20261018-BBBB'], 'an address finds the quote');
r = await findRecords(db, 'washougal');
assert.equal(r.quotes.length, 1, 'a city matches');
r = await findRecords(db, 'PAT@EXAMPLE');
assert.equal(r.leads.length, 1, 'email, case-insensitive');
pass('names, phones in any format, quote numbers, addresses, cities and emails all find their records');

// ── wildcards are literal text ───────────────────────────────────────────────────────────────────
assert.deepEqual(names(await findRecords(db, '100%')).leads, ['Sam 100% Builder_Co'], 'a percent sign is a character, not a wildcard');
assert.deepEqual((await findRecords(db, '%%')).leads, [], 'two percent signs match nothing');
assert.deepEqual(names(await findRecords(db, 'Builder_Co')).leads, ['Sam 100% Builder_Co']);
assert.deepEqual((await findRecords(db, 'Builder_Xo')).leads, [], 'an underscore is a character too');
assert.deepEqual(await findRecords(db, "x'; DROP TABLE leads; --"), { query: "x'; DROP TABLE leads; --", leads: [], quotes: [], jobs: [] }, 'quotes in the text are bound, not run');
assert.equal(D.prepare('SELECT COUNT(*) n FROM leads').get().n, 2, 'nothing was dropped');
pass('percent, underscore and quotes are plain text');

// ── a name that starts with the text comes before one that only contains it ──────────────────────
D.prepare('INSERT INTO leads (created_at,name) VALUES (?,?)').run('2026-10-21T12:00:00.000Z', 'Aspatia Newer');
r = await findRecords(db, 'pat');
assert.deepEqual(names(r).leads.slice(0, 2), ['Pat Doe', 'Aspatia Newer'], 'the lead named Pat is first even though a newer lead contains "pat"');
D.prepare("DELETE FROM leads WHERE name = 'Aspatia Newer'").run();
pass('names that start with the text come first');

// ── limits, newest first, missing tables ─────────────────────────────────────────────────────────
for (let i = 0; i < 10; i += 1) D.prepare('INSERT INTO leads (created_at,name) VALUES (?,?)').run(`2026-09-${String(10 + i).padStart(2, '0')}T00:00:00.000Z`, `Many ${i}`);
r = await findRecords(db, 'many');
assert.equal(r.leads.length, 6, 'six per kind at most');
assert.equal(r.leads[0].name, 'Many 9', 'newest first');
const bare = createD1();
assert.deepEqual(await findRecords(bare, 'pat'), { query: 'pat', leads: [], quotes: [], jobs: [] }, 'a database with no tables reads as no results');
assert.deepEqual(await findRecords(db, 'p'), { query: '', leads: [], quotes: [], jobs: [] });
pass('six per kind, newest first, and a database without these tables is just empty');

// ── endpoint ─────────────────────────────────────────────────────────────────────────────────────
const ask = (q, env = { QUOTES_DB: db }, method = 'GET') => api.onRequest({ request: new Request(`https://example.test/internal/api/search${q}`, { method }), env });
let res = await ask('?q=pat');
assert.equal(res.status, 200);
assert.equal(res.headers.get('cache-control'), 'private, no-store');
assert.equal((await res.json()).quotes[0].id, 'Q-20261020-AAAA');
assert.equal((await ask('')).status, 200);
assert.deepEqual((await (await ask('?q=pat', {})).json()).status, 'unavailable', 'no database binding is reported, not thrown');
assert.equal((await ask('?q=pat', { QUOTES_DB: db }, 'POST')).status, 405);
assert.equal((await ask('?q=pat', { QUOTES_DB: db }, 'POST')).headers.get('allow'), 'GET, HEAD');
pass('the endpoint answers, is uncached, read only, and tolerates a missing database');

// ── page wiring ──────────────────────────────────────────────────────────────────────────────────
const bar = read('src/components/internal/FindBar.astro');
assert.ok(!/innerHTML/.test(bar), 'results are built as nodes');
assert.ok(/\/internal\/api\/search\?q=/.test(bar) && /AbortController/.test(bar), 'the box calls the endpoint and drops stale requests');
assert.ok(/role="search"/.test(bar) && /aria-live="polite"/.test(bar), 'the box is a search landmark and announces its results');
assert.ok(/event\.key !== '\/'/.test(bar), 'the / key jumps to the box');
for (const page of ['src/pages/internal/index.astro', 'src/pages/internal/today.astro']) assert.ok(read(page).includes('<FindBar'), `${page} has the box`);
assert.ok(/get\('q'\)/.test(read('src/pages/internal/leads.astro')), 'a lead result opens Leads with the search filled in');
pass('the box is on the Dashboard and Today, builds nodes only, and Leads accepts ?q=');

console.log('Find checks passed.');
