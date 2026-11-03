import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as create from '../functions/internal/api/quotes/index.js';
import * as delivery from '../functions/internal/api/quote-delivery.js';
import { quotePdf } from '../functions/internal/_lib/quote-pdf.mjs';
import { contractTerms } from '../functions/internal/_lib/pdf-terms.mjs';
const env = { QUOTES_DB: createD1({ schemaFiles: ['internal/db/schema.sql'] }), RESEND_API_KEY: 'fixture-only' };
const originalFetch = globalThis.fetch;
const sent = [];
globalThis.fetch = async (url, options) => {
  if (String(url) === 'https://api.resend.com/emails') { sent.push(JSON.parse(options.body)); return Response.json({ id: 'fixture-message' }); }
  return new Response('', { status: 404 });
};
const request = (method, body, query = '') => ({ env, params: {}, request: new Request('https://example.test/internal/api/quote-delivery' + query, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }) });
try {
  const r = await create.onRequestPost(request('POST', { customer: { name: 'Sample customer', phone: '5550100200', email: 'customer@example.com' }, notes: 'PRIVATE NOTE 12345', items: [{ label: 'Cascade slider - insert', description: 'White vinyl', quantity: 1, unitPriceCents: 85000, measurements: [{ width: '35 1/2', height: '47 3/4', kind: 'rough-opening', location: 'Kitchen' }] }] }));
  const { id } = await r.json();
  assert.ok(id);
  for (const kind of ['customer', 'supplier']) {
    const response = await delivery.onRequestPost(request('POST', { quoteId: id, kind, to: kind + '@example.com' }));
    assert.equal(response.status, 200);
    const email = sent.at(-1);
    assert.equal(email.to[0], kind + '@example.com');
    const bytes = Buffer.from(email.attachments[0].content, 'base64');
    const pdf = await PDFDocument.load(bytes);
    assert.ok(pdf.getPageCount() >= 1);
    if (process.env.OUTPUT_DIR) fs.writeFileSync(`${process.env.OUTPUT_DIR}/clearview-${kind}-delivery-sample.pdf`, bytes);
    assert.ok(!JSON.stringify(email).includes('PRIVATE NOTE'));
  }
  const missing = await delivery.onRequestPost(request('POST', { quoteId: id, kind: 'supplier' }));
  assert.equal(missing.status, 400, 'supplier recipient must be explicit');
  const download = await delivery.onRequestGet(request('GET', null, `?quoteId=${id}&kind=supplier`));
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  assert.equal(download.headers.get('cache-control'), 'private, no-store');
  assert.equal((await delivery.onRequestPost({ ...request('POST', { quoteId: id, kind: 'customer' }), env: { QUOTES_DB: env.QUOTES_DB } })).status, 503);
  const source = fs.readFileSync(new URL('../src/data/contractTerms.ts', import.meta.url), 'utf8');
  const from = source.indexOf('export const contractTerms =');
  const expression = source.slice(from).replace('export const contractTerms =', 'return');
  const originalTerms = new Function('site', 'WARRANTY_YEARS', expression)({ legalName: 'Clearview Windows & Trim LLC' }, 1);
  assert.deepEqual(contractTerms, originalTerms, 'PDF terms match the existing quote terms');
  console.log('PASS: attached customer/supplier PDFs, explicit supplier recipient, private downloads, missing configuration, unchanged terms, mocked Resend only');
} finally { globalThis.fetch = originalFetch; }
