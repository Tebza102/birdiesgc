# Next Action

## Current Objective
Get the isolated `birdiesgc-pilot` Vercel deployment actually live, then complete real-browser/device validation of login/recovery, the live scorer, mobile layout, the Excel workbook import, and the event-details/poster feature — using the private acceptance-test golf day, real club data, and the real Chairman/Treasurer accounts.

## Gate Status
- Gate 1 — Backend/database/RLS/spreadsheet validation: **COMPLETE**.
- Gate 2 — Auth/calendar/scorer/digital scorecard/live leaderboard: **ENGINEERING COMPLETE; REAL-BROWSER/DEVICE VALIDATION IN PROGRESS**.
- Gate 2B — Admin Excel workbook upload/import for legacy continuity and backup: **ENGINEERING COMPLETE; per project log, migration applied live and hardened (`20260816131500_harden_import_rpc_permissions.sql`) — not independently re-verified by this session (no Supabase credentials here)**.
- Gate 2C — Mobile responsiveness of the Events / Member Golf Hub: **FIXED (CSS-only + a small player-cell total echo); VERIFIED BY STATIC REGRESSION CHECKS AND ARITHMETIC ONLY — NEEDS A REAL PHONE**.
- Gate 2D — Rich event details + poster upload: **ENGINEERING COMPLETE; per project log, migration applied live and corrected for hosted-Supabase Storage RLS (`e0cd424`) — not independently re-verified by this session**.
- Gate 2E — Pilot auth reliability + password recovery: **ENGINEERING COMPLETE (CDN fallback/timeout, visible loading/error states, Show/Hide password, Forgot password, full PASSWORD_RECOVERY flow, 20 passing static regression tests); NOT EXECUTE-TESTED AGAINST A LIVE PROJECT OR BROWSER**.
- Gate 3 — Private pilot deployment: **LINKED, NOT YET DEPLOYED** — `apprigate/birdiesgc-pilot` Vercel project created and GitHub-connected; the actual `vercel --prod --yes` push is blocked by this harness's safety classifier and needs a human or explicit permission. Never deploy to `birdiesgc` / `www.birdiesgc.co.za`.

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
4. Repeat on a phone/device (ideally 320/360/375/390/430px) and confirm the rebuilt mobile scorer grid shows the player identity plus multiple hole inputs without zooming, the leaderboard is readable, and the mobile header no longer covers content while scrolling — see "Gate 2C" above; this has only been checked by CSS arithmetic and static regression tests so far, never a real device.
5. Optional but required before final Gate 2 sign-off: bootstrap a second approved `member` account and verify it can watch the leaderboard but cannot write scores, and that Realtime updates a second session without reload.
6. After live-scorer acceptance passes, implement the locked Excel upload/import requirement described below.
7. Link a Vercel project for this repo to get a shareable private preview URL.

## Locked Requirement — Excel Workbook Upload / Legacy Backup — CORRECTED, NOT YET APPLIED LIVE
An approved admin can upload the club's latest `.xlsx` workbook from the platform (`Import Latest Club Workbook` on the Events member hub) so newer legacy games can be brought into Supabase without manual recapture. A first implementation pass was corrected after direct inspection of the real workbook found the parsing fixtures didn't match it (`project-os/10-prompts/claude-fix-excel-import-actual-workbook.md`): horizontal `Player details` parsing, `Game N` text-label game numbers, Games-header-driven score-column mapping, and safe game_number+venue+date fallback matching so a null `event_date` on the seeded Game 15 can be enriched by a later workbook without duplicating it. A real-browser regression where the ordinary Golf Hub broke on a project without the migration applied was also fixed — `loadGolfDays()` no longer depends on any Gate 2B column. Implementation detail: `project-os/04-technical/data-model.md` → "Admin Workbook Import"; migration `supabase/migrations/20260816120000_legacy_workbook_import.sql` (**intentionally not yet applied to the live Supabase project**). What remains: review and apply the migration, then a human uploads the club's actual current workbook to confirm the preview/import against real data — this was built and unit-tested (24 passing checks) against fixtures that mirror the real workbook layout, since the real workbook file itself was not available in this environment.

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

## Rich Event Details + Poster Upload — ENGINEERING COMPLETE, NOT YET APPLIED LIVE
An approved admin/management user can now enter promotional event details (short/full description, reporting/tee-off time, green fee, sponsor, note, up to 4 prizes, poster image + alt text, featured toggle) when creating a golf day, or edit them later from an already-created app golf day's detail view. Historical `closed + excel_import` rounds never show this edit path. The public Events page renders a database-backed Featured Event card and an enhanced calendar list from the same data, with a static fallback if Supabase/the migration is unavailable; the homepage gets a live "next event" countdown from the same query (previously dead static code, never duplicated data). Implementation detail: `project-os/04-technical/data-model.md` → "Event Details + Poster Upload"; migration `supabase/migrations/20260816130000_event_details_and_poster.sql` (**intentionally not yet applied to the live Supabase project**, including the new `event-posters` Storage bucket + policies). What remains: review and apply the migration, then a human should add real event details/upload a real poster as Admin, confirm a member/scorer account cannot access the edit UI or the Storage bucket, and confirm the public/homepage rendering looks right — this was built and unit-tested (14 passing checks) via static/source analysis only, since no live Supabase project or browser is available in this environment.

Purpose:
- Bring back the promotional presentation the old static site had (poster, prizes, sponsor visibility) without hard-coding it again.
- Let the club show golf days as real promotional events, not just scoring records.
- Lay a reusable (but not over-built) foundation for future member updates/newsletters/sponsor reports — intentionally not built in this pass; see `project-os/04-technical/data-model.md` for the documented future direction.

Required behavior:
- Promotional fields are entirely optional; a golf day with none of them continues to work exactly as before.
- Poster upload restricted to approved admin/management via Storage RLS; JPG/PNG/WebP only, 5MB limit enforced by the bucket itself.
- Public visitors can read posters/prizes only for `is_public = true` events already eligible under existing RLS.
- Never show an empty `Sponsor:`/`Green Fee:` label or an empty prize section when the field is absent.
- Never fall back to an unrelated placeholder photo when no poster was uploaded — omit the image instead.

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

### Approved admin/management
- Enter or edit a golf day's promotional event details and upload/replace its poster (implemented; not available to scorer/member accounts, and never available for historical `closed + excel_import` rounds).

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
- Do not merge to `main` or production before live-scorer/two-user preview validation and the required Excel upload/import and event-details/poster features are complete.

## Definition of Done for This MVP Phase
This phase is complete only when:
1. An approved scorer/admin can create/open a golf day, add players, enter hole scores, and see live totals/positions without disruptive rerenders.
2. An approved member in a second session sees updated leaderboard/scorecard data and cannot write scores.
3. Unapproved access is blocked clearly.
4. Historical Excel-imported rounds remain read-only and traceable to their source workbook.
5. An approved admin can upload the latest validated club `.xlsx` workbook, preview the changes, and safely import new/updated historical results without duplicate legacy games or fabricated hole scores.
6. The existing public Events page still works.
7. A private preview is ready for chairman/member testing.
8. An approved admin/management user can add/edit a golf day's promotional details and poster; the public Events page and homepage render them correctly with a safe fallback; a member/scorer account cannot edit event details or write to the poster Storage bucket.
