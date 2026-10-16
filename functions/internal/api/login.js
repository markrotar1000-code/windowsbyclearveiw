import { createSessionToken, sessionCookie, sessionSecret } from '../_lib/session.mjs';
import { takeRateLimit } from '../../_lib/abuse-guard.mjs';

// One shared password guards the Command Center. Cloudflare Access fronts the custom domain, but the
// *.pages.dev address has only this login, so it must not be guessable at network speed. Every attempt
// counts (a right password too), per visitor, and is refused before the password is compared.
export const LOGIN_RATE_LIMIT = { bucket: 'internal-login', limit: 10, windowSeconds: 900 };

const encoder = new TextEncoder();

/**
 * Compare password material without a direct length-mismatch branch.
 *
 * Hashing both values to fixed-size SHA-256 digests means the comparison
 * always walks the same 32-byte digest length. The submitted password's
 * hashing cost naturally depends on its own length, which is already known
 * to the caller; the comparison itself does not stop early based on the
 * secret's length or expose a length mismatch before comparing the digest.
 */
async function timingSafeEqual(a, b) {
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const bytesA = new Uint8Array(digestA);
  const bytesB = new Uint8Array(digestB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const secret = sessionSecret(env);
  if (!env.INTERNAL_PASSWORD || !secret) {
    return redirectToLogin(request, 'not-configured');
  }

  const limited = await takeRateLimit(env, request, LOGIN_RATE_LIMIT);
  if (limited.limited) return redirectToLogin(request, 'too-many');

  let form;
  try {
    form = await request.formData();
  } catch {
    return redirectToLogin(request, 'bad-request');
  }

  const password = String(form.get('password') || '');
  const next = String(form.get('next') || '/internal/quotes');

  if (!password || !(await timingSafeEqual(password, env.INTERNAL_PASSWORD))) {
    return redirectToLogin(request, 'wrong-password', next);
  }

  const token = await createSessionToken(secret);
  const target = next.startsWith('/internal') ? next : '/internal/quotes';

  return new Response(null, {
    status: 303,
    headers: {
      location: new URL(target, request.url).toString(),
      'set-cookie': sessionCookie(token),
      'cache-control': 'no-store',
    },
  });
}

function redirectToLogin(request, reason, next) {
  const url = new URL('/internal/login', request.url);
  url.searchParams.set('error', reason);
  if (next) url.searchParams.set('next', next);
  return new Response(null, {
    status: 303,
    headers: { location: url.toString(), 'cache-control': 'no-store' },
  });
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ error: 'POST a password from the login form.' }), {
    status: 405,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
