import { readMeasurements, legacyMeasurements, validateMeasurements, customerLineText } from '../../functions/internal/_lib/quote-measurements.mjs';
import { isOpeningLine } from '../../functions/_lib/build-plan-rules.mjs';

export function preparePrivateMeasurements(item: any) {
  if (!item.measurements?.length) item.measurements = readMeasurements(item).length ? readMeasurements(item) : legacyMeasurements(item);
  item.label = customerLineText(item.label) || 'Window / door';
  item.description = customerLineText(item.description);
}

export function measurementEditor(item: any) {
  const box = document.createElement('details');
  box.className = 'qb-measurements';
  const summary = document.createElement('summary');
  summary.textContent = 'Exact measurements · internal only';
  box.append(summary);
  const hint = document.createElement('p');
  hint.textContent = 'Width × height in inches (for example 35 1/2). Kept off customer quotes and invoices. Carries into production.';
  box.append(hint);
  const rows = document.createElement('div');
  box.append(rows);
  function render() {
    rows.replaceChildren();
    const count = Math.min(50, item.quantity);
    for (let i = 0; i < count; i++) {
      const row = item.measurements[i] || { width: '', height: '', location: '', kind: 'unconfirmed' };
      item.measurements[i] = row;
      const fields = document.createElement('div');
      fields.className = 'qb-measurement-fields';
      const caption = document.createElement('strong');
      caption.textContent = `Opening ${i + 1}`;
      fields.append(caption);
      const controls: HTMLInputElement[] = [];
      const save = () => {
        item.measurements[i] = row;
        const result = validateMeasurements([row], 1);
        for (const input of controls) input.setCustomValidity(result.error || '');
      };
      for (const [key, text] of [['location', 'Room / location'], ['width', 'Width (in)'], ['height', 'Height (in)']]) {
        const label = document.createElement('label'); label.textContent = text;
        const input = document.createElement('input'); input.type = 'text'; input.value = row[key] || ''; input.maxLength = key === 'location' ? 100 : 32;
        input.addEventListener('invalid', () => { box.open = true; });
        input.dataset.measurement = key; input.setAttribute('aria-label', `${text}, opening ${i + 1}`);
        input.addEventListener('input', () => { row[key] = input.value; save(); });
        controls.push(input); label.append(input); fields.append(label);
      }
      const label = document.createElement('label'); label.textContent = 'Measured';
      const select = document.createElement('select'); select.dataset.measurement = 'kind';
      for (const [value, text] of [['unconfirmed', 'Choose / confirm type'], ['rough-opening', 'Rough opening'], ['unit', 'Unit size']]) {
        const option = new Option(text, value); select.append(option);
      }
      select.value = row.kind; select.addEventListener('change', () => { row.kind = select.value; save(); }); label.append(select); fields.append(label);
      rows.append(fields);
    }
  }
  render();
  return { box, refresh: render };
}
