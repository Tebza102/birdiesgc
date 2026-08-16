# Data Model

## Design Principle
Model the club's real golf-day workflow, not the Excel workbook sheet-for-sheet and not a generic golf application. The spreadsheet is the behavioural reference and validation source. The pilot schema deliberately contains only what is needed for roster, golf days, score entry, live totals/ranking and role-based access.

## Implemented Entities
| Entity | Purpose | Key Fields | Relationships |
|---|---|---|---|
| `members` | Club/player roster independent of login accounts | id, full_name, email?, current_handicap?, active, source_type, source_reference | Referenced by golf-day participants; optionally linked to Auth profile |
| `user_profiles` | Application authorisation record for an Auth user | id=auth user id, member_id?, role, approved | Optional link to member |
| `golf_days` | One club game/event being scored | id, game_number?, title, venue, event_date?, status, scoring_method, hole_count, is_public, legacy_import_key?, short_description?, description?, reporting_time?, tee_off_time?, green_fee?, event_note?, sponsor_name?, prizes (jsonb array), poster_path?, poster_alt?, featured | Has participating players |
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

Corrected against direct inspection of the real `Monthly Medal APRIL@2026-3.xlsx` (an earlier pass had guessed a simplified layout):
- `Player details` is **horizontal**: a `Member Name` row and an `HC` row, with names/handicaps running across columns (not one row per player). Plus-handicaps (`+4`) are preserved as text.
- `Games` has a header row (`GAME #`, `VENUE`, `DATE`, `PLAYER`, then one column per player from `E` onward); data-row game numbers are text labels such as `Game 15`, parsed with a strict `Game N` pattern rather than `Number()`. Score columns are mapped using the player names in that same header row — never the order returned from `Player details`.
- Dates: a real Excel date, or strict ISO `YYYY-MM-DD` text, are accepted; anything else stays `null` (TBC).

- The browser parses the uploaded `.xlsx` locally (SheetJS, pinned to `xlsx@0.18.5` via jsDelivr's `+esm` build — the last npm-published release, Apache-2.0) and shows a preview; nothing is written until Admin confirms.
- Historical-game identity is **not** exact-key equality. The seeded Game 15 currently has `event_date = null`; a later workbook may supply it, and that must enrich the same row rather than create a second Game 15. `private.match_historical_golf_day(game_number, venue, event_date)` (mirrored client-side by `matchHistoricalGame()` in `js/legacy-import-utils.js`) finds candidates by `game_number` + normalized venue, then: an exact-date match wins; a single null-date candidate with no conflicting dated candidate is enriched; anything else genuinely ambiguous is surfaced as a conflict and skipped rather than guessed. `golf_days.legacy_import_key` (`private.legacy_game_key()`) is kept only as an audit/traceability fingerprint, not the identity rule. A defensive unique index — `(game_number, normalize_text(venue), coalesce(event_date, 'infinity'::date))` for `source_type = 'excel_import'` — backstops against literal duplicate rows.
- The only way historical data can be written by an import is the `public.import_legacy_workbook(payload jsonb)` RPC (`security definer`, `search_path = ''`). It re-derives the match/legacy-key/name-normalization itself rather than trusting the browser, re-checks caller `role = 'admin'` and `approved = true` against `user_profiles` on every call, and refuses to write into any golf day whose `source_type` is not `excel_import` — so an app-created/live round can never be touched by an import, even with a malicious payload.
- Member matching uses the same normalized-name equality as everywhere else in the schema; an ambiguous (multiple-match) name is skipped rather than guessed, both in the browser preview and again inside the RPC.
- Each successful call inserts one row into `workbook_imports` (unique on `checksum_sha256`), which also blocks importing the exact same file twice — enforced both as a pre-check inside the function (clear error message) and by the unique index as a race-condition backstop.
- A single RPC invocation is one implicit Postgres transaction: any raised exception (unapproved caller, duplicate checksum, an internal invariant violation) rolls back everything the call attempted, so there is no partial import.
- **The ordinary Events/member hub never depends on this migration being applied.** `loadGolfDays()` (used by every signed-in member/scorer/admin) only selects base-schema columns and never selects `legacy_import_key`. The admin-only import panel separately probes for the Gate 2B objects (`checkImportBackendAvailable()` — a lightweight `workbook_imports` read) before rendering an active form; if the migration hasn't been applied yet, it shows a clear "Import backend not installed yet" message instead of an active form, and the rest of the hub is completely unaffected. This corrects a real-browser regression where the ordinary select immediately 400'd against a live project that didn't yet have this migration applied.
- Pure parsing/normalization/matching logic lives in `js/legacy-import-utils.js` (loaded as `window.BirdieLegacyImport` on `events.html`, before `js/birdie-mvp.js`) so the same code the browser preview uses is also exercised by `node scripts/test-legacy-import.js`, whose fixtures now mirror the real horizontal `Player details` / labelled `Games` layout, without a browser, Supabase, or the XLSX library.
- See `supabase/migrations/20260816120000_legacy_workbook_import.sql` for the full implementation. **Not yet applied to the live Supabase project** — intentionally held back until this corrected version is reviewed.

## Event Details + Poster Upload
Restores the richer promotional presentation the old static `events-data.js` site had (description, times, green fee, sponsor, prizes, poster, featured treatment), now database-backed on `golf_days` rather than hard-coded, so a golf day can be presented as a real promotional event and not just a scoring record.

- New nullable columns on `golf_days`: `short_description`, `description`, `reporting_time`, `tee_off_time`, `green_fee`, `event_note`, `sponsor_name`, `prizes` (jsonb array, default `[]`, `{label, value}` items — intentionally simple, no prize-management subsystem), `poster_path`, `poster_alt`, `featured`. All optional; a golf day with none of them set continues to score and render exactly as before.
- No new `golf_days` RLS policy: the existing admin/management write policies already cover every column of the table, including these; the existing public/approved-member read policies already expose them for an eligible row. Scorer/member roles remain unable to write to `golf_days` at all.
- **Poster storage**: a public-read `event-posters` Supabase Storage bucket (JPG/PNG/WebP only, 5MB limit, both enforced by the bucket configuration itself — `js/birdie-mvp.js`'s client-side `POSTER_MAX_BYTES`/`POSTER_ALLOWED_TYPES` are checked for consistency with the bucket in `node scripts/test-event-details.js`, not just trusted independently). Write/delete restricted to approved `admin`/`management` via `storage.objects` RLS policies scoped to `bucket_id = 'event-posters'`. The object path is stored in `golf_days.poster_path`; the public URL is always derived in the browser via `storage.getPublicUrl()`, never stored as a brittle full URL. Uploads use a collision-safe `<golf_day_id>/<timestamp>-<random>.<ext>` path; replacing a poster best-effort-deletes the previous object (non-fatal if that cleanup fails).
- **Create/edit UX**: the existing fast "Create a new golf day" flow is unchanged and still requires nothing beyond title/date/venue — an optional collapsed "Event / promotion details" section was added to the same form. A separate "Edit event / promotion details" section appears on an already-created `app`-sourced golf day's detail view (`admin`/`management` only) so a poster/prizes/description can be added later without recreating the round. Historical `closed + excel_import` rounds never show this edit path (`isReadOnlyHistoricalDay()` gate, same as the scoring UI).
- **Public rendering**: `js/birdie-public-events.js` queries `is_public = true` scheduled/live days including the new columns and renders a database-backed Featured Event card (`featured = true` wins, else the nearest upcoming public event) plus an enhanced calendar list, with null-safe rendering throughout (no bare `Sponsor:`/`Green Fee:` label when absent, no prize section for an empty array, no fallback-to-unrelated photo when no poster exists — the media block is simply omitted). Falls back automatically to the base-schema query (then to the static `events-data.js` content) if the rich columns don't exist yet or Supabase is unavailable.
- **Homepage**: the same query drives a live "next event" countdown card (`window.BirdieEventUtils`, exposed from `js/main.js`, supplies the shared countdown timer/markup so this isn't reimplemented) — replacing a static countdown feature that was previously dead code (defined but never called). No event data is duplicated between the homepage and the Events page; both read the one Supabase source once Supabase is available.
- **Member Golf Hub calendar**: stays compact — a day with a poster or prizes gets a tiny `::after`-based star badge on its calendar button (no extra DOM, calendar cell sizing unchanged); the day detail shows the full presentation block above the leaderboard/scorer only when any presentation field is actually set.
- **Migration-compatibility discipline (same lesson as Gate 2B)**: `loadGolfDays()` (the ordinary hub loader used by every signed-in user) never selects any of these new columns. Presentation flags (for the calendar badge) and full presentation detail (for the day-detail block) are fetched via separate, independently try/caught queries, so a project without this migration applied keeps working exactly as before — no presentation block, no badge, no crash. `createGolfDay()` goes further: it attempts the insert with the promo fields first, and if that fails (columns don't exist yet), retries with the base columns only, so golf-day creation itself is never blocked by this migration being absent.
- See `supabase/migrations/20260816130000_event_details_and_poster.sql` for the full implementation. **Not yet applied to the live Supabase project** — same discipline as Gate 2B, held back until reviewed.

## Future Content/News Seam (Not Built This Pass)
The club wants future member updates, newsletters, event reports and sponsor-facing reports. This pass deliberately does not build that:
- No CMS/newsletter engine, no `club_posts` table, no report/gallery data model — the existing static `report`/`gallery` fields in `js/events-data.js` remain reference-only, not migrated or fabricated.
- The poster/media approach here (a Storage bucket + a path column + browser-derived public URL) is reusable *in principle* for a future content model, but was not generalised prematurely — event posters are public by design, while future member-only documents (newsletters, sponsor reports) would need a **separate private bucket with its own RLS**, not a relaxation of `event-posters`.
- A reasonable future direction, when actually needed: a `club_posts` (or similar) table — `id, title, body, author_id, audience ('public'|'member'|'sponsor'), published_at, attachment_path?` — with its own RLS policies per audience, and its own private Storage bucket for member/sponsor-only attachments. Not implemented now; documented here so the next pass has a starting point instead of guessing.

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
