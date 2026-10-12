import { pacificDayRange } from '../_lib/pacific-day.mjs';
export { pacificDayRange } from '../_lib/pacific-day.mjs';
import { syncQuoteFollowUps } from '../_lib/quote-follow-ups.mjs';
import { ensureJobsSchema } from '../_lib/jobs-schema.mjs';
import { ensureQuoteWorkTypeColumn } from '../_lib/work-types.mjs';
import { ensureLeadServiceColumn } from '../../_lib/lead-service.mjs';
import { sourceLabel } from '../_lib/lead-sources.mjs';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}

async function ensureTaskSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS follow_up_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      lead_id INTEGER,
      title TEXT NOT NULL,
      due_at TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      notes TEXT,
      created_by TEXT NOT NULL DEFAULT 'mark'
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_status_due ON follow_up_tasks(status, due_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_lead ON follow_up_tasks(lead_id)`),
  ]);
}


function topSources(rows, limit = 6) {
  const totals = new Map();
  for (const row of rows) {
    const label = sourceLabel(row);
    totals.set(label, (totals.get(label) || 0) + (Number(row.count) || 0));
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([source, count]) => ({ source, count }));
}

/** Compact read model for the Command Center. */
export async function onRequestGet(context) {
  const { env } = context;
  await ensureTaskSchema(env.QUOTES_DB);
  await ensureJobsSchema(env.QUOTES_DB);
  await ensureQuoteWorkTypeColumn(env.QUOTES_DB);
  const leadService = (await ensureLeadServiceColumn(env.QUOTES_DB)) ? ', service' : '';
  await syncQuoteFollowUps(env.QUOTES_DB).catch((error) => console.error('quote-follow-up-sync-failed', error));
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const today = pacificDayRange(new Date(now));

  const [counts, recentLeads, recentQuotes, sources, cities, tasks, recentJobs] = await Promise.all([
    env.QUOTES_DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM leads WHERE created_at >= ?) AS new_leads,
        (SELECT COUNT(*) FROM quotes WHERE status = 'draft') AS draft_quotes,
        (SELECT COUNT(*) FROM quotes WHERE status = 'finalized') AS finalized_quotes,
        (SELECT COALESCE(SUM(total_cents), 0) FROM quotes WHERE status = 'draft') AS draft_value_cents,
        (SELECT COALESCE(SUM(total_cents), 0) FROM quotes WHERE status = 'finalized') AS finalized_value_cents,
        (SELECT COUNT(*) FROM quotes) AS total_quotes,
        (SELECT COUNT(*) FROM follow_up_tasks WHERE status = 'open') AS open_tasks,
        (SELECT COUNT(*) FROM follow_up_tasks WHERE status = 'open' AND due_at >= ? AND due_at < ?) AS tasks_today,
        (SELECT COUNT(*) FROM follow_up_tasks WHERE status = 'open' AND due_at IS NOT NULL AND due_at < ?) AS tasks_overdue,
        (SELECT COUNT(*) FROM jobs WHERE status NOT IN ('completed','cancelled')) AS active_jobs,
        (SELECT COALESCE(SUM(CASE WHEN j.status NOT IN ('completed','cancelled') THEN COALESCE(q.total_cents,j.agreed_cents,0) ELSE 0 END),0) FROM jobs j LEFT JOIN quotes q ON q.id = j.quote_id) AS active_job_value_cents
    `).bind(weekAgo, today.start, today.end, now).first(),
    env.QUOTES_DB.prepare(`SELECT id, created_at, name, phone, email, city, role${leadService} FROM leads ORDER BY created_at DESC LIMIT 6`).all(),
    env.QUOTES_DB.prepare(`SELECT id, created_at, status, work_type, customer_name, customer_city, total_cents FROM quotes ORDER BY created_at DESC LIMIT 6`).all(),
    // Labelled in code, not SQL: a raw referrer is a full URL, so one site split into a row per page it linked
    // from. sourceLabel is the Analytics page's own rule (UTM name, else the referrer's host, own pages are Direct).
    env.QUOTES_DB.prepare(`SELECT first_utm_source, first_referrer, COUNT(*) AS count FROM leads GROUP BY first_utm_source, first_referrer LIMIT 5000`).all(),
    // Group on what is displayed: leads with a NULL city, an empty city, or the same city typed with
    // different spacing or capitals are one row, not several rows with the same label.
    env.QUOTES_DB.prepare(`
      SELECT COALESCE(NULLIF(MIN(TRIM(city)), ''), 'City not provided') AS city, COUNT(*) AS count
      FROM leads GROUP BY LOWER(TRIM(COALESCE(city, ''))) ORDER BY count DESC, city ASC LIMIT 6
    `).all(),
    env.QUOTES_DB.prepare(`
      SELECT t.id, t.title, t.due_at, t.status, t.lead_id, t.quote_id,
             COALESCE(l.name, q.customer_name) AS lead_name, COALESCE(l.phone, q.customer_phone) AS lead_phone,
             COALESCE(l.city, q.customer_city) AS lead_city
      FROM follow_up_tasks t LEFT JOIN leads l ON l.id = t.lead_id LEFT JOIN quotes q ON q.id = t.quote_id
      WHERE t.status = 'open'
      ORDER BY CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END, t.due_at ASC, t.created_at ASC
      LIMIT 8
    `).all(),
    env.QUOTES_DB.prepare(`
      SELECT j.id, j.status, j.work_type, j.scheduled_date, j.scheduled_window, j.customer_name, j.customer_city, COALESCE(q.total_cents, j.agreed_cents) AS total_cents
      FROM jobs j LEFT JOIN quotes q ON q.id = j.quote_id
      WHERE j.status <> 'completed' AND j.status <> 'cancelled'
      ORDER BY CASE WHEN j.scheduled_date IS NULL THEN 1 ELSE 0 END, j.scheduled_date ASC, j.created_at DESC
      LIMIT 8
    `).all(),
  ]);

  return json({
    counts: counts || {},
    recentLeads: recentLeads.results || [],
    recentQuotes: recentQuotes.results || [],
    sources: topSources(sources.results || []),
    cities: cities.results || [],
    tasks: tasks.results || [],
    recentJobs: recentJobs.results || [],
  });
}
