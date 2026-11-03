import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderContractTerms } from '../src/lib/render-contract-terms.mjs';
import { getContractTerms, TERMS_VERSION } from '../functions/internal/_lib/pdf-terms.mjs';

const fields = ['paymentTerms','changeOrders','warranty','delays','governingLaw','cancelHeading','cancel0','cancel1','cancel2','acknowledgement'];
const elements = fields.map(term => ({ dataset: { term }, textContent: '' }));
const root = { querySelectorAll: () => elements };
const warranty = () => elements.find(el => el.dataset.term === 'warranty').textContent;
assert.equal(renderContractTerms(root, getContractTerms('2026-08-28')), true);
assert.match(warranty(), /assist in facilitating/, 'archived agreement keeps the original promise');
assert.equal(renderContractTerms(root, getContractTerms(TERMS_VERSION)), true);
assert.doesNotMatch(warranty(), /will assist/, 'new agreement does not inherit archived assistance');
assert.equal(elements.find(el => el.dataset.term === 'cancel2').textContent, getContractTerms(TERMS_VERSION).rightToCancel.body[2]);
assert.equal(renderContractTerms(root, undefined), false, 'unknown terms are refused');
for (const file of ['src/pages/sign.astro','src/pages/internal/quotes/view.astro']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /getContractTerms\(quote\.terms(?:Version|_version) \?\? null\)/);
  assert.doesNotMatch(source, /\{contractTerms\./, 'no current terms are baked into old quotes');
  assert.match(source, /data-term="warranty"/);
}
console.log('Recorded contract terms rendering checks passed.');
