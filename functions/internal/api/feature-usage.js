import { CLIENT_FEATURES, readUsage, recordUsage } from '../_lib/feature-usage.mjs';

// GET: counts for the Tools page. POST: the browser reporting that a saved quote kept lines from a draft or from the
// Measurements worksheet. Counts only, nothing about the quote itself. Reachable only behind the /internal login.
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
});

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.QUOTES_DB) return json({ error: 'Database is not connected.' }, 503);
  const days = new URL(request.url).searchParams.get('days');
  return json(await readUsage(env.QUOTES_DB, days));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: 'Cross-origin requests are not allowed.' }, 403);
  let body;
  try { body = JSON.parse(new TextDecoder().decode(await request.arrayBuffer())); } catch { return json({ error: 'Invalid request.' }, 400); }
  const feature = typeof body?.feature === 'string' ? body.feature : '';
  if (!CLIENT_FEATURES.includes(feature)) return json({ error: 'Unknown feature.' }, 400);
  const counted = await recordUsage(env, feature, 'ok');
  return json({ ok: counted });
}

export function onRequest(context) {
  return json({ error: 'Method not allowed.' }, 405);
}
