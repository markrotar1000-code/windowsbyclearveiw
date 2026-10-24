// Turns Mark's rough spoken or typed walk-through notes into DRAFT quote lines.
//
// The model only reads the notes and says what Mark said: which openings, how many, which room, extras.
// This module is the deterministic gate between that output and the quote builder. It never prices
// anything (prices come from the price book in the browser, and Mark edits them), never invents a size
// that is not in the notes, and drops anything it cannot validate. Contract: .ai/workflows/quote-dictation/.
//
// The id lists below are kept equal to src/data/pricing.ts by hand (Pages Functions never import from
// src/); `test:quote-dictation` fails if they drift.

import { extractSizes, formatSize, sizeKey } from '../../_lib/dimensions.mjs';

export const OPENING_IDS = ['slider', 'double-hung', 'single-hung', 'picture', 'casement', 'awning', 'bay-bow', 'sliding-door', 'french-door'];
export const MATERIAL_IDS = ['vinyl', 'fiberglass'];
export const BRAND_IDS = ['cascade', 'milgard'];
export const METHODS = ['insert', 'fin'];

// Budgets (AI Operating Contract section 6).
export const MAX_NOTES_CHARS = 4000;
export const MAX_LINES = 30;
export const MAX_QUANTITY = 99;

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const pick = (v, allowed) => (allowed.includes(String(v ?? '').toLowerCase()) ? String(v).toLowerCase() : null);

/** The system prompt. Lists the allowed ids so the model maps speech onto the price book, nothing else. */
export function extractionPrompt() {
  return [
    'You turn a window contractor\'s rough walk-through notes into a draft quote. Output ONLY one JSON object, no prose.',
    'Shape: {"customer":{"name":"","phone":"","address":"","city":""},"lines":[{"type":"window"|"custom","openingId":"","materialId":"","brandId":"","method":"","quantity":1,"room":"","size":"","label":"","note":"","heard":""}]}',
    `openingId must be one of: ${OPENING_IDS.join(', ')}. materialId one of: ${MATERIAL_IDS.join(', ')} or "". brandId one of: ${BRAND_IDS.join(', ')} or "". method one of: ${METHODS.join(', ')} ("fin" = full-frame/fin install) or "".`,
    'Use type "window" for a window or door that fits the openingId list. Use type "custom" (with a short label) for anything else Mark mentions: trim, rot repair, siding, paint, haul-away, a discount. Never use type "custom" for a price.',
    'Rules: copy only what the notes say. Leave a field "" when the notes do not say it. NEVER output a price, a cost, or a dollar amount. NEVER invent a size, count, brand or material. "size" is only a width-by-height the notes literally state, in inches with fractions written with a slash (e.g. "35 1/2 x 47 3/4"); never convert, round or combine numbers. "heard" is the exact short phrase from the notes this line came from, and it must include the size words when the notes give a size for that opening. One line per distinct kind of opening per room; quantity is how many of that opening.',
    'Customer fields only if the notes state them. Ignore small talk. If nothing is quotable, return {"customer":{},"lines":[]}.',
  ].join('\n');
}

/** First JSON object in a model reply, or null. Tolerates ```json fences and stray text. */
export function parseModelJson(text) {
  const s = String(text ?? '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(s.slice(start, end + 1));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// Lower case, punctuation and spacing flattened: "Two double-hungs, 36 by 48." matches "two double hungs 36 by 48".
export const normalize = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Validates model output against the notes. Returns { lines, customer, dropped } and never throws.
 * `dropped` counts lines that could not be validated, so the page can say "N lines skipped, check your notes".
 */
export function validateDraft(raw, notes) {
  const out = { lines: [], customer: {}, dropped: 0 };
  if (!raw || typeof raw !== 'object') return out;
  const text = String(notes ?? '');
  const flat = normalize(text);
  const noteSizes = new Map(extractSizes(text).map((size) => [sizeKey(size), size]));

  const c = raw.customer && typeof raw.customer === 'object' ? raw.customer : {};
  const phoneDigits = clean(c.phone, 40).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  // A phone number or name only counts if the notes contain it (no guessing at a customer).
  if (phoneDigits.length === 10 && text.replace(/\D/g, '').includes(phoneDigits)) out.customer.phone = phoneDigits;
  const name = clean(c.name, 200);
  if (name && flat.split(' ').includes(normalize(name).split(' ')[0])) out.customer.name = name;
  for (const key of ['address', 'city']) {
    const v = clean(c[key], key === 'city' ? 120 : 300);
    if (v && flat.includes(normalize(v).split(' ')[0])) out.customer[key] = v;
  }

  const rawLines = Array.isArray(raw.lines) ? raw.lines : [];
  for (const item of rawLines) {
    if (out.lines.length >= MAX_LINES) { out.dropped += 1; continue; }
    if (!item || typeof item !== 'object') { out.dropped += 1; continue; }
    const quantity = Math.round(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QUANTITY) { out.dropped += 1; continue; }
    const room = clean(item.room, 60);
    const note = clean(item.note, 200);
    // Evidence: keep the phrase only if it really is in the notes.
    const heardRaw = clean(item.heard, 160);
    const heardFlat = normalize(heardRaw);
    const heard = heardFlat && flat.includes(heardFlat) ? heardRaw : '';
    // A size is a measurement, so code (not the model) decides what it is: it must be a width-by-height that the notes
    // actually contain, compared as exact sixteenths of an inch, and it is always written back the standard way.
    // If the model left it out but the evidence phrase holds exactly one size, that size is the line's size.
    const claimed = extractSizes(clean(item.size, 60))[0];
    const inNotes = claimed ? noteSizes.get(sizeKey(claimed)) : null;
    // Only when the model gave no size at all: a size it claimed that the notes do not contain is dropped, never swapped.
    const fromHeard = !claimed && heard ? extractSizes(heard) : [];
    const sizeSource = inNotes || (fromHeard.length === 1 ? noteSizes.get(sizeKey(fromHeard[0])) : null);
    const size = sizeSource ? formatSize(sizeSource) : '';
    const sizeRounded = Boolean(sizeSource?.rounded);

    if (item.type === 'window') {
      const openingId = pick(item.openingId, OPENING_IDS);
      if (!openingId) { out.dropped += 1; continue; }
      out.lines.push({
        type: 'window',
        openingId,
        materialId: pick(item.materialId, MATERIAL_IDS),
        brandId: pick(item.brandId, BRAND_IDS),
        method: pick(item.method, METHODS),
        quantity,
        room,
        size,
        sizeRounded,
        note,
        heard,
      });
    } else if (item.type === 'custom') {
      const label = clean(item.label, 120);
      if (!label) { out.dropped += 1; continue; }
      // Custom lines come back unpriced: Mark types the number.
      out.lines.push({ type: 'custom', label, quantity, room, size: '', sizeRounded: false, note, heard });
    } else {
      out.dropped += 1;
    }
  }
  return out;
}

/** The line label shown in the quote table for a drafted window line (the page adds the price-book names). */
export function roomPrefix(room) {
  return room ? `${room}: ` : '';
}
