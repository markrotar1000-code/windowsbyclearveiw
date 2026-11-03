import { cleanProductSpecs, ensureProductSpecsSchema } from '../_lib/supplier-specs.mjs';
import { guardWrite, methodNotAllowed } from '../_lib/request-guard.mjs';
import { json } from '../_lib/quotes.mjs';
import { ensureMeasurementsSchema, validateMeasurements, readMeasurements } from '../_lib/quote-measurements.mjs';
import { ensureQuoteRevisionSchema, guardedQuoteBatch, revisionConflict } from '../_lib/quote-concurrency.mjs';
import { ensureJobsSchema } from '../_lib/jobs-schema.mjs';
import { generatePlan } from './build-plan.js';
import { lintPlan, sourceSnapshot } from '../../_lib/build-plan-rules.mjs';

async function schema(db) {
  await ensureQuoteRevisionSchema(db); await ensureMeasurementsSchema(db); await ensureProductSpecsSchema(db); await ensureJobsSchema(db);
  await db.prepare(`CREATE TABLE IF NOT EXISTS quote_operation_changes (id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id TEXT NOT NULL, revision INTEGER NOT NULL, at TEXT NOT NULL, actor TEXT NOT NULL DEFAULT 'mark', note TEXT, before_json TEXT NOT NULL, after_json TEXT NOT NULL, job_id TEXT, job_version INTEGER)`).run();
  await db.prepare(`CREATE TRIGGER IF NOT EXISTS quote_operation_new_job_guard BEFORE INSERT ON quote_operation_changes
    WHEN NEW.job_id IS NULL AND EXISTS (SELECT 1 FROM jobs WHERE quote_id = NEW.quote_id)
    BEGIN SELECT RAISE(ABORT, 'QUOTE_REVISION_CONFLICT'); END`).run();
  await db.prepare(`CREATE TRIGGER IF NOT EXISTS quote_operation_job_guard BEFORE INSERT ON quote_operation_changes
    WHEN NEW.job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jobs WHERE id = NEW.job_id AND COALESCE(build_plan_version,0) = NEW.job_version AND status NOT IN ('completed','cancelled'))
    BEGIN SELECT RAISE(ABORT, 'QUOTE_REVISION_CONFLICT'); END`).run();
}
async function record(db, id) {
  const quote = await db.prepare('SELECT * FROM quotes WHERE id = ?').bind(id).first();
  if (!quote) return null;
  const { results: items } = await db.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order, id').bind(id).all();
  return { quote, items };
}
export async function onRequestGet({ env, request }) {
  const db = env.QUOTES_DB; await schema(db);
  const loaded = await record(db, new URL(request.url).searchParams.get('quoteId') || '');
  if (!loaded) return json({ error: 'Quote not found.' }, 404);
  const { results: history } = await db.prepare('SELECT id, revision, at, actor, note, job_id, job_version FROM quote_operation_changes WHERE quote_id = ? ORDER BY id DESC LIMIT 50').bind(loaded.quote.id).all();
  return json({ quoteId: loaded.quote.id, revision: loaded.quote.revision, items: loaded.items.map(item => ({ ...item, measurements: readMeasurements(item), productSpecs: parse(item.product_specs_json, {}) })), history });
}
function parse(value, fallback) { try { return JSON.parse(value || 'null') || fallback; } catch { return fallback; } }
export async function onRequestPost(context) {
  const guard = await guardWrite(context);
  if (!guard.ok) return guard.response;
  const body = guard.body, db = context.env.QUOTES_DB;
  if (!body || typeof body.quoteId !== 'string' || !Number.isSafeInteger(body.expectedRevision) || !Array.isArray(body.items) || !body.items.length) return json({ error: 'Reload the quote and enter its private measurement corrections.' }, 400);
  await schema(db);
  const loaded = await record(db, body.quoteId);
  if (!loaded) return json({ error: 'Quote not found.' }, 404);
  const { quote, items } = loaded;
  if (Number(quote.revision) !== body.expectedRevision) return revisionConflict();
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  if (!note) return json({ error: 'Enter the reason for this private correction.' }, 400);
  const ids = new Set();
  for (const edit of body.items) {
    const item = items.find(row => Number(row.id) === Number(edit?.itemId));
    if (!item || ids.has(item.id)) return json({ error: 'One of the opening lines changed. Reload the quote.' }, 409);
    ids.add(item.id);
    const checked = validateMeasurements(edit.measurements, item.quantity);
    if (checked.error) return json({ error: checked.error }, 400);
    item.measurements_json = JSON.stringify(checked.value);
    // Product fields use the same bounded allowlist as the quote builder.
    if (edit.productSpecs !== undefined) {
      try { item.product_specs_json = JSON.stringify(cleanProductSpecs(edit.productSpecs)); }
      catch (error) { return json({ error: error.message }, 400); }
    }
  }
  const before = (await record(db, quote.id)).items;
  const job = await db.prepare('SELECT * FROM jobs WHERE quote_id = ?').bind(quote.id).first();
  if (job && ['completed', 'cancelled'].includes(job.status)) return json({ error: 'A completed or cancelled job keeps its historical measurement snapshot. Start a revised quote for new work.' }, 409);
  let plan = null, version = null;
  if (job) {
    const previous = parse(job.build_plan_json, {}), fresh = generatePlan(quote, items);
    plan = { ...fresh, ...previous, sourceItems: sourceSnapshot(items), openings: fresh.openings.map((opening, i) => ({ ...(previous.openings?.[i] || {}), ...opening, existingCondition: previous.openings?.[i]?.existingCondition || opening.existingCondition, flashing: previous.openings?.[i]?.flashing || opening.flashing, notes: previous.openings?.[i]?.notes || opening.notes })), operationallyUpdatedAt: new Date().toISOString(), operationallyUpdatedBy: 'mark' };
    plan.quality = lintPlan(plan, items);
    if (plan.quality.blockers.length) return json({ error: 'Correct the production details before saving.', blockers: plan.quality.blockers }, 409);
    version = Number(job.build_plan_version || 0) + 1;
    if (JSON.stringify(plan).length > 150000) return json({ error: 'These production details are too large. Split the work into smaller jobs.' }, 413);
  }
  const now = new Date().toISOString(), nextRevision = Number(quote.revision) + 1;
  const statements = [
    db.prepare('INSERT INTO quote_operation_changes (quote_id, revision, at, actor, note, before_json, after_json, job_id, job_version) VALUES (?,?,?,\'mark\',?,?,?,?,?)').bind(quote.id, nextRevision, now, note, JSON.stringify(before), JSON.stringify(items), job?.id || null, job ? Number(job.build_plan_version || 0) : null),
    ...items.filter(item => ids.has(item.id)).map(item => db.prepare('UPDATE quote_items SET measurements_json = ?, product_specs_json = ? WHERE id = ? AND quote_id = ?').bind(item.measurements_json, item.product_specs_json || '{}', item.id, quote.id)),
    db.prepare('UPDATE quotes SET revision = revision + 1 WHERE id = ?').bind(quote.id),
  ];
  if (job) statements.push(db.prepare('UPDATE jobs SET build_plan_json = ?, build_plan_version = ?, build_plan_attached_at = ?, build_plan_attached_by = \'mark\', updated_at = ? WHERE id = ?').bind(JSON.stringify(plan), version, now, now, job.id));
  try { await guardedQuoteBatch(db, quote, statements, body.expectedRevision); }
  catch (error) { if (/QUOTE_REVISION_CONFLICT/.test(String(error?.message || error))) return revisionConflict(); throw error; }
  return json({ ok: true, revision: nextRevision, jobId: job?.id || null, buildPlanVersion: version });
}
export async function onRequest(context) { const fn = { GET: onRequestGet, POST: onRequestPost }[context.request.method]; return fn ? fn(context) : methodNotAllowed(['GET', 'POST']); }
