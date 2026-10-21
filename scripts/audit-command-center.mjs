// Runs the Command Center for real, without a Cloudflare account: serves the built site (dist/) and routes
// /internal/api/* to the REAL Pages Function handlers over a seeded in-memory SQLite (no login: the middleware
// is covered by test:access). Then opens every /internal page in a phone-sized browser and reports script
// errors, failed or error API responses, and pages that scroll sideways.
//
//   npm i --no-save playwright
//   npm run build
//   CHROMIUM_PATH=/path/to/chrome node scripts/audit-command-center.mjs [--serve]    (--serve: just run the server on :4440)
//
// Add --flows-only to run just the interaction checks (including measurement editing and local photo capture).
//
// The seed goes through the handlers themselves (quotes, signed plans, jobs, payments, tasks) plus leads with
// messy values: a 1,800-character note, an HTML-looking name, long emails and links with no spaces. That is what
// found, on 2026-10-12: the closeout API failing on a database that had never opened Field, and 22 of 58 page
// views scrolling sideways on long text (the leads list by 11,000 px).
//
// Expected, not bugs: siding and general jobs answer 409 on the window-only pages (Build Plan, Field, Closeout)
// and those pages show a plain "does not apply" message.
// Not part of `npm run test:all`: it needs Playwright and a Chromium, which this repo does not install.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createD1 } from './_lib/d1-sqlite.mjs';
import { ensureSupplierTables } from '../functions/internal/_lib/supplier-permits.mjs';
import { ensureMailPilotTables } from '../functions/internal/_lib/mail-pilot.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
process.chdir(root); process.removeAllListeners('warning');
const dist = root + '/dist';
if (!fs.existsSync(dist + '/internal')) { console.error('dist/ not found. Run `npm run build` first.'); process.exit(2); }
const PORT = 4440;
const env = { QUOTES_DB: createD1({ schemaFiles: ['functions/api/_data/schema.sql', 'internal/db/schema.sql'] }) };
const mod = new Map();
const load = async (f) => { if (!mod.has(f)) mod.set(f, await import(pathToFileURL(`${root}/functions/internal/api/${f}`).href)); return mod.get(f); };
async function api(method, url, body, params = {}) {
  const m = await load(url.f);
  const h = m['onRequest' + method[0] + method.slice(1).toLowerCase()] || m.onRequest;
  if (!h) return { status: 405, body: '{}', type: 'application/json' };
  const request = new Request('http://x' + url.p, { method, headers: { 'content-type': 'application/json' }, body: body && method !== 'GET' ? body : undefined });
  const r = await h({ request, env, params, waitUntil: () => {}, next: () => new Response('') });
  return { status: r.status, body: await r.text(), type: r.headers.get('content-type') || 'application/json' };
}
const call = async (f, method, p, obj, params) => JSON.parse((await api(method, { f, p }, obj && JSON.stringify(obj), params)).body);

// ---- seed, through the real handlers
const D=env.QUOTES_DB.raw;
const ins=D.prepare("INSERT INTO leads (created_at,name,phone,email,city,role,notes,first_referrer,first_utm_source,landing_path,visit_count,page_views_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
const now=Date.now();const iso=(d)=>new Date(now-d*864e5).toISOString();
ins.run(iso(0.1),'Pat Doe','(360) 555-0100','pat@example.com','Camas','Homeowner','Four windows, drafty\nSliding door too','https://www.google.com/','', '/areas/camas',3,JSON.stringify([{path:'/areas/camas',title:'Window Replacement & Installation in Camas, WA'},{path:'/estimate',title:'Request an estimate'}]));
ins.run(iso(2),'María José Núñez-Oyelaran-Whitfield the Third','(503) 555-0199',null,'Vancouver','Builder / GC','x'.repeat(1800),'https://l.facebook.com/l.php?u=abc','', '/',1,'[]');
ins.run(iso(5),'<script>alert(1)</script>','3605550111','a@b.co',null,null,'"quoted" & <b>bold</b> \u{1F3E0}',null,'Nextdoor','/guides/fogged-windows',12,'not json');
ins.run(iso(40),'Old Lead','(360) 555-0000','','Washougal','Homeowner',null,'https://windowsbyclearview.com/','', '/replacement',2,'[]');
const mk=async(customer,items,extra={})=>{const c=await call('quotes/index.js','POST','/internal/api/quotes',{customer,signatureMethod:'pen',items,...extra});return c.id};
const customer={name:'Pat Doe',phone:'(360) 555-0100',email:'pat@example.com',address:'1 Main St',city:'Camas'};
const q1=await mk(customer,[{label:'Milgard vinyl slider',quantity:6,unitPriceCents:90000},{label:'Trim',quantity:1.5,unitPriceCents:12345}],{discountCents:5000,discountReason:'Repeat customer'});
const q2=await mk({...customer,name:'Maria Núñez',city:'Vancouver'},[{label:'Cascade double-hung',quantity:3,unitPriceCents:75050}]);
const q3=await mk({...customer,name:'Siding Sam'},[{label:'Hardie lap siding labor',quantity:1200,unitPriceCents:300}],{workType:'siding'});
const q4=await mk({...customer,name:'Draft Dana'},[{label:'Picture window',quantity:2,unitPriceCents:50000}]);
for(const id of [q1,q2]){const g=await call('build-plan.js','GET','/internal/api/build-plan?quoteId='+id);await call('build-plan.js','POST','/internal/api/build-plan',{quoteId:id,plan:g.plan});await call('build-plan-state.js','POST','/internal/api/build-plan-state',{quoteId:id,action:'submit-review'});await call('build-plan-state.js','POST','/internal/api/build-plan-state',{quoteId:id,action:'approve'});}
for(const id of [q1,q2,q3])await call('quotes/[id].js','PATCH','/internal/api/quotes/'+id,{confirmPen:true,signatureName:'Pat Doe'},{id});
const j1=(await call('jobs.js','POST','/internal/api/jobs',{quoteId:q1})).id;const j2=(await call('jobs.js','POST','/internal/api/jobs',{quoteId:q2})).id;const j3=(await call('jobs.js','POST','/internal/api/jobs',{quoteId:q3})).id;
await call('jobs.js','PATCH','/internal/api/jobs?id='+j1,{status:'scheduled',scheduledDate:new Date(now+2*864e5).toISOString().slice(0,10),scheduledWindow:'8-10am'});
const g1=(await call('jobs.js','POST','/internal/api/jobs',{workType:'general',customerName:'Gale',workDescription:'Deck repair',agreedAmount:'4800.50'})).id;
await call('payments.js','PATCH','/internal/api/payments?jobId='+j1,{amountPaidCents:200000,paymentMethod:'check'});
await call('tasks.js','POST','/internal/api/tasks',{title:'Call Pat back',dueAt:new Date(now-864e5).toISOString(),leadId:1});await call('tasks.js','POST','/internal/api/tasks',{title:'Order glass for Núñez',dueAt:new Date(now+36e5).toISOString()});
const LONG=(c,n)=>c.repeat(n);
const qL=await mk({name:LONG('W',150),phone:'(360) 555-0100',email:LONG('e',60)+'@'+LONG('d',60)+'.example.com',address:LONG('A',200),city:LONG('C',100)},[{label:LONG('L',250),description:LONG('x',400),quantity:2,unitPriceCents:50000}],{notes:LONG('n',900),discountReason:LONG('r',190),discountCents:100});
for(const id of [qL]){const g=await call('build-plan.js','GET','/internal/api/build-plan?quoteId='+id);await call('build-plan.js','POST','/internal/api/build-plan',{quoteId:id,plan:g.plan});await call('build-plan-state.js','POST','/internal/api/build-plan-state',{quoteId:id,action:'submit-review'});await call('build-plan-state.js','POST','/internal/api/build-plan-state',{quoteId:id,action:'approve'});}
await call('quotes/[id].js','PATCH','/internal/api/quotes/'+qL,{confirmPen:true,signatureName:LONG('S',150)},{id:qL});
const jL=(await call('jobs.js','POST','/internal/api/jobs',{quoteId:qL})).id;
await call('jobs.js','PATCH','/internal/api/jobs?id='+jL,{status:'scheduled',scheduledDate:new Date(now+3*864e5).toISOString().slice(0,10),scheduledWindow:LONG('w',110),notes:LONG('n',500)});
const gL=(await call('jobs.js','POST','/internal/api/jobs',{workType:'general',customerName:LONG('G',150),workDescription:LONG('D',300),agreedAmount:'99999.99'})).id;
await call('tasks.js','POST','/internal/api/tasks',{title:LONG('T',230),notes:LONG('n',900),dueAt:new Date(now-2*864e5).toISOString()});
ins.run(iso(1),LONG('N',110),'(360) 555-0123',LONG('m',100)+'@example.com',LONG('Z',70),'Homeowner',LONG('/',50)+'https://example.com/'+LONG('p',300),'https://example.com/'+LONG('r',200),LONG('u',60),'/'+LONG('l',150),2,JSON.stringify([{path:'/'+LONG('p',180),title:LONG('t',160)}]));
// Made-up Ask activity and a small Mail pilot load, so those pages render real rows (long text, a refused answer, a hold segment).
D.exec(`CREATE TABLE IF NOT EXISTS ask_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL, model_used TEXT NOT NULL, tools_used TEXT NOT NULL DEFAULT '[]', sources TEXT NOT NULL DEFAULT '[]', match_count INTEGER NOT NULL DEFAULT 0, refused INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS ask_handoffs (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, kind TEXT NOT NULL);`);
const al=D.prepare("INSERT INTO ask_logs (created_at,question,answer,model_used,tools_used,sources,match_count,refused) VALUES (?,?,?,?,?,?,?,?)");
al.run(iso(0.2),'How much for 8 vinyl windows?','Pricing depends on the measured openings, so I cannot quote a number here. The free estimate form is the fastest way to get one.','sonnet','["calculator"]','[{"title":"What windows cost","url":"/guides/window-costs","score":0.9}]',2,0);
al.run(iso(1),'Can you fix my garage door?','I can only help with windows, doors and siding.','sonnet','[]','[]',0,1);
al.run(iso(3),'W'.repeat(400),'A'.repeat(1500),'sonnet','["calculator","guide-search"]','[{"title":"Fogged windows","url":"/guides/fogged-windows"},{"title":"Vinyl vs fiberglass","url":"https://example.com/x"}]',5,0);
al.run(iso(4),'[redacted]','[redacted]','haiku','[]','[]',0,0);
for (const k of ['estimate','call','estimate','callback_open']) D.prepare("INSERT INTO ask_handoffs (created_at,kind) VALUES (?,?)").run(iso(0.5),k);
await ensureMailPilotTables(env.QUOTES_DB);
D.prepare("INSERT INTO mail_pilot_meta (key,value) VALUES ('imported_at',?),('sales_from','2026-08-01'),('sales_to','2026-10-05')").run(new Date(now).toISOString());
const mp=D.prepare("INSERT INTO mail_pilot_properties (pid,ref,street,city,state,zip,jurisdiction,source,segment,sale_date,sale_cents,deed,permit_case,permit_type,permit_issued,permit_status,year_built,living_sqft,address_points,first_seen,last_seen) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
mp.run(1,'CV-0001','100 NE AUDIT ST','Vancouver','WA','98660','Vancouver','permit','A',null,null,null,'RES-1','Reroof Residential',iso(9).slice(0,10),'Issued',1978,1800,1,iso(9),iso(1));
mp.run(2,'CV-0002','200 NW SAMPLE AVE','Camas','WA','98607','Camas','sale','C',iso(20).slice(0,10),42500000,'D-WARR',null,null,null,null,1990,2100,1,iso(20),iso(1));
mp.run(3,'CV-0003','300 SE TEST CT','Battle Ground','WA','98604','Battle Ground','sale','E',iso(30).slice(0,10),null,'D-QCD',null,null,null,null,2012,2400,2,iso(30),iso(1));
// Two made-up supplier permits (555 numbers) so the Analytics call log and do-not-contact flow can be driven.
await ensureSupplierTables(env.QUOTES_DB);
D.prepare("INSERT INTO supplier_import_meta (key, value) VALUES ('imported_at', ?), ('edition', '2026-W40')").run(new Date(now).toISOString());
const sp=D.prepare("INSERT INTO supplier_permits (id, source, section, grp, county, city, site_address, permit_date, owner_name, owner_phone, builder_name, builder_phone, builder_key, builder_license, score, signals, first_seen, last_seen, imported_at, edition) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
sp.run('AUD-1','Construction Monitor','Approved','remodel','Clark County','Vancouver','100 NE AUDIT ST',iso(3).slice(0,10),'ROE AUDIT','(360) 555-0142','AUDIT BUILDERS LLC','(360) 555-0143','AUDIT BUILDERS LLC','AUDITBL001',2,'[]',iso(3).slice(0,10),iso(3).slice(0,10),iso(0),'2026-W40');
const ids={q1,q2,q3,q4,j1,j2,j3,g1,qL,jL,gL};
// ---- server
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.mp4':'video/mp4','.glb':'model/gltf-binary','.xml':'application/xml','.txt':'text/plain'};
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://x');let p=decodeURIComponent(u.pathname);
 if(p.startsWith('/internal/api/')){const rest=p.slice('/internal/api/'.length).replace(/\/$/,'');const parts=rest.split('/');let f,params={};
  if(parts.length===2&&['quotes','invoices'].includes(parts[0])){f=parts[0]+'/[id].js';params={id:parts[1]}}else if(['quotes','invoices'].includes(parts[0])&&parts.length===1)f=parts[0]+'/index.js';else f=parts[0]+'.js';
  if(!fs.existsSync(root+'/functions/internal/api/'+f)){res.writeHead(404);return res.end('{"error":"no route"}')}
  const chunks=[];for await(const c of req)chunks.push(c);const r=await api(req.method,{f,p:u.pathname+u.search},chunks.length?Buffer.concat(chunks).toString():undefined,params);res.writeHead(r.status,{'content-type':r.type});return res.end(r.body)}
 let file=null;for(const c of [p,p+'.html',p+'/index.html'])if(fs.existsSync(dist+c)&&fs.statSync(dist+c).isFile()){file=dist+c;break}
 if(!file){res.writeHead(404);return res.end('404')}res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res)}catch(e){console.error('SERVER ERR',e.message);res.writeHead(500);res.end(String(e.message))}});
await new Promise((resolve) => server.listen(PORT, resolve));
console.log(`Command Center on http://127.0.0.1:${PORT}/internal (seeded; Ctrl-C to stop)`);


if (process.argv.includes('--serve')) await new Promise(() => {});

// ---- browser audit
let chromium;
try { ({ chromium } = await import('playwright')); } catch { console.error('Needs Playwright: `npm i --no-save playwright` (and set CHROMIUM_PATH to a Chrome you already have).'); server.close(); process.exit(2); }
const sets = [
  { name: 'normal', quote: ids.q1, job: ids.j1 },
  { name: 'long-text', quote: ids.qL, job: ids.jL },
  { name: 'siding', quote: ids.q3, job: ids.j3 },
  { name: 'general-job', quote: ids.q4, job: ids.gL },
].map((set) => ({ ...set, invoice: 'INV-' + set.quote.replace(/^Q-/, '') }));
const pages = [];
(function walk(dir) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html') && f !== 'login.html') pages.push('/internal/' + path.relative(dist + '/internal', p).split(path.sep).join('/').replace(/\.html$/, '').replace(/(^|\/)index$/, '')); } })(dist + '/internal');
const query = (url, set) => {
  const q = new URLSearchParams();
  if (/quotes\/(view|build-plan|build-plan-approval|build-plan-visualizer)/.test(url)) { q.set('id', set.quote); q.set('quoteId', set.quote); }
  else if (/invoices\/view/.test(url)) q.set('id', set.invoice);
  else if (/jobs\/(view|field|closeout|prepare|hardening)/.test(url)) { q.set('id', set.job); q.set('jobId', set.job); }
  return q.toString() ? '?' + q : '';
};
// A 409 on the window-only pages for a siding or general job is the app saying "does not apply".
const EXPECTED_409 = /job-closeout|job-checklist|build-plan/;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const findings = [];
let views = 0;
const flowsOnly = process.argv.includes('--flows-only');
for (const set of (flowsOnly ? [] : sets)) {
  for (const [label, viewport] of [['phone 390', { width: 390, height: 844 }], ['laptop 1280', { width: 1280, height: 800 }]]) {
    const ctx = await browser.newContext({ viewport, serviceWorkers: 'block' });
    for (const url of pages.sort()) {
      const page = await ctx.newPage();
      const problems = [];
      page.on('pageerror', (e) => problems.push('script error: ' + e.message.slice(0, 120)));
      page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push('console error: ' + m.text().slice(0, 120)); });
      page.on('response', (r) => { const s = r.status(); const u = r.url(); if (s >= 400 && u.includes('/internal/api/') && !(s === 409 && ['siding', 'general-job'].includes(set.name) && EXPECTED_409.test(u)) && !(s === 404 && set.name === 'general-job' && /build-plan/.test(u))) problems.push(`${s} ${r.request().method()} ${u.replace(/^http:\/\/127\.0\.0\.1:\d+/, '')}`); });
      page.on('requestfailed', (r) => { if (!/\.(mp4|glb)/.test(r.url())) problems.push('request failed: ' + r.url().slice(-60)); });
      try { await page.goto(`http://127.0.0.1:${PORT}${url}${query(url, set)}`, { waitUntil: 'networkidle', timeout: 20000 }); } catch (e) { problems.push('did not load: ' + e.message.slice(0, 60)); }
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth).catch(() => 0);
      if (overflow > 0) problems.push(`scrolls sideways by ${overflow} px`);
      // Text squeezed to one letter per line (a figure or label with no room, because text may break anywhere): found
      // 2026-10-18 on Jobs ("active jobs") and Payments ("Balance $99,999.99" beside a long name).
      const squeezed = await page.evaluate(() => [...document.querySelectorAll('.internal-main *')].filter((e) => {
        if (e.children.length) return false;
        const t = (e.textContent || '').trim(); if (t.length < 6 || /^(.)\1+$/.test(t) || /^[Ww]+$/.test(t)) return false;
        const r = e.getBoundingClientRect(); if (!r.width) return false;
        const s = getComputedStyle(e); const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3;
        return r.height / lh >= 4 && r.width / parseFloat(s.fontSize) < 3.2;
      }).map((e) => (e.textContent || '').trim().slice(0, 20))).catch(() => []);
      if (squeezed.length) problems.push(`text squeezed to one letter per line: ${[...new Set(squeezed)].slice(0, 2).join(', ')}`);
      views += 1;
      if (problems.length) findings.push(`${set.name} / ${label} / ${url}\n    ${[...new Set(problems)].slice(0, 4).join('\n    ')}`);
      await page.close();
    }
    await ctx.close();
  }
}
// ---- failure pass: every API answers 500, then every request is dropped (a phone with no signal).
// A page must say it could not load. "Loading…" or "Checking…" still on screen after 1.5 s is a bug: Today, the
// quote screen and the approval screen once sat on it forever, with the only message below the fold.
// ("Checking this phone…" on Tools is a local service-worker check, not an API call, and this run blocks workers.)
const STILL_LOADING = /^\s*(Loading|Checking)\b[^]{0,60}$/i;
for (const mode of (flowsOnly ? [] : ['500', 'no signal'])) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/internal/api/**', (route) => (mode === '500' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Server error."}' }) : route.abort()));
  for (const url of pages.sort()) {
    const page = await ctx.newPage();
    try { await page.goto(`http://127.0.0.1:${PORT}${url}${query(url, sets[0])}`, { waitUntil: 'load', timeout: 20000 }); } catch { /* the page itself failed to load */ }
    await page.waitForTimeout(1500);
    const stuck = await page.evaluate((source) => {
      const re = new RegExp(source, 'i');
      const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      return [...document.querySelectorAll('.internal-main *')].filter((e) => e.children.length === 0 && visible(e) && re.test(e.textContent || '') && !/Checking this phone/.test(e.textContent || '')).map((e) => (e.textContent || '').trim().slice(0, 40));
    }, STILL_LOADING.source).catch(() => []);
    // A screen that says it could not load also needs a way to try again, and must not show the browser's own words.
    const verdict = await page.evaluate(() => {
      const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const messages = [...document.querySelectorAll('[role=alert], .error, [data-error], .status, [data-status], [role=status]')].filter(visible).map((e) => (e.textContent || '').trim());
      const failed = messages.some((m) => /could not (load|check|reach)|failed to fetch|load failed/i.test(m));
      const raw = messages.find((m) => /^(failed to fetch|load failed|networkerror)/i.test(m));
      const retry = [...document.querySelectorAll('.internal-main button, .internal-main a')].some((e) => visible(e) && /try again|retry|reload|refresh/i.test(e.textContent || ''));
      return { failed, raw, retry };
    }).catch(() => ({ failed: false }));
    if (verdict.raw) stuck.push(`shows the browser's own wording: ${verdict.raw.slice(0, 30)}`);
    if (verdict.failed && !verdict.retry) stuck.push('says it could not load, but offers no way to try again');
    views += 1;
    if (stuck.length) findings.push(`failed API (${mode}) / ${url}\n    ${[...new Set(stuck)].slice(0, 3).join(' | ')}`);
    await page.close();
  }
  await ctx.close();
}
// ---- flows pass: the everyday actions, done for real on a phone-sized browser. Each must work, leave the screen in a
// state that says so, and raise no script error or failed API call (a refused over-payment is the one expected 400).
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  const base = `http://127.0.0.1:${PORT}`;
  const flowProblems = [];
  const open = async (name) => {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => flowProblems.push(`${name}: script error ${e.message.slice(0, 100)}`));
    page.on('response', (r) => { const u = r.url(); if (r.status() >= 400 && u.includes('/internal/api/') && !(name === 'payments' && r.status() === 400) && !(name === 'photos' && r.status() === 503 && /job-photos/.test(u)) && !/build-plan-state/.test(u)) flowProblems.push(`${name}: ${r.status()} ${r.request().method()} ${u.replace(base, '').slice(0, 70)}`); });
    page.on('dialog', (d) => d.accept());
    return page;
  };
  const jobList = (await (await fetch(base + '/internal/api/jobs')).json()).jobs;
  const job = jobList.find((j) => j.customer_name === 'Pat Doe' && j.status === 'scheduled');
  {
    const page = await open('today'); await page.goto(base + '/internal/today', { waitUntil: 'networkidle' });
    if (await page.locator('.today-task-main strong').evaluateAll((els) => els.some((e) => e.scrollWidth > e.clientWidth + 1))) flowProblems.push('today: a task title is cut off on a phone');
    const before = await page.locator('[data-done]').count();
    if (!before) flowProblems.push('today: no follow-up to complete'); else { await page.locator('[data-done]').first().click(); await page.waitForTimeout(800); const after = await page.locator('[data-done]').count(); if (after !== before - 1) flowProblems.push(`today: marking a follow-up done changed ${before} to ${after}`); }
    await page.close();
  }
  {
    const page = await open('follow-up'); await page.goto(base + '/internal/follow-up', { waitUntil: 'networkidle' });
    await page.click('[data-add-open]'); if (!(await page.locator('input[name=title]').evaluate((e) => document.activeElement === e))) flowProblems.push('follow-up: opening the form does not focus Task'); await page.fill('input[name=title]', 'Audit: call about glass'); await page.click('[data-form] button[type=submit]'); await page.waitForTimeout(900);
    if (!(await page.evaluate(() => document.body.innerText.includes('Audit: call about glass')))) flowProblems.push('follow-up: a saved follow-up is not shown');
    if ((await page.inputValue('input[name=title]')) !== '') flowProblems.push('follow-up: the title field is not cleared after saving');
    if (!(await page.locator('[data-save-feedback]').isVisible()) || (await page.locator('[data-save-feedback]').innerText()) !== 'Follow-up saved.') flowProblems.push('follow-up: a successful save has no visible confirmation');
    const clipped = await page.locator('.task-title strong').evaluateAll((els) => els.some((e) => e.scrollWidth > e.clientWidth + 1));
    if (clipped) flowProblems.push('follow-up: a task title is cut off on a phone');
    await page.close();
  }
  {
    const page = await open('leads'); await page.goto(base + '/internal/leads', { waitUntil: 'networkidle' });
    const total = await page.locator('.ld-card').count();
    await page.locator('input[data-search]').fill('PAT@EXAMPLE.COM');
    if (await page.locator('.ld-card:visible').count() !== 1) flowProblems.push('leads: email search did not find Pat');
    if ((await page.locator('[data-results]').innerText()) !== `1 of ${total} leads`) flowProblems.push('leads: search count is wrong');
    await page.locator('input[data-search]').fill('5035550199');
    if (await page.locator('.ld-card:visible').count() !== 1) flowProblems.push('leads: digits-only phone search failed');
    const request = page.locator('.ld-card:visible .ld-request');
    if (await request.evaluate((e) => e.open)) flowProblems.push('leads: long request starts expanded');
    if (await request.locator('.ld-request-more').evaluate((e) => e.getBoundingClientRect().width < 200)) flowProblems.push('leads: full-request control is squeezed beside the preview');
    await request.locator('summary').focus(); await page.keyboard.press('Enter');
    if (!(await request.locator('.ld-notes').isVisible()) || (await request.locator('.ld-notes').innerText()).length !== 1800) flowProblems.push('leads: full request is not readable with the keyboard');
    await page.keyboard.press('Enter');
    await page.locator('input[data-search]').fill('no matching lead');
    if (!(await page.locator('[data-empty-filtered]').isVisible())) flowProblems.push('leads: no-results state is missing');
    await page.locator('[data-clear-search]').click();
    if (await page.locator('.ld-card:visible').count() !== total || !(await page.locator('input[data-search]').evaluate((e) => e === document.activeElement))) flowProblems.push('leads: clear search did not restore the queue and focus');
    const href = await page.locator('a.ld-action:has-text("Add follow-up")').first().getAttribute('href');
    await page.goto(base + href, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    if (!(await page.evaluate(() => { const c = document.querySelector('[data-add-card]'); return c && !c.hidden; }))) flowProblems.push('leads: "Add follow-up" from a lead does not open the form');
    await page.close();
  }
  {
    const page = await open('quote-new'); await page.goto(base + '/internal/quotes/new', { waitUntil: 'networkidle' });
    await page.fill('input[name=name]', 'Audit Customer'); await page.fill('input[name=phone]', '(360) 555-0188'); await page.click('[data-catalog-add]'); await page.waitForTimeout(200);
    if (await page.locator('[data-dock]').isHidden()) flowProblems.push('quote-new: the phone total dock does not appear after the first line');
    await page.click('[data-dock-save]'); await page.waitForTimeout(1500);
    if (!/quotes\/(view|build-plan)/.test(page.url())) flowProblems.push('quote-new: saving from the dock did not leave the builder');
    await page.close();
  }
  {
    const page = await open('payments'); await page.goto(base + '/internal/payments', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    const det = page.locator('.payment-card details').first(); await det.locator('summary').click(); await page.waitForTimeout(300);
    const status = () => det.locator('[data-status-text]').innerText();
    const save = async (value) => { if (!(await det.evaluate((e) => e.open))) await det.locator('summary').click(); await det.locator('[data-paid-input]').fill(value); await det.locator('[data-save]').click(); await page.waitForTimeout(900); };
    await save('100'); if (!/^Saved/.test(await status())) flowProblems.push('payments: after saving, the card does not say Saved (and the editor must stay open)');
    await save('9999999'); if (!/between \$0 and/.test(await status())) flowProblems.push('payments: an over-payment is not explained');
    await save('abc'); if (!/valid amount/.test(await status())) flowProblems.push('payments: a non-number is not explained');
    await save('1,200.50'); if (!/^Saved/.test(await status())) flowProblems.push('payments: "1,200.50" (comma) is not accepted');
    await page.close();
  }
  {
    const page = await open('job-view'); await page.goto(base + '/internal/jobs/view?id=' + job.id, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    await page.locator('[data-install-notes]').fill('Audit note: gate code 1234'); await page.locator('[data-save]').click(); await page.waitForTimeout(900);
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    if (!(await page.locator('[data-install-notes]').inputValue()).includes('Audit note')) flowProblems.push('job-view: an edited note is not kept after reload');
    await page.close();
  }
  {
    const page = await open('jobs-create'); await page.goto(base + '/internal/jobs', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    const disclosure = page.locator('.create-disclosure');
    if (await disclosure.evaluate((e) => e.open)) flowProblems.push('jobs: creation form starts expanded and pushes the queue down');
    const firstJob = page.locator('.job-card').first();
    if (await firstJob.count()) {
      const card = await firstJob.boundingBox();
      const nav = await page.locator('.internal-mobile-nav').boundingBox().catch(() => null);
      if (card && card.y + 44 > (nav?.y ?? 760)) flowProblems.push('jobs: the first job is not reachable in the first phone screen');
    }
    await disclosure.locator('summary').focus();
    await page.keyboard.press('Enter');
    if (!(await page.locator('[data-quote-select]').isVisible())) flowProblems.push('jobs: keyboard cannot expand job creation');
    if ((await page.locator('[data-quote-select] option').count()) > 1) { await page.selectOption('[data-quote-select]', { index: 1 }); await page.click('[data-create]'); await page.waitForTimeout(1500); if (!/jobs\/view\?id=/.test(page.url())) flowProblems.push('jobs: creating a job from a finalized quote did not open the job'); }
    await page.close();
  }
  {
    const page = await open('measurements'); await page.goto(base + '/internal/tools/measurements', { waitUntil: 'networkidle' });
    await page.locator('[data-empty-add]').click();
    const row = page.locator('[data-body] tr').first();
    if ((await row.evaluate((e) => getComputedStyle(e).display)) !== 'grid') flowProblems.push('measurements: runtime row is not a phone card');
    const widths = await row.locator('[data-field]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
    if (widths.some((w) => w < 100)) flowProblems.push('measurements: a field is squeezed narrower than 100 px');
    await row.locator('[data-field="room"]').fill('Living "room"');
    await row.locator('[data-field="room"]').press('Tab');
    if (!(await row.locator('[data-field="type"]').evaluate((e) => document.activeElement === e))) flowProblems.push('measurements: editing the room drops focus instead of moving to Type');
    await row.locator('[data-field="type"]').selectOption('Casement');
    await row.locator('[data-field="width"]').fill('48'); await row.locator('[data-field="height"]').fill('36'); await row.locator('[data-field="quantity"]').fill('2');
    if ((await page.locator('[data-area]').innerText()) !== '24 sq ft') flowProblems.push('measurements: area does not update while typing');
    await row.locator('[data-field="notes"]').fill('Check trim'); await row.locator('[data-field="notes"]').press('Tab');
    await page.reload({ waitUntil: 'networkidle' });
    if ((await row.locator('[data-field="room"]').inputValue()) !== 'Living "room"' || (await row.locator('[data-field="notes"]').inputValue()) !== 'Check trim' || (await page.locator('[data-area]').innerText()) !== '24 sq ft') flowProblems.push('measurements: worksheet edits are not kept after reload');
    await page.locator('[data-add]').click();
    await page.locator('[data-body] tr').last().locator('[data-remove]').click();
    if ((await page.locator('[data-body] tr').count()) !== 1 || (await row.locator('[data-field="room"]').inputValue()) !== 'Living "room"') flowProblems.push('measurements: removing the second opening changes the first');
    await page.close();
  }
  {
    const page = await open('photos');
    await page.route('**/internal/api/job-photos**', (route) => route.fulfill({ status: route.request().method() === 'GET' ? 200 : 503, contentType: 'application/json', body: JSON.stringify({ configured: false, photos: [], error: 'Cloud storage is not configured.' }) }));
    await page.goto(base + '/internal/tools/photos?jobId=' + job.id + '&opening=1&stage=before', { waitUntil: 'networkidle' });
    const capture = await page.locator('.capture-button').boundingBox();
    const nav = await page.locator('.internal-mobile-nav').boundingBox();
    if (!capture || !nav || capture.y + 44 > nav.y) flowProblems.push('photos: the capture action is below the first phone screen');
    if (!(await page.locator('[data-files]').isEnabled())) flowProblems.push('photos: a valid job cannot capture photos');
    await page.locator('[data-opening-input]').fill('2');
    if (!(await page.locator('[data-field-back]').getAttribute('href')).endsWith('&opening=2')) flowProblems.push('photos: return to Field does not follow the current opening');
    await page.locator('[data-opening-input]').fill('');
    if ((await page.locator('[data-field-back]').getAttribute('href')).includes('&opening=')) flowProblems.push('photos: project-wide view returns to a stale opening');
    await page.locator('[data-opening-input]').fill('1');
    await page.locator('[data-files]').setInputFiles(root + '/public/icon-192.png');
    await page.locator('.photo-card').first().waitFor(); await page.waitForTimeout(700);
    await page.locator('.photo-card textarea').first().fill('Audit: sill detail'); await page.locator('.photo-card [data-save]').first().click();
    // IndexedDB saving is asynchronous: wait for the UI confirmation before navigating away.
    await page.waitForFunction(() => document.querySelector('[data-status]')?.textContent === 'Note saved');
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    if ((await page.locator('.photo-card textarea').first().inputValue()) !== 'Audit: sill detail') flowProblems.push('photos: the photo note does not survive reload');
    await page.locator('[data-stage="after"]').click(); await page.waitForTimeout(300);
    if ((await page.locator('.photo-card').count()) !== 0) flowProblems.push('photos: the stage filter shows a before photo as after');
    await page.locator('[data-stage="before"]').click(); await page.waitForTimeout(300);
    if ((await page.locator('.photo-card').count()) !== 1) flowProblems.push('photos: returning to Before loses the saved photo');
    await page.locator('.backup-tools summary').focus(); await page.keyboard.press('Enter');
    if (!(await page.locator('[data-export]').isVisible()) || !(await page.locator('[data-import-trigger]').isVisible())) flowProblems.push('photos: keyboard cannot reach backup actions');
    await page.close();
  }
  {
    const page = await open('analytics-calls'); await page.goto(base + '/internal/analytics', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    await page.click('[data-supplier-load]'); await page.locator('[data-supplier-rows] tr').first().waitFor();
    if (!(await page.locator('[data-supplier-rows] a[href="tel:+13605550143"]').count())) flowProblems.push('analytics: a licensed contractor phone is not a tel: link before it is blocked');
    const logButton = page.locator('[data-supplier-rows] .an-phone-btn', { hasText: 'Log call' }).nth(1);
    const box = await logButton.boundingBox();
    if (!box || box.height < 44) flowProblems.push('analytics: the Log call button is under 44 px tall on a phone');
    await logButton.click(); await page.locator('[data-contact-dialog][open]').waitFor();
    await page.selectOption('[data-contact-outcome]', 'no_answer'); await page.click('[data-contact-save]'); await page.waitForTimeout(700);
    if (!/Saved/.test(await page.locator('[data-contact-state]').innerText())) flowProblems.push('analytics: logging a call did not confirm');
    await page.selectOption('[data-contact-outcome]', 'asked_not_to_call'); await page.click('[data-contact-save]'); await page.waitForTimeout(900);
    if (!/do-not-contact/i.test(await page.locator('[data-contact-state]').innerText())) flowProblems.push('analytics: "asked not to be contacted" did not block the number');
    if (await page.locator('[data-contact-form]').isVisible()) flowProblems.push('analytics: a blocked number can still be logged');
    if ((await page.locator('[data-contact-history] li').count()) < 2) flowProblems.push('analytics: the call history is missing entries');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (overflow) flowProblems.push('analytics: the call dialog overflows the phone screen');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    if ((await page.locator('[data-supplier-rows] a[href="tel:+13605550143"]').count()) !== 0) flowProblems.push('analytics: a do-not-contact number is still a tel: link');
    if (!(await page.locator('[data-supplier-rows] .an-dnc').count())) flowProblems.push('analytics: the list does not mark the do-not-contact number');
    await page.close();
  }
  {
    const page = await open('round9-pages');
    await page.goto(base + '/internal/ask-logs', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    if (!(await page.locator('.al-clamped').count())) flowProblems.push('ask-logs: a very long answer is not folded');
    const tall = await page.locator('.al-card').nth(2).boundingBox();
    if (tall && tall.height > 420) flowProblems.push('ask-logs: a long answer still takes over the screen');
    await page.locator('.al-more').first().click();
    if (await page.locator('.al-clamped').count()) flowProblems.push('ask-logs: Show the full answer did not open it');
    await page.click('[data-filter="refused"]');
    if ((await page.locator('.al-card:not([hidden])').count()) !== 1) flowProblems.push('ask-logs: the Couldn\'t answer filter does not narrow the list');
    if (!(await page.locator('.al-sources a[href="/guides/window-costs"]').count()) && !(await page.locator('.al-card[hidden] .al-sources a[href="/guides/window-costs"]').count())) flowProblems.push('ask-logs: a source on our own site is not a link');
    if (await page.locator('.al-sources a[href^="https://"]').count()) flowProblems.push('ask-logs: an outside URL became a link');

    await page.goto(base + '/internal/google-tools', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    const off = await page.locator('.panel[data-off="true"]').count();
    if (off < 5) flowProblems.push('google-tools: tools that are not connected are not folded');
    const hiddenForm = await page.locator('#tool-address form').isVisible();
    if (off && hiddenForm) flowProblems.push('google-tools: a folded tool still shows its form');

    await page.goto(base + '/internal/copilot', { waitUntil: 'networkidle' });
    await page.route('**/internal/api/copilot', (route) => route.abort('failed'));
    await page.fill('#message', 'What is due?'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(700);
    if ((await page.inputValue('#message')) !== 'What is due?') flowProblems.push('copilot: a failed request loses the typed question');
    await page.unroute('**/internal/api/copilot');
    await page.route('**/internal/api/copilot', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"answer":"Two things.","route":"advisor","provider":"test"}' }));
    await page.click('[data-starter]'); await page.waitForTimeout(700);
    if (!(await page.locator('.message.assistant').count())) flowProblems.push('copilot: a starter question does not send');

    await page.goto(base + '/internal/tools/measurements', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle' });
    await page.click('[data-empty-add]');
    const row = page.locator('[data-body] tr').first();
    await row.locator('[data-field="width"]').fill('300'); await row.locator('[data-field="height"]').fill('48');
    if (!(await row.evaluate((e) => e.classList.contains('check-size')))) flowProblems.push('measurements: a 300 in width is not flagged');
    if ((await row.locator('[data-field="width"]').inputValue()) !== '300') flowProblems.push('measurements: a flagged size was changed');
    await row.locator('[data-field="width"]').fill('36');
    if (await row.evaluate((e) => e.classList.contains('check-size'))) flowProblems.push('measurements: the flag stays after the size is fixed');
    await row.locator('[data-field="room"]').fill('Kitchen');
    await row.locator('[data-remove]').click();
    if ((await page.locator('[data-body] tr').count()) !== 0 || !(await page.locator('[data-undo]').isVisible())) flowProblems.push('measurements: removing an opening gives no Undo');
    await page.click('[data-undo]');
    if ((await page.locator('[data-body] tr').count()) !== 1 || (await page.locator('[data-body] [data-field="room"]').inputValue()) !== 'Kitchen') flowProblems.push('measurements: Undo does not bring the opening back');
    await page.close();
  }
  {
    const page = await open('round10-pages');
    await page.goto(base + '/internal/jobs/prepare?id=' + ids.j1, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    const rows = await page.locator('.check-row').evaluateAll((els) => els.map((e) => ({ w: e.getBoundingClientRect().width, pw: e.parentElement.getBoundingClientRect().width, label: e.querySelector('small')?.getBoundingClientRect().height ?? 0 })));
    if (!rows.length) flowProblems.push('prepare: the checklist did not render');
    if (rows.some((r) => r.w < r.pw - 4)) flowProblems.push('prepare: a checklist row does not fill its width (the checkbox-label rule overrode the grid)');
    if (rows.some((r) => r.label > 22)) flowProblems.push('prepare: a checklist status wraps to two lines');
    const stats = await page.locator('.plan-facts span').first().evaluate((e) => getComputedStyle(e).paddingLeft).catch(() => '0px');
    if (parseFloat(stats) < 8) flowProblems.push('prepare: the plan counts have no padding');
    await page.goto(base + '/internal/jobs/hardening', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    const xs = await page.locator('.row > div').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
    if (new Set(xs).size > 1) flowProblems.push('hardening: release blocker rows do not line up');
    await page.goto(base + '/internal/leads/analyze', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    const tall = await page.locator('.la-card').evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().height)));
    if (tall > 260) flowProblems.push('analyzer: one lead with long notes takes over the screen');
    await page.goto(base + '/internal/quotes/build-plan?quoteId=' + ids.q1, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
    const cut = await page.locator('textarea[data-list-key]').evaluateAll((els) => els.filter((e) => e.scrollHeight > e.clientHeight + 2).length);
    if (cut) flowProblems.push('build plan: a purchase-plan item is cut off at the edge');
    await page.close();
  }
  {
    // Tablet width (768 px): the top nav scrolls, the job header and the jobs toolbar must not squeeze or cut off.
    const tctx = await browser.newContext({ viewport: { width: 768, height: 1024 }, serviceWorkers: 'block' });
    const page = await tctx.newPage();
    page.on('pageerror', (e) => flowProblems.push('tablet: page error ' + e.message));
    await page.goto(base + '/internal/payments', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    const navBox = await page.evaluate(() => { const nav = document.querySelector('.internal-nav'); const a = nav?.querySelector('a.active'); if (!nav || !a) return null; const n = nav.getBoundingClientRect(); const r = a.getBoundingClientRect(); return { left: r.left - n.left, right: n.right - r.right }; });
    if (!navBox || navBox.left < -1 || navBox.right < -1) flowProblems.push('tablet: the current page link in the top nav is cut off');
    if (!(await page.locator('.internal-nav[data-more-right="true"], .internal-nav[data-more-left="true"]').count())) flowProblems.push('tablet: a scrolling top nav shows no fade for the links out of view');
    await page.goto(base + '/internal/jobs/view?id=' + ids.j1, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    const titleH = await page.locator('.job-head h1').evaluate((e) => e.getBoundingClientRect().height);
    if (titleH > 130) flowProblems.push('tablet: the job name wraps to several lines beside the action buttons (' + Math.round(titleH) + ' px tall)');
    await page.goto(base + '/internal/jobs', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    const chips = await page.locator('.job-filters .filter').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return r.right; }));
    if (chips.some((r) => r > 768 - 8)) flowProblems.push('tablet: a Jobs status chip runs off the screen');
    await tctx.close();
  }
  views += 3;
  {
    // Keyboard focus: a text field must show a ring (the site-wide `input:focus{outline:none}` left only a faint bottom border).
    const kctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const page = await kctx.newPage();
    await page.goto(base + '/internal/quotes/new', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    await page.focus('input[name="name"]');
    const ring = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; });
    if (!ring) flowProblems.push('focus: a text field shows no focus ring');
    await kctx.close();
  }
  views += 1;
  views += 12;
  for (const f of flowProblems) findings.push(`flow / ${f}`);
  await ctx.close();
}
// ---- accessibility pass (optional): axe-core on every page at phone width. Needs `npm i --no-save axe-core`; skipped when it is not installed.
const axePath = root + '/node_modules/axe-core/axe.min.js';
if (!flowsOnly && fs.existsSync(axePath)) {
  const axeSource = fs.readFileSync(axePath, 'utf8');
  const actx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  for (const url of pages) {
    const page = await actx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}` + url + query(url, sets[0]), { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(700);
    await page.evaluate(axeSource);
    const result = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } }));
    views += 1;
    for (const v of result.violations) findings.push(`a11y ${url}: ${v.id} (${v.impact}) ${v.help}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
    await page.close();
  }
  await actx.close();
}
await browser.close();
server.close();
console.log(flowsOnly ? `${views} interaction flows, ${findings.length} with problems` : `${views} page views (${pages.length} pages x ${sets.length} data sets x 2 sizes, plus ${pages.length * 2} with the API failing), ${findings.length} with problems`);
for (const f of findings) console.log('  ' + f);
process.exit(findings.length ? 1 : 0);
