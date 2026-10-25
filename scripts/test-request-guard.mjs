// The shared write-handler checks: where a request came from, how big it is, and which methods are allowed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFAULT_MAX_BYTES, guardWrite, jsonResponse, methodNotAllowed, readJsonBounded, sameOrigin } from '../functions/internal/_lib/request-guard.mjs';

process.removeAllListeners('warning');
const pass = (m) => console.log(`PASS: ${m}`);
const URL_ = 'https://windowsbyclearview.com/internal/api/quotes';
const req = (headers = {}, body = JSON.stringify({ a: 1 }), method = 'POST') => new Request(URL_, { method, headers: { 'content-type': 'application/json', ...headers }, body });

// 1. Where the request came from.
{
  assert.equal(sameOrigin(req()), true, 'no Origin and no fetch metadata: allowed (a test, a tool)');
  assert.equal(sameOrigin(req({ origin: 'https://windowsbyclearview.com' })), true);
  assert.equal(sameOrigin(req({ origin: 'https://evil.example' })), false);
  assert.equal(sameOrigin(req({ origin: 'https://windowsbyclearview.com.evil.example' })), false, 'a lookalike host is not this site');
  assert.equal(sameOrigin(req({ origin: 'http://windowsbyclearview.com' })), false, 'a different scheme is a different origin');
  assert.equal(sameOrigin(req({ origin: 'null' })), false, 'an opaque origin is refused');
  assert.equal(sameOrigin(req({ origin: 'not a url' })), false);
  assert.equal(sameOrigin(req({ 'sec-fetch-site': 'cross-site' })), false, 'the browser says it came from another site');
  assert.equal(sameOrigin(req({ 'sec-fetch-site': 'same-site' })), false, 'a sibling subdomain is not this origin');
  assert.equal(sameOrigin(req({ 'sec-fetch-site': 'same-origin' })), true);
  assert.equal(sameOrigin(req({ 'sec-fetch-site': 'none' })), true, 'a typed address');
  assert.equal(sameOrigin(req({ origin: 'https://windowsbyclearview.com', 'sec-fetch-site': 'cross-site' })), true, 'a matching Origin decides');
  pass('same-origin: matching Origin allowed; other sites, lookalikes, other schemes and opaque origins refused; fetch metadata used when Origin is absent');
}

// 2. Bounded JSON.
{
  let r = await readJsonBounded(req());
  assert.deepEqual(r, { ok: true, body: { a: 1 } });
  r = await readJsonBounded(req({}, '{nope'));
  assert.equal(r.ok, false); assert.equal(r.response.status, 400); assert.equal((await r.response.json()).error, 'Invalid JSON.');
  r = await readJsonBounded(req({ 'content-length': String(DEFAULT_MAX_BYTES + 1) }, '{}'));
  assert.equal(r.response.status, 413, 'a declared length over the limit is refused without reading');
  const big = JSON.stringify({ pad: 'x'.repeat(DEFAULT_MAX_BYTES) });
  r = await readJsonBounded(req({}, big));
  assert.equal(r.response.status, 413, 'the bytes actually read are checked too, because a declared length can be missing or wrong');
  r = await readJsonBounded(req({}, '{"a":1}'), 4);
  assert.equal(r.response.status, 413, 'the limit is the caller\'s to set');
  r = await readJsonBounded(req({}, ''));
  assert.equal(r.response.status, 400, 'an empty body is not JSON');
  assert.equal(DEFAULT_MAX_BYTES, 65536);
  pass('bounded JSON: parses small bodies; 400 for bad JSON; 413 on declared or actual size; limit is configurable');
}

// 3. Methods and the combined guard.
{
  const res = methodNotAllowed(['GET', 'POST']);
  assert.equal(res.status, 405); assert.equal(res.headers.get('allow'), 'GET, POST'); assert.equal((await res.json()).error, 'Method not allowed.');
  assert.equal(methodNotAllowed().headers.get('allow'), null);
  let g = await guardWrite({ request: req() });
  assert.equal(g.ok, true); assert.deepEqual(g.body, { a: 1 });
  g = await guardWrite({ request: req({ origin: 'https://evil.example' }) });
  assert.equal(g.ok, false); assert.equal(g.response.status, 403);
  g = await guardWrite({ request: req({ origin: 'https://evil.example' }, undefined, 'DELETE') }, { json: false });
  assert.equal(g.response.status, 403, 'a body-less write still gets the origin check');
  g = await guardWrite({ request: new Request(URL_, { method: 'DELETE' }) }, { json: false });
  assert.equal(g.ok, true); assert.equal(g.body, undefined);
  g = await guardWrite({ request: req({}, JSON.stringify({ pad: 'x'.repeat(200) })) }, { maxBytes: 100 });
  assert.equal(g.response.status, 413);
  const origin = await guardWrite({ request: req({ origin: 'https://evil.example', 'content-length': '999999' }) });
  assert.equal(origin.response.status, 403, 'origin is checked before size, so a hostile site learns nothing');
  const r = jsonResponse({ ok: true }, 201);
  assert.equal(r.status, 201); assert.equal(r.headers.get('cache-control'), 'private, no-store'); assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  pass('guardWrite checks origin first, then size and JSON; body-less writes still get the origin check; 405 names the allowed methods');
}

// 4. It is dependency-free, so it runs anywhere a handler runs.
{
  const src = fs.readFileSync(new URL('../functions/internal/_lib/request-guard.mjs', import.meta.url), 'utf8');
  assert.ok(!/^import\s/m.test(src), 'no imports');
  pass('request-guard has no imports');
}

console.log('\nAll request guard checks passed.');
