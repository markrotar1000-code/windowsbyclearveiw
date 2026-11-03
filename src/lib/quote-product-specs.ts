import { PRODUCT_SPEC_FIELDS, readProductSpecs } from '../../functions/internal/_lib/supplier-specs.mjs';
export function productSpecEditor(item: any) {
  item.productSpecs = readProductSpecs(item);
  const details = document.createElement('details'); details.className = 'qb-measurements';
  const summary = document.createElement('summary'); summary.textContent = 'Supplier specifications · internal'; details.append(summary);
  const hint = document.createElement('p'); hint.textContent = 'Optional product details for supplier requests. Leave unknown options blank; they will be marked for confirmation.'; details.append(hint);
  const grid = document.createElement('div'); grid.className = 'qb-measurement-fields'; details.append(grid);
  for (const [key, caption] of Object.entries(PRODUCT_SPEC_FIELDS)) {
    const label = document.createElement('label'); label.textContent = caption as string;
    const input = document.createElement('input'); input.type = 'text'; input.maxLength = 250; input.value = item.productSpecs[key] || ''; input.dataset.productSpec = key;
    input.addEventListener('input', () => { item.productSpecs[key] = input.value; }); label.append(input); grid.append(label);
  }
  return details;
}
