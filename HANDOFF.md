## 2026-10-24 — Marketing visual refresh

Public-only marketing stylesheet tightens section/CTA spacing, scales headings for phones, gives four service heroes a shared directional photo overlay and consistent estimate/call actions with original project-specific links retained. Header social SVG sizing is corrected across Astro component boundaries, social links are quieter and hidden on phones, and an estimate button is visible on menu-based desktop layouts with a large-text container fallback. Existing bottom phone actions remain. Home service cards and guide cards have consistent spacing; review/credential treatments are quieter. Existing replacement/siding/new-construction project sections move earlier; new construction shows its photos in a full-width row instead of a tall column beside short text. Public typography/header/grid changes do not apply to the internal layout. No new photos, facts, tracking or external dependencies; all service attribution parameters and builder handoff links remain. Validation and hosted/live verification in progress.

## 2026-10-24 — Simplify new-construction preparation copy

Reworded the screenshot-highlighted preparation section: Before we install the windows; direct instructions to have wall panels/house wrap in place and keep openings clear; plan siding/stucco after installing and checking the windows. Replaces protective-wrap/exterior-finishes/scheduled/walkthrough phrasing without changing the existing work sequence. Only this section was reviewed; no other copy, metadata, FAQs or guide index changed.

Validation: all 66 local test steps and separate 70-page build passed. PR294 merged as 295f02c after GitHub Build run 972 and Cloudflare Pages passed. Hosted preview 400d8193 and production fd819bcf were inspected in Chrome; the revised heading and both lines are live. Evidence: task outputs/new-con-preparation-live-2026-10-24.png.

## 2026-10-24 — Plain installation wording across the site

Replaced installation-related set/sets/setting wording in seven city pages, shared photo captions and alt text, homepage and About/Process copy, the estimate form, two guide frontmatter fields (one FAQ answer and one image description), and the internal field installation instruction. Uses install/installation to match Keith’s direction; no new business facts. Kept unrelated uses such as thermostat settings, plan sets, cookies and code identifiers. The guide body/title/description chunks consumed by build-guides-index are unchanged, so no embedding rebuild is needed. Reviewed the public source inventory for this wording only; this is not a full copy review of every page.

Validation: all 66 local test steps passed; final terminology/SEO checks and separate 70-page build passed. PR293 merged as 2ec2978 after GitHub Build run 969 and Cloudflare Pages both succeeded. Independent preview 844187c1 and production deployment baef5206 were inspected in Chrome. Production Vancouver body/FAQ, estimate form choice and new-construction image descriptions use the revised wording; the new-construction siding link and requested removals remain live. Production PWA health passed. No physical-device testing was performed.

## 2026-10-24 - Rough notes to draft quote lines (for the next agent)

What to know: voice needs the `AI` binding in the Pages dashboard (already set for Ask photos); without it the Record button reports "Voice is not connected yet" and typing or the phone keyboard microphone still work. Drafting needs `GROQ_API_KEY` or `GEMINI_API_KEY` (already used by Copilot). Limits: clips 45 s / 1.5 MB, 90 clips an hour, 30 drafts per 15 minutes, notes 4,000 characters. Open: a real-phone test (iOS Safari recording, noise), whether Mark wants his per-opening prices filled in the price book so drafts start closer (only the slider has one), and counsel's view on Washington's all-party recording consent. Details: `.ai/workflows/quote-dictation/CONTEXT.md`.


## 2026-10-24 — Separate permit research from Analytics

Supplier permit list and public Permit leads now live together at /internal/permits with a Permits navigation entry on desktop and in the phone More menu. Analytics no longer renders either list, includes the contact dialog, or requests either permit endpoint; requests-to-revenue, lead-source reporting and GA4 remain. The new page retains summary charts, explicit list loading, group filtering, spreadsheet download, builder connections and do-not-contact/call-log controls. Existing authenticated endpoints, D1 data and no-store boundaries are unchanged; no supplier data was loaded or copied into git. Expired permit fetches return to login with the Permits return path. Navigation and separation guards plus the relocated browser contact flow cover the move.

Rewrote the full new-construction page in plain language under the owner’s expanded request: hero explicitly includes siding with a /siding link, From plans to install retained, estimate instructions, preparation notes, job steps, site checklist, photo headings/captions and contact prompts simplified. Removed the three highlighted checklist lines and the full Clearview / Builder scope block, its data and unused styles. HowTo steps mirror the visible list; schema/meta descriptions use the revised language. Business details, photos, shared gallery captions, link destinations and builder form prefill remain. No new figures or timing promises.

Validation: all 66 test:all steps and separate 70-page build passed. Targeted reports browser audit passed 40 scenarios with zero problems (not the full Command Center audit). PR291 and PR292 merged; PR292 production deployment 520a6b53 serves the full rewrite, siding link and requested removals. Signed-in production Analytics made no permit requests; Permits navigation and sections were verified. Desktop and emulated phone checks passed; physical-device testing was not performed.

## 2026-10-23 - Live GA4 automatic scroll context repair

GTM-WGCFVHQM version 17 is Live (3:56:41 PM PDT). New setup-only Google Tag - SPA context update (55) sets update=true, send_page_view=false, and captured page_location/page_title/page_referrer DLVs before existing Google Analytics GA4 Event (4). Exactly two tags changed. Initial privacy/campaign flags, conversion gates and non-production blocking remain. No runtime source or Pages deployment change.

Live baseline reproduced stale homepage location on replacement scroll. Preview verified three setup/page-view executions across home -> replacement -> siding with no extra page views. Fresh non-debug production verified correct replacement and independently siding 90% scroll locations, titles and homepage referrers, HTTP 204; one page view per visited route. Initial production checks retained older behavior before a fresh uncached container load; temporary cache bypass was restored. GA4 property 552113896 Realtime scroll/page_location showed replacement (2); this QA window includes prior failing tests and is not a customer baseline. Historical attribution is not rewritten. test:analytics and test:ask-handoff (23 groups) passed.

Scope limit: enhanced scroll did not repeat on the next virtual route after already firing in the same document; this change repairs context and does not implement a custom per-route depth counter. Ahrefs tag 18 is Once per page; extra Meta-generated GA4 tags 32/33 stay paused. Google/Meta/Ahrefs cache estimates are vendor-controlled; first-party hashed assets already have one-year immutable caching. Gallery first six items use responsive WebP thumbnails with separate full-photo links, so original detail was retained. Remaining physical-device, field-CWV and full manual accessibility checks are unverified. Evidence/report: task outputs/clearview-scroll-context-repair-report-2026-10-23.md.

#Dependency follow-up: lockfile resolves Zod 4.6.7, patching GHSA-mrhx-c7xc-m3w5 (affected below 4.6.6). npm audit reports zero vulnerabilities; no claim of a demonstrated public-site exploit.

## 2026-10-23 - Verified mobile LCP and captured GTM page context

#289 and #290 are live (runtime code through 84f363f). Production mobile LCP fell from 8.0s to 2.3s in two post-fix PSI runs; performance 91 then 90, accessibility/best-practices/SEO 100. Final responsive image opportunity is 4KiB versus 156KiB. Both code batches passed all 66 local checks, separate builds, GitHub CI and hosted/production checks. #290 production deployment: 336f3560-8c52-4725-bdfb-bd2a34a84241.

GTM-WGCFVHQM version 16 is Live: Preserve captured page context for queued SPA views (3:30 PM PDT). Four new Version 2 DLVs map page_title/page_location/page_path/page_referrer; Google Analytics GA4 Event now uses these captured payload values instead of live browser variables. Exactly four variables and one tag changed from a clean workspace. Same events/triggers, consent and lead acceptance. Home -> replacement -> estimate emitted three correct page_view locations/titles/referrers, each HTTP 204; this is transport evidence, not GA4 processed attribution or a new conversion. JS - Safe Referrer remains for other tags; do not restore it as the page_view mapping.

Remaining: vendor JS/cache opportunities; enhanced-measurement scroll showed original entry URL with a later title during SPA navigation and needs separate context repair; earlier full-gallery warnings retain original detail. No physical phone, full manual accessibility certification, field-CWV or new accepted lead checked. Evidence report and sanitized request artifact are in the task outputs.

## 2026-10-23 - Responsive service tiles and logo sizes

#289 is live as a1782f9 (Cloudflare 1c298b44-63f5-423f-a8da-be23b95cdf96). Production mobile PSI at 3:17 PM measured 91 performance / LCP 2.3s / accessibility 100, versus 66 / 8.0s immediately before; GA4 page_view dispatch received HTTP 204. This is lab/transport evidence, not field-CWV or a verified lead receipt.

Home service image sizes now follow the actual 900px one-column breakpoint and max(frame width, frame height * source aspect ratio), with the 320-460px height clamp retained. This avoids the desktop crop multiplier on phones and fixes undersized images at 801-900px. Header/footer/kicker marks select 64/128/256px WebPs for their rendered sizes; new files are 2,582 / 6,786 bytes, originals retained. Browser checks at 390/850/1440px verify expected file selection and no overflow. Photo quality, framing and full-gallery downloads remain unchanged. Full suite and hosted/production checks accompany release.

## 2026-10-23 - Let the hero paint before marketing evaluation

Hosted builds exposed the concurrent Astro 7.4.0 update requiring Node >=22.22.0 while repo/CI still pinned 22.19.0. Raised .node-version, package engines and CI pins to 22.22.0 so the already-merged dependency can deploy; no runtime binding/security changes.

The unchanged #288 preview without the production GTM container measured mobile 98 / LCP 1.9s versus production 70 / 8.0s. Browser traces also show Google/Meta work competing during loading. The GTM bootstrap still initializes the same ordered dataLayer immediately, but waits for the hero load/error and two animation frames before inserting the asynchronous container. Pointer/keyboard interaction, pagehide and a 2s bound can start it earlier; all paths deduplicate and remove listeners. Other routes wait only for the initial frame boundaries. No tag, event, consent setting, conversion gate or hostname guard changes. Tests execute paint ordering, queued page/lead events, pending/failed image, fallback and interaction races. Actual production performance and GA dispatch require release verification; do not infer them from local tests.

 Project context — Clearview Windows

## 2026-10-23 - Homepage loading and estimate security recovery

Follow-up to #287 (merged 55b873b): production mobile accessibility is now 100, but its first repeat reported performance 71 / LCP 8.0s. Current follow-up adds an exact responsive head preload and synchronous hero decode, disables phone photo transitions, and replaces the shared 84KB PNG mark with a 20,866-byte WebP while preserving the source. The score remains a measurement question, not an assumed success.

Direct mobile Lighthouse baseline was 73 performance, 8.0s LCP and 4,752 KiB total, with 3,403.5 KiB across both hero formats. VideoHero now shows the responsive image immediately/high priority, removes the extra poster and delays no customer text. Phones <=640px and constrained/reduced-motion connections never assign a video source. Desktop keeps the original five-second reveal via one new 643,683-byte H.264 asset at 1280x720; original files remain. One binding per element prevents duplicate starts; navigation pauses the old clip. Removing the copy fade also keeps credentials readable immediately.

Estimate failures now offer a security-check retry without clearing entered values; widget success clears only the security warning. The real backend token/lead acceptance gates remain. Local Chrome verified zero phone video requests, one optimized desktop request and immediate text/photo opacity. New executable loading/recovery tests and the full suite guard this batch. Production performance and release checks are recorded separately; do not infer a delivered lead from widget recovery. Full-resolution gallery warnings and broader field-performance collection remain separate.

## 2026-10-22 - SPA page-view and referrer repair

Live GTM's JS - Safe Referrer read document.referrer for every event, so client-side navigation reused the original entry referrer. BaseLayout now sets clearviewPageReferrer to the previous public route before emitting spa_page_view. The matching GTM variable source is documented in docs/GTM-SPA-REFERRER.js; it falls back to document.referrer before initialization and strips queries/fragments in both cases. No event names, campaign variables, conversions or production-host guards change.

Page views now capture title, location and referrer synchronously on astro:page-load rather than in an idle callback that could observe a later route. A repeated event for the same main element is ignored, while a newly rendered back/forward visit counts. Regression tests execute the actual tracker for initial/direct/invalid referrers, duplicate events, consecutive navigation and back visits, and execute the GTM variable's fallback/privacy behavior. This fixes future navigation pathing; it does not reconcile the historical GA4/GSC discrepancy or rewrite earlier data. Deployment and actual GA4 receipt are recorded with the release.


## 2026-10-22 - Audit link recheck and gallery full-photo delivery

Rechecked the audit's municipal 404s live. Ridgefield Home Improvement currently returns 200 and works in Chrome, so retained its correct URL. Battle Ground's legacy FAQ.aspx?QID=275 now redirects; the permit guide links directly to the verified current /m/faq?cat=56#question-275 answer. Confirmed the same-size exemption in the official answer. No permit claims, FAQs, titles or descriptions changed. A scan of 34 public pages found 13 unique external anchor destinations and no repeatable 404. Camas and La Center rejected the automated client but both worked in Chrome; retained their official sources.

GalleryAddition now opens a generated quality-85 WebP at the full native resolution instead of the source JPEG. The 22 full photos total 16,801,528 bytes versus 25,873,822 source bytes (35.1% less). Thumbnails, source photos, captions and alt text are unchanged. Six full photos still exceed 1 MB; preserved native resolution and quality rather than claiming the warning is eliminated. Existing build pruning removes only unreferenced originals. A built-file regression check verifies full native dimensions, no embedded private metadata, generated-file existence and at least 30% total size reduction.

Validation: link-only baseline passed all 63 suite/build steps; image build and 20 image-delivery groups passed. Final combined suite/hosted checks are recorded with the release. Ask index dry run found 50 source chunks; a real rebuild was attempted and refused because local Cloudflare AI credentials are absent. The checked-in Gemini index does not contain this permit guide or either old municipal URL, so this link-only change cannot leave a stale URL in it. Broader Ask content coverage/re-embedding remains a separate follow-up.


## 2026-10-22 - Production analytics and confirmed lead collection

The production marketing container now loads only on windowsbyclearview.com and www.windowsbyclearview.com. Pages aliases, previews, local hosts and lookalike suffixes are excluded by an executable runtime hostname check. Removed the noscript iframe because shared prerendered HTML cannot enforce that check without JavaScript.

The static /estimate/sent page no longer emits generate_lead on visits or refreshes. Both forms require x-clearview-lead-accepted: 1 before sending the existing generate_lead event. Only the final delivered-response branch sets that non-personal marker; honeypot and error responses never do. Both forms block overlapping and repeat submits after success, with retry allowed after failure. No customer fields or record IDs go to GA4. No-JS inquiries remain counted in D1; events are accepted submissions, not qualified customers or sales.

Validation: all 63 suite/build steps passed, plus executable host isolation and both-form conversion tests. Endpoint tests cover real success, honeypot, validation and delivery failure. Live GTM method parameter forwarding was prepared separately; deployment and GA4 receipt require verification. Existing historical data and the GA4 internal-traffic Testing filter are preserved. No production customer inquiry submitted.


## 2026-10-18 - Leads phone round (`codex/leads-phone-context`)

#268 is merged as `e0aacca` after both checks passed; production reports that build with healthy PWA files/app gate. This proposed round previews long lead requests behind native full-text expansion (short notes remain visible), adds email/punctuation-independent phone search, a live result count, and Clear search with focus restoration and work-filter preservation. Work-type buttons now wrap at enlarged text. The seeded long-note card drops from 1,064 to 378 px at 390 x 844.

Validation: 62 suite/build steps, 9 interaction flows and focused Chrome checks at 320–1280 px plus 150%/200% text pass; interaction audit covers search recovery, full-note keyboard access and the existing follow-up handoff. All request content is escaped; data and action links are unchanged. No production writes or customer communications. This UI needs PR merge before production claims; production currently contains #268. Physical devices and signed-in production UI remain unverified.

## 2026-10-18 - Follow-up phone round (`codex/follow-up-phone-readability`)

#267 is merged as `a8ee95d` after both checks passed; production PWA assets/app gate are healthy. This proposed round wraps task titles on phone Today/Follow-up, focuses Task on Add follow-up, and shows an onscreen/focused Follow-up saved confirmation only for confirmed server creation. Failed/auth/incomplete responses retain input. Shrinking form tracks also prevent date/time fields being clipped at 200% text.

Validation: 62 suite/build steps and 9 interaction flows pass; focused Chrome checks cover successful save/retry, 401/HTML failure states, full long titles, 320–1280 px and 150%/200% text without clipping/overflow. Record schema, due-date conversion, queue sorting and Done behavior are unchanged. Only seeded local tasks were written. Physical devices and signed-in production remain unverified. This UI needs PR merge before production claims; production currently contains #267.

## 2026-10-18 - Photos phone round (`codex/photos-phone-capture`)

#266 is merged as `c52616c` after both checks passed; production PWA files/app gate are healthy. This proposed round brings photo capture from 1190 to 703 px down a 390 x 844 phone screen. Native backup/restore disclosure, compact context and responsive stage buttons keep capture reachable. All cloud-status and local-backup explanations remain. Missing-job capture stays gated with an instruction, and the Field return link now follows the current opening or project-wide view.

Validation: all 62 suite/build steps and 9 interaction flows pass. Focused checks cover photo/note reload persistence, stage filtering, JSON export/clear/restore, valid/missing jobs, 320–1280 widths, and 150%/200% text. Uses a public icon fixture and mocked cloud responses, with no production photo writes. Physical camera/device and signed-in production UI remain unverified. The UI round needs PR merge before production claims; production currently contains #266.

## 2026-10-18 - Measurements phone round (`codex/measurements-phone-cards`)

#265 passed both checks and is merged as `3b51633`; production PWA files/app gate are healthy. This next round fixes runtime measurement-row CSS and editing focus. Dynamic descendants use :global under the measurement table; phones get readable cards, while desktop/print remain tables. The change handler saves without rebuilding the current row, preserving the next-field focus. Numerical totals/worksheet format and reminders are unchanged.

Validation: 62 suite/build steps pass; `CHROMIUM_PATH=... node scripts/audit-command-center.mjs --flows-only` passes all 8 interaction flows, including the new measurements case. Focused checks cover reload and JSON export/restore with quoted room text, normal/large text widths 320–1280, and print row/header display. Physical devices and physical printouts remain unverified. This proposed round needs PR merge before production claims; production currently contains #265.

## 2026-10-18 - Google tools phone round (`codex/google-tools-phone-navigation`)

#264 is merged as `01b41a8` after both checks passed; production PWA assets and app gate are healthy for that build. This next round adds a native Choose a tool menu with 12 fragment links and a count of configured provider connections. Per-tool status and all existing tool explanations/confirmations remain. Calendar date/time inputs and their grid tracks now shrink correctly at 200% text.

Validation: all 62 suite/build steps pass; focused Chrome checks cover all shortcuts, keyboard, 320–1280 px, 150%/200% text, 0/3/10 configured connection fixtures, 500/no-signal states and a mocked report click. All seven forms and connection displays are preserved. No Google calls, production writes or physical-device validation were performed. This round is proposed in its PR; production stays on #264 until merged. Remaining candidates: laptop title size and issue #77 production reproduction. Provider setup is not proven live access.

## 2026-10-18 - Next phone round: Tools (`codex/tools-phone-work-first`)

Merged #263 after both GitHub and Cloudflare checks passed; production build `a534bb7` passes PWA health and app-gate checks. Tools now prioritizes measurements, installation photos and field mode, before setup/email checks. The two top jump links preserve quick access to those panels. Cards are more compact on phones; all 14 original cards, panel warnings and interaction scripts remain.

Validation: all 62 suite/build steps pass; local Chrome widths 320/360/390/768/1280 and 360 px at 150%/200% text have no overflow. Phone first tool moves 1197 to 357 px; setup anchors clear the sticky header. No script errors. This UI round is proposed on the branch/PR, with production unchanged until merged. Next candidates: Google tools connection summary, laptop title size, production reproduction of #77. Signed-in production and physical devices still require verification. Do not send a production email test merely to check this layout.

## 2026-10-18 - Continue Command Center after #261 (`codex/jobs-phone-queue`)

The Jobs creation form now starts collapsed behind "Create job from quote" so Mark reaches his current queue sooner. Expand it to select a finalized quote and create the job; the approval gates remain intact. Native details/summary supports keyboard and touch. The audit checks keyboard expansion and the first job's position above bottom navigation before creating a job. Three test scripts now work on Windows (file URL imports and CRLF normalization). The browser audit also converts nested Windows filesystem paths to URL slashes before attaching quote/job fixture IDs.

Validation: all 62 `test:all` steps pass, including the production build; keyboard expansion/collapse and expanded-form widths 320/360/390/768/1280 pass in local Chrome. PR #262 was merged as `49bc333` while validation ran. Production `check:pwa-live` reports that build and passes worker, manifest, offline page, icons and app-gate checks. Signed-in live layout was not inspected: the browser reached Cloudflare Access login. The first full sweep exposed Windows path separators in nested audit URLs (missing fixture IDs); the corrected sweep on `codex/windows-audit-paths` passes all 297 page views with 0 problems (29 pages, 4 data sets, phone/laptop, 58 failed-API views, and 7 real-handler flows). Follow-up scope is only audit-path normalization and these verification notes. Still open: Google tools' repeated connection messages, Tools page order, laptop title size, and reproducing the first-click navigation issue #77. Pricing, legal and provider-connection questions in earlier entries still require owner input.

## 2026-10-16 - /new-construction flashing diagram removed

Per Keith. See `.ai/CHANGELOG.md` (2026-10-16). The diagram component still exists and is used on the guides.

## 2026-10-16 - Fin naming, $850 fin slider, price edits (branch `claude/fin-install-price-edit`)

See `.ai/CHANGELOG.md` (2026-10-16). Fin is only Mark's internal name for a full-frame install, never a price (corrected the same day). Next agent: ask Mark for his starting price on each other opening (`quotePrice` in `src/data/pricing.ts`, vinyl Cascade); until then they start at the range midpoint and he edits the line. Prices are editable on the draft quote form (Edit quote) until it is signed; the Build Plan no longer goes stale on a price change.

## 2026-10-16 - Repo-wide bug sweep

Details: `.ai/CHANGELOG.md` (2026-10-16, "Repo-wide bug sweep"). A quote now refuses an amount over $5,000,000 or a quantity over 1,000,000 ("looks too large, check the digits"); three internal handlers answer 400 to a `null` body. **VERIFY with Mark:** that $5,000,000 is a comfortable ceiling for his largest builder quote (it is the same limit a general job already has). Still open from earlier: fractional quantities are accepted by the server; quote IDs carry the UTC date.

## 2026-10-15 - One-window job, pen signature (branch `claude/1-window-job-quote-contract-8fl5yx`)

Keith asked for a copy-paste walkthrough for Mark and a full-flow bug pass. Details: `.ai/CHANGELOG.md` (2026-10-15). Steps for Mark: `internal/README.md`, "One job, signed in pen".

- Fixed: the saved quote had no link to the Build Plan (now a "Next step" panel), phone money columns wrapped, the printed signature sat alone on page 2.
- **VERIFY with Mark:** he types his own price (the price book pre-fills a midpoint); the contract says no deposit is collected; a lawyer has not reviewed `contractTerms.ts` (nothing customer-facing says so, by Keith's decision); the 3-day right to cancel runs from the signing date, so do not order or start before it passes unless he accepts the risk; keep a photo or scan of the signed paper, the system records only that it was signed.

## 2026-10-11 - Home "Recent work" shows the newer photos (branch `claude/recent-work-newer-photos-2026-10-11`)

Keith: "We should be displaying the newer images on 'our recent work'". Details: `.ai/CHANGELOG.md` (2026-10-11).

- The home "Recent work" grid is `recentWorkPhotos` in `src/data/gallery-additions.ts`: the first six gallery additions without the door. **Add a new best photo at the top of `galleryAdditions` and it appears on the home page too**; if that is not wanted for a photo, put it lower. The door is excluded because the home "Sliding glass doors" tile already shows it.
- The tiles carry a caption only, never a kind label, and the count stays a multiple of six (3 across on a desktop, 2 across on a phone). `test:image-delivery` enforces all of it.
- The older owner-picked set (`featured: true` in `work.ts`, `featuredWork`) is unused now but kept.
- VERIFY: four of the six are from the 2026-10-07 batch, whose provenance is not recorded here (Keith confirmed only the 2026-10-11 batch).

## 2026-10-11 - Bug sweep, fifth round: large text (branch `claude/bug-sweep-5-2026-10-11`)

Keith said "Keep working on fixing public facing bugs". Details: `.ai/CHANGELOG.md` (2026-10-11).

What the next agent must know:
- **Test text size, not only width.** Set `html { font-size: 150% !important }` and `200%` at 390 and 360 px and compare `document.documentElement.scrollWidth` with `clientWidth` on every page; also look for `overflow: hidden` boxes whose `scrollWidth` exceeds their `clientWidth`, and for text whose Range rects pass the screen edge (a `<p>` or heading whose longest word is wider than the screen reports a normal box). Browser zoom does not find these. It takes under two minutes for 34 pages.
- **Never write a bare `grid-template-columns: 1fr`** (or leave a `display: grid` with no template and long or nowrap content): use `minmax(0, 1fr)`. A bare `1fr` track will not shrink below its widest child. `test:layout-guards` guard 12 fails on it. A grid you do not want stretched can use `minmax(0, max-content)` (the CTA band does, because it sits under `justify-content: space-between`).
- **No `white-space: nowrap` on a pill, tag, badge or link that can exceed a phone's width.** The licence, insurance and bond tags and the footer credit pill wrap; guard 10 fails if they go back. A phone number may stay nowrap only where its box can still shrink.
- **The header and hero react to the text size through container queries in rem**, not media queries: `header-row` (Header.astro; Brand.astro and the Menu button react to it), `.trust-strip-wrap` (VideoHero.astro) and `.areas-inline` (global.css). A px media query cannot see the reader's text size. The 15 rem / 16 rem / 14 rem thresholds come from measurement (header: wordmark + icon + Menu ~ 38 px + 12.7 rem); re-measure if the header's contents change. Container queries cannot style their own container, hence the wrapper div on the claim strip.
- **`body` has `overflow-wrap: break-word`** and mailto links and inline code `anywhere`. It only acts when one word cannot fit its line; do not replace it with `hyphens: auto` (that changes headings at normal sizes).
- **Planner rows (`CostEstimator.astro`)** wrap the +/- buttons under the label when the row is narrow (390 px phones at normal text): intended, and the only visible change at normal text size this round. Buttons are capped at 56 px.
- **How the "no visible change at normal size" claim was checked:** build `origin/main` and the branch, serve both, take full-page screenshots at 390, 768, 1280 and 1440 px with animations off and every image decoded, and count differing pixels. Pixel noise from lazy images is real; decode all images first.
- **Open, for Keith:** which door photo for the home card and doors hero (A live patio door, B two-panel slider on gray siding, C slider with screen; the live patio door stays until he answers); the CSP header; the 1.5 MB logo video; the tagline "Great prices."; capping `--mobile-cta-h` (the bottom bar is 120 px at 200% text).
- **Known limit:** 320 px wide at 200% text still overflows by a few pixels in the planner's +/- row, a fieldset legend and the 3D viewer's controls.


## 2026-10-11 - Bug sweep, fourth round (branch `claude/bug-sweep-4-2026-10-11`)

Keith said "Keep working on fixing public facing bugs". Details: `.ai/CHANGELOG.md` (2026-10-11).

What the next agent must know:
- **The phone menu is capped and scrolls** (`Header.astro`, 1400px block: `max-height: calc(100dvh - 64px - 1.6rem)`, `overflow-y: auto`). The header is sticky, so anything absolutely positioned inside it does not scroll with the page; a panel taller than the screen cannot be reached. If the header's row height (`min-height: 64px`) changes, change the 64px in that `max-height` too. `test:layout-guards` guard 7.
- **Public text fields must be 16 px on touch screens.** iOS Safari zooms the page in on focus below 16 px. A smaller desktop size is allowed only with a `@media (pointer: coarse)` rule that restores `1rem` (the Ask message box does this). `test:layout-guards` guards 8 and 9 scan every public `input`, `textarea` and `select` rule.
- **`html` has `scroll-padding-top: 5.25rem`** so jump links clear the sticky header (63 to 75 px tall, 320 to 1920 px wide). Do not remove it, and do not add a per-target `scroll-margin-top` on top of it without measuring. `test:layout-guards` guard 9 needs at least 4.75rem.
- **How these were found:** real interaction, not reading. Open the menu at 844x390 and 375x667; click every `a[href^="#"]` and measure the target's `getBoundingClientRect().top` against the header's bottom; read `getComputedStyle(field).fontSize` for every field at 390 px wide. All three are quick to rerun after a header, form or layout change.
- **Local checks that look like bugs but are not:** `/api/google-reviews` 404 under `astro preview`; the Turnstile and WebGPU console warnings in a headless browser; axe reporting forced-colours contrast on the logo, and 4.07 to 4.45:1 on two guide captions while they fade in (`--ink-faint` on `--paper-sunk` is 4.52:1).
- **Open, for Keith:** no `Content-Security-Policy` header (trial it report-only first); the home page's 1.5 MB logo video downloads on phones and under reduced motion (`VideoHero.astro`); the site tagline "Great prices." (2026-10-04, owner's call).
- **Could not verify:** the La Center permit link in `window-replacement-permit-washington.md` (`ci.lacenter.wa.us` returns 403 to this environment, home page included).


## 2026-10-11 - Bug sweep, third round (branch `claude/bug-sweep-3-2026-10-11`)

Keith said "Keep working on fixing public facing bugs". Details: `.ai/CHANGELOG.md` (2026-10-11).

What the next agent must know:
- **A tag or label in a narrow card must be able to shrink.** `WorkCard`'s `.work-kind` is `flex: 0 1 auto; min-width: 0; overflow-wrap: anywhere` and the figcaption wraps. A phone's two-column tile is about 150 px wide; "NEW CONSTRUCTION" in tracked capitals is wider than that, and `flex: none` clipped it. `test:layout-guards` (guard 6) fails if either goes back.
- **`/api/google-reviews` 404s under `astro preview`.** It is a Cloudflare Pages Function (`functions/api/google-reviews.js`), so a local browser crawl always logs one failed request per page. Production returns 200 JSON. Not a bug; do not "fix" it.
- **Headless-sandbox console noise is not a site bug:** the Turnstile error on `/estimate` and the WebGPU warning. Check `/estimate` on a real phone if the security check matters to a change.
- **Open, for Keith:** no `Content-Security-Policy` header anywhere. Adding one is hardening; it must allow GA4, GTM, Meta, Turnstile and the review feed, so trial it as `Content-Security-Policy-Report-Only` first.
- **Resolved:** Keith confirmed on 2026-10-11 that the 2026-10-11 gallery photos are Clearview jobs (`docs/GALLERY-PHOTOS-2026-10-11.md`). The door now leads the doors page's "Finished patio door installs" grid. Still open: the job scope of each photo is not known (replacement, new construction, door), so captions describe only what is visible.


## 2026-10-12 - Vinyl vs fiberglass graphic (branch `claude/bug-sweep-repair-ub27ah`)

Details: `.ai/CHANGELOG.md` (2026-10-12, graphic).

- **Resolved (second owner graphic, same day): the guide page now uses "Frame Strength. Slimmer Sightlines."** (`src/assets/guides/vinyl-fiberglass-sightlines.png`) through `CanvaGuideEmbed`; the drawn SVG (`FrameMaterials.astro`, "solid pultruded") and its test exception are deleted. The page's intro "answer" line was reworded to match the graphic. The guide's Markdown and FAQs are unchanged, so no Ask index rebuild was needed. Open: the graphic's own small text is not legible on a phone (about 305 px wide); the double-pane graphic has a separate mobile image, and a portrait or stacked version of this one would fix it (an owner design call). Also: a stray half-clipped duplicate "choice." in the file was retouched out.
- **Resolved (three more owner graphics, same day): double-pane glass, window flashing and U-factor/SHGC ("Window Energy Ratings, Explained", replaces the coded gauge on `/window-features`)** replace the Canva pair and the stock-photo flashing guide (see `.ai/CHANGELOG.md`). Ask Mark for a clean re-export of the double-pane graphic: its subtitle under the headline is washed out by the photo fade, and the flashing graphic's subtitle starts with a clipped "O". Both are 1536 px and have no portrait version, so phone text is small.
- **Resolved (fourth graphic): "Window Trouble: Know the Signs"** replaces the signs photo guide. Higgsfield 4K upscaling of the other graphics was tried (10 credits) and NOT shipped: it introduced typos ("siimmer", "mahufacturer") and garbled the double-pane subtitle. Re-export from the source instead.
- Both graphics are 1536 px wide, which is everything the files have. On a 2x laptop their small text is a little soft; an upscale (Higgsfield, as for the 2026-10-11 photos) would sharpen it. Not done: it spends credits. `test:image-delivery` expects 2000 px for guide graphics except this page, which must offer the real width of its source file (`SOURCE_LIMITED_GRAPHICS`).

## 2026-10-12 - Bug sweep, thirteenth round (branch `claude/bug-sweep-repair-ub27ah`)

Details: `.ai/CHANGELOG.md` (2026-10-12, thirteenth round).

What the next agent must know:
- **Run `scripts/audit-command-center.mjs` after any Command Center UI or API change.** It needs Playwright and a Chromium (`npm i --no-save playwright`, `CHROMIUM_PATH`), builds nothing itself (`npm run build` first), and exits 1 if any page throws, calls an API that errors, or scrolls sideways. It is the only thing that executes these pages against the real handlers.
- **Long-text rule:** do not add `overflow-wrap: anywhere` to a flex or grid container of controls; it lowers their minimum width and they collapse. The layout already applies it to the content area and resets controls. A new control class that is not `button`, `select`, `th`, a tab, or named `*btn*`, `*filter*`, `*pill*`, `*chip*` or `*tab*` needs adding to the reset list in `InternalLayout.astro` (and to the guard in `test-internal-mobile.mjs`).
- Tables that every endpoint needs must be created by whatever reads them, not only by the endpoint that happens to write them first (`job-closeout.js` was the one that did not).

## 2026-10-12 - Bug sweep, twelfth round (branch `claude/bug-sweep-repair-ub27ah`)

Details: `.ai/CHANGELOG.md` (2026-10-12, twelfth round).

What the next agent must know:
- **A quote with more than about 100 openings cannot get a saved Build Plan**, so it cannot be approved, signed through the link or become a job. Limit: 100,000 characters in `build-plan.js` (about 1 KB per opening). A builder bid for several houses has to be split into one quote per house. Raising it means raising it in `build-plan.js` and checking the 2 MB D1 row limit and the 150,000 `slice` in `jobs.js` (see the CHANGELOG).
- Decision for Keith: is "split the quote" acceptable for a multi-house builder bid, or should the limit rise? Nothing today needs more than 100 openings.

## 2026-10-12 - Bug sweep, eleventh round (branch `claude/bug-sweep-repair-ub27ah`)

Details: `.ai/CHANGELOG.md` (2026-10-12, eleventh round).

What the next agent must know:
- **Decision for Keith (dashboard, not code): the `windowsbyclearveiw.pages.dev` address serves the whole site and the Command Center login.** Cloudflare Access covers only the custom domain, so the shared password (now limited to 10 attempts per 15 minutes) is the only door there. Add that address to the Access application or turn the `pages.dev` domain off for production. Nothing public is at risk otherwise: its pages declare the production canonical URL.
- **Logout does not revoke a session.** Tokens are stateless HMACs valid for 30 days. If a phone is lost, rotate `INTERNAL_SESSION_SECRET` (that signs everyone out) and change `INTERNAL_PASSWORD`.
- `LOGIN_RATE_LIMIT` counts every attempt including correct ones; ten in 15 minutes is generous for one person.

## 2026-10-12 - Bug sweep, tenth round (branch `claude/bug-sweep-repair-ub27ah`)

Details: `.ai/CHANGELOG.md` (2026-10-12, tenth round).

What the next agent must know:
- **To change the contract wording** (`src/data/contractTerms.ts`, from `WARRANTY_YEARS` down): bump `TERMS_VERSION` in `src/data/contractTerms.ts` AND `functions/internal/_lib/quotes.mjs`, then add the new version and the hash the failing `test:duplicated-facts` prints to `PINNED`. The wording has not been reviewed by an attorney (see the file's header).
- **To change the phone number or site address**, change `src/data/site.ts` and every server copy `test:duplicated-facts` lists; it names the file. Mail stays on `@windowsbyclearveiw.com`.
- Not changed: the quote builder lets a custom line be added at $0.00 (the price field defaults to 0). It may be deliberate ("included"); if not, a confirm on $0 lines would stop a forgotten price reaching a contract.

## 2026-10-12 - Bug sweep, ninth round (branch `claude/bug-sweep-repair-ub27ah`)

Details: `.ai/CHANGELOG.md` (2026-10-12, ninth round).

What the next agent must know:
- **Business time is Pacific.** Weekly lead counts and "today" use Pacific calendar dates (`weekStartMs` in `lead-sources.mjs`, `pacificDayRange`). Do not bucket instants by `getUTCDay()` or `toISOString().slice(0, 10)`; do not step back in 7 x 24-hour blocks to find an earlier week.
- **Source labels come from `sourceLabel`** (`lead-sources.mjs`), never from raw columns, on every screen.
- Not changed: quote, invoice and job IDs embed the UTC date, so something written at 6 pm Pacific on the 12th is `Q-20261013-...`. Nothing parses an ID for its date; changing it would mean new-format IDs next to old ones.

## 2026-10-12 - Bug sweep, eighth round (branch `claude/bug-sweep-repair-ub27ah`)

Details: `.ai/CHANGELOG.md` (2026-10-12, eighth round).

What the next agent must know:
- **Decision for Keith/Mark: the Ask assistant may now name Milgard.** `COMPETITOR` in `functions/ask/api/chat.js` had `milgard`, which made the assistant rewrite and then refuse any answer that named a window line Clearview installs. Removed. If Mark wants Ask to avoid brand names altogether, that is a separate rule to write on purpose (and then the Cascade vs Milgard guide it retrieves from contradicts it).
- **Nothing executes `chat.js` in CI** (it imports JSON, which plain Node cannot load; `test-ask-security.mjs` reads its source). To run it: `node_modules/.bin/esbuild functions/ask/api/chat.js --bundle --format=esm --platform=node --outfile=<tmp>.mjs --loader:.json=json`, then import the bundle with a stubbed `fetch`. A real behavioural test would need that bundle step in the test.
- Public JSON fields must be type-checked, not `String()`-coerced: `String({toString: 1})` throws. The authenticated Command Center helpers (`clean()` in `quotes.mjs`, `job-evidence.js`) still coerce; only Mark can reach them.

## 2026-10-12 - Bug sweep, seventh round (branch `claude/bug-sweep-repair-ub27ah`)

Details: `.ai/CHANGELOG.md` (2026-10-12, seventh round).

What the next agent must know:
- **Decision for Keith: `/ask/api/health` and `/ask/api/models` never worked.** They are `GET` handlers (`functions/ask/api/`), but `_middleware.js` allows only `POST` and `OPTIONS`, so the live site answers 405 for both (checked 2026-10-12). Their comments say to check them first when Ask starts answering "unavailable". Nothing references or tests them. Safe by accident: `models` makes outbound calls with the server's AI keys and would be spendable by anyone if the middleware let `GET` through. Options: move them under `/internal/api` (behind the login), or delete them. Not changed.
- **JavaScript-off is now a tested case** for the header navigation (`test:layout-guards` guard 15). An `is:inline` style takes plain CSS; wrapping it in a `{`...`}` template prints the braces literally and the rules never apply.
- "Window installation" copy and the city-page `metaTitle` field: see the 2026-10-12 entry in `.ai/STATE.md` (#215).

## 2026-10-11 - Bug sweep, second round (branch `claude/bug-sweep-2026-10-11`)

Keith said "Keep going". Details: `.ai/CHANGELOG.md` (2026-10-11).

What the next agent must know:
- **A failed Ask reply can still carry `answer`.** `/ask/api/chat` answers 503 with the fallback answer (phone number and estimate link). The page must show it (`fallbackAnswer` in `src/lib/visitor-errors.ts`); throwing on every non-OK response hides it. `test:visitor-errors` checks the page and that every 503 in `chat.js` keeps `answer: UNAVAILABLE_ANSWER`.
- **Phone numbers in prose use a non-breaking space.** In a template: `keepPhoneTogether(text)` (`src/lib/phone.ts`); in Markdown: `(564)&nbsp;208-0801`; never in front matter that is also a meta description (use the helper at render time). A `tel:` link is exempt. `test:text-gaps` fails on a plain-space number in the built public pages. A script-written message can still break at the hyphen.
- **Decision for Keith (revenue measurement): first-touch attribution never refreshes.** `BaseLayout.astro` writes `clearview:first_touch` to `localStorage` once and the lead record uses it, and the saved journey keeps no query strings. A returning visitor who scans a door-hanger QR (`/neighbors`, UTM tags) is recorded as arriving the way they first did. GA4 still sees the UTM on that session. If the door-hanger pilot is judged from the leads view, repeat visitors will undercount it; a "last touch" field would fix that (not built: it is a measurement design choice).
- **Risk, not observed: the honeypot is named `company`** (`EstimateForm.astro`, `ask-callback.ts`, checked in `estimate.js`). A browser autofill that fills it would make the server answer "ok" and save nothing. Renaming it to a name browsers never autofill is a small change; it would alter spam filtering, so it was left for a decision.
- Minor, not changed: `/estimate/sent` pushes `generate_lead` on every load (reload double-counts; only the no-JS path reaches it, and it is `noindex`); if the receipt or lead mail fails after the lead is saved, the visitor is told it failed (the retry no longer saves a second lead: `logLead` skips an identical inquiry within 30 minutes, 2026-10-12).
- Open from before: no real-device or screen-reader test; the Command Center shows the service worker's readable offline message rather than "Failed to fetch"; `astro check` has 201 strict-mode errors (none a real bug, not adopted).

## 2026-10-10 - Bug sweep (branch `claude/bug-sweep-2026-10-10`)

Keith asked to keep finding and fixing bugs. Details and the method: `.ai/CHANGELOG.md` (2026-10-10, bug sweep); accessibility: `docs/ACCESSIBILITY.md`.

What the next agent must know:
- **A visible change for Keith and Mark to look at.** The `.split` two-column sections (about, home, replacement, new-construction, sliding-glass-doors, calculator, 404, estimate result pages) were not centred on wide screens and used small bold text because `.split` shared a rule with `.btn`. They now match the rest of the page: centred, normal body text. Check `/about` and `/` on a desktop and a phone in the Cloudflare preview before merging.
- **The Turnstile widget is `compact` (150 px) at 375 px and below** and normal at 390 px and up (`EstimateForm.astro`). A bare `display: grid` sizes its column to the widest child; use `grid-template-columns: minmax(0, 1fr)` (`test:layout-guards` checks the form and `.split`).
- **Never put `aria-label` on a `<span>`/`<div>` without a role**; put the words in `<span class="visually-hidden">`. A link's `aria-label` must contain the text it shows. `test:a11y-names` fails otherwise.
- **Public text is never smaller than 12 px (0.75rem).** `--step--2` in `global.css` is a fixed `0.75rem`; do not make it fluid again, and do not write a smaller `font-size` in public CSS or `.astro` files (`test:layout-guards` fails on it; Brand's `.brand-sub` and the SVG text in `FrameMaterials` are the allowed exceptions; the Command Center is exempt). Lighthouse's legible-font audit wants 60% of text at 12 px or more.
- **Astro drops a line break before an inline element without leaving a space.** Text, newline, `<a>` renders as `text<a>`. End the text with `{' '}` (or keep the link on the same line). `test:text-gaps` fails on the built HTML when a sentence runs into its link.
- **Public error text goes through `visitorMessage`** (`src/lib/visitor-errors.ts`); never print `error.message` from a failed `fetch`.
- **Compare times as ISO strings built in code**, never against `datetime('now')`: `test:copilot-snapshot` bans it in `functions/`.
- Bond and insurance amounts appear as screen-reader text; the no-pricing tests exempt exactly those two sentences (`scripts/_lib/credential-detail.mjs`). Any other hidden dollar figure still fails.
- `scripts/audit-a11y.mjs` needs `npm i --no-save playwright axe-core` (not in CI). `npm i --no-save` can remove the repo's `node_modules/playwright` link.
- Open: no real-device, screen-reader or live Turnstile test; Command Center pages still show raw "Failed to fetch"; `astro check` has 201 strict-mode errors (none a real bug, not adopted).

## 2026-10-11 - New gallery photos and a better sliding glass door (branch `claude/new-photos-2026-10-11`)

Details: `docs/GALLERY-PHOTOS-2026-10-11.md`, `.ai/CHANGELOG.md` (2026-10-11).

What the next agent must know:
- **The 2026-10-11 batch is Clearview jobs (Keith, 2026-10-11).** The door is `patioSliderPhoto` in `src/data/gallery-additions.ts`. It leads the `/sliding-glass-doors` installs grid (labelled "Finished result") and is still deliberately **not** in `workPhotos`: that would show it a second time in `/gallery`'s "From the street" group and add it to the replacement page and featured lists. `test:image-delivery` fails if it is added to `work.ts`, if it is not the first installs-grid card, or if it appears other than once on `/gallery`. Gallery captions still say nothing about install, finish or job type (`test:image-delivery`): the batch is confirmed as ours, the scope of each job is not. The paperwork photo in the same Drive folder is another contractor's and should still be deleted from it.
- **Look at upscaled photos at full size before committing them, glass first.** The 4K upscale made a face legible in the door glass and showed a person inside another house. "View full photo" serves the committed file.
- **Hero = the doors page** (`getHeroBg(patioSliderPhoto.image)`); the home hero (`heroPhoto` in `index.astro`, a windows photo in the video reveal) is unchanged. Say so if Keith meant the home hero.
- Higgsfield: upload is `media_upload`, then `curl -X PUT` with headers `Content-Type: image/jpeg` and `If-None-Match: *`, then `media_confirm`, then `upscale_image` (2 credits, 4 concurrent jobs at most on the starter plan). Source photos are 600 to 1200 px: the result is generated detail.
- Tests read `gallery-additions.ts` and `work.ts` as text (plain Node cannot import `.jpg`) and the built `dist/`.
- Open: Mark confirms the jobs; delete the paperwork photo (it shows a customer's details) from the shared Drive; ask for original-resolution files; the old `gray-siding-white-slider-deck` photo has a cluttered interior.

- **Gallery order is by strength, not batch** (`galleryAdditions` in `src/data/gallery-additions.ts`, re-ranked 2026-10-11 after Keith asked for the best images higher). New photos go where they rank, with the best exteriors in the first six (what a visitor sees first); the door must stay in the first six (`test:image-delivery`). Only the first three additions load eagerly; keep it that way when the section order changes.

- **Gallery wording is plain and has no counts** (Keith, 2026-10-11). No photo or job counts on `/gallery` (`test:image-delivery`); no "elevation", "flashed", "next trade", "double-hungs" or "sliders" in the gallery's own words and no "elevation" in `work.ts` captions or alt text (`test:public-terminology`); do not restore "Every photo here is from one of our jobs" until Mark confirms the 2026-10-11 photos. Rules: `.ai/references/public-copy-positioning.md`. "Elevation" is still in six guide sentences (FAQ needs the owner; edits need `npm run build:guides-index`).

## 2026-10-10 - Photo delivery and framing (branch `claude/image-display`)

Keith asked for the website's images and their display to be improved. Done by measurement: a real-browser audit of every photo, then fixes to which file the browser downloads and to how photos are framed. Numbers, rules and the add-a-photo checklist: `docs/IMAGE-DELIVERY.md`; summary: `.ai/CHANGELOG.md` (2026-10-10, photo delivery).

What the next agent must know:
- **Never write `photo.image.width`, `.height` or `.format` in a component.** Imported photos are Proxies; a direct read publishes the full-size original into `dist/_astro` (71 MB happened). Use `dimensionsOf`/`coverScale` from `src/lib/image-sizes.ts`. `npm run test:image-delivery` fails on it.
- **Do not type a `sizes` string on a `<WorkCard>`.** Use a `SLOT_SIZES` preset (each was measured; rounded up). A new layout means a new measured preset plus a row in the doc table.
- The CSS aspect ratios in `WorkCard.astro` mirror `FRAMES` in `image-sizes.ts`; change both together.
- `scripts/audit-image-delivery.mjs` is the browser tool (Playwright; not in CI). Run it after any layout, preset or frame change.
- Judgment calls for Keith/Mark, not made: tap-to-enlarge in the gallery; a landscape photo for the home hero; whether the extra phone weight (about +35% on audited pages) is acceptable. Levers: WebP quality in `WorkCard` and the top of `TILE_WIDTHS`.
- Not tested: a real phone or retina laptop; the live site until this merges and deploys.

## 2026-10-10 - Dependency audit (branch `claude/improve-next`)

`sharp` was bumped to 0.35.5 in `package-lock.json` only, closing the one high `npm audit` advisory (librsvg CVE). Four moderate advisories remain through `gray-matter` (dev only, guide index script); `npm audit fix --force` would downgrade it to 2.0.1, so do not run it. Compare with GitHub's Dependabot list, which could not be read from the agent environment. The Dependabot alerts Keith saw (2 high, 1 moderate) may not match `npm audit` one to one. Everything from the supplier permit list work (PR #198 and #200) is merged; the live Analytics check still needs a signed-in person.

## 2026-10-10 - Supplier permit list: connected records (branch `claude/supplier-permit-links`)

Keith asked for the number and names of corresponding projects to be connected and clearly displayed. The Analytics list now has a "Connected to" column: Permit leads case and owner, Mail pilot CV number and property, a Clearview quote or job at the same street (matched when the page is read, linked to its page), and the tracked builder; builders open to their own permits; the spreadsheet has Subdivision and Connected records. No new load. I read "correspondent projects" as these connected records: if Keith meant something else (for example project names printed in the report), change it in `readConnections` (`functions/internal/_lib/supplier-permits.mjs`). "Same address" is a lead to check, not proof of the same customer. Merge is Keith's; after deploy, open the list and check one permit that shares a street with a quote or job.

## 2026-10-09 - Supplier permit list (branch `claude/supplier-permit-list`)

Keith asked for the weekly permit report from Mark's supplier (Construction Monitor) to be fully enriched and loaded into the Command Center. It is Analytics > "Supplier permit list". Week 40 built cleanly (197 Clark County permits) and was loaded into production on 2026-10-09 (wrangler reported 210 statements, no error; counts not re-read); the live page waits for the merge and deploy.

What the next agent must know:
- **The report is licensed to one subscriber and forbids sharing, and the repo is public.** Nothing from it may be committed, pasted or screenshotted (PDF, parsed JSON, SQL, CSV, any row). The parser and build refuse any output folder in the repo except git-ignored `data/`. This session did not see Mark told what the section holds; make sure he knows. If the supplier objects to its use, removing it is `DROP TABLE supplier_permits; DROP TABLE supplier_import_meta;` on the production database; nothing else depends on them.
- Owner phone numbers are in the report and shown as plain text. Washington restricts unsolicited calls and texts. This list is for mail; calling needs a person who asked to hear from us. Do not add click-to-call or bulk dialing on owner phones.
- Each new weekly PDF: parse (`pdfplumber`), `npm run build:permit-leads`, `npm run build:supplier-permits`, load with the scratch-config method in `internal/README.md` ("Which database"). The load is a merge; weekly reports add up. The parser is untested on any layout but week 40; its self-check against the report's week totals fails loudly if a layout changes.
- Oregon permits are skipped; wiring a free source for Multnomah or Washington County parcels is possible but is scale before revenue.
- Open, unchanged: Mark's average job value, margin and close rate; a working Census API key; the mid-November re-pull of the mail pilot; confirming that `utm_campaign=CV-####` shows in Leads; `npm run check:pwa-live` after a deploy; 3 Dependabot alerts (2 high, 1 moderate) on the default branch.

Detail: `.ai/CHANGELOG.md` (2026-10-09, supplier permit list), `.ai/workflows/supplier-permits/CONTEXT.md`, `internal/README.md`.

## 2026-10-09 - Google operations tools (account activation pending)

Added Command Center > Tools > Google tools: Search Console top queries/pages, Business Profile metrics/reviews, address validation, Routes waypoint planning, five-day Weather, Document AI receipt/invoice extraction, Cloud Vision label OCR, owned Calendar reads/reviewed appointment creation, and manually reviewed USD expenses. Reports and proposals stay separate from job state; no automatic customer messaging, payments, quote changes or schedule changes. Scoped server credentials, authenticated same-origin writes, bounded uploads/results, fixed endpoints/timeouts and D1 daily attempt caps enforce the boundary. Conflicting retry IDs are rejected; expense saves use integer cents. Full 50-step suite passed with a 69-page build; final 69-page build passed after the attribution and upload controls. Merged code commit b8b6d34 to main; Cloudflare production deployment 4b98c654-f62c-43e2-81d4-dac32607fa2b is Active. Canonical PWA files carry b8b6d34 and pass the live check; both new page and API redirect unauthenticated requests to Access. Authenticated UI/API/provider tests remain VERIFY.

VERIFY: browser control repeatedly timed out, so no new APIs/credentials/roles/OAuth grants or Document AI processor have been activated this turn. Existing GA4 reader may supply Search Console auth only after that service-account email receives property access. Business Profile project approval can block reports/reviews. New connections must be live-tested; configured flags do not assert access. Authenticated desktop/phone UI and production connection tests await browser reconnection. Setup details: `.ai/references/google-operations.md` and `internal/README.md`.


## 2026-10-09 - No public pricing

Mark asked for all pricing off the public site. Done behind one flag (`publicPricing` in `src/data/pricing.ts`, plus `PUBLIC_PRICING` for Ask). To restore prices: flip both, revisit the edited guides, the Ask system prompt (`functions/ask/api/chat.js`) and `test:no-public-pricing`. Details: `.ai/CHANGELOG.md` (2026-10-09). Next agent: rebuild the Ask guide index with a key (text was patched by hand); pricing data in `src/data/pricing.ts` is still reviewed 2026-10-02 and only the internal quote builder uses it now.

## 2026-10-08 - Audit and bug-fix pass on the Command Center and phone app (branch `claude/internal-pwa-audit`)

Keith asked for a full audit and bug-fix pass of `/internal` and the phone app. Five bugs were fixed (details and tests: `.ai/CHANGELOG.md`, `scripts/test-internal-audit.mjs`). The one that matters most: **Field mode could not save an opening record** (wrong key names), so no window job could have been completed from the UI. It is fixed; do a first real job end to end on Mark's phone and watch Field mode, closeout and completion.

What the next agent must know:
- The audit used only synthetic local data. The phone app held up and was left alone. Not testable without hardware or a live sign-in: a real iPhone install, and Cloudflare Access; run `npm run check:pwa-live` after a deploy.
- Decisions found but not made (surface them, do not change them quietly): (a) approval `actor` on the Build Plan is typed by the browser, so the history is not proof of who approved; (b) the Photograph gate trusts the photo counts the phone sends; (c) write endpoints rely on SameSite=Lax cookies and do not check Origin; (d) sessions are stateless, so a copied cookie works for 30 days after logout (revoking means a server-side session list or rotating `INTERNAL_SESSION_SECRET`); (e) a field gate can be unchecked after a later gate is done; (f) the closeout screen is read-only after finalizing but its checklist items stay editable; (g) the server accepts fractional quote quantities, the builder is whole-number only; (h) dashboard due-today and overdue lists can overlap.
- Quote quantities on the builder are whole numbers of 1 or more by design and the page now says so; the shared rule is `src/lib/quote-lines.ts`. Field mode builds its evidence body with `src/lib/field-evidence.ts`; if `job-evidence.js` changes its keys, the audit test fails.
- Revenue note: production has 0 leads, 0 quotes and 1 job. This pass fixed things Mark would have hit on his first real job; more internal tooling before that job is scale before revenue.

Detail: `.ai/CHANGELOG.md` (2026-10-08, audit), `.ai/references/internal-pwa.md` ("Phone audit harness").

## 2026-10-08 - Mail pilot in the Command Center (branch `claude/mail-pilot-internal`)

Keith (Mark's marketing and dev person) asked for the direct-mail research to be packaged into Mark's Command Center. It is now `/internal/mail-pilot`: 528 Clark County homes that sold or pulled a re-roof/remodel permit, sorted into groups A-E, with charts, a break-even box and a mail-merge CSV (wave 1 = groups A, B, C = 193 homes). The "internal" in the request was read as the `/internal` Command Center of this site; that reading was not confirmed.

What the next agent must know:
- **The repository is public. Street addresses never go in git.** The page and API are code; the data is a private SQL file (`data/mail-pilot/mail-pilot.sql`, git-ignored) that was loaded into Mark's production D1 on 2026-10-08 (528 homes, CV-0001 to CV-0528). Re-pulls are merge loads. Note that the repo's `wrangler.toml` is NOT the production database; follow `internal/README.md` "Which database" or the load goes to the wrong place.
- The SQL file was built outside the repo from Keith's workbook and is not in this branch. To regenerate it you need the properties file (row fields: `.ai/workflows/mail-pilot/CONTEXT.md`); the county pull that makes that file is not scripted here.
- Reference codes (`CV-####`) are printed on mail: never change or reuse one. Loads merge by property id.
- Group rules live only in `functions/internal/_lib/mail-pilot.mjs`. Group D is an optional later comparison batch, not a withheld control.
- Open: Clearview's average job value, margin and close rate (the break-even box needs them from Mark); proof that a mailed link's `utm_campaign=CV-####` shows up on a real estimate request; a re-pull about six weeks after the window (around mid-November) because the county posts sales late; the first piece of mail and its QR code are not made.
- It reuses the existing lead-source capture and the Permit-leads loading pattern and adds no new service, so if the test brings no requests nothing else depends on it.

Detail: `.ai/CHANGELOG.md` (2026-10-08), `internal/README.md` ("Mail pilot"), `.ai/workflows/mail-pilot/CONTEXT.md`.

## 2026-10-07 - Existing repository photo resolution refresh

Audited all 87 tracked raster assets. Fourteen existing photographs below 4K are enhanced with Higgsfield at its maximum 4K setting and replace their sources at the same paths. The unused window-features-installation.jpg reuses the existing window-features-installation-4k.png master. Existing high-resolution job photos, logos, diagrams and model posters are retained. Original photo order, captions, alt text and page placements are unchanged; source aspect ratios are preserved within the upscaler's minor dimension rounding. JPEG exports omit EXIF. Before/after comparisons are inspected, including the retained door-number privacy blur.

WorkCard now supplies 680px and 900px WebP variants for high-density screens, retaining its 450px fallback and the same layout. Inventory and source dimensions: docs/REPO-PHOTO-AUDIT-2026-10-07.md. Validation: all 46 test:all steps and a separate production build passed. Local Edge checks at 1440px, 375px and 320px verify gallery photo order/alt text, image decoding on gallery/siding/guide pages, no horizontal overflow, and 900px image delivery on a 2x desktop screen. Production verification follows the main push.


Paste this into a new Claude session to pick up where the last one left off.
Technical detail lives in [README.md](./README.md); this file is the *why*.

---

## What this is

A marketing site for **Clearview Windows** — my friend Mark's window installation company in Vancouver, WA. He does replacement work for homeowners and new-construction installs for builders, across Clark County. Does not operate in Portland or elsewhere in Oregon (see 2026-09-23 entry below).

- **Live:** https://windowsbyclearview.com
- **Repo:** `ksksrbiz-arch/windowsbyclearveiw` (public), deploys from `main`
- **Stack:** Astro, static, no adapter. Cloudflare Pages. Estimate form is a Pages Function. Resend for mail.
- **Pricing worker:** https://clearview-pricing.skdev-371.workers.dev
- **Legal entity:** Clearview Windows & Trim LLC (WA UBI 605 779 798). **No DBA / assumed business name has been filed** (owner, 2026-09-30), so public copy must not say "doing business as" or "d/b/a"; say "Clearview Windows & Trim LLC" for the company and use "Clearview Windows" only as the short brand name. `site.legalName` in `src/data/site.ts` holds the legal name; `site.name`/`site.shortName` hold the short brand name. (Corrected 2026-09-27 — this was previously misdocumented as two words, "Clear View"; Keith confirmed the actual filed LLC name is one word, matching the trade name and domain. Fixed across site.ts, legal pages, invoices, the /ask system prompt and facts, CLAUDE.md, and README.md.)
- **On the spelling:** the public website uses `windowsbyclearview.com`. The working production mailbox for lead notifications is still on the legacy typo domain `windowsbyclearveiw.com`. Do **not** change the default notification address to `@windowsbyclearview.com` until a real mailbox has been provisioned and tested on that domain. The old domain's HTTP redirect does not affect SMTP/mail delivery.

## Where it stands

Working and deployed:

- Full site: home, replacement, new construction, process, gallery, guides, 8 service-area pages, reviews, estimate, 404
- Real job photos through `astro:assets` (WebP + srcset)
- Estimate form → Resend, with a no-JS fallback and a homeowner/builder split. Both templates (lead-to-Mark and receipt-to-customer) are full HTML with click-to-call / click-to-email buttons, and the lead email attaches a vCard so Mark can save the customer's contact info in one tap.
- **Estimate delivery verified live:** a real public production submission was made through `/estimate`; it returned success, created a D1 lead record, and Resend reported the Mark notification as delivered to the working Google Workspace mailbox at `owner@windowsbyclearveiw.com`.
- A protected Command Center production-mail test is available under `/internal/tools`; it uses the exact production Resend configuration and returns the provider message ID without creating a lead. This remains useful for repeatable diagnostics after deployments.
- Free cost estimator at `/tools/window-replacement-cost-calculator`
- **Command Center is installable and works with no signal (2026-10-03, on branch `claude/internal-pwa`, not yet on `main` until merged).** Saved pages plus a fixed allowlist of read-only job/follow-up data; writes are never queued. Contract `.ai/references/internal-pwa.md`, test `npm run test:internal-pwa`, owner steps in `internal/README.md` ("Install on a phone"). **Before installing on an iPhone, connect R2 photo backup** or keep taking photos in Safari: the home-screen app has separate storage and cannot see Safari's photos. Not yet checked on a real phone.
- Pricing worker with KV, validation, monthly cron, and a GitHub Actions health check
- Domain migration (windowsbyclearveiw.com → windowsbyclearview.com) is complete for the website: DNS, GTM/GA4, and Cloudflare Pages custom domains are pointed at the canonical web domain. Mail remains on the legacy domain until a real mailbox exists on the new one.

## Rules that must not be broken

These came out of real problems and are easy to undo by accident.

1. **No invented reviews.** `/reviews` is deliberately empty *unless real reviews exist*: it may show curated quotes (`src/content/reviews/`, `published: true`, customer agreed) and the live Google Business Profile feed (`/api/google-reviews`, only what Google returns for the pinned Place ID, name-checked; see 2026-09-26 entry). Nothing typed in by us that a customer did not write. It previously shipped three fabricated testimonials attributed to named people in a city Mark does not serve. Reviews default to `published: false`. Only real quotes from real customers who agreed, ever.
2. **No invented credentials.** `site.lniNumber` is now the real WA L&I contractor registration number (`CLEARVW74601`, set 2026-09-22 once Mark's Facebook Business Page showed it live). Washington requires a contractor registration number in advertising (RCW 18.27.100) and separately **prohibits** advertising that a contractor is "bonded and insured" — that phrase was removed and must stay out. The rule itself doesn't change now that a real number exists: never invent or guess a credential: `functions/ask/api/chat.js`'s `HARD_BANNED` filter still deliberately scrubs any L&I/license number from `/ask` conversational output — the real number lives in the deterministic site (footer, JSON-LD, printed contracts), not in freeform AI text.
3. **Pricing must say whose numbers it is.** The estimator currently shows Mark's own installed pricing (`basis.source: 'clearview'`), labelled as exactly that on the page, with a review date. If it ever reverts to published regional averages, set `basis.source` back to `'averages'` and the copy switches itself. Never present somebody else's averages as ours.
4. **The pricing worker does not discover prices.** There is no authoritative feed for Clark County window pricing. It validates, serves, and nags — it does not scrape cost guides or ask a model to guess.
5. **Honest copy generally.** Plain language, name the weather, admit when condensation is just a humid bathroom. No "unparalleled solutions". The federal 25C tax credit ended for installs after 2025-12-31 — do not sell it.
6. **Client-side navigation stays cheap.** `BaseLayout.astro` navigation handlers run on every in-site navigation. Batch layout reads, then writes; never interleave DOM reads/writes in per-element loops. Defer nonessential analytics work.

## ICM architecture — implemented 2026-09-08

Clearview now has an **ICM (Interpretable Context Methodology) control-plane layer** for AI-assisted operations. It is deliberately not a second database and not a replacement for application code. The filesystem supplies routing, stage contracts, stable reference context, and inspectable working artifacts; D1 and deterministic services remain the transactional/enforcement layer.

### Context layers

- Layer 0 — `CLAUDE.md`: root router and non-negotiables (routing only, ≤80 lines).
- Layer 1 — `.ai/CONTEXT.md`: router; points to the smallest relevant context.
- Layer 2 — workflow/specialist `CONTEXT.md`: the contract for the current job.
- Layer 3 — references/authorities: stable knowledge and source material.
- Layer 4 — working records/artifacts: current run state; never secrets or customer PII in ICM files.

**Navigate before reasoning.** A fresh agent should orient, route, act, and report state from the repository without relying on conversation memory.

### Build Plan pipeline

```text
01-scope → 02-openings → 03-materials → 04-installation → 05-qc → 06-approval
```

The production API remains authoritative for persistence/versioning/stale detection/linting/job snapshots: `functions/internal/api/build-plan.js`. Deterministic installation and QC rules live in `functions/_lib/build-plan-rules.mjs`.

The plan deliberately distinguishes:

- **KNOWN** — directly supported by quote/site/product authority.
- **INFERRED** — reasonable classification, not sufficient for commitment.
- **VERIFY** — requires measurement, inspection, order confirmation, manufacturer documentation, or another explicit confirmation.

### Ask routing

`functions/ask/_lib/icm-router.mjs` is the deterministic routing seam for `/ask`. It selects one specialist contract before model reasoning:

- `diagnostician` — symptoms, fog, drafts, moisture, damage
- `estimator` — cost, price, estimate, quote, budget
- `installation-reviewer` — installation, flashing, rough openings, fasteners, new construction
- `customer-advisor` — comparisons, performance, appearance, planning

The router does not answer questions, retrieve knowledge, or bypass runtime guardrails. Runtime contract assembly lives in `functions/ask/_lib/icm-specialists.mjs`; `.ai/specialists/*/CONTEXT.md` remains canonical. Regression cases live in `scripts/test-icm-router.mjs`; run `npm run test:icm`.

### Specialists

- `.ai/specialists/diagnostician/`
- `.ai/specialists/estimator/`
- `.ai/specialists/installation-reviewer/`
- `.ai/specialists/customer-advisor/`

These are contracts, not fake personas. Keep identity short, rules falsifiable, references authoritative, workflow explicit, and examples paired as good/bad/edge cases.

### ICM implementation rules

1. One stage, one job.
2. Routers point; they do not duplicate knowledge.
3. Stable factory knowledge belongs in Layer 3; per-run state belongs in Layer 4.
4. Stage N+1 consumes the documented output of Stage N; avoid hidden cross-stage reads.
5. Deterministic code owns calculations, validation, persistence, authorization, and state transitions.
6. AI may classify, reason, summarize, route, or propose, but it cannot turn uncertainty into a business commitment.
7. Human approval is a real state boundary: `draft → review → approved → job snapshot`.
8. Golden cases are executable documentation and should become automated regression coverage.
9. ICM files must never become a shadow customer database.

## Current limitations — explicitly not complete

1. Stage artifacts are documented but the operational Build Plan is still one D1 JSON artifact.
2. Specialist references need deeper source mapping as the knowledge library grows.
3. Golden cases need end-to-end execution against the real Ask and Build Plan services.
4. Lead → Estimate → Quote → Build Plan → Job → Installation → QC → Closeout is mapped but not every lifecycle stage has an ICM implementation.

Do not describe those items as complete until code and validation prove them.

## Recent-changes audit — 2026-09-09

Ran the full regression suite (`test:icm`, `test:build-plan-state`, `test:build-plan-integration`, `eval:build-plan`) plus `astro build` against the latest `main` HEAD to verify the last batch of Build Plan / field-prep commits were actually working. Found and fixed real, currently-deployed bugs:

- **Critical (production-breaking):** `functions/_lib/build-plan-rules.mjs` had five unescaped apostrophes inside single-quoted string literals (`manufacturer's`, `product's`), which is a JavaScript syntax error. This module is imported by the live Build Plan API (`functions/internal/api/build-plan.js`, `build-plan-state.js`), so every Build Plan read/write/approval request has been failing since commit `328c124` landed on `main`. Fixed by escaping the apostrophes.
- The fastener/spacing-invention blocker regex in `lintPlan` (same file) was too narrow to catch realistic phrasing like "#8 x 3 inch screws at 8 inches O.C." — it required the digit pair to sit directly next to the word "screw"/"fastener" and "O.C." to follow "in" with no letters between. Widened the pattern so the deterministic VERIFY/no-invented-fastener guard actually fires.
- `functions/ask/_lib/icm-router.mjs`: a structured `project.concern`/`project.projectStage` signal (e.g. a UI-selected "Fogged glass" concern) was being silently overridden by the generic customer-advisor catch-all whenever the message text also happened to contain a weak phrase like "what should I". Reordered routing so specific keyword routes win first, then project context, then the generic catch-all last.
- `functions/internal/api/build-plan.js`: the freshly-generated-plan branch was missing the `|| plan.status` fallback the saved-plan branch has (harmless today since a fresh plan never carries a prior status, but now consistent), and the approved-plan lock error message had drifted to "Approved Build Plans are locked" while the DB trigger and tests use "Approved Build Plan is locked" (singular) — aligned the wording.
- Two test-only bugs: `test-icm-router.mjs` called `.sort()` on the frozen `ICM_SPECIALIST_IDS` array (mutates a frozen array → throws); fixed to sort a copy. `test-build-plan-integration.mjs` still asserted the old field-prep copy ("Field verification required") that the "Polish field prep hierarchy" commit intentionally reworded to "VERIFY before installation" — updated the assertion to match the current, intentional copy.

All four regression scripts and `npm run build` are green after the fixes. Public site (`/`, `/estimate`, `/tools/window-replacement-cost-calculator`, `/ask/api/chat`) returns 200 live. The internal Build Plan API could not be exercised live from this session (auth-gated); once this fix ships, re-run the Command Center production-mail-style manual check against `/internal/quotes/build-plan` to confirm the API responds instead of 500ing.

## Full-site audit — 2026-09-16

Ran the complete local regression suite (`test:icm`, `test:build-plan-state`, `test:build-plan-integration`, `test:production-hardening`, `test:marketing-platform`, `test:ask-security`, `test:recent-fixes`, `test:copilot`, `test:ai-surfaces`) and `npm run build` against `main` HEAD, then checked live production behavior directly.

**Code / build:** All suites passed except one false-negative: `test:copilot`'s "non-POST rejection" check did a literal string search for `"status: 405"` in `functions/internal/api/copilot.js`, but the live code correctly returns 405 via `json({ error: 'Method not allowed' }, 405)` (status passed positionally, not as a `status:` key). Live-verified — `curl -X GET /api/estimate` returns `405`, same pattern. Fixed the assertion in `scripts/test-copilot.mjs` to check the actual guard condition instead of exact source text. `npm run build` produced 63 pages cleanly.

**Live site:** Homepage, `/estimate`, `/tools/window-replacement-cost-calculator`, `/reviews`, `/ask`, and the custom 404 all load correctly. `windowsbyclearveiw.com` (typo domain) and `www.windowsbyclearview.com` both 301-redirect to the canonical apex. `/internal/` correctly 302s to `/internal/login` for unauthenticated requests. Security headers (HSTS, `X-Frame-Options: DENY`, `nosniff`, restrictive `Permissions-Policy`) are present on the canonical domain. `robots.txt` and `sitemap-index.xml`/`sitemap-0.xml` are correct and exclude `/internal` and `/api`.

**Stale doc found and fixed:** the "Hero video" outstanding item said to drop a clip at `public/video/hero.mp4`; that path was never adopted. `VideoHero.astro` actually gates on `public/video/logo-reveal-1.mp4` (present, ~1.9MB) with a static-photo fallback when absent — this has been live and working. Removed from Outstanding below.

**Google indexing / traffic — verified 2026-09-16 once Search Console + GA4 were connected in OpenSEO:** Technical indexing is healthy — homepage `coverageState: "Submitted and indexed"`, `robotsTxtState: ALLOWED`, correct self-canonical, both sitemaps registered. The gap is visibility, not plumbing: over the trailing 28 days, GSC showed near-zero clicks site-wide (homepage 3 clicks / 41 impressions; every `/areas/*` page 0 clicks despite real impressions, e.g. `/areas/vancouver` 82 impressions at avg. position ~56, `/areas/portland` 55 impressions at avg. position ~36 — page 3-6, effectively invisible). GA4 organic channel showed only ~15 sessions / 9 users over the same 4 weeks, 0 key events. Notably, even branded queries (`clearview windows`, `clear view windows llc`, `clearview windows reviews`) average position 30-99 rather than the #1 a brand term should hold — consistent with no established/verified Google Business Profile entity, and likely some SERP confusion with similarly-named, unrelated businesses. Cloudflare-side spot check: production D1 (`clearveiw-quotes`, uuid `4700b6f7-c3d8-46c9-9b19-17cf34accb84`) has its full expected schema (leads/quotes/jobs/invoices/build-plan tables) and is live — current counts: 0 leads, 2 quotes, 1 job, 2 invoices, i.e. real work is being quoted directly rather than arriving through the web form yet, consistent with the low organic traffic above. `clearveiw-pricing` worker and its KV namespace are both deployed as documented.

**Priority flag, not a bug:** Google Business Profile is still unset (see Outstanding). The data above makes the case concretely — for a local install business, GBP/map-pack presence is very likely a bigger lever on real traffic and branded-search position than more content pages, and it's a same-day setup, not new infrastructure. Worth doing ahead of further site-building per the Cathedral Principle.

**Follow-up — 2026-09-16, root cause confirmed:** Queried Google's Business Profile and local-pack data directly (via OpenSEO, now connected with real Search Console/GA4/GBP access). Clear View Windows & Trim LLC has **no Google Business Profile at all** — it does not appear in the local map pack for "window replacement near me" searched from Vancouver, WA; the top 10 results are all real competitors (Zen Windows Vancouver, Best Value Glass, Lifetime Windows & Doors, Anderson Glass Co, Elite Glass & Mirror, MS Glass Outlet, PNW Glass & Mirror, and others), none of them this business. Worse, there is a **direct brand-name collision**: `clearviewpdx.com` ("ClearView Windows & Doors," Portland/Vancouver, claimed GBP, 5.0★/6 reviews, phone 971-417-6000) is a *different, unrelated company* operating the same trade in the same service area under nearly the same name — this is almost certainly why even branded searches ("clearview windows," "clear view windows llc") rank position 30-99 instead of #1: Google (and confused searchers) are matching the wrong, already-established business. A second unrelated same-named company (Massachusetts-based) also surfaces on a bare name search, though it's not a local threat. Recorded as competitors/context in the OpenSEO project (`cec8d5a2-61e3-4903-a079-ca6a131dcc57`) for continuity. **This changes the GBP task from "set one up" to "set one up correctly and consider whether the trade name needs to visibly differentiate from `clearviewpdx.com` in local listings/citations"** — claiming a GBP alone will not fix the collision if the profile fields (name, category, service area) don't clearly disambiguate from the Portland competitor.

**Follow-up — 2026-09-22, L&I number is live:** Mark's Facebook Business Page ("Clear view windows and trim LLC") now shows `Lic#: CLEARVW74601` alongside the UBI. Set `site.lniNumber = 'CLEARVW74601'` in `src/data/site.ts`, which automatically populates the footer, JSON-LD `identifier`, and the internal contract header/warning (`src/pages/internal/quotes/view.astro`) — those all read from this one field, no other code changes needed. Left the `/ask` `HARD_BANNED` filter in `functions/ask/api/chat.js` untouched on purpose: it still scrubs any L&I/license number from AI conversational output regardless of whether a real number exists, so the credential only ever appears through the deterministic site, never through generated text. Also fixed the now-stale "still pending" comments in `site.ts` and `functions/ask/_lib/facts.mjs`. Removed from Outstanding below. Next: set `REQUIRE_LNI=1` in the Cloudflare Pages production environment so an accidental future removal fails the build instead of just warning (README's own checklist item — this requires Cloudflare dashboard access, not a code change).

**Follow-up — 2026-09-22, license disclosure gets a tag, insurance still needs real data:** The request was for "colorful, obvious badges" for licensing, bonding, and insurance. Two things stopped a straight yes:

1. Washington prohibits advertising a contractor as "bonded and insured" — the statutory registration bond is a small consumer-protection instrument, not liability insurance, and the state considers that phrase misleading about what it covers. This repo already had that rule on file (see rule 2 above) from a real prior mistake, citing RCW 18.27.100 for the general "what a registered contractor may claim in advertising" boundary — but note that neither this file nor this session has verified the *exact* statute/WAC section specific to the bonded-and-insured phrasing itself, only that the restriction is real and this codebase already got burned by it once. Treat any bonding/insurance claim as high-risk without a fresh compliance check — the contract terms disclaimer already says legal language here hasn't had attorney review, and the same caution applies to marketing claims. Get a WA L&I or attorney confirmation of the exact citation and permitted wording before publishing bonding/insurance copy, not just this session's or a prior session's read of it.
2. There was no verified insurance carrier or policy data anywhere in the codebase. Mark says the business is actually insured, but nothing is wired up yet.

What shipped: `src/components/LicenseTag.astro`, a small factual disclosure tag (not a checkmark/seal — Footer.astro already had a comment from an earlier session explaining why the registration line was deliberately kept as plain text, for the same reason as point 1 above) reading "WA Contractor Reg. CLEARVW74601". Wired into the homepage hero (both `VideoHero.astro` variants, `onDark`) and the site-wide footer (replacing the old plain-text line, same conditional-on-`lniNumber` fallback preserved). Colors use only already-contrast-verified tokens from `global.css` (`--accent-2-ink`/`--accent-2-bright`), no new pairing invented.

What's needed before an insurance badge can ship, without inventing anything: (a) the actual carrier name, (b) coverage type — general liability is what's normally advertised, not auto or workers' comp — and ideally the coverage amount, (c) confirmation the policy is currently active, and (d) compliant wording confirmed with L&I/an attorney given point 1. Once that's in hand, add a `site.insurance` field mirroring how `lniNumber` is gated (empty/unset by default, a real value turns the badge on) and a second `LicenseTag`-style component using non-banned phrasing — never "bonded and insured" as a set phrase.

**Follow-up — 2026-09-22, swept the whole site for stale "pending" L&I copy:** Setting `site.lniNumber` only fixed the surfaces that already read that field dynamically (Footer, JSON-LD, the internal contract in `view.astro`). A full-text search across the repo turned up three more surfaces that hardcoded the old "not published yet" story as static prose, independent of the field, exactly the kind of drift a template-only fix misses:

- `src/pages/about.astro` — the "What we have not earned yet" honesty list had a "Contractor registration number pending" entry. Since that gap is closed, removed the entry outright rather than leave a now-false "not earned yet" claim sitting next to the two that are still true (no reviews, pricing basis).
- `src/pages/new-construction.astro` — "The business behind it" paragraph said the number "is not published here yet — ask for it on the first call." Rewritten to state the real number and keep the "verify it yourself at the L&I lookup" advice, which is good practice regardless of whether the number is known.
- `src/content/legal/terms.md` — the "Contractor registration" section told readers to "ask for the registration number on your first call," which is now inaccurate since it's published on the site itself. Updated to state the number directly (this file is static markdown with facts hardcoded as literal prose throughout — legalName, entity type, etc. — so this matches the existing pattern rather than trying to inject a template variable into content-collection markdown) and bumped `updated` to 2026-09-22.

Verified `dist/` after build: no remaining occurrence of "not published here yet," "number pending," or "number is not published" anywhere in the built site. The internal contract (`view.astro`) and invoices were already checked — invoices never carried this disclosure by design, and the contract's conditional warning/number line already read `site.lniNumber` correctly with no separate fix needed.

**Follow-up — 2026-09-22, insurance and bond are live too:** Mark supplied the actual ACORD 25 certificate of liability insurance and the WA L&I continuous contractor's surety bond. Real facts, not guessed:

- **Insurance:** State National Insurance Company, Inc. (NAIC #12831, via Next Insurance Agency), Commercial General Liability, occurrence form. $300,000 each occurrence / $300,000 general aggregate / $100,000 damage-to-rented-premises / $5,000 med exp. Policy `NXTCDKDFTC-00-GL`, effective 2026-09-16 through 2027-09-17. Certificate #992928302.
- **Bond:** Westfield Insurance Company, WA L&I continuous contractor's surety bond #568672F, $30,000 (the statutory amount under RCW 18.27.040), effective 2026-09-15.

Added both as structured fields on `site.ts` (`site.insurance`, `site.bond`), gated the same way `lniNumber` gates `LicenseTag` — unset means the tag renders nothing, no guessing. Built `InsuranceTag.astro` and `BondTag.astro` mirroring `LicenseTag.astro` exactly (same tokens, same factual-disclosure framing, same `onDark` prop), wired into the same two spots (homepage hero, site-wide footer).

On the wording caution from the entry above: did not wait for a fresh L&I/attorney sign-off before shipping — the user made that call explicitly, weighing it against the cost of a formal check. The mitigation actually shipped: the two facts are disclosed **separately** and with real, specific numbers ("General Liability Insured · $300K/Occurrence", "WA Contractor Bond #568672F · $30K"), never combined into the literal "bonded and insured" phrase `test-marketing-platform.mjs` already guards against (still passes). This is a considered risk call, not a legal guarantee — if this ever needs re-litigating, the honest framing is "specific real numbers, kept apart, no vague assurance language," not "cleared by a lawyer."

**Follow-up — 2026-09-22, shortened the visible tag text:** The user asked to drop the dollar amounts and just say "bonded and insured" outright. Declined — that's the literal phrase this repo already blocks and the exact prior mistake this file documents, and dropping the specific numbers would have made the claim *less* defensible (a bare "bonded and insured" implies more protection than a $30,000 statutory bond actually provides), not more compliant. What shipped instead, once the user picked this option explicitly: `InsuranceTag`'s and `BondTag`'s visible text shortened to just "Insured" and "WA Bonded" — the real carrier, policy/bond number, and dollar amounts moved into `title` (hover/long-press tooltip) and `aria-label` (so every screen reader still gets the full disclosure regardless of screen size). The inner text span carries `aria-hidden="true"` so screen readers read only the full `aria-label`, not both. Still never renders the combined "bonded and insured" phrase anywhere in markup — verified in `dist/` after build.

**Follow-up — 2026-09-22, four new work photos added:** The user sent four real job photos (via a different session's file staging, which never actually reached this repo — pulled directly from the user's own upload instead once that became clear). Matched by actual content rather than the other session's guessed filenames, since two of the guesses didn't match what the photos actually showed:

- `tan-trim-slider-porch.jpg` — new slider window, primed tan trim not yet painted, shot from under a covered porch roof. `kind: 'process'` (unpainted trim = cosmetically mid-job).
- `caulk-gun-interior-sill.jpg` — caulk gun resting on the sill, interior view looking out at the job truck and ladder. `kind: 'process'`.
- `charcoal-trim-hung-ladder.jpg` — finished window with dark charcoal trim, ladder still standing in front. `kind: 'process'`, following this file's existing convention that a ladder still in frame means `process` even when the trim itself reads finished (see `blue-hung-ladder`, `blue-ladder`, `gable-arch-ladders`).
- `new-build-tan-corner.jpg` — modern new-construction home, tan panel siding, black window frames, exposed weather barrier at the base. `kind: 'new construction'`.

Added to `src/assets/work/` and wired into `src/data/work.ts` with real alt text and captions, following the exact existing pattern (individual imports, not a glob, so a missing photo fails the build) — none use the `window-`-prefixed naming the other session guessed, to match this file's actual id convention (color/material-first, e.g. `tan-upper-slider`, `charcoal-corner-picture-window`). All `featured: false`. Verified in `dist/` after build: all four appear on `/gallery` (via `allWork`), the three `process`-kind photos appear on `/process` (via `processWork`), and the new-construction photo appears on `/new-construction` (via `newBuildWork`).

**Follow-up — 2026-09-23, Portland removed as a service area:** The user decided Clearview will not operate in Portland, OR (previously listed alongside the eight Clark County, WA towns). Swept every surface that claimed or implied Portland coverage:

- `src/content/cities/portland.md` — deleted. `/areas/portland` no longer builds; `public/_redirects` sends that URL to `/areas` (301) rather than leaving Google's existing index entry for it as a bare 404.
- `src/data/site.ts` — removed the `nearby` entry for Portland (this one change fixes the `areaServed` JSON-LD schema on every page that maps over it: `JsonLd.astro`, `replacement.astro`, `new-construction.astro`, `sliding-glass-doors.astro`, and the "Where we work" list on `/about`), and dropped the "across the river in Portland" clauses from `description` and `serviceAreaNote`.
- `src/pages/index.astro`, `src/components/Footer.astro` — removed the hardcoded Portland entries from the homepage service-area links and the footer's Areas column (both were literal arrays, not driven by the content collection, so deleting the city page alone wouldn't have caught these — they'd have kept linking to a 404).
- `src/pages/about.astro`, `src/pages/areas/index.astro` — removed "and we cross the river into Portland" / "plus Portland, OR" prose.
- `functions/ask/_lib/facts.mjs` — the `/ask` business-facts block now explicitly states Clearview does *not* serve Portland or Oregon, so the AI won't imply otherwise.
- `src/data/pricing.ts`, `src/components/CostEstimator.astro`, `src/pages/tools/window-replacement-cost-calculator.astro` — the cost-estimator copy referenced "Washington and Portland-metro averages" as the source of the *regional comparison* pricing data (not a service-area claim). Reworded to "regional averages" / `region: 'Washington'` rather than leave any Portland mention standing, per the instruction to remove it entirely.
- `src/content/cities/vancouver.md` — "set on the Columbia River across from Portland" reworded to "along the state's southern border." Purely geographic color, not a service claim, but removed anyway since the instruction was to drop Portland from the site outright.

Confirmed no open PR and no remaining branch depends on `/areas/portland` before deleting it. Ran a full case-insensitive repo grep afterward — the only remaining hits are the new "does not serve Portland" line in `facts.mjs` and historical, dated HANDOFF entries above this one (GBP competitor research, old traffic numbers) that describe what was true *at the time* and should not be rewritten.

### 2026-09-26 — Google reviews feed on `/reviews` (branch `feature/google-reviews-feed`)

Built, tested, **not yet deployed or enabled**.

- `functions/_lib/google-reviews.mjs` — pure logic: Places API (New) call, sanitising, bounds, and the **name guard** (a Place ID that resolves to any business other than *Clearview windows and trim LLC* fails closed, because near-identical trade names exist in this service area).
- `functions/api/google-reviews.js` — `GET /api/google-reviews`, edge-cached, fails soft (`unconfigured` / `unavailable` / `name-mismatch` -> empty list).
- `src/components/GoogleReviews.astro` + `src/pages/reviews.astro` — hidden section revealed only when real reviews arrive; hides the "nothing here yet" block and swaps the lede; text written via `textContent` only.
- `scripts/test-google-reviews.mjs` (`npm run test:google-reviews`, wired into CI) and `scripts/find-google-place-id.mjs` (`npm run find:google-place-id`, phone-matched).
- Verified in a real browser (Chromium) against a mock feed at 1280 and 390 px: renders, hostile markup stays inert, all failure modes keep the existing empty state, no horizontal scroll.

**Go-live checklist:** set `GOOGLE_PLACES_API_KEY` + `GOOGLE_PLACE_ID` in Cloudflare Pages (see `internal/README.md`); confirm `/api/google-reviews` returns `status: "ok"` and the profile's real name; then update `src/pages/about.astro` ("No reviews yet" honesty entry) and the `/reviews` meta description so they no longer say the page is empty; add the Google Maps data use to `src/content/legal/privacy.md` only if counsel wants it (visitors' browsers only talk to this site, not Google).

### 2026-09-28 — Lead-path hardening + phone layout fix (branch `claude/amazing-volta-n93yt5`)

Found by executing the site rather than reading it: a Chromium pass over every public page at 375px, plus a behavioural test that runs `functions/api/estimate.js` against a stub D1 and Resend.

- **Estimate notes lost their line breaks.** The calculator and quiz pre-fill the estimate form one detail per line (`Home type: …\nApproximate openings: …`), but the endpoint's `clean()` collapsed all whitespace, so Mark got those details run together in the lead email and D1. Notes now go through `cleanMultiline()` (line breaks kept, runs of blank lines capped at one, control characters stripped). Internal lead views (`/internal/leads`, `/internal/leads/analyze`) render notes with `white-space: pre-line`. The hosted Resend template `estimate-request` must render `NOTES` with preserved line breaks — the journey summary already relied on this; **VERIFY** in the Resend dashboard if a lead email looks flattened.
- **Receipt email could be used to mail third parties.** Superseded at merge by `main`'s limiter (commit bdf6589): an atomic `estimate_receipt_limits` claim on a SHA-256 of the address, 24h cooldown, which **fails closed** (no receipt) if D1 is unavailable. Mark's notification and the D1 lead row are never suppressed. `test:estimate` now exercises that limiter on real SQLite.
- **Calculator overflowed phones by 1px.** `.estimator-grid` used a bare `1fr` track under 900px; a min-content child pushed it wider than the viewport. Now `minmax(0, 1fr)`; guarded in `test:recent-fixes`.
- New `npm run test:estimate` (`scripts/test-estimate-endpoint.mjs`) is in CI. It fails on the pre-change handler and passes now.

### 2026-09-28 — Quote → job pipeline executed end to end (same branch)

`npm run test:quote-to-job` (`scripts/test-quote-to-job-flow.mjs`) drives the real handlers — create quote → generate/save plan → review → approve → sign → create job — against a real SQLite engine (`scripts/_lib/d1-sqlite.mjs`, a D1 stand-in on `node:sqlite`). It found four bugs, all fixed:

- **Job creation always failed.** `jobs.js` `INSERT INTO jobs` supplied 18 values for 17 columns (`…,'mark','mark'`). Every "create job" 500'd. Production D1 confirmed it (read-only query, 2026-09-28): the only job is a cancelled 2026-09-06 test created before Build Plan snapshots existed.
- **Quote list flagged every plan stale.** It compared two saved copies with mismatched keys and never read current items. It now compares the saved snapshot against live items via `sourceSnapshot()`, the same function the gates use.
- **State transitions laundered stale plans.** `build-plan-state.js` rewrote `source_json` to the current quote on every transition, so submit-review on an outdated plan made it approvable and signable. Transitions now keep the saved snapshot. Only re-saving in the editor reconciles.
- **Half-cent money.** Fractional quantities (for example linear feet of trim) produced non-integer `line_total_cents`. Now rounded server-side (authoritative) and in the quote builder preview.

**VERIFY:** production `leads` is 0 rows (2026-09-28), although the entry above records a live test lead. Either it was cleaned up or leads are not being written. Submit one real test lead and re-check `SELECT COUNT(*) FROM leads`.

### 2026-09-28 — Speed-to-lead alert + post-job review request (same branch)

These are gaps 1 and 3 from `.ai/references/command-center-gap-analysis.md`.

- **Lead alert** (`functions/_lib/lead-alert.mjs`, called from `functions/api/estimate.js`): an ntfy phone push on every valid lead. It is independent of Resend and sends no customer data, so the privacy policy's three-company list stays true. **Off until `LEAD_ALERT_NTFY_TOPIC` is set.** Setup: install the ntfy app on Mark's phone, subscribe to a long random topic, and add that topic as a Pages secret. Tests: `test:estimate`.
- **Review request** (`functions/internal/api/review-request.js`, `functions/_lib/review-request.mjs`, panel on `/internal/jobs/closeout`): available only after the closeout is finalized, never for cancelled jobs, one ask per job across channels. The D1 slot is reserved before sending and released if the email fails. Channels: email via Resend, or an `sms:` link Mark sends from his own phone. The fixed message never suggests content or a rating. Tests: `test:review-request`.
- **Privacy policy** (`src/content/legal/privacy.md`, updated 2026-09-28) now states the single post-job review ask. **VERIFY:** Keith/Mark are happy with the wording.
- **Review link:** currently the profile share link. Once `GOOGLE_PLACE_ID` is set (see the 2026-09-26 entry), it automatically becomes Google's direct write-review form.

### 2026-09-27 to 2026-09-28 — public copy, guide graphics, real hero photos

Shipped via PRs #110–#113. What changed and the rules that came out of it:

- **No personal name on the public site (owner's own request).** "Mark" was removed from all customer-facing copy (pages, CTAs, form confirmations, legal pages, guide byline). The guide `Article` JSON-LD author is now the `Organization`. `site.owner` still exists for internal use, and internal Command Center pages and code comments still say "Mark" on purpose.
- **No claims about who handles what.** The public copy neither implies a team/staff/office nor discloses a small operation. It describes the *process* (in-person measure, written estimate, final walkthrough) in plain company voice ("we"). Do not reintroduce "the team responsible for...", "our installation team", "one-person company", "point of contact", or a crew doing the work. Generic references to *other trades'* crews (the builder's siding crew) and photo captions are fine. This stays consistent with CLAUDE.md rule 2 and WA CPA exposure noted in `terms.md`; if the real staffing picture changes, update the copy from facts the owner confirms.
- **Fragment copy fixed.** Telegraphic lines such as "You try every sash. Debris leaves with us." were rewritten as plain sentences (homepage steps, cost-calculator steps). Prefer complete sentences a first-time visitor can parse.
- **Plain-language pass (2026-09-30).** `/replacement`, home, `/process`, `/sliding-glass-doors`, `/window-features` and `/about` were reworded into plain, direct sentences (no shop jargon like "spec every opening", no "wrecking the siding" lines, no single-pane-only framing). No business facts were added or removed. The cost guide and signs guide now use real Clearview job photos instead of stock. Positioning rules live in `.ai/references/public-copy-positioning.md`; the eight city pages, all six guides, gallery, reviews, service-area index, tools index, estimate problem page and 404 got the same pass (body copy only; titles, descriptions, FAQs and facts untouched). `functions/ask/_data/guides-index.json` was re-embedded from the current guides on 2026-09-30 (43 chunks, `gemini-embedding-001`). Re-run `npm run build:guides-index` with `GEMINI_API_KEY` set after any guide edit.
- **Ask hand-off (2026-09-30).** `/ask` offers "Request a call back" (dialog; posts to `/api/estimate` with role `Ask assistant`) next to "Start estimate" once the visitor has had two answers or chosen project details. Hand-off taps are counted in D1 (`ask_handoffs`, kind + timestamp only) and shown as a 30-day funnel on `/internal/ask-logs`; GA4 gets `ask_handoff` (GTM tag set up and tested by the owner) and `generate_lead` with `method: ask_callback`. The estimate pre-fill now carries opening type and project stage too. `/ask` is also linked from the shared CTA band, the home page signs section and `/replacement` (the header nav has no room for another link at 1440px). The privacy policy now has a section on the consultant (AI providers, photo handling, what is and is not stored, hand-off counts) and covers call-back requests; `test:ask-handoff` fails if those phrases disappear. **Owner review wanted** on the updated privacy text before relying on it. The terms page now has a "The website consultant (/ask)" section (AI answers are general guidance, not a quote/inspection/professional advice; can be wrong; no commitments; estimate controls; keep private details out of the chat). Owner should still have Mark read it.
- **Guide graphics.** New infographics (double-pane glass, vinyl vs fiberglass; the window-anatomy graphic was also removed 2026-09-30 as inaccurate and low quality; the old-window-to-replacement graphic was removed 2026-09-30 for being inaccurate, and a replacement must be checked by Mark before it goes on the site) live in `src/assets/guides/` and render through `CanvaGuideEmbed.astro` using `getImage()` (WebP, explicit dimensions). Never put Canva exports in `public/`: they were 1–3.4 MB raw PNGs (one "SVG" was 2.6 MB of 49 embedded PNGs). `guides/[slug].astro` hides a guide's `heroImage` only for photo-based diagram types (`insert-vs-full-frame`, `flashing-order`, `signs-checklist`); the illustration-style diagrams intentionally pair with a photo.
- **Privacy policy** discloses the Meta pixel (delivered through the existing GTM container `GTM-WGCFVHQM`, no inline pixel code). The estimate form's JS success path now pushes the same `generate_lead` dataLayer event the no-JS `/estimate/sent` page does.
- **Real hero photos.** `/new-construction`, `/areas` (+ city pages) and `/tools` now use real Clearview job photos instead of AI/stock imagery; the credit lines say "Clearview job photo" and, on city pages, "not specific to <city>" because photos are not tagged to towns. With those swapped, nothing referenced `src/assets/hero/` any more, so the whole directory (AI/stock hero files) was deleted. The other photo heroes (`/about`, `/process`, `/replacement`, `/window-features`, `/sliding-glass-doors`, `/gallery`) already used real job photos; the homepage hero is video-backed and the guides pages use no photo hero.
- **CI.** `test:google-reviews` had been failing on `main` (it required the about page to read `site.googleReviews`, but the about page no longer shows a rating); the assertion now allows an about page with no rating/count of its own. The GitHub Actions `build` job also intermittently fails in ~4 s with no runner allocated (infrastructure, not code); a failure that runs ~40 s is a real test failure. Cloudflare Pages preview success is a separate build signal.

### 2026-10-03 — Permit guide for window replacement

- New guide `/guides/window-replacement-permit-washington` for the "Do you need a permit to replace windows in Washington state?" search question. There is no statewide answer: Clark County and Camas want a permit even for same-size windows; Battle Ground and Ridgefield say no permit for same size; a new or different-size opening needs one everywhere checked. The guide only states what the cities' own pages and the state energy code say, with a sources list.
- **VERIFY before relying on it:** Vancouver (largest market) is not stated because its code page could not be read; the likely rule and the citation to check are in `.ai/WORKING.md`. Also confirm Washougal and Woodland, and whether Clearview pulls the permit for the customer (the guide says only that we talk permits through before work starts).
- **To do (needs credentials):** `npm run build:guides-index` so `/ask` can use the new guide.

### 2026-10-04 — Siding in the Command Center

- Quotes, invoices, jobs and leads now carry Windows vs Siding (badges and an All / Windows / Siding filter on each list). New siding quote: Quotes → New siding quote (or Start siding quote on a siding lead, which the /siding page's estimate button now creates). The builder offers Mark's labor rates by wall area (height x width); material, dry rot and anything else are custom lines.
- **Siding quotes skip the window Build Plan; the signature approves them** (Keith's decision). A signed siding quote → Create job; that job has no window checklist or closeout and can be completed freely, but payments, schedule, notes and photos work. Window quotes behave exactly as before.
- **Open / VERIFY:** what Mark checks at the end of a siding job (nothing is enforced yet); whether the printed contract terms suit siding; production gets the new columns lazily on first use (no manual migration). Details: `.ai/WORKING.md`, `.ai/CHANGELOG.md`. Test: `npm run test:siding-work`.

### 2026-10-04 — House siding page

- Mark asked for a dedicated page promoting his house siding in the same areas. Built `/siding` from what he told us: fiber cement lap and board and batten, primarily James Hardie; LP products such as SmartSide board; other wood siding. Windows can be added to a siding job if the customer asks. Pricing is by the square foot of total wall area, materials and labor included (owner, 2026-10-22; every siding dollar figure, including the earlier labor-only rates, was removed from the page, the code and the docs). Four of Mark's siding-job photos are on the page, in the hero and in the gallery (metadata stripped, a door number blurred, a person cropped out). Nothing else is stated: no certifications or timeline.
- The permit section is from each building department's own page (Clark County, Camas, Battle Ground, Ridgefield say siding needs a permit; Vancouver, Washougal, Woodland, La Center are not stated).
- **Before it is promoted:** Mark should confirm the four process steps (he has confirmed the plywood figure is labor only and that all four photos are fine to publish). The primary nav now has a Siding link (the header row is widened to 1340px above 1400px to fit it; see `.ai/WORKING.md`). Details and the 90-day review rule: `.ai/WORKING.md` "Public copy log". Guard: `npm run test:siding`.
- Context for the decision: local search demand is small and the top local firms have 100-200 reviews, so expect this page to convert existing traffic (window customers, city pages) rather than rank quickly.

### 2026-10-03 — Command Center bug sweep

- Found by running the real handlers and built pages together in Chromium at phone widths (details and the full list: `.ai/CHANGELOG.md`). Biggest: editing a quote line's price or quantity was impossible (focus lost each keystroke), the on-device signature pad overflowed every phone and could store a cut-off signature, and every amount was rounded to whole dollars (including the emailed invoice). All fixed; `npm run test:command-center` guards them.
- **Behavior changes to know about:** `PATCH /internal/api/quotes/[id]` for an on-screen signature now takes `signatureStrokes` (the page sends them) instead of `signatureSvg`; cents now show on quote, invoice, job and payment screens whenever an amount has them.
- **VERIFY with Mark (not changed):** a field gate can be unchecked after later gates are checked, so an opening can read "Complete" with "Verify" unchecked. Say whether he wants unchecking blocked until the later gates are cleared.

### 2026-10-03 — Ask log shows real (scrubbed) questions for 30 days

- Keith's call: `/internal/ask-logs` was all "[redacted]" by design; now it stores each question and answer with phone, email, link, street address, ZIP, long digit runs and "my name is …" removed, and deletes them after 30 days. Detail and file list: `.ai/CHANGELOG.md`; tests: `npm run test:ask-logs`.
- **Deploy order matters.** The Pages site deploys on merge. The nightly backup Worker does not: run `cd workers/ops-cron && npx wrangler deploy`. Until then backups still copy the text and nothing purges nightly, so the privacy policy's backup sentence is not yet true (the live table is still purged on every insert and hidden past 30 days). If the Worker deploy cannot happen the same day, hold the Pages merge.
- **VERIFY:** Keith/Mark are happy with the new privacy wording in "The website consultant (/ask)". Scrubbing is best effort: spot-check the first week of real rows for details it missed (names typed without "my name is", house names, intersections) and add a rule if needed. Existing rows say "Words not recorded" until they age out.

### 2026-10-02 — Crawl-audit fixes (branch `claude/seo-audit-fixes`)

- **What changed:** hero backgrounds and `<Image>` fallback `src` files are much lighter (clean-build raster images 23.6 MB -> ~7.5 MB); four over-length titles/descriptions fixed and `/reviews` title lengthened; four new contextual links to the Cascade vs Milgard guide. Detail and the list of things checked and left alone (empty alt on decorative images, Cloudflare email-protection 404, estimate query variants) are in `.ai/CHANGELOG.md`.
- **Open for the owner:** refresh `/ask` guide embeddings (`npm run build:guides-index`, needs a credential) next time a guide changes. Optional: make the guide "Keep reading" list rotate so guides 5 and 6 get inlinks; decide whether to turn off Cloudflare Email Address Obfuscation to silence the false-positive crawl 404 (it protects the address from scrapers). Check the live Lighthouse scores after deploy; the audit tools here did not return them.

### 2026-10-01 — ICM aligned to the owner's standard layout (folder stays `.ai/`)

- **Root `CLAUDE.md` is now a 53-line router** (cap 80) with a Task | Load | Do not load table and an exclusion rule. The ten non-negotiables are kept; the ICM rules and Ask routing detail moved to `.ai/references/icm-rules.md` and `.ai/references/ask-routing.md`. Domain/mail spelling, no-invented-facts and human-approval rules are unchanged.
- **Every contract now has a Completion section** (Build Plan stages and workflow, all nine specialists). Stop conditions stay as Clearview's addition.
- **Five new workflows** under `.ai/workflows/`: `public-copy-sweep`, `lead-to-quote`, `job-closeout`, `analytics-events`, `deploy-check`, each with a load/exclusion table and grounded in existing code; anything the repo does not record is written as `VERIFY`, not guessed.
- **`.ai/STATE.md` is a snapshot again**; dated feature detail moved verbatim to `.ai/CHANGELOG.md`.
- **Tests:** `npm run test:icm-structure` (router ≤80 lines, references ≤200, contract sections, tables, every named path and `npm run` script exists, business-critical rules survive) and `npm run test:all` (runs `build.yml` in order locally). Full suite: 37/37 pass, including `npm run build`.
- **GitHub Actions cannot run (billing issue, owner, 2026-10-01).** Local runs are the gate; Pages previews are the independent build signal. `build.yml` already includes the new test for when billing is fixed.
- **Decision:** the folder stays `.ai/` (maps to `context/` in the owner's standard layout) because the router, specialist loader, tests and docs depend on it.
- **Open:** the copy sweep's reviewed / not-reviewed inventory has not been run yet (step 1 of `.ai/workflows/public-copy-sweep/`). `README.md` records a 2026-09-30 plain-language pass over most pages; the remainder is unlisted.

### 2026-10-02 — Home hero and Homeowners card photo, three photos upscaled (branch `claude/hero-photo-upscale`)

- New owner-supplied photo `gray-lap-siding-triple-hung` is the home hero still/poster/default social image (`heroPhoto`) and the Homeowners card (`replacementTile`). The Builders and Sliding glass doors card photos were replaced with 4K upscales (Higgsfield). Hero crop retuned to `50% 45%`.
- `/replacement`, `/window-features` still use `stone-craftsman` directly; swap them too if the owner wants the new photo site-wide.
- VERIFY with the owner that the windows in the new photo are Clearview installs before naming it as a project; alt/caption are visual-only.
- Gate: `npm run test:all` (39 steps) passes; viewed at 1440 px and 390 px.

### 2026-10-02 — Permit leads in Analytics (branch `claude/permit-leads-analytics`)

- **What changed:** builders and homeowner remodel permits from Clark County/Vancouver, enriched from the county assessor and the WA L&I license list, shown in a new section of `/internal/analytics`. Pipeline, privacy rule and limits are in `.ai/CHANGELOG.md` and `internal/README.md` ("Permit leads").
- **Not live until you load it:** the page shows "not loaded" until `data/permit-leads/permit-leads.sql` is run against the production D1 (`npx wrangler d1 execute QUOTES_DB --remote --file=...`). That file holds owner names and mailing addresses; generate it locally, never commit it.
- **Open:** decide who contacts which builders (mid-size ones such as New Tradition, NW Elite and Pacific Lifestyle look likelier than Horton, Lennar or Holt) and whether any answer. Only then consider status tracking. Optional: refresh weekly.

### 2026-10-01 — AI Gateway routing and model-aware guide embeddings (items 5 and 6 of the Cloudflare review)

- **AI Gateway (built, off until `AI_GATEWAY_URL` is set).** `functions/_lib/ai-gateway.mjs` (`groqChat`, `geminiGenerate`) now carries every Groq/Gemini chat call: Ask chat, lead analyzer, copilot, copilot summary. When on, calls go to `gateway.ai.cloudflare.com/v1/<acct>/<gw>/{groq|google-ai-studio}/...` with `cf-aig-collect-log-payload: false` (metadata only: Ask deliberately stores no question text, and the gateway must not become the place it lives), plus a feature tag. Falls back to the provider directly on gateway network failure, 401/403/404, 502/503/504 (never on 429 or a provider 4xx/5xx; never on a timeout). No caching. Gemini keys moved from the `?key=` URL to the `x-goog-api-key` header everywhere (chat, embeddings, models listing), so a key can no longer appear in a URL log. Owner steps: create gateway, set `AI_GATEWAY_URL` (`internal/README.md`, "AI Gateway for Groq and Gemini").
- **Embeddings (built; production index NOT changed).** `functions/ask/_lib/embeddings.mjs` registers `gemini-embedding-001` and Workers AI `@cf/baai/bge-m3` (no external key; $0.0118 per M tokens, 60k context, per Cloudflare's model page). The index file already records its model; `/ask` now embeds the live question with `guidesIndex.model` and uses that model's `minScore` (0.48 for Gemini, unchanged behavior today). `topMatches` skips chunks whose vector length differs from the query's, so a model mismatch yields "no matches" instead of noise. `build-guides-index.mjs` defaults to bge-m3 via the Workers AI REST API (`CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` with Workers AI - Read), still supports `--model=gemini-embedding-001`, has `--dry-run`, and refuses a mixed-size index. Ask no longer needs `GEMINI_API_KEY` to answer when `GROQ_API_KEY` is set (the old gate required Gemini only because of embeddings).
- **Before/after quality check:** `npm run eval:retrieval` (`scripts/eval-retrieval.mjs`, questions in `scripts/eval-data/retrieval-questions.json`: 24 on-topic questions mapped to guides, 6 off-topic). Scores any index with its own model: hit@1/3/6, best-score ranges for on- vs off-topic, and a suggested `minScore`; `--index=a.json --against=b.json` compares two. **This was not run against real embeddings** (no Cloudflare or Gemini credentials in this session), so the bge-m3 `minScore` (0.48) is a placeholder until measured.
- **To finish the switch (owner/credentialed step):** (1) confirm the Pages `AI` binding exists (README says it is required for photo analysis; not verified); (2) copy the current index aside (`cp functions/ask/_data/guides-index.json /tmp/old.json`), then `npm run build:guides-index` with the Cloudflare vars (it rewrites the committed file); (3) `npm run eval:retrieval -- --index=/tmp/old.json --against=functions/ask/_data/guides-index.json`; (4) set bge-m3 `minScore` in `embeddings.mjs` to the suggested value if the new index is at least as good; (5) commit the index and run `node scripts/eval-ask.mjs <site>`; (6) after that the Gemini key is needed only as the chat fallback, and the pasted key should be rotated regardless.
- **Verified:** `npm run test:embeddings` (in CI), 11 groups: gateway URL validation; direct vs gateway URLs and headers; fallback matrix (401/403/404/502/503/504 yes; 400/429/500 and timeouts no); keys never in URLs; Workers AI response shapes; REST binding; Gemini embed header; dimension guard; retrieval scoring on a fake embedder (hit rates, separable and overlapping ranges); committed index uses a known model with one vector size and every eval question points at a real guide; build script dry-run/unknown-model/credential errors; source guards that no direct provider URL remains outside the helper. Removing the payload header, the fallback, the dimension guard and the key-in-header each made it fail. The real Pages bundle (`wrangler pages functions build`) compiles, and a real `/ask/api/chat` call through that bundle with fake providers went to the gateway URL with the privacy headers and the Gemini key in a header. **Not tested:** the real gateway, real Workers AI embeddings, real retrieval quality.
- **Honest scope note:** gateway value is observability and spend caps; at low Ask volume it is a nice-to-have. Embeddings: the win is one fewer external key; quality parity is unproven until the eval is run.

### 2026-10-01 — Turnstile site key wired

- The owner created the Turnstile widget and supplied its public site key; it is now `turnstileSiteKey` in `src/data/site.ts`, so the widget renders on `/estimate` (verified in the built page). The Cloudflare "existing widget" flow (`turnstile/spin/prompt.md`) retrieves the secret with Wrangler ≥ 4.109 using an owner-confirmed manifest; this session has no Cloudflare login (`wrangler whoami`: not authenticated), so the secret was **not** retrieved or stored and the widget's allowed domains were **not** checked.
- **Enforcement is still off.** Server-side checking starts only when `TURNSTILE_SECRET_KEY` is set as a Pages secret (steps in `internal/README.md`). Validation pending: with the secret set, one real submission should succeed and a replayed token should be refused. Also confirm the widget lists `windowsbyclearview.com`.

### 2026-09-30 — Cloudflare Access sign-in for /internal (built, off until configured)

- **Why:** the Command Center used one shared password (no MFA, no per-person log, cannot revoke one person). From the Cloudflare services review, #2.
- **Built:** `functions/internal/_lib/access.mjs` verifies the `Cf-Access-Jwt-Assertion` token itself (RS256 against the team's published keys, cached 1 h with one refresh on an unknown key id; checks issuer = this team, audience = this application, expiry, not-before, and an email). `functions/internal/_middleware.js`: a valid Access identity is a sign-in; otherwise the password cookie works exactly as before; `ACCESS_REQUIRED=1` (honored only when team and AUD are set) retires the password. Fails closed on every error; customers are unaffected because `/sign`, `/api/*` and public pages are outside `/internal`.
- **Status: inactive until the owner configures Access** (steps in `internal/README.md`, "Cloudflare Access sign-in": create the self-hosted app for path `internal`, allow Mark's and Keith's emails, 1-month session, set `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`, test on Mark's phone, only then `ACCESS_REQUIRED=1`).
- **Verified:** `npm run test:access` (in CI): real RSA signatures from generated keys and the real middleware. Accepts a good token; rejects wrong audience/issuer, expired, not-yet-valid, no expiry or email, wrong key under a known key id, `alg: none`, HS256 confusion, tampered payload, garbage; key rotation picked up; certs endpoint down fails closed; bad token plus good password still gets in (no lockout); `ACCESS_REQUIRED` refuses the password but Access still works; header means nothing when unconfigured. Removing the audience check, the signature check and the required check each made it fail. **Not tested:** real Access login and real Cloudflare keys (needs the owner's Zero Trust setup). Free-plan user limit not verified from current docs.
- **Watch for:** Access session lapsing on Mark's phone mid-day: uploads are redirected to the Access login (HTML), which the photo sync already treats as "sign in again", keeps the photo on the phone and retries.

### 2026-09-30 — Nightly D1 backup and morning nudge (companion Worker)

- **Why:** D1 is the transactional truth and had no copy we control; Pages Functions have no cron (the follow-up cadence only syncs when Today is opened). From the Cloudflare services review, #3.
- **Built:** `workers/ops-cron/` (Worker `clearview-ops-cron`, no public URL). Cron `15 10 * * *`: dump every table and index to gzip JSON, write to private R2 bucket `clearview-db-backups` (created today) as `d1/YYYY-MM-DD.json.gz`, verify the stored size, prune to the newest 30 (only dated `d1/` backups are ever deleted); failure pushes "Database backup FAILED" (no error text). Cron `30 15 * * 1-5`: counts open follow-ups overdue / due today (Pacific day, identical to the dashboard's `pacificDayRange`, tested across a full year of DST) and pushes counts only, silent when none. `scripts/restore-from-backup.mjs` turns a backup into SQL for a new empty database; it never touches a database.
- **Status: built, bucket created, NOT deployed.** Deploying the Worker needs a Cloudflare login; owner steps in `internal/README.md` ("Nightly backup and morning nudge"): `wrangler deploy` from `workers/ops-cron`, set secret `LEAD_ALERT_NTFY_TOPIC`, run the backup cron once and confirm the file appears. Until then there is no backup beyond D1 Time Travel.
- **Verified:** `npm run test:ops-cron` (in CI): real SQLite backed up, restored into a second database and compared row for row (quotes/accents/newlines/binary survive, indexes return); 1,234-row paging; empty database refused; short write caught; retention; failure is never silent; no customer text in pushes; wrangler config matches the handler. Broke paging, SQL escaping, the failure alert and retention on purpose: each made the test fail. `wrangler deploy --dry-run` bundles it and resolves both bindings. **Not tested:** real R2/D1 from a live cron (not deployed), real ntfy push from the Worker.
- **Next:** Cloudflare Access for `/internal/*`; then Turnstile keys when the owner creates the widget.

### 2026-09-30 — Spam and abuse protection on the public forms

- **Why:** from the Cloudflare services review (Foundation tier): `/api/estimate` and `/ask/api/*` had only a honeypot. Bots could flood the lead list and burn Gemini/Resend quota.
- **Built:** `functions/_lib/abuse-guard.mjs`. (1) Per-visitor rate limit in D1 (`rate_limits`, fixed window, atomic upsert, IP stored only as a hash): estimate 6/hour, Ask chat 60/hour, Ask handoff 10/hour; 429 with `retry-after` and a "call us" message. (2) Turnstile verification on the estimate form, active only when `TURNSTILE_SECRET_KEY` is set; widget renders only when `site.turnstileSiteKey` is set. Safety rules: unconfigured = off; Cloudflare verifier down = lead let through; D1 down = not limited; widget that fails to load tells the visitor to call; the honeypot still runs first and still answers like success.
- **Status: rate limits are live on deploy; Turnstile is inactive until the owner steps in `internal/README.md` ("Spam and abuse protection") are done** (create widget, put site key in `src/data/site.ts`, add secret `TURNSTILE_SECRET_KEY`, redeploy, send one test estimate). Site key is not known yet, so `turnstileSiteKey` is `''`.
- **Verified:** `npm run test:abuse-guard` (in CI) on real SQLite and the real handlers, including windows, per-visitor and per-bucket isolation, fail-open cases, hashed IP, and deliberate breakage of the limiter and of the Turnstile check to prove the tests fail. Existing `test:estimate` and `test:ask-security` still pass. **Not tested:** the real Turnstile widget and Cloudflare verifier (no keys yet).
- **Next in the agreed order:** D1 nightly backup to R2 plus follow-up reminders (needs a companion Worker with a Cron Trigger), then Cloudflare Access for `/internal/*`.

### 2026-09-30 — Job photos back up to Cloudflare R2

- **Why:** photos lived only in the phone browser's IndexedDB (originals, uncompressed), so a lost, reset or full phone lost the job evidence, and we had just seen that store break on its own (PR 144). Mark asked for photos to go to Cloudflare storage.
- **Design:** R2 (private bucket, no public URL) with a D1 row per photo; served only through the authenticated `/internal/api/job-photos`. Phone-first: save locally, compress, upload in the background, retry on reconnect; nothing is lost if an upload fails. D1/base64 was rejected (size limits, cost); a public bucket was rejected (customers' homes).
- **Status: merge-safe and inactive until connected.** R2 is not enabled on the Cloudflare account (the API says "Please enable R2 through the Cloudflare Dashboard"), and production bindings live in the Pages dashboard, not the repo. **Owner steps** (also in `internal/README.md`, "Job photo storage"): enable R2; create bucket `clearview-job-photos`; Pages → Settings → Bindings → Add → R2 bucket → variable `JOB_PHOTOS` (Production, and Preview if wanted); redeploy. Until then the Photos page says "Not connected yet" and photos stay on the phone; once connected, queued photos upload by themselves. Cost per Cloudflare's published pricing (checked today): 10 GB storage, 1M writes, 10M reads free monthly, then $0.015/GB-month, no download fees.
- **Verified:** real handlers on SQLite with an in-memory R2 and a real Chromium phone session: photo taken before R2 is connected waits; connecting R2 later uploads it (a 5.6 MB original became 1.28 MB at 2000×1333 with job/opening/stage attached); a second device sees the photo and can edit its note; an offline capture queues and uploads when back online; deleting a backed-up photo removes the cloud copy; a non-image is refused. The browser run caught one real bug in my own edit (a variable read before it was defined, which broke capture), fixed before merge. **Not tested:** the real R2 service (not enabled) and a real phone camera.
- **Follow-ups (not built):** make the Field-mode Photograph gate count R2 photos instead of phone-reported counts; show R2 counts in Field mode; a thumbnail size for big galleries; a lifecycle/retention decision for photos of finished jobs.

### 2026-09-30 — Command Center: day-one database fix

- **Method:** the real handlers on a truly empty SQLite database (no seed), every `/internal` page at both sizes: Mark's actual first day after the test records were cleared.
- **Bug (fixed):** on a brand-new database the first dashboard or Today request returned a 500 ("no such table: jobs"), because only the jobs API ever created the `jobs` table. Production already has the table so nothing is broken today, but a fresh database or environment would have failed on its first visit. The jobs table setup now lives in one place, `functions/internal/_lib/jobs-schema.mjs` (`ensureJobsSchema`, the original statements moved unchanged plus the general-job columns), called by the jobs API, the dashboard, Payments and the copilot summary, so the order pages are opened cannot matter. `npm run test:general-jobs` has a new "day one" group (dashboard, Payments and the jobs list on a database with no jobs table, in any order); it fails with the real error if the dashboard call is removed.
- Everything else on an empty database was clean: no API errors, no script errors, no overflow; empty-state wording reads correctly.

### 2026-09-30 — Command Center: first-run dashboard, shorter phone screens

- The test records were cleared from production, so Mark's first view is an empty dashboard. It now opens with a "Nothing here yet / Add your first customer" panel (New general job, New window quote) whenever there are no leads, quotes, jobs or follow-ups; it stays hidden otherwise and never flashes for a busy account (starts `hidden`). Guard: `npm run test:dashboard-first-run` (in CI).
- The "Workflow / Move a project forward" explainer blocks on the dashboard and Today are hidden on phones (static text, no data); still shown on desktop.

### 2026-09-30 — Command Center: phone touch targets, Field mode nav, labels

- **Audit method:** a script measured every visible interactive element on every `/internal` page at 390 px with touch enabled (the seeded-data setup from the audit below), flagging targets under 40 px and inputs/buttons with no accessible name.
- **Touch targets (fixed):** the buttons Mark taps all day were 31–35 px tall: Call/Done on the dashboard, Today and Follow-up, the quote and invoice card actions (`.btn-small`), the pager, card links like "Open leads →" (18 px), "← All quotes", the payments customer links and "Update payment record". On phones and any touch screen everything is now at least 44 px (Field mode 48 px). One shared rule set in `InternalLayout.astro`; desktop sizing is unchanged. Only a hidden, visually-invisible file input in the Photos tool is still under 40 px, by design.
- **Field mode never got its `field-mode` body class (real bug, fixed).** The layout compared the page path to `/internal/jobs/field` exactly, but the build reports `/internal/jobs/field.html`, so the class was never applied. That class hides the shared bottom nav on the Field page (the crew has their own Previous/Next bar, which the shared nav sat on top of) and now also carries Field-only touch rules: the execution-gate checkboxes were 28 px tall and the measurement inputs 28 px; both are 48 px now. `test:internal-styles` reads the built HTML (when a build exists) and fails if Field mode loses the class or any other page gains it.
- **Accessible names:** added `aria-label`s to the notes textareas (job page, Field mode, measurements) and to the Field mode material name/quantity inputs (they had only placeholders).
- Re-ran the full-data tour after the changes: no overflow, no script errors, no API 5xx at either size.

### 2026-09-30 — Command Center: full-data audit, two real bugs fixed

- **Method:** real handlers on real SQLite, seeded through the APIs (leads, a signed window quote with an approved Build Plan and a scheduled job, an invoice, partial payments, two general jobs, follow-ups), then every `/internal` page screenshotted at 390 px and 1280 px with overflow, script-error and 5xx checks. Earlier audits used empty or guessed data.
- **Field photos could break for good (fixed).** Field mode opened the shared IndexedDB `clearview-field-tools` at version 2 without creating its `photos` store. On a phone that opened Field mode before ever opening the Photos tool, the empty database was left at v2, the upgrade never ran again, and every photo read/write threw "object store not found". Reproduced, then fixed with one shared opener, `src/lib/field-photo-db.ts`, used by both pages: it creates the store for a new database and repairs an already-broken one by bumping the version (existing photos kept). Verified in Chromium for a fresh profile, an already-broken database, and a healthy one with a photo in it (saving a photo works in all three). `npm run test:field-photo-db` (in CI) fails if any other file opens that database directly. **Mark's phone may already be in the broken state**; opening Photos or Field mode once after this deploys repairs it.
- **Quote view toolbar ran off the screen on phones (fixed).** Six buttons in one unwrapped row made the page 507 px wide on a 390 px phone. It now stacks under the back link with the buttons in two columns.
- Everything else in the tour was clean: no overflow, no script errors, no API 5xx on any page at either size.

### 2026-09-30 — General (non-window) jobs in the Command Center

- **Why:** Clearview takes non-window work and Mark has a few such jobs lined up. The pipeline assumed windows: a quote could not be finalized or become a job without an approved window Build Plan, closing a job required a window checklist, and customers only existed as inbound estimate requests.
- **Decision (owner):** track-only. Mark adds the customer and the job directly: customer, free-text type of work, agreed amount, optional contract-signed date, optional start date/window, notes. No quote, no Build Plan, no in-app signing; his own paper is the agreement. Window behavior is unchanged.
- **What changed:** `/internal/jobs/new` (form), "New general job" on `/internal/jobs`, job rows show the type of work, `/internal/jobs/view` has a "Work and agreement" panel (edit customer, type of work, agreed amount, contract date) and hides the quote/Build Plan/closeout sections for general jobs. Payments, the dashboard "active job value" and the jobs list use the agreed amount as the total. General jobs can be marked Completed without the window checklist. Analytics: general jobs are excluded from the quote→job funnel but their payments count in Collected, with a note on the Collected tile.
- **Schema:** four lazy columns on `jobs` (`work_type`, `work_description`, `agreed_cents`, `contract_date`), added by `ensureGeneralJobColumns` from the jobs/payments/dashboard endpoints. No migration step.
- **Verified:** `npm run test:general-jobs` (real SQLite: validation, create incl. double-tap, edit, completion, payments totals, dashboard, analytics, old-table deploy order; two deliberate breakages were caught) and a browser run on a phone viewport against the real handlers: create → job page → edit → complete → Payments → Jobs list.
- **Contact import (same PR):** "Import from contacts" (browser Contact Picker; only shown where the browser supports it, e.g. Chrome on Android) and "Import a contact file (.vcf)" (works on every phone; iPhone: open the contact → Share Contact → Save to Files → pick the file). Fills name, phone (mobile preferred), email, address and city on `/internal/jobs/new`; a file with several contacts shows a chooser. All parsing is in the browser (`src/lib/contact-import.ts`); nothing is saved or sent until Mark saves the job. iPhone Safari has no Contact Picker, so the file route is the only path there. Verified in Chromium with a fake picker and real vCard files (single, multi-contact, invalid); the real Android picker dialog itself is **not** tested here, so Mark should try it once on his phone.
- **Owner follow-ups:** (1) if Mark wants priced quotes/invoices for these jobs later, say so and decide what contract terms apply (nothing is invented here); (2) no separate customer list or follow-up tasks for these customers yet; (3) whether Clearview's contractor registration covers each type of work Mark takes is a licensing question for Mark, not something this app checks.

### 2026-09-30 — Command Center UI polish (shared layer)

- Audited every `/internal` page at 390 px and 1280 px (Chromium, API mocked empty; no horizontal overflow on any). Fixed in `src/layouts/InternalLayout.astro` so all pages inherit it: controls now use the Outfit typeface (buttons/inputs were falling back to system fonts); radios and checkboxes keep their own width (the site-wide `input{width:100%}` was squeezing labels like "Builder / GC" and "Sign on screen now" into narrow columns on `/internal/quotes/new`); the `.list-pages` pager under quotes/jobs/follow-up had no styles and is now a proper control row.
- Phone stat cards on the dashboard, Today and Follow-up now run two across (were one per row, which made the dashboard ~3,600 px tall).
- **Runtime-rendered rows were unstyled (real bug).** Astro scopes a page's `<style>` to its own markup with a `data-astro-cid` attribute; rows/cards built by script (innerHTML/createElement) never get it, so their rules silently did nothing. `/internal/quotes` (quote cards), `/internal/schedule` (day columns), the dashboard rows and several job/invoice/payment/tool screens were affected. Fixed by wrapping those selectors in `:global(...)` (274 selectors across 19 pages; only insertions of `:global(` and `)`, verified mechanically). **New guard:** `npm run test:internal-styles` (in CI) fails when a class created in a page's script is styled only by a scoped rule. Rule for next agent: any class you create in JS on an internal page needs a `:global(...)` rule. Verified visually with mocked data: Quotes, Jobs, Invoices, Schedule, Dashboard (phone + desktop). **Not visually verified** (no mock data): Payments cards, Invoice view, Job view/prepare/closeout/field/hardening, Build plan editor/visualizer, Measurements, Photos, Copilot, Lead analyze. Mark should click through those once.
- Payments stat cards now 2-up on phones; the dashboard's overdue marker no longer stretches into an oval (the layout's `.is-overdue` border/padding leaked onto it).
- Not changed: page structure, data, copy. Next candidates if Mark wants more: the always-on "Workflow" explainer blocks on Today/Dashboard, stacked page-action buttons on `/internal/jobs` at phone width.

### 2026-09-30 — Analytics charts for Mark

- `/internal/analytics` now draws its data as charts (phone-first, SVG, no chart library): requests→quotes→signed→jobs funnel, signed $ by source, lead sources and traffic channels (donuts), landing pages and top pages (bars), leads per week (columns), GA4 sessions/visitors per day (lines, tap/hover for values). Rates and needs-attention stay as text. Builders: `src/lib/charts.ts`; tests: `npm run test:charts` (in CI) and the extended `test:analytics` (GA4 `daily` series). Sources table no longer stacks letters vertically on phones (min widths). Empty data shows a plain "nothing yet" line instead of an empty chart.
- Constraint for next agent: the analytics page test forbids `innerHTML`/`insertAdjacentHTML`; keep mounting SVG through DOMParser.

### 2026-09-28 — internal Analytics page, Nextdoor share link

- **`/internal/analytics`** (Command Center nav, behind the session middleware, never cached). *Where leads came from* is counted from first-touch attribution already stored on each lead in D1 (`functions/internal/_lib/lead-sources.mjs`), so it needs no setup. *Site traffic* reads the GA4 Data API through `functions/internal/_lib/ga4.mjs` (service-account JWT, read-only scope, fail-soft: `unconfigured` / `unavailable`, never echoes keys or upstream bodies). It shows "Not connected" until `GA4_PROPERTY_ID` and `GA4_SERVICE_ACCOUNT_JSON` are set; the step-by-step setup is in `internal/README.md` ("Analytics"). Tests: `npm run test:analytics` (wired into CI).
- **GTM has no reports of its own**, so its numbers are the GA4 numbers. **Ahrefs is a link only:** Mark is on the free Webmaster Tools plan, which has no API (API units come with paid Lite and up). Revisit if a paid plan is added.
- **Nextdoor:** guides carry a plain "Share on Nextdoor" link using Nextdoor's Share Plugin (`nextdoor.com/sharekit/`; no script, no application, nothing sent until clicked, so no privacy-policy change). Mark runs no Nextdoor ads, so the Conversions API (needs approval from Nextdoor and an ads account plus pixel ID) was not built. The Publishing API is approval-based and "primarily for advertising partners"; apply via Nextdoor's Publishing API form only if posting to Mark's business page from the site becomes worth pursuing.
- **Still to do outside the repo:** the GA4 service-account setup (Google Cloud + GA4 property access + two Cloudflare variables), assigned to Cowork.

### 2026-09-29 — Analytics: requests-to-revenue pipeline

- `/internal/analytics` now opens with **Requests to revenue** (last 90 days), counted from D1 with no setup: estimate requests, quotes written (+ $ quoted), quotes signed (+ $ signed, by `signed_at`), jobs (non-cancelled) and completed, and $ collected (`job_payments` on jobs created in the window). Rates: quotes per request, signed per quote, median days quote→signature, average signed quote. *Needs attention*: draft quotes older than 14 days (all-time backlog, with $) and finalized quotes with no job (exact SQL `NOT EXISTS`).
- Logic lives in `functions/internal/_lib/pipeline-summary.mjs` (pure, integer cents). The endpoint returns aggregates only (no names/ids) and fails soft per table: no `jobs` table → jobs unknown; no `job_payments` → collected unknown (not $0).
- **Lead → quote link (`quotes.lead_id`, `quotes.lead_linked_at`).** Added to `internal/db/schema.sql` and migrated lazily on production by `ensureQuoteLeadColumn()` (`functions/internal/_lib/lead-links.mjs`; `ALTER TABLE` is idempotent, existing quotes stay unlinked). *Start quote* on `/internal/leads` now saves the link (`POST /internal/api/quotes` accepts `leadId`, rejects unknown/invalid ids). The quote page shows the linked inquiry or **exact phone/email match suggestions** that Mark must click to link (`GET/POST /internal/api/quote-lead`); nothing is ever auto-linked. Unlink is available. The link is attribution metadata only and never touches contract fields, so it works on finalized quotes. The leads list shows *Open quote* when a lead already has one.
- **Traced attribution:** *Which sources bring paying work* on `/internal/analytics` credits requests, quotes, signed $ and collected $ (quote → job → `job_payments`) to the linked inquiry's first-touch source, and shows how many quotes in the window are still unlinked. Quotes made before this change need linking from their quote page to count.
- Tests: `scripts/test-analytics-pipeline.mjs` (`npm run test:analytics`) and `scripts/test-lead-links.mjs` (`npm run test:lead-links`, in CI), both on real SQLite via `scripts/_lib/d1-sqlite.mjs`.

### 2026-09-29 — Quote follow-up cadence

- Draft quotes now get an automatic reminder in Mark's queue at **day 2, 7 and 14** after they were written (`functions/internal/_lib/quote-follow-ups.mjs`). Reminders are `follow_up_tasks` rows with `quote_id` + `cadence_step` (`created_by = 'system'`), guarded by a unique index so a step is created at most once. At most one open reminder per quote; an old draft gets one reminder (latest due step), not three. Signing or deleting the quote closes its open reminders.
- No cron: `syncQuoteFollowUps()` runs when `/internal/api/tasks` or `/internal/api/dashboard` is read (Today, Follow-up, Command Center), fail-soft. It **never contacts the customer**; the reminder text says so.
- Reminders show the quote's customer name/phone even when the quote isn't linked to a lead, with a *Quote* link on Today and Follow-up.
- Tests: `npm run test:quote-follow-ups` (real SQLite, in CI).
- **Volume check (production D1, read-only):** 0 leads ever, 2 quotes, 0 tasks. The `leads` schema matches the insert, so the form has had no submissions. More pipeline tooling will not change revenue until real requests arrive; the next lever is traffic/outreach, not code.

### 2026-09-29 — Customer quote signing links

- Mark can send a customer a private link to review and e-sign a quote on their own phone (`/sign#<token>`). The panel on `/internal/quotes/view` creates the link (only for a draft with an approved, current Build Plan), shows sent / viewed N times / signed, and offers Copy, Text (`sms:` from Mark's phone) and Email (`mailto:`). Nothing is sent by the server.
- Security (`functions/internal/_lib/quote-signing.mjs`): 256-bit token stored only as SHA-256; token in the URL fragment (never reaches servers, logs, GA4 or referrers), sent to the API in a header/body; one active link per quote; 30-day expiry; the public view is a field whitelist (no notes, phone, email, lead or ids). The customer submits **stroke coordinates only**; the server range-checks them and renders the SVG, because the internal quote page inserts `signature_svg` as HTML.
- Signing (`functions/api/quote-sign.js`) requires explicit e-sign consent and a typed name, re-runs the approved-Build-Plan gate (now shared in `functions/internal/_lib/quote-gates.mjs`), refuses if the quote's `terms_version` differs from current terms, and finalizes with a conditional UPDATE so it can only happen once. The invoice is finalized, open quote reminders close on the next sync, and an optional ntfy push (`sendOpsAlert`) tells Mark. User-agent is kept as signing evidence; the privacy policy says so.
- `VERIFY` (legal, unchanged): `src/data/contractTerms.ts` is not attorney-reviewed. Remote e-signing makes a lawyer's look at the terms and the right-to-cancel notice more important, not less.
- Next on the gap list: deposits/online payment (needs the Stripe connector authorized).
- Tests: `npm run test:quote-signing` (real SQLite, in CI).

### 2026-09-29 — Install-method terminology removed from customer copy

- **Why:** Mark does not want customers to read "full-frame" as "we tear out your whole window frame." Reference site (thermoloc.co/window-replacement) does not name install methods either: it says "replacement windows" vs "new construction windows" and offers a consultation. Customer copy now says what we can do, and the method is Mark's call at the quote. Public copy also does not name Mark (see the 2026-09-27 boundary).
- **Rule:** customer-facing pages, guides, city pages, JSON-LD and the Ask knowledge index must not use *insert*, *full-frame*, *pocket*, *block frame* or *nail fin* for existing-home replacement. Say "we measure every opening and tell you the right approach in the written estimate." "Nailing-fin" stays acceptable on new-construction copy. Guarded by `npm run test:public-terminology` (in CI).
- **What changed:** `/replacement` (method diagram + four-question card replaced by "What we can do for you"); guide `full-frame-vs-insert` rewritten as `/guides/what-your-openings-need` with a 301 in `public/_redirects`; diagram component renamed `OpeningScope` (`diagram: opening-scope`); city pages, other guides, home, tools index, estimate-sent, terms, `JsonLd`, Ask suggestion chips.
- **Calculator:** the "how much comes out" step is gone. One range for every house, using the old "mixed" assumption (34% of openings get the extra frame-level amount in `pricing.fullFrame`). Numbers in `src/data/pricing.ts` are unchanged, so ranges for a "mixed" house are identical to before; ranges for someone who used to pick "insert" only are now higher, and "full-frame" only lower. `functions/ask/_lib/pricing.mjs` mirrors this (its `method` parameter is removed).
- **Ask assistant:** system prompt has a TERMINOLOGY rule; `compare_installation_paths` returns `simplerScope` / `moreWork` and a note not to name methods.
- **Unchanged on purpose:** Command Center, Build Plan and stored quote data used insert/full-frame internally (renamed to insert/fin on 2026-10-16; old stored plans still read) (`pages/internal/*`, `build-plan-rules.mjs`). Mark picks the method there; renaming stored values would risk saved quotes and jobs.
- **`VERIFY` / outstanding:** `functions/ask/_data/guides-index.json` was patched by hand (old guide's 5 chunks removed, link text fixed) because embeddings need `GEMINI_API_KEY`. Run `GEMINI_API_KEY=... npm run build:guides-index` to re-embed `what-your-openings-need` so Ask can retrieve it. The `estimate_price` mismatch noted here was fixed later the same day (see the Ask price tool entry).

### 2026-09-29 — SEO striking-distance titles and descriptions

- Area pages, `/areas`, `/about`, `/gallery` have new titles (50-60 chars) and descriptions (130-155, with "free in-home measure" and "written estimate"). Area titles are `Window Replacement in {City}, WA | Clearview Windows`; Vancouver is `Vancouver, WA Window Replacement | ...` because the home page already owns the first form. Baseline numbers and follow-ups are in `docs/seo-log.md`.
- Duplicate slash URLs needed no code change: Cloudflare already answers `/x/` with `308 -> /x`, and canonical, `og:url`, sitemap and internal links are slash-free. `/areas/portland/` now also 301s straight to `/areas` (Portland is not served).
- Guard: `npm run test:seo` (after `npm run build`, in CI) checks missing/duplicate/over-length titles and descriptions, canonical == own URL, sitemap == canonical set, and `_redirects` loops. Four older pages exceed the limits and are listed as known exceptions to fix later.
- After merge (Keith): Search Console URL Inspection → Request Indexing for the changed pages; re-check clicks/impressions/CTR/position at 14 and 28 days.

### 2026-09-29 — Bug sweep (forms, mobile layout)

- **Estimate form phone validation was silently off.** The phone input's `pattern` used `[\s.-]`; an unescaped `-` in a character class is a SyntaxError under the `v` flag browsers use for `pattern`, so the browser skipped the check (`abc` and `555` passed client-side; only the server caught them). Escaped to `[\s.\-]`. Guard: `npm run test:form-patterns` (after `npm run build`, in CI) compiles every built `pattern` with the `v` flag.
- **Horizontal scroll on phones** (checked all 63 built pages at 320 and 375 px in Chromium): `/new-construction` (long email in a `.steps` item), the cost calculator at 320 px (fieldset and counter rows), `/about` at 320 px (a ~48 px headline word), and two Command Center pages (`/internal/analytics` grid, `/internal/ask-logs` header). All fixed with `min-width: 0` / wrapping; no page overflows at either width now. There is no CI check for this (needs a browser); rerun the sweep after big layout changes.
- Also checked, no change needed: internal links (0 broken across the built site), console errors and failed requests on every public page, image alt text, duplicate ids, `_blank` links.

### 2026-09-29 — Bug sweep follow-up (calculator handoff)

- The live cost calculator built a `scope` query for `/estimate`, but the estimate form removed that query without adding it to project notes. The handoff now prefills notes from the bounded scope query (or the same-tab session value), shows the existing prefill hint, and consumes the stored scope once. No estimate was submitted during verification.
- Verified the full calculator → estimate flow locally in the browser with one double-hung window; the notes show `1 opening: 1 double-hung. Material: Vinyl`. Regression guard: `npm run test:recent-fixes`.

### 2026-09-29 — Ask price tool restored; production check

- **`estimate_price` (Ask) was broken.** The tool declared `openings` ('1'/'2–5'…), `home_type`, `complexity`, but `estimatePrice()` needs `lines`, so every call errored. Production `ask_logs` shows it worked on 2026-08-28 (4 calls) and has not been called since: a later pricing refactor broke it silently. `functions/ask/_lib/pricing.mjs` now owns the tool declaration (`estimatePriceToolDeclaration()`, enums built from `PRICING`) and the adapter (`estimateFromToolArgs()`, returns a range plus a "planning range, not a quote" note and never names install methods). Bad or missing input returns an error with a hint, never a price. Covered by `npm run test:ask-pricing`.
- **Production D1 check (read-only, schema and aggregate counts only):** `leads` has every column the insert writes and now holds a row from 2026-09-29, so the earlier "0 leads / are leads being written?" `VERIFY` is resolved: the form-to-D1 path works. `follow_up_tasks` in production still lacks `quote_id`/`cadence_step` and there is no `quote_sign_links` table yet; both are created lazily by `ensureFollowUpSchema()` / `ensureSigningSchema()` on first Command Center load / first signing link, by design.

## Outstanding

| | |
| --- | --- |
| **Oversize/custom-shape pricing** | `src/data/pricing.ts` carries Mark's own installed pricing (reduced 15% across the board on 2026-10-02 by owner direction; reviewed 2026-10-02) except the oversize/custom-shape modifier, which is still a regional average (also cut 15% for consistency, so it is no longer the published average). Keep `functions/ask/_lib/pricing.mjs` in sync (`npm run test:ask-pricing`). |
| **Canonical-domain mailbox** | Provision and test before changing production mail defaults. |
| **`ADMIN_TOKEN`** | Optional; worker pricing writes remain closed while unset. |
| **Google Business Profile** | Exists as of 2026-09-26 ("Clearview windows and trim LLC", managed by Keith, 5.0 / 1 review). Still needs name/category/service-area disambiguation from `clearviewpdx.com` (see 2026-09-16 audit follow-up above). Reviews feed built, waiting on the Places API key + Place ID. |
| **Single-color logo glyph** | Commission a simplified flat glyph for embroidery/engraving/one-color applications. |

## How I like to work

- Verify rather than assert — build it, run it, inspect it, then say it works.
- Say plainly when something cannot be done honestly, then build the nearest thing that can.
- Flag your own bugs rather than quietly patching them.
- Push to `main`; Cloudflare Pages deploys automatically.


## 2026-10-03 — Internal queue reliability (PR #182 continuation)

Jobs status filtering moved into the existing API before pagination; `activeTotal` is an all-queue count. Follow-up requests now use `status=open` and read `summary.open/today/overdue` from the API, not from the current page. Pacific day boundaries moved to `functions/internal/_lib/pacific-day.mjs` with the dashboard export preserved. Both clients discard late responses and recover an emptied last page; failed queue saves have a visible error outside the Add form. PATCH `dueAt:null` clears the date. Regression checks live in `test:command-center`; pagination fixtures use isolated databases to avoid cadence-generated reminders changing expected totals. No bindings or migrations required. Browser and real-iPhone visual checks remain VERIFY; these changes are on PR #182, not main.


## 2026-10-03 — Schedule and quote discovery (PR #182 continuation)

The jobs list API now supports a validated 1–31 day from/to interval (inclusive start/exclusive end), used by Schedule to query only its week before pagination and read every matching page. Calendar anchors come from Pacific business dates and use UTC calendar arithmetic. Quotes accept status/search before pagination; the quote-item subquery uses identical filters and stable ordering, so freshness checks remain correct. Quote search resets pagination, debounces and cancels pending requests. Jobs loads all finalized-quote pages into the creation dropdown. No migrations/bindings required. Tests execute both loaders and real SQLite filters/freshness. Browser/iPhone verification remains pending; changes stay in PR #182.
