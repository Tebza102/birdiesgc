# Current Status

## Summary
Birdie Squad now has a verified Supabase backend and a feature-branch Events-page MVP integration. The existing public website remains intact. Gate 1 (backend proof) is complete. Gate 2 (real login + calendar + scorer capture + digital scorecard + live leaderboard) is implemented on the feature branch but cannot be declared complete until real approved Supabase test accounts are created and the browser workflow is exercised end to end.

## Working Branch
`agent/supabase-golf-day-mvp`

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
- Supabase Security Advisor currently returns no findings.
- Schema migrations recorded under `/supabase/migrations/`.

## Spreadsheet Validation: PASS
Source: `Monthly Medal APRIL@2026-3.xlsx`.

Imported:
- 83 roster members with the spreadsheet handicap reference preserved as text.
- Historical Game 15 / STATEMINES GC.
- 22 final player scores.

The database leaderboard reproduces the spreadsheet result exactly, including tied ranks. Top five validation result:
1. MISS CAROL SIBIYA — 71
2. MR SLENDA SITHEBE — 72
3. MR DUKE MAPHUNYE — 75
4. MR VELI HLOPHE — 76
5. MR TOM NTSHANGASE — 77

A separate temporary live-scoring test also passed: three hole scores per player were inserted, totals were summed automatically, holes-completed changed to 3, and the leaderboard ranked the lower total first. The temporary test golf day was then deleted.

## Gate 2 — Working Prototype: IN PROGRESS
Feature-branch implementation now includes:
- `css/mvp.css` for the member golf hub, calendar, leaderboard, scorecard, and Excel-familiar scorer grid.
- `js/birdie-mvp.js` as a scoped Supabase bridge on the Events page.
- Existing Events page now contains a Member Golf Hub mount.
- Real Supabase email/password login replaces the hard-coded prototype login on the Events page through capture-phase interception.
- Logged-in role is loaded from `user_profiles`.
- Database-backed golf-day calendar.
- Golf-day list and detail view.
- Admin/management create-golf-day form.
- Staff add-player flow from the imported club roster.
- Excel-familiar scoring grid: players down the left, holes 1–18 across, total on the right.
- Score upsert/delete on cell change.
- Member leaderboard and individual digital scorecard.
- Historical imported results are labelled as Excel totals rather than pretending hole-by-hole data exists.
- Realtime subscriptions refresh leaderboard/score views when scores, players, or golf-day status change.
- Existing Captains Day event dated 31 May 2026 is now correctly marked past rather than upcoming.

## Current Required Validation
Gate 2 still requires real authenticated browser testing with at least:
- one approved staff/scorer/admin account;
- one approved member account.

Required tests:
1. Staff signs in.
2. Staff creates a test golf day.
3. Staff adds players from the roster.
4. Staff enters hole scores on phone/desktop.
5. Totals/positions update.
6. Second member session sees the change through Realtime.
7. Member cannot modify scores.
8. Unapproved account cannot read club/member scoring data.
9. Logout returns to public/member-login state.

## Security State
- The browser uses only the Supabase project URL and publishable key.
- No secret/service-role key is present in frontend code.
- New Auth users default to role `member` but `approved = false`.
- RLS requires `approved = true` for member golf data.
- Staff writes require both `approved = true` and an authorised role.
- Role/approval data is database-controlled, not user metadata.

## Known Remaining Risks / Debt
- Hard-coded prototype credentials still exist in shared `js/main.js` and therefore still affect pages other than Events. They must be removed before production merge.
- End-to-end Auth/RLS has not yet been validated with real users.
- Current Supabase integration is scoped to the Events page for minimum-change MVP delivery.
- Public site events are still partly static; the member golf calendar is database-backed.
- Contact enquiries still use `mailto:` and are not persisted; this remains a separate reliability issue outside this golf-day MVP gate.
- Current deployment ownership/Vercel preview still needs revalidation before Gate 3.

## Scope Lock: Not Part of MVP
Do not build GPS, automatic handicap/differential calculations, Admin Points, Order of Merit automation, advanced statistics, friends/social feeds, messaging, Ryder Cup formats, multi-round tournaments, smartwatch integration, payments, sponsor dashboards, or CRM features.

## UX Non-Negotiable
The scorer must recognise the club's spreadsheet workflow immediately. Preserve familiar concepts and layout: Game/Golf Day, Venue, Date, Player, Handicap, holes/scores, Total, Position. Optimise for simple phone use and minimal training.

## Next Blocker Requiring User Input
One real email address is required to bootstrap the first pilot login safely. Once the Auth user exists, ChatGPT can approve it and assign the intended role in the database. A second member account is then required for true two-session Realtime/RLS validation.

## Last Updated
2026-08-15 — ChatGPT + GitHub + Supabase. Gate 1 completed and Gate 2 feature-branch implementation advanced to authenticated-browser testing gate.
