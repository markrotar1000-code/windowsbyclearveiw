// "Where is this customer on the way from quote to paid?" One place that knows the path, for the stepper and the
// single "Next" button on every quote and job page.
//
// A window quote goes: quote -> Build Plan -> approved -> signed -> job -> scheduled -> installing -> closed -> paid.
// A siding quote has no Build Plan (it is approved by its signature). A general job has no quote at all. Which step a
// customer is on is read from the records that already exist (quote, build plan, job, payments); nothing here is
// stored, so it can never disagree with them. Deterministic code only: no AI decides what Mark does next.

import { sourceSnapshot, sameSource } from '../../_lib/build-plan-rules.mjs';
import { workTypeOf } from './work-types.mjs';

const STEPS = {
  windows: [['quote', 'Quote'], ['plan', 'Build plan'], ['approved', 'Approved'], ['signed', 'Signed'], ['job', 'Job'], ['scheduled', 'Scheduled'], ['field', 'Installing'], ['closed', 'Closed'], ['paid', 'Paid']],
  siding: [['quote', 'Quote'], ['signed', 'Signed'], ['job', 'Job'], ['scheduled', 'Scheduled'], ['closed', 'Complete'], ['paid', 'Paid']],
  general: [['job', 'Job'], ['scheduled', 'Scheduled'], ['closed', 'Complete'], ['paid', 'Paid']],
};

const dollars = (cents) => `$${(Math.round(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
const q = encodeURIComponent;

/** Pacific calendar date as YYYY-MM-DD (the business runs on Pacific time). */
export const pacificDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/**
 * facts: { kind, quote: {id,status,signatureMethod}|null, plan: {exists,state,stale}|null,
 *          job: {id,status,scheduledDate}|null, money: {totalCents,paidCents}|null }
 * Returns { kind, quoteId, jobId, steps: [{key,label,state}], next: {key,label,hint,href?,action?,also?}|null, note }.
 */
export function computeFlow(facts, today = pacificDate()) {
  const kind = STEPS[facts.kind] ? facts.kind : 'windows';
  const { quote = null, plan = null, job = null, money = null } = facts;
  const cancelled = job?.status === 'cancelled';
  const finalized = quote?.status === 'finalized';
  const planCurrent = Boolean(plan?.exists) && !plan?.stale;
  const owed = money && money.totalCents > 0 ? Math.max(0, money.totalCents - money.paidCents) : 0;

  const done = {
    quote: Boolean(quote),
    plan: finalized || planCurrent,
    approved: finalized || (planCurrent && plan.state === 'approved'),
    signed: finalized,
    job: Boolean(job),
    scheduled: Boolean(job) && !cancelled && (Boolean(job.scheduledDate) || ['scheduled', 'in-progress', 'completed'].includes(job.status)),
    field: Boolean(job) && ['in-progress', 'completed'].includes(job.status),
    closed: Boolean(job) && job.status === 'completed',
    paid: Boolean(job) && job.status === 'completed' && Boolean(money) && money.totalCents > 0 && owed === 0,
  };

  const list = STEPS[kind];
  const currentIndex = list.findIndex(([key]) => !done[key]);
  const steps = list.map(([key, label], i) => ({ key, label, state: currentIndex === -1 || i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo' }));
  const base = { kind, quoteId: quote?.id || null, jobId: job?.id || null, steps };
  if (cancelled) return { ...base, steps: steps.map((s) => (s.state === 'current' ? { ...s, state: 'todo' } : s)), next: null, note: 'This job is cancelled.' };
  if (currentIndex === -1) return { ...base, next: null, note: 'Paid in full. Nothing left to do.' };

  const key = list[currentIndex][0];
  const quoteView = quote ? `/internal/quotes/view?id=${q(quote.id)}` : '';
  const jobView = job ? `/internal/jobs/view?id=${q(job.id)}` : '';
  let next = null;
  if (key === 'plan') {
    next = plan?.exists
      ? { key, label: 'Save the Build Plan again', hint: 'The quote changed after its Build Plan was saved. Save the plan again, then approve it.', href: `/internal/quotes/build-plan?quoteId=${q(quote.id)}` }
      : { key, label: 'Build the Build Plan', hint: 'A window quote has to have an approved Build Plan before it can be signed.', href: `/internal/quotes/build-plan?quoteId=${q(quote.id)}` };
  } else if (key === 'approved') {
    next = { key, label: 'Review and approve the plan', hint: 'Read it through, then approve it. This is the step a person has to do.', href: `/internal/quotes/build-plan-approval?quoteId=${q(quote.id)}` };
  } else if (key === 'signed') {
    const pen = quote.signatureMethod !== 'digital';
    next = { key, label: 'Sign the quote', hint: kind === 'windows' ? (pen ? 'Plan approved. Print the quote, get it signed in pen, then confirm it is signed.' : 'Plan approved. Have the customer sign it on screen.') : (pen ? 'Check the price, print it, get it signed in pen, then confirm it is signed.' : 'Check the price, then have the customer sign it on screen.'), href: quoteView };
  } else if (key === 'job') {
    next = { key, label: 'Create the job', hint: 'The quote is signed. Make it a job so it can be scheduled.', action: 'create-job', quoteId: quote.id };
  } else if (key === 'scheduled') {
    next = { key, label: 'Schedule the install', hint: 'Pick the install date and window.', href: jobView };
  } else if (key === 'field' || (key === 'closed' && kind === 'windows')) {
    const future = job.scheduledDate && job.scheduledDate > today;
    if (key === 'field' && future) next = { key, label: 'Prepare for the install', hint: `Install is ${job.scheduledDate}. Check the materials and the handoffs.`, href: `/internal/jobs/prepare?id=${q(job.id)}` };
    else next = { key, label: key === 'field' ? 'Open field mode' : 'Continue in field mode', hint: key === 'field' ? 'Work one opening at a time.' : 'Finish the openings, then close the job out.', href: `/internal/jobs/field?id=${q(job.id)}`, also: [{ label: 'Closeout', href: `/internal/jobs/closeout?id=${q(job.id)}` }] };
  } else if (key === 'closed') {
    next = { key, label: 'Mark the job complete', hint: 'Set the status to Completed when the work is done.', href: jobView };
  } else if (key === 'paid') {
    next = { key, label: 'Record the payment', hint: owed > 0 ? `${dollars(owed)} is still due.` : 'Enter what has been paid.', href: '/internal/payments' };
  }
  return { ...base, next, note: '' };
}

async function tryAll(statement) { try { return (await statement.all()).results || []; } catch { return []; } }
async function tryFirst(statement) { try { return (await statement.first()) || null; } catch { return null; } }

/** Reads the facts for one quote (by quoteId) or one job (by jobId). Returns null when there is no such record. */
export async function readFlow(db, { quoteId = '', jobId = '' } = {}, now = new Date()) {
  let job = null;
  let quote = null;
  if (jobId) {
    job = await tryFirst(db.prepare('SELECT id, quote_id, status, scheduled_date, work_type FROM jobs WHERE id = ?').bind(jobId));
    if (!job) return null;
    if (job.quote_id) quote = await tryFirst(db.prepare('SELECT id, status, signature_method, work_type, total_cents FROM quotes WHERE id = ?').bind(job.quote_id));
  } else if (quoteId) {
    quote = await tryFirst(db.prepare('SELECT id, status, signature_method, work_type, total_cents FROM quotes WHERE id = ?').bind(quoteId));
    if (!quote) return null;
    job = await tryFirst(db.prepare('SELECT id, quote_id, status, scheduled_date, work_type FROM jobs WHERE quote_id = ?').bind(quote.id));
  } else {
    return null;
  }

  const kind = quote ? workTypeOf(quote) : (job?.work_type === 'siding' ? 'siding' : 'general');
  let plan = null;
  if (quote && kind === 'windows') {
    const row = await tryFirst(db.prepare('SELECT state, source_json, plan_json FROM quote_build_plans WHERE quote_id = ?').bind(quote.id));
    if (row) {
      let saved = [];
      try { saved = row.source_json ? JSON.parse(row.source_json) : (JSON.parse(row.plan_json || '{}').sourceItems || []); } catch { saved = []; }
      const items = await tryAll(db.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order ASC, id ASC').bind(quote.id));
      plan = { exists: true, state: row.state || 'draft', stale: !sameSource(saved, sourceSnapshot(items)) };
    }
  }

  let money = null;
  if (job) {
    const pay = await tryFirst(db.prepare('SELECT amount_paid_cents FROM job_payments WHERE job_id = ?').bind(job.id));
    const agreed = job.quote_id ? quote?.total_cents : (await tryFirst(db.prepare('SELECT agreed_cents FROM jobs WHERE id = ?').bind(job.id)))?.agreed_cents;
    money = { totalCents: Number(agreed) || 0, paidCents: Number(pay?.amount_paid_cents) || 0 };
  }

  return computeFlow({
    kind,
    quote: quote ? { id: quote.id, status: quote.status, signatureMethod: quote.signature_method } : null,
    plan,
    job: job ? { id: job.id, status: job.status, scheduledDate: job.scheduled_date || '' } : null,
    money,
  }, pacificDate(now));
}
