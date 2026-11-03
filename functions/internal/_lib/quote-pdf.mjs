import { createPdfTextWrapper } from './pdf-text-wrap.mjs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { customerLineText, readMeasurements } from './quote-measurements.mjs';
import { contractTerms } from './pdf-terms.mjs';
import { embedPdfFonts } from './pdf-fonts.mjs';
import { readProductSpecs } from './supplier-specs.mjs';

const text = value => String(value ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '');
const money = value => (Number(value || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export async function quotePdf(quote, items, { supplier = false, logoBytes, fontBytes, boldFontBytes, terms = contractTerms } = {}) {
  const pdf = await PDFDocument.create();
  const {regular,bold} = await embedPdfFonts(pdf,{fontBytes,boldFontBytes});
  pdf.setTitle(supplier ? `Supplier RFQ ${quote.id}` : `Customer quote ${quote.id} - ${quote.customer_name || ""}`);
  let page, y;
  function next() { page = pdf.addPage([612, 792]); y = 748; }
  next();
  const wrapText = createPdfTextWrapper();
  function line(value, { size = 10, heavy = false, gap = 6 } = {}) {
    const font = heavy ? bold : regular;
    for (const paragraph of text(value).split('\n')) {
      for (const row of wrapText(paragraph, font, size, 524)) draw(row);
      y -= gap;
    }
    function draw(row) { if (y < 55) next(); page.drawText(row, { x: 44, y, size, font, color: rgb(.08, .16, .19) }); y -= size + 4; }
  }
  if (logoBytes) { try { const logo = await pdf.embedPng(logoBytes); const scaled = logo.scaleToFit(160, 70); page.drawImage(logo, { x: 44, y: y - scaled.height, width: scaled.width, height: scaled.height }); y -= scaled.height + 14; } catch {} }
  line('CLEARVIEW WINDOWS & TRIM LLC', { heavy: true, size: 13 });
  line('(564) 208-0801 | owner@windowsbyclearveiw.com | WA L&I CLEARVW74601', { size: 9 });
  const documentLabel = supplier ? 'SUPPLIER SPECIFICATION / PRICING REQUEST' : quote.revision_kind === 'change-order' ? 'CHANGE ORDER' : quote.revision_kind === 'revision' ? 'REVISED QUOTE' : 'CUSTOMER QUOTE';
  line(documentLabel, { heavy: true, size: 17, gap: 12 });
  line(`Reference: ${quote.id} | ${String(quote.created_at || '').slice(0, 10)}`, { heavy: true });
  if (!supplier && quote.revision_of) line(`Source quote: ${quote.revision_of}`, { heavy: true });
  if (!supplier && quote.status !== 'finalized') line('DRAFT - awaiting customer acceptance', { heavy: true });
  if (supplier) {
    line('Request for quotation only. Please return pricing, availability, lead time and exceptions.');
    line('Dimensions are recorded field measurements. Rough openings are not manufacturing sizes. Confirm final order sizes, series, configuration, handing, color, glass and accessories before fabrication.');
  } else {
    line(`Prepared for: ${quote.customer_name}`);
    line([quote.customer_address, quote.customer_city].filter(Boolean).join(', '));
    line([quote.customer_phone, quote.customer_email].filter(Boolean).join(' | '));
  }
  line(supplier ? 'ITEM / OPENING SCHEDULE' : 'SCOPE & PRICING', { heavy: true, size: 12 });
  for (const [index, item] of items.entries()) {
    line(`${index + 1}. ${customerLineText(item.label)}`, { heavy: true });
    if (supplier) {
      line(`Quantity: ${item.quantity}`);
      const specs = readProductSpecs(item);
      for (const [key,value] of Object.entries(specs)) if(value) line(`${key.replace(/([A-Z])/g,' $1')}: ${value}`,{size:9});
      const rows = readMeasurements(item);
      if (!rows.length) line('Dimensions / measurement type: NOT PROVIDED - confirm with ClearView.');
      for (const [n, m] of rows.entries()) { line(`Opening ${index + 1}.${n + 1}${m.location ? ' - ' + m.location : ''}: ${m.width && m.height ? m.width + ' W x ' + m.height + ' H inches' : 'SIZE NEEDED'} | ${m.kind === 'rough-opening' ? 'ROUGH OPENING' : m.kind === 'unit' ? 'UNIT SIZE' : 'MEASUREMENT TYPE UNCONFIRMED'}`); for(const [key,value] of Object.entries(m.productSpecs||{})) if(value)line(`  ${key}: ${value}`,{size:9}); }
      if (rows.length < Number(item.quantity)) line(`${Number(item.quantity) - rows.length} opening(s) still need measurements.`);
      line(`Product / finish / glass / handing: ${customerLineText(item.description) || 'Use the line description above; unspecified details require confirmation.'}`, { size: 9 });
    } else {
      line(`Qty ${item.quantity} | Unit ${money(item.unit_price_cents)} | Amount ${money(item.line_total_cents)}`);
      if (item.description) line(customerLineText(item.description), { size: 9 });
    }
  }
  if (supplier) {
    line('SUPPLIER RESPONSE', { heavy: true, size: 12 });
    line('Quote number: __________________  Valid through: __________________');
    line('Lead time: __________________  Freight / tax: __________________');
    line('Exceptions / substitutions: ________________________________________');
    line('Send your itemized quotation and product submittals to owner@windowsbyclearveiw.com.');
  } else {
    line(`Subtotal: ${money(quote.subtotal_cents)}`);
    if (Number(quote.discount_cents)) line(`Discount: -${money(quote.discount_cents)}`);
    line(`TOTAL: ${money(quote.total_cents)}`, { heavy: true, size: 14 });
    next();
    line(`TERMS & ACCEPTANCE - ${quote.id}`, { heavy: true, size: 13 });
    for (const key of ['paymentTerms', 'changeOrders', 'warranty', 'delays', 'governingLaw']) line(terms[key], { size: 9 });
    line(terms.rightToCancel.heading, { heavy: true });
    terms.rightToCancel.body.forEach(p => line(p, { size: 9 }));
    line(terms.acknowledgement, { size: 9 });
    if (quote.status === 'finalized') {
      line(`Signed by: ${quote.signature_name || 'Customer'} | ${quote.signed_at || ''}`);
      // Signature markup is never executed. Only server-generated path geometry is drawn.
      const paths = [...String(quote.signature_svg || '').matchAll(/<path\b[^>]*\bd=["']([^"']+)["']/g)].map(match => match[1]).filter(path => /^[MmLlHhVvCcSsQqTtAaZz0-9.,+\-\sEe]+$/.test(path));
      if(paths.length) {
        if(y<130)next();
        const signatureY=y-5;
        for(const path of paths)page.drawSvgPath(path,{x:44,y:signatureY,scale:.6,borderColor:rgb(.08,.16,.19),borderWidth:1});
        y-=115;
      }
    }
    else line('Customer signature: _______________________  Date: ______________');
    line('For ClearView: ____________________________  Date: ______________');
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`${quote.id} | ${supplier ? 'Supplier RFQ' : 'Customer quote'} | ${i + 1} / ${pages.length}`, { x: 44, y: 25, size: 8, font: regular }));
  return pdf.save();
}

