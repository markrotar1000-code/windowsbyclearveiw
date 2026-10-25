import { clearSessionCookie } from '../_lib/session.mjs';
import { guardWrite, methodNotAllowed } from '../_lib/request-guard.mjs';

// Invoked by the "Log out" form in the layout (a same-origin form POST, no JSON body), so only the origin is checked.
export async function onRequestPost(context) {
  const guard = await guardWrite(context, { json: false });
  if (!guard.ok) return guard.response;
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL('/internal/login', context.request.url).toString(),
      'set-cookie': clearSessionCookie(),
      'cache-control': 'no-store',
    },
  });
}

export async function onRequest() {
  return methodNotAllowed(['POST']);
}
