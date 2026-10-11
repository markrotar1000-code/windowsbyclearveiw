// Guards for six layout bugs: four found 2026-10-10 by loading every public page at 320, 390 and 1920 px, a
// fifth found 2026-10-11 by the round 3 crawl (360 and 390 px), and and three by the round 4 sweep (short screens, text-field size on phones, jump links under the sticky header).
//
//   1. `.split` (the two-column section on 11 pages) shared a rule with `.btn`: `.split, .btn { display:
//      inline-flex; padding; border; font-size; ... }`. An inline-level box ignores `margin-inline: auto`,
//      so on a wide screen the section sat flush left (content at 20 px on a 1440 px screen while every
//      other section started at 100 px; 340 px of difference at 1920), and its text was 19% smaller and
//      bolder than the page's, with button padding and a pointer cursor over the whole section.
//   2. At 800 px and below `.split` became `display: grid` with no column template, so its one track was
//      as wide as the widest child's minimum width. The estimate form's is 350 px: `/estimate/problem`
//      scrolled sideways on any phone narrower than 360 px (320 px phones are about the smallest in use).
//   3. The estimate form is `display: grid` with no column template, and its security-check (Turnstile)
//      widget is a fixed 300 px, so the form was stretched to fit the widget. On a 360 px phone `/estimate`
//      scrolled sideways by 15 px, on a 320 px phone by 54 px. The form's track now may shrink, and the
//      widget uses Cloudflare's 150 px `compact` size when the form is too narrow for the 300 px one.
//   4. Lighthouse's "Document uses legible font sizes" failed `/gallery` (22% of its text was legible): the
//      smallest type tier (`--step--2`, used for captions, labels and tags on most pages) bottomed out at
//      11.0 px on a phone, and the /ask chat page set a dozen sizes between 9.6 and 11.5 px. Google's
//      mobile-friendly check wants 12 px. Public pages now keep every text size at 12 px (0.75rem) or more.
//   5. Photo cards (WorkCard) set their tag ("NEW CONSTRUCTION") in tracked capitals with `flex: none`. A phone's
//      two-column tile is about 150 px wide; the tag is wider, so its tail ran past the card edge and was clipped
//      on the home page and the gallery. The tag may now shrink and wrap inside the card.
//   6. The open phone menu is an absolutely positioned panel inside a sticky header, so it never scrolls with
//      the page, and it had no height limit. Its thirteen links are about 620 px tall: on a phone held sideways
//      (390 px of height), a 568 px phone or a laptop window under ~720 px, the lower links were off the screen
//      with no way to reach them. On a 667 px phone "Request an estimate" was cut off; at 390 px seven links
//      (Tools through "Request an estimate") were. The panel is now capped to the room under the header and scrolls.
//   7. The Ask page's message box was 14 px (0.88rem on a phone). iOS Safari zooms the page in when a text field
//      under 16 px takes focus and does not zoom back out by itself, on a page built as a fixed-height app. Every
//      other field on the site was already 16 px or more. Touch screens now get 16 px there.
//   8. Jump links scrolled their target under the sticky header (63-75 px tall). On a guide the section heading was
//      hidden behind it after tapping the table of contents (102 of 104 jump links on the guides and the gallery
//      landed at or above the header's bottom edge). `html` now has `scroll-padding-top`.
//
// Source check, no build or browser needed. The browser measurements that found them are in the 2026-10-10
// "bug sweep" entry of .ai/CHANGELOG.md.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const css = readFileSync(`${root}src/styles/global.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// [selector list, body] for every simple rule (nested @media bodies are walked by the same pattern).
const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({ selectors: selectors.trim().split(/\s*,\s*/), body }));
const forClass = (name) => rules.filter((rule) => rule.selectors.includes(name));

// 1. No rule may style `.split` and `.btn` together.
const shared = rules.filter((rule) => rule.selectors.includes('.split') && rule.selectors.some((s) => /^\.btn\b/.test(s)));
assert.deepEqual(shared.map((rule) => rule.selectors.join(', ')), [], '.split must not share a rule with .btn (it is a layout, not a button)');

// 2. `.split` is a block-level flex row.
const splitRules = forClass('.split');
assert.ok(splitRules.some((rule) => /display:\s*flex\b/.test(rule.body)), '.split must be `display: flex` (block-level, so margin-inline: auto centres it)');
assert.ok(!splitRules.some((rule) => /display:\s*inline-/.test(rule.body)), '.split must not be inline-level');
for (const rule of splitRules) assert.ok(!/(^|;)\s*(padding|border|font-size|font-weight|cursor)\s*:/.test(rule.body), `.split must not set button styling: ${rule.body.trim().slice(0, 80)}`);

// 3. Where `.split` turns into a grid it has one column that may shrink below its content.
const gridRules = splitRules.filter((rule) => /display:\s*grid\b/.test(rule.body));
assert.ok(gridRules.length > 0, 'expected a stacked (grid) .split for narrow screens');
for (const rule of gridRules) assert.match(rule.body, /grid-template-columns:\s*minmax\(0,\s*1fr\)/, '.split as a grid needs `grid-template-columns: minmax(0, 1fr)`; a bare grid is as wide as its widest child (the 350 px estimate form)');

// 4. The estimate form's single column may shrink, and the Turnstile widget picks `compact` when it must.
const formCss = readFileSync(`${root}src/styles/estimate-form.css`, 'utf8');
assert.match(formCss, /\.estimate-form\{[^}]*display:grid;grid-template-columns:minmax\(0,1fr\)/, '.estimate-form is a grid and needs `grid-template-columns: minmax(0, 1fr)`; a bare grid grows to its widest child (the 300 px security check)');
const formPage = readFileSync(`${root}src/components/EstimateForm.astro`, 'utf8');
assert.match(formPage, /turnstile\.render\(slot,\s*\{[^}]*size:\s*[^,]*'compact'[^,]*'normal'/s, 'the Turnstile widget must choose between normal and compact by the room it has');

// 5. Public pages keep text at 12 px (0.75rem) or larger. The Command Center (src/pages/internal, InternalLayout) is
//    Mark's own phone tool and is left out. Exceptions, each with its reason:
//      - Brand.astro `.brand-sub`: "Vancouver, WA" under the logo wordmark, a fixed logo lockup.
//      - FrameMaterials.astro: SVG text sized in viewBox units, which scale with the drawing, not CSS pixels.
const TEXT_FLOOR_PX = 12;
const floorExceptions = new Map([
  ['src/components/Brand.astro', 'logo lockup sub-label'],
  ['src/components/diagrams/FrameMaterials.astro', 'SVG text in viewBox units'],
]);
function* sources(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== 'internal') yield* sources(path); }
    else if (/\.(astro|css)$/.test(name) && !/^Internal/.test(name)) yield path;
  }
}
const tooSmall = [];
let sizesRead = 0;
for (const file of sources(`${root}src`)) {
  const rel = file.slice(root.length).replaceAll('\\', '/');
  if (floorExceptions.has(rel)) continue;
  for (const [, value, unit] of readFileSync(file, 'utf8').matchAll(/font-size:\s*([0-9.]+)(rem|px)\b/g)) {
    sizesRead += 1;
    const px = parseFloat(value) * (unit === 'rem' ? 16 : 1);
    if (px < TEXT_FLOOR_PX) tooSmall.push(`${rel}: font-size ${value}${unit} is ${px.toFixed(1)} px`);
  }
}
assert.ok(sizesRead > 30, `expected to read the site's font sizes, read ${sizesRead}; the scan is broken`);
assert.deepEqual(tooSmall, [], `public text must be at least ${TEXT_FLOOR_PX} px (0.75rem):\n  ${tooSmall.join('\n  ')}`);
// The shared type scale: its smallest step is the floor, not below it.
const step2 = css.match(/--step--2:\s*([0-9.]+)rem\s*;/);
assert.ok(step2 && parseFloat(step2[1]) * 16 >= TEXT_FLOOR_PX, `--step--2 must be a fixed size of at least ${TEXT_FLOOR_PX} px, found ${step2 ? step2[0] : 'a fluid or missing value'}`);

// 6. Photo-card tags may shrink and wrap. A tag that cannot shrink (`flex: none`) is clipped by the card's
//    `overflow: hidden` when it is wider than a two-column phone tile (150 px at 360 px).
const workCard = readFileSync(`${root}src/components/WorkCard.astro`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const kindRule = workCard.match(/\.work-kind\s*\{([^}]*)\}/);
assert.ok(kindRule, 'WorkCard must style .work-kind');
assert.ok(!/flex:\s*none\b/.test(kindRule[1]), 'WorkCard .work-kind must not be `flex: none`; a long tag is clipped on a phone tile');
assert.match(kindRule[1], /flex:\s*0\s+1\s+auto/, 'WorkCard .work-kind must be allowed to shrink (`flex: 0 1 auto`)');
assert.match(kindRule[1], /min-width:\s*0/, 'WorkCard .work-kind needs `min-width: 0` so it can shrink below its text');
assert.match(kindRule[1], /overflow-wrap:\s*(?:anywhere|break-word)/, 'WorkCard .work-kind must wrap an over-long word instead of running past the card');
const captionRule = workCard.match(/\.work-card figcaption\s*\{([^}]*)\}/);
assert.ok(captionRule && /flex-wrap:\s*wrap/.test(captionRule[1]), 'WorkCard figcaption must wrap so the tag can drop under the caption');

// 7. The phone menu panel is capped to the screen and scrolls (see 6).
const header = readFileSync(`${root}src/components/Header.astro`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const menuMedia = header.match(/@media \(max-width:\s*1400px\)\s*\{([\s\S]*?)\n  \}\n/);
assert.ok(menuMedia, 'Header.astro must have the @media (max-width: 1400px) menu block');
const panel = menuMedia[1].match(/\.nav\s*\{([^}]*position:\s*absolute[^}]*)\}/);
assert.ok(panel, 'the phone menu panel (.nav, position: absolute) must be in the 1400px block');
assert.match(panel[1], /max-height:\s*calc\(100d?vh\s*-/, 'the phone menu panel needs a max-height tied to the screen height, or its lower links are unreachable on a short screen');
assert.match(panel[1], /max-height:\s*calc\(100dvh\s*-/, 'use dvh as well, so the mobile browser bar does not hide the bottom of the panel');
assert.match(panel[1], /overflow-y:\s*auto/, 'the phone menu panel must scroll (`overflow-y: auto`)');

// 8. No public text field is under 16 px on a touch screen (iOS zooms the page on focus below 16 px, see 7).
//    A smaller desktop size is allowed only where a `@media (pointer: coarse)` rule sets it back to 1rem.
const fieldSelector = /(?:^|[\s>+~,])(?:input|textarea|select)(?:\[[^\]]*\]|:[a-z-]+)*$/;
const smallFields = [];
let fieldRules = 0;
for (const file of sources(`${root}src`)) {
  const rel = file.slice(root.length).replaceAll('\\', '/');
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const coarse = [...text.matchAll(/@media\s*\(\s*pointer:\s*coarse\s*\)\s*\{([\s\S]*?\}\s*)\}/g)].map((m) => m[1]).join('\n');
  for (const [, selectors, body] of text.matchAll(/([^{}@;]+)\{([^{}]*)\}/g)) {
    const declared = body.match(/(?:^|;)\s*font-size:\s*([^;}]+)/);
    if (!declared) continue;
    const size = declared[1].trim().match(/^([0-9.]+)(rem|px)$/); // var(--step-0), max(16px, 1em) and the like are not under 16 px
    for (const selector of selectors.trim().split(/\s*,\s*/)) {
      if (!fieldSelector.test(selector)) continue;
      fieldRules += 1;
      if (!size || parseFloat(size[1]) * (size[2] === 'rem' ? 16 : 1) >= 16) continue;
      const restored = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*font-size:\\s*1rem`).test(coarse);
      if (!restored) smallFields.push(`${rel}: ${selector} { font-size: ${size[1]}${size[2]} }`);
    }
  }
}
assert.ok(fieldRules >= 6, `expected to read the site's text-field rules, read ${fieldRules}; the scan is broken`);
assert.deepEqual(smallFields, [], `public text fields must be 16 px or more on touch screens:\n  ${smallFields.join('\n  ')}`);
const askCss = readFileSync(`${root}src/styles/ask.css`, 'utf8');
assert.ok(!/\.ask-composer textarea\{font-size:\.88rem\}/.test(askCss), 'the Ask message box must not be 0.88rem on a phone');
assert.match(askCss, /@media\(pointer:coarse\)\{\.ask-composer textarea\{font-size:1rem\}\}/, 'the Ask message box must be 1rem on touch screens');

// 9. `html` keeps room for the sticky header when a jump link or focus scrolls an element into view.
const scrollPad = css.match(/(?:^|\})\s*html\s*\{[^}]*scroll-padding-top:\s*([0-9.]+)rem/);
assert.ok(scrollPad, '`html` needs `scroll-padding-top` so jump links do not land under the sticky header');
assert.ok(parseFloat(scrollPad[1]) * 16 >= 76, `scroll-padding-top must clear the sticky header (up to 75 px tall), found ${scrollPad[1]}rem`);

console.log(`PASS  layout guards (${splitRules.length} .split rules, ${rules.length} global rules read, ${sizesRead} public font sizes at or above ${TEXT_FLOOR_PX} px, photo-card tag may wrap, phone menu scrolls, ${fieldRules} text-field rules at 16 px on touch, jump links clear the header)`);
