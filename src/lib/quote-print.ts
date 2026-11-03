/** Print a snapshot of the displayed quote, never the operational dashboard. */
export async function printQuote(source: HTMLElement) {
  document.querySelector('[data-quote-print-frame]')?.remove();
  const frame = document.createElement('iframe');
  frame.dataset.quotePrintFrame = '';
  frame.title = 'Printable ClearView quote';
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:816px;height:1056px;border:0';
  document.body.append(frame);
  try {
    const doc = frame.contentDocument!;
    doc.title = `ClearView Quote ${source.querySelector('[data-quote-id]')?.textContent || ''}`;
    doc.documentElement.lang = 'en';
    const base = doc.createElement('base');
    base.href = document.baseURI;
    doc.head.append(base);
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
    await Promise.all(styles.map((node) => new Promise<void>((resolve, reject) => {
      const copy = node.cloneNode(true) as HTMLElement;
      if (copy.tagName === 'LINK') {
        copy.addEventListener('load', () => resolve(), { once: true });
        copy.addEventListener('error', () => reject(new Error('Print styles failed to load')), { once: true });
      }
      doc.head.append(copy);
      if (copy.tagName !== 'LINK') resolve();
    })));
    const quote = source.cloneNode(true) as HTMLElement;
    quote.querySelectorAll('.no-print, .sig-pad-block').forEach((node) => node.remove());
    // An unsigned digital quote still needs writable signature lines on paper.
    if (source.querySelector('[data-sig-digital-pending]:not([hidden])')) {
      quote.querySelector('[data-sig-pen]')?.removeAttribute('hidden');
    }
    doc.body.append(quote);
    doc.body.style.cssText = 'margin:0;background:white';
    await doc.fonts.ready;
    await Promise.all(Array.from(doc.images).map((img) => img.decode()));
    const win = frame.contentWindow!;
    win.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 0), { once: true });
    win.focus();
    win.print();
  } catch (error) {
    frame.remove();
    throw error;
  }
}
