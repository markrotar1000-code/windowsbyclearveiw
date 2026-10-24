import { groqChat, geminiGenerate } from '../../_lib/ai-gateway.mjs';
import { takeRateLimit } from '../../_lib/abuse-guard.mjs';
import { MAX_NOTES_CHARS, extractionPrompt, parseModelJson, validateDraft } from '../_lib/quote-notes.mjs';

// Rough notes -> draft quote lines (Command Center > New quote > Rough notes). Read-only: it saves nothing.
// Budgets (AI Operating Contract section 6): notes <= 4,000 chars; one Groq call, one Gemini fallback;
// 1,400 output tokens; 15 s per call; 60 requests per visitor per 15 minutes.
export const NOTES_RATE_LIMIT = { bucket: 'internal-quote-notes', limit: 60, windowSeconds: 900 };
const MAX_BODY_BYTES = 24 * 1024;
const MAX_OUTPUT_TOKENS = 1400;
const TIMEOUT_MS = 15000;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
});

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

async function withTimeout(run) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try { return await run(controller.signal); } finally { clearTimeout(timer); }
}

async function callGroq(env, system, notes) {
  if (!env.GROQ_API_KEY) return null;
  return withTimeout(async (signal) => {
    const response = await groqChat(env, {
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'system', content: system }, { role: 'user', content: notes }],
      temperature: 0,
      max_tokens: MAX_OUTPUT_TOKENS,
    }, { feature: 'quote-notes', signal });
    if (!response.ok) return null;
    const data = await response.json();
    return String(data?.choices?.[0]?.message?.content ?? '') || null;
  });
}

async function callGemini(env, system, notes) {
  if (!env.GEMINI_API_KEY) return null;
  return withTimeout(async (signal) => {
    const response = await geminiGenerate(env, 'gemini-3.6-flash', {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: notes }] }],
      generationConfig: { temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS, responseMimeType: 'application/json' },
    }, { feature: 'quote-notes', signal });
    if (!response.ok) return null;
    const data = await response.json();
    return String(data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join(' ') ?? '') || null;
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: 'Cross-origin requests are not allowed.' }, 403);

  const limited = await takeRateLimit(env, request, NOTES_RATE_LIMIT);
  if (limited.limited) return json({ error: 'Too many requests. Try again in a few minutes.' }, 429);

  let body;
  try {
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > MAX_BODY_BYTES) return json({ error: 'Notes are too long.' }, 413);
    body = JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const notes = typeof body?.notes === 'string' ? body.notes.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim() : '';
  if (!notes) return json({ error: 'Add some notes first.' }, 400);
  if (notes.length > MAX_NOTES_CHARS) return json({ error: `Notes are too long (limit ${MAX_NOTES_CHARS} characters). Split them into two drafts.` }, 413);

  const system = extractionPrompt();
  let reply = await callGroq(env, system, notes).catch(() => null);
  let provider = 'groq';
  let draft = reply ? parseModelJson(reply) : null;
  if (!draft) {
    reply = await callGemini(env, system, notes).catch(() => null);
    provider = 'gemini';
    draft = reply ? parseModelJson(reply) : null;
  }
  // Fail down: no draft, no guessing. The page keeps the notes so Mark can add lines by hand.
  if (!draft) return json({ error: "Couldn't draft lines from those notes right now. Your notes are kept; add the lines by hand or try again.", degraded: true }, 503);

  const { lines, customer, dropped } = validateDraft(draft, notes);
  return json({ lines, customer, dropped, provider, readOnly: true });
}

export function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'Method not allowed.' }, 405);
}
