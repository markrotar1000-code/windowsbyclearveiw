// The Text and Directions links in the Command Center: what they build, and where they are wired in.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { tenDigits, smsUrl, directionsUrl } = await import(new URL('../src/lib/contact-links.ts', import.meta.url).href);
const pass = (m) => console.log(`PASS: ${m}`);

for (const raw of ['(360) 555-0100', '360-555-0100', '3605550100', '1-360-555-0100', '+1 360 555 0100', ' 360.555.0100 ']) assert.equal(tenDigits(raw), '3605550100', raw);
for (const raw of ['', null, undefined, '555-0100', '0605550100', '1605550100', '36055501001', 'call me']) assert.equal(tenDigits(raw), '', String(raw));
assert.equal(smsUrl('(360) 555-0100'), 'sms:+13605550100');
assert.equal(smsUrl('555-0100'), '', 'a number that is not a number gives no link');
pass('phone numbers in any format become one sms: link, and junk gives none');

assert.equal(directionsUrl('1 Main St', 'Camas'), 'https://www.google.com/maps/dir/?api=1&destination=1%20Main%20St%2C%20Camas');
assert.equal(directionsUrl('  1   Main St ', ''), 'https://www.google.com/maps/dir/?api=1&destination=1%20Main%20St');
assert.equal(directionsUrl('', 'Camas'), '', 'a city alone is not somewhere to drive to');
assert.equal(directionsUrl(null, null), '');
const tricky = directionsUrl('5 Elm & Oak #2', 'Washougal');
assert.ok(tricky.includes('5%20Elm%20%26%20Oak%20%232%2C%20Washougal') && !/[&#]\w*\s/.test(tricky.split('destination=')[1]), '& and # in an address are encoded, not read as URL parts');
assert.ok(directionsUrl('x'.repeat(900), 'y').length < 400, 'a very long address is capped');
assert.ok(directionsUrl('javascript:alert(1)', 'x').startsWith('https://www.google.com/maps/'), 'the link always points at Google Maps');
pass('directions links need a street address, encode it, and always point at Google Maps');

// Wiring: the links exist where Mark is already looking at the number or the address.
const jobView = read('src/pages/internal/jobs/view.astro');
assert.ok(/data-directions/.test(jobView) && /directionsUrl\(/.test(jobView), 'the job page has Directions');
assert.ok(/data-text-link/.test(jobView) && /smsUrl\(/.test(jobView), 'the job page has Text');
assert.ok(/data-directions/.test(read('src/pages/internal/jobs/field.astro')), 'Field mode has Directions');
for (const page of ['leads', 'today', 'follow-up']) assert.ok(/smsUrl\(/.test(read(`src/pages/internal/${page}.astro`)), `${page} has Text next to Call`);
pass('Text and Directions are on the job page, Field mode, Leads, Today and Follow-up');
console.log('Contact links checks passed.');
