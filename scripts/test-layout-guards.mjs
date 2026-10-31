// Guards for layout bugs: four found 2026-10-10 by loading every public page at 320, 390 and 1920 px, a
// fifth found 2026-10-11 by the round 3 crawl (360 and 390 px), three by the round 4 sweep (short screens, text-field size on phones,
// jump links under the sticky header), and a group by the round 5 sweep (text enlarged to 150% and 200% at 390 px, 9-14 below), and 15 by the round 7 sweep (JavaScript off).
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
//   9-14. Round 5: a phone with its text size raised (Android "Font size", or a browser's default size) to 150% or 200%.
//      Browser zoom was already clean; text-only scaling is different, because rem-based padding and the nowrap tags
//      scale while the screen does not. Nearly every public page scrolled sideways (the credential tags were `nowrap`
//      pills 371-493 px wide; the footer's email address and the privacy page's hostname have no break point; a bare `1fr`
//      grid track will not shrink below its widest child, so /estimate, /new-construction and others grew past the screen),
//      the header's Menu button was pushed off the screen at 200%, and the home page's four-claim strip, the service tiles
//      and the bottom "Request an estimate" band were clipped by their own `overflow: hidden`. Measured with
//      `html { font-size: 150% | 200% }` at 390 px on all 34 public pages: scrollWidth equals clientWidth on each now.
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
const TEXT_FLOOR_PX = 12;
const floorExceptions = new Map([
  ['src/components/Brand.astro', 'logo lockup sub-label'],
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
const header = readFileSync(`${root}src/components/Header.astro`, 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
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

// 10. The credential tags (licence, insurance, bond) may wrap. `white-space: nowrap` made the licence tag 371 px wide at 150% text
//     and 493 px at 200%, wider than the phone, and so made the footer, and every page, scroll sideways.
for (const name of ['LicenseTag', 'InsuranceTag', 'BondTag']) {
  const tag = readFileSync(`${root}src/components/${name}.astro`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = tag.match(/\.(?:license|credential)-tag\s*\{([^}]*)\}/);
  assert.ok(rule, `${name} must style its tag`);
  assert.ok(!/white-space:\s*nowrap/.test(rule[1]), `${name} must not be nowrap; it is wider than a phone at large text sizes`);
  assert.match(rule[1], /max-width:\s*100%/, `${name} must not be wider than its container`);
  assert.match(rule[1], /overflow-wrap:\s*(?:anywhere|break-word)/, `${name} must wrap an over-long word instead of running past the screen`);
}

const footerCss = readFileSync(`${root}src/components/Footer.astro`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const badgeRule = footerCss.match(/\.site-footer \.builder-badge\s*\{([^}]*)\}/);
assert.ok(badgeRule, 'Footer must style .builder-badge');
assert.ok(!/white-space:\s*nowrap/.test(badgeRule[1]) && /max-width:\s*100%/.test(badgeRule[1]), 'the footer "Built by" pill must be able to wrap and must not be wider than its container (300 px at 200% text, wider than a 320 px phone)');

// 11. Unbreakable text may break: an email address, inline code (the privacy page's hostname), and, as a safety net for
//     large text, any word wider than its line (a heading word such as "manufacturer's" is wider than a phone at 200%).
assert.match(css, /a\[href\^=['"]mailto:['"]\]\s*\{[^}]*overflow-wrap:\s*anywhere/, 'mailto links must be allowed to break; "owner@windowsbyclearveiw.com" is wider than a phone at 150% text');
assert.match(css, /:not\(pre\)\s*>\s*code\s*\{[^}]*overflow-wrap:\s*anywhere/, 'inline code must be allowed to break (static.cloudflareinsights.com on the privacy page)');
assert.match(css, /(?:^|\})\s*body\s*\{[^}]*overflow-wrap:\s*break-word/, '`body` needs overflow-wrap: break-word, so a word wider than its line breaks instead of scrolling the page sideways');

// 12. No public single-column grid uses a bare `1fr` track. `1fr` is `minmax(auto, 1fr)`: the track will not shrink below its
//     widest child's minimum width, so a nowrap phone number, a long word or a form widened every page it sat on at large
//     text (/estimate by 100 px at 150%, /new-construction, /siding, the home page's service tiles). `minmax(0, 1fr)` does shrink.
//     The same goes for the implicit auto column of a `display: grid` with no template, which the planner's rows had.
const bareFr = [];
for (const file of sources(`${root}src`)) {
  const rel = file.slice(root.length).replaceAll('\\', '/');
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of text.matchAll(/grid-template-columns:\s*1fr\s*[;}]/g)) bareFr.push(`${rel}: ${m[0].trim()}`);
}
assert.deepEqual(bareFr, [], `use \`grid-template-columns: minmax(0, 1fr)\` for a single column:\n  ${bareFr.join('\n  ')}`);
const read = (rel) => readFileSync(`${root}${rel}`, 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
const cta = read('src/components/CtaBar.astro');
assert.match(cta.match(/@media \(max-width:\s*900px\)\s*\{([\s\S]*?)\n  \}\n/)[1], /\.cta-bar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*max-content\)/, 'the stacked CTA band needs `grid-template-columns: minmax(0, max-content)`: its implicit auto column grew to 415 px at 200% text and `.cta-band` (overflow hidden) clipped the right edge. (max-content, not 1fr, keeps the column its usual width at normal sizes.)');
const estimator = read('src/components/CostEstimator.astro');
assert.match(estimator, /\.counter-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, 'the planner counter list needs an explicit shrinkable column');
assert.match(estimator, /\.est-choices\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, 'the planner choice list needs an explicit shrinkable column');
assert.match(estimator, /\.counter\s*\{[^}]*flex-wrap:\s*wrap/, 'a planner row must let its +/- buttons drop under the label when they do not fit (the label was squeezed to 70 px)');

// 13. The header keeps its Menu button on screen at large text. The row is a named container measured in rem, so the rule
//     follows the reader's text size (a px media query cannot); below 15rem the Facebook icon (the footer keeps every social
//     link) and the place line under the wordmark are dropped and the wordmark stays whole.
const hdr = read('src/components/Header.astro');
assert.match(hdr, /\.header-inner\s*\{[^}]*container:\s*header-row\s*\/\s*inline-size/, 'the header row must be the `header-row` container');
assert.match(hdr, /@container header-row \(max-width:\s*15rem\)\s*\{[^}]*\.header-social\s*\{\s*display:\s*none/, 'the header must drop the Facebook icon when the row is under 15rem wide');
const brand = read('src/components/Brand.astro');
assert.match(brand, /@container header-row \(max-width:\s*15rem\)\s*\{[\s\S]*?\.brand-sub\s*\{\s*display:\s*none[\s\S]*?overflow-wrap:\s*normal/, 'the wordmark must stay whole (and lose its place line) when the header row is under 15rem wide');
assert.match(brand, /\.brand\s*\{[^}]*min-width:\s*0/, '.brand must be able to shrink so the Menu button is never pushed off');

// 14. Captions and strips that sit inside an `overflow: hidden` box must be able to grow with their text.
const home = read('src/pages/index.astro');
assert.match(home, /\.service-tile\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*flex-end/, 'a service tile must be a flex column that bottoms out its caption: an absolutely positioned caption in a fixed-height tile was clipped at the top at 200% text');
assert.match(home, /\.service-tile-copy\s*\{[^}]*position:\s*relative/, 'the service tile caption must be in flow (`position: relative`), not absolute');
const videoHero = read('src/components/VideoHero.astro');
assert.match(videoHero, /\.trust-strip-wrap\s*\{[^}]*container-type:\s*inline-size/, 'the hero claims strip needs its container');
assert.match(videoHero, /@container \(max-width:\s*16rem\)\s*\{[^}]*\.trust-strip\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/, 'the hero claims strip must stack to one column at large text (two columns ran past the hero and were clipped at 200%)');
const globalCss = read('src/styles/global.css');
assert.match(globalCss, /\.areas-inline\s*\{\s*container-type:\s*inline-size/, 'the city-page link paragraph needs its container');
assert.match(globalCss, /@container \(max-width:\s*14rem\)\s*\{\s*\.areas-inline a\.is-phrase\s*\{\s*white-space:\s*normal/, 'the long "fiber cement and wood siding" link must be able to wrap at large text');

// 15. Without JavaScript the primary navigation must still be reachable. The header collapses its nav into a
//     Menu panel at 1400px and below and only JavaScript opens it, so with scripts off (a privacy setting, a
//     blocked script, a crawler) every phone, tablet and most laptops showed a dead Menu button and no links.
//     BaseLayout's <noscript> style shows the nav as a plain wrapped row and hides the button; it must use the
//     same breakpoint as the header's collapse so there is never a width with neither.
const baseLayout = read('src/layouts/BaseLayout.astro');
const collapse = hdr.match(/@media \(max-width:\s*(\d+)px\)\s*\{[^@]*?\.nav\s*\{\s*display:\s*none/);
assert.ok(collapse, 'could not find the header\'s collapse breakpoint (the media query that sets `.nav { display: none }`)');
const noscript = baseLayout.match(/<noscript>\s*<style is:inline>([\s\S]*?)<\/style>\s*<\/noscript>/);
assert.ok(noscript, 'BaseLayout must carry a <noscript><style is:inline> navigation fallback');
assert.ok(!/\{`|`\}/.test(noscript[1]), 'the <noscript> CSS must be plain text: an `is:inline` style is not an expression, so a template-literal wrapper is printed literally and the rules never apply');
assert.match(noscript[1], new RegExp(`@media \\(max-width:\\s*${collapse[1]}px\\)`), `the noscript fallback must use the header's ${collapse[1]}px collapse breakpoint`);
assert.match(noscript[1], /\.nav-toggle\s*\{\s*display:\s*none\s*!important/, 'the dead Menu button must be hidden without JavaScript');
assert.match(noscript[1], /\.nav\s*\{[^}]*display:\s*flex\s*!important[^}]*position:\s*static\s*!important/, 'the navigation must be shown in flow without JavaScript');
assert.match(noscript[1], /\.site-header\s*\{\s*position:\s*static\s*!important/, 'the wrapped nav must not make the sticky header cover the page');
// The project planner is all JavaScript: without it the page showed nine dead +/- buttons and no word why.
const planner = read('src/pages/tools/window-replacement-cost-calculator.astro');
assert.match(planner, /<noscript>[\s\S]*?needs JavaScript[\s\S]*?href="\/estimate"[\s\S]*?telHref\(\)[\s\S]*?\.estimator\s*\{\s*display:\s*none\s*!important/, 'the planner must say it needs JavaScript, point to /estimate and the phone, and hide its dead controls');

// 16. The desktop header shows seven items (Services and Resources are dropdowns), not twelve flat links, which was
//     cluttered and had squeezed the row (header widened to 1440px, "Get an estimate" hidden from 1401 to 1480px).
//     Every page must stay reachable: the groups dissolve into the flat Menu list at 1400px and below, and on desktop
//     the dropdowns open on hover and focus without JavaScript until the script takes over (`nav[data-groups]`).
assert.match(hdr, /\.nav-group,\s*\.nav-menu,\s*\.nav-menu-list\s*\{\s*display:\s*contents/, 'the dropdown wrappers must be `display: contents` outside the desktop media query, or the phone Menu is not a flat list');
assert.match(hdr, /\.nav-group-toggle\s*\{\s*display:\s*none/, 'the group buttons must be hidden outside the desktop media query (the phone Menu lists the links directly)');
assert.match(hdr, /@media \(min-width:\s*1401px\)\s*\{[\s\S]*?\.nav:not\(\[data-groups\]\) \.nav-group:focus-within \.nav-menu/, 'a dropdown must open on hover and focus without JavaScript');
assert.ok(!/\.header-estimate\s*\{\s*display:\s*none;?\s*\}\s*\.header-inner/.test(hdr), '"Get an estimate" must not be hidden from 1401px up');
const navLinkCount = [...hdr.matchAll(/\['\/[a-z-]+',\s*'[^']+'\]/g)].length;
assert.equal(navLinkCount, 12, `the header must still link all twelve pages (found ${navLinkCount}); grouping them must not drop one`);
const topLevel = hdr.match(/const nav: NavItem\[\] = \[([\s\S]*?)\n\];/);
assert.ok(topLevel, 'could not read the header nav list');
assert.ok((topLevel[1].match(/^  (?:\{|\[)/gm) || []).length <= 7, 'the desktop header must keep at most seven top-level items; add new pages to a group');

console.log(`PASS  layout guards (${splitRules.length} .split rules, ${rules.length} global rules read, ${sizesRead} public font sizes at or above ${TEXT_FLOOR_PX} px, photo-card tag may wrap, phone menu scrolls, ${fieldRules} text-field rules at 16 px on touch, jump links clear the header, round 5: credential tags wrap, no bare 1fr tracks (${bareFr.length}), header keeps Menu at large text, round 6: desktop nav grouped to seven items)`);
