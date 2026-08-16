# Data Model

## Design Principle
Model the club's real golf-day workflow, not the Excel workbook sheet-for-sheet and not a generic golf application. The spreadsheet is the behavioural reference and validation source. The pilot schema deliberately contains only what is needed for roster, golf days, score entry, live totals/ranking and role-based access.

## Implemented Entities
| Entity | Purpose | Key Fields | Relationships |
|---|---|---|---|
| `members` | Club/player roster independent of login accounts | id, full_name, email?, current_handicap?, active, source_type, source_reference | Referenced by golf-day participants; optionally linked to Auth profile |
| `user_profiles` | Application authorisation record for an Auth user | id=auth user id, member_id?, role, approved | Optional link to member |
| `golf_days` | One club game/event being scored | id, game_number?, title, venue, event_date?, status, scoring_method, hole_count, is_public, legacy_import_key? | Has participating players |
| `golf_day_players` | A roster member participating in one golf day | id, golf_day_id, member_id, handicap_at_start?, score_source, final_score_override? | Belongs to golf day/member; has hole scores |
| `hole_scores` | Hole-by-hole digital scorecard entries | id, golf_day_player_id, hole_number, strokes, updated_by, updated_at | Belongs to one golf-day player |
| `live_leaderboard` | Security-invoker derived view for member results | golf_day_player_id, player_name, holes_completed, total_score, position | Aggregates participants + hole scores |
| `workbook_imports` | Audit trail of admin Excel workbook imports | id, filename, checksum_sha256 (unique), imported_by, imported_at, summary (jsonb) | Written only by `import_legacy_workbook()` |

## Explicitly Not Modelled Yet
There are no MVP tables for course GPS, course-hole metadata, handicap differentials, Order of Merit, Admin Points, personal statistics, teams, tournaments, payments, social feeds or sponsor administration. Add them only after pilot usage proves the requirement.

## Status Values
`golf_days.status`:
- `scheduled`
- `live`
- `closed`
- `cancelled`

## Scoring Method
The only current scoring method is `gross_stroke_v1`.

For a live participant:
- `holes_completed` = count of recorded hole-score rows.
- `total_score` = sum of recorded strokes.
- lower total ranks higher.
- PostgreSQL `rank()` is used so ties reproduce the spreadsheet's ranking behaviour.

For a historical Excel-only participant:
- `score_source = imported_total`.
- `final_score_override` stores the spreadsheet's final score.
- `holes_completed` is presented as the full golf day for historical ranking display.
- the UI must state that no hole-by-hole history exists rather than fabricating a digital card.

## Core Constraints
- One participant row per member per golf day.
- One score row per participant per hole.
- Hole number must be 1–18.
- Strokes must be an integer from 1–30 when present.
- `hole_count` is 1–18; default is 18.
- `score_source` is `live` or `imported_total`.
- `user_profiles.role` is `admin`, `management`, `scorer`, or `member`.
- New users default to `approved = false`.
- `updated_by` records the Auth user responsible for live score changes where supplied by the client session.

## Spreadsheet Mapping
- `Player details` → `members.full_name` plus the current handicap reference preserved as text.
- `Games` → historical `golf_days` and `golf_day_players.final_score_override` validation data.
- `Ranking` → expected ordering acceptance test.
- `Handicaps`, `Differentials`, `Players History`, `Admin Points`, `OoM`, `Order of Merit` → reference only; not automated in MVP.

The spreadsheet's column-per-player structure is intentionally not copied into Postgres. Player participation and hole scores are normalised into rows.

## Current Validation Dataset
Source workbook: `Monthly Medal APRIL@2026-3.xlsx`.

Imported into Supabase:
- 83 roster members.
- Game 15 / STATEMINES GC.
- 22 player final scores.

The `live_leaderboard` view reproduces the spreadsheet ranking exactly, including ties. The seed SQL is recorded at `/supabase/seed_historical_game15.sql`.

## Admin Workbook Import
Approved admins can bring a newer copy of the club workbook into Supabase from the Events member hub without manual recapture, while the workbook itself remains the club's independent backup.

- The browser parses the uploaded `.xlsx` locally (SheetJS, pinned to `xlsx@0.18.5` via jsDelivr's `+esm` build — the last npm-published release, Apache-2.0) and shows a preview; nothing is written until Admin confirms.
- `golf_days.legacy_import_key` is a deterministic fingerprint — `game_number|normalized_venue[|event_date]` — computed by `private.legacy_game_key()`. A partial unique index (`legacy_import_key is not null`) guarantees at most one `excel_import` golf day can ever claim a given key, so a repeat import of the same historical game updates that one row instead of duplicating it. The seeded Game 15 round was backfilled with its key in the same migration that introduced the column.
- The only way historical data can be written by an import is the `public.import_legacy_workbook(payload jsonb)` RPC (`security definer`, `search_path = ''`). It re-derives the legacy key and name-normalization itself rather than trusting the browser, re-checks caller `role = 'admin'` and `approved = true` against `user_profiles` on every call, and refuses to write into any golf day whose `source_type` is not `excel_import` — so an app-created/live round can never be touched by an import, even with a malicious payload.
- Member matching uses the same normalized-name equality as everywhere else in the schema; an ambiguous (multiple-match) name is skipped rather than guessed, both in the browser preview and again inside the RPC.
- Each successful call inserts one row into `workbook_imports` (unique on `checksum_sha256`), which also blocks importing the exact same file twice — enforced both as a pre-check inside the function (clear error message) and by the unique index as a race-condition backstop.
- A single RPC invocation is one implicit Postgres transaction: any raised exception (unapproved caller, duplicate checksum, an internal invariant violation) rolls back everything the call attempted, so there is no partial import.
- Pure parsing/normalization/categorization logic lives in `js/legacy-import-utils.js` (loaded as `window.BirdieLegacyImport` on `events.html`, before `js/birdie-mvp.js`) so the same code the browser preview uses is also exercised by `node scripts/test-legacy-import.js` without a browser, Supabase, or the XLSX library.
- See `supabase/migrations/20260816120000_legacy_workbook_import.sql` for the full implementation.

## Auth Separation
A roster member does not require an Auth account. This allows the full club roster to be used in score capture immediately while only a handful of chairman/management/scorer/member pilot users receive logins.

An Auth session is also not sufficient by itself. RLS requires `user_profiles.approved = true` before protected club scoring data is visible.

## Security Considerations
- RLS is enabled on every exposed public table.
- Anonymous access is limited to `golf_days` where `is_public = true`.
- Approved Auth users may read protected golf-day scoring data.
- Staff writes require approved account + authorised database role.
- `live_leaderboard` uses `security_invoker = true` so underlying RLS remains effective.
- The frontend uses only the Supabase project URL and publishable key.
- Roles and approval are not stored in user-editable metadata.

## Realtime
The Supabase Realtime publication includes:
- `golf_days`
- `golf_day_players`
- `hole_scores`

The Events MVP client subscribes to these changes and refreshes the active golf day. This is intentionally simple for pilot scale.

## Data Lifecycle
1. Import club roster once from the spreadsheet.
2. Management/admin creates a golf day.
3. Staff selects participants from `members`.
4. Scorer records hole scores.
5. Database derives holes completed, total score and position.
6. Approved members view leaderboard/scorecards live.
7. Management closes the golf day when scoring is complete.
8. Historical results remain available for later features, but do not automatically trigger handicap/Order-of-Merit logic in the MVP.

## Migration Source of Truth
Applied Supabase migrations are mirrored in `/supabase/migrations/` using the same migration versions returned by the connected Supabase project.

## Migration Notes for Later
Future phases may add verified scoring formats, handicap calculation, Order of Merit, player statistics, course/hole metadata, teams/tournaments, media and GPS. Do not pre-build these schemas during the pilot.
