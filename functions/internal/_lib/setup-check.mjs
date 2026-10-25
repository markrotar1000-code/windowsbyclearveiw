// Which of the site's settings are actually in place, in plain words, so a missing key or binding is found on a screen
// instead of when a feature quietly stops working. Yes or no only: this never returns a value, a name of a secret's
// contents, or anything that could be used to sign in or call a service. The page that shows it is behind the Command
// Center login, and the answers are the same ones the features themselves use.
import { accessConfig } from './access.mjs';
import { sessionSecret } from './session.mjs';

const has = (value) => typeof value === 'string' ? value.trim() !== '' : Boolean(value);

/**
 * Items in the order they matter. `required` ones are core: without them a basic job fails. The others each unlock one
 * feature and say which. `fix` says where the setting lives; it never contains the setting.
 */
export async function checkSetup(env) {
  let database = false;
  try { database = Boolean(env?.QUOTES_DB && (await env.QUOTES_DB.prepare('SELECT 1 AS ok').first())?.ok === 1); } catch { database = false; }

  const groq = has(env?.GROQ_API_KEY);
  const gemini = has(env?.GEMINI_API_KEY);
  const canonicalSecret = has(env?.INTERNAL_SESSION_SECRET);
  const legacySecret = has(env?.INTERNAL_SESSION_SECRE);
  const access = Boolean(accessConfig(env || {}));

  return [
    { id: 'database', required: true, ok: database, label: 'Database', unlocks: 'Everything: leads, quotes, jobs, payments.', fix: 'Cloudflare Pages > Settings > Bindings: D1 database named QUOTES_DB.' },
    { id: 'sign_in', required: true, ok: has(sessionSecret(env)) && (has(env?.INTERNAL_PASSWORD) || access), label: 'Sign-in', unlocks: 'Signing in to the Command Center.', fix: 'Cloudflare Pages > Settings > Variables: INTERNAL_PASSWORD and INTERNAL_SESSION_SECRET (or Cloudflare Access).',
      note: !canonicalSecret && legacySecret ? 'Works, but the session secret uses an older misspelled name. Rename it to INTERNAL_SESSION_SECRET when convenient.' : access ? 'Cloudflare Access is also on.' : '' },
    { id: 'voice', required: false, ok: typeof env?.AI?.run === 'function', label: 'Voice recording', unlocks: 'The Record button on a new quote, and photo descriptions in Ask.', fix: 'Cloudflare Pages > Settings > Bindings: Workers AI binding named AI.' },
    { id: 'drafting', required: false, ok: groq || gemini, label: 'AI drafting', unlocks: 'Draft lines from notes, Copilot, and the Ask assistant.', fix: 'Cloudflare Pages > Settings > Variables: GROQ_API_KEY and/or GEMINI_API_KEY.',
      note: groq && gemini ? 'Both providers are set, so one can back up the other.' : groq || gemini ? 'One provider is set. Setting both lets one back up the other.' : '' },
    { id: 'email', required: false, ok: has(env?.RESEND_API_KEY), label: 'Email', unlocks: 'New-request emails to you, customer receipts, and invoices.', fix: 'Cloudflare Pages > Settings > Variables: RESEND_API_KEY.' },
    { id: 'phone_alert', required: false, ok: has(env?.LEAD_ALERT_NTFY_TOPIC), label: 'New-lead phone alert', unlocks: 'An instant push to your phone when a request arrives.', fix: 'Cloudflare Pages > Settings > Variables: LEAD_ALERT_NTFY_TOPIC.' },
    { id: 'photo_backup', required: false, ok: Boolean(env?.JOB_PHOTOS), label: 'Job photo backup', unlocks: 'Backing job photos up off the phone.', fix: 'Cloudflare Pages > Settings > Bindings: R2 bucket named JOB_PHOTOS.' },
    { id: 'spam_guard', required: false, ok: has(env?.TURNSTILE_SECRET_KEY), label: 'Spam protection', unlocks: 'The security check on the public estimate form.', fix: 'Cloudflare Pages > Settings > Variables: TURNSTILE_SECRET_KEY.' },
  ];
}
