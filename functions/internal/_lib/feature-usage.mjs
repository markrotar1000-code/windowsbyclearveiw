// Is a feature actually being used? Counts only: one row per day and feature with how many times it worked and how many
// times it did not. No audio, no words, no customer, no phone, no IP: nothing here could identify anyone or anything said.
// It exists so the 90-day "does this earn its keep" audit has evidence, and so a feature that quietly fails shows up.
// Every call is best effort: counting must never slow down or break the thing being counted.

export const FEATURES = ['dictation_clip', 'quote_draft', 'quote_saved_with_draft', 'measurements_imported'];
// Events the browser may report after a quote is saved. The server-side ones (a clip, a draft) are recorded by their own endpoints.
export const CLIENT_FEATURES = ['quote_saved_with_draft', 'measurements_imported'];
const RETENTION_DAYS = 400;

// Remembered per database object, so a restored or second database still gets its table.
const ensured = new WeakSet();
async function ensure(db) {
  if (ensured.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS feature_usage (
    day TEXT NOT NULL,
    feature TEXT NOT NULL,
    ok INTEGER NOT NULL DEFAULT 0,
    degraded INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, feature)
  )`).run();
  ensured.add(db);
}

const dayOf = (now) => now.toISOString().slice(0, 10);

/** Adds one to today's count for `feature`. Returns true when it was counted; never throws. */
export async function recordUsage(env, feature, outcome = 'ok', now = new Date()) {
  const db = env?.QUOTES_DB;
  if (!db || !FEATURES.includes(feature)) return false;
  try {
    await ensure(db);
    const column = outcome === 'degraded' ? 'degraded' : 'ok';
    await db.prepare(`INSERT INTO feature_usage (day, feature, ${column}) VALUES (?, ?, 1)
      ON CONFLICT(day, feature) DO UPDATE SET ${column} = ${column} + 1`).bind(dayOf(now), feature).run();
    if (Math.random() < 0.02) {
      const cutoff = dayOf(new Date(now.getTime() - RETENTION_DAYS * 86_400_000));
      await db.prepare('DELETE FROM feature_usage WHERE day < ?').bind(cutoff).run().catch(() => {});
    }
    return true;
  } catch (error) {
    console.error('feature-usage-unavailable', error?.message || error);
    return false;
  }
}

/** Totals over the last `days` days, plus how many quotes were saved in the same window for scale. A missing table reads as zero. */
export async function readUsage(db, days = 30, now = new Date()) {
  const window = Math.max(1, Math.min(365, Math.floor(Number(days)) || 30));
  const sinceDay = dayOf(new Date(now.getTime() - (window - 1) * 86_400_000));
  const features = Object.fromEntries(FEATURES.map((name) => [name, { ok: 0, degraded: 0, days: 0 }]));
  try {
    await ensure(db);
    const rows = await db.prepare('SELECT feature, SUM(ok) AS ok, SUM(degraded) AS degraded, COUNT(*) AS days FROM feature_usage WHERE day >= ? GROUP BY feature').bind(sinceDay).all();
    for (const row of rows.results || []) {
      if (features[row.feature]) features[row.feature] = { ok: Number(row.ok) || 0, degraded: Number(row.degraded) || 0, days: Number(row.days) || 0 };
    }
  } catch { /* nothing recorded yet */ }
  let quotesSaved = 0;
  try {
    const since = new Date(now.getTime() - window * 86_400_000).toISOString();
    quotesSaved = Number((await db.prepare('SELECT COUNT(*) AS n FROM quotes WHERE created_at >= ?').bind(since).first())?.n) || 0;
  } catch { /* no quotes table yet */ }
  return { days: window, features, quotesSaved };
}
