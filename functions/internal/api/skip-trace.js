import { ensureSkipTables, readSkipProspects, STATUSES } from '../_lib/skip-trace.mjs';
import { CONTACT_DDL } from '../_lib/supplier-permits.mjs';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
export async function onRequestGet({ env }) {
  if (!env.QUOTES_DB) return json({ error: 'Lead database is not connected.' }, 503);
  try { return json({ prospects: await readSkipProspects(env.QUOTES_DB) }); }
  catch { return json({ error: 'Could not load prospects. Please retry.' }, 503); }
}
export async function onRequestPatch({ request, env }) {
  if (!env.QUOTES_DB) return json({ error: 'Lead database is not connected.' }, 503);
  if (request.headers.get('origin') !== new URL(request.url).origin || !request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Invalid request origin or format.' }, 403);
  if (Number(request.headers.get('content-length')) > 16000) return json({ error: 'Request too large.' }, 413);
  let body;
  try { const text = await request.text(); if (text.length > 16000) return json({ error: 'Request too large.' }, 413); body = JSON.parse(text); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  if (!body || typeof body.id !== 'string' || !STATUSES.includes(body.status) || typeof body.notes !== 'string' || body.notes.length > 4000 || !Number.isInteger(body.version) || typeof body.follow_up !== 'string' || (body.follow_up && (!/^\d{4}-\d{2}-\d{2}$/.test(body.follow_up) || !Number.isFinite(Date.parse(body.follow_up)) || new Date(body.follow_up).toISOString().slice(0, 10) !== body.follow_up))) return json({ error: 'Check the status, notes and follow-up date.' }, 400);
  try {
    const db = env.QUOTES_DB;
    await ensureSkipTables(db);
    const current = await db.prepare('SELECT * FROM skip_trace_prospects WHERE id = ?').bind(body.id).first();
    if (!current) return json({ error: 'Prospect not found.' }, 404);
    if (current.version !== body.version) return json({ error: 'This prospect changed on another device. Reload before saving.' }, 409);
    // Do-not-contact is deliberately not reversible through this prospect editor.
    if (current.status === 'do_not_contact' && body.status !== 'do_not_contact') return json({ error: 'Do-not-contact cannot be removed here.' }, 409);
    const at = new Date().toISOString();
    for (const sql of CONTACT_DDL) await db.prepare(sql).run();
    const blocks = body.status === 'do_not_contact' ? JSON.parse(current.data_json).phones.filter(p => p.valid).map(p => db.prepare(`INSERT OR IGNORE INTO supplier_contact_blocks (phone,reason,note,created_at) SELECT ?, 'asked_not_to_call', 'Skip-trace prospect marked do not contact', ? FROM skip_trace_prospects WHERE id=? AND version=? AND status='do_not_contact' AND updated_at=?`).bind(p.number, at, body.id, body.version+1, at)) : [];
    const result = await db.batch([
      db.prepare(`UPDATE skip_trace_prospects SET status=?, notes=?, follow_up=?, version=version+1, updated_at=? WHERE id=? AND version=?`).bind(body.status, body.notes, body.follow_up, at, body.id, body.version),
      db.prepare(`INSERT INTO skip_trace_history (prospect_id,status,notes,follow_up,created_at) SELECT id,status,notes,follow_up,updated_at FROM skip_trace_prospects WHERE id=? AND version=? AND updated_at=?`).bind(body.id, body.version + 1, at),
      ...blocks,
    ]);
    if (!result[0].meta.changes) return json({ error: 'Record changed. Reload before saving.' }, 409);
    return json({ ok: true, version: body.version + 1 });
  } catch { return json({ error: 'Could not save. Your changes have not been confirmed.' }, 503); }
}
export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'PATCH') return onRequestPatch(context);
  return json({ error: 'Method not allowed.' }, 405);
}
