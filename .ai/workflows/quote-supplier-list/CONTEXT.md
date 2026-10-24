# Workflow: Quote builder to supplier pricing request

## Load / exclude

| Load | Do not load |
|---|---|
| `src/lib/supplier-list.ts`, `src/scripts/supplier-list.ts`, `src/components/internal/SupplierList.astro` | supplier permit reports or rows, customer business records |
| `src/pages/internal/quotes/new.astro`, `scripts/test-supplier-list.mjs` | installation/ordering rules unless explicitly changing those contracts |

## Input

The current in-memory quote builder lines (new or edited draft), whole quantities, work type and optional quote reference. No saved quote is required. Source: `src/pages/internal/quotes/new.astro`.

## Process

1. Mark presses **Format for supplier** in the builder's Supplier list block.
2. Deterministic code snapshots only line labels/quantities. Sizes already in labels carry through without reinterpretation. Prices, totals, discounts, customer fields, line descriptions and internal/rough notes are not copied.
3. Mark may exclude labor/repair lines and explicitly add quantity units, product details, reference and a supplier message. These additions stay only in the open preview, not D1 or browser storage.
4. The preview is a pricing request, not an order. Missing details remain marked for confirmation. Siding wall area is not converted into material purchases.
5. Mark copies, downloads text/CSV, uses native Share if available, or opens an email draft with no guessed recipient. Nothing is sent automatically; no server endpoint or AI provider is involved.
6. Source description, quantity or work-type changes disable sharing until Mark regenerates. Rebuilding preserves selection/details for surviving source objects. Invalid typed quantities cannot export the last good hidden value.

## Output

An inspectable text request and optional CSV. `src/lib/supplier-list.ts` formats explicit allowed fields; `src/scripts/supplier-list.ts` binds the in-memory builder and export controls; `src/components/internal/SupplierList.astro` supplies the phone-friendly UI.

## Stop conditions

No selected lines, blank descriptions, non-whole/nonpositive quantities, more than 200 lines, or changed source snapshot: disable exports and explain. Missing sizes/series/colors/glass/handing remain unknown, never inferred. Blocked clipboard/share falls back to manual copy/download. Long email links are disabled rather than truncated. CSV cells are quoted and formula prefixes neutralized.

## Completion

`npm run test:supplier-list`, full `npm run test:all`, separate build, and browser checks for new/edit builder entry, selection, regeneration, privacy, invalid quantity, stale source, copy/export and phone/enlarged-text layout. Inspect hosted/live authenticated UI without saving a test quote or sending a supplier message. Record browser/provider limits in state/handoff.
