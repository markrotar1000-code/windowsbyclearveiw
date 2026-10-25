// Quotes and invoices pages: they use the shared fetch/failure/escape/money helpers, and the Build Plan
// visualizer (which had no test) renders and recovers from a failed load.
// Static checks always run. The render check needs a browser: set CHROMIUM_PATH (it is skipped otherwise).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
};
const root = resolve(new URL('..', import.meta.url).pathname);
const PAGES = {
  'quotes/index': 'src/pages/internal/quotes/index.astro',
  'quotes/build-plan': 'src/pages/internal/quotes/build-plan.astro',
  'quotes/build-plan-approval': 'src/pages/internal/quotes/build-plan-approval.astro',
  'quotes/build-plan-visualizer': 'src/pages/internal/quotes/build-plan-visualizer.astro',
  'invoices/index': 'src/pages/internal/invoices/index.astro',
  'invoices/view': 'src/pages/internal/invoices/view.astro',
};
const source = Object.fromEntries(Object.entries(PAGES).map(([name, path]) => [name, readFileSync(resolve(root, path), 'utf8')]));

// ---- static: helper adoption
for (const [name, text] of Object.entries(source)) {
  assert(/import \{[^}]*\bfetchJson\b[^}]*\} from '[./]+\/lib\/internal-fetch'/.test(text), `${name} imports fetchJson from the shared helper`);
  assert(/import \{[^}]*\besc\b[^}]*\} from '[./]+\/lib\/internal-fetch'/.test(text), `${name} imports the shared esc`);
  assert(/import \{[^}]*\bloadFailedNode\b[^}]*\} from '[./]+\/lib\/load-failed'/.test(text), `${name} imports loadFailedNode`);
  assert(!/const esc\s*=/.test(text), `${name} has no local esc copy`);
  assert(/loadFailedNode\(/.test(text), `${name} shows a failed load with loadFailedNode`);
  assert(/\bfetchJson\(/.test(text), `${name} loads through fetchJson`);
  // A direct fetch is allowed in one place only: the Build Plan save, which reads blockers/warnings out of a 409 body.
  const direct = (text.match(/(?<![\w.])fetch\(/g) || []).length;
  const expected = name === 'quotes/build-plan' ? 1 : 0;
  assert(direct === expected, `${name} makes ${expected} direct fetch call(s) (found ${direct})`);
}
const plan = source['quotes/build-plan'];
assert(/import \{ formatCents \} from '[./]+\/lib\/money'/.test(plan) && /const money\s*=\s*formatCents/.test(plan), 'build-plan uses the shared money formatter');
assert(!/maximumFractionDigits:0/.test(plan), 'build-plan has no local money formatter');
assert(plan.includes("'VERIFY at site'") || plan.includes('VERIFY at site'), 'build-plan keeps dimensions marked VERIFY at site');
assert(/SESSION_EXPIRED_MESSAGE/.test(plan), 'build-plan save names an expired sign-in');

// ---- render: Build Plan visualizer
const chromiumPath = process.env.CHROMIUM_PATH;
if (!chromiumPath) {
  console.log('SKIP: visualizer render check (set CHROMIUM_PATH to a Chrome to run it)');
  process.exit(0);
}
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { rolldown } = require('rolldown');

const viz = source['quotes/build-plan-visualizer'];
const markup = viz.split(/<InternalLayout[^>]*>/)[1].split('</InternalLayout>')[0];
const script = viz.split('<script>')[1].split('</script>')[0];
// Bundle the page's own script with the real shared helpers (TypeScript, so a bundler is needed): the page's
// relative imports are pointed at their absolute paths and the script is fed in as a virtual module.
const VIRTUAL = '\0visualizer-script';
const bundle = await rolldown({
  input: VIRTUAL,
  logLevel: 'silent',
  plugins: [{
    name: 'page-script',
    resolveId: (id) => (id === VIRTUAL ? id : null),
    load: (id) => (id === VIRTUAL ? { code: script.replaceAll("'../../../lib/", `'${resolve(root, 'src/lib')}/`), moduleType: 'ts' } : null),
  }],
});
const { output } = await bundle.generate({ format: 'iife' });
const js = output[0].code;
const shell = `<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${markup}<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;

const PLAN = {
  project: { customerName: 'Test <b>Customer</b>' },
  buy: ['Buy A', 'Buy B'], load: ['Load A'], verify: ['Check <i>this</i>', 'Check that'],
  openings: [
    { product: 'Opening <img src=x onerror=window.__xss=1> one', openingType: 'double-hung', installationMethod: 'insert', quantity: 2, dimensions: 'VERIFY at site', existingCondition: 'VERIFY at site', flashing: 'f', notes: '' },
    { product: 'Second opening', openingType: 'slider', installationMethod: 'verify', quantity: 1, dimensions: '', existingCondition: '', flashing: '', notes: 'Note here' },
  ],
};

const browser = await chromium.launch({ executablePath: chromiumPath });
try {
  const page = await browser.newPage();
  let apiMode = 'ok';
  await page.route('http://t.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/internal/api/build-plan') {
      if (apiMode === 'session') return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Sign in</html>' });
      if (apiMode === 'server') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Plan store is down.' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: PLAN }) });
    }
    return route.fulfill({ status: 200, contentType: 'text/html', body: shell });
  });
  const open = async (mode) => {
    apiMode = mode;
    await page.goto('http://t.test/internal/quotes/build-plan-visualizer?quoteId=Q-1');
  };

  await open('ok');
  await page.waitForSelector('[data-workspace]:not([hidden])');
  assert((await page.textContent('[data-title]')) === 'Test <b>Customer</b>', 'visualizer shows the customer name as text, not markup');
  assert((await page.textContent('[data-openings]')) === '2' && (await page.textContent('[data-buy]')) === '2' && (await page.textContent('[data-verify]')) === '2', 'visualizer counts openings, buy groups and VERIFY items');
  assert((await page.textContent('[data-opening-position]')) === '1 / 2', 'visualizer starts at opening 1 of 2');
  assert((await page.isDisabled('[data-prev]')) && !(await page.isDisabled('[data-next]')), 'Previous is disabled on the first opening');
  assert((await page.textContent('[data-opening-card]')).includes('<img'), 'opening text is escaped');
  assert(!(await page.evaluate(() => window.__xss)), 'opening markup did not run');
  assert((await page.textContent('[data-opening-card]')).includes('VERIFY at site'), 'prefilled dimensions stay marked VERIFY at site');
  await page.click('[data-next]');
  assert((await page.textContent('[data-opening-position]')) === '2 / 2' && (await page.textContent('[data-opening-card]')).includes('Second opening'), 'Next moves to the second opening');
  assert((await page.isDisabled('[data-next]')) && !(await page.isDisabled('[data-prev]')), 'Next is disabled on the last opening');
  assert((await page.textContent('[data-opening-card]')).includes('VERIFY on site'), 'a blank dimension falls back to VERIFY on site');
  assert((await page.textContent('[data-decisions]')).includes('Check <i>this</i>'), 'decision board escapes VERIFY items');

  // failed loads: a message in place plus Try again that recovers
  await open('session');
  await page.waitForSelector('.load-failed');
  assert((await page.textContent('.load-failed')).includes('sign-in expired'), 'expired sign-in is named');
  assert(await page.isHidden('[data-workspace]'), 'nothing is shown as loaded after a failure');
  apiMode = 'server';
  await page.click('.load-failed button');
  await page.waitForFunction(() => document.querySelector('.load-failed')?.textContent?.includes('Plan store is down.'));
  assert(true, 'server error shows the server sentence');
  apiMode = 'ok';
  await page.click('.load-failed button');
  await page.waitForSelector('[data-workspace]:not([hidden])');
  assert((await page.locator('.load-failed').count()) === 0, 'Try again recovers and clears the failure');
} finally {
  await browser.close();
}
