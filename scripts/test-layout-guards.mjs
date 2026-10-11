// Guards for four layout bugs found 2026-10-10 by loading every public page at 320, 390 and 1920 px.
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

console.log(`PASS  layout guards (${splitRules.length} .split rules, ${rules.length} global rules read, ${sizesRead} public font sizes at or above ${TEXT_FLOOR_PX} px)`);
