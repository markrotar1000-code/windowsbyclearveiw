// How a Command Center page's fetch fails, in words a person can act on. Stubs the browser's fetch.
import assert from 'node:assert/strict';

process.removeAllListeners('warning');
const pass = (m) => console.log(`PASS: ${m}`);
const lib = await import(new URL('../src/lib/internal-fetch.ts', import.meta.url).href);
const { fetchJson, esc, InternalFetchError, isSessionExpired, SESSION_EXPIRED_MESSAGE } = lib;
const { NO_SIGNAL_MESSAGE } = await import(new URL('../src/lib/load-failed.ts', import.meta.url).href);

const realFetch = globalThis.fetch;
const answer = (body, init = {}) => { globalThis.fetch = async () => { const r = new Response(body, init); if (init.redirected) Object.defineProperty(r, 'redirected', { value: true }); return r; }; };
const fails = async (kind, check) => {
  try { await fetchJson('/x'); } catch (error) { assert.ok(error instanceof InternalFetchError, 'a typed error'); assert.equal(error.kind, kind); if (check) check(error); return; }
  assert.fail(`expected a ${kind} failure`);
};
try {
  // 1. Success.
  answer(JSON.stringify({ jobs: [1, 2] }), { status: 200, headers: { 'content-type': 'application/json' } });
  assert.deepEqual(await fetchJson('/x'), { jobs: [1, 2] });
  let seen; globalThis.fetch = async (url, init) => { seen = init; return new Response('{}', { headers: { 'content-type': 'application/json' } }); };
  await fetchJson('/x'); assert.equal(seen.credentials, 'same-origin', 'the sign-in cookie is sent');
  await fetchJson('/x', { method: 'PATCH', credentials: 'omit' }); assert.equal(seen.method, 'PATCH'); assert.equal(seen.credentials, 'omit', 'the caller can override');
  pass('success returns the parsed body and sends the cookie by default');

  // 2. The four ways it fails.
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await fails('network', (e) => assert.equal(e.message, NO_SIGNAL_MESSAGE));
  answer('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  await fails('session', (e) => assert.equal(e.message, SESSION_EXPIRED_MESSAGE));
  answer('{"error":"no"}', { status: 401, headers: { 'content-type': 'application/json' } });
  await fails('session', (e) => assert.equal(e.status, 401));
  answer('<html>login</html>', { status: 200, headers: { 'content-type': 'text/plain' }, redirected: true });
  await fails('session');
  // An HTML error page from a failing server is not an expired sign-in.
  answer('<html>Bad gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } });
  await fails('server', (e) => { assert.equal(e.status, 502); assert.notEqual(e.message, SESSION_EXPIRED_MESSAGE, 'a 502 page does not tell someone to sign in again'); });
  answer('{"error":"Job not found."}', { status: 404, headers: { 'content-type': 'application/json' } });
  await fails('server', (e) => { assert.equal(e.message, 'Job not found.', 'the server\'s own sentence is used'); assert.equal(e.status, 404); });
  answer('{}', { status: 500, headers: { 'content-type': 'application/json' } });
  await fails('server', (e) => assert.equal(e.message, 'That did not work. Try again.'));
  answer('not json', { status: 500, headers: { 'content-type': 'application/json' } });
  await fails('server', (e) => assert.match(e.message, /server had a problem/));
  answer('not json', { status: 200, headers: { 'content-type': 'application/json' } });
  await fails('response', (e) => assert.match(e.message, /could not read/));
  answer('{"error":"   "}', { status: 400, headers: { 'content-type': 'application/json' } });
  await fails('server', (e) => assert.equal(e.message, 'That did not work. Try again.'));
  pass('no signal, expired sign-in (HTML, redirect or 401), a server error, and an unreadable reply each fail with their own kind and sentence');

  // 3. A page can tell "sign in again" from the rest.
  assert.equal(isSessionExpired(new InternalFetchError('session', 'x')), true);
  assert.equal(isSessionExpired(new InternalFetchError('network', 'x')), false);
  assert.equal(isSessionExpired(new Error('x')), false); assert.equal(isSessionExpired(undefined), false);
  assert.ok(!/Unexpected token|JSON/.test(SESSION_EXPIRED_MESSAGE + NO_SIGNAL_MESSAGE), 'nobody sees parser wording');
  pass('isSessionExpired separates "sign in again" from every other failure');
} finally { globalThis.fetch = realFetch; }

// 4. The shared escape handles every character that can break out of text or a quoted attribute.
{
  assert.equal(esc(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  assert.equal(esc(null), ''); assert.equal(esc(undefined), ''); assert.equal(esc(0), '0'); assert.equal(esc(35.5), '35.5');
  assert.equal(esc('&amp;'), '&amp;amp;', 'already-escaped text is escaped again, never trusted');
  for (const hostile of ['"><script>x</script>', `' onmouseover='x`, '</textarea><svg onload=x>']) assert.ok(!/[<>"']/.test(esc(hostile)), `no raw markup or quote survives: ${hostile}`);
  pass('esc covers & < > " \' and never trusts text that already looks escaped');
}

console.log('\nAll internal fetch checks passed.');
