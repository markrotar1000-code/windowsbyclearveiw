// Manual browser check for the Rough notes block (not in CI: needs Playwright and a built dist/).
//   npm run build && CHROMIUM_PATH=... node scripts/audit-quote-dictation.mjs
// Serves dist/ itself, fakes the microphone and recorder, and mocks the two API endpoints, then drives the page
// at phone width: record -> stop -> auto draft, clip ordering, Retry, room-by-room drafting without duplicates,
// Undo, restore after reload, and a locked screen mid-recording.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const dist = path.resolve('dist');
const server = http.createServer((req, res) => {
  let file = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!path.extname(file)) file += '.html';
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream' }); res.end(data); } });
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ok = (m) => console.log(`PASS: ${m}`);

async function open({ transcripts = ['Kitchen two double-hungs.'], failFirst = false, drafts = [], init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const calls = { dictation: 0, notes: [] };
  await page.addInitScript(() => {
    window.__recorders = 0;
    navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
    window.MediaRecorder = class { static isTypeSupported() { return true; } constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(5000)], { type: 'audio/webm' }) }); window.__recorders += 1; this.onstop?.(); } };
  });
  if (init) await page.addInitScript(init);
  await page.route('**/internal/api/quote-dictation', async (r) => {
    const n = calls.dictation++;
    if (failFirst && n === 0) return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: "Couldn't hear that clip." }) });
    await new Promise((res) => setTimeout(res, n === 0 ? 300 : 20)); // the first clip is the slowest
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: transcripts[(failFirst ? n - 1 : n) % transcripts.length] || 'x' }) });
  });
  await page.route('**/internal/api/quote-notes', async (r) => {
    const notes = JSON.parse(r.request().postData()).notes; calls.notes.push(notes);
    const draft = drafts[calls.notes.length - 1] || { lines: [{ type: 'window', openingId: 'double-hung', materialId: 'vinyl', brandId: 'cascade', method: 'fin', quantity: 2, room: 'Kitchen', size: '', note: '', heard: '' }] };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ customer: {}, dropped: 0, ...draft }) });
  });
  await page.route('**/internal/api/**', (r) => (/quote-(notes|dictation)/.test(r.request().url()) ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })));
  await page.goto(`${base}/internal/quotes/new`);
  return { ctx, page, errors, calls };
}
const rows = (page) => page.$$eval('.qb-items tbody tr', (t) => t.map((x) => x.querySelector('input').value));

// 1. Record, stop, lines draft by themselves; the button shows a live timer and the dot state.
{
  const { ctx, page, errors, calls } = await open();
  await page.click('[data-rec-toggle]');
  await page.waitForSelector('.qb-rec-live');
  assert.match(await page.textContent('[data-rec-label]'), /^Stop\s+\d:\d\d$/);
  assert.equal(await page.getAttribute('[data-rec-toggle]', 'aria-pressed'), 'true');
  await page.click('[data-rec-toggle]');
  await page.waitForFunction(() => document.querySelectorAll('.qb-items tbody tr').length === 1);
  assert.deepEqual(await rows(page), ['Kitchen: Double-hung — Vinyl — Cascade — fin']);
  assert.equal(await page.inputValue('[data-rough-notes]'), 'Kitchen two double-hungs.');
  assert.deepEqual(calls.notes, ['Kitchen two double-hungs.']);
  assert.equal(await page.textContent('[data-rec-label]'), 'Record');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'no sideways scroll');
  assert.deepEqual(errors, []);
  await ctx.close(); ok('record -> stop -> auto draft, with a live button state');
}

// 2. Room by room: the second draft sends only the new words and does not duplicate the kitchen.
{
  const { ctx, page, calls } = await open({ transcripts: ['Kitchen two double-hungs.', 'Den one picture window.'], drafts: [undefined, { lines: [{ type: 'window', openingId: 'picture', materialId: null, brandId: null, method: null, quantity: 1, room: 'Den', size: '', note: '', heard: '' }] }] });
  for (let i = 0; i < 2; i += 1) { await page.click('[data-rec-toggle]'); await page.click('[data-rec-toggle]'); await page.waitForFunction((n) => document.querySelectorAll('.qb-items tbody tr').length === n, i + 1); }
  assert.deepEqual(calls.notes, ['Kitchen two double-hungs.', 'Den one picture window.']);
  assert.equal((await rows(page)).length, 2);
  await page.click('[data-draft-go]'); // nothing new
  assert.match(await page.textContent('[data-notes-status]'), /Nothing new to draft/);
  assert.equal((await rows(page)).length, 2);
  await page.click('[data-draft-undo]');
  assert.equal((await rows(page)).length, 1, 'Undo removes only the last draft');
  await page.click('[data-draft-go]');
  await page.waitForFunction(() => document.querySelectorAll('.qb-items tbody tr').length === 2);
  assert.equal(calls.notes.at(-1), 'Den one picture window.', 'after Undo the same words can be drafted again');
  await ctx.close(); ok('room-by-room drafting sends only new words, never duplicates, and Undo is exact');
}

// 3. Two clips in one recording land in the order spoken even when the first transcribes last.
{
  const { ctx, page } = await open({ transcripts: ['FIRST clip.', 'SECOND clip.'] });
  await page.click('[data-auto-draft]'); // draft manually here
  await page.click('[data-rec-toggle]');
  await page.click('[data-rec-toggle]');
  await page.click('[data-rec-toggle]'); await page.click('[data-rec-toggle]');
  await page.waitForFunction(() => /SECOND/.test(document.querySelector('[data-rough-notes]').value));
  assert.equal(await page.inputValue('[data-rough-notes]'), 'FIRST clip.\nSECOND clip.');
  await ctx.close(); ok('clips are added in the order they were recorded');
}

// 4. A failed clip is kept; Retry sends it again; auto draft waits for it.
{
  const { ctx, page, calls } = await open({ failFirst: true });
  await page.click('[data-rec-toggle]'); await page.click('[data-rec-toggle]');
  await page.waitForSelector('[data-retry-clips]:not([hidden])');
  assert.match(await page.textContent('[data-notes-status]'), /recording is kept/);
  assert.equal(calls.notes.length, 0, 'nothing is drafted from a failed recording');
  await page.click('[data-retry-clips]');
  await page.waitForFunction(() => document.querySelectorAll('.qb-items tbody tr').length === 1);
  assert.equal(await page.isHidden('[data-retry-clips]'), true);
  await ctx.close(); ok('a failed recording is kept for Retry');
}

// 5. Unsent notes survive a reload; the saved quote forgets them.
{
  const { ctx, page } = await open();
  await page.fill('[data-rough-notes]', 'Back bedroom picture window, some rot.');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-rough-notes]').value !== '');
  assert.equal(await page.inputValue('[data-rough-notes]'), 'Back bedroom picture window, some rot.');
  assert.match(await page.textContent('[data-notes-status]'), /Restored your unsent notes/);
  await ctx.close(); ok('unsent notes survive a reload');
}

// 6. The screen turning off mid-recording stops it and still writes out what was said.
{
  const { ctx, page } = await open();
  await page.click('[data-auto-draft]');
  await page.click('[data-rec-toggle]');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => /Kitchen two double-hungs/.test(document.querySelector('[data-rough-notes]').value));
  assert.match(await page.textContent('[data-notes-status]'), /screen turned off|Added to the notes/);
  assert.equal(await page.textContent('[data-rec-label]'), 'Record');
  await ctx.close(); ok('a locked screen ends the recording and keeps what was said');
}

// 7. Editing words that were already drafted asks before replacing the earlier lines; declining changes nothing.
{
  const { ctx, page, calls } = await open();
  await page.click('[data-rec-toggle]'); await page.click('[data-rec-toggle]');
  await page.waitForFunction(() => document.querySelectorAll('.qb-items tbody tr').length === 1);
  await page.fill('[data-rough-notes]', 'Kitchen three double-hungs.');
  let asked = 0; page.once('dialog', (d) => { asked += 1; d.dismiss(); });
  await page.click('[data-draft-go]');
  assert.equal(asked, 1); assert.equal(calls.notes.length, 1, 'declining sends nothing');
  assert.equal((await rows(page)).length, 1);
  page.once('dialog', (d) => d.accept());
  await page.click('[data-draft-go]');
  await page.waitForFunction(() => document.querySelector('[data-notes-status]').textContent.startsWith('Added'));
  assert.equal((await rows(page)).length, 1, 'accepting replaces the earlier lines instead of duplicating them');
  assert.equal(calls.notes.at(-1), 'Kitchen three double-hungs.');
  await ctx.close(); ok('editing drafted words asks first; replace never duplicates');
}

// 8. A $0 line is flagged live, and saving with one asks first (declining sends nothing).
{
  const { ctx, page, calls } = await open({ drafts: [{ lines: [{ type: 'custom', label: 'Rot repair at sill', quantity: 1, room: 'Den', size: '', note: '', heard: '' }] }] });
  let saves = 0; await page.route('**/internal/api/quotes', (r) => { saves += 1; r.fulfill({ status: 201, contentType: 'application/json', body: '{"id":"Q-1"}' }); });
  await page.fill('[data-rough-notes]', 'Den rot repair at the sill.');
  await page.click('[data-draft-go]');
  await page.waitForFunction(() => document.querySelectorAll('.qb-items tbody tr').length === 1);
  assert.match(await page.textContent('[data-unpriced]'), /1 line is still at \$0/);
  await page.fill('[name=name]', 'Dana'); await page.fill('[name=phone]', '3605550142');
  let asked = ''; page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
  await page.click('[data-submit]');
  await page.waitForTimeout(200);
  assert.match(asked, /still \$0/); assert.equal(saves, 0, 'declining saves nothing');
  await page.fill('.qb-items tbody tr .qb-cell-price input', '450');
  assert.equal(await page.isHidden('[data-unpriced]'), true, 'the note clears once a price is typed');
  await ctx.close(); ok('a $0 line is flagged and saving with one asks first');
}

// 9. Microphone blocked: the page says exactly where to undo it, never loops, and "Check again" recovers once fixed.
{
  const { ctx, page } = await open({ init: () => {
    window.__mic = 'denied';
    const perm = { state: 'denied', onchange: null };
    navigator.permissions.query = async () => perm;
    navigator.mediaDevices.getUserMedia = async () => {
      if (window.__mic === 'denied') throw new DOMException('no', 'NotAllowedError');
      perm.state = 'granted'; return { getTracks: () => [{ stop() {} }] };
    };
    navigator.mediaDevices.enumerateDevices = async () => (window.__mic === 'denied' ? [] : [{ kind: 'audioinput', deviceId: 'a', label: 'Phone mic' }, { kind: 'audioinput', deviceId: 'b', label: 'AirPods' }]);
  } });
  await page.waitForSelector('[data-mic-help]:not([hidden])');
  assert.match(await page.textContent('[data-mic-help]'), /cannot undo that.*lock icon|cannot undo that.*aA/s);
  assert.equal(await page.textContent('[data-mic-allow]'), 'Check again');
  await page.click('[data-rec-toggle]');
  assert.match(await page.textContent('[data-notes-status]'), /blocked for this site/);
  assert.equal(await page.getAttribute('[data-rec-toggle]', 'aria-pressed'), 'false', 'a blocked microphone never leaves the button stuck on Stop');
  await page.evaluate(() => { window.__mic = 'ok'; });
  await page.click('[data-mic-allow]');
  await page.waitForSelector('[data-mic-help][hidden]', { state: 'attached' });
  assert.equal(await page.isHidden('[data-mic-allow]'), true, 'no Allow button once the microphone is on');
  await ctx.close(); ok('blocked microphone: clear steps, Check again recovers, button never sticks');
}

// 10. Choosing a microphone: listed, remembered, and an unplugged one falls back to the default.
{
  const { ctx, page } = await open({ init: () => {
    window.__gone = false; window.__used = [];
    navigator.permissions.query = async () => ({ state: 'granted', onchange: null });
    navigator.mediaDevices.enumerateDevices = async () => [{ kind: 'audioinput', deviceId: 'a', label: 'Phone mic' }, { kind: 'audioinput', deviceId: 'b', label: 'AirPods' }];
    navigator.mediaDevices.getUserMedia = async (c) => {
      const want = c.audio && c.audio.deviceId && c.audio.deviceId.exact; window.__used.push(want || 'default');
      if (want === 'b' && window.__gone) throw new DOMException('gone', 'OverconstrainedError');
      return { getTracks: () => [{ stop() {} }] };
    };
  } });
  await page.waitForFunction(() => document.querySelector('[data-mic-select]').options.length === 3);
  assert.equal(await page.isHidden('[data-mic-select]'), false);
  await page.selectOption('[data-mic-select]', 'b');
  await page.click('[data-rec-toggle]');
  assert.equal(await page.isDisabled('[data-mic-select]'), true, 'the input cannot change mid-recording');
  await page.click('[data-rec-toggle]');
  assert.equal((await page.evaluate(() => window.__used)).at(-1), 'b', 'the chosen microphone is used');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-mic-select]').options.length === 3);
  assert.equal(await page.inputValue('[data-mic-select]'), 'b', 'the choice is remembered');
  await page.evaluate(() => { window.__gone = true; window.__used = []; });
  await page.click('[data-rec-toggle]');
  assert.deepEqual(await page.evaluate(() => window.__used), ['b', 'default'], 'an unplugged microphone falls back to the default');
  assert.match(await page.textContent('[data-notes-status]'), /using the default one|Recording/);
  await page.click('[data-rec-toggle]');
  await ctx.close(); ok('microphone choice is listed, remembered, locked while recording, and falls back when unplugged');
}

await browser.close(); server.close();
console.log('\nAll Rough notes browser checks passed.');
