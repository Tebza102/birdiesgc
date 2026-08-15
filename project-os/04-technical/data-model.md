# Data Model

## Design Principle
Model the club's real golf-day workflow rather than reproducing Excel sheet-for-sheet. The spreadsheet remains the behavioural reference and seed source. The MVP database must be small enough to understand and safe enough to test for several months.

## Main Entities
| Entity | Purpose | Key Fields | Relationships |
|---|---|---|---|
| `members` | Club/player roster independent of login accounts | id, full_name, email?, current_handicap?, active, legacy_name | Referenced by golf-day participants; optionally linked to profile |
| `profiles` | Authenticated app user and role | id=auth user id, member_id?, full_name, role, active | Optional link to member |
| `courses` | Reusable golf-course identity | id, name, active | Has course holes; referenced by golf days |
| `course_holes` | Hole metadata | course_id, hole_number, par, stroke_index? | Belongs to course |
| `golf_days` | One club game/event being scored | id, game_number?, title, date, venue, course_id?, status | Has participating players |
| `golf_day_players` | Player participation and snapshot | id, golf_day_id, member_id, handicap_at_start?, status | Belongs to golf day/member; has hole scores |
| `hole_scores` | Digital scorecard entries | id, golf_day_player_id, hole_number, strokes, updated_by, updated_at | Belongs to one golf-day player |

## Suggested Status Values
`golf_days.status`: `draft`, `open`, `live`, `final`.
`golf_day_players.status`: `playing`, `withdrawn`, `finished` where needed; default should be simple.

## Core Constraints
- One `course_holes` row per course + hole number.
- Hole number must be 1 through 18 for the first MVP.
- Par must be a positive sensible integer.
- One participant row per member per golf day.
- One score row per participant per hole.
- Strokes must be a positive integer when present.
- `updated_by` should identify the authenticated scorer/user making the change.
- Do not delete historical golf days casually; prefer final/archive behaviour later if needed.

## Leaderboard Derivation
For the first validated scoring mode:
- `holes_completed` = count of recorded hole scores for player.
- `total_score` = sum of recorded strokes.
- `position` = rank according to the club's approved MVP ranking rule, initially validated against the supplied spreadsheet where lower final score ranks higher.

Do not implement unverified net-score, Stableford, handicap-differential, Admin Points, or Order of Merit calculations in this MVP.

## Spreadsheet Mapping
- `Player details` → seed `members.full_name` and reliable current-handicap reference.
- `Games` → historical golf-day validation data and final scores.
- `Ranking` → acceptance-test expected ordering.
- `Handicaps`, `Differentials`, `Players History`, `Admin Points`, `OoM`, `Order of Merit` → reference only for later phases; do not automate yet.

The spreadsheet's column-per-player structure must not be copied into Postgres. Normalise each player participation and each hole score into rows.

## Auth Separation
A roster member does not require an Auth user. This allows all existing players to appear in golf days immediately while only chairman/management/scorer/test members need accounts during the pilot.

## Security Considerations
- Enable RLS on every exposed table.
- Public/anon may read only approved published event fields/data.
- Authenticated members may read approved golf-day/score data.
- Only scorer/management/admin roles may insert/update score rows.
- Role policy design must be tested for direct API access, not only UI behaviour.
- No secrets belong in database rows exposed to frontend clients.

## Realtime
Enable Realtime only for tables required to refresh the live experience, principally `hole_scores` and, if necessary, `golf_days`. Keep subscriptions scoped to the active golf day where possible.

## Data Lifecycle
1. Import roster once from spreadsheet.
2. Admin/scorer creates golf day.
3. Participants selected from members.
4. Scorer records hole scores during play.
5. Members read totals/ranking live.
6. Golf day becomes `final` after scoring completes.
7. Historical result remains readable and becomes future input for later statistics features.

## Migration Notes
Future phases may add scoring formats, handicap calculations, Order of Merit, player statistics, teams/tournaments, media, GPS/course data and richer audit history. Do not pre-build these schemas in MVP.
