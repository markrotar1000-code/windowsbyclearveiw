import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {}
if (!chromium || !process.env.CHROMIUM_PATH) { console.log('SKIP: quote print browser checks require Playwright and CHROMIUM_PATH'); process.exit(0); }
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const dist=path.resolve('dist');
const server=http.createServer((req,res)=>{let f=path.join(dist,new URL(req.url,'http://x').pathname);if(!path.extname(f))f+='.html';fs.readFile(f,(e,d)=>{res.writeHead(e?404:200,{'content-type':f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':'application/octet-stream'});res.end(e?'':d);});}).listen(0);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
try {
 const p=await browser.newPage();
 await p.addInitScript(()=>{window.print=()=>{};});
 let count=3;
 await p.route('**/internal/api/**',r=>r.fulfill({json:r.request().url().endsWith('/quotes/Q-TEST')?{quote:{id:'Q-TEST',status:'draft',work_type:'replacement',created_at:'2026-11-03T12:00:00Z',customer_name:'Sample Customer',customer_address:'123 Example Street',customer_city:'Vancouver',customer_email:'sample@example.com',customer_phone:'(555) 010-0100',subtotal_cents:count*85000,total_cents:count*85000,signature_method:'digital'},items:Array.from({length:count},(_,i)=>({id:i,label:'Slider — Vinyl — Cascade — insert'+(count>3?' with interior trim and a longer description for pagination testing':''),quantity:1,unit_price_cents:85000,line_total_cents:85000}))}:{}}));
 for(const n of [3,45]){
 count=n; await p.goto(`http://localhost:${server.address().port}/internal/quotes/view?id=Q-TEST`);
 await p.locator('[data-contract]:not([hidden])').waitFor();
 await p.locator('[data-print-btn]').click();
 await p.waitForFunction(()=>document.querySelector('[data-quote-print-frame]')?.contentDocument?.querySelector('.contract'));
 const frame=p.frames().find(f=>f!==p.mainFrame());
 await frame.waitForFunction(()=>document.images[0]?.complete);
 assert.equal(await frame.locator('[data-contract-items] tr').count(),n);
 assert.equal(await frame.locator('.qv-toolbar, .flow-bar, canvas, input').count(),0);
 assert.equal(await frame.locator('[data-sig-pen]').getAttribute('hidden'),null);
 const html=await frame.content();
 const pdfPage=await browser.newPage();await pdfPage.setContent(html);await pdfPage.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
 await pdfPage.pdf({preferCSSPageSize:true,printBackground:true});

 await pdfPage.close();
 await p.setViewportSize({width:390,height:844});await p.emulateMedia({media:'screen'});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile overflow');
 console.log(`PASS: ${n} lines, isolated document, logo, unsigned digital paper lines, mobile layout`);
 }
} finally {await browser.close();server.close();}

