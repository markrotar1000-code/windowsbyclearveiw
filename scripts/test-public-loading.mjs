import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const hero = readFileSync('src/components/VideoHero.astro', 'utf8');
assert.ok(!/<video\b|<source\b|logo-reveal|video\.play\(/.test(hero), 'homepage hero must stay static without fetching a reveal video');
assert.match(hero, /class="hero-static"/);
assert.match(hero, /fetchpriority="high"/);
const css = readFileSync('src/styles/global.css', 'utf8');
const copy = css.match(/\.video-copy\s*\{([^}]+)\}/)[1];
assert.match(copy, /opacity: 1/);
assert.ok(!/animation:/.test(copy), 'customer content must never wait for decorative video');
assert.ok(statSync('public/logo/icon-mark@256.webp').size < 25_000, 'shared decorative mark stays within its delivery budget');

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
console.log('PASS public loading: static hero, immediate content, asset budget and security recovery');
