// The quote view must never let stored text become page markup: the signature is drawn through an <img>
// (data URL), line text goes through the shared esc, and a failed load says why with Try again in place.
// Static checks always run. The browser checks run when Playwright, CHROMIUM_PATH and a built dist/ exist.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = new URL('../', import.meta.url);
const pass = (m) => console.log(`PASS: ${m}`);
const page = fs.readFileSync(new URL('src/pages/internal/quotes/view.astro', root), 'utf8');

// ── Static: no innerHTML for the signature, one shared esc, shared load path ────────────────────────────
{
  assert.ok(!/innerHTML\s*=\s*quote\.signature_svg/.test(page), 'signature_svg is never assigned to innerHTML');
  assert.ok(!/signature_svg[^\n]*innerHTML|innerHTML[^\n]*signature_svg/.test(page), 'signature_svg and innerHTML never meet on a line');
  assert.match(page, /data:image\/svg\+xml/, 'the signature is a data URL image');
  assert.match(page, /encodeURIComponent\(markup\)/, 'the SVG is URL-encoded into the data URL');
  assert.ok(!/function escapeHtml|escapeHtml\(/.test(page), 'no local escape copy');
  assert.match(page, /import \{[^}]*\besc\b[^}]*\} from '..\/..\/..\/lib\/internal-fetch'/, 'uses the shared esc');
  assert.match(page, /esc\(item\.quantity\)/, 'quantity is escaped too');
  assert.match(page, /fetchJson\(`\/internal\/api\/quotes\/\$\{encodeURIComponent\(id!\)\}`\)/, 'the load path uses fetchJson');
  assert.match(page, /loadFailedNode\(/, 'a failed load shows the shared Try again node');
  pass('static: signature is an <img> data URL, shared esc, shared load path');
}

// ── Browser ─────────────────────────────────────────────────────────────────────────────────────────────
const dist = path.resolve('dist');
let chromium = null;
try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch { /* not installed */ }
if (!chromium || !process.env.CHROMIUM_PATH || !fs.existsSync(path.join(dist, 'internal/quotes/view.html'))) {
  console.log('SKIP: browser checks need Playwright, CHROMIUM_PATH and a built dist/ (npm run build)');
} else {
  const server = http.createServer((req, res) => {
    let file = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.extname(file)) file += '.html';
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream';
      res.writeHead(200, { 'content-type': type }); res.end(data);
    });
  }).listen(0);
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

  async function open(quoteRoute) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.route('**/internal/api/**', (r) => (/\/internal\/api\/quotes\/Q-1$/.test(r.request().url()) && r.request().method() === 'GET' ? quoteRoute(r) : r.fulfill(json({}))));
    await p.goto(`${base}/internal/quotes/view?id=Q-1`);
    return { p, ctx, errors };
  }

  // Hostile stored values: nothing may execute and no injected element may exist.
  {
    const hostileSvg = '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=1"><script>window.__pwned=2</script><path d="M1 1L9 9" stroke="black"/></svg>';
    const quote = {
      id: 'Q-1', status: 'finalized', work_type: 'replacement', created_at: '2026-01-01T00:00:00Z',
      customer_name: '<img src="/x-name.png" onerror="window.__pwned=3">', customer_phone: '', customer_address: '<b id="inj-addr">x</b>', customer_city: '', customer_email: '',
      subtotal_cents: 0, total_cents: 0, discount_cents: 0, signature_method: 'digital', signature_svg: hostileSvg,
      signature_name: '<i id="inj-name">n</i>', signed_at: '2026-01-02T00:00:00Z',
    };
    const items = [{ id: 1, label: '<img src="/x-line.png" onerror="window.__pwned=4"><b id="inj-line">bold</b>', quantity: '1"><script>window.__pwned=5</script>', unit_price_cents: 0, line_total_cents: 0 }];
    const { p, ctx, errors } = await open((r) => r.fulfill(json({ quote, items })));
    await p.waitForSelector('[data-contract]:not([hidden])');
    await p.waitForTimeout(500);
    assert.equal(await p.evaluate(() => window.__pwned), undefined, 'nothing from stored values executed');
    assert.equal(await p.locator('#inj-addr, #inj-name, #inj-line').count(), 0, 'no injected elements');
    assert.equal(await p.locator('img[src*="x-line"], img[src*="x-name"]').count(), 0, 'no injected images');
    assert.equal(await p.locator('[data-contract-items] script, [data-contract-items] img, [data-contract-items] b').count(), 0, 'line cells hold text only');
    assert.match(await p.locator('[data-contract-items] td').first().textContent(), /<img src=/, 'the hostile label is shown as text');
    const host = p.locator('[data-sig-svg-host]');
    assert.equal(await host.locator('> *').count(), 1);
    assert.equal(await host.locator('> img').count(), 1, 'the signature is a single <img>');
    assert.equal(await host.locator('svg, script').count(), 0, 'no svg or script element in the page DOM');
    assert.match(await host.locator('img').getAttribute('src'), /^data:image\/svg\+xml/);
    const box = await host.locator('img').boundingBox();
    assert.ok(box && box.width > 20 && box.height > 5, 'the signature image has a visible size');
    assert.deepEqual(errors, [], 'no page errors');
    await ctx.close();
    pass('browser: hostile signature, name, address and line text never execute or become elements');
  }

  // Failed loads say why, and Try again works in place.
  {
    const html401 = (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html>login</html>' });
    const a = await open(html401);
    await a.p.waitForSelector('[data-error] .load-failed');
    assert.match(await a.p.locator('[data-error]').textContent(), /sign-in expired/i);
    assert.equal(await a.p.locator('[data-error] button').count(), 0, 'an expired sign-in offers no useless Try again');
    await a.ctx.close();

    let failing = true;
    const flaky = (r) => {
      if (failing) return r.fulfill(json({ error: 'The server had a problem.' }, 500));
      return r.fulfill(json({ quote: { id: 'Q-1', status: 'draft', work_type: 'replacement', created_at: '2026-01-01T00:00:00Z', customer_name: 'Test Customer', subtotal_cents: 0, total_cents: 0 }, items: [] }));
    };
    const b = await open(flaky);
    await b.p.waitForSelector('[data-error] .load-failed');
    assert.match(await b.p.locator('[data-error]').textContent(), /problem/i);
    failing = false;
    await b.p.locator('[data-error] button', { hasText: 'Try again' }).click();
    await b.p.waitForSelector('[data-contract]:not([hidden])');
    assert.equal(await b.p.locator('[data-error]').isHidden(), true, 'the error clears once the quote loads');
    assert.match(await b.p.locator('[data-c-name]').textContent(), /Test Customer/);
    await b.ctx.close();

    const c = await open((r) => r.fulfill(json({ error: 'nope' }, 404)));
    await c.p.waitForSelector('[data-error]:not([hidden])');
    assert.match(await c.p.locator('[data-error]').textContent(), /No quote with that id/);
    await c.ctx.close();
    pass('browser: expired sign-in and server errors show a message with Try again; 404 keeps its sentence');
  }

  await browser.close();
  server.close();
}
