import { fetchJson } from './internal-fetch';
import { loadFailureMessage } from './load-failed';
export function bindSupplierResponses(quoteId: string) {
  const host = document.querySelector('[data-supplier-responses]') as HTMLElement;
  if (!host || host.dataset.bound) return; host.dataset.bound = 'true';
  let sourceHash = '';
  const form = host.querySelector('form')!;
  const status = host.querySelector('[data-supplier-response-status]')!;
  const history = host.querySelector('[data-supplier-response-history]')!;
  async function load() {
    try {
      const data = await fetchJson(`/internal/api/supplier-responses?quoteId=${encodeURIComponent(quoteId)}`);
      sourceHash = data.sourceHash;
      history.replaceChildren(...data.responses.map((row: any) => {
        const p = document.createElement('p');
        p.textContent = `${row.supplier} · ${row.reference || 'No reference'}${row.amount_cents !== null ? ` · $${(row.amount_cents / 100).toFixed(2)}` : ''} · ${row.current ? 'Matches current specifications' : 'Earlier specification version'}${row.lead_time ? ` · ${row.lead_time}` : ''}${row.valid_until ? ` · Valid through ${row.valid_until}` : ''}${row.notes ? ` · ${row.notes}` : ''}`;
        return p;
      }));
      if (!data.responses.length) history.textContent = 'No supplier responses recorded yet.';
    } catch (error) { status.textContent = loadFailureMessage(error); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); const fields = new FormData(form); const button = form.querySelector('button')!; button.disabled = true;
    try {
      const amount = String(fields.get('amount') || '').trim();
      await fetchJson('/internal/api/supplier-responses', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteId, sourceHash, supplier: fields.get('supplier'), reference: fields.get('reference'), amountCents: amount ? Math.round(Number(amount) * 100) : null, leadTime: fields.get('leadTime'), validUntil: fields.get('validUntil'), notes: fields.get('notes') }) });
      status.textContent = 'Supplier response recorded. This does not place an order.'; form.reset(); await load();
    } catch (error) { status.textContent = loadFailureMessage(error); }
    finally { button.disabled = false; }
  });
  void load();
}
