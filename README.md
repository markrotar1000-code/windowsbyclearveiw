[![Architecture diagram of markrotar1000-code/windowsbyclearveiw](https://gitdiagram.com/markrotar1000-code/windowsbyclearveiw/diagram.png)](https://gitdiagram.com/markrotar1000-code/windowsbyclearveiw?utm_source=readme&utm_medium=picture)
# Clearview Windows

Marketing site and internal quoting platform for **Clearview Windows**, operated by **Clearview Windows & Trim LLC**. The public site covers replacement and new-construction windows in Vancouver, WA, Clark County, and the surrounding service area.

- **Production:** https://windowsbyclearview.com
- **Stack:** Astro 7, static build, Cloudflare Pages
- **Server-side:** Cloudflare Pages Functions + D1 (R2 for job-photo and backup storage)
- **Internal app (Command Center):** `/internal/*`, phone-first and installable
- **Customer assistant:** `/ask`
- **Companion Worker:** `workers/ops-cron/` (nightly D1 backup, weekday follow-up push)
- **Repository:** `ksksrbiz-arch/windowsbyclearveiw`
- **AI/agent context:** `CLAUDE.md` → `.ai/` (see [AI context (ICM)](#ai-context-icm))

> The repository/domain spelling contains the historical `clearveiw` typo. The customer-facing brand and production domain use **ClearView/Clearview** correctly. Existing operational email addresses should not be changed without an actual mailbox/domain migration.

## Platform status

The platform has been through repeated hardening and bug-sweep passes covering the public marketing site, estimate intake, `/ask`, internal quoting, field photography, invoices, SEO, accessibility, and regression testing. `.ai/STATE.md` is the dated, current snapshot; `.ai/CHANGELOG.md` is the history; `HANDOFF.md` is what the next person needs.

### Production checklist

Items below need the owner's dashboards (Cloudflare, Resend, Google), so a checked box here only means the code and docs are done. When in doubt, confirm on the live site.

- [x] **Washington L&I contractor registration number** — `lniNumber` in `src/data/site.ts` holds the real registration. Never invent a placeholder for `lniNumber`, `insurance` or `bond`.
- [ ] Set `REQUIRE_LNI=1` in the production Pages environment so a future accidental removal fails the build instead of just warning.
- [ ] **`RESEND_API_KEY` on Pages** — required for live estimate delivery.
- [ ] **Internal production bindings** — `QUOTES_DB`, `INTERNAL_PASSWORD`, and `INTERNAL_SESSION_SECRET` configured in Cloudflare Pages.
- [ ] **Turnstile secret** — the widget and its public site key ship; set `TURNSTILE_SECRET_KEY` (Pages secret) to start refusing requests without a valid token (`internal/README.md`, "Spam and abuse protection").
- [ ] **Cloudflare Access** — optional sign-in for `/internal`, built and off until configured. The `*.pages.dev` hostname is not behind Access unless it is added there or disabled; only the app login protects it.
- [ ] **Companion Worker** — deploy `workers/ops-cron/` for the nightly backup and the weekday push (`.github/workflows/deploy-ops-cron.yml`, `internal/README.md`).
- [ ] **Workers AI `AI` binding** — required for `/ask` photo analysis and guide-search embeddings; the rest of `/ask` continues to work without it.
- [ ] **Job-photo R2 storage** — `JOB_PHOTOS` binding; until it exists the photo endpoint answers "not connected yet" and photos stay on the phone.
- [ ] **Reviews** — `/reviews` shows owner-supplied review cards only. The Google reviews feed is built and tested (`npm run test:google-reviews`); set `GOOGLE_PLACES_API_KEY` and `GOOGLE_PLACE_ID` to turn it on.
- [x] **Rate limiting** — durable per-visitor limits (hashed IP, D1 `rate_limits`) cover the estimate form, Ask chat, Ask handoff and the Command Center login.
- [x] **CI** — GitHub Actions runs again (Build, Site smoke, Pricing health, ops-cron deploy).
- [ ] **Real-device pass** — automated browser audits run in Chromium; a real phone, screen reader and live Turnstile submission are still owner checks.

## Local development

Requires **Node 22.23.4 or newer**.

```bash
npm install
npm run dev
```

Before opening a PR, run the full suite and the build:

```bash
npm run test:all   # every test step, in CI order (see "Regression and build testing")
npm run build
```

For a normal static build:

```bash
npm run build
npm run preview
```

`npm run dev` and `npm run preview` are useful for the static site, but they do not reproduce the full Cloudflare Pages Functions environment. Use `wrangler pages dev` when testing `/internal/*` or other server-side bindings.

## Cloudflare Pages

1. Import this repository into Cloudflare Pages.
2. Production branch: `main`.
3. Build command: `npm run build`.
4. Build output directory: `dist`.
5. Attach `windowsbyclearview.com` as the production custom domain.

The public site is intentionally static and does **not** require the Astro Cloudflare adapter. Pages Functions under `functions/` provide the server-side APIs.

The production build is pinned to Node `22.23.4` through `.node-version` and the package engine requirement.

## Project layout

| Area | Location |
| --- | --- |
| Public pages | `src/pages/` |
| Internal application | `src/pages/internal/` |
| Public API functions | `functions/api/` |
| Ask API | `functions/ask/api/` |
| Ask helpers and guide index | `functions/ask/_lib/`, `functions/ask/_data/` |
| Internal APIs/helpers | `functions/internal/` |
| Shared function helpers (abuse guard, etc.) | `functions/_lib/` |
| Site/business data | `src/data/` |
| City content | `src/content/cities/` |
| Guide content | `src/content/guides/` |
| Guide graphics (owner-supplied infographics) | `src/assets/guides/` + `src/components/CanvaGuideEmbed.astro` |
| Diagram components | `src/components/diagrams/` |
| Review content | `src/content/reviews/` |
| Work photography | `src/assets/work/` + `src/data/work.ts` |
| Public static assets | `public/` |
| Companion Worker (backup + follow-up push) | `workers/ops-cron/` |
| Shared pricing validation | `shared/pricing-schema.mjs` |
| Internal tool docs and D1 schema | `internal/` |
| Design/QA/audit notes | `docs/` |
| AI/agent context (ICM) | `CLAUDE.md`, `.ai/` |
| Regression tests | `scripts/test-*.mjs` |
| Live evaluations and browser audits | `scripts/eval-*.mjs`, `scripts/audit-*.mjs` |

## Where to edit content

| What | File |
| --- | --- |
| Phone, email, L&I, service area | `src/data/site.ts` |
| Pricing model | `src/data/pricing.ts` |
| Job photos, captions, alt text | `src/data/work.ts` + `src/assets/work/` |
| City pages | `src/content/cities/` |
| Reviews | `src/content/reviews/` |
| Guides | `src/content/guides/` |
| Guide graphics (infographics) | `src/assets/guides/`, shown through `CanvaGuideEmbed.astro` or `src/components/diagrams/` |
| Contract terms | `src/data/contractTerms.ts` |
| License/insurance/bond disclosure tags | `src/data/site.ts` (`lniNumber`, `insurance`, `bond`) + `src/components/LicenseTag.astro`, `InsuranceTag.astro`, `BondTag.astro` |
| Homepage video | `public/video/logo-reveal-1.mp4` (see `VideoHero.astro` — falls back to a static photo hero when absent) |

### Adding a work photo

1. Put the original image in `src/assets/work/` with a descriptive filename.
2. Import it from `src/data/work.ts`.
3. Add accurate, human-written alt text.
4. Use `featured: true` only when the image belongs in the homepage featured block.

Astro processes images in `src/assets/` at build time. Do not put build-processed work photography in `public/` unless it intentionally needs to ship untouched.

### Adding or replacing a guide graphic

Owner-supplied infographics live in `src/assets/guides/` and render through `src/components/CanvaGuideEmbed.astro` (WebP at several widths, full alt text, the graphic's own footnote as the visible caption).

1. Save the PNG as RGB with metadata stripped, and give it a descriptive filename.
2. Pass `widths` no larger than the source file. A 1536 px source takes `[1000, 1400, 1536]`; the default `[1000, 1400, 2000]` needs a 2000 px source.
3. Write alt text that carries the graphic's actual content, not just its title.
4. If the source is under 2000 px, list its page and file in `SOURCE_LIMITED_GRAPHICS` in `scripts/test-image-delivery.mjs` (the test reads the PNG header, so it cannot hide a downscaled file).
5. Proofread the lettering against the original. AI upscalers (including Higgsfield's 4K upscale) have been tried on these graphics and changed words ("siimmer", "mahufacturer"), so re-export from the source at a higher resolution instead.
6. Do not put dollar figures or invented specs in a graphic; `test:no-public-pricing` and the Non-negotiables in `CLAUDE.md` apply.

### Adding a service area

Add the city markdown file under `src/content/cities/` and add the city to the `nearby` data in `src/data/site.ts` so the site's structured data and About content stay aligned.

## SEO, accessibility, and security

The public layout uses Astro's `ClientRouter` for page transitions and reinitializes page behavior through `astro:page-load` so forms, navigation state, reveal effects, and analytics continue working after client-side navigation.

The public platform includes:

- canonical URLs and Open Graph/Twitter metadata;
- JSON-LD and breadcrumb data;
- sitemap generation with internal routes excluded;
- `robots.txt` protection for internal tooling;
- `noindex, nofollow` on internal pages;
- skip navigation and semantic `<main>` landmarks;
- explicit image alt-text checks, including Astro `<Image>` usage;
- secure response headers in `public/_headers`;
- HSTS, frame protection, MIME sniffing protection, referrer policy, and a restrictive permissions policy;
- no-store behavior for sensitive estimate API responses;
- client-side analytics scheduled away from the critical navigation path;
- optimized hero imagery and metadata-only hero video preload.

The marketing regression suite also checks for unsupported regulated-business claims such as advertising the contractor as “bonded and insured” or inventing an L&I number.

### Credential disclosure tags

`LicenseTag.astro`, `InsuranceTag.astro`, and `BondTag.astro` render small factual disclosure tags (not trust seals) for the WA L&I contractor registration, the general liability insurance policy, and the WA L&I surety bond, in the homepage hero and the site-wide footer. Each is gated on its own `site.ts` field (`lniNumber`, `insurance`, `bond`) and renders nothing when that field is unset — no invented credentials. Visible text is deliberately short ("Insured", "WA Bonded"); the real carrier/policy/bond numbers live in `title`/`aria-label` so a hover, long-press, or screen reader still gets the full disclosure. None of the three ever combine into the literal "bonded and insured" phrase — that phrase is specifically restricted in Washington contractor advertising, and `test:marketing-platform` guards against it.

## Pricing

There are **no dollar figures anywhere on the public site** (owner direction, 2026-10-09). The calculator at `/tools/window-replacement-cost-calculator` is a quote funnel: it collects the project and hands off to `/estimate`. One switch, `publicPricing = false` in `src/data/pricing.ts`, is mirrored as `PUBLIC_PRICING` in `functions/ask/_lib/pricing.mjs`; `npm run test:ask-pricing` fails if they drift, and `npm run test:no-public-pricing` scans the built HTML for dollar amounts.

The price data itself still lives in `src/data/pricing.ts` and feeds the internal quote builder. Each baseline is an **installed cost per opening** for a standard-size, ground-floor, vinyl insert installation. Fiberglass, full-frame installation, second-story access, and custom shapes are modifiers rather than baselines. `functions/ask/_lib/pricing.mjs` is a hand-kept copy for the Ask tool.

To refresh pricing, update `src/data/pricing.ts`, set `basis.source` to `'clearview'` and `basis.reviewedAt` to the real review date. `shared/pricing-schema.mjs` rejects inverted ranges, excessive spreads, missing baselines, out-of-range multipliers and future review dates. The **Pricing health** GitHub Action rebuilds the site monthly and when pricing files change and validates the model the site ships, which doubles as the freshness reminder. (The earlier pricing Worker was never wired to the site and has been deleted.)

## Estimate intake

The public estimate form submits to:

```text
POST /api/estimate
```

The Pages Function validates and sanitizes the submission, logs the lead to D1 (a repeat of the same name, phone, email and notes within 30 minutes is not logged twice), and sends the published Resend templates.

Current protections include:

- `multipart/form-data` enforcement and request-size protection;
- same-origin `Origin` validation when an origin is supplied;
- honeypot spam detection;
- a per-visitor rate limit (6 per hour, hashed IP) and, once `TURNSTILE_SECRET_KEY` is set, Turnstile;
- strict email validation, field-length and control-character normalization;
- capped visitor-journey fields;
- generic error responses that do not disclose provider/template internals, and visitor-safe messages instead of the browser's "Failed to fetch";
- `nosniff`, no-store JSON responses;
- real no-JavaScript fallback redirects to `/estimate/sent` and `/estimate/problem`.

The lead notification and customer receipt use the existing published Resend templates. The lead notification can include a generated vCard.

Current environment variables:

| Variable | Required | Default |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes | — |
| `NOTIFY_EMAIL` | No | `owner@windowsbyclearveiw.com` |
| `RESEND_FROM` | No | `Clearview Windows <estimates@windowsbyclearveiw.com>` |
| `TURNSTILE_SECRET_KEY` | No | unset (widget is cosmetic until set) |
| `LEAD_ALERT_NTFY_TOPIC` | No | unset (push alert off). 20–64 random `[A-Za-z0-9_-]` chars; treat as a secret |
| `LEAD_ALERT_NTFY_SERVER` | No | `https://ntfy.sh` |
| `LEAD_ALERT_NTFY_TOKEN` | No | unset. Bearer token for a protected ntfy topic |
| `GOOGLE_REVIEW_URL` | No | unset. Overrides the review link; otherwise the `GOOGLE_PLACE_ID` write-review form, then the profile share link |

**Speed-to-lead alert.** When `LEAD_ALERT_NTFY_TOPIC` is set, every valid estimate request also sends a high-priority phone push through ntfy. It fires independently of mail delivery and carries no customer data: just "New estimate request" and a tap-through to `/internal/leads`. Setup: install the ntfy app, subscribe to the topic, then set the same topic as a Pages secret.

**Review request.** `/internal/jobs/closeout` shows "Ask for a Google review" after a closeout is finalized. Each job gets one ask, by email (Resend) or by text from Mark's own phone (`sms:` link). The ask is recorded in D1 `review_requests`. It never drafts or suggests review content.

Do not change the legacy `clearveiw` mailbox address merely to correct the spelling; verify and migrate the actual mailbox first.

## Ask — design consultant

`/ask` is a public project-planning assistant. It can answer general window/construction questions, retrieve Clearview's published guide material, calculate a project price range through the pricing tool, search for current industry information, and route visitors to `/estimate` when a firm quote is appropriate.

The assistant uses provider fallback:

- **Groq:** `openai/gpt-oss-120b` for the primary fast path.
- **Gemini:** `gemini-3.6-flash` as the fallback/native function-calling path.

The API limits each turn's message and history size, limits tool rounds, and rate-limits each visitor (60 chat turns and 10 handoffs per hour). Provider failure degrades gracefully rather than crashing the page.

### Knowledge boundaries

The assistant keeps three knowledge tiers separate:

1. **Clearview reference material** — published `/guides` plus controlled business facts. This is the source for Clearview-specific claims.
2. **`estimate_price`** — the only source for numerical pricing. It follows the same published pricing model as the public calculator.
3. **General knowledge/search** — industry information and current public information, never a substitute for Clearview-specific source material.

Competitor names other than Milgard (a brand Clearview installs) are refused. Safety rules explicitly prevent invented dimensions, quantities, specifications, warranties, L&I numbers, regulated-business claims, competitor promotion/comparison, legal advice, and firm final pricing outside the pricing tool.

### Photo analysis

Visitors can attach a window photo. The browser resizes it before sending it as a base64 field. `functions/ask/_lib/vision.mjs` uses the Cloudflare Workers AI `AI` binding for a factual visual description such as visible frame material, style, fogging, or damage.

The visual description is treated as an observation, **not a measurement**. The assistant is explicitly prevented from turning a photo into an assumed opening count or exact price input.

The photo itself is not persisted by the current implementation. Missing Workers AI configuration or quota exhaustion degrades gracefully and does not prevent the rest of the chat turn from completing.

### Retrieval

Guide retrieval is generated at build/development time rather than fetched live on every request.

`scripts/build-guides-index.mjs` reads published guides, splits them into `##` sections, embeds them (default: Cloudflare Workers AI `@cf/baai/bge-m3`; Gemini `gemini-embedding-001` is still supported), and writes the committed index at:

```text
functions/ask/_data/guides-index.json
```

Regenerate after meaningful guide changes:

```bash
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... npm run build:guides-index   # token needs "Workers AI - Read"
```

The index records the model that built it and `/ask` embeds each question with that same model, so
the two can never disagree. Switching models is a deliberate step: build the new index to a
separate file, compare it with `npm run eval:retrieval` (hit rates, score ranges, suggested
`minScore`; see `functions/ask/_lib/embeddings.mjs`), set that model's `minScore`, then commit.
`npm run build:guides-index -- --dry-run` lists the chunks without any network call.

### Ask observability

Ask turns are logged best-effort to the `ask_logs` table in the internal D1 database: metadata (model, tools, guide sources, refused) plus the question and answer, scrubbed of phone numbers, emails, links, street addresses, ZIP codes, long digit runs and "my name is …" by `functions/ask/_lib/log-scrub.mjs`. Rows live 30 days: every insert deletes expired rows, `/internal/api/ask-logs` never returns one, and the nightly `workers/ops-cron` job purges them and leaves the question/answer text out of its R2 backup. The privacy policy (`## The website consultant (/ask)`) states all of this; `npm run test:ask-logs` fails if the code and the policy drift apart. The internal `/internal/ask-logs` screen is protected by the same authentication boundary as the rest of the internal application.

### Ask testing

Run the live evaluator with:

```bash
node scripts/eval-ask.mjs [baseUrl]
```

The evaluator covers guide grounding, business facts, regulated-claim refusals, pricing behavior, general questions, off-topic handling, photo measurement guardrails, project-state extraction, and multi-turn continuity.

Security-specific endpoint checks are available with:

```bash
npm run test:ask-security
```

## Internal Command Center

The internal application lives under `/internal/*`, is phone-first, installable as an app (`.ai/references/internal-pwa.md`), and is not part of the public marketing surface. The working order is **Today → Leads → Quotes/Invoices → Jobs → Payments**.

The root dashboard at `/internal/` is the **Command Center**: a compact view of recent leads, quote counts and value, lead sources, and links to the tools. It reads through a server-side aggregation endpoint rather than downloading every record to the browser. Lead weeks and "today" use Pacific time.

The internal workflow supports:

- lead management and a lead analyzer (AI proposes, a person decides);
- quote creation and editing, line-item pricing, contract generation, digital or print/manual signatures, and follow-ups;
- opening/build-plan state, field measurements, opening and closeout evidence, field photography;
- jobs, closeout gates and completion;
- payment and invoice tracking;
- analytics, permit leads, a licensed supplier permit list and the direct-mail pilot (see `internal/README.md`; address and phone data never go in git);
- Google tools (Search Console, Business Profile, reviews and others; activation is the owner's);
- the operations copilot and Ask logs.

### Production bindings

Configure these in Cloudflare Pages → **Settings → Bindings/Environment** as appropriate:

| Name | Type | Purpose |
| --- | --- | --- |
| `QUOTES_DB` | D1 | Leads, quotes, invoices, internal state, Ask logs, rate limits |
| `INTERNAL_PASSWORD` | Secret | Internal login password |
| `INTERNAL_SESSION_SECRET` | Secret | Signs the internal session cookie |
| `JOB_PHOTOS` | R2 binding (optional) | Job-photo backup |
| `AI` | Workers AI binding | `/ask` photo analysis and guide-search embeddings |
| `AI_GATEWAY_URL` | Environment variable (optional) | Routes Groq/Gemini calls through Cloudflare AI Gateway |
| `AI_GATEWAY_TOKEN` | Secret (optional) | Only if the gateway has authentication turned on |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ACCESS_REQUIRED` | Variables (optional) | Cloudflare Access sign-in (`internal/README.md`) |
| `TURNSTILE_SECRET_KEY` | Secret (optional) | Turnstile enforcement on the public forms |
| `RESEND_API_KEY` | Secret/environment variable | Email delivery |

The root `wrangler.toml` is for local development and does not configure the real production Pages bindings. `internal/README.md` is the full setup guide for every item above, the backup Worker, and the optional data tools.

### Local internal development

```bash
npm run build
npx wrangler d1 execute QUOTES_DB --local --file=internal/db/schema.sql
npx wrangler pages dev dist \
  --d1 QUOTES_DB=4700b6f7-c3d8-46c9-9b19-17cf34accb84 \
  -b INTERNAL_PASSWORD=devpassword \
  -b INTERNAL_SESSION_SECRET=devsecret \
  --ai AI
```

`npx astro dev` and `astro preview` do not provide the full Pages Functions environment, so use `wrangler pages dev` for internal/API testing. To drive every internal page in a real browser over seeded data (including a pass with the API failing, which every screen must survive by saying it could not load, and a pass that does the everyday actions: complete and add a follow-up, save a quote, record a payment, create a job), use `scripts/audit-command-center.mjs` (needs Playwright; not in CI).

### Internal data rules

A quote remains editable until it is finalized. Once a quote/contract is finalized, the application deliberately removes the normal edit path so a signed contract cannot be silently altered.

Completion requires the server-side finalized Closeout state. Field verification also requires the required measurement gate. Client UI state is not treated as the authoritative source for these release decisions.

Original field photos stay browser-local unless the optional R2 backup (`JOB_PHOTOS`) is connected. The application maintains photo manifests and gates around the evidence workflow, but a server cannot independently prove the existence of a browser-local image.

The internal application uses a single shared login (rate limited: 10 attempts per 15 minutes) for the intended single-operator workflow, with optional Cloudflare Access for per-person sign-in. It does not provide a full actor audit trail.

Contract language has not received attorney review. Do not treat it as a substitute for legal review.

## Regression and build testing

Run the full local checks before considering a platform change complete:

```bash
npm run test:all   # runs every CI test step in CI order (scripts/run-all-tests.mjs)
npm run build
```

`test:all` has 62 steps and mirrors `.github/workflows/build.yml`: ICM structure and routing, build-plan state, production hardening, marketing/SEO/accessibility, Ask security/pricing/handoff/logs, internal Command Center and quoting flows, layout and text guards, duplicated-fact guards, image delivery, offline/PWA, abuse guard, and the ops-cron Worker. Run one step on its own with `npm run test:<name>`; the scripts are listed in `package.json`.

Notable guards:

| Script | Purpose |
| --- | --- |
| `test:icm-structure` | `CLAUDE.md` stays a router (80 lines max); paths named in `.ai/` exist |
| `test:marketing-platform`, `test:seo`, `test:siding` | Public routing, SEO, accessibility, forms and regulated-claim checks |
| `test:no-public-pricing` | No dollar figures in the built public HTML |
| `test:layout-guards`, `test:text-gaps`, `test:a11y-names` | Layout, text-size, wrapping and accessible-name guards |
| `test:image-delivery` | Photo and guide-graphic widths, `sizes`, metadata; guide graphics under 2000 px must be listed as source-limited |
| `test:duplicated-facts` | Values kept equal by hand (contract terms version and hash, phone, domain) |
| `test:abuse-guard` | Rate limits and Turnstile |
| `eval:ask`, `eval:build-plan`, `eval:retrieval` | Live or model-backed evaluations (Ask needs a running server) |

Browser tools that are not in CI (they need Playwright): `scripts/audit-command-center.mjs`, `scripts/audit-a11y.mjs`, `scripts/audit-image-delivery.mjs`.

### CI

GitHub Actions runs **Build** (the test suite then the production build, then the built-site checks), **Site smoke**, **Pricing health** and the **ops-cron deploy**. Local runs remain the first gate; the Cloudflare Pages preview is the independent build signal.

## Deployment notes

For a normal Pages deployment, push to `main` after local tests/build are clean. Cloudflare Pages performs the Astro build and publishes `dist`.

For companion Worker (`workers/ops-cron/`) changes, merging to `main` deploys it through `.github/workflows/deploy-ops-cron.yml` once the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets exist (until then the step is skipped); setup is in `internal/README.md`.

For guide-content changes that affect Ask retrieval:

```bash
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... npm run build:guides-index
git add functions/ask/_data/guides-index.json
git commit -m "docs: refresh Ask guide index"
```

After changes to `/ask`, pricing, internal gates, estimate intake, or authentication, run both the relevant static regression suite and the appropriate live evaluator/browser smoke test.

## Known gaps / deliberate follow-ups

These are tracked deliberately rather than hidden behind optimistic documentation:

1. **Real-device verification** — automated browser audits run in Chromium; a real phone, screen reader and live Turnstile submission are still owner checks.
2. **Field-photo durability** — original photos are browser-local until the R2 `JOB_PHOTOS` backup is connected.
3. **Shared internal login** — appropriate for the current single-operator model; Cloudflare Access (optional) adds per-person sign-in. The `pages.dev` hostname is only protected by the app login unless it is added to Access or disabled.
4. **Legal review** — contract language needs professional review before being treated as legally authoritative.
5. **Credential wording** — the license/insurance/bond disclosure tags ship on real, verified numbers, but the exact wording has not had a formal L&I/attorney sign-off (see `HANDOFF.md`). Never invent a placeholder value for any of the three.
6. **Guide graphics** — most are 1536 px with no phone-sized version, so their small text is hard to read on a phone and soft on 2x screens; the double-pane graphic's subtitle and the flashing graphic's first letter need a clean re-export from Mark's source. AI upscaling was tried and rejected because it changed lettering.
7. **Open owner decisions** are listed in `HANDOFF.md`.

## Important principle

This repository intentionally favors **fail-closed behavior for authoritative business state** and **graceful degradation for optional external services**:

- signed/finalized internal records cannot be silently rewritten;
- server-side gates outrank client UI state;
- pricing comes from a validated source;
- Clearview-specific Ask claims require controlled reference material;
- optional AI/email services fail gracefully instead of taking down the site;
- public/internal boundaries are enforced both in routing and metadata;
- regression tests are kept alongside the fixes they protect.

## AI context (ICM)

The repository is organized for AI agents with the Interpretable Context Methodology: a root `CLAUDE.md` router (routing only, 80 lines max), `.ai/` for context, rules, references, workflows and specialists, and D1 as the only home for business records. Each workflow under `.ai/workflows/` declares Input / Process / Output / Stop conditions / Completion. Start at `CLAUDE.md`, then `.ai/CONTEXT.md`. A change is done when it is implemented, documented, validated, and `.ai/STATE.md`, `.ai/CHANGELOG.md` and (if needed) `HANDOFF.md` say what changed and what remains. `npm run test:icm-structure` enforces the layout.
