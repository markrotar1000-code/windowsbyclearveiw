import { checkSetup } from '../_lib/setup-check.mjs';

// GET only. Yes/no answers about which settings are in place; never a value. Behind the /internal login like every other API here.
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
});

export async function onRequestGet(context) {
  const items = await checkSetup(context.env);
  return json({ items, allRequiredOk: items.filter((item) => item.required).every((item) => item.ok) });
}

export function onRequest() {
  return json({ error: 'Method not allowed.' }, 405);
}
