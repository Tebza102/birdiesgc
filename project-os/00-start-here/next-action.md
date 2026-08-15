# Next Action

## Current Objective
Finish Gate 2 by validating the already-built Supabase-backed Events/member golf workflow with real approved users, without expanding scope.

## Gate Status
- Gate 1 — Backend/database/RLS/spreadsheet validation: **COMPLETE**.
- Gate 2 — Auth/calendar/scorer/digital scorecard/live leaderboard: **IMPLEMENTED ON FEATURE BRANCH; REAL-USER VALIDATION REQUIRED**.
- Gate 3 — Private chairman/member preview: **NOT STARTED**.

## Immediate Next Actions
1. Bootstrap one real Supabase Auth pilot account using an email address supplied/approved by the user.
2. Mark that profile `approved = true` and assign `admin`, `management`, or `scorer` as appropriate using controlled database administration — never browser-editable metadata.
3. Sign in on the Events page and verify the member hub loads the imported Game 15 leaderboard.
4. Create one throwaway live golf day from the UI and add a few imported roster players.
5. Enter hole scores through the Excel-familiar scorer grid and confirm totals/positions.
6. Bootstrap a second approved `member` account and verify it can watch the leaderboard but cannot write scores.
7. Verify Realtime updates in two independent sessions.
8. Remove/replace the legacy hard-coded auth implementation from shared `js/main.js` before any production merge.
9. Re-run Supabase Security Advisor after any auth/RLS changes.
10. Prepare a private preview only after the above passes.

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
