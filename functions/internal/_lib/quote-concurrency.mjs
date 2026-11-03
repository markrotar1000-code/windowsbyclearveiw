export async function ensureQuoteRevisionSchema(db) {
  for (const sql of [
    'ALTER TABLE quotes ADD COLUMN revision INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE quotes ADD COLUMN revision_of TEXT',
    'ALTER TABLE quotes ADD COLUMN revision_kind TEXT',
  ]) {
    try { await db.prepare(sql).run(); }
    catch (error) { if (!/duplicate column/i.test(String(error?.message || error))) throw error; }
  }
  await db.prepare('CREATE TABLE IF NOT EXISTS quote_write_guards (id TEXT PRIMARY KEY, quote_id TEXT NOT NULL, expected_revision INTEGER NOT NULL, expected_status TEXT NOT NULL)').run();
  await db.prepare(`CREATE TRIGGER IF NOT EXISTS quote_write_revision_guard BEFORE INSERT ON quote_write_guards
    WHEN NOT EXISTS (SELECT 1 FROM quotes WHERE id = NEW.quote_id AND revision = NEW.expected_revision AND status = NEW.expected_status)
    BEGIN SELECT RAISE(ABORT, 'QUOTE_REVISION_CONFLICT'); END`).run();
}

export function revisionConflict() {
  return new Response(JSON.stringify({ error: 'This quote changed on another device. Reload it before saving so the newer changes are preserved.', code: 'QUOTE_REVISION_CONFLICT' }), { status: 409, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export function guardedQuoteBatch(db, quote, statements, expectedRevision = quote.revision) {
  const id = crypto.randomUUID();
  return db.batch([
    db.prepare('INSERT INTO quote_write_guards (id, quote_id, expected_revision, expected_status) VALUES (?,?,?,?)').bind(id, quote.id, Number(expectedRevision || 1), quote.status),
    ...statements,
    db.prepare('DELETE FROM quote_write_guards WHERE id = ?').bind(id),
  ]);
}
