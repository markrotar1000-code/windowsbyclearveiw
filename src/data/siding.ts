// Internal reference only: since 2026-10-09 the public siding page prints no dollar figure (see publicPricing in pricing.ts),
// and since 2026-10-22 it no longer lists these per-type rates at all: the owner says siding is priced by the square foot with
// materials AND labor in that price. These are the earlier LABOR-ONLY figures, used by the internal quote builder; VERIFY them
// against the all-in price before relying on them.
// Siding pricing, owner-provided 2026-10-04 (Mark, relayed by Keith; the plywood, cedar and dry-rot
// figures are from Mark's own text messages the same evening). These are LABOR rates only: the
// siding material is a separate cost, quoted in the written estimate. Whole dollars per square
// foot of total wall area (height times width), "starting at" figures (the plywood tear-off figure
// is stated flat), not quotes. Used by
// src/pages/siding.astro and checked by scripts/test-siding-page.mjs; change them here and nowhere else.
export const sidingLabor = {
  newConstruction: 2,
  existingHome: 3,
  boardAndBattenNewConstruction: 3,
  boardAndBattenExistingHome: 4,
  cedar: 4,
  tearOffPlywood: 2,
} as const;

// Dry rot is just added labor cost, $1,500 to $3,000 depending on severity (Mark, 2026-10-04; his first
// text said "roughly 1k to 2k" for significant suspected dry rot, then corrected it to this range).
export const sidingDryRot = { low: 1500, high: 3000 } as const;
