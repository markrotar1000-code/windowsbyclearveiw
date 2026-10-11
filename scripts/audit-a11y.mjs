// Runs axe-core over every public page of the built site, in a real browser: phone and desktop, light
// and dark. This is the tool that found the problems `npm run test:a11y-names` now guards.
//
//   npm i --no-save playwright axe-core
//   npm run build && npx astro preview --port 4330 &
//   node scripts/audit-a11y.mjs [baseUrl] [--internal] [--json out.json]
//
// Output is one block per rule: how many page-views and nodes broke it, an example page, and the first
// elements. A clean run prints "No violations".
//
// Not part of `npm run test:all`: it needs Playwright, axe-core and a Chromium, which this repo does not
// install. Set CHROMIUM_PATH to use a browser Playwright did not download itself.
//
// Scanning notes (each cost a false alarm once):
//   - The page is scrolled end to end, then every finite transition and animation is allowed to finish
//     before axe runs. Colors on a few tables ease in after load, and the home hero's credential tags fade
//     in for several seconds; scanned mid-fade they read 3.2 to 4.45:1, and at rest they pass.
//   - Pages under /internal need a Cloudflare Access session and are skipped unless --internal is given.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const base = args.find((arg) => /^https?:/.test(arg)) ?? 'http://127.0.0.1:4330';
const internal = args.includes('--internal');
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const root = fileURLToPath(new URL('..', import.meta.url));

let chromium;
let axeSource;
try {
  ({ chromium } = await import('playwright'));
  axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
} catch {
  console.error('Needs Playwright and axe-core. Run `npm i --no-save playwright axe-core` (and set CHROMIUM_PATH if you have a browser already).');
  process.exit(2);
}

function builtPages() {
  const dist = join(root, 'dist');
  const pages = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (dir !== dist || name !== '_astro') walk(path);
      } else if (name.endsWith('.html')) {
        pages.push(path.slice(dist.length).replace(/\\/g, '/').replace(/\.html$/, '').replace(/\/index$/, '') || '/');
      }
    }
  })(dist);
  return pages.filter((page) => internal || !/^\/(internal|ops-offline)(\/|$)/.test(page)).sort();
}

const screens = [
  ['phone', { width: 390, height: 844 }],
  ['desktop', { width: 1440, height: 900 }],
];
const pages = builtPages();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const byRule = new Map();
let views = 0;
for (const [screen, viewport] of screens) {
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport, colorScheme: scheme });
    const page = await context.newPage();
    for (const path of pages) {
      const response = await page.goto(base + path, { waitUntil: 'load' }).catch(() => null);
      if (!response || response.status() >= 400) continue;
      views += 1;
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += 800) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(40);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      // Let every finite transition and animation finish (at most 10 s) so no color is scanned mid-fade.
      await page.evaluate(() => Promise.race([
        Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity)).map((a) => a.finished.catch(() => {}))),
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ]));
      await page.waitForTimeout(300);
      await page.evaluate(axeSource);
      const violations = await page.evaluate(async () => {
        const run = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] });
        return run.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length, nodes: v.nodes.slice(0, 3).map((n) => ({ target: n.target.join(' ').slice(0, 120), why: (n.failureSummary || '').split('\n').slice(1, 3).join(' ').slice(0, 200) })) }));
      });
      for (const v of violations) {
        const rule = byRule.get(v.id) ?? { help: v.help, impact: v.impact, views: new Set(), nodes: 0, examples: [] };
        rule.views.add(`${screen}/${scheme} ${path}`);
        rule.nodes += v.count;
        if (rule.examples.length < 3) rule.examples.push(...v.nodes.slice(0, 3 - rule.examples.length));
        byRule.set(v.id, rule);
      }
    }
    await context.close();
  }
}
await browser.close();

console.log(`axe-core: ${pages.length} pages x ${screens.length} screens x 2 color schemes = ${views} page-views scanned`);
if (byRule.size === 0) console.log('No violations');
for (const [id, rule] of [...byRule].sort((a, b) => b[1].views.size - a[1].views.size)) {
  console.log(`\n${id} (${rule.impact}) - ${rule.help}  [${rule.views.size} page-views, ${rule.nodes} nodes]`);
  console.log('  e.g.', [...rule.views].slice(0, 3).join(', '));
  for (const node of rule.examples) console.log('   ', node.target, '::', node.why);
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify([...byRule].map(([id, rule]) => ({ id, ...rule, views: [...rule.views] })), null, 2));
process.exit(byRule.size ? 1 : 0);
