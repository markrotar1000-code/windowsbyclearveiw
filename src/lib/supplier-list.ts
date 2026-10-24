// Supplier exports deliberately accept no customer, price, discount or internal-notes fields.
export type SupplierLine = { label: string; quantity: number; unit?: string; details?: string };
export type SupplierRequest = { reference?: string; message?: string; workType?: string; lines: readonly SupplierLine[] };
export const SUPPLIER_LIMIT = 200;
const clean = (value: unknown, max: number) => typeof value === 'string'
  ? value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '';
export const supplierText = (value: unknown, max = 300) => clean(value, max).replace(/\s+/g, ' ');

export function supplierLines(lines: readonly SupplierLine[]): SupplierLine[] {
  if (!Array.isArray(lines) || !lines.length) throw new Error('Choose at least one line for the supplier.');
  if (lines.length > SUPPLIER_LIMIT) throw new Error(`Use ${SUPPLIER_LIMIT} lines or fewer in one supplier list.`);
  return lines.map((line, index) => {
    const label = supplierText(line.label);
    if (!label) throw new Error(`Line ${index + 1} needs a description.`);
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new Error(`Line ${index + 1} needs a whole quantity of 1 or more.`);
    return { label, quantity: line.quantity, unit: supplierText(line.unit, 40), details: clean(line.details, 1000) };
  });
}

export function formatSupplierRequest(request: SupplierRequest): string {
  const lines = supplierLines(request.lines);
  const reference = supplierText(request.reference, 120);
  const message = clean(request.message, 2000);
  return [
    'CLEARVIEW — SUPPLIER PRICING REQUEST',
    ...(reference ? [`Reference: ${reference}`] : []),
    '', 'Please provide pricing, availability and lead times for these items.',
    'Pricing request only — not an order.', '',
    ...lines.flatMap((line, index) => [
      `${index + 1}. ${line.label}`,
      `   Quantity: ${line.quantity}${line.unit ? ` ${line.unit}` : ' (as quoted)'}`,
      `   Supplier details: ${line.details ? line.details.replace(/\n/g, '\n   ') : 'Not provided — please confirm.'}`, '',
    ]),
    ...(message ? ['Message:', message, ''] : []),
    ...(request.workType === 'siding' ? ['Siding quote quantities may be wall area, not purchase quantities. Please confirm coverage and material quantities.', ''] : []),
    'Confirm sizes (width x height and units), product series, colors, glass, handing and quantities before ordering.',
  ].join('\n');
}

// Quote every field and neutralize spreadsheet formula prefixes, including after whitespace.
const csvCell = (value: string | number) => {
  let text = String(value);
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
export function supplierCsv(request: SupplierRequest): string {
  const reference = supplierText(request.reference, 120);
  const rows = supplierLines(request.lines).map((line, index) => [reference, index + 1, line.quantity, line.unit || 'as quoted', line.label, line.details || 'Not provided — confirm']);
  return '\uFEFF' + [['Reference', 'Line', 'Quantity', 'Quantity unit', 'Description', 'Supplier details'], ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function supplierMailto(text: string, reference = ''): string | null {
  const subject = `Clearview supplier pricing request${reference ? ` — ${supplierText(reference, 120)}` : ''}`;
  try {
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    return url.length <= 1800 ? url : null;
  } catch { return null; } // Unpaired Unicode must not disable text/CSV copying.
}
