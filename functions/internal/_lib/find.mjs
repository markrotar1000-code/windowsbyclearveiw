// "Find a customer": one search over leads, quotes and jobs, for the box on the Dashboard and Today.
//
// Mark is on the phone with someone and needs their record in two taps, not three list pages. Read only,
// behind the session gate like every /internal route. A table that does not exist yet (a new database
// with no leads, say) reads as no results rather than an error.

export const MIN_QUERY = 2;
export const MAX_QUERY = 60;
export const PER_KIND = 6;

/** The search text as typed, with runs of spaces collapsed and a length cap. Too short is ''. */
export function cleanQuery(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY);
  return text.length >= MIN_QUERY ? text : '';
}

const likeEscape = (text) => text.replace(/[\\%_]/g, '\\$&');
const PHONE_DIGITS = (column) => `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${column},'(',''),')',''),'-',''),' ',''),'.','')`;

/** Which columns a query is matched against: text columns always, the phone column by digits when the query reads as a number. */
function conditions(text, columns, phoneColumn) {
  const parts = columns.map((column) => `${column} LIKE ? ESCAPE '\\'`);
  const binds = columns.map(() => `%${likeEscape(text)}%`);
  const digits = text.replace(/\D/g, '');
  if (phoneColumn && digits.length >= 3 && /^[+\d\s().-]+$/.test(text)) {
    parts.push(`${PHONE_DIGITS(phoneColumn)} LIKE ? ESCAPE '\\'`);
    binds.push(`%${likeEscape(digits)}%`);
  }
  return { where: parts.join(' OR '), binds };
}

/** Names that start with the text, or have a word that does, come before names that merely contain it. */
const rankBy = (column) => `CASE WHEN ${column} LIKE ? ESCAPE '\\' OR ${column} LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END`;
const rankBinds = (text) => [`${likeEscape(text)}%`, `% ${likeEscape(text)}%`];

async function run(db, sql, binds) {
  try {
    const { results } = await db.prepare(sql).bind(...binds).all();
    return results || [];
  } catch {
    return [];
  }
}

/** Up to PER_KIND matches of each kind, newest first. Returns { query, leads, quotes, jobs }. */
export async function findRecords(db, raw) {
  const text = cleanQuery(raw);
  if (!text) return { query: '', leads: [], quotes: [], jobs: [] };

  const lead = conditions(text, ['name', 'email', 'city'], 'phone');
  const quote = conditions(text, ['id', 'customer_name', 'customer_email', 'customer_city', 'customer_address'], 'customer_phone');
  const job = conditions(text, ['id', 'customer_name', 'customer_email', 'customer_city', 'customer_address'], 'customer_phone');

  const [leads, quotes, jobs] = await Promise.all([
    run(db, `SELECT id, name, phone, city, role, created_at FROM leads WHERE ${lead.where} ORDER BY ${rankBy('name')}, created_at DESC LIMIT ${PER_KIND}`, [...lead.binds, ...rankBinds(text)]),
    run(db, `SELECT id, customer_name, customer_city, status, work_type, total_cents, created_at FROM quotes WHERE ${quote.where} ORDER BY ${rankBy('customer_name')}, created_at DESC LIMIT ${PER_KIND}`, [...quote.binds, ...rankBinds(text)]),
    run(db, `SELECT id, customer_name, customer_city, status, scheduled_date, created_at FROM jobs WHERE ${job.where} ORDER BY ${rankBy('customer_name')}, created_at DESC LIMIT ${PER_KIND}`, [...job.binds, ...rankBinds(text)]),
  ]);

  return {
    query: text,
    leads: leads.map((r) => ({ id: r.id, name: r.name || '', phone: r.phone || '', city: r.city || '', role: r.role || '', createdAt: r.created_at })),
    quotes: quotes.map((r) => ({ id: r.id, name: r.customer_name || '', city: r.customer_city || '', status: r.status || '', workType: r.work_type || 'windows', totalCents: r.total_cents, createdAt: r.created_at })),
    jobs: jobs.map((r) => ({ id: r.id, name: r.customer_name || '', city: r.customer_city || '', status: r.status || '', scheduledDate: r.scheduled_date || '', createdAt: r.created_at })),
  };
}
