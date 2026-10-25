// GET /internal/api/supplier-permits                        counts, charts and the builder table (no personal data)
// GET /internal/api/supplier-permits?view=list[&group=remodel][&builder=TESTCO HOMES][&limit=100][&offset=0]
//                                                           permit rows with owner names, mailing addresses and phones, and for each
//                                                           permit the same project in our other lists (permit leads, mail pilot),
//                                                           our own quotes and jobs at the same street, and the builder (number + name)
// GET /internal/api/supplier-permits?view=csv[&group=remodel]
//                                                           the same rows as a spreadsheet download
//
// GET /internal/api/supplier-permits?view=contacts[&phone=3605550100]
//                                                           the do-not-contact numbers and the latest call log (one number's history with phone=)
// POST /internal/api/supplier-permits                       { action: 'log' | 'block' | 'unblock', phone, ... }: write a call to the log, put a number on
//                                                           the do-not-contact list, or take it off (needs a written reason). Nothing else here writes.
//
// Read model for the "Supplier permit list" section of the Analytics page, behind the internal session middleware
// like every /internal route. The data is the latest merge of `npm run build:supplier-permits`; this endpoint only
// reads it. The list and the file carry owner names, mailing addresses and phone numbers from a licensed report,
// so they are separate requests the page makes only when asked, and neither is ever cached (no-store here, and the
// service worker does not intercept this path).

import { guardWrite, methodNotAllowed } from '../_lib/request-guard.mjs';
import { blockPhone, cleanGroup, logContact, readContacts, readSupplierCsv, readSupplierList, readSupplierSummary, unblockPhone } from '../_lib/supplier-permits.mjs';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function onRequestGet(context) {
  const db = context.env?.QUOTES_DB;
  if (!db) return json({ status: 'unavailable' });
  const url = new URL(context.request.url);
  const view = url.searchParams.get('view') || 'summary';
  const group = cleanGroup(url.searchParams.get('group'));
  try {
    if (view === 'summary') return json(await readSupplierSummary(db));
    if (view === 'list') {
      return json({ status: 'ok', ...(await readSupplierList(db, { group, builder: url.searchParams.get('builder'), limit: url.searchParams.get('limit'), offset: url.searchParams.get('offset') })) });
    }
    if (view === 'contacts') return json({ status: 'ok', ...(await readContacts(db, { phone: url.searchParams.get('phone') || '' })) });
    if (view === 'csv') {
      const file = await readSupplierCsv(db, { group });
      if (file.count === 0) return json({ status: 'empty' }, 404);
      const stamp = new Date().toISOString().slice(0, 10);
      return new Response(file.csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="clearview-supplier-permits-${file.group || 'all'}-${stamp}.csv"`,
          'cache-control': 'private, no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    }
    return json({ error: 'Unknown view.' }, 400);
  } catch {
    // A missing or locked database must not break the Analytics page.
    return json({ status: 'unavailable' });
  }
}

export async function onRequestPost(context) {
  const guard = await guardWrite(context);
  if (!guard.ok) return guard.response;
  const db = context.env?.QUOTES_DB;
  if (!db) return json({ status: 'unavailable' }, 503);
  const body = guard.body;
  if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON.' }, 400);
  try {
    const result = body.action === 'log' ? await logContact(db, body)
      : body.action === 'block' ? await blockPhone(db, body)
      : body.action === 'unblock' ? await unblockPhone(db, body)
      : { ok: false, error: 'Unknown action.', status: 400 };
    if (!result.ok) return json({ error: result.error }, result.status || 400);
    return json({ status: 'ok', phone: result.phone, blocked: result.blocked }, body.action === 'log' ? 201 : 200);
  } catch {
    return json({ error: 'Could not save. Try again.' }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  if (context.request.method === 'GET' || context.request.method === 'HEAD') return onRequestGet(context);
  return methodNotAllowed(['GET', 'HEAD', 'POST']);
}
