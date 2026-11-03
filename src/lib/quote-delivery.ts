import { fetchJson, InternalFetchError } from './internal-fetch';
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
  const attempts = new Map<string,string>();
  const listen = (node: Element, event: string, callback: any) => node.addEventListener(event, callback, { signal: controller.signal });
  root.querySelectorAll<HTMLButtonElement>('[data-send-kind]').forEach(button => listen(button, 'click', async () => {
    const kind = button.dataset.sendKind;
    const input = kind === 'supplier' ? supplier : email;
    if (!input.value || !input.reportValidity()) { input.focus(); return; }
    const attemptKey = `${kind}:${input.value}`;
    const storageKey=`cv-delivery:${quote.id}:${quote.revision||quote.updated_at}:${attemptKey}`;
    if (!attempts.has(attemptKey)) { let remembered='';try{remembered=sessionStorage.getItem(storageKey)||'';}catch{} const next=remembered||crypto.randomUUID();attempts.set(attemptKey,next);try{sessionStorage.setItem(storageKey,next);}catch{} }
    button.disabled = true; status.textContent = 'Sending PDF…';
    try {
      const result = await fetchJson('/internal/api/quote-delivery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteId: quote.id, kind, to: input.value, requestId: attempts.get(attemptKey) }) });
      attempts.delete(attemptKey);
      try{sessionStorage.removeItem(storageKey);}catch{}
      await refreshHistory();
      status.textContent = `Email accepted for delivery to ${result.to}.`;
    } catch (error) {
      // Delivery conflicts require a fresh explicit send (changed document,
      // replaced signing link or unrecoverable configuration). Retaining this
      // ID would trap every later click in the same conflict. Never auto-send.
      if(error instanceof InternalFetchError && error.status===409){
        attempts.delete(attemptKey);
        try{sessionStorage.removeItem(storageKey);}catch{}
      }
      status.textContent = loadFailureMessage(error);
    }
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
  const signed = quote.status === 'finalized';
  const customerSend=root.querySelector('[data-send-kind="customer"]');
  if(customerSend)customerSend.textContent=signed?'Email signed copy':'Email quote + signing link';
  let history=root.querySelector('[data-delivery-history]') as HTMLElement;
  if(!history){history=document.createElement('details');history.dataset.deliveryHistory='';root.append(history);}
  async function refreshHistory(){
    try{const data=await fetchJson(`/internal/api/quote-delivery?quoteId=${encodeURIComponent(quote.id)}&history=1`);if(controller.signal.aborted)return;history.replaceChildren();const title=document.createElement('summary');title.textContent='Delivery history';history.append(title);const list=document.createElement('ul');for(const item of [...(data.history||[]),...(data.supplierHistory||[])].sort((a,b)=>b.created_at.localeCompare(a.created_at))){const li=document.createElement('li');li.textContent=`${item.document_kind} · ${item.recipient} · ${item.status||'queued'} · ${new Date(item.created_at).toLocaleString()}`;list.append(li);}if(!list.children.length){const li=document.createElement('li');li.textContent='No delivery attempts recorded yet.';list.append(li);}history.append(list);}catch{}}
  void refreshHistory();
  const supplierLabel=supplier.closest('label');
  if(supplierLabel){
    let select=root.querySelector('[data-saved-supplier]') as HTMLSelectElement;
    if(!select){select=document.createElement('select');select.dataset.savedSupplier='';select.setAttribute('aria-label','Saved supplier');supplierLabel.before(select);}
    const updateContacts=async()=>{try{const data=await fetchJson('/internal/api/quote-delivery?contacts=1');if(controller.signal.aborted)return;select.replaceChildren(new Option('Choose saved supplier',''));for(const item of data.contacts||[])select.append(new Option(`${item.name} (${item.email})`,item.email));}catch{}};
    listen(select,'change',()=>{if(select.value)supplier.value=select.value;});
    let save=root.querySelector('[data-save-supplier]') as HTMLButtonElement;
    if(!save){save=document.createElement('button');save.type='button';save.className='btn btn-ghost';save.dataset.saveSupplier='';save.textContent='Save supplier contact';supplierLabel.after(save);}
    listen(save,'click',async()=>{if(!supplier.value||!supplier.reportValidity())return;try{await fetchJson('/internal/api/quote-delivery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'save-supplier',email:supplier.value,name:supplier.value})});status.textContent='Supplier contact saved.';await updateContacts();}catch(error){status.textContent=loadFailureMessage(error);}});
    void updateContacts();
  }
  prepare.click();
}
