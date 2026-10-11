// Run-in guard, checked against the built site (`npm run build` first).
//
// Found 2026-10-10: Astro's HTML compression drops a line break between text and the inline element after it,
// and it drops it without leaving a space. This source
//
//     before anything comes out of the wall.
//     <a href="/tools/...">Plan your project first</a>.
//
// shipped as `wall.<a ...>Plan your project first</a>`: the sentence ran into its link on the home page, on
// /new-construction (twice) and on /window-features, and screen readers read "wall.Plan". The fix is an
// explicit `{' '}` at the end of the text (the same reason Brand.astro has one between its two lines).
//
// Two patterns that are never right in prose:
//   1. sentence punctuation (. , ; : ! ?) immediately followed by an opening <a>, <strong>, <em>, <b>, <code>,
//      <abbr>, <mark>, <small> or <u>;
//   2. one of those elements closing immediately before a letter or digit (`</a>text`).
// Decorative <span> and <i> swatches, dots and step numbers sit next to their label with a CSS gap and are not
// checked; `)<a` and `</a>.` are fine. Scripts, styles, SVG and <head> are skipped.
//
// Also found 2026-10-11: a phone number with an ordinary space breaks across two lines ("(564)" / "208-0801").
// 19 of 918 numbers measured did, mostly the area pages' summaries. So a third pattern:
//   3. a phone number written "(360) 555-0123" with a plain space in prose (anywhere except a `tel:` link, whose
//      text is short and kept on one line with CSS). Use keepPhoneTogether() from src/lib/phone.ts in a template,
//      or &nbsp; in a Markdown file. Meta tags, structured data and attributes are not prose and are skipped.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
if (!existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` before `npm run test:text-gaps`.');
  process.exit(1);
}

const INLINE = 'a|strong|em|b|code|abbr|mark|small|u';
const opensAfterPunctuation = new RegExp(`[.,;:!?]<(?:${INLINE})\\b[^>]*>`, 'gu');
const closesBeforeText = new RegExp(`</(?:${INLINE})>[\\p{L}\\p{N}]`, 'gu');

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== '_astro') yield* walk(path); }
    else if (path.endsWith('.html')) yield path;
  }
}
const body = (html) => html
  .replace(/<head>[\s\S]*?<\/head>/, '')
  .replace(/<(script|style|svg|noscript|template)\b[\s\S]*?<\/\1>/g, '');
const glued = (html) => [...body(html).matchAll(opensAfterPunctuation), ...body(html).matchAll(closesBeforeText)];
const context = (html, match) => {
  const text = body(html);
  return text.slice(Math.max(0, match.index - 45), match.index + match[0].length + 25).replace(/\s+/g, ' ').replace(/ data-astro-cid-\w+/g, '');
};

// Self-test: the checker must see the bug and leave fine markup alone.
assert.equal(glued('<p>out of the wall.<a href="/x">Plan it</a>.</p>').length, 1, 'must catch a sentence running into its link');
assert.equal(glued('<p>Call <a href="/x">us</a>today</p>').length, 1, 'must catch a link running into the next word');
assert.equal(glued('<p>Marked-up plans welcome. <a href="/x">Email us</a>.</p>').length, 0, 'must accept a spaced link');
assert.equal(glued('<p>(see <a href="/x">the guide</a>)</p><p><span class="dot"></span>Label</p>').length, 0, 'must accept parentheses and decorative spans');
assert.equal(glued('<script>a.b<a href="x">1</a>c</script><svg><text>x.<b>y</b></text></svg>').length, 0, 'must skip scripts and SVG');


const PHONE = /\(\d{3}\) \d{3}-\d{4}/;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const NOT_PROSE = new Set(['head', 'script', 'style', 'svg', 'noscript', 'template', 'title']);
/** Phone numbers in prose that still have a plain space. A `tel:` link is allowed to (CSS keeps it on one line). */
function breakablePhones(html) {
  const found = [];
  const stack = [];
  for (const [token] of html.matchAll(/<[^>]*>|[^<]+/g)) {
    if (token.startsWith('<')) {
      const tag = token.match(/^<(\/)?([a-zA-Z][\w:-]*)/);
      if (!tag) continue; // comment or doctype
      const name = tag[2].toLowerCase();
      if (tag[1]) {
        const at = stack.map((entry) => entry.name).lastIndexOf(name);
        if (at >= 0) stack.length = at;
      } else if (!VOID.has(name) && !token.endsWith('/>')) {
        stack.push({ name, tel: name === 'a' && /\shref="tel:/i.test(token) });
      }
    } else if (PHONE.test(token) && !stack.some((entry) => NOT_PROSE.has(entry.name) || entry.tel)) {
      found.push(token.trim().slice(0, 90));
    }
  }
  return found;
}
assert.equal(breakablePhones('<p>Call (564) 208-0801 today</p>').length, 1, 'must catch a plain-space number in prose');
assert.equal(breakablePhones('<p>Call (564) 208-0801 today</p>').length, 0, 'must accept a non-breaking space');
assert.equal(breakablePhones('<p>Call <a href="tel:+15642080801">(564) 208-0801</a></p>').length, 0, 'must accept a tel: link');
assert.equal(breakablePhones('<a href="/areas/x"><span>(564) 208-0801</span></a>').length, 1, 'must catch a number inside an ordinary link');
assert.equal(breakablePhones('<head><title>(564) 208-0801</title></head><script>var n = "(564) 208-0801";</script><p>ok</p>').length, 0, 'must skip head and scripts');

// Messages the estimate form writes by script ("... call (564) 208-0801 instead") are not in the built HTML.
assert.match(readFileSync(join(root, 'src/components/EstimateForm.astro'), 'utf8'), /const phoneDisplay = keepPhoneTogether\(site\.phoneDisplay\)/, 'the estimate form must keep the phone number in its script-written messages on one line');

const found = [];
const phones = [];
let pages = 0;
for (const file of walk(dist)) {
  const html = readFileSync(file, 'utf8');
  pages += 1;
  const path = '/' + relative(dist, file).replaceAll('\\', '/').replace(/(\/?index)?\.html$/, '');
  for (const match of glued(html)) found.push(`${path}  ...${context(html, match)}...`);
  // The Command Center (Mark's own tool, and the quote and invoice print views) is left out of the phone rule.
  if (!path.startsWith('/internal')) for (const text of breakablePhones(body(html))) phones.push(`${path}  "${text}"`);
}

assert.ok(pages > 20, `expected a full site in dist/, found ${pages} pages`);
assert.deepEqual(found, [], `text runs into an inline element with no space (Astro drops a line break before one; end the text with {' '}):\n  ${found.join('\n  ')}`);

assert.deepEqual(phones, [], `a phone number in prose has a plain space and can break across two lines (use keepPhoneTogether() or &nbsp;):\n  ${phones.join('\n  ')}`);

console.log(`PASS  text gaps (${pages} pages)`);
