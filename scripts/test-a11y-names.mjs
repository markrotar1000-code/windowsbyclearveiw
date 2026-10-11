// Accessible-name guard, run against the built site (`npm run build` first).
//
// Found 2026-10-10 with an axe-core scan of every public page (phone and desktop, light and dark):
//   1. aria-prohibited-attr: BondTag and InsuranceTag put the bond number / policy detail in `aria-label`
//      on a role-less <span>. ARIA does not allow naming such an element, so a screen reader may skip it,
//      and the one sentence that makes "bonded" and "insured" defensible never reached those visitors.
//   2. label-content-name-mismatch (WCAG 2.5.3): the logo link was spoken as "Clearview Windows home" but
//      shows "Clearview Vancouver, WA". A voice-control user who says what they see could not activate it.
//
// Two rules, checked on the HTML we ship:
//   A. `aria-label` / `aria-labelledby` never sits on a <span>, <div>, <p>, <strong>, <em>, <b>, <i>,
//      <small> or <code> unless the same tag has a `role`. Put hidden text inside the element instead.
//   B. A link or button with an `aria-label` has an accessible name that contains the text it shows
//      (compared case-, punctuation- and whitespace-insensitively, like axe). Symbol-only labels such as
//      the calculator's "-" and "+" buttons have no human-readable text and are skipped.
//
// This is a pattern check over static HTML, not a browser: it cannot see text added by script. The axe run
// that found the problems needs a browser the repo does not install; the recipe is in docs/ACCESSIBILITY.md.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
if (!existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` before `npm run test:a11y-names`.');
  process.exit(1);
}

const NAMED = { amp: '&', quot: '"', lt: '<', gt: '>', nbsp: ' ', minus: '−', times: '×', mdash: '—', ndash: '–', middot: '·', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
// `&minus;` in a button is a symbol, not the word "minus": decode before comparing.
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
// axe compares on letters and digits only, ignoring case, punctuation and spacing.
const norm = (s) => decode(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`)); return m ? decode(m[1] ?? m[2]) : null; };

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (path.endsWith('.html')) yield path;
  }
}

// The text a sighted visitor reads inside an element's markup: no scripts, styles, SVG, images or text that is
// visually hidden. Text marked aria-hidden still counts: it is on screen, and voice control targets what is on screen.
function visibleText(inner) {
  return inner
    .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<span\b[^>]*\bclass="[^"]*\b(?:visually-hidden|sr-only)\b[^"]*"[^>]*>[\s\S]*?<\/span>/g, ' ')
    // Tags add no space, the way axe reads it: <b>Clearview</b><i>Vancouver</i> is "ClearviewVancouver".
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '');
}

const NAMELESS = /<(span|div|p|strong|em|b|i|small|code)\b[^>]*>/g;
const NAMED_CONTROL = /<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g;

const naming = [];
const mismatch = [];
let pages = 0;
let controls = 0;
for (const file of walk(dist)) {
  const html = readFileSync(file, 'utf8');
  const path = '/' + relative(dist, file).replaceAll('\\', '/').replace(/(\/?index)?\.html$/, '');
  pages += 1;

  for (const [tag, name] of html.matchAll(NAMELESS)) {
    if (!/\saria-label(ledby)?=/.test(tag)) continue;
    if (/\srole=/.test(tag)) continue;
    naming.push(`${path}  <${name}> ${tag.slice(0, 140)}`);
  }

  for (const [, kind, attrs, inner] of html.matchAll(NAMED_CONTROL)) {
    const label = attr(`<${kind}${attrs}>`, 'aria-label');
    if (label === null) continue;
    const shown = norm(visibleText(inner));
    if (!shown) continue; // icon-only: the label is the only name
    controls += 1;
    if (!norm(label).includes(shown)) mismatch.push(`${path}  <${kind}> label "${label}" does not contain visible text "${shown}"`);
  }
}

// Self-test the checker so a regex that stops matching cannot pass silently.
{
  const badSpan = '<span class="x" title="t" aria-label="detail">WA Bonded</span>';
  assert.ok([...badSpan.matchAll(NAMELESS)].some(([tag]) => /\saria-label=/.test(tag) && !/\srole=/.test(tag)), 'rule A must catch a bare span');
  const okSpan = '<span role="img" aria-label="4 out of 5 stars">★★★★☆</span>';
  assert.ok([...okSpan.matchAll(NAMELESS)].every(([tag]) => /\srole=/.test(tag)), 'rule A must allow a span that has a role');
  const mismatchOf = (html) => {
    const [, , attrs, inner] = [...html.matchAll(NAMED_CONTROL)][0];
    return !norm(attr(`<a${attrs}>`, 'aria-label')).includes(norm(visibleText(inner)));
  };
  const logo = (label, gap) => `<a class="brand" href="/" aria-label="${label}"><img alt=""><span><strong>Clearview</strong>${gap}<span>Vancouver, WA</span></span></a>`;
  assert.ok(mismatchOf(logo('Clearview Windows home', ' ')), 'rule B must catch the old logo label');
  assert.ok(mismatchOf(logo('Clearview Vancouver, WA home', '')), 'rule B must catch a wordmark with no space between its lines');
  assert.ok(!mismatchOf(logo('Clearview Vancouver, WA home', ' ')), 'rule B must accept the fixed logo');
  assert.equal(norm(visibleText('<span class="visually-hidden">Call us</span><svg><path/></svg>Menu')), 'menu');
  assert.equal(norm(visibleText('<img alt=""><span aria-hidden="true">View full photo ↗</span>')), 'view full photo', 'aria-hidden text is still visible text');
}

assert.ok(pages > 20, `expected a full site in dist/, found ${pages} pages`);
assert.ok(controls > 0, 'rule B found no labelled links or buttons with visible text to check; the matcher is broken');
assert.deepEqual(naming, [], `aria-label on an element with no role (screen readers may ignore it; use visually-hidden text):\n  ${naming.join('\n  ')}`);
assert.deepEqual(mismatch, [], `accessible name must contain the visible text (WCAG 2.5.3):\n  ${mismatch.join('\n  ')}`);

// The bond and insurance detail must actually be present as text, not only in the title.
const home = readFileSync(join(dist, 'index.html'), 'utf8');
for (const [name, re] of [
  ['bond', /class="visually-hidden"[^>]*>WA L&amp;I contractor surety bond #/],
  ['insurance', /class="visually-hidden"[^>]*>General liability insured — /],
]) {
  assert.ok(re.test(home), `home page must expose the ${name} detail as text for screen readers`);
}

console.log(`PASS  accessible names (${pages} pages, ${controls} labelled links/buttons with visible text)`);
