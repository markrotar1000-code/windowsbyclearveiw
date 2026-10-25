import { json } from '../../_lib/quotes.mjs';
import { emailInvoice, getInvoice } from '../../_lib/invoices.mjs';
import { guardWrite, methodNotAllowed } from '../../_lib/request-guard.mjs';

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = String(params.id || '');
  const record = await getInvoice(env.QUOTES_DB, id);
  if (!record) return json({ error: 'Invoice not found.' }, 404);
  return json(record);
}

export async function onRequestPost(context) {
  const { params } = context;
  const guard = await guardWrite(context);
  if (!guard.ok) return guard.response;
  const body = guard.body;
  const id = String(params.id || '');

  if (body?.action !== 'email') return json({ error: 'Unsupported invoice action.' }, 400);

  try {
    const result = await emailInvoice(context, id);
    return json(result, result.status || 200);
  } catch (error) {
    console.error('invoice-action-failed', error);
    return json({ error: 'Could not send the invoice.' }, 500);
  }
}

export async function onRequest(context) {
  const handler = new Map([['GET', onRequestGet], ['POST', onRequestPost]]).get(context.request.method);
  return handler ? handler(context) : methodNotAllowed(['GET', 'POST']);
}
