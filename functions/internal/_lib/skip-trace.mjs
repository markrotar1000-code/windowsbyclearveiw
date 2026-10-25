// Private prospect research; never mixed into inbound estimate conversions.
export const SKIP_DDL = [
  `CREATE TABLE IF NOT EXISTS skip_trace_prospects (id TEXT PRIMARY KEY, batch TEXT NOT NULL, data_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', notes TEXT NOT NULL DEFAULT '', follow_up TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS skip_trace_history (id INTEGER PRIMARY KEY AUTOINCREMENT, prospect_id TEXT NOT NULL, status TEXT NOT NULL, notes TEXT NOT NULL, follow_up TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS skip_trace_enrichment (prospect_id TEXT PRIMARY KEY, data_json TEXT NOT NULL, researched_at TEXT NOT NULL)`,
];
export const STATUSES = ['new', 'researching', 'attempted', 'connected', 'interested', 'not_interested', 'do_not_contact'];
export const clean = (v) => String(v ?? '').trim();
const flagged = (v) => ['true', 'yes', '1', 'dnc'].includes(clean(v).toLowerCase());
export function normalizeSkipRow(row) {
  const address = clean(row.MATCHED_PROPERTY_ADDRESS || row.YOUR_DATA_address);
  const city = clean(row.MATCHED_PROPERTY_CITY || row.YOUR_DATA_city);
  const state = clean(row.MATCHED_PROPERTY_STATE || row.YOUR_DATA_state);
  const zip = clean(row.MATCHED_PROPERTY_ZIP || row.YOUR_DATA_zip);
  if (!address || !city || !state || !zip) throw new Error('Missing property address.');
  const phones = [];
  for (const type of ['MOBILE', 'LANDLINE']) for (let i = 1; i <= 10; i++) {
    const raw = clean(row[`${type}_PHONE_${i}`]);
    if (!raw) continue;
    let number = raw.replace(/\D/g, '');
    if (number.length === 11 && number.startsWith('1')) number = number.slice(1);
    const flag = clean(row[`${type}_PHONE_${i}_DNC`]);
    phones.push({ number, type: type.toLowerCase(), flag, dnc: flagged(flag), valid: /^[2-9]\d{2}[2-9]\d{6}$/.test(number) });
  }
  return {
    address, city, state, zip, name: clean(row.FULL_NAME || row.OWNER_NAME), ownerName: clean(row.OWNER_NAME), match: clean(row.MATCH_STATUS),
    mailing: [row.MAILING_ADDRESS, row.MAILING_CITY, row.MAILING_STATE, row.MAILING_ZIP].map(clean).filter(Boolean).join(', '),
    phones, emails: [...new Set(Array.from({ length: 28 }, (_, i) => clean(row[`EMAIL_${i + 1}`])).filter(Boolean))],
    flags: { deceased: flagged(row.DECEASED), litigator: flagged(row.LITIGATOR), tcpaDnc: flagged(row.TCPA_DNC) },
  };
}
export function reviewGroup(data) {
  return Object.values(data.flags).some(Boolean) || !data.phones.some(p => p.valid && !p.dnc) ? 'hold' : 'review';
}
// ClearView's business cutoff is inclusive; preserve source/history but exclude from prospecting.
export function propertyEligibility(research, year = new Date().getFullYear()) {
  const built = research?.yearBuilt;
  if (Number.isInteger(built) && built >= 1700 && built <= 1978) return { status: 'excluded', reason: 'Built in 1978 or earlier: outside ClearView service scope.' };
  if (research?.excludeReason) return { status: 'hold', reason: research.excludeReason };
  if (!Number.isInteger(built) || built < 1979 || built > year || !['high', 'medium'].includes(research?.confidence)) return { status: 'hold', reason: 'Verify a build year of 1979 or later before outreach.' };
  return { status: 'eligible', reason: `Built ${built}: meets the 1979-or-later property cutoff. Phone and owner checks still required.` };
}
// Research priority, not a probability or diagnosis. Home age cannot establish window age.
export function windowPriority(research, year = new Date().getFullYear()) {
  const eligibility = propertyEligibility(research, year);
  if (eligibility.status === 'excluded') return { score: null, tier: 'excluded', reasons: [eligibility.reason] };
  if (!research || research.confidence === 'unverified') return { score: null, tier: 'unranked', reasons: ['Property facts not verified.'] };
  if (research.excludeReason) return { score: null, tier: 'excluded', reasons: [research.excludeReason] };
  const built = research.yearBuilt;
  const age = Number.isInteger(built) && built >= 1700 && built <= year ? year - built : null;
  const reasons = [];
  let score = age === null ? null : age >= 40 ? 60 : age >= 25 ? 45 : age >= 15 ? 30 : 10;
  if (age !== null) reasons.push(`Built ${built}: about ${age} years old. Window age is unknown unless separately documented.`);
  if (research.windowStatus === 'older_documented') { score = Math.min(90,(score ?? 0)+30); reasons.push('Source explicitly documents older/original or single-pane windows.'); }
  if (research.windowStatus === 'replacement_documented') { if (score !== null) score = Math.max(0,score-35); reasons.push('Source documents replacement/new windows; scope and date still need checking.'); }
  if (research.windowStatus === 'double_pane_documented') reasons.push('Double-pane windows documented; this alone does not establish installation date or condition.');
  return { score, tier: score === null ? 'unranked' : score >= 60 ? 'higher' : score >= 30 ? 'medium' : 'lower', reasons };
}
export async function ensureSkipTables(db) {
  for (const sql of SKIP_DDL) await db.prepare(sql).run();
}
export async function readSkipProspects(db) {
  await ensureSkipTables(db);
  const { results } = await db.prepare('SELECT * FROM skip_trace_prospects ORDER BY batch DESC, id LIMIT 1000').all();
  // Reuse the existing company-wide phone suppression list when available.
  const blocks = await db.prepare('SELECT phone FROM supplier_contact_blocks').all().catch(() => ({ results: [] }));
  const blocked = new Set(blocks.results.map(p => p.phone));
  const enrichment = await db.prepare('SELECT * FROM skip_trace_enrichment').all();
  const byId = new Map(enrichment.results.map(r=>[r.prospect_id,{...JSON.parse(r.data_json),researchedAt:r.researched_at}]));
  return results.map(({ data_json, ...row }) => {
    const data = JSON.parse(data_json);
    data.phones = data.phones.map(p => ({ ...p, suppressed: blocked.has(p.number) }));
    const research = byId.get(row.id) || null;
    const eligibility = propertyEligibility(research);
    const group = eligibility.status !== 'eligible' || row.status === 'do_not_contact' || reviewGroup(data) === 'hold' || !data.phones.some(p => p.valid && !p.dnc && !p.suppressed) ? 'hold' : 'review';
    return { ...row, ...data, group, research, eligibility, priority: windowPriority(research) };
  }).filter(row => row.eligibility.status !== 'excluded');
}
