import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const read = path => fs.readFileSync(path, 'utf8');
const layout = read('src/layouts/BaseLayout.astro');
const loader = layout.match(/\(function \(w, d, s, l, i\)[\s\S]*?'GTM-WGCFVHQM'\);/)[0];
for (const hostname of ['windowsbyclearview.com', 'www.windowsbyclearview.com', 'localhost', '127.0.0.1', 'windowsbyclearveiw-416.pages.dev', 'abc.windowsbyclearveiw-416.pages.dev', 'windowsbyclearveiw.pages.dev', 'windowsbyclearview.com.example.org']) {
  const loaded = [];
  const window = { location: { hostname } };
  const document = { createElement: () => ({}), getElementsByTagName: () => [{ parentNode: { insertBefore: tag => loaded.push(tag.src) } }] };
  vm.runInNewContext(loader, { window, document });
  assert.equal(loaded.length, ['windowsbyclearview.com', 'www.windowsbyclearview.com'].includes(hostname) ? 1 : 0, hostname);
}
assert.ok(!layout.includes('ns.html?id='), 'a noscript iframe must not bypass the hostname guard');
assert.ok(!read('src/pages/estimate/sent.astro').includes("event: 'generate_lead'"), 'direct/refresh confirmation-page views are not conversions');

class Element {
  dataset = {}; hidden = false; textContent = ''; listeners = {}; children = {};
  addEventListener(type, fn) { this.listeners[type] = fn; }
  querySelector(selector) { return this.children[selector] || null; }
  querySelectorAll() { return []; }
  setAttribute() {} removeAttribute() {} focus() {} scrollIntoView() {}
}
class Form extends Element {}
class Button extends Element {}
class Input extends Element {}
class Textarea extends Element {}

function harness(kind) {
  const form = new Form(), success = new Element(), status = new Element(), button = new Button(), dialog = new Element();
  form.children['[data-submit]'] = button;
  dialog.children = { '[data-callback-form]': form, '[data-callback-success]': success, '[data-callback-status]': status, '[data-callback-submit]': button, '[name="notes"]': new Textarea() };
  const document = { getElementById: () => form, addEventListener() {}, querySelector: s => ({ '[data-status]': status, '[data-success]': success, '[data-ask-callback]': dialog, '[data-ask-callback-open]': new Element() })[s] || null };
  const pending = [], window = { location: { search: '', pathname: '/estimate' }, history: {}, dataLayer: [] };
  const context = {
    window, document, URLSearchParams, HTMLElement: Element, HTMLFormElement: Form, HTMLButtonElement: Button, HTMLInputElement: Input, HTMLTextAreaElement: Textarea, Element,
    site: { phoneDisplay: '360 555 0100' }, keepPhoneTogether: s => s, visitorMessage: (_e, fallback) => fallback,
    readIntent: () => null, trackIntent() {}, retainedEstimateParams: () => new URLSearchParams(),
    isHandoffKind: () => false, buildLeadNotes: () => '',
    localStorage: { getItem: () => null }, sessionStorage: { getItem: () => null },
    FormData: class { set() {} },
    fetch: () => new Promise(resolve => pending.push(resolve)),
  };
  let code = kind === 'estimate' ? read('src/components/EstimateForm.astro').split('<script>')[1].split('</script>')[0] : read('src/scripts/ask-callback.ts');
  code = code.replace(/^import[\s\S]*?;\s*/gm, '');
  vm.runInNewContext(stripTypeScriptTypes(code), context);
  return { form, window, pending, submit: () => form.listeners.submit({ preventDefault() {} }) };
}
const response = (accepted, ok = true) => ({ ok, headers: new Headers(accepted ? { 'x-clearview-lead-accepted': '1' } : {}), json: async () => ({ ok }) });
for (const kind of ['estimate', 'callback']) {
  const h = harness(kind);
  const first = h.submit();
  await h.submit();
  assert.equal(h.pending.length, 1, `${kind}: overlapping submit sends one request`);
  h.pending[0](response(true)); await first; await h.submit();
  assert.equal(h.pending.length, 1, `${kind}: completed form cannot resubmit`);
  assert.equal(h.window.dataLayer.filter(e => e.event === 'generate_lead').length, 1);
  assert.equal(h.window.dataLayer[0].method, kind === 'estimate' ? 'estimate_form_js' : 'ask_callback');
  const trap = harness(kind), trapSubmit = trap.submit();
  trap.pending[0](response(false)); await trapSubmit;
  assert.equal(trap.window.dataLayer.length, 0, `${kind}: honeypot/legacy success is not a conversion`);
  const retry = harness(kind), failed = retry.submit();
  retry.pending[0](response(false, false)); await failed;
  assert.equal(retry.window.dataLayer.length, 0, `${kind}: failure is not a conversion`);
  const second = retry.submit(); retry.pending[1](response(true)); await second;
  assert.equal(retry.window.dataLayer.length, 1, `${kind}: a successful retry counts once`);
}
console.log('PASS: production hostname isolation, confirmation-page exclusion, both form acceptance markers, concurrent-submit guards and retry conversions.');
