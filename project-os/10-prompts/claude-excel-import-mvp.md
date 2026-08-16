# DEV MODE — Claude Instruction: Excel Legacy Import MVP

## Objective
Finish the Birdie Squad MVP phase by adding a safe, admin-only `.xlsx` workbook import flow that lets the club bring newer legacy games into Supabase without manually recapturing them, while continuing to use the existing Excel workbook as an independent operational backup/fallback during the pilot.

Work only on `agent/supabase-golf-day-mvp`. Read the Project OS docs first, especially `project-os/00-start-here/next-action.md`, `project-os/04-technical/architecture.md`, `project-os/04-technical/auth-and-roles.md`, `project-os/04-technical/data-model.md`, and the existing finisher brief. Inspect the current migrations/schema before changing anything. Do not redesign the platform or change the scoring rules.

## Current proven behavior to preserve
- Static HTML/CSS/Vanilla JS site; no framework migration.
- Supabase Auth/Postgres/RLS/Realtime; publishable browser key only.
- Approved Admin/Management/Scorer/Member role model already exists.
- `apprigate@gmail.com` is an approved Admin pilot account.
- Historical Game 15 / STATEMINES GC is an `excel_import`, closed, read-only round.
- Historical Game 15 final totals reproduce the club workbook ranking exactly, including ties.
- `Games` recorded totals are the authoritative legacy result for this MVP; do not invent handicap/net/Stableford logic.
- Live app-created rounds use hole-by-hole `hole_scores` and derive totals/positions.
- Closed Excel-imported rounds must stay read-only in the UI.
- Do not merge to `main`.

## User goal
The club has played additional games since the workbook used for the initial seed. The Admin should be able to select the club’s latest `.xlsx` workbook in the platform, preview what it contains, and safely import newer legacy roster/results data. The workbook remains a separate backup/fallback system; the platform is an additional live system, not a hard replacement.

## MVP upload/import user journey
1. Approved Admin opens the Member Golf Hub / Events admin area.
2. Admin sees a clearly labelled `Import Latest Club Workbook` control.
3. Admin selects one `.xlsx` file from their device.
4. The browser parses the workbook locally using a pinned, browser-safe XLSX parser from an official/current distribution. Verify current docs/license before pinning. Do not add a framework. Prefer avoiding a package.json change if a pinned browser module/CDN is sufficient and secure.
5. The UI shows a preview before any database write:
   - workbook filename
   - workbook checksum/hash
   - roster members found
   - historical games found
   - new games
   - confidently matched existing Excel-imported games
   - new/matched players
   - conflicts/ambiguous rows/skips
   - exact warning that app-created/live rounds will never be overwritten
6. Admin explicitly clicks `Import` only after reviewing the preview.
7. The commit is atomic: either the workbook import succeeds coherently or no partial historical import is left behind.
8. Show a concise success summary and refresh the Golf Day List.
9. Imported rounds display as closed/read-only historical records with leaderboard + imported scorecards only.

## Workbook structures already validated
The implementation should support only the workbook family already validated in the project. Do not build generic ETL.

### `Player details`
The club roster is stored across columns. The validated fields include:
- Member Name
- HC
- Cell #
- ICE Name
- ICE Cell #
- SAGU#
- Date Joined

For this MVP import, use only:
- Member Name
- HC / current handicap

Do not import Cell/ICE/contact data into the MVP; it is unnecessary and sensitive.

Use conservative label-based parsing where possible rather than hard-coding a single row number. Normalize names only for safe matching (trim, collapse repeated whitespace, case-insensitive comparison). Do not fuzzy-match different people.

### `Games`
Validated layout:
- column A: GAME #
- column B: VENUE
- column C: DATE
- column D: category/descriptor-like value
- columns E:CZ: one roster member per column, aligned with the roster/player ordering
- each game is one row
- populated score cells are final recorded round totals such as 71, 75, 83, 98

Use the Player details roster ordering / validated member mapping to associate columns with players when needed; do not assume the `Games` sheet has a perfect independent header row if the workbook structure does not.

### Legacy result rule
- Use the recorded total in `Games` as the historical total.
- Do **not** use `Nett Results` as a separate calculated net score. In the validated workbook it mostly copies `Games`.
- Do not import `Ranking` as authority; the app derives rank from stored totals ascending and preserves ties.
- Do not automate Handicaps, Differentials, Admin Points, OoM, Order of Merit, Stableford, WHS, or other tournament formats.
- Never fabricate hole-by-hole scores for imported history.

## Conservative matching / deduplication rules
The latest workbook may contain all older games again. Re-import must not duplicate them.

### Members
- Match existing members only on a safe normalized-name equality (trim/collapse whitespace/case-insensitive).
- If exactly one match exists, update `current_handicap` only when a usable HC value is present.
- If there are zero matches, create a roster member.
- If multiple/ambiguous matches occur, show a conflict and skip rather than guessing.
- Preserve plus-handicap display values exactly as legacy text (`+4`, `+2`, etc.); handicap remains informational in this MVP.

### Games
Add the smallest schema support necessary for durable legacy identity/audit. A recommended shape is a nullable `legacy_import_key` on `golf_days` plus an import-audit table, but inspect the existing schema first and choose the minimal safe design.

A legacy game key must be deterministic and conservative. Prefer a fingerprint derived from:
- game number
- normalized venue
- valid event date when available

If a valid date is absent, use game number + normalized venue and treat any competing match as ambiguous rather than guessing. Backfill the seeded Game 15 key so a later workbook containing Game 15 matches it instead of creating a duplicate.

Rules:
- only exact/confident matches may update an existing `source_type = 'excel_import'` golf day
- never overwrite, convert, or downgrade an `app`-created golf day
- if the same legacy key maps to conflicting candidate records, preview as conflict and skip until a human resolves it
- newer workbook totals may update the matching Excel-imported round, but only inside the transactional import and only for that legacy round

## Atomic database import
Do not perform a long sequence of unrelated browser inserts that can leave half an import behind.

Implement a transaction-safe database entry point, preferably an authenticated Postgres RPC that receives a normalized JSON payload plus workbook metadata and performs the final import atomically.

Required security behavior:
- only an authenticated, active, approved `admin` may commit a workbook import
- do not trust client-side role checks as authorization
- perform a DB-side admin check against `user_profiles`
- no service-role/secret in browser or repo
- if using `security definer`, set an explicit safe `search_path` and keep the function narrowly scoped
- RLS remains enabled on exposed tables
- app-created rounds are protected from import updates even if the client payload is malicious

Add import audit data sufficient to trace a completed import, e.g.:
- import id
- filename
- SHA-256 checksum (compute in browser with Web Crypto if practical)
- imported_by
- imported_at
- summary JSON/counts

The raw workbook does not need to be stored in Supabase Storage for this MVP unless there is a compelling reason; the user explicitly wants the club’s Excel file to remain an independent backup. Record the source filename/checksum and keep the database traceable.

Prevent accidental same-file repeat imports using checksum/audit awareness, while still allowing a deliberately newer workbook with a different checksum to be imported.

## Preview behavior
Parsing/preview must not mutate data.

The preview should compare the normalized workbook payload against current Supabase data and clearly categorize:
- new member
- matched member / handicap update
- new legacy game
- matched legacy game / totals update
- unchanged legacy game
- conflict / skip

The final RPC must revalidate the important invariants rather than trusting the preview.

## UI / UX constraints
Keep the flow simple and familiar, not technical:
- `Import Latest Club Workbook`
- `Choose Excel File`
- `Preview Import`
- summary cards/table
- conflicts shown in plain language
- `Import Workbook` confirmation button
- success/error summary

Do not show SQL, JSON, internal IDs, RLS terminology, or database jargon to the club user.

Admin-only UI. Member/scorer accounts must not see the import action.

Do not let a workbook import make an Excel historical round editable as a live score sheet.

## Error handling
- Reject non-`.xlsx` files before parsing.
- Reject unsupported/missing required workbook sheets with a clear message.
- Reject a workbook with no recognizable roster/game structure.
- Invalid/ambiguous dates should be shown as TBC/null, not fabricated.
- If some rows are ambiguous, preview them as skipped conflicts; do not silently map them.
- Final commit failure must leave no partial historical import.
- Duplicate checksum should produce a clear `already imported` state rather than creating duplicates.

## Testing required
Add focused tests/checks appropriate to this static repo. Do not introduce a large test framework unnecessarily.

At minimum validate:
- parser recognizes a synthetic fixture representing the validated `Player details` + `Games` layout
- plus handicaps remain text values
- recorded totals map correctly
- Game 15-style historical payload produces Carol 71 / Slenda 72 / Duke 75 ordering when normalized/imported
- re-import of the same legacy game does not duplicate it
- app-created golf day cannot be overwritten by importer
- non-admin cannot commit import
- ambiguous member/game mapping is skipped/conflicted rather than guessed
- import commit is transactional
- no backend secret is shipped
- all existing JS syntax/build/smoke checks remain green

If the real latest workbook is not available in Claude’s local workspace, do not invent its newer game contents. Build against the documented validated workbook structure and leave the real-file acceptance test for the user after implementation.

## Documentation / PR discipline
- Add clean Supabase migration file(s) to the repo for any schema/RPC changes.
- Do not apply ad-hoc changes without recording them as migrations.
- Update `project-os/00-start-here/current-status.md`, `next-action.md`, `project-os/08-logs/change-log.md`, and PR #1 with what was implemented and what still needs human acceptance.
- Keep the existing PR open and unmerged.
- Run the full existing GitHub validation suite and keep it green.

## Stop conditions
Stop and report rather than guessing if:
- the workbook structure cannot be mapped conservatively from the documented sheets
- implementing the feature would require exposing a Supabase secret in the browser
- a safe atomic import cannot be achieved with the current architecture
- a schema change would change live scoring semantics or historical winners
- you discover a conflict that could overwrite app-created/live golf data

Do not stop for routine naming/layout decisions. Make the smallest safe choice consistent with the current UI.

## Definition of done for this task
This task is complete when the branch contains a working admin-only `.xlsx` import flow with preview, conservative matching, atomic commit, audit trace, duplicate protection, read-only imported history, green CI, and documented migration(s), ready for the user to upload the latest real club workbook for acceptance testing. Do not merge to `main`.