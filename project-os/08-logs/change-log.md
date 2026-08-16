# Change Log

Record every meaningful project change.

## Template

### YYYY-MM-DD HH:MM — Change Title

**Changed by:** Human/Agent/Tool

**Files changed:**
- file path

**Summary:**
What changed and why.

**Tests run:**
- test/check

**Result:**
Pass/Fail/Not run

**Risks remaining:**
- risk

**Next action:**
- action

### 2026-05-31 15:30 - Creative Skills Library Upgrade (Frontend + 3D)

**Changed by:** Codex

**Files changed:**
- project-os/09-agent-skills/frontend-design-skill.md
- project-os/09-agent-skills/3d-design-skill.md
- project-os/09-agent-skills/ui-design-skill.md
- project-os/09-agent-skills/graphic-design-skill.md
- project-os/09-agent-skills/reference-art-direction-skill.md
- project-os/09-agent-skills/video-generation-skill.md
- project-os/09-agent-skills/video-editing-skill.md
- project-os/09-agent-skills/digital-stationery-design-skill.md
- TEMPLATE_MANIFEST.json
- README.md

**Summary:**
Added dedicated frontend design and 3D design skills, updated related creative skills to enforce anti-generic output rules and 3D decision flow, and refreshed template manifest and README metadata.

**Tests run:**
- Verified new skill files exist in `project-os/09-agent-skills`
- Verified `TEMPLATE_MANIFEST.json` version and file count
- Verified no source application code files were added or modified

**Result:**
Pass

**Risks remaining:**
- Existing users of previous verbose skill versions may need a quick review to align wording with this updated concise format.

**Next action:**
- Run a simulated prompt set against the updated skills to validate instruction quality and coverage.

### 2026-05-31 16:05 - Skills Library Upgrade v1.4 (Video-To-Website)

**Changed by:** Codex

**Files changed:**
- project-os/09-agent-skills/video-to-website-skill.md
- project-os/09-agent-skills/frontend-design-skill.md
- project-os/09-agent-skills/video-generation-skill.md
- project-os/09-agent-skills/video-editing-skill.md
- project-os/09-agent-skills/3d-design-skill.md
- project-os/09-agent-skills/reference-art-direction-skill.md
- TEMPLATE_MANIFEST.json
- README.md

**Summary:**
Added a dedicated video-to-website skill for scroll-driven canvas storytelling workflows and cross-referenced it across frontend, video, 3D, and reference skills. Updated template version metadata to v1.4.

**Tests run:**
- Verified new skill file creation
- Verified cross-reference insertion in targeted skill files
- Verified manifest version/file count
- Verified documentation-only scope

**Result:**
Pass

**Risks remaining:**
- `project-os/10-prompts/master-codex-operating-prompt.md` was requested for update in source instructions but does not exist in this template.

**Next action:**
- Add the missing master operating prompt file to `project-os/10-prompts` if future prompt-level integration is required.

### 2026-08-15 20:40 — Birdie Squad Golf-Day MVP Gate 1 + Gate 2 Foundation

**Changed by:** ChatGPT using GitHub and Supabase connectors

**Files changed:**
- events.html
- js/birdie-mvp.js
- js/events-data.js
- css/mvp.css
- project-os/00-start-here/current-status.md
- project-os/00-start-here/next-action.md
- project-os/04-technical/architecture.md
- project-os/04-technical/auth-and-roles.md
- project-os/04-technical/data-model.md
- project-os/04-technical/tech-stack.md
- project-os/10-prompts/birdie-golf-day-mvp-master-build-prompt.md
- supabase/migrations/20260815182736_birdie_squad_mvp_foundation.sql
- supabase/migrations/20260815182835_harden_updated_at_function.sql
- supabase/migrations/20260815182852_optimize_rls_write_policies.sql
- supabase/migrations/20260815183930_require_approved_club_accounts.sql
- supabase/seed_historical_game15.sql

**Summary:**
Created and secured the dedicated Birdie Squad Supabase backend, imported the existing club roster and Game 15 spreadsheet validation dataset, proved ranking parity with Excel, and implemented the first Events-page member golf hub on a feature branch. The UI intentionally uses a spreadsheet-familiar score-entry grid rather than a complex golf-management design. New Auth accounts require explicit club approval before protected data is visible.

**Tests run:**
- Supabase project health verified.
- Applied four recorded database migrations.
- Imported 83 roster members and 22 Game 15 results.
- Queried `live_leaderboard` and confirmed exact spreadsheet ranking parity including ties.
- Created temporary live-scoring test data, entered three hole scores for two players, confirmed automatic hole count/score total/rank, then deleted test data.
- Confirmed historical validation golf day is invisible to anonymous role.
- Supabase Security Advisor rerun after RLS/auth changes: zero findings.
- Re-fetched `js/birdie-mvp.js` from the feature branch in sections to inspect the committed integration and event-handler order.
- Compared feature branch against `main`; branch remains isolated and ahead with only intended MVP/Project-OS/Supabase files.

**Result:**
Pass for Gate 1. Gate 2 implementation is ready for real authenticated browser validation.

**Risks remaining:**
- No real Supabase Auth pilot accounts exist yet, so role/RLS/Reatime behaviour has not been proven in two browser sessions.
- Shared `js/main.js` still contains old hard-coded prototype credentials outside the scoped Events-page bridge; remove before production merge.
- Private Vercel preview/deployment still requires validation.

**Next action:**
- Bootstrap one approved staff account and one approved member account, run the two-session scoring test, then remove legacy shared auth before preparing the private chairman preview.

### 2026-08-16 09:00 — Site-Wide Legacy Auth Removal + Finishing Pass

**Changed by:** Claude (finishing brief `project-os/10-prompts/claude-finish-birdie-mvp.md`)

**Files changed:**
- js/main.js
- js/birdie-mvp.js
- js/birdie-public-events.js
- events.html
- css/mvp.css
- .github/workflows/mvp-check.yml
- project-os/00-start-here/current-status.md
- project-os/00-start-here/next-action.md

**Summary:**
Removed the hard-coded `admin`/`management`/`member` username+password array and the `birdiesgc_auth_session` localStorage session — the last functioning insecure login path, previously still live on every page except Events. Replaced it with a single shared Supabase Auth bridge (`window.BirdieAuth`) in `js/main.js`, loaded on every page, so Login/Logout is one real code path everywhere. `js/birdie-mvp.js` no longer creates its own Supabase client or intercepts clicks in the capture phase; it now consumes `window.BirdieAuth` for session/profile/client and only renders golf-day data. `js/birdie-public-events.js` reuses the same shared client instead of instantiating a second one. Reordered `events.html` script tags (`main.js` before `birdie-mvp.js`/`birdie-public-events.js`) since the interception workaround is gone. Enlarged score-input tap targets (44–46px) and tightened the sticky player column on narrow viewports for phone scorer usability. Updated the CI smoke test to check the publishable key in its new location (`js/main.js`) and `BirdieAuth` usage in `js/birdie-mvp.js`. No database/schema/RLS changes were made.

**Tests run:**
- `node --check` on all shipped JS files (`js/*.js`, `scripts/*.js`): pass.
- Secret scan (`grep -RIn -E 'service_role|sb_secret_'` over shipped `.html`/`.js`/`.css`): no matches.
- `npm run build`: pass (no-op static build).
- Local dev-server smoke test replicating the CI workflow (`/events`, `js/main.js`, `js/birdie-mvp.js`, `js/birdie-public-events.js` all served; required strings present in each): pass.

**Result:**
Pass for all checks achievable without a browser + real password or Supabase Auth administration access.

**Risks remaining:**
- Real-browser sign-in with `apprigate@gmail.com`, phone-device scorer feel, and two-session Realtime have not been re-verified in this pass — they require a human with the pilot password/device or Supabase Auth admin access, none of which are available in this environment. The prior database-level RLS proof (2026-08-15) still stands since no schema/RLS/policy changes were made.
- No Vercel project is linked in this workspace, so no preview URL exists yet.

**Next action:**
- A human should sign in on the Events page with the pilot account, run create-day → add-player → score-entry → leaderboard end to end, check the scorer grid on an actual phone, and link a Vercel project if a preview link is wanted before review.

### 2026-08-16 09:59 — Independent Review Fixes (PR #1)

**Changed by:** Claude, responding to an independent review comment on PR #1

**Files changed:**
- js/birdie-mvp.js
- js/main.js
- css/mvp.css
- project-os/08-logs/change-log.md

**Summary:**
Fixed three findings from an independent review on PR #1. (1) HIGH: `saveScore()` and the `hole_scores` Realtime handler both triggered a full `openGolfDay()` re-render, resetting scroll position, focus and the visible `is-saved` state on the mobile score grid on every save. Added `refreshCurrentDayLite()`, which reloads leaderboard/score data and updates only the leaderboard section and the score grid's total cells / non-focused input values in place; `golf_day_players`/`golf_days` Realtime changes still get a full re-render since those are rarer staff actions that change surrounding controls. (2) MEDIUM: `BirdieAuth.loadProfile()` didn't select `approved`, so a signed-in-but-unapproved account was labelled a plain "Member" and then hit a generic load failure. Now selects `approved`, fails closed if the row is missing/unreadable, shows "Pending Approval" in the header, and renders a dedicated "awaiting club approval" state before attempting any member-data load. (3) MEDIUM: the Realtime channel subscribed without a status/error callback. Added one that logs `SUBSCRIBED`/`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` and shows a small "Live updates unavailable" badge on failure. No scope, architecture, or database/RLS changes.

**Tests run:**
- `node --check` on all shipped JS files: pass.
- Secret scan (`service_role`/`sb_secret_`): no matches.
- `npm run build`: pass.
- Local dev-server smoke test (same checks as CI): pass.
- GitHub Actions `Birdie MVP Check`: green on both the branch push and PR #1.

**Result:**
Pass. All three review findings resolved; PR #1 updated with the fix summary and re-confirmed ready for review (not merged).

**Risks remaining:**
- Same human-only blockers as the prior entry: real-browser sign-in, phone-device check, second-account Realtime proof, and Vercel preview link.

**Next action:**
- Await human review/acceptance testing on PR #1. Do not merge to `main`.

### 2026-08-16 13:00 — Admin Legacy Excel Workbook Import (Gate 2B)

**Changed by:** Claude, executing `project-os/10-prompts/claude-excel-import-mvp.md`

**Files changed:**
- supabase/migrations/20260816120000_legacy_workbook_import.sql
- js/legacy-import-utils.js
- js/birdie-mvp.js
- events.html
- css/mvp.css
- scripts/test-legacy-import.js
- .github/workflows/mvp-check.yml
- project-os/00-start-here/current-status.md
- project-os/00-start-here/next-action.md
- project-os/04-technical/data-model.md
- project-os/04-technical/auth-and-roles.md

**Summary:**
Implemented the locked Gate 2B requirement: an admin-only `.xlsx` workbook import so the club can bring newer legacy games into Supabase without manual recapture, while the workbook stays an independent backup. The browser parses the workbook locally (SheetJS `xlsx@0.18.5`, Apache-2.0, pinned via jsDelivr `+esm` — the last npm-published release; newer SheetJS builds moved to a separate CDN this codebase doesn't otherwise use) and shows a full preview — new/matched/unchanged/skipped counts, a per-game table, and plain-language conflict notes — before any database write. Added `golf_days.legacy_import_key`, a deterministic `game_number|venue[|date]` fingerprint with a partial unique index, so a re-imported historical game updates the existing round instead of duplicating it; backfilled the seeded Game 15 round with its key in the same migration. The only write path is `public.import_legacy_workbook(payload jsonb)`, a `security definer` RPC with `search_path = ''` that independently re-checks the caller is an approved `admin` against `user_profiles`, re-derives the legacy key and name normalization itself rather than trusting the browser, and refuses to write into any golf day whose `source_type` isn't `excel_import` — an app-created/live round can never be touched, even by a malicious payload. A `workbook_imports` audit table (unique on `checksum_sha256`) blocks re-importing the exact same file and records who/when/what. Pure parsing/normalization/categorization logic was factored into `js/legacy-import-utils.js` (`window.BirdieLegacyImport`) so the exact same code the browser preview uses is also exercised by a new dependency-free Node test script, without duplicating the logic or adding a package.json dependency.

**Tests run:**
- `node scripts/test-legacy-import.js`: 15/15 passing — labelled-column "Player details" parsing (not a hard-coded row/column), plus-handicaps preserved as text, "Games" row mapping onto roster order, unparsed dates left null instead of guessed, Game-15-style payload reproducing Carol 71 / Slenda 72 / Duke 75 ordering, deterministic legacy-key generation, ambiguous member/game handling skipped rather than guessed, and conflict rows excluded from the commit payload.
- `node --check` on all shipped JS files including the two new ones: pass.
- Secret scan (`service_role`/`sb_secret_`): no matches.
- `npm run build`: pass.
- Local dev-server smoke test (now also fetching/checking `js/legacy-import-utils.js`): pass.
- GitHub Actions `Birdie MVP Check`: green on both the branch push and PR #1.

**Result:**
Pass for everything achievable without a live Supabase project or a real club workbook in this environment. The RPC's admin-gating, duplicate-import blocking, app-round protection, and transactional atomicity are implemented and reviewable in the migration SQL, but were not execute-tested against a live database here — no Supabase CLI/credentials are available in this workspace. That mirrors how prior passes on this branch have handled live-DB/live-browser gaps.

**Risks remaining:**
- The real latest club workbook was not available in this environment; the feature was built and tested against the documented/validated `Player details` + `Games` layout only, per the finishing brief's explicit instruction not to invent newer contents.
- RPC behaviour (admin gate, duplicate-checksum block, app-round protection, transactional rollback) has not been exercised against a live Supabase project from this session.
- Same pre-existing human-only blockers as prior entries: real-browser sign-in, phone-device check, second-account Realtime proof, and Vercel preview link.

**Next action:**
- A human admin should upload the club's actual latest `.xlsx` workbook on the Events page, review the preview, and confirm the import, then verify the resulting golf day(s)/leaderboard look correct. Do not merge to `main`.

### 2026-08-16 16:00 — Correct Excel Import Against the Actual Birdie Workbook

**Changed by:** Claude, executing `project-os/10-prompts/claude-fix-excel-import-actual-workbook.md` in response to a fresh independent review on PR #1

**Files changed:**
- supabase/migrations/20260816120000_legacy_workbook_import.sql (rewritten — migration was not yet applied live, so it was safe to amend rather than layer a repair migration)
- js/legacy-import-utils.js (rewritten)
- js/birdie-mvp.js
- scripts/test-legacy-import.js (rewritten)
- project-os/00-start-here/current-status.md
- project-os/00-start-here/next-action.md
- project-os/04-technical/data-model.md

**Summary:**
A fresh independent review inspected the actual `Monthly Medal APRIL@2026-3.xlsx` directly and found three HIGH-severity mismatches between the first Gate 2B pass and the real workbook, plus real-browser testing surfaced a rollout regression. All four are fixed:
1. `Player details` is the real **horizontal** layout (a `Member Name` row + an `HC` row, names/handicaps running across columns) — `parsePlayerDetailsRows()` rewritten to match; it previously assumed rows-under-a-header and would not have reconstructed the real roster at all.
2. `Games` data-row game numbers are text labels (`Game 15`), not numbers — `Number('Game 15')` is `NaN`. `parseGameNumberLabel()` now extracts the integer with a strict `Game N` pattern. Score columns are now mapped from the `Games` sheet's own header row (`GAME #`/`VENUE`/`DATE`/`PLAYER` then one column per player from `E`), never from `Player details` order — `parseGamesRows()` no longer takes a roster-order parameter at all.
3. Historical-game identity is no longer exact-key equality. The seeded Game 15 has `event_date = null`; a later workbook supplying that date would previously have computed a different key and risked creating a duplicate Game 15. Added `private.match_historical_golf_day()` (mirrored client-side by `matchHistoricalGame()`), which matches on `game_number` + normalized venue with a conservative date-aware fallback: an exact-date match wins; exactly one null-date candidate with no conflicting dated candidate is enriched; anything else ambiguous is a conflict, surfaced and skipped, never guessed. `legacy_import_key` is kept only as an audit fingerprint. The old single-key unique index was replaced with a defensive `(game_number, normalized venue, coalesce(event_date, 'infinity'::date))` index scoped to `excel_import` rows.
4. Real-browser testing found `loadGolfDays()` (the ordinary Member Golf Hub loader, used by every signed-in user) selected `legacy_import_key` unconditionally, so PostgREST returned HTTP 400 and the whole hub broke on a live project that didn't yet have the migration applied. `loadGolfDays()` no longer selects it at all — the new matching design doesn't need it client-side. The admin-only import panel now separately probes (`checkImportBackendAvailable()`) for the `workbook_imports` table before rendering an active form, showing a clear non-fatal "Import backend not installed yet" message otherwise; the rest of the hub is completely unaffected either way.

Also updated: dates now accept a real Excel date OR strict ISO `YYYY-MM-DD` text (the real workbook has at least one text-style date); anything else stays null/TBC rather than guessed. Since the migration had never been applied to the live Supabase project, it was safe to rewrite the file in place rather than layer a live-repair migration on top — it remains unapplied pending review.

**Tests run:**
- `node scripts/test-legacy-import.js`: 24/24 passing (up from 15) — fixtures rewritten to mirror the real horizontal `Player details` layout and labelled `Games` layout, including: `Game N` label parsing, strict-ISO-vs-ambiguous date handling, Games-header-driven score mapping, the Game-15 null-date-enrichment scenario, conflicting/ambiguous-candidate rejection, and a static source check that `loadGolfDays()`'s own `.select(...)` call never mentions `legacy_import_key`.
- `node --check` on all shipped JS files: pass.
- Secret scan (`service_role`/`sb_secret_`): no matches.
- `npm run build`: pass.
- Local dev-server smoke test: pass.
- GitHub Actions `Birdie MVP Check`: green on both the branch push and PR #1.

**Result:**
Pass for everything achievable without a live Supabase project or the real club workbook in this environment. The corrected matching/admin-gate/atomicity guarantees are implemented and reviewable in the migration SQL but were not execute-tested against a live database — no Supabase CLI/credentials are available here, and the migration is intentionally still unapplied.

**Risks remaining:**
- The migration has not been applied to the live Supabase project; a human should review it (especially `private.match_historical_golf_day()` and the new unique index) before applying.
- The real current club workbook was still not available in this environment; parsing was validated against fixtures that mirror its documented real layout, not the live file itself.
- Same pre-existing human-only blockers as prior entries: real-browser sign-in, phone-device check, second-account Realtime proof, Vercel preview link.

**Next action:**
- A human should review and apply the corrected migration to the live Supabase project, re-run Supabase Security Advisor, then upload the actual latest workbook as Admin to acceptance-test the preview/commit. Do not merge to `main`.

### 2026-08-16 18:30 — Mobile Responsive Golf Hub / Scorecard Fix

**Changed by:** Claude, executing `project-os/10-prompts/claude-mobile-responsive-golf-hub.md` in response to `project-os/08-logs/mobile-responsive-review.md` (real-device screenshots)

**Files changed:**
- css/style.css
- css/mvp.css
- js/birdie-mvp.js
- scripts/test-mobile-css.js (new)
- .github/workflows/mvp-check.yml
- project-os/00-start-here/current-status.md
- project-os/00-start-here/next-action.md

**Summary:**
Fixed a mobile usability regression in the Events / Member Golf Hub found via real-device screenshots. Root causes and fixes: (1) `.container`'s mobile gutter (24px) was stacking with an additional `.member-golf-section`/`.mvp-panel`/`.mvp-day-detail` left/right padding (16px) — the second, redundant padding was removed and `.container` itself reduced to a single 16px mobile gutter, with card padding now reduced on all sides instead. (2) The fixed mobile header (80px logo, 25%-opacity white pill designed for a dark hero image) visually obscured the leaderboard/scorer while scrolling on non-hero pages — reduced to a 56px logo with a near-opaque, blurred background, `.nav-mobile`'s top offset adjusted to match, and the login button/hamburger bars re-themed for the lighter background; desktop header untouched. (3) The leaderboard's player-name cell inherited `white-space: nowrap` from a rule shared with the score grid, forcing the row (and table) wide — scoped a mobile-only `white-space: normal` override to just the leaderboard's name column. (4) The live score sheet was the critical failure: a forced desktop `min-width: 1320px` on `.mvp-score-grid` plus a 168px sticky player column and a 70px+ sticky Total column left almost no visible width for hole-entry cells inside the already-narrowed container. Removed the forced min-width (table now sizes to real content, still horizontally scrollable for remaining holes inside `.mvp-score-grid-wrap`), dropped the sticky Total column on mobile, and echo the live total inside the sticky player cell instead (new `.mvp-player-mobile-total` element, `data-mobile-total-for` attribute); `applyScoreGridLiveUpdate()` now updates both the desktop and mobile total echoes in place, preserving the existing no-rerender/no-focus-loss behaviour. Player column narrowed from 168px to 104px with wrapping enabled so names stay identifiable rather than clipping. (5) Individual scorecard grid tightened to fit without page-level overflow. Import/admin/calendar controls got padding touch-ups; their existing responsive patterns already prevented overflow.

Added `scripts/test-mobile-css.js`: 15 framework-free checks that (a) statically confirm the specific CSS rules this fix depends on are present (so a future edit can't silently reintroduce the forced grid width, the stacked gutters, or an unreadable header), and (b) prove by arithmetic — using the real mobile player-column/input/padding values pulled directly out of the CSS — that at least 2 (in practice 3+) hole score cells fit beside the player identity at 320/360/375/390/400/430px, under a documented conservative gutter assumption. Wired into `.github/workflows/mvp-check.yml`.

**Tests run:**
- `node scripts/test-mobile-css.js`: 15/15 passing.
- `node scripts/test-legacy-import.js`: 24/24 passing (unaffected by this change).
- `node --check` on all shipped JS files: pass.
- Secret scan (`service_role`/`sb_secret_`): no matches.
- `npm run build`: pass.
- Local dev-server smoke test: pass.
- GitHub Actions `Birdie MVP Check`: green on both the branch push and PR #1.

**Result:**
Pass for everything achievable without a browser in this environment. **No browser/devtools automation or real device was available** — the fix was verified by reading the real computed CSS values and doing the same width arithmetic a human would do with devtools, plus static assertions that the fix's rules exist, not by an actual rendered check at any of the target widths. This is weaker evidence than a real screenshot and should be treated as such.

**Risks remaining:**
- No real-device or browser-rendered confirmation of the mobile layout at any width. A human should check on an actual phone at 320/360/375/390/430px before treating this as fully accepted, per the acceptance checklist in the correction brief.
- The mobile header's new near-opaque blurred background is a visual change; a human should confirm it reads well against the actual brand imagery, not just contrast math.
- Same pre-existing human-only blockers as prior entries: real-browser sign-in, second-account Realtime proof, Vercel preview link, Gate 2B migration review/apply + real-workbook acceptance.

**Next action:**
- A human should open the Events page on a real phone (or browser devtools at 320/360/375/390/430px) and confirm: no page-level horizontal scroll, the leaderboard and scorer are usable, at least two (ideally more) hole cells are visible beside the player identity while scoring, the mobile header no longer covers content while scrolling, and the individual scorecard/import/calendar controls fit. Do not merge to `main`.

### 2026-08-16 21:00 — Rich Event Details + Poster Upload (Gate 2D)

**Changed by:** Claude, executing `project-os/10-prompts/claude-event-details-poster-media.md`

**Files changed:**
- supabase/migrations/20260816130000_event_details_and_poster.sql (new)
- js/birdie-mvp.js
- js/birdie-public-events.js (rewritten)
- js/main.js
- css/mvp.css
- css/style.css
- index.html
- scripts/test-event-details.js (new)
- .github/workflows/mvp-check.yml
- project-os/00-start-here/current-status.md
- project-os/00-start-here/next-action.md
- project-os/04-technical/data-model.md
- project-os/04-technical/auth-and-roles.md

**Summary:**
Restored the richer promotional event presentation the old static `events-data.js` site had (description, reporting/tee-off time, green fee, sponsor, prizes, poster, featured treatment) as database-backed `golf_days` columns, rather than hard-coded. New migration adds nullable `short_description`, `description`, `reporting_time`, `tee_off_time`, `green_fee`, `event_note`, `sponsor_name`, `prizes` (jsonb array), `poster_path`, `poster_alt`, `featured` — no scoring columns touched, no new `golf_days` RLS policy needed (the existing admin/management write policies already cover the new columns). Added a public-read/admin-write `event-posters` Storage bucket (JPG/PNG/WebP, 5MB, enforced by the bucket configuration itself) with RLS policies gated on `user_profiles.role in ('admin','management') and approved = true`. The existing fast golf-day creation flow is unchanged (still just title/date/venue) with an optional collapsed "Event / promotion details" section added to the same form; a separate "Edit event / promotion details" section was added to the day-detail view for already-created `app` golf days (never for historical `closed + excel_import` rounds, which keep their existing read-only gate). `js/birdie-public-events.js` was rewritten to render a database-backed Featured Event card (`featured = true` wins, else nearest upcoming public event) and an enhanced calendar list — both null-safe (no bare labels for absent fields, no prize section for an empty array, no placeholder photo when no poster exists) — with automatic fallback to base columns, then to the static page, if the rich query or Supabase itself is unavailable. The same query now also drives a live homepage "next event" countdown, replacing a static countdown feature that was previously dead code (defined in `js/main.js` but never called); `window.BirdieEventUtils` was exposed from `js/main.js` so the countdown timer/markup logic is shared rather than duplicated. The Member Golf Hub calendar stays compact — a tiny `::after` star badge (no extra DOM) marks a day with a poster/prizes; the day detail shows the full presentation block above the leaderboard/scorer only when a field is actually set. Applied the Gate 2B migration-compatibility lesson throughout: `loadGolfDays()` (the ordinary hub loader) still never selects any new column; presentation flags/detail are fetched via separate, independently try/caught queries; `createGolfDay()` retries with a base-only payload if the promo-field insert fails, so day creation itself can never be blocked by this migration being absent. Documented a future `club_posts`-style content model direction (separate private bucket for member/sponsor-only material) in `data-model.md` without building it.

**Tests run:**
- `node scripts/test-event-details.js` (new): 14/14 passing — migration-compatibility discipline (base loader excludes new columns, presentation loaders/creation fallback never throw), empty-field/empty-prize-array guards, poster-omitted-when-absent behaviour, client/server poster type+size limit consistency, RLS write-gating present in the migration text, golf_days RLS untouched, edit-form read-only/role gates, day-detail still includes leaderboard/scorer, calendar badge doesn't touch cell sizing, poster/prize-row mobile width-safety.
- `node scripts/test-legacy-import.js`: 24/24 passing (unaffected).
- `node scripts/test-mobile-css.js`: 15/15 passing (unaffected).
- `node --check` on all shipped JS files: pass.
- Secret scan (`service_role`/`sb_secret_`): no matches.
- `npm run build`: pass.
- Local dev-server smoke test, now also checking `/` (homepage) includes the public-events script: pass.
- GitHub Actions `Birdie MVP Check`: green on both the branch push and PR #1.

**Result:**
Pass for everything achievable without a live Supabase project or a browser in this environment. The migration, Storage bucket/policies, and rendering are implemented and reviewable but not execute-tested — no Supabase CLI/credentials or browser automation are available here. The migration is intentionally not applied to the live project.

**Risks remaining:**
- No real Supabase project or browser to confirm the migration applies cleanly, the Storage bucket/policies behave as written, or the public/homepage/day-detail rendering actually looks right.
- The real poster image workflow (upload → public URL → display) has not been exercised end-to-end.
- Same pre-existing human-only blockers as prior entries: real-browser sign-in, mobile-device check, second-account Realtime proof, Vercel preview link, Gate 2B migration review/apply + real-workbook acceptance.

**Next action:**
- A human should review and apply the Gate 2D migration to the live Supabase project (after or alongside the still-pending Gate 2B migration review), re-run Supabase Security Advisor, then as Admin add event details and upload a real poster to a golf day, confirm the public Events page/homepage/calendar render correctly, and confirm a member/scorer account cannot access the edit UI or the Storage bucket. Do not merge to `main`.
