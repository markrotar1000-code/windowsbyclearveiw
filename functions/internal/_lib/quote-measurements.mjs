import { cleanProductSpecs, ensureProductSpecsSchema } from './supplier-specs.mjs';
import { extractSizes, normalizeSizes, parseInches, formatInches } from '../../_lib/dimensions.mjs';

// Exact field measurements are internal data, never customer line copy.
export function customerLineText(value) {
  let text = normalizeSizes(String(value || ''));
  for (const size of extractSizes(text).reverse()) text = text.slice(0, size.index) + text.slice(size.end);
  return text.replace(/\s*[—–,;]\s*(?=[—–,;]|$)/g, '').replace(/\s{2,}/g, ' ').trim();
}
export function readMeasurements(item) {
  if (Array.isArray(item?.measurements)) return item.measurements;
  try { const rows = JSON.parse(item?.measurements_json || '[]'); return Array.isArray(rows) ? rows : []; } catch { return []; }
}
export function legacyMeasurements(item) {
  const size = extractSizes(`${item?.label || ''} ${item?.description || ''}`)[0];
  return size ? Array.from({ length: Math.min(100, Math.max(1, Number(item.quantity) || 1)) }, () => ({ width: formatInches(size.w), height: formatInches(size.h), kind: 'unconfirmed', location: '' })) : [];
}
export function validateMeasurements(raw, quantity) {
  if (!Array.isArray(raw) || raw.length > 100 || raw.length > quantity) return { error: 'Enter no more than one measurement per opening (maximum 100 per line).' };
  const value = [];
  for (const [i, row] of raw.entries()) {
    if (!row || typeof row !== 'object') return { error: `Opening ${i + 1}: invalid measurement.` };
    let productSpecs;
    try { productSpecs = row.productSpecs ? cleanProductSpecs(row.productSpecs) : undefined; } catch (error) { return { error: error.message }; }
    const width = String(row.width || '').trim(), height = String(row.height || '').trim();
    if (!width && !height) { value.push({ width: '', height: '', kind: 'unconfirmed', location: String(row.location || '').slice(0, 100), ...(productSpecs ? { productSpecs } : {}) }); continue; }
    const w = parseInches(width), h = parseInches(height);
    if (!w || !h || w.rounded || h.rounded) return { error: `Opening ${i + 1}: enter both width and height from 6 to 144 inches, in exact 1/16-inch increments.` };
    if (!['rough-opening', 'unit', 'unconfirmed'].includes(row.kind)) return { error: `Opening ${i + 1}: choose what was measured.` };
    value.push({ width: formatInches(w.sixteenths), height: formatInches(h.sixteenths), kind: row.kind, location: String(row.location || '').trim().slice(0, 100), ...(productSpecs ? { productSpecs } : {}) });
  }
  return { value };
}
export async function ensureMeasurementsSchema(db) {
  await ensureProductSpecsSchema(db);
  try { await db.prepare("ALTER TABLE quote_items ADD COLUMN measurements_json TEXT NOT NULL DEFAULT '[]'").run(); }
  catch (error) { if (!/duplicate column/i.test(String(error?.message || error))) throw error; }
}
