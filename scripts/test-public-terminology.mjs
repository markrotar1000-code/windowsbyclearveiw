// Guards the customer-facing terminology rule: public pages, guides, city pages,
// and the Ask knowledge index must not name install methods (insert / full-frame /
// pocket). We measure every opening and put the approach in the written estimate;
// we do not explain methods to customers. Internal Command Center code is exempt.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const scanRoots = ['src/pages', 'src/components', 'src/content', 'src/data', 'functions/ask/_data', 'functions/ask/api'];
const skip = (path) => /[\\/]pages[\\/]internal[\\/]/.test(path);
const banned = [
  [/full[- ]frame/i, 'full-frame'],
  [/\binserts?\b(?!\s*(?:into|adjacent))/i, 'insert'],
  [/\bpocket (?:window|replacement|install)/i, 'pocket'],
  [/\b(?:the|your|chosen|each|per) methods?\b|\bmethod per opening/i, 'install method'],
  [/block[- ]frame|block and fin|nail(?:ing)?[- ]fin(?! window| unit| set)/i, 'method jargon'],
  [/\btired\b/i, 'tired (say old)'],
  [/doing business as|\bd\/b\/a\b/i, 'DBA claim (no DBA is filed)'],
  [/\bone[- ]day (?:job|swap|install)|\busable (?:the )?same day|leaves? the rooms? usable/i, 'job-timing / room-state promise'],
];
// Nailing-fin is fine on new-construction copy; this list keeps the rule narrow.
const allowFiles = new Set(['functions/ask/api/chat.js']); // system prompt states the rule itself

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const hits = [];
for (const scanRoot of scanRoots) {
  for (const path of walk(join(root, scanRoot))) {
    const rel = relative(root, path);
    if (skip(path) || allowFiles.has(rel) || !/\.(astro|md|json|ts|mjs)$/.test(path)) continue;
    readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // code comments are not customer copy
      for (const [re, label] of banned) {
        if (re.test(line)) hits.push(`${rel}:${i + 1} [${label}] ${line.trim().slice(0, 120)}`);
      }
    });
  }
}

assert.equal(hits.length, 0, `install-method terms in customer-facing files:\n${hits.join('\n')}`);

// The Ask assistant must be told not to use the terms either.
const chat = readFileSync(join(root, 'functions/ask/api/chat.js'), 'utf8');
assert.ok(/TERMINOLOGY: do not describe or compare install methods/.test(chat), 'Ask system prompt carries the terminology rule');

// The old guide URL must redirect, not 404.
const redirects = readFileSync(join(root, 'public/_redirects'), 'utf8');
assert.ok(/^\/guides\/full-frame-vs-insert \/guides\/what-your-openings-need 301$/m.test(redirects), 'old guide URL redirects');
assert.ok(/^\/guides\/full-frame-vs-insert\/ \/guides\/what-your-openings-need 301$/m.test(redirects), 'old guide URL redirects with a trailing slash too');

// The calculator no longer asks for a method.
const estimator = readFileSync(join(root, 'src/components/CostEstimator.astro'), 'utf8');
assert.ok(!/est-method/.test(estimator), 'calculator has no method picker');

// Public marketing pages take the phone number from src/data/site.ts, never hardcode it.
for (const f of ['src/pages/areas/index.astro', 'src/pages/areas/[slug].astro']) {
  assert.ok(!/\(564\) 208-0801/.test(readFileSync(join(root, f), 'utf8')), `${f} must use site.phone, not a hardcoded number`);
}

// The gallery page speaks plainly (Keith, 2026-10-11: "What the street sees once the job is done" was
// weird, and jargon-heavy copy had been flagged before). No trade or architect terms in its words, and no
// claim that every photo is Clearview's own job while the source of some photos is unconfirmed.
{
  const gallery = readFileSync(join(root, 'src/pages/gallery.astro'), 'utf8').split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
  const markup = gallery.slice(gallery.indexOf('---', 3)); // the template and styles, not the frontmatter's imports
  const frontCopy = [...gallery.matchAll(/(?:label|blurb): '([^']*)'/g)].map((m) => m[1]).join(' | ');
  const words = `${frontCopy} ${markup.replace(/<style[\s\S]*$/, '').replace(/<[^>]+>/g, ' ')}`;
  const jargon = [/\belevations?\b/i, /\bflash(?:ed|ing)\b/i, /\bnext trade\b/i, /\bdouble-hungs?\b/i, /\bsliders\b/i, /once the job is done/i];
  for (const re of jargon) assert.ok(!re.test(words), `gallery page uses jargon or the odd phrasing ${re}`);
  assert.ok(!/every photo here is from one of our jobs/i.test(words), 'the gallery must not claim every photo is from one of our jobs until the 2026-10-11 photos are confirmed as Clearview jobs');
}

// Photo captions and alt text say "house" or "side of the house", not "elevation" (architect's word; same
// complaint, 2026-10-11). The guides still use it in a few sentences: see .ai/WORKING.md.
{
  const work = readFileSync(join(root, 'src/data/work.ts'), 'utf8');
  const strings = [...work.matchAll(/^\s*(?:caption|alt): '((?:[^'\\]|\\.)*)'/gm)].map((m) => m[1]);
  assert.ok(strings.length >= 80, 'expected to read the captions and alt text in work.ts');
  assert.deepEqual(strings.filter((text) => /\belevations?\b/i.test(text)), [], 'a photo caption or alt text says "elevation"');
  assert.ok(!/elevation/i.test(readFileSync(join(root, 'src/pages/replacement.astro'), 'utf8').replace(/^\s*\/\/.*$/gm, '')), 'replacement.astro says "elevation" in customer copy');
}

console.log('public terminology: ok');
