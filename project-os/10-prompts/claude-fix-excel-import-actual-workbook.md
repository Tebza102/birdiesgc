# DEV MODE — Claude Instruction: Fix Excel Import Against the Actual Birdie Workbook

## Objective
Correct Gate 2B so the Excel importer matches the real `Monthly Medal APRIL@2026-3.xlsx` structure already validated for Birdie Squad, then re-run tests and push to the same branch. Do not merge to `main`.

Work only on `agent/supabase-golf-day-mvp`. Read the latest independent review on PR #1 and the existing Gate 2B brief before editing. Keep the existing static HTML/CSS/Vanilla JS + Supabase architecture and all current security guarantees.

## Blocking findings from direct inspection of the real workbook

### 1. Player details orientation is currently parsed incorrectly
The actual `Player details` sheet is horizontal:
- Row 2: column A contains `Member Name`; member names run across columns C onward.
- Row 3: column A contains `HC`; handicaps run across the same member columns.
- Other labelled rows such as `Cell #`, `ICE Name`, `ICE Cell #`, `SAGU#`, `Date Joined` are below.

Do not parse members as rows below a `Member Name` header. Instead locate the labelled `Member Name` row and `HC` row, determine the member columns from the horizontal names, and produce `{ full_name, current_handicap }` from matching columns. Preserve plus-handicaps such as `+4` as text.

### 2. Games game-number cells are labels, not numbers
The actual `Games` sheet has a header row with:
- A: `GAME #`
- B: `VENUE`
- C: `DATE`
- D: `PLAYER`
- E onward: player names

Data rows use labels such as `Game 1`, `Game 2`, … `Game 15` in column A. Extract the integer with a strict parser such as `/^\s*Game\s+(\d+)\s*$/i`, while still allowing a genuinely numeric cell if encountered. Never use `Number('Game 15')` and assume it works.

Map score cells to the player names in the Games header cells from column E onward. Do not depend on the order returned from `Player details`; the Games header is the authority for its score columns.

### 3. Date handling
With SheetJS `cellDates: true`, accept real Date cells. Also accept only strict ISO text `YYYY-MM-DD` when present (the actual workbook contains at least one text-style date). Any other ambiguous/unparseable value must remain `null` / Date TBC. Do not guess.

### 4. Historical game dedup must tolerate a missing date becoming known later
The current seeded Game 15 in Supabase has:
- game_number = 15
- venue = `STATEMINES GC`
- event_date = null
- source_type = `excel_import`

An updated workbook may later supply Game 15's real date. Exact fingerprint matching (`15|statemines gc` vs `15|statemines gc|YYYY-MM-DD`) must not create a duplicate.

Implement safe historical matching server-side and in the preview:
- Candidate set: `source_type = 'excel_import'`, same `game_number`, same normalized venue.
- If both sides have dates, exact same date is a match; conflicting non-null dates are a conflict unless there is an unambiguous separate candidate.
- If exactly one candidate matches game number + venue and one side's date is null, treat it as the same historical game and allow enriching the null date.
- If multiple candidates remain possible, surface a conflict/skip. Never guess.
- Never overwrite or convert an app-created/live round.

You may keep a `legacy_import_key` as a fingerprint/audit aid, but do not rely on exact full-key equality as the sole identity rule when a date can be missing. Adjust the unique/index strategy if necessary so the fallback logic is safe and future dated records cannot collide incorrectly.

## Required test-fixture correction
Replace/add tests so they mirror the actual workbook layout, not a simplified invented layout. At minimum test:
1. Horizontal `Player details`: `Member Name` row + `HC` row across columns.
2. Plus-handicap remains text (`+4`).
3. `Games` header row with player names in E onward.
4. Data rows labelled `Game 15` parse to integer 15.
5. Score columns map to the Games header names.
6. Strict ISO text date parses; ambiguous text remains null.
7. Existing Game 15 with null date + incoming same game/venue with a date matches/enriches, not creates a second game.
8. Conflicting/non-unique fallback candidates are skipped and surfaced.
9. Game-15-style result still reproduces Carol 71, Slenda 72, Duke 75 from the fixture.
10. Existing app-created round protection, admin gate, exact-workbook checksum protection and atomic RPC behavior remain intact.

## Migration status
The Gate 2B migration has NOT been applied to the live Birdie Supabase project. Keep it unapplied until this correction is complete and reviewed. It is therefore safe to amend/replace the migration file rather than layering a live repair migration.

## Validation
Run:
- `node --check` for all shipped JS and scripts
- the legacy import unit tests
- existing secret scan
- `npm run build`
- local server smoke test
- GitHub Actions `Birdie MVP Check`

Update Project OS and PR #1 with the corrected behavior. Explicitly state that the tests now mirror the real workbook orientation/labels. Do not merge to `main`. Do not stop for routine questions.
