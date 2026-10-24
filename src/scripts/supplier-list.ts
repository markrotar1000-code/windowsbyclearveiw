import { formatSupplierRequest, supplierCsv, supplierMailto, SUPPLIER_LIMIT, type SupplierLine, type SupplierRequest } from '../lib/supplier-list';
import { visitorMessage } from '../lib/visitor-errors';

type SourceLine = Pick<SupplierLine, 'label' | 'quantity'>;
type Source = { lines: readonly SourceLine[]; workType: string; reference: string; valid: boolean };
type Choice = { identity: SourceLine; source: SourceLine; included: boolean; unit: string; details: string };

export function bindSupplierList(form: HTMLFormElement, getSource: () => Source) {
  const root = form.querySelector<HTMLElement>('[data-supplier-root]');
  if (!root) return { checkForChanges() {} };
  const open = root.querySelector<HTMLButtonElement>('[data-supplier-open]')!;
  const panel = root.querySelector<HTMLElement>('[data-supplier-panel]')!;
  const list = root.querySelector<HTMLElement>('[data-supplier-lines]')!;
  const reference = root.querySelector<HTMLInputElement>('[data-supplier-reference]')!;
  const message = root.querySelector<HTMLTextAreaElement>('[data-supplier-message]')!;
  const output = root.querySelector<HTMLTextAreaElement>('[data-supplier-output]')!;
  const status = root.querySelector<HTMLElement>('[data-supplier-status]')!;
  const email = root.querySelector<HTMLAnchorElement>('[data-supplier-email]')!;
  const emailHint = root.querySelector<HTMLElement>('[data-supplier-email-hint]')!;
  const share = root.querySelector<HTMLButtonElement>('[data-supplier-share]')!;
  let choices: Choice[] = [];
  let snapshot = '';
  let ready = false;
  let initialized = false;
  let workType = 'windows';
  const fingerprint = (source: Source) => JSON.stringify({ valid: source.valid, workType: source.workType, lines: source.lines.map(line => [line.label, line.quantity]) });
  const request = (): SupplierRequest => ({ reference: reference.value, message: message.value, workType, lines: choices.filter(c => c.included).map(c => ({ label: c.source.label, quantity: c.source.quantity, unit: c.unit, details: c.details })) });
  function disableSharing() {
    ready = false;
    root!.querySelectorAll<HTMLButtonElement>('[data-supplier-copy], [data-supplier-download], [data-supplier-csv], [data-supplier-share]').forEach(button => button.disabled = true);
    email.removeAttribute('href'); email.setAttribute('aria-disabled', 'true');
  }
  function checkForChanges() {
    if (!initialized) return;
    if (fingerprint(getSource()) !== snapshot) {
      disableSharing();
      status.textContent = 'Quote lines changed. Press Format for supplier again to use the latest lines.';
    }
  }
  function refreshOutput() {
    if (fingerprint(getSource()) !== snapshot) { checkForChanges(); return; }
    try {
      output.value = formatSupplierRequest(request());
      ready = true;
      root!.querySelectorAll<HTMLButtonElement>('[data-supplier-copy], [data-supplier-download], [data-supplier-csv], [data-supplier-share]').forEach(button => button.disabled = false);
      const href = supplierMailto(output.value, reference.value);
      emailHint.hidden = !!href;
      if (href) { email.href = href; email.removeAttribute('aria-disabled'); }
      else { email.removeAttribute('href'); email.setAttribute('aria-disabled', 'true'); }
      status.textContent = 'Ready to review. Check descriptions, quantities, sizes and product details before sharing.';
    } catch (error) {
      output.value = ''; disableSharing(); emailHint.hidden = true;
      status.textContent = visitorMessage(error, 'Could not format this supplier list.');
    }
  }
  const field = (title: string, value: string, max: number, placeholder: string, onInput: (value: string) => void, multiline = false) => {
    const label = document.createElement('label'); label.append(document.createTextNode(title));
    const input = document.createElement(multiline ? 'textarea' : 'input');
    input.value = value; input.maxLength = max; input.placeholder = placeholder;
    if (input instanceof HTMLTextAreaElement) input.rows = 3;
    else input.type = 'text';
    input.addEventListener('input', () => { onInput(input.value); refreshOutput(); });
    label.append(input); return label;
  };
  open.addEventListener('click', () => {
    const source = getSource();
    panel.hidden = false; open.setAttribute('aria-expanded', 'true');
    if (!source.valid || !source.lines.length || source.lines.length > SUPPLIER_LIMIT) {
      disableSharing(); output.value = ''; list.replaceChildren();
      status.textContent = !source.valid ? 'Fix the highlighted quote quantity before formatting.' : !source.lines.length ? 'Add a quote line first.' : `Use ${SUPPLIER_LIMIT} lines or fewer in one supplier list.`;
      status.scrollIntoView({ block: 'nearest' }); return;
    }
    const prior = new Map(choices.map(c => [c.identity, c]));
    // Identity is kept only in memory; the export uses the explicit label/quantity snapshot.
    choices = source.lines.map(line => ({ ...(prior.get(line) || { included: true, unit: '', details: '' }), identity: line, source: { label: line.label, quantity: line.quantity } }));
    workType = source.workType; snapshot = fingerprint(source);
    if (!initialized) reference.value = source.reference;
    initialized = true;
    list.replaceChildren();
    choices.forEach((choice, index) => {
      const row = document.createElement('article'); row.className = 'supplier-line';
      const label = document.createElement('label'); label.className = 'supplier-choice';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = choice.included;
      checkbox.setAttribute('aria-label', `Include line ${index + 1}: ${choice.source.label}`);
      const words = document.createElement('span'); words.textContent = choice.source.label;
      const qty = document.createElement('span'); qty.className = 'supplier-quantity'; qty.textContent = `Quantity in quote: ${choice.source.quantity}`; words.append(qty); label.append(checkbox, words);
      checkbox.addEventListener('change', () => { choice.included = checkbox.checked; refreshOutput(); });
      row.append(label, field(`Quantity units for line ${index + 1} (optional)`, choice.unit, 40, 'each, sq ft of wall area, boxes…', value => choice.unit = value), field(`Supplier details for line ${index + 1} (optional)`, choice.details, 1000, 'Size (W x H and units), series, frame color, glass, handing…', value => choice.details = value, true));
      list.append(row);
    });
    refreshOutput(); output.focus({ preventScroll: true }); panel.scrollIntoView({ block: 'start' });
  });
  reference.addEventListener('input', refreshOutput); message.addEventListener('input', refreshOutput);
  form.addEventListener('input', event => { if (event.target instanceof Node && !root.contains(event.target)) checkForChanges(); });
  form.addEventListener('change', event => { if (event.target instanceof Node && !root.contains(event.target)) checkForChanges(); });
  const current = () => { checkForChanges(); return ready; };
  root.querySelector('[data-supplier-copy]')?.addEventListener('click', async () => {
    if (!current()) return;
    try { await navigator.clipboard.writeText(output.value); status.textContent = 'Supplier list copied.'; }
    catch { output.focus(); output.select(); status.textContent = 'Copy was unavailable. The list is selected—use Copy on your device.'; }
  });
  const download = (csv: boolean) => {
    if (!current()) return;
    const blob = new Blob([csv ? supplierCsv(request()) : output.value], { type: csv ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `clearview-supplier-request.${csv ? 'csv' : 'txt'}`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = csv ? 'Supplier CSV download started.' : 'Supplier text download started.';
  };
  root.querySelector('[data-supplier-download]')?.addEventListener('click', () => download(false));
  root.querySelector('[data-supplier-csv]')?.addEventListener('click', () => download(true));
  email.addEventListener('click', event => { if (!current() || email.getAttribute('aria-disabled') === 'true') event.preventDefault(); });
  share.hidden = typeof navigator.share !== 'function';
  share.addEventListener('click', async () => {
    if (!current()) return;
    try { await navigator.share({ title: 'Clearview supplier pricing request', text: output.value }); status.textContent = 'Supplier list shared.'; }
    catch (error) { status.textContent = error instanceof Error && error.name === 'AbortError' ? 'Sharing canceled.' : 'Sharing was unavailable. Copy or download the list instead.'; }
  });
  disableSharing();
  return { checkForChanges };
}
