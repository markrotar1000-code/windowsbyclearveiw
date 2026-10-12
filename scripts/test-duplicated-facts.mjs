// Facts that live in two places because Pages Functions and the ops Worker never import from src/.
// Each pair below is kept equal by hand, so each is checked here.
//
// 1. Contract terms. src/data/contractTerms.ts (printed on /sign and the quote page) and
// functions/internal/_lib/quotes.mjs (stamped on every quote and checked when a customer signs).
//
//   * If the two versions differ, every customer's signing attempt fails with "the contract terms for this
//     quote have been updated" (TERMS_CHANGED), and quotes record a version that is not what was shown.
//   * If the wording changes without a new version, a customer signs different terms than their quote
//     records, which is the one thing TERMS_VERSION exists to prevent.
//
// So the wording is pinned: this test hashes everything from `WARRANTY_YEARS` down and compares it with the
// hash recorded here for the current version. Changing the wording fails until you bump TERMS_VERSION in
// BOTH files and add the new version and hash to PINNED. Leave the old entry in place (history).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, 'utf8').replace(/\r\n/g, '\n');
const versionOf = (source, where) => {
  const match = source.match(/export const TERMS_VERSION = '([^']+)'/);
  assert.ok(match, `${where} must export TERMS_VERSION as a string literal`);
  return match[1];
};

const ts = read('src/data/contractTerms.ts');
const functionsVersion = versionOf(read('functions/internal/_lib/quotes.mjs'), 'functions/internal/_lib/quotes.mjs');
const siteVersion = versionOf(ts, 'src/data/contractTerms.ts');
assert.equal(functionsVersion, siteVersion, `TERMS_VERSION differs: site "${siteVersion}", functions "${functionsVersion}". Customers could not sign.`);

const start = ts.indexOf('export const WARRANTY_YEARS');
assert.ok(start > 0, 'contractTerms.ts must still export WARRANTY_YEARS (the pinned wording starts there)');
const hash = createHash('sha256').update(ts.slice(start).trim()).digest('hex').slice(0, 16);

const PINNED = {
  '2026-08-28': '30a3205ce88d0222',
};
assert.ok(PINNED[siteVersion], `TERMS_VERSION "${siteVersion}" has no pinned wording hash. Add it: '${siteVersion}': '${hash}'.`);
assert.equal(
  hash,
  PINNED[siteVersion],
  `The contract wording changed (hash ${hash}) but TERMS_VERSION is still "${siteVersion}". Bump TERMS_VERSION in src/data/contractTerms.ts AND functions/internal/_lib/quotes.mjs, then add the new version and hash to PINNED.`,
);

// 2. The phone number. Every phone number written into functions/ and workers/ (the Ask fallback answer, the
// invoice email, the assistant's business facts) must be the one in src/data/site.ts, or a change there leaves a
// customer-facing copy calling the old number.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
function* sourceFiles(dir) {
  for (const name of readdirSync(join(root, dir))) {
    const path = join(dir, name);
    if (name === 'node_modules' || name === '_data') continue;
    if (statSync(join(root, path)).isDirectory()) yield* sourceFiles(path);
    else if (/\.(js|mjs)$/.test(name)) yield path;
  }
}
const files = [...sourceFiles('functions'), ...sourceFiles('workers')];
const siteSource = read('src/data/site.ts');
const sitePhone = siteSource.match(/^\s*phone:\s*'([^']+)'/m)?.[1];
assert.match(sitePhone ?? '', /^\(\d{3}\) \d{3}-\d{4}$/, 'site.ts must keep `phone` as "(555) 555-5555"');
const digits = (value) => value.replace(/\D/g, '');
let phones = 0;
for (const file of files) {
  for (const match of read(file).matchAll(/\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g)) {
    if (/\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/.test(match[0]) && digits(match[0]).length === 10) {
      phones += 1;
      assert.equal(digits(match[0]), digits(sitePhone), `${file} has the phone number "${match[0]}", which is not the site's ${sitePhone}`);
    }
  }
}
assert.ok(phones >= 3, `expected the phone number in several Function files, found ${phones}`);

// 3. The web address and the mail domain. Public web is windowsbyclearview.com; production mail stays on the
// legacy windowsbyclearveiw.com until a real mailbox exists on the canonical domain (CLAUDE.md, non-negotiable 9).
const siteUrl = siteSource.match(/^\s*url:\s*'([^']+)'/m)?.[1];
assert.equal(siteUrl, 'https://windowsbyclearview.com', 'site.url is the canonical web address');
let urls = 0;
for (const file of files) {
  const text = read(file);
  for (const match of text.matchAll(/https?:\/\/[A-Za-z0-9.-]*windowsbyclear[a-z]*\.com/g)) {
    urls += 1;
    assert.equal(match[0], siteUrl, `${file} links to ${match[0]}; the public site is ${siteUrl}`);
  }
  for (const match of text.matchAll(/[A-Za-z0-9._+-]+@windowsbyclearview\.com/g)) {
    assert.fail(`${file} uses ${match[0]}: mail stays on the legacy windowsbyclearveiw.com until a mailbox exists on the canonical domain`);
  }
}
assert.ok(urls >= 4, `expected the site address in several Function files, found ${urls}`);

console.log(`duplicated facts: terms ${siteVersion} match and are pinned; ${phones} phone numbers and ${urls} site addresses in ${files.length} server files agree with site.ts`);
