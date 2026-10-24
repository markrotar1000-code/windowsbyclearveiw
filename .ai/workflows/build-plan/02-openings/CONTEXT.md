# Stage 02 — Openings

## Inputs

`01-scope` output plus explicit opening information from the quote.

## Process

Create a stable opening ID/number for every quoted window or door. A quote line that clearly names an extra (rot repair, trim, haul-away, permit, paint) and no window or door word is not an opening (`isOpeningLine` in `functions/_lib/build-plan-rules.mjs`, `test:plan-extras`); it is listed in VERIFY instead so it is confirmed on site. Doubtful lines stay openings. Record product/type, quantity, dimensions, existing condition, installation method, flashing/water-management considerations, and notes. Keep unknowns explicit.

## Outputs

`openings.json` with one record per opening and evidence state for each field.

## Stop conditions

Opening count conflicts with quote quantity; dimensions are treated as measured when they are not; or installation method is guessed from an ambiguous product label.

## Completion

Done when `openings.json` has one record per quoted opening, the count matches the quote quantity (or the conflict is surfaced as `VERIFY`), and no dimension is labelled measured unless it was. Checked by: `npm run eval:build-plan`.
