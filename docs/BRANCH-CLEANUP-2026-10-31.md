# Branch cleanup, 2026-10-31

**Status: approved by the owner, not yet run.** The assistant session cannot delete branches (its git access is limited to its own branch), so run this from a normal clone. It deletes a branch only if its tip is still the commit recorded in the table below, so anything pushed since is skipped:

```bash
git fetch --prune origin
grep -E '^\| `' docs/BRANCH-CLEANUP-2026-10-31.md | sed -E 's/^\| `([^`]+)` \| `([0-9a-f]+)`.*/\1 \2/' | while read -r b sha; do
  [ "$(git rev-parse --short=12 "origin/$b" 2>/dev/null)" = "$sha" ] && git push origin --delete "$b"
done
```

Add `echo` before `git push` for a dry run. Branches deliberately kept (not in the table): `claude/construction-photo-resolution-uh5cta` and `fix/job-snapshot-reconciliation-nav` (commits after their PR merged), `worktree-agent-a5389bf45ba767831` (PR closed unmerged), `codex/clearview-brand-refresh`, `feature/google-reviews-feed` and `icm-alignment-2026-10-01` (no PR).

Remote branches proposed for deletion because every one was fully merged through a pull request, with no commits newer than that merge. Git history cannot show this (the repo squash-merges, so merged branches still look hundreds of commits ahead of `main`); the pull request record is the source of truth.

If deleted, restore any branch with: `git push origin <sha>:refs/heads/<branch>`. A branch can also be restored from its pull request page ("Restore branch").

123 branches proposed.

| Branch | Last commit | PR |
|---|---|---|
| `audit/unit2-quote-sign` | `1925107122da` | #156 |
| `audit/unit4-public-pages` | `6a246909b348` | #162 |
| `claude/1-window-job-quote-contract-8fl5yx` | `69de0bbd8d95` | #247 |
| `claude/amazing-volta-n93yt5` | `5f4d2cdd1445` | #115 |
| `claude/area-pages-city-depth-20260904` | `f19a37419f8f` | #62 |
| `claude/ask-audit-fixes` | `1b035e143b43` | #85 |
| `claude/ask-markdown-table-rendering` | `1d118cda765c` | #87 |
| `claude/awesome-gauss-6czi5n` | `b0457349e2f6` | #120 |
| `claude/batch-fix-core-test` | `efee713a620f` | #318 |
| `claude/batch-guard-jobs` | `54c06231818f` | #311 |
| `claude/batch-guard-misc` | `68b0573e95ed` | #312 |
| `claude/batch-guard-quotes` | `e47cc920133c` | #309 |
| `claude/batch-handler-tests-ai` | `b63ac04e7053` | #310 |
| `claude/batch-handler-tests-core` | `4a6702dbad4b` | #308 |
| `claude/batch-pages-daily` | `242866bd98ee` | #319 |
| `claude/batch-pages-jobs` | `eae698f2b8b7` | #314 |
| `claude/batch-pages-quotes` | `dee34721c4d7` | #313 |
| `claude/batch-pages-reports` | `fcab627be2fd` | #317 |
| `claude/batch-pages-tools` | `b5056ac79a25` | #315 |
| `claude/batch-quote-view-hardening` | `44ecf33a369a` | #316 |
| `claude/batch-wave0` | `24756d5b85bd` | #304 |
| `claude/best-photos-first-2026-10-11` | `e8b3bd5b9d82` | #207 |
| `claude/bug-sweep` | `63be1de04117` | #127 |
| `claude/bug-sweep-repair-ub27ah` | `e28c7846eb0d` | #286 |
| `claude/builder-gc-landing-pages-zclawc` | `cb91f881b92b` | #70 |
| `claude/chat-count-and-login-timing-fixes` | `8063a888f59c` | #84 |
| `claude/codebase-audit-assessment-lnek0g` | `0e5126883ccd` | #74 |
| `claude/cool-mayer-t3mvrl` | `a4a60add0366` | #116 |
| `claude/copy-audit-fixes` | `d7ecc4c64496` | #100 |
| `claude/estimate-flow-audit` | `2aa2ec22eedd` | #54 |
| `claude/estimate-page-ux-fixes` | `31c23c5a242f` | #79 |
| `claude/estimator-base-prices` | `502cca8b0827` | #173 |
| `claude/estimator-mobile-overlap-fix` | `f876657ec925` | #88 |
| `claude/fin-is-a-label` | `e7793de140b7` | #250 |
| `claude/fix-ask-price-tool` | `2cad5581705e` | #128 |
| `claude/fix-internal-sitemap-leak` | `b7199bd71e93` | #71 |
| `claude/gallery-no-counts-2026-10-11` | `646fe512ddb2` | #208 |
| `claude/guide-thumbnail-photos` | `61d6eba38e1a` | #69 |
| `claude/hero-photo` | `44a9dcf5f62d` | #126 |
| `claude/hero-photo-upscale` | `b6e10033b8b4` | #174 |
| `claude/hero-video-cycle-delay` | `cc890766ae9f` | #41 |
| `claude/home-siding-tile` | `c3e1bc872f69` | #272 |
| `claude/inspiring-lamport-1px215` | `d5e36c11dd65` | #163 |
| `claude/internal-pwa` | `5e31fbc3a697` | #176 |
| `claude/internal-pwa-auto-update` | `5d2698bf8433` | #178 |
| `claude/internal-pwa-hardening` | `db42350f9c90` | #177 |
| `claude/internal-quality-pass` | `2a4d74ac6c79` | #181 |
| `claude/jolly-mccarthy-62izeo` | `7616758fac3d` | #153 |
| `claude/keen-pasteur-j0dj1h` | `dfb6f9e09f13` | #167 |
| `claude/logo-video-cycling-cqqg2b` | `e98f8a099dc2` | #63 |
| `claude/mail-pilot-internal` | `12a2433e1877` | #193 |
| `claude/mail-pilot-loaded-docs` | `5553206a7df9` | #195 |
| `claude/new-construction-no-diagram` | `124ce62e625c` | #251 |
| `claude/new-photos-2026-10-11` | `e1776d277c98` | #206 |
| `claude/nifty-fermi-n39uyb` | `6ac65d280abd` | #303 |
| `claude/pwa-files-outside-access` | `e0af3d604b19` | #187 |
| `claude/recent-changes-audit-n7wpmf` | `6dd089227747` | #76 |
| `claude/recent-work-newer-photos-2026-10-11` | `25fc4a8cc7b8` | #213 |
| `claude/remove-public-pricing` | `34e31d84e427` | #197 |
| `claude/seo-audit-fixes` | `077cafac1c2b` | #168 |
| `claude/site-audit-functionality-7gg0zv` | `ddf86c90ef28` | #99 |
| `claude/site-ux-audit-49v3wc` | `16de5a8fc440` | #67 |
| `claude/stoic-thompson-egoitx` | `c188b9384b3b` | #244 |
| `claude/sync-ask-pricing` | `1b0f162892da` | #125 |
| `claude/ux-polish-batch` | `fd2575a939f6` | #68 |
| `claude/verify-main` | `072457ef7c62` | #129 |
| `codex/analytics-production-leads` | `68b2b89ab260` | #280 |
| `codex/audit-broken-links` | `6083abe52b33` | #282 |
| `codex/audit-pageview-attribution` | `671629a3a0f5` | #284 |
| `codex/command-center-prospects` | `20778a8d3e67` | #305 |
| `codex/continued-seo-audit` | `4cfef2c63cd0` | #287 |
| `codex/dashboard-reliability-20261003` | `95b01508b188` | #182 |
| `codex/estimate-mobile-conversion` | `fd88b0ef6411` | #330 |
| `codex/follow-up-phone-readability` | `492bfeb2a0d3` | #268 |
| `codex/google-tools-phone-navigation` | `ec31e9f716b9` | #265 |
| `codex/hero-image-priority` | `6fb729f34ba2` | #288 |
| `codex/home-review-bar` | `27e9bb0bcf72` | #324 |
| `codex/internal-permits-page` | `76cb80d3876a` | #292 |
| `codex/jobs-phone-queue` | `ccc12d2291ff` | #262 |
| `codex/leads-phone-context` | `454377cd7963` | #269 |
| `codex/marketing-visual-refresh` | `e982222f9d53` | #297 |
| `codex/measurements-phone-cards` | `917f21083bbb` | #266 |
| `codex/mobile-lcp-rendering` | `38632c79d6df` | #289 |
| `codex/mobile-review-carousel` | `ab8f6f26a570` | #325 |
| `codex/new-con-preparation-copy` | `e3ebd6af709a` | #294 |
| `codex/photos-phone-capture` | `9008a7bf290e` | #267 |
| `codex/plain-installation-wording` | `8e3caf5b1ea6` | #293 |
| `codex/prospect-build-year-cutoff` | `28d2a735bde8` | #307 |
| `codex/prospect-phone-visibility` | `5fbad8ecd998` | #306 |
| `codex/quote-supplier-list` | `5ad5b2c7505b` | #301 |
| `codex/review-autoplay` | `428f6e042f6a` | #326 |
| `codex/review-glide` | `b761b82ee379` | #329 |
| `codex/review-init-guard` | `6575eb3f783e` | #328 |
| `codex/review-resume` | `22f8dccba339` | #327 |
| `codex/service-image-sizing` | `32467a4e2c9d` | #290 |
| `codex/tools-phone-work-first` | `e1d3acbcf015` | #264 |
| `codex/vancouver-prospect-batch` | `0396fd139ac1` | #321 |
| `codex/windows-audit-paths` | `8f73fe6dfcd7` | #263 |
| `faq-stats-rewrite-1` | `c39947b119f8` | #60 |
| `feat/direct-google-review-link` | `1c69617f5fca` | #170 |
| `feat/field-execution-production` | `802beffbeb64` | #81 |
| `feat/hali-review-card` | `d0dd113df4ea` | #192 |
| `feat/job-closeout-flow` | `935fc2ea5ed2` | #82 |
| `fix/lock-finalized-closeout` | `99923d43528e` | #83 |
| `fix/remove-ai-badge-homepage` | `d90c6477d77f` | #59 |
| `fix/seo-redirect-slash-and-about-lni` | `2d6489bb1eda` | #169 |
| `guides/cascade-milgard-vinyl-fiberglass` | `f537f0269711` | #61 |
| `seo/area-pages-titles` | `80b502727126` | #124 |
| `worktree-agent-a120a1aa203eb9044` | `0419273040b9` | #43 |
| `worktree-agent-a136fe5581d95b000` | `45d47292770a` | #52 |
| `worktree-agent-a1f7b29172dc541eb` | `cc2cde8a7345` | #53 |
| `worktree-agent-a5b1269cadd283d78` | `59b40aa3425b` | #49 |
| `worktree-agent-a5f6b65047a3c9f47` | `b6632ec0483d` | #55 |
| `worktree-agent-a674bda63798c2830` | `61e763ba393e` | #160 |
| `worktree-agent-a7d02fbcbd36c129d` | `5e305619ad59` | #44 |
| `worktree-agent-a84130d7b78e2bd86` | `cf5d5aa9909d` | #51 |
| `worktree-agent-a8e0b56499cf595e2` | `cf65d10a8e06` | #159 |
| `worktree-agent-a992a6173b2b14d6c` | `2947d7f427c9` | #161 |
| `worktree-agent-aa4e015d1b5c84da1` | `45396286d857` | #50 |
| `worktree-agent-aaa652611ac9ed987` | `e837bad73eb0` | #57 |
| `worktree-agent-acd84786275d3c229` | `884a7891fbcb` | #45 |
| `worktree-agent-aefc7b1c444603ab7` | `3d5da970459c` | #58 |
| `worktree-agent-afaaf48ff55da62ad` | `73027f32a92b` | #157 |
