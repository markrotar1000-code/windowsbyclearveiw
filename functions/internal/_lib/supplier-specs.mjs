export const PRODUCT_SPEC_FIELDS = Object.freeze({ manufacturer: 'Manufacturer', series: 'Series / model', configuration: 'Configuration', handing: 'Handing / viewing orientation', interiorFinish: 'Interior finish', exteriorFinish: 'Exterior finish', glass: 'Glass package', screens: 'Screens', grids: 'Grids', accessories: 'Accessories' });
export function cleanProductSpecs(raw) {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Product specifications must be an object.');
  return Object.fromEntries(Object.keys(PRODUCT_SPEC_FIELDS).flatMap(key => {
    if (raw[key] === undefined || raw[key] === '') return [];
    if (typeof raw[key] !== 'string') throw new Error(`${PRODUCT_SPEC_FIELDS[key]} must be text.`);
    return [[key, raw[key].trim().slice(0, 250)]];
  }));
}
export function readProductSpecs(item) {
  try { return cleanProductSpecs(item?.productSpecs ?? JSON.parse(item?.product_specs_json || '{}')); } catch { return {}; }
}
export function supplierCompleteness(item) {
  const specs = readProductSpecs(item);
  return { specs, missing: Object.keys(PRODUCT_SPEC_FIELDS).filter(key => !specs[key]) };
}
export async function ensureProductSpecsSchema(db) {
  try { await db.prepare("ALTER TABLE quote_items ADD COLUMN product_specs_json TEXT NOT NULL DEFAULT '{}'").run(); }
  catch (error) { if (!/duplicate column/i.test(String(error?.message || error))) throw error; }
}
