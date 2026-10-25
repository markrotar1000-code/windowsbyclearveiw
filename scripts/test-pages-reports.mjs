// Static checks: the Analytics, Permits and Mail pilot pages use the shared fetch, failure and money helpers,
// and no longer tell a person to "Use Refresh" / "Try Refresh" when data did not load.
import { readFileSync } from 'node:fs';

const pages = ['analytics', 'permits', 'mail-pilot'];
let failures = 0;
const check = (ok, message) => { if (!ok) { failures += 1; console.error(`FAIL ${message}`); } };

for (const name of pages) {
  const src = readFileSync(`src/pages/internal/${name}.astro`, 'utf8');
  check(/from '\.\.\/\.\.\/lib\/internal-fetch'/.test(src) && /fetchJson/.test(src), `${name}: uses fetchJson`);
  check(/from '\.\.\/\.\.\/lib\/load-failed'/.test(src) && /loadFailedNode\(/.test(src), `${name}: uses loadFailedNode`);
  check(/from '\.\.\/\.\.\/lib\/money'/.test(src) && /formatCents\(/.test(src), `${name}: uses the shared money formatter`);
  check(!/\bawait fetch\(/.test(src), `${name}: no bare fetch`);
  check(!/Intl\.NumberFormat\('en-US', \{ style: 'currency'/.test(src), `${name}: no private currency formatter`);
  check(!/\b(use|try) refresh\b/i.test(src), `${name}: no "Use Refresh" / "Try Refresh" wording`);
  check(!/location\.href = '\/internal\/login/.test(src), `${name}: no hand-rolled login redirect`);
  check(!/innerHTML/.test(src) || /\besc\b/.test(src), `${name}: HTML built from data is escaped with the shared esc`);
}

if (failures) process.exit(1);
console.log('pages-reports checks passed');
