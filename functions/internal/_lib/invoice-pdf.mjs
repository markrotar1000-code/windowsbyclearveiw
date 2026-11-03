import { createPdfTextWrapper } from './pdf-text-wrap.mjs';
import { embedPdfFonts } from './pdf-fonts.mjs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { customerLineText } from './quote-measurements.mjs';
import { formatCents } from './money.mjs';
const safe = value => String(value ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g,'');
export async function invoicePdf(invoice, items, assets = {}) {
 const {logoBytes}=assets; const pdf=await PDFDocument.create(),fonts=await embedPdfFonts(pdf,assets),font=fonts.regular,bold=fonts.bold;let page,y;
 const next=()=>{page=pdf.addPage([612,792]);y=748;};next();
 const wrapText=createPdfTextWrapper();
 function line(value,size=10,heavy=false){const f=heavy?bold:font;for(const para of safe(value).split('\n')){if(!assets.fontBytes){try{f.encodeText(para);}catch{throw new Error('Invoice PDF fonts are unavailable for this customer text. Restore the font assets and try again.');}}for(const row of wrapText(para,f,size,524))draw(row);y-=6;}function draw(v){if(y<60)next();page.drawText(v,{x:44,y,size,font:f,color:rgb(.08,.16,.19)});y-=size+4;}}
 if(logoBytes){try{const logo=await pdf.embedPng(logoBytes),s=logo.scaleToFit(160,70);page.drawImage(logo,{x:44,y:y-s.height,...s});y-=s.height+14;}catch{}}
 line('CLEARVIEW WINDOWS & TRIM LLC',13,true);line('(564) 208-0801 | owner@windowsbyclearveiw.com',9);
 line(invoice.status==='void'?'VOID INVOICE':invoice.balance_cents===0&&invoice.status!=='draft'?'PAYMENT RECEIPT':'INVOICE',20,true);
 line(invoice.invoice_number,12,true);line(`Issued ${invoice.created_at.slice(0,10)}${invoice.due_date?' | Due '+invoice.due_date:''}`);
 line(invoice.customer_name,12,true);line([invoice.customer_address,invoice.customer_city].filter(Boolean).join(', '));line(invoice.customer_email||'');
 for(const item of items){line(customerLineText(item.label),10,true);if(item.description)line(customerLineText(item.description),9);line(`Qty ${item.quantity} | Unit ${formatCents(item.unit_price_cents)} | Amount ${formatCents(item.line_total_cents)}`);}
 line(`Contract total: ${formatCents(invoice.total_cents)}`,11,true);line(`Credits: ${formatCents(invoice.credited_cents||0)}`);line(`Payments received: ${formatCents(invoice.amount_paid_cents||0)}`);line(`BALANCE DUE: ${formatCents(invoice.balance_cents||0)}`,15,true);
 if(invoice.credit_balance_cents)line(`Customer credit / refund to reconcile: ${formatCents(invoice.credit_balance_cents)}`,11,true);
 if(invoice.status==='draft')line('DRAFT - not issued for payment.',11,true);
 if(invoice.review_hold)line(invoice.review_hold,10,true);
 if(invoice.payment_instructions)line(invoice.payment_instructions);line('Payment terms remain those in the signed agreement. Questions? Reply to the invoice email or call (564) 208-0801.',9);
 pdf.getPages().forEach((p,i)=>p.drawText(`${invoice.invoice_number} | ${i+1} / ${pdf.getPageCount()}`,{x:44,y:25,size:8,font}));return pdf.save();
}
