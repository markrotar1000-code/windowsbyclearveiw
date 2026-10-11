// The counts the Operations Copilot summarizes ("Summarize my day" in the Command Center).
//
// Every timestamp in D1 is ISO-8601 with a "T" and a "Z" ("2026-10-10T17:30:00.000Z"). SQLite's own
// datetime('now') prints "2026-10-10 17:30:00", with a space. Compared as text, "T" sorts after " ",
// so a task due at 09:00 today was NOT "before now" until the UTC date rolled over, and the Copilot
// reported fewer overdue follow-ups than the dashboard (which binds ISO bounds). Always pass ISO
// bounds in; never compare a stored timestamp with datetime('now').

const DAY_MS = 86_400_000;

/** Counts for the Copilot's read-only snapshot. `now` is injectable so a test can pin the clock. */
export async function copilotSnapshot(db, now = new Date()) {
  const nowIso = now.toISOString();
  const weekAgoIso = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  return db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM leads WHERE created_at >= ?) AS new_leads,
        (SELECT COUNT(*) FROM quotes WHERE status = 'draft') AS draft_quotes,
        (SELECT COUNT(*) FROM quotes WHERE status = 'finalized') AS finalized_quotes,
        (SELECT COUNT(*) FROM follow_up_tasks WHERE status = 'open') AS open_tasks,
        (SELECT COUNT(*) FROM follow_up_tasks WHERE status = 'open' AND due_at < ?) AS overdue_tasks,
        (SELECT COUNT(*) FROM jobs WHERE status NOT IN ('completed','cancelled')) AS active_jobs`,
    )
    .bind(weekAgoIso, nowIso)
    .first();
}
