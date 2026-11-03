import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as quotes from '../functions/internal/api/quotes/index.js';
import * as quote from '../functions/internal/api/quotes/[id].js';
import * as operations from '../functions/internal/api/quote-operations.js';
import * as supplierResponses from '../functions/internal/api/supplier-responses.js';
import * as revisions from '../functions/internal/api/quote-revision.js';
import * as delivery from '../functions/internal/api/quote-delivery.js';
import * as flow from '../functions/internal/api/flow.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const env = { QUOTES_DB: createD1({ schemaFiles: ['internal/db/schema.sql'] }) };
const server = http.createServer((req, res) => {
  let file = path.resolve('dist', '.' + new URL(req.url, 'http://x').pathname);
  if (!path.extname(file)) file += '.html';
  fs.readFile(file, (err, data) => { res.writeHead(err ? 404 : 200, { 'content-type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream' }); res.end(err ? '' : data); });
}).listen(0);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    await page.addInitScript(() => { navigator.canShare = () => true; navigator.share = async data => { window.__sharedPdf = data.files[0].name; }; });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/internal/api/**', async route => {
      const req = route.request(), url = new URL(req.url());
      const id = url.pathname.match(/\/quotes\/(Q-[^/]+)$/)?.[1];
      const handler = url.pathname === '/internal/api/quotes' ? quotes.onRequestPost : id ? (req.method() === 'PUT' ? quote.onRequestPut : quote.onRequestGet) : url.pathname === '/internal/api/flow' ? flow.onRequest : url.pathname === '/internal/api/quote-delivery' ? delivery.onRequest : url.pathname === '/internal/api/quote-operations' ? operations.onRequest : url.pathname === '/internal/api/supplier-responses' ? supplierResponses.onRequest : url.pathname === '/internal/api/quote-revision' ? revisions.onRequest : null;
      if (!handler) return route.fulfill({ json: {} });
      const response = await handler({ env, params: { id }, request: new Request(req.url(), { method: req.method(), headers: { 'content-type': 'application/json' }, body: req.method() === 'GET' ? undefined : req.postData() }), waitUntil() {} });
      await route.fulfill({ status: response.status, contentType: response.headers.get('content-type') || 'application/json', body: Buffer.from(await response.arrayBuffer()) });
    });
    const base = `http://localhost:${server.address().port}`;
    await page.goto(base + '/internal/quotes/new');
    await page.locator('[name="name"]').fill('Sample customer');
    await page.locator('[name="phone"]').fill('5550100200');
    await page.locator('[data-catalog-qty]').fill('2');
    await page.locator('[data-catalog-add]').click();
    await page.locator('.qb-measurements summary').first().click();
    const fields = page.locator('.qb-measurement-fields');
    for (let i = 0; i < 2; i++) {
      await fields.nth(i).locator('[data-measurement="width"]').fill(i ? '36' : '35 1/2');
      await fields.nth(i).locator('[data-measurement="height"]').fill(i ? '48' : '47 3/4');
      await fields.nth(i).locator('[data-measurement="kind"]').selectOption('rough-opening');
    }
    const series = page.locator('[data-product-spec="series"]').first();
    await series.evaluate(el => { el.closest('details').open = true; });
    await series.fill('Exact series from supplier');
    await page.waitForFunction(() => localStorage.getItem('cv-full-quote-draft:new')?.includes('Exact series from supplier'));
    await page.reload();
    await page.getByRole('button', { name: 'Restore saved draft' }).click();
    await page.locator('.qb-measurements summary').first().click();
    assert.equal(await page.locator('[data-measurement="width"]').first().inputValue(), '35 1/2', 'full recovery retains private measurements');
    assert.equal(await page.locator('[name="name"]').inputValue(), 'Sample customer', 'full recovery retains customer');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow');
    if (process.env.OUTPUT_DIR) await page.screenshot({ path: path.join(process.env.OUTPUT_DIR, `quote-measurements-${width}.png`), fullPage: true });
    await page.locator('[data-submit]').click();
    await page.waitForURL('**/internal/quotes/view?id=*');
    await page.locator('[data-contract]:not([hidden])').waitFor();
    await page.locator('[data-share-pdf]:not([hidden])').waitFor();
    await page.locator('[data-share-pdf]').click();
    assert.match(await page.evaluate(() => window.__sharedPdf), /ClearView-Quote-Q-/);
    const id = new URL(page.url()).searchParams.get('id');
    assert.ok(!(await page.locator('[data-contract]').innerText()).includes('35 1/2'), 'customer copy excludes dimensions');
    assert.ok((await page.locator('[data-private-measurement-list]').textContent()).includes('35 1/2'), 'internal view retains dimensions');
    const privateRows = JSON.parse(env.QUOTES_DB.raw.prepare('SELECT measurements_json FROM quote_items WHERE quote_id=?').get(id).measurements_json);
    assert.equal(privateRows.length, 2);
    assert.equal(privateRows[0].width, '35 1/2');
    assert.equal(JSON.parse(env.QUOTES_DB.raw.prepare('SELECT product_specs_json FROM quote_items WHERE quote_id=?').get(id).product_specs_json).series, 'Exact series from supplier');
    await page.goto(base + `/internal/quotes/new?edit=${id}`);
    await page.locator('.qb-measurements summary').first().click();
    assert.equal(await page.locator('[data-measurement="width"]').first().inputValue(), '35 1/2', 'edit reload retains dimensions');
    // A signed quote can receive an audited private correction through the actual view controls.
    const signResponse = await quote.onRequestPatch({ env, params: { id }, request: new Request(base + '/internal/api/quotes/' + id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signatureStrokes: [[[10, 10], [60, 40], [120, 30]]], signatureName: 'Sample customer' }) }), waitUntil() {} });
    assert.equal(signResponse.status, 200);
    await page.goto(base + `/internal/quotes/view?id=${id}`);
    await page.locator('[data-contract]:not([hidden])').waitFor();
    await page.locator('[data-operational-corrections] > summary').click();
    await page.locator('[data-operational-items] .qb-measurements > summary').first().click();
    await page.locator('[data-operational-items] [data-measurement="width"]').first().fill('35 3/4');
    await page.locator('[data-operational-corrections] [name="note"]').fill('Corrected field measurement');
    await page.getByRole('button', { name: 'Save private correction' }).click();
    await page.waitForFunction(() => document.querySelector('[data-operational-status]')?.textContent?.includes('Private details saved'));
    assert.equal(JSON.parse(env.QUOTES_DB.raw.prepare('SELECT measurements_json FROM quote_items WHERE quote_id=?').get(id).measurements_json)[0].width, '35 3/4');
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS: ${width}px quote builder: two exact openings, save/load/edit, customer privacy, no JS errors or overflow`);
  }
} finally { await browser.close(); server.close(); }
