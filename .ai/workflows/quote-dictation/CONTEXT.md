# Workflow: Rough notes → draft quote lines

Mark talks (or types) his walk-through notes on the new-quote page; the page turns them into editable draft lines.
It sits inside `lead-to-quote` step 4 (Quote) and changes none of its gates: items, quantities and prices are still
Mark's, and nothing is saved until he saves.

## Load / exclude

| Load | Do not load |
|---|---|
| `functions/internal/api/quote-dictation.js`, `functions/internal/api/quote-notes.js`, `functions/internal/_lib/quote-notes.mjs` | `.ai/workflows/build-plan/`, specialists |
| `src/lib/quote-notes-lines.ts`, `src/pages/internal/quotes/new.astro` (Rough notes block), `src/lib/quote-pricing.ts` | public copy references |
| `.ai/AI-OPERATING-CONTRACT.md` (sections 2, 5, 6, 10) | `CHANGELOG.md` |

## Input

Mark's words: a spoken clip (up to 45 s, 1.5 MB) or typed text (up to 4,000 characters). Nothing else is sent to a
model: no customer record, no prices, no history.

## Process

1. **Record (optional).** Push-to-talk in the browser; each clip is sent on its own to `/internal/api/quote-dictation`
   (Workers AI Whisper through the `AI` binding). Clips are added to the notes box strictly in the order recorded; a
   failed clip is kept for *Retry recording*; locking the screen ends the recording and still sends what was captured.
   Unsent notes are kept on the device for 12 hours and forgotten when the quote is saved.
   Audio is never stored or logged. The microphone control lives in the Rough notes block: an **Allow microphone**
   button (asks again while the browser is still asking), a picker for the input (remembered on the device, locked
   while recording, falls back to the default if it is unplugged, refreshed on `devicechange`), and, when the browser
   has really blocked it, device-specific steps with **Check again**. A page cannot reopen a blocked permission; that
   is a browser rule. `public/_headers` serves `Permissions-Policy: microphone=(self)` on `/internal*` only (public
   pages keep `microphone=()`); the site-wide policy had been blocking it for everyone. Washington needs every party's consent to record a conversation, so the page
   tells Mark to dictate his own notes or get the customer's OK first.
2. **Draft.** When Mark stops recording (default; a checkbox turns it off) or taps *Draft lines*, only the words added
   since the last draft are sent (`nextDraftText`), so room-by-room use never duplicates lines. Editing drafted words
   asks before replacing the earlier lines. `/internal/api/quote-notes` asks Groq (Gemini as fallback) for a JSON draft limited to the price-book ids.
3. **Sizes (deterministic, `functions/_lib/dimensions.mjs`).** A size is read by code, never by the model: width by
   height in inches, exact sixteenths, written back as `35 1/2 x 47 3/4` (slash fraction, never a dash or a decimal)
   whether it was said ("thirty five and a half by forty seven and three quarters") or typed ("35-1/2 x 47-3/4",
   "35.5 by 47.75"). The transcription endpoint rewrites sizes in the transcript, and the page lists every size in the
   notes box (`Sizes heard`) the moment it appears so Mark can check it against the tape. A model-claimed size is kept
   only if the same width and height appear in the notes; a size the model forgot is taken from its own evidence phrase
   when that holds exactly one; a decimal that is not a multiple of 1/16 is rounded and flagged. Only 6 to 144 inches
   count (a "2 by 4" is lumber). The size goes at the end of the quote line label, and the Build Plan prefills the
   opening's dimensions from it but keeps "VERIFY at site". Speech recognition is not perfect and this does not claim it
   is: the guarantees are that code (not a model) turns words into numbers, that nothing is kept that was not said, and
   that every size is shown back in the standard form at three points (the clip, the notes box, the line).
4. **Validate (deterministic).** `validateDraft` keeps only known opening/material/brand/method ids, whole quantities
   1 to 99, at most 30 lines, a size only as described above, evidence phrases only when
   they appear in the notes, and customer facts only when the notes contain them. It carries no price field.
5. **Place.** The page adds each line with the same price-book suggestion as *Add line* (`suggestedUnitPrice`);
   anything the price book does not cover starts at $0, highlighted. Sizes and remarks go to the internal notes, not
   the printed line. Empty customer fields are filled; filled ones are not touched. *Undo draft* removes the lines.

## Also on the new-quote page

- **From Measurements** (`src/lib/measurement-lines.ts`): the Tools > Measurements worksheet becomes draft lines in one tap,
  after a preview Mark can read back. Every worksheet type has a defined result: price-book types (single/double-hung,
  slider, casement, picture, awning, bay/bow, patio door) come in as window lines with the usual starting price; an entry
  door or "Other" comes in as an unpriced custom line flagged at $0. Sizes are written `35 1/2 x 47 3/4`; a half-measured
  size is called out, never filled in. Existing lines are untouched, a second tap cannot duplicate (Undo removes exactly
  what was added), and job/opening notes go to the internal notes once. This replaced an older decimal-label import that
  lived in `InternalLayout.astro`.
- **Recordings survive a bad signal** (`src/lib/clip-store.ts`): a clip is saved on the phone (IndexedDB) before it is sent
  and deleted once written out; with no signal it waits and sends itself on the `online` event; after a reload it is
  offered with Retry / Delete, never sent on its own (it may belong to another quote); kept at most 12 hours, 12 clips.
  A clip the server refuses outright (too long) is not kept. Audio is still never stored on our servers.
- **Level meter and silence warning** (`src/lib/audio-level.ts`): a live bar while recording, and after six seconds of near
  silence the page says it is not hearing anything (covered or wrong microphone).
- **Sizes read back aloud** (optional, off by default): after the microphone is off, as "35 and a half by 47 and three
  quarters" (`spokenSize`).

- **Is it being used?** (`functions/internal/_lib/feature-usage.mjs`, shown on Tools): counts only, one row per day and feature
  (voice clips, drafts, quotes saved with drafted lines, quotes saved with Measurements lines) with how many worked and how
  many did not. No audio, words, customers, phone numbers or IPs; the table has no column that could hold them. A quote is
  counted only when drafted or imported lines are still on it at save. It exists for the 90-day "does this earn its keep" audit.

## Output

Editable lines in the quote builder plus a notes block, then the normal flow: Mark edits prices, saves, Build Plan.

## Stop conditions

No provider key, both providers failing, or malformed model output → 503 and the notes stay in the box (no guessed
lines). No `AI` binding → "Voice is not connected yet" and the keyboard microphone still works. Over a budget → 413/429.
Never: price a line, invent a size or count, save a quote, or contact the customer.

## Completion

Done when `npm run test:quote-dictation` passes (validator, both handlers with stubbed providers, id parity with
`src/data/pricing.ts`, line mapping, page wiring). Budgets: 1 transcription per clip; 1 Groq call plus at most 1 Gemini
call per draft; 1,400 output tokens; 15 s per call; 90 clips per hour and 60 drafts per 15 minutes per visitor.
Browser behavior (recorder, ordering, retry, restore, locked screen) is checked by `node scripts/audit-quote-dictation.mjs` (needs Playwright and a build; not in CI).
Unverified until a phone is used: iOS Safari recording format with Whisper, background noise accuracy.
