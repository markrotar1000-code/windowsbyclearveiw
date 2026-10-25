// Local private loader. Does not contact DataSkip or write to a database.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseCsv } from './supplier-permits/lib.mjs';
import { SKIP_DDL, normalizeSkipRow, reviewGroup } from '../functions/internal/_lib/skip-trace.mjs';
const input = process.argv[2];
const batch = process.argv[3];
if (!input || !/^[a-zA-Z0-9_-]{1,80}$/.test(batch || '')) throw Error('Usage: node scripts/build-skip-trace.mjs input.csv batch-name');
const rows = parseCsv(readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
if (!rows.length || rows.length > 1000) throw Error('Expected 1–1000 prospect rows.');
const at = new Date().toISOString();
const seen = new Set();
const queries = SKIP_DDL.map(sql => ({ sql }));
const normalized = [];
for (const row of rows) {
  const data = normalizeSkipRow(row);
  const id = createHash('sha256').update([data.address,data.city,data.state,data.zip].join('|').toUpperCase().replace(/[^A-Z0-9|]/g,'')).digest('hex').slice(0,24);
  if (seen.has(id)) throw Error('Duplicate property in import. Review before loading.');
  seen.add(id); normalized.push(data);
  // Re-import refreshes research only, never overwrites status, notes or due dates.
  queries.push({ sql: `INSERT INTO skip_trace_prospects (id,batch,data_json,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET batch=excluded.batch,data_json=excluded.data_json,version=skip_trace_prospects.version+1,updated_at=excluded.updated_at`, params: [id,batch,JSON.stringify(data),at] });
}
const summary = { records: normalized.length, emailRecords: normalized.filter(r=>r.emails.length).length, phoneEntries: normalized.flatMap(r=>r.phones).length, dncEntries: normalized.flatMap(r=>r.phones).filter(p=>p.dnc).length, holdRecords: normalized.filter(r=>reviewGroup(r)==='hold').length };
mkdirSync('data/skip-trace', { recursive:true });
writeFileSync('data/skip-trace/load.json',JSON.stringify({batch:queries}));
writeFileSync('data/skip-trace/summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
