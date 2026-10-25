// One place for the checks a state-changing Command Center handler should make before it touches anything:
// the request comes from this site's own pages, its body is a bounded JSON document, and the method is one it supports.
// Every /internal/* request is already behind the login middleware; these are the layer under it (a request that
// carries a valid cookie but was started by another site, or one that is simply too large).
//
// Handlers had four or five hand-copied versions of the origin check. This is the one to use for new code and the
// one the per-area guard units adopt. Pure functions on Request/Response, so they run unchanged in tests.

export const DEFAULT_MAX_BYTES = 64 * 1024;

export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', ...headers },
  });
}

/**
 * True when the request came from this site. A browser always sends Origin on a cross-site write, so an Origin that does
 * not match is refused. With no Origin (a test, a tool, a privacy setting) Sec-Fetch-Site decides when the browser sent
 * it: anything other than same-origin or none (a typed address) is refused. With neither header the request is allowed:
 * only a browser can carry the visitor's cookie to us from another site, and browsers send at least one of them.
 */
export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin) {
    try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
  }
  const site = request.headers.get('Sec-Fetch-Site');
  return !site || site === 'same-origin' || site === 'none';
}

export function methodNotAllowed(allowed = []) {
  return jsonResponse({ error: 'Method not allowed.' }, 405, allowed.length ? { allow: allowed.join(', ') } : {});
}

/**
 * Reads a JSON body no larger than `maxBytes`. Returns { ok: true, body } or { ok: false, response } where the response
 * is ready to return (413 too large, 400 not JSON). The size is checked on the declared length first, then on the bytes
 * actually read, because the declared length can be missing or wrong.
 */
export async function readJsonBounded(request, maxBytes = DEFAULT_MAX_BYTES) {
  const tooLarge = () => ({ ok: false, response: jsonResponse({ error: 'That request is too large.' }, 413) });
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) return tooLarge();
  let bytes;
  try {
    // Read the stream and stop at the cap, so a body with no or a false content-length is never buffered whole.
    const reader = request.body?.getReader();
    if (!reader) bytes = new Uint8Array(await request.arrayBuffer());
    else {
      const chunks = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) { await reader.cancel().catch(() => {}); return tooLarge(); }
        chunks.push(value);
      }
      bytes = new Uint8Array(total);
      let at = 0;
      for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
    }
  } catch { return { ok: false, response: jsonResponse({ error: 'Invalid request.' }, 400) }; }
  if (bytes.byteLength > maxBytes) return tooLarge();
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, response: jsonResponse({ error: 'Invalid JSON.' }, 400) };
  }
}

/**
 * The usual start of a write handler: `const guard = await guardWrite(context); if (!guard.ok) return guard.response;`
 * then use `guard.body`. Pass `{ json: false }` for a write with no body (a DELETE), which still gets the origin check.
 */
export async function guardWrite(context, { maxBytes = DEFAULT_MAX_BYTES, json = true } = {}) {
  const { request } = context;
  if (!sameOrigin(request)) return { ok: false, response: jsonResponse({ error: 'Cross-origin requests are not allowed.' }, 403) };
  if (!json) return { ok: true, body: undefined };
  return readJsonBounded(request, maxBytes);
}
