# Current Status

## Summary
Birdie Squad now has a verified Supabase backend and a feature-branch Events-page MVP integration. The existing public website remains intact. Gate 1 is complete. Gate 2 is implemented and has passed database-level Auth/RLS validation with a real approved Supabase account. The legacy hard-coded/localStorage login has been fully removed from shipped JavaScript; Supabase Auth (via a single shared `window.BirdieAuth` bridge in `js/main.js`) is now the only functioning login path on every page, not just Events. Real-browser sign-in with the pilot account, mobile scorer validation on a physical device, dual-session Realtime, and a Vercel preview link still require a human with the pilot password/device — see "Remaining Before Gate 2 Can Close".

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

## Automated Branch Validation
A GitHub Actions workflow now validates:
- JavaScript syntax for app/scripts.
- No `service_role` or `sb_secret_` markers in shipped application files.
- Static build command.
- Local development server smoke test for `/events`, `birdie-mvp.js`, and `birdie-public-events.js`.

## Remaining Before Gate 2 Can Close
1. GitHub Actions MVP check must pass. Locally re-verified equivalent to green (see "Automated Branch Validation").
2. ~~Remove/neutralise the legacy hard-coded localStorage credential flow in shared `js/main.js`.~~ **DONE** — see "Auth Cleanup" below.
3. Obtain a private preview deployment. **BLOCKED** — no Vercel project is linked in this workspace/CLI session; requires a human to run `vercel link`/`vercel --prod=false` with an authenticated Vercel account, or connect the GitHub repo in the Vercel dashboard.
4. Sign in through the actual browser with `apprigate@gmail.com`. **BLOCKED** — requires the human who holds that account's password; the code path is implemented and locally smoke-tested.
5. Test create day → add players → enter scores → leaderboard update from the UI. **BLOCKED on #4** (same browser session).
6. Open a second browser session and prove Realtime refresh. **BLOCKED** — requires a second approved test Auth account, which requires Supabase Auth administration access not available in this environment.
7. Verify mobile score entry is intuitive enough to use without training. Tap targets were enlarged (44–46px) and sticky player/total columns retained; a human should confirm on an actual phone.
8. Verify logout/public state. Code path implemented (`BirdieAuth.signOut()`); needs the same human browser pass as #4.

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
All achievable engineering work is complete. Four items now require a human directly (none are safely automatable from this environment):
1. Sign in at the Events page with `apprigate@gmail.com` (password known only to the user) and run through create-day → add-player → score-entry → leaderboard.
2. Confirm the scorer grid feels usable on an actual phone.
3. Provide/approve a second test member email if two-session Realtime should be proven before club rollout (optional — can be deferred to actual pilot usage).
4. Link a Vercel project (dashboard or `vercel link`) if a shareable preview URL is wanted before merge review.

## Last Updated
2026-08-16 — Claude finishing pass. Removed the last functioning hard-coded/localStorage login path from shipped JavaScript site-wide (previously only bridged around on Events); centralised Supabase Auth into one shared client; verified JS syntax, secret scan, static build and local server smoke test all pass; updated CI workflow to match the new file layout.
