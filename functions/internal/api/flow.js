// GET /internal/api/flow?quoteId=Q-...   or   ?jobId=J-...
// Where a customer is on the way from quote to paid, and the one thing to do next (see functions/internal/_lib/flow.mjs).
// Read only, behind the internal session middleware, never cached.

import { readFlow } from '../_lib/flow.mjs';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
  });
}

const clean = (value) => (typeof value === 'string' && /^[A-Za-z0-9._-]{1,60}$/.test(value.trim()) ? value.trim() : '');

export async function onRequestGet(context) {
  const db = context.env?.QUOTES_DB;
  if (!db) return json({ status: 'unavailable' }, 503);
  const params = new URL(context.request.url).searchParams;
  const quoteId = clean(params.get('quoteId'));
  const jobId = clean(params.get('jobId'));
  if (!quoteId && !jobId) return json({ error: 'Give a quoteId or a jobId.' }, 400);
  try {
    const flow = await readFlow(db, { quoteId, jobId });
    return flow ? json({ status: 'ok', ...flow }) : json({ error: 'Not found.' }, 404);
  } catch {
    return json({ status: 'unavailable' }, 503);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'GET' || context.request.method === 'HEAD') return onRequestGet(context);
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { allow: 'GET, HEAD', 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
