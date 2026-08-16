# Next Action

## Current Objective
All safely-automatable engineering work for Gate 2 is finished. What remains is human browser/device validation with the real pilot account, plus optional preview/second-account setup.

## Gate Status
- Gate 1 — Backend/database/RLS/spreadsheet validation: **COMPLETE**.
- Gate 2 — Auth/calendar/scorer/digital scorecard/live leaderboard: **ENGINEERING COMPLETE; REAL-BROWSER/DEVICE VALIDATION REQUIRED FROM A HUMAN**.
- Gate 3 — Private chairman/member preview: **NOT STARTED** (needs a Vercel project link).

## Immediate Next Actions
1. Sign in on the Events page with `apprigate@gmail.com` and verify the member hub loads the imported Game 15 leaderboard.
2. Create one throwaway live golf day from the UI and add a few imported roster players.
3. Enter hole scores through the Excel-familiar scorer grid on a phone and confirm totals/positions update and tap targets feel comfortable.
4. Optional: bootstrap a second approved `member` account (controlled database administration, never browser-editable metadata) and verify it can watch the leaderboard but cannot write scores, and that Realtime updates a second session without reload.
5. Link a Vercel project for this repo (dashboard connect, or `vercel link` from an authenticated CLI) to get a shareable preview URL.
6. Re-run Supabase Security Advisor only if a future change touches auth/RLS — no schema/RLS changes were made in this pass.

## User Input Policy
Do not ask the user to create tables, copy SQL, understand Supabase internals, or manage roles manually. Ask only for the smallest information that cannot safely be inferred or generated — currently the email address(es) to use for real pilot Auth accounts.

## Exact MVP User Journeys
### Public visitor
- Browse the existing public website.
- View basic published event information.
- See a Member Login entry point.

### Approved member
- Sign in using real Supabase Auth.
- See the database-backed club golf calendar.
- Open a golf day.
- View leaderboard and player scorecards.
- Cannot create golf days or edit scores.

### Approved scorer
- Member permissions.
- Add participating roster players to a golf day.
- Enter/edit hole scores through the spreadsheet-familiar grid.
- Cannot change platform security or manage unrelated data.

### Approved management/admin
- Scorer permissions.
- Create golf days and change round state (`scheduled` → `live` → `closed`).

## Acceptance Tests Already Passed
- 83 spreadsheet roster members imported.
- Game 15 / STATEMINES GC imported with 22 players.
- Database leaderboard matches spreadsheet ranking exactly, including ties.
- Temporary live hole-score test summed scores, counted holes completed, and ranked players correctly.
- Seeded historical round is hidden from anonymous users.
- Supabase Security Advisor currently reports no security findings.

## UX Rule
The scorer screen must remain a simplified continuation of the spreadsheet: players vertically, holes horizontally, totals visible, minimal navigation. Do not redesign it into a generic golf analytics dashboard.

## Do Not Do Yet
- Do not rebuild in React/Next.js.
- Do not redesign the public website.
- Do not automate handicap/differential logic.
- Do not build Order of Merit, Admin Points, GPS, statistics, social, team/tournament, payment, sponsor-dashboard, or CRM features.
- Do not expose Supabase secret/service-role credentials.
- Do not merge to `main` or production before two-user preview validation.

## Definition of Done for Gate 2
Gate 2 is complete only when an approved scorer can create/open a golf day, add players and enter scores; an approved member in a second session sees the updated live leaderboard and scorecard; member writes are blocked; unapproved access is blocked; and the existing public Events page still works.
