# Public copy positioning

Load this before writing or reviewing customer-facing copy, guides, city pages, or graphics.
Owner direction, 2026-09-30. Business facts here come from the owner; do not extend them by guessing.

## Who the site is talking to

- Clearview replaces windows for a **wide variety of reasons**. Copy should reflect that range, not one story.
- The jobs Clearview is prioritising early on are the ones with the simplest installs, typically
  **houses roughly 10–15 years old** replacing their existing window units. This is an internal targeting
  note: do not publish it as a restriction, an age cutoff, or a claim about what we will not do.
- Older homes and single-pane windows are still work Clearview does. Existing single-pane mentions
  may stay as one example among several. Do **not** make single-pane, old wood sashes, or "very old
  windows" the headline or the only reason given for replacement, and do not add new copy built
  around that premise.
- Do not invent the specific failure reasons for 10–15-year-old units. Use reasons already on the
  site (fogged glass/failed seals, drafts, hard-to-operate sashes, condensation, damage at the
  opening) or ask the owner.

## Terminology and voice (enforced by `npm run test:public-terminology`)

- Never describe the install method (no "full-frame", "insert", "block frame", "nail fin",
  "block and fin", "pocket" install). Say "we measure every opening and tell you the right approach
  in the written estimate."
- Say "old", not "tired", for windows.
- The company has no DBA on file. Never write "doing business as" or "d/b/a"; use the legal name Clearview Windows & Trim LLC.
- No personal names in public copy; company voice ("we"). No claims about team size.
- Never promise how long a job takes or what state the room is left in. No "one-day job", "same day",
  or "leave the room usable" (owner direction, 2026-09-30: timing depends on the specifics of each job).
  Saying we haul away debris is fine. Lead times are fine when tied to the manufacturer.

## Plain words on the gallery and photo captions (Keith, 2026-10-11)

Keith pointed at "What the street sees once the job is done" and said that kind of wording is weird and had already been ruled out. It follows the earlier complaint about jargon and clipped, clever phrasing. Enforced for the gallery page and `work.ts` captions by `npm run test:public-terminology`.

- Say "house" or "side of the house", not "elevation" (architect's word). Not "flashed", "next trade", "double-hungs" or "sliders" in the gallery's own wording.
- Write what the picture shows, in a sentence a homeowner would say. No poetic lines.
- **No photo or job counts on the gallery** (no "72", no "22 photos"): a number next to a gallery reads as the number of jobs Clearview has done. Enforced by `test:image-delivery`.
- The 2026-10-11 batch is confirmed as Clearview jobs (Keith, 2026-10-11), so a plain "from our jobs" line is allowed on the gallery if Keith wants one. Do not describe a photo's scope (replacement, new construction, "installed") from the picture alone; the doors page's installs grid is the one place that labels a 2026-10-11 photo "Finished result", on Keith's word that it is ours. See `docs/GALLERY-PHOTOS-2026-10-11.md`.
- Still to do: "elevation" remains in six guide sentences (an FAQ answer, two hero image credits, three body lines) and builder-facing copy on `/new-construction`, where it is the normal word. Guide edits need the owner's say-so for FAQs and a rebuild of the Ask index (`npm run build:guides-index`, needs `GEMINI_API_KEY`).

## Window installation (Mark, 2026-10-12)

Mark does window installation and wants it said on the site, because it is a search phrase of its own ("window installation Vancouver WA"), not just "replacement".

- Say it where it fits, in plain words: the titles, H1s and descriptions of the eight city pages, `/areas`, `/replacement` and the home page, the home hero line and the footer blurb. `/process`, `/new-construction`, `/siding`, `/sliding-glass-doors` and `/about` already carried it.
- City pages: H1 "Window Replacement & Installation in {City}, WA"; `<title>` is the city page's `metaTitle` (exact, brand dropped to " | Clearview" or removed where 60 characters leave no room). Enforced by `test:seo`; the home, `/replacement` and `/areas` must say "installation" in title, H1 or description.
- It is a service name, not an install method: all the rules above still apply (no method names, no timing, no room-state promises, no crew or certification claims).
- Left alone on purpose: the gallery (a photo's scope is not described from the picture, see the gallery section), the guides and FAQs (guide edits need an Ask index rebuild and the owner's say-so), `/window-features`, `/reviews`.

## Siding (owner direction, 2026-10-04)

Source of truth for `/siding` and anything else that mentions siding; do not extend by guessing.

- **Products:** fiber cement lap and board and batten, primarily James Hardie; LP siding products such as LP SmartSide board; other wood siding products. Windows can be done on a siding job if the customer asks.
- **Price (owner direction 2026-10-22):** all siding is priced by the square foot of total wall area (height times width), and **the price includes the materials and the labor**. The public page states that in words and prints no per-type list and no dollar figure; no siding price is stored anywhere in the product (the old labor-only rates file `src/data/siding.ts` was deleted, see git history). In the internal quote builder Mark types the price per square foot on each siding quote. Do not describe the siding material as a separate cost, and never invent a siding rate.
- **Warranty:** the manufacturer's. James Hardie, and most other siding products, carry a manufacturer's warranty when the product is bought, as long as it is installed to the manufacturer's specifications. The length: the owner first said 25 years, then said to use whatever the manufacturer's sheet says. James Hardie's own HardiePlank lap siding and HardiePanel vertical siding pages (read 2026-10-04) say "a 30-year non-prorated limited, transferrable substrate warranty", so the page says **30 years for James Hardie siding** and nothing else. Do not state a length for LP or any other manufacturer (the test fails on any other year count), and do not say "25". No Clearview workmanship warranty is stated.
- **Photos:** four owner-supplied siding-job photos (`kind: 'siding'` in `src/data/work.ts`). Captions say only what is visible, some are mid-job (house wrap, panels before finish). Mark confirmed all four are fine to publish. Street numbers, people and phone metadata must not ship: one door number is blurred, one person is cropped out, EXIF is stripped (guarded by `test:siding`).
- Still not stated anywhere: certifications (no "certified installer"), crew or experience claims, job duration.

## Graphics

- AI-generated window diagrams have repeatedly come out wrong. Two were removed on 2026-09-30
  (interior shown with siding, hardware on both sides, low quality); a Canva redraft was rejected for
  a single-pane premise. Treat any generated window illustration as a draft, never as shippable.
- Any new diagram must be checked by the owner/installer before it ships. Diagrams showing an
  "old vs new" comparison must match the positioning above (not a single-pane-only story).
- Double-pane glass graphic (`src/assets/guides/double-pane-glass-how-it-works.png`, `/guides/fogged-windows`) (the flashing graphic was removed everywhere on 2026-10-16 as inaccurate; do not reinstate it).
- Vinyl vs fiberglass graphic (`src/assets/guides/vinyl-fiberglass-guide.png`, shown on `/window-features` and `/replacement`): replaced 2026-10-12 with the owner's own graphic (blue branding, 1536 x 1024, no metadata). It shows both frames with chambers, says fiberglass is "stronger and more rigid" and vinyl "a common value-focused choice", and carries its own footnote "Illustrative profiles only. Construction and dimensions vary by manufacturer and series." The one it replaced labelled fiberglass a "solid profile", which the owner's version corrects. The `/replacement` caption no longer claims the two are "at the same scale". The guide page (`/guides/vinyl-vs-fiberglass-pacific-northwest`) uses a second owner graphic, "Frame Strength. Slimmer Sightlines." (`vinyl-fiberglass-sightlines.png`, 1536 x 1024, no metadata; 2026-10-12), in place of the drawn SVG that called fiberglass "solid pultruded" (deleted with its component). It says vinyl is "often a practical, cost-conscious choice" (no figure), fiberglass is "stronger, more rigid" and its stiffness "can allow a slimmer frame", and carries the footnote "Illustrative comparison. Frame widths, reinforcement and maximum sizes vary by manufacturer and series." One stray, half-clipped duplicate of the word "choice." under the vinyl note was retouched out. On a phone its own small text is not legible (the page's "Answer" strip above it and the alt text carry the message).
