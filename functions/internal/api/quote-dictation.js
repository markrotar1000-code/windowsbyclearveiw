import { takeRateLimit } from '../../_lib/abuse-guard.mjs';
import { extractSizes, formatSize, normalizeSizes } from '../../_lib/dimensions.mjs';
import { recordUsage } from '../_lib/feature-usage.mjs';

// One short voice clip -> text (Command Center > New quote > Rough notes > Record). Workers AI Whisper through the
// existing `AI` binding. The audio is decoded for this request only: it is never written to D1 or R2, never logged,
// and only the transcript goes back to the page. Budgets (AI Operating Contract section 6): clip <= 1.5 MB (about
// 90 s of phone audio), one model call, no retries, 90 clips per visitor per hour (about 47 Neurons a minute, so
// the free 10,000 a day is roughly 3.5 hours of audio), transcript capped at 2,000 characters.
export const DICTATION_RATE_LIMIT = { bucket: 'internal-quote-dictation', limit: 90, windowSeconds: 3600 };
export const MAX_AUDIO_BYTES = 1_500_000;
const MAX_TRANSCRIPT_CHARS = 2000;
const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo';
const AUDIO_TYPE = /^audio\/(webm|mp4|x-m4a|m4a|aac|ogg|wav|x-wav|mpeg|mp3)(?:;|$)/i;
// Words a window contractor says that a general model mishears. Vocabulary only: no prices, no names.
const VOCAB_PROMPT = 'Window quote notes. Sizes are width by height in inches, with fractions: 35 1/2 by 47 3/4, 36 by 48, 23 7/8 by 35 3/4, 71 1/4 by 59 5/8. Double-hung, single-hung, slider, picture window, casement, awning, bay, bow, sliding patio door, French door, fin, insert, vinyl, fiberglass, Cascade, Milgard, trim, rot repair, sill, Vancouver, Camas, Battle Ground, Ridgefield.';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
});

// Counted, never blocking: a clip that worked, or one that did not (silence, no binding, a model error).
const count = (context, outcome) => { const work = recordUsage(context.env, 'dictation_clip', outcome); if (typeof context.waitUntil === 'function') context.waitUntil(work); return work; };

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: 'Cross-origin requests are not allowed.' }, 403);
  if (!AUDIO_TYPE.test(request.headers.get('content-type') || '')) return json({ error: 'Send an audio clip.' }, 415);
  if (Number(request.headers.get('content-length') || 0) > MAX_AUDIO_BYTES) return json({ error: 'That clip is too long. Record shorter pieces.' }, 413);
  if (!env.AI || typeof env.AI.run !== 'function') { await count(context, 'degraded'); return json({ error: 'Voice is not connected yet. Type or use the keyboard microphone instead.', degraded: true }, 503); }

  const limited = await takeRateLimit(env, request, DICTATION_RATE_LIMIT);
  if (limited.limited) return json({ error: 'Too many clips this hour. Type the rest or try again later.' }, 429);

  const audio = new Uint8Array(await request.arrayBuffer());
  if (audio.byteLength === 0) return json({ error: 'The clip was empty.' }, 400);
  if (audio.byteLength > MAX_AUDIO_BYTES) return json({ error: 'That clip is too long. Record shorter pieces.' }, 413);

  try {
    const result = await env.AI.run(WHISPER_MODEL, { audio: toBase64(audio), language: 'en', task: 'transcribe', initial_prompt: VOCAB_PROMPT });
    // Sizes are rewritten by code, not by the model: "thirty five and a half by forty seven" and "35-1/2 x 47" both
    // come back as "35 1/2 x 47", and the page reads them back to Mark so a mishearing is caught while he is standing there.
    let heard = String(result?.text ?? '').replace(/\s+/g, ' ').trim();
    // On near-silence Whisper can repeat its own hint back. That is not Mark talking: treat it as empty.
    if (/window quote notes|sizes are width by height/i.test(heard)) heard = '';
    const text = normalizeSizes(heard).slice(0, MAX_TRANSCRIPT_CHARS);
    // Read from what was actually said: after rewriting, a rounded decimal (71.3) would look exact.
    const found = extractSizes(heard);
    await count(context, text === '' ? 'degraded' : 'ok');
    // Silence or a muffled pocket clip comes back empty: say so rather than adding nothing silently.
    return json({ text, empty: text === '', sizes: found.map(formatSize), roundedSizes: found.filter((size) => size.rounded).length });
  } catch (error) {
    console.error('quote-dictation-failed', error?.message || error);
    await count(context, 'degraded');
    return json({ error: "Couldn't hear that clip. Try again, or type it.", degraded: true }, 502);
  }
}

export function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'Method not allowed.' }, 405);
}
