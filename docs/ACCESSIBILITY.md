# Accessibility

What the public site is checked for, what was wrong on 2026-10-10, and how to keep it right. Measured with axe-core 4.14 in Chromium (Playwright) against the built site: every public page, 390 px phone and 1440 px desktop, light and dark.

## What was wrong

| axe rule | Where | What a visitor met |
|---|---|---|
| `aria-prohibited-attr` (serious) | `BondTag`, `InsuranceTag`: the home hero and the footer of every page | The bond number, surety, policy number and limits were in `aria-label` on a bare `<span>`, with the visible words ("WA Bonded", "Insured") hidden from assistive tech. ARIA does not allow naming a role-less element, so a screen reader may skip the whole tag and never say the one sentence that makes "bonded" and "insured" defensible (see the 2026-09-22 entry in `HANDOFF.md`). |
| `label-content-name-mismatch` (serious, WCAG 2.5.3) | `Brand` (the logo link, header and footer, every page; 350 nodes across the scan) | The link was spoken as "Clearview Windows home" but shows "Clearview" over "Vancouver, WA". A voice-control user who says what they see ("click Vancouver") could not activate it. Also, the two lines of the wordmark are separate flex items with no space between them, so tools read the text as "ClearviewVancouver, WA". |
| `label-content-name-mismatch` | `GalleryAddition` (the gallery's 12 additional photos; 48 nodes across the scan) | Each link shows "View full photo" over the picture but was named "View full-resolution photo: ...". |
| `aria-label` on a plain `<div>` (axe reports "needs review") | `/estimate` checklist, guide action bar (7 guides), `/tools` next steps, `/window-features` 3D stage; and two Command Center blocks | A generic element cannot be named; the label was ignored. They are groups of related controls, so they now say `role="group"`. |

## Fixes

- `BondTag`, `InsuranceTag`: `aria-label` removed. The detail is a `visually-hidden` text node inside the tag and stays in `title` for hover and long-press. The facts come from `site.bond` and `site.insurance` unchanged.
- `Brand`: `aria-label="Clearview Vancouver, WA home"` (contains everything shown) and an explicit space between the wordmark lines.
- `GalleryAddition`: `View full photo: {caption} (opens in a new tab)`.
- The six `<div>`s gained `role="group"`.

## The rules

The first three are in `test:a11y-names`; four and five are in `test:text-gaps` and `test:layout-guards`.

1. **Never put `aria-label` or `aria-labelledby` on a `<span>`, `<div>`, `<p>`, `<strong>`, `<em>`, `<b>`, `<i>`, `<small>` or `<code>` without a `role`.** If the words are for screen readers, put them in `<span class="visually-hidden">` (defined in `global.css`).
2. **A link or button with an `aria-label` must have a name that contains what it shows.** Compared on letters and digits, ignoring case, punctuation and spacing. Text marked `aria-hidden` is still on screen, so it counts. Symbol-only buttons (the calculator's `-` and `+`) are exempt.
3. **A space between lines that sit in separate flex or grid items.** Nothing renders it, but the text is read without it.
4. **End text with `{' '}` when a link or `<strong>` follows on the next source line.** Astro's HTML compression drops that line break and leaves no space, so the sentence runs into the link ("wall.Plan your project first" on the home page, `/new-construction` and `/window-features`; read aloud as "wall.Plan"). `npm run test:text-gaps` checks the built HTML.
5. **Public text is 12 px (0.75rem) or larger.** `--step--2` is a fixed `0.75rem`. Lighthouse failed `/gallery` at 21.89% legible text with 11 px captions; it passes at 99.78%. `test:layout-guards` fails on a smaller `font-size` in public CSS. Exceptions: the logo's "Vancouver, WA" sub-label and the SVG text in `FrameMaterials` (viewBox units); the Command Center is exempt.

`npm run test:a11y-names` (in CI, after the build) checks rules 1 and 2 on every built page, including `/internal` (rule 3 is covered wherever the control has an `aria-label`, because the check reads text the way axe does), and that the home page carries the bond and insurance detail as text. It is a pattern check over static HTML: it cannot see text added by script and it does not compute contrast. It was mutation-tested: the old logo label, the missing wordmark space and an `aria-label` put back on the bond tag each fail it.

## Checking it in a browser

`scripts/audit-a11y.mjs` is the tool that found the problems. It is **not in CI** (it needs a browser and axe-core, which this repo does not install):

```
npm i --no-save playwright axe-core        # or CHROMIUM_PATH=/path/to/chrome if you have a browser
npm run build && npx astro preview --port 4330 &
node scripts/audit-a11y.mjs                # every public page, 4 views each; add --internal for the Command Center
```

A clean run prints `No violations` and exits 0. `npm i --no-save` can remove the repo's `node_modules/playwright` link; reinstall if the import fails.

## Known and not changed

- **Contrast reads as a failure only mid-fade.** On `/legal/privacy` and `/new-construction` axe sometimes reported table-header text at 3.4:1 or 4.45:1, and once the home hero's credential tags at 3.2:1 (dark mode, phone). Those colors are still easing in right after load or scroll; settled, they pass (re-checked after 8 s, light and dark, phone and desktop). The audit now waits for every finite animation to end before scanning. If a real contrast failure shows up, it will show after the wait too.
- **Bond and insurance amounts are now text, not only a hover title.** They are coverage limits, not prices, and were already on every page in the title. `test:no-public-pricing` and `test:siding` set aside exactly those two sentences (`scripts/_lib/credential-detail.mjs`); any other hidden dollar figure still fails.
- **Not tested with a real screen reader or voice control.** The checks are axe-core plus the pattern test. A pass on NVDA, VoiceOver or Voice Control would be the next level of proof.
- **Command Center** pages are covered by rules 1 and 2 only (Mark's phone-first internal tool; no full axe pass was made).
