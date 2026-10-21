// GET /internal/api/search?q=pat  leads, quotes and jobs that match a name, phone, email, address, city or id.
// Read only, behind the internal session middleware, never cached. See functions/internal/_lib/find.mjs.

import { findRecords } from '../_lib/find.mjs';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
  });
}

export async function onRequestGet(context) {
  const db = context.env?.QUOTES_DB;
  if (!db) return json({ query: '', leads: [], quotes: [], jobs: [], status: 'unavailable' });
  const q = new URL(context.request.url).searchParams.get('q') || '';
  try {
    return json({ status: 'ok', ...(await findRecords(db, q)) });
  } catch {
    return json({ query: '', leads: [], quotes: [], jobs: [], status: 'unavailable' });
  }
}

export async function onRequest(context) {
  if (context.request.method === 'GET' || context.request.method === 'HEAD') return onRequestGet(context);
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { allow: 'GET, HEAD', 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
