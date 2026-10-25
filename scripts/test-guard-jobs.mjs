// Write guards on the job, payment, task, checklist, closeout, evidence, review-request and mail-test handlers:
// cross-origin writes are refused (403), oversized bodies (413) and invalid JSON (400) never reach the
// database or the mail provider, unsupported methods get a JSON 405, and a valid request still works.
// Real SQLite through the real handlers; the mail provider is a stub, no network and no email.
import assert from 'node:assert/strict';
import { createD1 } from './_lib/d1-sqlite.mjs';
import * as jobsApi from '../functions/internal/api/jobs.js';
import * as paymentsApi from '../functions/internal/api/payments.js';
import * as tasksApi from '../functions/internal/api/tasks.js';
import * as checklistApi from '../functions/internal/api/job-checklist.js';
import * as closeoutApi from '../functions/internal/api/job-closeout.js';
import * as evidenceApi from '../functions/internal/api/job-evidence.js';
import * as reviewApi from '../functions/internal/api/review-request.js';
import * as mailTestApi from '../functions/internal/api/mail-test.js';

const pass = (message) => console.log(`PASS: ${message}`);
const ORIGIN = 'https://x.test';

// The only outbound call these handlers make is to the mail provider; record it and answer for it.
const mailCalls = [];
globalThis.fetch = async (url, init = {}) => {
  mailCalls.push({ url: String(url), method: init.method || 'GET' });
  return new Response(JSON.stringify({ id: 'stub-message-id', data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const env = {
  QUOTES_DB: createD1({ schemaFiles: ['functions/api/_data/schema.sql', 'internal/db/schema.sql'] }),
  RESEND_API_KEY: 'stub-key',
};

async function send(handler, { method = 'POST', path, body, headers = {}, raw } = {}) {
  const payload = raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body);
  const request = new Request(`${ORIGIN}${path}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: payload });
  const response = await handler({ request, env, params: {}, waitUntil() {} });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

// Seed one general job (valid POST through the guard) to give the other handlers something to act on.
const created = await send(jobsApi.onRequestPost, { path: '/internal/api/jobs', body: { workType: 'general', customerName: 'Pat Rivera', customerPhone: '(360) 555-0123', customerEmail: 'pat@example.com', workDescription: 'Deck rebuild', agreedAmount: '4,800' } });
assert.equal(created.status, 201, JSON.stringify(created.body));
const jobId = created.body.job?.id || created.body.id;
assert.ok(jobId, 'job id returned');
pass('valid POST /jobs still creates a job');

const jobCount = async () => (await env.QUOTES_DB.prepare('SELECT COUNT(*) AS n FROM jobs').first()).n;
const big = (bytes) => JSON.stringify({ notes: 'x'.repeat(bytes) });
const BIG = 70 * 1024; // above the 64 KB default
const BIG_MAIL = 10 * 1024; // above the 8 KB mail cap

const writers = [
  ['jobs POST', jobsApi.onRequestPost, '/internal/api/jobs', 'POST', BIG],
  ['jobs PATCH', jobsApi.onRequestPatch, `/internal/api/jobs?id=${jobId}`, 'PATCH', BIG],
  ['payments PATCH', paymentsApi.onRequestPatch, `/internal/api/payments?jobId=${jobId}`, 'PATCH', BIG],
  ['tasks POST', tasksApi.onRequestPost, '/internal/api/tasks', 'POST', BIG],
  ['tasks PATCH', tasksApi.onRequestPatch, '/internal/api/tasks?id=1', 'PATCH', BIG],
  ['job-checklist PATCH', checklistApi.onRequestPatch, '/internal/api/job-checklist?id=1', 'PATCH', BIG],
  ['job-closeout PATCH', closeoutApi.onRequestPatch, `/internal/api/job-closeout?jobId=${jobId}`, 'PATCH', BIG],
  ['job-evidence PATCH', evidenceApi.onRequestPatch, `/internal/api/job-evidence?jobId=${jobId}`, 'PATCH', BIG],
  ['review-request POST', reviewApi.onRequestPost, '/internal/api/review-request', 'POST', BIG_MAIL],
];

for (const [name, handler, path, method, size] of writers) {
  const before = { jobs: await jobCount(), mail: mailCalls.length };

  const cross = await send(handler, { method, path, body: { notes: 'hi' }, headers: { Origin: 'https://evil.test' } });
  assert.equal(cross.status, 403, `${name}: cross-origin refused`);
  const fetchSite = await send(handler, { method, path, body: { notes: 'hi' }, headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(fetchSite.status, 403, `${name}: Sec-Fetch-Site cross-site refused`);

  const declared = await send(handler, { method, path, raw: big(size), headers: { 'content-length': String(size + 20) } });
  assert.equal(declared.status, 413, `${name}: oversized body refused (${JSON.stringify(declared.body)})`);
  const streamed = await send(handler, { method, path, raw: big(size) });
  assert.equal(streamed.status, 413, `${name}: oversized body refused without a declared length`);

  const bad = await send(handler, { method, path, raw: '{not json' });
  assert.equal(bad.status, 400, `${name}: invalid JSON refused`);
  assert.equal(bad.body.error, 'Invalid JSON.');

  for (const odd of ['null', '5', '[]']) {
    const nonObject = await send(handler, { method, path, raw: odd });
    assert.equal(nonObject.status, 400, `${name}: a ${odd} body is a 400, not a crash`);
  }

  assert.equal(await jobCount(), before.jobs, `${name}: nothing was written by refused requests`);
  assert.equal(mailCalls.length, before.mail, `${name}: no mail provider call from refused requests`);
  pass(`${name}: 403 cross-origin, 413 oversized, 400 invalid JSON`);
}

// The review/mail cap is tighter than the default: a 10 KB body is fine for a normal handler, refused here.
{
  const mid = await send(tasksApi.onRequestPost, { path: '/internal/api/tasks', body: { title: 'Call Pat back', notes: 'x'.repeat(BIG_MAIL) } });
  assert.notEqual(mid.status, 413, 'a 10 KB body is within the default cap');
  const tight = await send(reviewApi.onRequestPost, { path: '/internal/api/review-request', raw: big(BIG_MAIL) });
  assert.equal(tight.status, 413, 'review-request cap is 8 KB');
  pass('review-request uses a tighter cap than the default');
}

// Unsupported methods: JSON 405 with an allow header.
const handlers = [
  ['jobs', jobsApi, ['GET', 'POST', 'PATCH']],
  ['payments', paymentsApi, ['GET', 'PATCH']],
  ['tasks', tasksApi, ['GET', 'POST', 'PATCH']],
  ['job-checklist', checklistApi, ['GET', 'PATCH']],
  ['job-closeout', closeoutApi, ['GET', 'PATCH']],
  ['job-evidence', evidenceApi, ['GET', 'PATCH']],
  ['review-request', reviewApi, ['GET', 'POST']],
  ['mail-test', mailTestApi, ['GET', 'POST']],
];
for (const [name, mod, allowed] of handlers) {
  assert.equal(typeof mod.onRequest, 'function', `${name}: catch-all handler exported`);
  const res = await send(mod.onRequest, { method: 'DELETE', path: `/internal/api/${name}` });
  assert.equal(res.status, 405, `${name}: DELETE gets 405`);
  assert.equal(res.headers.get('allow'), allowed.join(', '), `${name}: allow header lists the supported methods`);
  assert.match(res.headers.get('content-type'), /application\/json/);
}
pass('every handler answers an unsupported method with a JSON 405 and an allow header');

// mail-test takes no body: origin and a size cap only, an empty POST is the normal call.
{
  const before = mailCalls.length;
  const cross = await send(mailTestApi.onRequestPost, { path: '/internal/api/mail-test', headers: { Origin: 'https://evil.test' } });
  assert.equal(cross.status, 403);
  const large = await send(mailTestApi.onRequestPost, { path: '/internal/api/mail-test', raw: big(BIG_MAIL), headers: { 'content-length': String(BIG_MAIL + 20) } });
  assert.equal(large.status, 413);
  assert.equal(mailCalls.length, before, 'refused mail-test sends nothing');
  const ok = await send(mailTestApi.onRequestPost, { path: '/internal/api/mail-test', headers: { 'content-type': 'text/plain' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.ok, true);
  assert.equal(mailCalls.length, before + 1, 'valid mail-test makes exactly one (stubbed) provider call');
  pass('mail-test: 403 cross-origin, 413 oversized, bodiless valid POST works');
}

// One valid request per handler, unchanged response shapes.
{
  const task = await send(tasksApi.onRequestPost, { path: '/internal/api/tasks', body: { title: 'Call Pat back' } });
  assert.equal(task.status, 201, JSON.stringify(task.body));
  const taskId = task.body.id;
  assert.ok(taskId, 'task created');
  const patchedTask = await send(tasksApi.onRequestPatch, { method: 'PATCH', path: `/internal/api/tasks?id=${taskId}`, body: { notes: 'left voicemail' } });
  assert.equal(patchedTask.status, 200, JSON.stringify(patchedTask.body));
  pass('valid tasks POST and PATCH');

  const jobPatch = await send(jobsApi.onRequestPatch, { method: 'PATCH', path: `/internal/api/jobs?id=${jobId}`, body: { notes: 'gate code on file' } });
  assert.equal(jobPatch.status, 200, JSON.stringify(jobPatch.body));
  pass('valid jobs PATCH');

  const pay = await send(paymentsApi.onRequestPatch, { method: 'PATCH', path: `/internal/api/payments?jobId=${jobId}`, body: { amountPaidCents: 10000, paymentMethod: 'check' } });
  assert.equal(pay.status, 200, JSON.stringify(pay.body));
  assert.equal(pay.body.ok, true);
  pass('valid payments PATCH');

  const list = await send(checklistApi.onRequestGet, { method: 'GET', path: `/internal/api/job-checklist?jobId=${jobId}` });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const item = list.body.items[0];
  const check = await send(checklistApi.onRequestPatch, { method: 'PATCH', path: `/internal/api/job-checklist?id=${item.id}`, body: { checked: true, notes: 'done' } });
  assert.equal(check.status, 200, JSON.stringify(check.body));
  assert.equal(check.body.item.checked, 1);
  pass('valid job-checklist PATCH');

  const evidence = await send(evidenceApi.onRequestPatch, { method: 'PATCH', path: `/internal/api/job-evidence?jobId=${jobId}`, body: { openingIndex: 0, notes: 'north wall' } });
  assert.equal(evidence.status, 200, JSON.stringify(evidence.body));
  assert.equal(evidence.body.ok, true);
  pass('valid job-evidence PATCH');

  const closeout = await send(closeoutApi.onRequestPatch, { method: 'PATCH', path: `/internal/api/job-closeout?jobId=${jobId}`, body: { signoffName: 'Pat Rivera', walkthroughConfirmed: true } });
  assert.equal(closeout.status, 200, JSON.stringify(closeout.body));
  assert.equal(closeout.body.ok, true);
  pass('valid job-closeout PATCH');

  // Review request: needs a finalized closeout, then goes out by email through the stub.
  await env.QUOTES_DB.prepare('UPDATE job_closeouts SET finalized_at = ? WHERE job_id = ?').bind(new Date().toISOString(), jobId).run();
  const before = mailCalls.length;
  const review = await send(reviewApi.onRequestPost, { path: '/internal/api/review-request', body: { jobId, channel: 'email' } });
  assert.equal(review.status, 200, JSON.stringify(review.body));
  assert.equal(review.body.channel, 'email');
  assert.equal(mailCalls.length, before + 1, 'valid review request makes exactly one (stubbed) provider call');
  assert.ok(mailCalls.at(-1).url.startsWith('https://api.resend.com/'), 'the call went to the (stubbed) provider');
  pass('valid review-request POST');
}

console.log('guard-jobs: all checks passed');
