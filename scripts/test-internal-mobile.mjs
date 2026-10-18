// Phone-usability floor for the Command Center, found by the 2026-10-03 audit (390 px and 360 px, touch emulation,
// every internal page with seeded data). Static checks on the source so the fixes cannot quietly regress:
// - form controls are at least 16 px on touch screens (iOS Safari zooms in on focus below that and never zooms back)
// - tap-to-call / tap-to-mail links and the header brand link have a thumb-sized hit area
// - the build-plan list editor labels every input (screen readers, and a visible name for assistive tools)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, 'utf8').replace(/\r\n/g, '\n');
const css = read('src/styles/global.css');

const block = css.match(/@media \(pointer: coarse\) \{([\s\S]*?)\n\}\n/);
assert.ok(block, 'global.css has the touch-screen block for the Command Center');
const rules = block[1];
assert.match(rules, /body\.internal\.internal input:not\(\[type="checkbox"\]\)[^{]*,\s*body\.internal\.internal select,\s*body\.internal\.internal textarea \{\s*font-size: max\(16px, 1em\) !important;/, 'inputs, selects and textareas are at least 16px on touch');
assert.match(rules, /body\.internal\.internal input\[type="checkbox"\],\s*body\.internal\.internal input\[type="radio"\] \{\s*width: 1\.35rem;\s*height: 1\.35rem;/, 'check boxes and radios have a visible size');
assert.match(rules, /a\[href\^="tel:"\],\s*body\.internal\.internal a\[href\^="mailto:"\] \{[^}]*padding-block: 0\.65rem;[^}]*margin-block: -0\.65rem;/, 'tap-to-call and tap-to-mail links have a thumb-sized hit area that does not move the text');

const layout = read('src/layouts/InternalLayout.astro');
assert.match(layout, /\.internal-brand\{display:inline-flex;align-items:center;min-height:44px;/, 'the header brand link is 44px tall');
assert.match(layout, /class:list=\{\['internal', \{ 'field-mode': isFieldMode \}\]\}/, 'body.internal is what the touch rules key on');

const plan = read('src/pages/internal/quotes/build-plan.astro');
assert.match(plan, /<input value="\$\{esc\(v\)\}"[^>]*aria-label="\$\{esc\(listName\(key\)\)\} \$\{i\+1\}"/, 'every build-plan list input has a name');
assert.match(plan, /aria-label="Remove \$\{esc\(listName\(key\)\)\} \$\{i\+1\}"/, 'every remove button says which item it removes');

// Long unbroken text must not push a Command Center page sideways. Found 2026-10-12 by running every internal page
// against seeded data (a long email, a pasted link or a long note with no spaces): 22 of 58 page views scrolled
// sideways, the leads list by 11,000 px, because `overflow-wrap: break-word` does not lower a grid or flex item's
// minimum width, so one long word set the width of the whole card.
//   - `.internal-main` breaks long words (`overflow-wrap: anywhere`, which does lower that minimum);
//   - controls are put back to normal wrapping, or the same rule crushes them (a first attempt without this turned
//     the job page's "Field mode" and "Closeout" buttons into one-letter-wide columns and the /jobs filter tabs
//     into tall slivers). The reset is inside :global() so it reaches page content, not just the layout's own markup.
const internalLayout = read('src/layouts/InternalLayout.astro');
assert.match(internalLayout, /\.internal-main\{[^}]*overflow-wrap:anywhere\}/, 'the Command Center content area breaks long unbroken text');
const reset = internalLayout.match(/\.internal-main :global\(:is\(([^)]*(?:\([^)]*\)[^)]*)*)\)\)\{overflow-wrap:normal\}/);
assert.ok(reset, 'controls are reset to normal wrapping through :global()');
for (const control of ['button', 'select', 'th', '[role=tab]', '.btn']) assert.ok(reset[1].includes(control), `the reset covers ${control}`);
assert.match(read('src/pages/internal/leads.astro'), /\.ld-list \{ display:grid; grid-template-columns:minmax\(0, 1fr\);/, 'the leads list track may shrink');
assert.match(read('src/pages/internal/leads/analyze.astro'), /\.la-list\{display:grid;grid-template-columns:minmax\(0,1fr\)/, 'the lead analyzer list track may shrink');

// The same rule has a cost: a flex row's short label, badge or price may then shrink to one letter per line.
// Found 2026-10-18 by the audit's "squeezed text" check: Jobs ("active jobs" printed vertically), Payments (the
// balance beside a long customer name), the job and prep pages (a line price beside a long label) and Field (the
// "FIELD VERIFY" badge). Each of these keeps its width and the long label beside it wraps instead.
assert.match(read('src/pages/internal/jobs/index.astro'), /\.queue-summary\{flex:none\}\.queue-summary span\{white-space:nowrap;overflow-wrap:normal\}/, 'the jobs active count never breaks');
assert.match(read('src/pages/internal/payments.astro'), /:global\(\.balance-block\)\{flex:none\}:global\(\.balance-block span\),:global\(\.balance-block strong\)\{white-space:nowrap;overflow-wrap:normal\}/, 'the payments balance never breaks');
assert.match(read('src/pages/internal/jobs/field.astro'), /\.verify-badge\{flex:none;white-space:nowrap;overflow-wrap:normal\}/, 'the Field verify badge never breaks');
assert.match(read('src/pages/internal/jobs/prepare.astro'), /\.material-row\)>:global\(strong:last-child\)\{flex:none;white-space:nowrap/, 'the prep line price never breaks');
assert.match(read('src/pages/internal/jobs/view.astro'), /\.scope-row\)>:global\(strong:last-child\)\{flex:none;white-space:nowrap/, 'the job line price never breaks');
// First screen on a phone: long explanations in banners give way to the work (class phone-hide).
assert.match(internalLayout, /\.internal-main :global\(\.phone-hide\)\{display:none!important\}/, 'phone-hide hides a long explanation on a phone');
for (const page of ['src/pages/internal/quotes/index.astro', 'src/pages/internal/jobs/index.astro', 'src/pages/internal/today.astro']) assert.match(read(page), /class="[^"]*phone-hide/, `${page} hides its banner paragraph on a phone`);

// The quote builder on a phone: the running total and the save button stay on screen while lines are edited
// (2026-10-18). Phone only; the laptop layout is unchanged.
const quoteNew = read('src/pages/internal/quotes/new.astro');
assert.match(quoteNew, /<div class="qb-dock" data-dock hidden>/, 'the quote builder has a total dock');
assert.match(quoteNew, /data-dock-save>/, 'the dock has a save button');
assert.match(quoteNew, /form\.querySelector\('\[data-dock-save\]'\)\?\.addEventListener\('click', \(\) => form\.requestSubmit\(\)\)/, 'the dock saves through the form (validation still runs)');
assert.match(quoteNew, /if \(dock instanceof HTMLElement\) dock\.hidden = items\.length === 0;/, 'the dock shows only once a line exists');
assert.match(quoteNew, /\.qb-dock \{ display: none; \}\s*@media \(max-width: 680px\) \{\s*\.qb-dock \{[^}]*position: sticky; bottom: calc\(4\.6rem/, 'the dock is phone-only and sits above the bottom navigation');

// Payments: after Save the list is rebuilt, which used to collapse the editor and reset its line to "Ready", so
// nothing said the payment had been recorded (found 2026-10-18 by the audit's flows pass). The saved card now stays open
// and reads "Saved 7:59 PM".
const payments = read('src/pages/internal/payments.astro');
assert.match(payments, /<details class="payment-editor"\$\{justSaved===j\.id\?' open':''\}>/, 'the just-saved payment editor stays open');
assert.match(payments, /data-status-text>\$\{justSaved===j\.id\?'Saved '\+savedAt:'Ready'\}</, 'the just-saved payment says Saved with the time');
assert.match(payments, /job\.notes=d\.payment\.notes;justSaved=job\.id;savedAt=/, 'a successful save marks the job as just saved');

// Duplicate numbers: on Today and Follow-up the dark status card already shows overdue, due today and open, then a
// grid of cards repeated the same figures and pushed the actual list below the fold (first task at about 1000 px on a
// phone, now about 585 px). The repeats are hidden on a phone only.
assert.match(read('src/pages/internal/follow-up.astro'), /<section class="stats phone-hide" aria-label="Follow-up summary">/, 'Follow-up hides its repeated stats on a phone');
assert.match(read('src/pages/internal/today.astro'), /<section class="summary-grid phone-hide" aria-label="Today's workload">/, 'Today hides its repeated summary cards on a phone');

// Pages looked at on a phone for the first time on 2026-10-18 (Analytics, Schedule, Invoices):
//   - Analytics figures stay two to a row (they were one per row, five cards deep), the big number steps down so a
//     six-figure amount fits half a screen, an odd last card spans the row, and "Last 90 days" sits under its title;
//   - Schedule: a day with nothing booked is one line ("Mon, Oct 12  No installation scheduled"), not a card (seven of
//     them filled three screens), and its two header buttons share the row;
//   - Invoices: the dark banner's explanation is hidden on a phone, as on Quotes.
const analytics = read('src/pages/internal/analytics.astro');
assert.match(analytics, /@media\(max-width:420px\)\{\.an-stat\{padding:\.8rem\}\.an-stat strong\{font-size:var\(--step-2\);overflow-wrap:normal\}\.an-head\{flex-direction:column/, 'analytics stat cards compact on a phone');
assert.match(analytics, /@media\(max-width:339px\)\{\.an-stats\{grid-template-columns:1fr\}\}/, 'analytics goes to one column only below 340 px');
assert.match(analytics, /\.an-stats>\.an-stat:last-child:nth-child\(odd\)\{grid-column:1\/-1\}/, 'an odd last analytics card spans the row');
const schedule = read('src/pages/internal/schedule.astro');
assert.match(schedule, /:global\(\.day:has\(\.none\)\)\{display:flex;justify-content:space-between/, 'an empty schedule day is one line on a phone');
assert.match(schedule, /\.actions \.btn:last-child:nth-child\(odd\)\{grid-column:1\/-1\}/, 'schedule header buttons share the row');
assert.match(read('src/pages/internal/invoices/index.astro'), /<p class="phone-hide">Draft invoices can be prepared/, 'Invoices hides its banner explanation on a phone');

// Seen on a phone on 2026-10-18 (job, quote and Copilot screens): the job screen's six jump buttons shared one row at
// about 50 px each with labels wrapping in half (now three by two); the quote document's number printed one fragment
// per line and its email broke mid-word (the header stacks on a phone, the number never breaks); Copilot's own
// padding doubled the page margins.
assert.match(read('src/pages/internal/jobs/view.astro'), /@media\(max-width:720px\)\{\.head-actions\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/, 'the job jump buttons are three by two on a phone');
const quoteView = read('src/pages/internal/quotes/view.astro');
assert.match(quoteView, /\.contract-meta \[data-quote-id\]\{white-space:nowrap;overflow-wrap:normal\}/, 'the quote number never breaks');
assert.match(quoteView, /@media\(max-width:560px\)\{:global\(\.contract-head\)\{flex-direction:column/, 'the quote header stacks on a phone');
assert.match(read('src/pages/internal/copilot.astro'), /@media\(max-width:680px\)\{\.copilot-shell\{padding:\.25rem 0 1rem\}\}/, 'Copilot does not double the page margins on a phone');

console.log('internal mobile: ok');
