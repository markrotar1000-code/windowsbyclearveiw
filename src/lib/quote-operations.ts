import { isOpeningLine } from '../../functions/_lib/build-plan-rules.mjs';
import { fetchJson } from './internal-fetch';
import { loadFailureMessage } from './load-failed';
import { readMeasurements } from '../../functions/internal/_lib/quote-measurements.mjs';
import { readProductSpecs } from '../../functions/internal/_lib/supplier-specs.mjs';
import { measurementEditor } from './quote-measurements';
import { productSpecEditor } from './quote-product-specs';
export function bindQuoteOperations(quote: any) {
  const root = document.querySelector('[data-operational-corrections]') as HTMLElement;
  if (!root) return; root.dataset.latestRevision = String(quote.revision || 1);
  if (root.dataset.bound) return; root.dataset.bound = 'true';
  let dirty = false;
  let revision: number, rows: any[] = [];
  const form = root.querySelector('form')!, fields = root.querySelector('[data-operational-items]')!, status = root.querySelector('[data-operational-status]')!, history = root.querySelector('[data-operational-history]')!;
  async function load() {
    try {
      const data = await fetchJson(`/internal/api/quote-operations?quoteId=${encodeURIComponent(quote.id)}`);
      dirty = false; revision = data.revision; rows = data.items.map((item: any) => ({ ...item, measurements: readMeasurements(item), productSpecs: readProductSpecs(item) }));
      fields.replaceChildren(...rows.map(item => {
        const wrapper = document.createElement('section'); const title = document.createElement('h3'); title.textContent = item.label; wrapper.append(title); if (isOpeningLine(item.label) && Number.isInteger(Number(item.quantity))) wrapper.append(measurementEditor(item).box); wrapper.append(productSpecEditor(item)); return wrapper;
      }));
      history.replaceChildren(...(data.history || []).map((event: any) => { const p = document.createElement('p'); p.textContent = `${event.at || event.created_at || ''} · ${event.note || event.reason || 'Private measurements updated'}`; return p; }));
    } catch (error) { status.textContent = loadFailureMessage(error); }
  }
  const refresh = document.createElement('button'); refresh.type = 'button'; refresh.className = 'btn btn-ghost'; refresh.textContent = 'Reload corrections (discard unsaved edits)'; root.querySelector('summary')!.after(refresh); refresh.addEventListener('click', () => { void load(); });
  form.addEventListener('input', () => { dirty = true; });
  root.addEventListener('toggle', () => {
    if (!(root as HTMLDetailsElement).open) return;
    if (!rows.length || (Number(root.dataset.latestRevision) !== revision && !dirty)) void load();
    else if (Number(root.dataset.latestRevision) !== revision) status.textContent = 'The quote changed. Reload corrections to use the current lines before saving.';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (Number(root.dataset.latestRevision) !== revision) { status.textContent = 'The quote changed. Reload corrections before saving.'; return; }
    const button = form.querySelector('button')!; button.disabled = true;
    try {
      await fetchJson('/internal/api/quote-operations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteId: quote.id, expectedRevision: revision, note: new FormData(form).get('note'), items: rows.map(item => ({ itemId: item.id, measurements: item.measurements, productSpecs: item.productSpecs })) }) });
      status.textContent = 'Private details saved with an audit record. Any active job receives an updated production snapshot.'; await load(); document.dispatchEvent(new CustomEvent('cv:quote-updated'));
    } catch (error) { status.textContent = loadFailureMessage(error); }
    finally { button.disabled = false; }
  });
  document.querySelectorAll<HTMLButtonElement>('[data-create-revision]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    if (button.dataset.createRevision === 'change-order') { location.href = `/internal/quotes/new?revisionOf=${encodeURIComponent(quote.id)}&revisionKind=change-order`; return; }
    try {
      const result = await fetchJson('/internal/api/quote-revision', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteId: quote.id, kind: button.dataset.createRevision }) });
      location.href = `/internal/quotes/new?edit=${encodeURIComponent(result.id)}`;
    } catch (error) { status.textContent = loadFailureMessage(error); button.disabled = false; (root as HTMLDetailsElement).open = true; }
  }));
}
