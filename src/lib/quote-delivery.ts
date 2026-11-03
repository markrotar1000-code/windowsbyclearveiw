import { fetchJson } from './internal-fetch';
import { loadFailureMessage } from './load-failed';

export function bindQuoteDelivery(quote: any) {
  const root = document.querySelector('[data-delivery]') as HTMLElement;
  if (!root) return;
  root.hidden = false;
  const email = root.querySelector('[data-delivery-email]') as HTMLInputElement;
  const phone = root.querySelector('[data-delivery-phone]') as HTMLInputElement;
  const supplier = root.querySelector('[data-supplier-email]') as HTMLInputElement;
  const status = root.querySelector('[data-delivery-status]') as HTMLElement;
  email.value = quote.customer_email || '';
  phone.value = quote.customer_phone || '';
  const url = (kind: string) => `/internal/api/quote-delivery?quoteId=${encodeURIComponent(quote.id)}&kind=${kind}`;
  root.querySelectorAll<HTMLAnchorElement>('[data-pdf-kind]').forEach(a => { a.href = url(a.dataset.pdfKind!); });
  const previous = (root as any).__deliveryAbort as AbortController | undefined;
  previous?.abort();
  const controller = new AbortController();
  (root as any).__deliveryAbort = controller;
  const listen = (node: Element, event: string, callback: any) => node.addEventListener(event, callback, { signal: controller.signal });
  root.querySelectorAll<HTMLButtonElement>('[data-send-kind]').forEach(button => listen(button, 'click', async () => {
    const kind = button.dataset.sendKind;
    const input = kind === 'supplier' ? supplier : email;
    if (!input.value || !input.reportValidity()) { input.focus(); return; }
    button.disabled = true; status.textContent = 'Sending PDF…';
    try {
      const result = await fetchJson('/internal/api/quote-delivery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteId: quote.id, kind, to: input.value }) });
      status.textContent = `Email accepted for delivery to ${result.to}.`;
    } catch (error) { status.textContent = loadFailureMessage(error); }
    finally { button.disabled = false; }
  }));
  const prepare = root.querySelector('[data-prepare-share]') as HTMLButtonElement;
  const share = root.querySelector('[data-share-pdf]') as HTMLButtonElement;
  let file: File | null = null;
  prepare.hidden = false; share.hidden = true;
  listen(prepare, 'click', async () => {
    prepare.disabled = true; status.textContent = 'Preparing the quote PDF…';
    try {
      const response = await fetch(url('customer'));
      if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw new Error('The PDF could not be prepared. Refresh the quote and try again.');
      if (controller.signal.aborted) return;
      file = new File([await response.blob()], `ClearView-Quote-${quote.id}.pdf`, { type: 'application/pdf' });
      share.hidden = false; prepare.hidden = true;
      status.textContent = 'PDF ready. Tap Text / share PDF, choose Messages, then choose the customer. Your phone controls the recipient.';
    } catch (error) { status.textContent = loadFailureMessage(error); }
    finally { prepare.disabled = false; }
  });
  listen(share, 'click', async () => {
    if (!file) return;
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `ClearView quote ${quote.id}`, text: `Your ClearView quote ${quote.id}` });
        status.textContent = 'Returned from sharing. Check your messaging app to confirm it was sent.';
      } else {
        const href = URL.createObjectURL(file); const a = document.createElement('a'); a.href = href; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(href), 10000);
        status.textContent = 'PDF downloaded. This browser cannot attach files through sharing; attach the downloaded PDF in your messaging app.';
      }
    } catch (error) { if ((error as Error).name !== 'AbortError') status.textContent = loadFailureMessage(error); }
  });
  listen(root.querySelector('[data-open-text]')!, 'click', () => {
    const number = phone.value.replace(/[^\d+]/g, '');
    if (!number) { phone.focus(); return; }
    const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    location.href = `sms:${number}${separator}body=${encodeURIComponent(`Hi, here is your ClearView quote ${quote.id}.`)}`;
    status.textContent = 'Text app opened for this number. Use Text / share PDF to attach the document through your phone’s sharing menu.';
  });
  prepare.click();
}
