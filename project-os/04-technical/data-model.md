# Data Model

## Design Principle
Model the club's real golf-day workflow, not the Excel workbook sheet-for-sheet and not a generic golf application. The spreadsheet is the behavioural reference and validation source. The pilot schema deliberately contains only what is needed for roster, golf days, score entry, live totals/ranking and role-based access.

## Implemented Entities
| Entity | Purpose | Key Fields | Relationships |
|---|---|---|---|
| `members` | Club/player roster independent of login accounts | id, full_name, email?, current_handicap?, active, source_type, source_reference | Referenced by golf-day participants; optionally linked to Auth profile |
| `user_profiles` | Application authorisation record for an Auth user | id=auth user id, member_id?, role, approved | Optional link to member |
| `golf_days` | One club game/event being scored | id, game_number?, title, venue, event_date?, status, scoring_method, hole_count, is_public | Has participating players |
| `golf_day_players` | A roster member participating in one golf day | id, golf_day_id, member_id, handicap_at_start?, score_source, final_score_override? | Belongs to golf day/member; has hole scores |
| `hole_scores` | Hole-by-hole digital scorecard entries | id, golf_day_player_id, hole_number, strokes, updated_by, updated_at | Belongs to one golf-day player |
| `live_leaderboard` | Security-invoker derived view for member results | golf_day_player_id, player_name, holes_completed, total_score, position | Aggregates participants + hole scores |

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
