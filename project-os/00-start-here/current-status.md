# Current Status

## Summary
Birdie Squad now has a verified Supabase backend and a feature-branch Events-page MVP integration. The existing public website remains intact. Gate 1 is complete. Gate 2 is implemented and has passed database-level Auth/RLS validation with a real approved Supabase account. The legacy hard-coded/localStorage login has been fully removed from shipped JavaScript; Supabase Auth (via a single shared `window.BirdieAuth` bridge in `js/main.js`) is now the only functioning login path on every page, not just Events. Closed Excel-imported historical rounds are read-only in the UI (no Start Live Round / Add Player / Live Score Sheet). Gate 2B — an admin-only `.xlsx` legacy workbook import — has been implemented and then corrected against direct inspection of the real club workbook (horizontal `Player details`, `Game N` labels, header-driven score columns, and safe null-date-enrichment matching so a historical game is never duplicated); see "Gate 2B — Legacy Workbook Import" below. The migration is intentionally not yet applied to the live project. Real-device screenshots then exposed a mobile-layout regression across the Events / Member Golf Hub, leaderboard and live score sheet — fixed per "Gate 2C — Mobile Responsiveness Fix" below, verified by CSS arithmetic and static regression checks only (no browser automation is available in this environment). Real-browser sign-in with the pilot account, mobile scorer validation on a physical device, dual-session Realtime, a Vercel preview link, and real-workbook acceptance testing of the (corrected) import feature still require a human — see "Remaining Before This MVP Phase Can Close".

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

## Automated Branch Validation
A GitHub Actions workflow now validates:
- JavaScript syntax for app/scripts.
- No `service_role` or `sb_secret_` markers in shipped application files.
- Static build command.
- Legacy workbook import unit tests (`node scripts/test-legacy-import.js`).
- Mobile Golf Hub CSS regression checks (`node scripts/test-mobile-css.js`).
- Local development server smoke test for `/events`, `main.js`, `legacy-import-utils.js`, `birdie-mvp.js`, and `birdie-public-events.js`.

## Remaining Before This MVP Phase Can Close
1. GitHub Actions MVP check must pass. Locally re-verified equivalent to green (see "Automated Branch Validation").
2. ~~Remove/neutralise the legacy hard-coded localStorage credential flow in shared `js/main.js`.~~ **DONE**.
3. Obtain a private preview deployment. **BLOCKED** — no Vercel project is linked in this workspace/CLI session; requires a human to run `vercel link`/`vercel --prod=false` with an authenticated Vercel account, or connect the GitHub repo in the Vercel dashboard.
4. Sign in through the actual browser with `apprigate@gmail.com`. **BLOCKED** — requires the human who holds that account's password; the code path is implemented and locally smoke-tested.
5. Test create day → add players → enter scores → leaderboard update from the UI. **BLOCKED on #4** (same browser session).
6. Open a second browser session and prove Realtime refresh. **BLOCKED** — requires a second approved test Auth account, which requires Supabase Auth administration access not available in this environment.
7. Verify mobile score entry is intuitive enough to use without training. The scorer grid was rebuilt for narrow phones (see "Gate 2C — Mobile Responsiveness Fix"); this was proven by CSS-arithmetic and static regression checks only, not a real device — a human should confirm on an actual phone, ideally at 320/360/375/390/430px.
8. Verify logout/public state. Code path implemented (`BirdieAuth.signOut()`); needs the same human browser pass as #4.
9. Apply the (now corrected) Gate 2B migration to the live Supabase project, then upload the club's actual latest `.xlsx` workbook as Admin, review the preview, and confirm the import. **BLOCKED** — the migration is deliberately still unapplied pending review, and the real current workbook isn't available in this environment; parsing/matching logic is now unit-tested against fixtures that mirror the real workbook layout (horizontal `Player details`, `Game N` labels, header-driven score columns, null-date enrichment) rather than an invented one.

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
All achievable engineering work is complete. Seven items now require a human directly (none are safely automatable from this environment):
1. Sign in at the Events page with `apprigate@gmail.com` (password known only to the user) and run through create-day → add-player → score-entry → leaderboard.
2. Confirm the scorer grid feels usable on an actual phone at 320/360/375/390/430px — the mobile fix was verified by CSS arithmetic and static regression checks only, not a real device (no browser/devtools automation is available in this environment).
3. Provide/approve a second test member email if two-session Realtime should be proven before club rollout (optional — can be deferred to actual pilot usage).
4. Link a Vercel project (dashboard or `vercel link`) if a shareable preview URL is wanted before merge review.
5. Review the corrected Gate 2B migration (`supabase/migrations/20260816120000_legacy_workbook_import.sql`), apply it to the live Supabase project, then upload the club's actual latest `.xlsx` workbook as Admin to acceptance-test the import preview/commit against real data.
6. Re-run Supabase Security Advisor after the Gate 2B migration is applied (it wasn't previously, since the migration was still unapplied).
7. Confirm the mobile header change (near-opaque blurred background, 56px logo) reads well against the actual site branding on a real device.

## Last Updated
2026-08-16 — Claude fixed the mobile Events / Member Golf Hub per `project-os/10-prompts/claude-mobile-responsive-golf-hub.md`, responding to real-device screenshots showing stacked mobile gutters, a header that obscured content while scrolling, a rigid clipped leaderboard, and a live score sheet whose sticky player+total columns left almost no room for hole inputs on a phone. Removed the double gutter, compacted/re-themed the mobile header, let leaderboard names wrap, removed the score grid's forced desktop width, dropped the sticky Total column on mobile in favour of a total echoed in the sticky player cell (kept in sync by the existing lightweight live-update path, no re-render/focus loss), and tightened card padding/spacing throughout. Added `scripts/test-mobile-css.js` (15 checks, now in CI) which statically confirms the fix's CSS rules exist and proves by arithmetic that 3+ hole cells fit beside the player identity at 320–430px. No real-device or browser verification was possible in this environment — see "Gate 2C — Mobile Responsiveness Fix" for what that means for trusting this. JS syntax, secret scan, static build, all three unit-test suites, and the local server smoke test pass.
