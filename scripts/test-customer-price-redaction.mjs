import assert from 'node:assert/strict';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { quotePdf } from '../functions/internal/_lib/quote-pdf.mjs';
import { publicQuote } from '../functions/internal/_lib/quote-signing.mjs';
const quote={id:'REDACTION-TEST',customer_name:'Test',status:'draft',subtotal_cents:653400,total_cents:653400,custom_payment_terms:'Deposit $1,960.20 upon signing; $4,573.80 upon completion.'};
const items=[200000,110000,100000,90000,100000].map((price,i)=>({label:`Opening ${i+1}`,quantity:1,unit_price_cents:price,line_total_cents:price}));
items.push({label:'Sales tax — Battle Ground 8.9% on $6,000',quantity:1,unit_price_cents:53400,line_total_cents:53400});
const exposed=publicQuote(quote,items);
for(const item of exposed.items){assert.equal('unitPriceCents' in item,false);assert.equal('lineTotalCents' in item,false);}
assert.equal(exposed.items.at(-1).taxAmountCents,53400);
assert.equal(exposed.items[0].taxAmountCents,undefined);
const pdf=await PDFDocument.load(await quotePdf(quote,items));
let content='';
for(const [,obj] of pdf.context.enumerateIndirectObjects())if(obj instanceof PDFRawStream){const raw=Buffer.from(decodePDFRawStream(obj).decode()).toString();for(const m of raw.matchAll(/<([0-9A-F]+)>\s*Tj/gi))content+=Buffer.from(m[1],'hex').toString('latin1')+'\n';}
for(const price of ['$2,000.00','$1,100.00','$1,000.00','$900.00'])assert.ok(!content.includes(price),`Customer PDF leaked ${price}`);
for(const value of ['$6,534.00','$534.00','$1,960.20','$4,573.80','Opening 1','Qty 1'])assert.ok(content.includes(value),`Missing ${value}`);
console.log('PASS customer PDF and public signing payload redact individual prices; scope, tax, total and custom terms retained');
