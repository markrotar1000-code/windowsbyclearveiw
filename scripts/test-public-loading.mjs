import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const hero = readFileSync('src/components/VideoHero.astro', 'utf8');
const script = stripTypeScriptTypes(hero.match(/<script>([\s\S]*?)<\/script>/)[1]);
for (const mode of ['desktop', 'phone', 'reduced', 'saveData', '3g', 'blocked']) {
  class Element {}
  const classes = new Set();
  const stage = new Element();
  stage.classList = { add: x => classes.add(x), remove: x => classes.delete(x) };
  class Video extends Element {
    dataset = { src: '/video/logo-reveal-1-optimized.mp4' };
    src = '';
    plays = 0;
    pauses = 0;
    listeners = {};
    addEventListener(name, fn) { this.listeners[name] = fn; }
    pause() { this.pauses++; }
    play() { this.plays++; return { catch: fn => { if (mode === 'blocked') fn(); } }; }
  }
  const video = new Video();
  const events = {};
  vm.runInNewContext(script, {
    HTMLElement: Element, HTMLVideoElement: Video,
    document: { querySelector: () => stage, getElementById: () => video, addEventListener: (name, fn) => { events[name] = fn; } },
    navigator: { connection: { saveData: mode === 'saveData', effectiveType: mode === '3g' ? '3g' : '4g' } },
    window: { matchMedia: query => ({ matches: (mode === 'reduced' && query.includes('reduced-motion')) || (mode === 'phone' && query.includes('max-width')) }) },
  });
  events['astro:page-load']();
  const skipped = ['phone', 'reduced', 'saveData', '3g'].includes(mode);
  assert.equal(video.plays, skipped ? 0 : 1, `${mode}: no duplicate autoplay`);
  assert.equal(video.src, skipped ? '' : video.dataset.src, `${mode}: skipped motion must not request video`);
  if (skipped || mode === 'blocked') assert.ok(classes.has('is-static'), `${mode}: readable fallback`);
  if (!skipped) {
    video.listeners.playing();
    video.listeners.ended();
    assert.ok(!classes.has('is-playing') && classes.has('is-static'));
    video.listeners.error();
  }
  events['astro:before-swap']();
  assert.ok(video.pauses > 0, 'navigation pauses the old video');
}
assert.ok(!/<source\b|\sposter=/.test(hero), 'no duplicate poster/alternative video fetches');
assert.match(hero, /preload="none"/);
const css = readFileSync('src/styles/global.css', 'utf8');
const copy = css.match(/\.video-copy\s*\{([^}]+)\}/)[1];
assert.match(copy, /opacity: 1/);
assert.ok(!/animation:/.test(copy), 'customer content must never wait for decorative video');
assert.ok(statSync('public/video/logo-reveal-1-optimized.mp4').size < 700_000);

class Element {
  hidden = true;
  textContent = '';
  addEventListener(_, fn) { this.click = fn; }
}
const feedbackCode = stripTypeScriptTypes(readFileSync('src/lib/security-feedback.ts', 'utf8')).replace('export function', 'function');
const context = { HTMLElement: Element };
vm.createContext(context);
vm.runInContext(feedbackCode + '\nthis.createFeedback = securityFeedback;', context);
const status = new Element();
const retry = new Element();
let retries = 0;
const feedback = context.createFeedback(status, retry, () => { retries++; });
feedback.fail('Security unavailable');
assert.equal(retry.hidden, false);
feedback.ready();
assert.equal(status.textContent, '');
assert.equal(retry.hidden, true);
feedback.fail('Security unavailable');
status.textContent = 'Server could not accept your request';
feedback.ready();
assert.equal(status.textContent, 'Server could not accept your request', 'widget recovery must preserve unrelated submission errors');
feedback.fail('Security unavailable');
retry.click();
assert.equal(retries, 1);
assert.equal(status.textContent, '');
console.log('PASS public loading: six motion/network cases, immediate content, asset budget and security recovery');
