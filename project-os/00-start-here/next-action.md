# Next Action

## Current Objective
Complete real-browser/device validation of the live scorer and the new Excel workbook import using the private acceptance-test golf day and the club's actual latest workbook.

## Gate Status
- Gate 1 — Backend/database/RLS/spreadsheet validation: **COMPLETE**.
- Gate 2 — Auth/calendar/scorer/digital scorecard/live leaderboard: **ENGINEERING COMPLETE; REAL-BROWSER/DEVICE VALIDATION IN PROGRESS**.
- Gate 2B — Admin Excel workbook upload/import for legacy continuity and backup: **ENGINEERING COMPLETE (preview, conservative matching, atomic admin-gated RPC, audit trail, 15 passing unit tests); REAL-WORKBOOK ACCEPTANCE TESTING REQUIRED**.
- Gate 3 — Private chairman/member preview: **NOT STARTED** (needs a Vercel project link).

## Private Acceptance-Test Golf Day
Created directly in Supabase on 2026-08-16:
- Title: `MVP Live Score Test - 16 Aug 2026`
- Venue: `TEST ONLY - Local Acceptance`
- Status: `scheduled`
- Public: `false`
- Source: `app`
- Golf day id: `d8407dae-7e28-431c-b19a-f733bc8de787`
- Players preloaded with zero hole scores: MISS CAROL SIBIYA, MR DUKE MAPHUNYE, MR SLENDA SITHEBE, MR VELI HLOPHE.

This record is disposable acceptance-test data and must not be treated as a real club result.

## Immediate Next Actions
1. Refresh/open the Events page while signed in as the approved Admin and select `MVP Live Score Test - 16 Aug 2026`.
2. Start the live round.
3. Enter a few hole scores through the Excel-familiar scorer grid and confirm totals/positions update without losing scorer focus/scroll position.
4. Repeat on a phone/device and confirm the grid is usable with the enlarged tap targets.
5. Optional but required before final Gate 2 sign-off: bootstrap a second approved `member` account and verify it can watch the leaderboard but cannot write scores, and that Realtime updates a second session without reload.
6. After live-scorer acceptance passes, implement the locked Excel upload/import requirement described below.
7. Link a Vercel project for this repo to get a shareable private preview URL.

## Locked Requirement — Excel Workbook Upload / Legacy Backup — IMPLEMENTED, NEEDS REAL-WORKBOOK ACCEPTANCE
An approved admin can now upload the club's latest `.xlsx` workbook from the platform (`Import Latest Club Workbook` on the Events member hub) so newer legacy games can be brought into Supabase without manual recapture. Implementation detail: `project-os/04-technical/data-model.md` → "Admin Workbook Import"; migration `supabase/migrations/20260816120000_legacy_workbook_import.sql`. What remains is a human uploading the club's actual current workbook to confirm the preview/import against real data — this was built and unit-tested against the documented/validated layout only, since the real latest workbook was not available in this environment.

Purpose:
- Keep the digital platform current with games that still exist only in the club workbook.
- Let the club continue keeping its existing spreadsheet as an operational backup / fallback during the pilot.
- Avoid forcing a hard cut-over from Excel before the live system has proven itself.

Required behavior:
- Admin-only upload entry point; members/scorers cannot import workbooks.
- Accept `.xlsx` only for the MVP.
- Parse only the workbook structures already validated in `Monthly Medal APRIL@2026-3.xlsx` unless a later workbook proves a compatible extension.
- Import/update roster names and current handicap where safely identifiable.
- Import historical golf-day final totals as read-only `excel_import` rounds; never fabricate hole-by-hole scores.
- Existing imported historical rounds must not be duplicated when a newer workbook contains them again. Match/update only when the legacy game can be identified confidently; ambiguous conflicts must be surfaced rather than guessed.
- Never overwrite or downgrade live/app-created golf days with spreadsheet data.
- Show an import preview/summary before final commit: workbook name, games found, new games, matched games, players affected, conflicts/skips.
- Record source filename and import audit metadata sufficient to trace where a historical result came from.
- Import failure must be recoverable and must not leave partially-created duplicate history.
- Keep the workbook itself as the club's independent backup; the platform is an additional system, not the only copy.

Do not expand this into generic spreadsheet ETL, reporting, handicap automation, or Order of Merit automation in this phase.

## User Input Policy
Do not ask the user to create tables, copy SQL, understand Supabase internals, or manage roles manually. Ask only for the smallest information that cannot safely be inferred or generated.

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

### Approved admin only
- Management/scorer permissions.
- Upload/import the club's latest `.xlsx` legacy workbook (implemented; not available to management/scorer/member accounts).

## Acceptance Tests Already Passed
- 83 spreadsheet roster members imported.
- Game 15 / STATEMINES GC imported with 22 players.
- Database leaderboard matches spreadsheet ranking exactly, including ties.
- Temporary live hole-score test summed scores, counted holes completed, and ranked players correctly.
- Seeded historical Excel-imported round is read-only in the UI and hidden from anonymous users.
- Approved Admin login works in a real browser.
- Historical Game 15 browser view matches the expected leaderboard and imported-scorecard behavior.

## UX Rule
The scorer screen must remain a simplified continuation of the spreadsheet: players vertically, holes horizontally, totals visible, minimal navigation. Do not redesign it into a generic golf analytics dashboard.

## Do Not Do Yet
- Do not rebuild in React/Next.js.
- Do not redesign the public website.
- Do not automate handicap/differential logic.
- Do not build Order of Merit, Admin Points, GPS, statistics, social, team/tournament, payment, sponsor-dashboard, or CRM features.
- Do not expose Supabase secret/service-role credentials.
- Do not merge to `main` or production before live-scorer/two-user preview validation and the required Excel upload/import feature are complete.

## Definition of Done for This MVP Phase
This phase is complete only when:
1. An approved scorer/admin can create/open a golf day, add players, enter hole scores, and see live totals/positions without disruptive rerenders.
2. An approved member in a second session sees updated leaderboard/scorecard data and cannot write scores.
3. Unapproved access is blocked clearly.
4. Historical Excel-imported rounds remain read-only and traceable to their source workbook.
5. An approved admin can upload the latest validated club `.xlsx` workbook, preview the changes, and safely import new/updated historical results without duplicate legacy games or fabricated hole scores.
6. The existing public Events page still works.
7. A private preview is ready for chairman/member testing.
