# Gallery photos, 2026-10-11 batch

Mark added 55 phone photos to the shared Drive folder (files named `IMG_20261010_1552xx`, including "(1)/(2)" copies at other resolutions). Keith asked for the best ones on the site and a better sliding glass door on the **main page card** and the **hero**.

Result: **1 door photo** on the home "Sliding glass doors" tile and the `/sliding-glass-doors` hero, and **9 more** photos in the gallery's "More photos" section (now 22 additions; the gallery no longer prints any photo count). Nothing existing was removed.

## What "card" and "hero" mean here (VERIFY with Keith)

- **Main page card** = the home page "Sliding glass doors" service tile (was `gray-siding-white-slider-deck`).
- **Hero** = the `/sliding-glass-doors` page hero background (was the same gray-siding photo).
- The **home page hero** (a windows photo inside the video reveal) was left alone because it is not a door page. If Keith meant that one, it is a one-line change in `src/pages/index.astro` (`heroPhoto`), but the video reveal is built around that photo.
- The doors-page hero is a portrait photo cropped to a banner under the dark wash (`getHeroBg`). It was checked in a browser at desktop and phone widths and reads well, but a landscape original would crop less.

## Selection

| Rank | Site filename | Source (`IMG_20261010_…`) | Source size | Why |
| --- | --- | --- | --- | --- |
| 1 | `tan-siding-patio-slider.jpg` | `155203.jpg` | 599x799 | Only clear full-height sliding glass door in the batch. Straight-on, daylight, clean patio, white frame with one panel open. Tile and hero. |
| 2 | `gallery-dark-house-slider-blue-sky.jpg` | `155238 (1).jpg` | 1200x1600 | Clear exterior, strong contrast, blue sky. |
| 3 | `gallery-dark-frame-slider-tan-deck.jpg` | `155244 (1).jpg` | 848x1131 | Dark-framed slider, tidy deck. |
| 4 | `gallery-tall-windows-black-frames.jpg` | `155242.jpg` | 599x799 | Looking up a tall wall, black frames, no clutter. |
| 5 | `gallery-green-trim-entry-skylight.jpg` | `155204 (1).jpg` | 599x799 | Whole front entry with trim, window and skylight. |
| 6 | `gallery-dark-house-square-slider.jpg` | `155231.jpg` | 848x1131 | Centered square slider, simple composition. |
| 7 | `gallery-tall-window-siding-corner.jpg` | `155243.jpg` | 848x1131 | Corner detail on lap siding. |
| 8 | `gallery-tan-siding-double-hung-pair.jpg` | `155203 (1).jpg` | 1200x1600 | Clean window pair, wide trim. |
| 9 | `gallery-teal-wall-garden-slider.jpg` | `155222.jpg` | 1200x1600 | Bright interior with a garden view. |
| 10 | `gallery-kitchen-slider-pergola.jpg` | `155220 (2).jpg` | 1200x1600 | Bright kitchen window, uncluttered. |

Order follows the first batch: clear exteriors, then details, then bright interiors. `155203 (1)` is **not** a bigger copy of the door (`155203`); it is a different photo of a window pair.

## Gallery order (re-ranked the same day)

Keith asked that the best images be displayed higher, so the 22 additions are ordered by strength across both batches rather than first batch then second. The rank in the table above is only within this batch. Judged from a contact sheet of all 22: clear subject, daylight or sky, one window as the subject, no counter or floor clutter, and no two neighbours that look alike.

1. blue transoms, 2. **the door**, 3. landscaped triple, 4. garden chimney, 5. dark-house slider (blue sky), 6. garden grids, 7. dark-frame slider, 8. wood window, 9. green-trim entry, 10. wood side, 11. dark-house square slider, 12. tall windows (black frames), 13. tall window at the corner, 14. window pair on tan siding (flat gray sky, the weakest exterior), 15. bright sunroom, 16. teal wall garden slider, 17. corner room, 18. deck view, 19. kitchen slider (sink clutter), 20. kitchen corner, 21. kitchen pair, 22. empty corner (dim, bare).

That is a judgement call, not a measurement. Reorder freely; `test:image-delivery` only requires the door in the first six and only the first three tiles eager.

**Position on the page.** The first photo row started 774 px down at 1440x900 (126 px visible), 764 px at 1280x720 and 813 px on a 390x844 phone (not visible). The gallery hero and the padding above the grid were tightened (page-scoped CSS): now 667 / 661 / 758 px. On a short laptop and on a phone the first row is still at or below the fold, because the hero text and jump links fill the first screen; shrinking those is a design call. The existing sections below (From the street, From inside the room, and so on) were not re-ranked.

## Excluded, and why

- **`..._155241.jpg` (certificate / paperwork photo).** Shows another company's document and a customer's personal details. Not used, deleted from the working copy. **Recommend Mark delete it from the shared Drive folder.**
- **A person is visible:** `155201`, and `brick-corner-maple` (a person inside the house, visible through the screen at full resolution; dropped after the upscale check).
- **Photographer reflection:** `155206 (1)`.
- **Cluttered interiors:** `155219`, `155220` (armchair), `155224`, `155225`, `155226`, `155228`, `155229`.
- **Reviewed and not selected:** `155210 (1)`, `155217 (1)`, and the rest of the batch (duplicates at other resolutions and weaker angles of the picks above).

## Privacy findings

AI upscaling can turn a blurred shape behind glass into a face. Every candidate was inspected at full 4K resolution, including window glass, before it was kept.

- **The door** (`155203`): the 4K upscale made a face legible inside the door glass. It was retouched with a feathered elliptical blur and darken over the glass area (a rectangular blur looked like a smear and was rejected). Re-checked at full size afterwards.
- **`brick-corner-maple`:** a person was visible inside through the screen. Dropped.
- No house numbers, plates, signs or street names are legible in the nine kept gallery photos. All ten files have no EXIF, XMP or IPTC data (no GPS). `npm run test:image-delivery` now fails if any photo imported by `gallery-additions.ts` carries metadata.
- The "View full photo" link on each gallery tile serves the full 3072x4096 JPEG, so anything legible in the file is public. That is why the check is at full size, not at tile size.

## Processing

- Higgsfield `upscale_image` at 4K, 2 credits each: **11 upscales, about 22 credits** (10 kept, 1 dropped). Balance before: 274.3.
- Output was downloaded as PNG, saved as JPEG quality 86 at 3072x4096 with metadata stripped (0.5–1.5 MB each).
- The source photos are 599–1200 px wide, so the 4K files are **generatively upscaled**: they look sharp but detail is inferred, not captured. Texture on siding and trim is plausible, not exact. This matches how the 2026-10-07 batch was handled; keep it disclosed internally. Ask Mark for original-resolution files (the phone's full-size share, not the compressed forward) before using any of these as a hero on a printed piece or in a claim about a product detail.
- Responsive widths (`widths={[…1600]}`) come from the existing pipeline; see `docs/IMAGE-DELIVERY.md`.

## Provenance: confirmed (Keith, 2026-10-11)

When the batch arrived it included another contractor's paperwork, so these photos might not all have been Clearview jobs, and everything was built to make no claim about them. Later on 2026-10-11 Keith confirmed that the 2026-10-11 photos are Clearview jobs. What changed:

- The door is now the **first card of the "Finished patio door installs" grid** on `/sliding-glass-doors` (kind label "Finished result"), ahead of the two 2026-09-27 door photos. The OG image on that page is unchanged.
- It is **still not in `workPhotos`**, on purpose: `workPhotos` feeds the gallery's "From the street" group (the door is already near the top of "More photos", and a second copy would show it twice), the replacement page and the featured lists. A test enforces that it appears once on `/gallery`.
- **Captions and alt text still describe only what is visible.** The batch is confirmed as ours; the scope of each job (replacement, new construction, a door) is not known, so no caption says "installed", "finished" or a job type. The "Finished result" label on the door card and the grid's own heading rest on Keith's word that the photo is a Clearview job. If Mark says that door was not Clearview's work, delete the first entry of `doorWork` in `sliding-glass-doors.astro` (the home tile and hero can stay).
- The "Every photo here is from one of our jobs" line is not on the gallery page and was not added back. It is allowed now if Keith wants it; the test that forbade it was removed.
- The paperwork photo (`..._155241.jpg`) is another contractor's document with a customer's details. It is still excluded and should still be deleted from the shared Drive folder.

## Where it lives

| File | Change |
| --- | --- |
| `src/assets/work/` | 10 new JPEGs |
| `src/data/gallery-additions.ts` | `patioSliderPhoto` plus 9 entries, all 22 ordered by strength |
| `src/components/GalleryAddition.astro`, `src/pages/gallery.astro` | `eager` first row, tighter top spacing |
| `src/pages/index.astro` | `slidingDoorsTile = patioSliderPhoto` |
| `src/pages/sliding-glass-doors.astro` | `getHeroBg(patioSliderPhoto.image)`; first card of the installs grid (`doorWork`) |
| `scripts/test-image-delivery.mjs` | 4 new groups (tile/hero wiring, not a workPhoto, alt/caption/no-claims/EXIF/size, gallery render) |
