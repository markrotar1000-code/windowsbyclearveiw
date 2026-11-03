import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { embedPdfFonts } from '../functions/internal/_lib/pdf-fonts.mjs';
import { createPdfTextWrapper } from '../functions/internal/_lib/pdf-text-wrap.mjs';
import { quotePdf } from '../functions/internal/_lib/quote-pdf.mjs';
import { invoicePdf } from '../functions/internal/_lib/invoice-pdf.mjs';
const assets={fontBytes:new Uint8Array(fs.readFileSync('public/fonts/NotoSans-Regular.ttf')),boldFontBytes:new Uint8Array(fs.readFileSync('public/fonts/NotoSans-Bold.ttf'))};
const pdf=await PDFDocument.create(),fonts=await embedPdfFonts(pdf,assets),wrap=createPdfTextWrapper();
const corpus=['José Іванов — façade installation, glass and hardware. '.repeat(8),'A'.repeat(500),'','one two three','Windows and materials carry the manufacturer’s own warranty.'];
function legacy(text,font,size,max){const rows=[];let row='';for(const word of text.split(/\s+/)){if(font.widthOfTextAtSize((row?row+' ':'')+word,size)>max&&row){rows.push(row);row='';}let part=word;while(font.widthOfTextAtSize(part,size)>max){let n=part.length;while(font.widthOfTextAtSize(part.slice(0,n),size)>max)n--;if(row){rows.push(row);row='';}rows.push(part.slice(0,n));part=part.slice(n);}row+=(row&&part?' ':'')+part;}rows.push(row);return rows;}
for(const font of Object.values(fonts))for(const size of [8,9,10,13,17])for(const text of corpus){const rows=wrap(text,font,size,524);assert.deepEqual(rows,legacy(text,font,size,524),'same text/pagination boundaries as original for actual Noto fonts');for(const row of rows)assert.ok(font.widthOfTextAtSize(row,size)<=524.001);assert.equal(rows.join('').replace(/\s/g,''),text.replace(/\s/g,''),'all Unicode text retained');}
let measures=0;const fake={widthOfTextAtSize(text,size){measures++;return Array.from(text).length*size;}};const counted=createPdfTextWrapper();counted('repeat '.repeat(1000),fake,10,524);assert.ok(measures<=3,'repeated words are measured once per font');counted('repeat',fake,9,524);assert.ok(measures<=3,'cached unit width reused across font sizes');
const drawn=[],draw=PDFPage.prototype.drawText;PDFPage.prototype.drawText=function(text,options){drawn.push({text,...options});return draw.call(this,text,options);};
try{
 const quote={id:'Q-WRAP',created_at:'2026-11-03',status:'draft',customer_name:'José Іванов',total_cents:200,subtotal_cents:200};
 const items=Array.from({length:24},(_,i)=>({label:`${i+1}. José Іванов — ${'W'.repeat(100)}`,quantity:1,unit_price_cents:100,line_total_cents:100}));
 const customer=await quotePdf(quote,items,assets);assert.ok((await PDFDocument.load(customer)).getPageCount()>2);
 const invoice=await invoicePdf({...quote,invoice_number:'INV-WRAP',balance_cents:200},items,assets);assert.ok((await PDFDocument.load(invoice)).getPageCount()>1);
 for(const line of drawn){assert.ok(line.font.widthOfTextAtSize(line.text,line.size)<=524.001,`line stays in column: ${line.text}`);assert.ok(line.y>=25&&line.y<=748);}
 assert.ok(drawn.some(line=>line.text.includes('José Іванов')));
}finally{PDFPage.prototype.drawText=draw;}
console.log('PASS: cached PDF wrapping preserves Unicode and line boundaries, bounds long tokens, and paginates quotes/invoices without overflow');
