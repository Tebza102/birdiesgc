# Current Status

## Summary
Birdie Squad now has a verified Supabase backend and a feature-branch Events-page MVP integration. The existing public website remains intact. Gate 1 is complete. Gate 2 is implemented and has passed database-level Auth/RLS validation with a real approved Supabase account. The legacy hard-coded/localStorage login has been fully removed from shipped JavaScript; Supabase Auth (via a single shared `window.BirdieAuth` bridge in `js/main.js`) is now the only functioning login path on every page, not just Events. Closed Excel-imported historical rounds are read-only in the UI (no Start Live Round / Add Player / Live Score Sheet). Gate 2B — an admin-only `.xlsx` legacy workbook import — has been implemented and then corrected against direct inspection of the real club workbook (horizontal `Player details`, `Game N` labels, header-driven score columns, and safe null-date-enrichment matching so a historical game is never duplicated); see "Gate 2B — Legacy Workbook Import" below. The migration is intentionally not yet applied to the live project. Real-device screenshots then exposed a mobile-layout regression across the Events / Member Golf Hub, leaderboard and live score sheet — fixed per "Gate 2C — Mobile Responsiveness Fix" below, verified by CSS arithmetic and static regression checks only (no browser automation is available in this environment). Rich event details + poster upload (Gate 2D) — description, times, green fee, sponsor, prizes, poster image, and a database-backed Featured Event/homepage countdown — have since been restored per "Gate 2D" below; per a same-day project log, the Gate 2B/2D migrations have since been applied live and Security Advisor findings addressed, though this session has no Supabase credentials to independently re-verify that. Real-device sign-in reliability for the Chairman/Treasurer pilot accounts, who existed but had never signed in, was then hardened with a full password-recovery flow (Gate 2E — CDN fallback/timeout, visible loading/error states, Show/Hide password, Forgot password, `PASSWORD_RECOVERY` handling). A separate, isolated Vercel pilot project (`apprigate/birdiesgc-pilot`, not the live `www.birdiesgc.co.za`) has been created and linked but not yet successfully deployed — the deploy command itself is blocked by this harness's safety classifier and needs a human or explicit permission. See "Remaining Before This MVP Phase Can Close".

## Working Branch
`agent/supabase-golf-day-mvp`

Draft PR: `#1 Birdie Squad Supabase golf-day MVP`

Do not merge to `main` or deploy to production until private preview validation is complete.

## Gate 1 — Backend Proof: COMPLETE
Supabase project:
- Name: Birdie Squad Golf Club
- Organisation: Apprigate
- Project ref: `ydrrhlpvblwgwboyuwkj`
- Region: `eu-west-1`

Implemented and verified:
- `members` roster table.
- `user_profiles` authentication/role/approval table.
- `golf_days` table.
- `golf_day_players` participation table.
- `hole_scores` digital scorecard table.
- `live_leaderboard` security-invoker view.
- RLS on all exposed public tables.
- Explicit club-account approval requirement in addition to Supabase authentication.
- Roles: `admin`, `management`, `scorer`, `member`.
- Realtime publication for `golf_days`, `golf_day_players`, and `hole_scores`.
- Supabase Security Advisor reports no security findings.
- Schema migrations recorded under `/supabase/migrations/`.

## Spreadsheet Validation: PASS
Source: `Monthly Medal APRIL@2026-3.xlsx`.

Imported:
- 83 roster members with spreadsheet handicap references preserved.
- Historical Game 15 / STATEMINES GC.
- 22 final player scores.

The database leaderboard reproduces the spreadsheet result exactly, including tied ranks. Top five:
1. MISS CAROL SIBIYA — 71
2. MR SLENDA SITHEBE — 72
3. MR DUKE MAPHUNYE — 75
4. MR VELI HLOPHE — 76
5. MR TOM NTSHANGASE — 77

A temporary hole-by-hole scoring test also passed and was removed afterward.

## Gate 2 — Working Prototype: IN PROGRESS
Feature-branch implementation includes:
- Real Supabase email/password auth bridge on Events page.
- Database-backed public golf-day list.
- Logged-in member golf calendar.
- Golf-day list/detail.
- Live leaderboard.
- Individual digital scorecard.
- Admin/management create-golf-day flow.
- Staff add-player flow from the imported roster.
- Excel-familiar score-entry grid: players down the left, holes 1–18 across, total on the right.
- Score upsert/delete on cell change.
- Realtime subscriptions for golf days, participants and scores.
- Historical imported results clearly labelled as Excel final totals.
- Captains Day dated 31 May 2026 corrected from upcoming to past.

## Real Account Validation: PASS AT DATABASE/RLS LEVEL
Pilot account:
- `apprigate@gmail.com`
- Supabase Auth user exists and email is confirmed.
- `user_profiles.role = admin`.
- `user_profiles.approved = true`.

Authenticated RLS tests using that exact Auth user id:
- Admin can read all 83 roster members.
- Admin can read golf days and the 22-row historical leaderboard.
- In a rollback transaction, Admin successfully created a golf day, added a player and entered a hole score; the leaderboard returned the player at position 1 with the correct total.
- The same account was temporarily treated as role `member` inside a rollback transaction. Member could read golf-day/leaderboard data but an attempted golf-day write was blocked by RLS.
- All test writes were rolled back; no test golf days leaked into the database.
- Account role was verified restored to `admin` and `approved = true`.

This proves the role model at the database boundary. A second permanent member Auth account is not required just to prove RLS; browser member UX can be tested later if needed by temporarily changing a test account role and reverting it.

## Gate 2B — Legacy Workbook Import: CORRECTED, ENGINEERING COMPLETE, NOT YET APPLIED LIVE
Admin-only `.xlsx` upload/import flow, implemented per `project-os/10-prompts/claude-excel-import-mvp.md` and then corrected per `project-os/10-prompts/claude-fix-excel-import-actual-workbook.md` after an independent review inspected the actual club workbook directly and found the first pass's parsing fixtures didn't match it:
- `Import Latest Club Workbook` control on the Events member hub, visible only to `role = 'admin'`.
- **Corrected parsing**: `Player details` is parsed as the real **horizontal** layout (a `Member Name` row + an `HC` row, names/handicaps running across columns), not rows-under-a-header. `Games` game numbers are parsed from real `Game N` text labels with a strict pattern (never `Number('Game 15')`, which is `NaN`), and score columns are mapped from the `Games` sheet's own header row (`GAME #`/`VENUE`/`DATE`/`PLAYER` then one column per player from `E`) — never from `Player details` order.
- **Corrected historical-game matching**: no longer exact-key equality. The seeded Game 15 has `event_date = null`; a later workbook supplying that date now enriches the same row (`private.match_historical_golf_day()`, mirrored client-side) instead of risking a duplicate Game 15. Genuinely ambiguous/conflicting matches are skipped and surfaced, never guessed.
- **Corrected rollout dependency**: `loadGolfDays()` (the ordinary hub loader, used by every signed-in user) no longer selects `legacy_import_key` — a real-browser regression had this crashing the whole Member Golf Hub with an HTTP 400 before the migration was applied. The import panel now separately probes for the Gate 2B objects and shows a clear non-fatal "Import backend not installed yet" message if they're absent, leaving the rest of the hub fully working.
- Workbook parsed entirely client-side (SheetJS `xlsx@0.18.5`, Apache-2.0, pinned via jsDelivr `+esm`) with a preview (new/matched/unchanged/skipped counts, per-game table, plain-language conflict notes) shown before any database write.
- `public.import_legacy_workbook(payload jsonb)` — `security definer`, `search_path = ''` — is the only write path: re-checks caller is an approved `admin` against `user_profiles` itself (never trusts the browser), re-derives the match/legacy-key/name-normalization server-side, and refuses to write into any golf day whose `source_type` isn't `excel_import` (an app-created/live round can never be touched). A single call is one implicit transaction, so a failure leaves no partial import.
- `workbook_imports` audit table (unique on `checksum_sha256`) blocks re-importing the exact same file and records who/when/what.
- Pure parsing/normalization/matching logic lives in `js/legacy-import-utils.js` (`window.BirdieLegacyImport`), shared unmodified between the browser and `node scripts/test-legacy-import.js` — now 24 passing checks against fixtures that mirror the real workbook layout, including the null-date-enrichment and ambiguous-conflict scenarios, plus a static regression check that the ordinary hub loader never selects `legacy_import_key`.
- Full details: `project-os/04-technical/data-model.md` → "Admin Workbook Import".
- **The migration is intentionally NOT applied to the live Supabase project yet** — held back until this corrected version is reviewed, per the correction brief.

## Gate 2C — Mobile Responsiveness Fix: COMPLETE
Real-device screenshots exposed a mobile usability regression in the Events / Member Golf Hub (`project-os/08-logs/mobile-responsive-review.md`), fixed per `project-os/10-prompts/claude-mobile-responsive-golf-hub.md`:
- **Stacked mobile gutters removed.** `.container`'s mobile padding is now the single gutter (16px); the old `.member-golf-section`/`.mvp-panel`/`.mvp-day-detail` left/right padding that stacked on top of it is gone, replaced with all-sides card padding reduction.
- **Mobile header compacted and made legible.** Logo reduced from 80px to 56px; the header background changed from a 25%-opacity white pill (designed for a dark hero image) to a near-opaque blurred background so it reads as chrome and doesn't visually erase the leaderboard/scorer while scrolling on non-hero pages. Login button and hamburger bars re-themed for the lighter background; `.nav-mobile`'s top offset adjusted to match. Desktop header untouched.
- **Leaderboard**: player names now wrap instead of forcing the row (and table) wide via `white-space: nowrap`; core `Pos | Player | Thru | Total` stays visible; `View card` action kept, just tightened.
- **Live Score Sheet (highest priority)**: the score grid no longer carries a forced 1320px desktop `min-width` on mobile. The sticky Total column — which combined with the sticky player column was consuming almost the entire narrow viewport — is dropped on mobile in favour of a total already echoed inside the sticky player cell (`applyScoreGridLiveUpdate()` keeps both the desktop and mobile totals in sync in place, without re-rendering inputs or losing focus/scroll). Player column narrowed from 168px to 104px with wrapping enabled. Score inputs kept at a comfortably tappable 44px. Result: 3+ hole cells visible beside the player identity at 360–390px (arithmetic proven in `scripts/test-mobile-css.js`), with the remaining holes still reachable via horizontal scroll contained inside `.mvp-score-grid-wrap`.
- **Individual scorecard**: mobile grid tightened to 6 columns at a 44px minimum so it fits without page-level overflow.
- **Import/admin/calendar controls**: padding tightened; existing responsive patterns (`min(100%, 330px)` label widths, flex-wrap) already prevented overflow there and were left alone.
- **No scope changes**: no framework migration, no Supabase/RLS/scoring changes, no capability removed (leaderboard, individual scorecards, Realtime, and the Excel import all still fully present, just laid out to fit a phone).
- **Verification method — please read before trusting this as a full sign-off**: no browser/devtools automation is available in this environment, so this was **not** verified with real screenshots or a live viewport resize. `scripts/test-mobile-css.js` (new, 15 checks, wired into CI) statically confirms the specific CSS rules exist and, using the real mobile player-column/input/padding values pulled directly out of the CSS, proves by arithmetic that at least 2 (typically 3+) hole cells fit beside the player identity at 320/360/375/390/400/430px under a documented, conservative gutter assumption — the same math a human would do with devtools, just not an actual rendered check. A human should still confirm on a real phone before treating this as fully accepted.

## Gate 2D — Rich Event Details + Poster Upload: ENGINEERING COMPLETE, LIVE PER PROJECT LOG
Restores the richer promotional event presentation that existed in the old static `events-data.js` site (description, times, green fee, sponsor, prizes, poster, featured treatment), now database-backed, per `project-os/10-prompts/claude-event-details-poster-media.md`:
- **Schema**: `supabase/migrations/20260816130000_event_details_and_poster.sql` adds nullable presentation columns to `golf_days` (`short_description`, `description`, `reporting_time`, `tee_off_time`, `green_fee`, `event_note`, `sponsor_name`, `prizes` jsonb array, `poster_path`, `poster_alt`, `featured`). No scoring columns/logic touched; no new `golf_days` RLS policy — the existing admin/management write policies already cover the new columns.
- **Poster storage**: a new public-read `event-posters` Supabase Storage bucket, JPG/PNG/WebP only, 5MB limit enforced by the bucket itself (not just client-side), write/delete restricted to approved admin/management via Storage RLS. Public URLs are derived in the browser (`storage.getPublicUrl()`), never stored as a brittle full URL. Uploads use collision-safe `<golf_day_id>/<timestamp>-<random>.<ext>` paths; replacing a poster best-effort-deletes the old object.
- **Create/edit UI**: the existing fast "Create a new golf day" flow is unchanged and still requires nothing beyond title/date/venue; an optional collapsed "Event / promotion details" section was added to the same form for description/times/fee/sponsor/note/poster/up-to-4 prize rows. A separate "Edit event / promotion details" section appears on an already-created app golf day's detail view (admin/management only) so a poster or prizes can be added later without recreating the round. Historical `closed + excel_import` rounds never show this edit UI.
- **Public Events page**: `js/birdie-public-events.js` now renders a database-backed Featured Event card (explicit `featured = true` wins, else nearest upcoming public event) with poster/description/times/fee/sponsor/prizes, and an enhanced calendar list — all with null-safe rendering (no bare `Sponsor:`/`Green Fee:` labels, no prize section for an empty array, no fallback-to-unrelated-photo when no poster exists). Falls back to the static `events-data.js` content if Supabase is unavailable or the migration hasn't been applied (rich-column query fails → automatic retry with base columns only → total failure just keeps the static page).
- **Homepage**: the previously-dead static countdown feature (`renderHomepageCountdown()` was defined but never called) is replaced by a live Supabase-backed "next event" card + countdown when a public event exists, via the same query — no event data duplicated between pages. `js/main.js` exposes `window.BirdieEventUtils` (countdown markup/timer) so this is shared, not reimplemented.
- **Member Golf Hub calendar**: stays compact — a tiny `::after` star badge (no extra DOM) marks a day with a poster/prizes; the day detail shows the full presentation block above the leaderboard/scorer when present.
- **Migration-compatibility discipline (the Gate 2B lesson, applied again)**: the ordinary hub loader (`loadGolfDays()`) still never selects any new column. Presentation flags/detail are fetched via separate, independently try/caught queries — a golf day with no rich fields, or a project where this migration hasn't been applied yet, continues to render and score exactly as before. `createGolfDay()` even retries with a base-only payload if the promo-field insert fails, so day creation itself can never be blocked by this migration being absent.
- **Tests**: `scripts/test-event-details.js` (new, 14 checks, in CI) — static/regression proof of the migration-compatibility discipline, empty-field/empty-prize-array guards, poster-omitted-when-absent behaviour, client/server poster limit consistency, RLS write-gating in the migration text, and that the calendar badge/day-detail render don't regress existing behaviour. RLS/Storage-policy runtime behaviour itself is implemented and reviewable in the migration SQL but not execute-tested — no live Supabase project is available in this environment.
- **Live status (per `project-os/08-logs/pilot-access-2026-08-16.md`, not independently re-verified by this session — no Supabase CLI/MCP/credentials are available here)**: the migration was applied to the live project and subsequently corrected in-place for a hosted-Supabase `storage.objects` RLS ownership quirk (`e0cd424`); Security Advisor's anonymous-execution warning on `import_legacy_workbook` was cleared by revoking `anon`/`public` EXECUTE (`352de0d`, migration `20260816131500_harden_import_rpc_permissions.sql`); leaked-password protection is still reported disabled and should be enabled before broader membership rollout.

## Gate 2E — Pilot Auth Reliability + Password Recovery: ENGINEERING COMPLETE
Verified live facts from `project-os/10-prompts/claude-fix-pilot-auth-login-recovery.md` (treated as ground truth, not re-verified independently): `apprigate@gmail.com` (admin), `smokotong@birdiesgc.co.za` (management/Chairman) and `ksebusi@birdiesgc.co.za` (management/Treasurer) all exist, are approved, and have passwords, but the Chairman/Treasurer accounts have never successfully signed in (`last_sign_in_at` is null) — meaning the problem to solve was frontend reliability/UX, not account state, and no account was recreated or had its role changed.

- **CDN resilience**: the Supabase JS client now loads from two independent CDNs at the same pinned version (jsDelivr, then `esm.sh` as fallback), each attempt bounded by a 10-second timeout, so a stalled/blocked CDN request can no longer make login look silently unresponsive.
- **Visible sign-in responsiveness**: immediate `Connecting securely…` status, `Signing in…` submit state, a 15-second login timeout, and the button is always restored on every success/failure path (previously it stayed disabled indefinitely on some failure paths).
- **Specific, non-sensitive error messages**: wrong credentials, unconfirmed email, and network/CDN/timeout each get distinct, actionable guidance instead of one generic "Login failed"; the real Supabase error is still logged to console for diagnosis, never shown to the user (no tokens/keys/stack traces).
- **Password Show/Hide**: an accessible toggle (`aria-pressed`) on the login password field and on both new-password/confirm-password recovery fields, absolutely positioned so it can never force mobile overflow at 320px; `autocomplete` values preserved for password managers.
- **Forgot password + full recovery flow**: `Forgot password?` inside the login modal calls the real `supabase.auth.resetPasswordForEmail()` with a `redirectTo` built from the current deployment's own origin (never hard-coded), and never reveals whether an email exists. Returning from the email now correctly triggers on Supabase's `PASSWORD_RECOVERY` event specifically (previously ignored) — `window.BirdieAuth.onPasswordRecovery()` opens the modal in a dedicated "Set a New Password" mode (new/confirm fields, 8-char minimum, must match, both with Show/Hide), calls `supabase.auth.updateUser({ password })`, and cleans the recovery hash/query from the visible URL via `history.replaceState` afterward without disturbing the session Supabase already established.
- **Scope discipline**: no role/approval/account changes, no RLS changes, no scoring/Excel-import/event-poster/mobile-scoresheet changes — this pass only touches the login modal and the shared `BirdieAuth` bridge.
- **Tests**: `scripts/test-auth-ui.js` (new, 20 checks, in CI) — static regression proof of every item above (CDN fallback/timeout present, loading/status/error paths, Show/Hide markup + autocomplete, `resetPasswordForEmail`/`updateUser` calls, `PASSWORD_RECOVERY`-specific handling, length/match validation ordered before the network call, no new secret introduced, existing approved-profile fail-closed logic untouched, mobile-safe toggle CSS). No live Supabase project or browser is available in this environment, so an actual sign-in/reset-email/password-update round trip was **not** performed — this is implemented and reviewable, not execute-tested.
- **Operational requirement, needs a human**: Supabase Authentication → URL Configuration → Redirect URLs must allow the pilot deployment's actual origin (expected `https://birdiesgc-pilot.vercel.app/**`, confirm the real stable alias once deployed) before a real recovery email link will be accepted — the frontend cannot configure this itself.

## Automated Branch Validation
A GitHub Actions workflow now validates:
- JavaScript syntax for app/scripts.
- No `service_role` or `sb_secret_` markers in shipped application files.
- Static build command.
- Legacy workbook import unit tests (`node scripts/test-legacy-import.js`).
- Mobile Golf Hub CSS regression checks (`node scripts/test-mobile-css.js`).
- Event details / poster upload regression checks (`node scripts/test-event-details.js`).
- Auth UI / password recovery regression checks (`node scripts/test-auth-ui.js`).
- Local development server smoke test for `/`, `/events`, `main.js`, `legacy-import-utils.js`, `birdie-mvp.js`, and `birdie-public-events.js`.

## Remaining Before This MVP Phase Can Close
1. GitHub Actions MVP check must pass. Locally re-verified equivalent to green (see "Automated Branch Validation").
2. ~~Remove/neutralise the legacy hard-coded localStorage credential flow in shared `js/main.js`.~~ **DONE**.
3. Deploy the branch to the isolated `birdiesgc-pilot` Vercel project (team `apprigate`, GitHub-connected, created and linked in a prior session). **BLOCKED IN THIS ENVIRONMENT** — the actual `vercel --prod --yes` push is denied by this harness's own safety classifier for production-deployment actions; a human (or a session with that permission granted) needs to run it, or approve the permission. Never deploy to the existing `birdiesgc` project / `www.birdiesgc.co.za`.
4. Sign in through the actual browser with `apprigate@gmail.com`, and separately with the Chairman/Treasurer accounts, once deployed. **BLOCKED** — requires a human with those passwords and the pilot URL once live; the reliability/error-path/recovery work in this pass is implemented and unit-tested but not execute-tested against real credentials.
5. Test create day → add players → enter scores → leaderboard update from the UI. **BLOCKED on #4**.
6. Open a second browser session and prove Realtime refresh. **BLOCKED** — needs a second approved test Auth account with Supabase Auth administration access not available in this environment.
7. Verify mobile score entry and the new auth UI (Show/Hide toggle, Forgot password, recovery mode) are usable on an actual phone at 320/360/375/390/430px. **BLOCKED** — verified only by CSS-arithmetic/static regression checks so far, no browser automation is available here.
8. Verify logout/public state. Code path implemented (`BirdieAuth.signOut()`); needs the same human browser pass as #4.
9. Confirm the Gate 2B/2D migrations and Security Advisor status recorded in `project-os/08-logs/pilot-access-2026-08-16.md` — this session has no Supabase CLI/MCP/credentials to re-verify that log independently; treat it as a same-day human/other-session claim, not something re-confirmed here.
10. Add `https://birdiesgc-pilot.vercel.app/**` (or the actual stable pilot alias, once confirmed after deployment) to Supabase Authentication → URL Configuration → Redirect URLs — required before a real password-recovery email link will be accepted. One-time human dashboard step.
11. Enable Supabase leaked-password protection before broader membership rollout, per the Security Advisor note in the pilot log (still disabled as of that log).

## Auth Cleanup (this session)
- Removed the hard-coded `admin` / `management` / `member` username+password array and `birdiesgc_auth_session` localStorage session from `js/main.js`.
- Added a single shared Supabase Auth bridge (`window.BirdieAuth`) in `js/main.js`, loaded on every page, so Login/Logout works identically everywhere — not just on Events.
- `js/birdie-mvp.js` no longer creates its own Supabase client or intercepts login clicks; it consumes `window.BirdieAuth` for session/profile/client and only renders golf-day data.
- `js/birdie-public-events.js` now reuses `window.BirdieAuth.ensureClient()` instead of creating a second Supabase client (avoids duplicate GoTrueClient instances).
- `events.html` script order changed so `js/main.js` loads before `js/birdie-mvp.js`/`js/birdie-public-events.js` (removed the old capture-phase event-interception workaround entirely).
- Role labels/header UI now come from `user_profiles.role` via Supabase, never from browser-editable state.
- `.github/workflows/mvp-check.yml` updated: the smoke test now checks `js/main.js` for the publishable key (since the client moved there) and checks `js/birdie-mvp.js` for `BirdieAuth` usage.

## Security State
- Browser code contains only Supabase project URL + publishable key.
- No secret/service-role key is in frontend code.
- New Auth users default to role `member` and `approved = false`.
- RLS requires approved club accounts for member scoring data.
- Staff writes require an approved account and authorised role.
- Role/approval is database-controlled, not user-editable metadata.

## Known Remaining Risks / Debt
- Current Supabase member app integration is deliberately scoped to Events for the MVP.
- Contact enquiries still use `mailto:`; outside this MVP.
- Vercel connector currently does not expose an Apprigate project for this repository, so preview deployment needs to be resolved before browser validation.

## Scope Lock
Do not build GPS, handicap/differential automation, Admin Points, Order of Merit automation, advanced statistics, social features, Ryder Cup/multi-round tournaments, smartwatch integration, payments, sponsor dashboards or CRM features.

## UX Non-Negotiable
The scorer must recognise the club spreadsheet workflow immediately: Game/Golf Day, Venue, Date, Player, Handicap, holes/scores, Total, Position. Keep it simple enough to use without training.

## Next User Input
All achievable engineering work is complete. These items require a human directly (none are safely automatable from this environment):
1. **Deploy** — run `vercel --prod --yes` from this checked-out branch (already linked to `apprigate/birdiesgc-pilot`), or grant the permission for it to be run here. Never deploy to the existing `birdiesgc` project / `www.birdiesgc.co.za`.
2. **Add the pilot origin to Supabase Redirect URLs** — Authentication → URL Configuration → Redirect URLs → add `https://birdiesgc-pilot.vercel.app/**` (confirm the exact alias once step 1 is done) so password recovery emails work.
3. Sign in at the deployed pilot Events page with `apprigate@gmail.com`, then separately with the Chairman (`smokotong@birdiesgc.co.za`) and Treasurer (`ksebusi@birdiesgc.co.za`) accounts — their first-ever sign-in — and run through create-day → add-player → score-entry → leaderboard.
4. Test the new Forgot-password → email link → Set-new-password flow end to end with a real account.
5. Confirm the scorer grid and the new login/recovery UI feel usable on an actual phone at 320/360/375/390/430px — verified only by CSS arithmetic and static regression checks so far.
6. Provide/approve a second test member email if two-session Realtime should be proven before club rollout (optional).
7. Independently confirm (this session could not: no Supabase CLI/MCP/credentials) the Gate 2B/2D migration and Security Advisor status recorded in `project-os/08-logs/pilot-access-2026-08-16.md`, and enable leaked-password protection if still disabled.

## Last Updated
2026-08-16 — Claude fixed pilot auth reliability and added a complete password-recovery flow (Gate 2E) per `project-os/10-prompts/claude-fix-pilot-auth-login-recovery.md`, in response to the Chairman/Treasurer accounts existing and being approved but never having successfully signed in: two-CDN fallback (jsDelivr → esm.sh) with a 10s per-attempt timeout for the Supabase client load, immediate `Connecting securely…` status + `Signing in…` state + 15s login timeout + always-restored submit button, specific non-sensitive error messages for bad credentials/unconfirmed email/network-timeout, an accessible Show/Hide password toggle (also on the new recovery fields), a `Forgot password?` action using the real `resetPasswordForEmail()` with a current-origin redirect, and full `PASSWORD_RECOVERY` handling (dedicated modal mode, 8-char minimum + confirm-match, `updateUser({ password })`, URL cleanup via `history.replaceState`). No role/RLS/scoring/import/event-poster/mobile-scoresheet changes; no account recreated or role changed. Fixed a self-referential secret-scan false positive (the new auth test file's own assertions matched the `service_role`/`sb_secret_` patterns) by excluding `scripts/` — Node-only dev/test tooling never shipped to a browser — from that specific CI check, mirroring the same false-positive class fixed earlier in this branch's history. Added `scripts/test-auth-ui.js` (20 checks, now in CI). No live Supabase project or browser is available in this environment, so no actual sign-in/reset-email/password-update round trip was performed — implemented and reviewable, not execute-tested. JS syntax, secret scan, static build, all five unit-test suites, and the local server smoke test pass.
