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
   (Workers AI Whisper through the `AI` binding). The transcript is appended to the notes box for Mark to correct.
   Audio is never stored or logged. Washington needs every party's consent to record a conversation, so the page
   tells Mark to dictate his own notes or get the customer's OK first.
2. **Draft.** `/internal/api/quote-notes` asks Groq (Gemini as fallback) for a JSON draft limited to the price-book ids.
3. **Validate (deterministic).** `validateDraft` keeps only known opening/material/brand/method ids, whole quantities
   1 to 99, at most 30 lines, a size only when every number in it appears in the notes, evidence phrases only when
   they appear in the notes, and customer facts only when the notes contain them. It carries no price field.
4. **Place.** The page adds each line with the same price-book suggestion as *Add line* (`suggestedUnitPrice`);
   anything the price book does not cover starts at $0, highlighted. Sizes and remarks go to the internal notes, not
   the printed line. Empty customer fields are filled; filled ones are not touched. *Undo draft* removes the lines.

## Output

Editable lines in the quote builder plus a notes block, then the normal flow: Mark edits prices, saves, Build Plan.

## Stop conditions

No provider key, both providers failing, or malformed model output → 503 and the notes stay in the box (no guessed
lines). No `AI` binding → "Voice is not connected yet" and the keyboard microphone still works. Over a budget → 413/429.
Never: price a line, invent a size or count, save a quote, or contact the customer.

## Completion

Done when `npm run test:quote-dictation` passes (validator, both handlers with stubbed providers, id parity with
`src/data/pricing.ts`, line mapping, page wiring). Budgets: 1 transcription per clip; 1 Groq call plus at most 1 Gemini
call per draft; 1,400 output tokens; 15 s per call; 90 clips per hour and 30 drafts per 15 minutes per visitor.
Unverified until a phone is used: iOS Safari recording format with Whisper, background noise accuracy.
