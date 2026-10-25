// Validates address-research results and produces a private parameterized D1 load.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { windowPriority } from '../functions/internal/_lib/skip-trace.mjs';
const directory=process.argv[2]; if (!directory) throw Error('Supply a local research directory containing results-N.json.');
const imported=JSON.parse(readFileSync('data/skip-trace/load.json','utf8')).batch.filter(q=>q.params).map(q=>({id:q.params[0],...JSON.parse(q.params[2])}));
const byId=new Map(imported.map(r=>[r.id,r]));
const rows=readdirSync(directory).filter(p=>/^results-\d+\.json$/.test(p)).sort().flatMap(p=>JSON.parse(readFileSync(path.join(directory,p),'utf8')));
const seen=new Set(); const at=new Date().toISOString(); const batch=[]; const summary={researched:0,yearBuilt:0,higher:0,medium:0,lower:0,excluded:0,unranked:0};
for (const row of rows) {
  const original=byId.get(row.id);
  if (!original || row.address.toUpperCase()!==original.address.toUpperCase() || seen.has(row.id)) throw Error('Unknown, mismatched or duplicate research address.');
  seen.add(row.id);
  if (!Array.isArray(row.sources) || !row.sources.length || !Array.isArray(row.limitations)) throw Error('Missing sources or limitations.');
  for (const source of row.sources) { if (!['http:','https:'].includes(new URL(source.url).protocol) || !Array.isArray(source.facts)) throw Error('Invalid source.'); }
  if (row.yearBuilt!==null && (!Number.isInteger(row.yearBuilt)||row.yearBuilt<1700||row.yearBuilt>new Date().getFullYear())) throw Error('Invalid construction year.');
  row.windowStatus='unknown';
  if (/double.pane/i.test(row.windowEvidence) && !/no (explicit )?window type/i.test(row.windowEvidence)) row.windowStatus='double_pane_documented';
  if (/explicitly advertises newer windows/i.test(row.windowEvidence)) row.windowStatus='replacement_documented';
  if (/vacant land/i.test(row.propertyType || '')) row.excludeReason='Source classifies this parcel as vacant land. Verify current improvements before window targeting.';
  if (/parcel match needs verification/i.test(row.propertyType || '')) row.excludeReason='Conflicting property records share this address. Verify parcel identity before ranking.';
  if (!row.propertyType && !row.yearBuilt) row.excludeReason='A dwelling has not been verified at this address. Verify current parcel improvements before ranking.';
  const priority=windowPriority(row);
  summary.researched++; if (row.yearBuilt!==null) summary.yearBuilt++; summary[priority.tier]++;
  batch.push({sql:'INSERT INTO skip_trace_enrichment (prospect_id,data_json,researched_at) VALUES (?,?,?) ON CONFLICT(prospect_id) DO UPDATE SET data_json=excluded.data_json,researched_at=excluded.researched_at',params:[row.id,JSON.stringify(row),at]});
}
writeFileSync('data/skip-trace/enrichment-load.json',JSON.stringify({batch}));
writeFileSync('data/skip-trace/enrichment-summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
