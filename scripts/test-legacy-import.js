// Focused, framework-free tests for the legacy Excel workbook import.
//
// Fixtures here mirror the REAL Monthly Medal APRIL@2026-3.xlsx layout
// confirmed by direct inspection (not the earlier simplified/invented
// layout that a previous pass tested against):
//   - "Player details" is horizontal: a "Member Name" row and an "HC" row,
//     with names/handicaps running across columns.
//   - "Games" has a header row (GAME #, VENUE, DATE, PLAYER, then one
//     column per player from E onward) and data rows whose game number is
//     a text label such as "Game 15", not a bare number.
//
// This only exercises js/legacy-import-utils.js — the pure row-parsing,
// normalization and matching logic that is safe to run without a browser,
// Supabase, or the XLSX library. It intentionally does NOT try to
// re-implement or call supabase/migrations/20260816120000_legacy_workbook_import.sql.
// That migration is the actual authority for:
//   - re-import of the same legacy game not duplicating it, including the
//     case where an existing null event_date is enriched by a later
//     workbook rather than creating a second row (private.match_historical_golf_day,
//     mirrored here by matchHistoricalGame/categorizeGame)
//   - an app-created golf day never being overwritten (source_type guard,
//     re-checked twice inside the function)
//   - only an approved admin being able to commit (DB-side role/approval
//     check, independent of anything the browser claims)
//   - the commit being transactional (a single PL/pgSQL function call is
//     one implicit transaction; any raised exception rolls back everything
//     the call did)
// Those are reviewable in the migration file and require a live Supabase
// project to execute-test, which is not available in this environment.
//
// Run with: node scripts/test-legacy-import.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BirdieLegacyImport = require(path.join(__dirname, '..', 'js', 'legacy-import-utils.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed += 1;
        console.log('  ok - ' + name);
    } catch (error) {
        failed += 1;
        console.error('  FAIL - ' + name);
        console.error('    ' + (error && error.message ? error.message : error));
    }
}

// --- Real-layout fixtures --------------------------------------------
//
// "Player details": row 2 has "Member Name" in column A with names running
// across columns C onward (column B intentionally blank, matching the real
// sheet); a separate "HC" row underneath carries handicaps in the same
// columns, followed by contact/ICE rows the import must ignore.
const playerDetailsRows = [
    ['Birdie Squad Club Roster'],
    ['Member Name', '', 'MISS CAROL SIBIYA', 'MR SLENDA SITHEBE', 'MR DUKE MAPHUNYE', 'MR VELI HLOPHE', 'MR TOM NTSHANGASE'],
    ['HC', '', '12', '+4', '4', '+2', '5'],
    ['Cell #', '', '082 000 0001', '082 000 0002', '082 000 0003', '082 000 0004', '082 000 0005'],
    ['ICE Name', '', 'Jane', 'John', 'Amy', 'Sam', 'Kim'],
    ['ICE Cell #', '', '082 111 1111', '082 111 1112', '082 111 1113', '082 111 1114', '082 111 1115'],
    ['SAGU#', '', 'S001', 'S002', 'S003', 'S004', 'S005'],
    ['Date Joined', '', '2020-01-01', '2020-01-02', '2020-01-03', '2020-01-04', '2020-01-05']
];

// "Games": header row with GAME #, VENUE, DATE, PLAYER, then one column per
// player from E onward — the header names are the authority for which
// column is whose score, independent of Player details order. Data rows
// use "Game N" text labels. Includes: a real Date cell, a strict ISO text
// date, and an ambiguous free-text date, plus a title row and a stray note
// row that must both be skipped.
const gamesRows = [
    ['Monthly Medal Results'],
    ['GAME #', 'VENUE', 'DATE', 'PLAYER', 'MISS CAROL SIBIYA', 'MR SLENDA SITHEBE', 'MR DUKE MAPHUNYE', 'MR VELI HLOPHE', 'MR TOM NTSHANGASE'],
    ['Game 14', 'NIGEL GC', new Date('2026-03-01T00:00:00Z'), '', 80, 82, 85, 90, 91],
    ['See handicap sheet for details'],
    ['Game 15', 'STATEMINES GC', new Date('2026-04-01T00:00:00Z'), '', 71, 72, 75, 76, 77],
    ['Game 16', 'NIGEL GC', '2026-05-01', '', 88, 90, 92, 95, 96],
    ['Game 17', 'NIGEL GC', 'sometime in June', '', 93, 94, 96, 99, 100]
];

test('parsePlayerDetailsRows reconstructs the roster from the horizontal Member Name/HC rows', function () {
    const members = BirdieLegacyImport.parsePlayerDetailsRows(playerDetailsRows);
    assert.equal(members.length, 5);
    assert.deepEqual(members.map(function (m) { return m.full_name; }), [
        'MISS CAROL SIBIYA', 'MR SLENDA SITHEBE', 'MR DUKE MAPHUNYE', 'MR VELI HLOPHE', 'MR TOM NTSHANGASE'
    ]);
});

test('plus-handicaps are preserved as text, not converted to numbers', function () {
    const members = BirdieLegacyImport.parsePlayerDetailsRows(playerDetailsRows);
    const slenda = members.find(function (m) { return m.full_name === 'MR SLENDA SITHEBE'; });
    const veli = members.find(function (m) { return m.full_name === 'MR VELI HLOPHE'; });
    assert.equal(slenda.current_handicap, '+4');
    assert.equal(veli.current_handicap, '+2');
});

test('parseGameNumberLabel extracts the integer from a "Game 15"-style text label', function () {
    assert.equal(BirdieLegacyImport.parseGameNumberLabel('Game 15'), 15);
    assert.equal(BirdieLegacyImport.parseGameNumberLabel('game   1'), 1);
    assert.equal(BirdieLegacyImport.parseGameNumberLabel('GAME 100'), 100);
});

test('parseGameNumberLabel never trusts Number("Game 15") (NaN) and rejects non-labels', function () {
    assert.equal(Number.isNaN(Number('Game 15')), true); // sanity check on the bug this guards against
    assert.equal(BirdieLegacyImport.parseGameNumberLabel('Notes'), null);
    assert.equal(BirdieLegacyImport.parseGameNumberLabel(''), null);
    assert.equal(BirdieLegacyImport.parseGameNumberLabel(null), null);
});

test('parseGameNumberLabel still accepts a genuinely numeric cell defensively', function () {
    assert.equal(BirdieLegacyImport.parseGameNumberLabel(15), 15);
    assert.equal(BirdieLegacyImport.parseGameNumberLabel('15'), 15);
});

test('parseEventDateCell accepts a real Date and strict ISO text, rejects ambiguous text', function () {
    assert.equal(BirdieLegacyImport.parseEventDateCell(new Date('2026-04-01T00:00:00Z')), '2026-04-01');
    assert.equal(BirdieLegacyImport.parseEventDateCell('2026-05-01'), '2026-05-01');
    assert.equal(BirdieLegacyImport.parseEventDateCell('sometime in June'), null);
    assert.equal(BirdieLegacyImport.parseEventDateCell('01/05/2026'), null);
    assert.equal(BirdieLegacyImport.parseEventDateCell(46844), null); // a raw Excel serial, never guessed
});

test('parseGamesRows skips title/note rows and maps score columns using the Games header names', function () {
    const games = BirdieLegacyImport.parseGamesRows(gamesRows);
    assert.equal(games.length, 4);

    const game15 = games.find(function (g) { return g.game_number === 15; });
    assert.equal(game15.venue, 'STATEMINES GC');
    assert.equal(game15.event_date, '2026-04-01');
    assert.deepEqual(game15.players, [
        { full_name: 'MISS CAROL SIBIYA', final_score: 71 },
        { full_name: 'MR SLENDA SITHEBE', final_score: 72 },
        { full_name: 'MR DUKE MAPHUNYE', final_score: 75 },
        { full_name: 'MR VELI HLOPHE', final_score: 76 },
        { full_name: 'MR TOM NTSHANGASE', final_score: 77 }
    ]);
});

test('parseGamesRows: a strict ISO text date parses; an ambiguous text date stays null (TBC)', function () {
    const games = BirdieLegacyImport.parseGamesRows(gamesRows);
    const game16 = games.find(function (g) { return g.game_number === 16; });
    const game17 = games.find(function (g) { return g.game_number === 17; });
    assert.equal(game16.event_date, '2026-05-01');
    assert.equal(game17.event_date, null);
});

test('Game 15-style payload reproduces Carol 71 / Slenda 72 / Duke 75 ordering from the real-layout fixture', function () {
    const games = BirdieLegacyImport.parseGamesRows(gamesRows);
    const game15 = games.find(function (g) { return g.game_number === 15; });
    const ranked = game15.players.slice().sort(function (a, b) { return a.final_score - b.final_score; });
    assert.deepEqual(ranked.slice(0, 3).map(function (p) { return p.full_name; }), [
        'MISS CAROL SIBIYA', 'MR SLENDA SITHEBE', 'MR DUKE MAPHUNYE'
    ]);
    assert.deepEqual(ranked.slice(0, 3).map(function (p) { return p.final_score; }), [71, 72, 75]);
});

test('categorizeMember: brand new name is "new"', function () {
    const result = BirdieLegacyImport.categorizeMember({ full_name: 'MR NEW PLAYER', current_handicap: '10' }, []);
    assert.equal(result.category, 'new');
});

test('categorizeMember: ambiguous name (multiple matches) is skipped as a conflict, never guessed', function () {
    const existing = [
        { id: 'm1', full_name: 'MR JOHN SMITH', current_handicap: '4' },
        { id: 'm2', full_name: 'MR  JOHN   SMITH', current_handicap: '9' }
    ];
    const result = BirdieLegacyImport.categorizeMember({ full_name: 'MR JOHN SMITH', current_handicap: '4' }, existing);
    assert.equal(result.category, 'conflict');
});

// --- Historical game matching: the seeded Game 15 null-date case --------
// This is the exact regression the independent review flagged: Game 15
// currently has event_date = null in Supabase. A later workbook that
// finally supplies its date must enrich that same row, not create Game 15
// a second time.

test('matchHistoricalGame: a null-date existing Game 15 is matched (enriched) by an incoming dated Game 15', function () {
    const existingExcelDays = [
        { id: 'day-15', game_number: 15, venue: 'STATEMINES GC', event_date: null, source_type: 'excel_import' }
    ];
    const result = BirdieLegacyImport.matchHistoricalGame(
        { game_number: 15, venue: 'STATEMINES GC', event_date: '2026-04-01' },
        existingExcelDays
    );
    assert.equal(result.status, 'matched');
    assert.equal(result.match.id, 'day-15');
});

test('matchHistoricalGame: an exact game/venue/date match is found directly', function () {
    const existingExcelDays = [
        { id: 'day-15', game_number: 15, venue: 'statemines gc', event_date: '2026-04-01', source_type: 'excel_import' }
    ];
    const result = BirdieLegacyImport.matchHistoricalGame(
        { game_number: 15, venue: 'STATEMINES GC', event_date: '2026-04-01' },
        existingExcelDays
    );
    assert.equal(result.status, 'matched');
    assert.equal(result.match.id, 'day-15');
});

test('matchHistoricalGame: no candidates at all is "new"', function () {
    const result = BirdieLegacyImport.matchHistoricalGame(
        { game_number: 20, venue: 'NIGEL GC', event_date: null },
        []
    );
    assert.equal(result.status, 'new');
    assert.equal(result.match, null);
});

test('matchHistoricalGame: incoming with no date matches a single existing candidate', function () {
    const existingExcelDays = [
        { id: 'day-16', game_number: 16, venue: 'NIGEL GC', event_date: '2026-05-01', source_type: 'excel_import' }
    ];
    const result = BirdieLegacyImport.matchHistoricalGame(
        { game_number: 16, venue: 'NIGEL GC', event_date: null },
        existingExcelDays
    );
    assert.equal(result.status, 'matched');
    assert.equal(result.match.id, 'day-16');
});

test('matchHistoricalGame: conflicting non-unique candidates are skipped and surfaced, never guessed', function () {
    const existingExcelDays = [
        { id: 'day-a', game_number: 15, venue: 'STATEMINES GC', event_date: null, source_type: 'excel_import' },
        { id: 'day-b', game_number: 15, venue: 'STATEMINES GC', event_date: '2026-05-01', source_type: 'excel_import' }
    ];
    const result = BirdieLegacyImport.matchHistoricalGame(
        { game_number: 15, venue: 'STATEMINES GC', event_date: '2026-04-01' },
        existingExcelDays
    );
    assert.equal(result.status, 'conflict');
    assert.equal(result.match, null);
});

test('matchHistoricalGame: two existing candidates and no incoming date is ambiguous, never guessed', function () {
    const existingExcelDays = [
        { id: 'day-a', game_number: 15, venue: 'STATEMINES GC', event_date: '2026-04-01', source_type: 'excel_import' },
        { id: 'day-b', game_number: 15, venue: 'STATEMINES GC', event_date: '2026-05-01', source_type: 'excel_import' }
    ];
    const result = BirdieLegacyImport.matchHistoricalGame(
        { game_number: 15, venue: 'STATEMINES GC', event_date: null },
        existingExcelDays
    );
    assert.equal(result.status, 'conflict');
});

test('matchHistoricalGame: missing game number is always a conflict, never a guess', function () {
    const result = BirdieLegacyImport.matchHistoricalGame({ game_number: null, venue: 'STATEMINES GC', event_date: null }, []);
    assert.equal(result.status, 'conflict');
});

test('categorizeGame surfaces a clear conflict reason and never sets an existingDay on conflict', function () {
    const existingExcelDays = [
        { id: 'day-a', game_number: 15, venue: 'STATEMINES GC', event_date: null, source_type: 'excel_import' },
        { id: 'day-b', game_number: 15, venue: 'STATEMINES GC', event_date: '2026-05-01', source_type: 'excel_import' }
    ];
    const result = BirdieLegacyImport.categorizeGame(
        { game_number: 15, venue: 'STATEMINES GC', event_date: '2026-04-01', players: [] },
        existingExcelDays
    );
    assert.equal(result.category, 'conflict');
    assert.equal(result.existingDay, null);
    assert.ok(result.reason);
});

test('categorizeGame: a game with no usable game number is a conflict, not a guess', function () {
    const result = BirdieLegacyImport.categorizeGame({ game_number: null, venue: 'STATEMINES GC', event_date: null, players: [] }, []);
    assert.equal(result.category, 'conflict');
});

test('categorizeGame only ever matches within candidates it is given (app-round protection is the caller\'s job)', function () {
    // Production code (js/birdie-mvp.js) always pre-filters existingExcelDays
    // to source_type === 'excel_import' before calling categorizeGame, so an
    // app-created round is structurally never a candidate here. The database
    // RPC re-enforces the same rule independently and is the final authority
    // — see supabase/migrations/20260816120000_legacy_workbook_import.sql.
    const excelOnlyCandidates = [{ id: 'excel-day', game_number: 15, venue: 'STATEMINES GC', event_date: null, source_type: 'excel_import' }];
    const result = BirdieLegacyImport.categorizeGame({ game_number: 15, venue: 'STATEMINES GC', event_date: null, players: [] }, excelOnlyCandidates);
    assert.equal(result.existingDay.source_type, 'excel_import');
});

test('buildImportPayload drops conflict-category members and games before they would ever be committed', function () {
    const parsed = { filename: 'Test.xlsx', checksum: 'abc123' };
    const preview = {
        members: [
            { full_name: 'MR CLEAN MEMBER', current_handicap: '5', category: 'new' },
            { full_name: 'MR AMBIGUOUS MEMBER', current_handicap: '5', category: 'conflict' }
        ],
        games: [
            { game_number: 16, venue: 'NIGEL GC', event_date: null, players: [], category: 'new' },
            { game_number: null, venue: 'UNKNOWN', event_date: null, players: [], category: 'conflict' }
        ]
    };
    const payload = BirdieLegacyImport.buildImportPayload(parsed, preview);
    assert.equal(payload.filename, 'Test.xlsx');
    assert.equal(payload.checksum, 'abc123');
    assert.equal(payload.members.length, 1);
    assert.equal(payload.members[0].full_name, 'MR CLEAN MEMBER');
    assert.equal(payload.games.length, 1);
    assert.equal(payload.games[0].game_number, 16);
});

// --- Regression: the ordinary hub must not depend on the Gate 2B migration ---
// There is no live Supabase project in this environment to execute-test a
// pre-migration PostgREST 400 against, so this is a static-source
// assertion: the ordinary Golf Hub loader's own SELECT must never mention
// legacy_import_key (the only Gate 2B column the base schema doesn't have),
// while the admin-only import feature must still probe for the Gate 2B
// objects before offering the import form.

test('loadGolfDays() (the ordinary hub loader) does not select legacy_import_key', function () {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'birdie-mvp.js'), 'utf8');
    const functionMatch = /async function loadGolfDays\s*\(\)\s*\{[\s\S]*?\n    \}/.exec(source);
    assert.ok(functionMatch, 'could not locate loadGolfDays() in js/birdie-mvp.js');
    // Narrowed to the actual .select(...) call, not the function's own
    // explanatory comment (which legitimately names the excluded column).
    const selectMatch = /\.select\(\s*'([^']*)'\s*\)/.exec(functionMatch[0]);
    assert.ok(selectMatch, 'could not locate the .select(...) call inside loadGolfDays()');
    assert.ok(!selectMatch[1].includes('legacy_import_key'), 'loadGolfDays() must not select legacy_import_key, or the ordinary hub breaks before the Gate 2B migration is applied');
});

test('the import feature probes for the Gate 2B backend before rendering an active form', function () {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'birdie-mvp.js'), 'utf8');
    assert.ok(source.includes('checkImportBackendAvailable'), 'expected an availability probe for the optional Gate 2B objects');
    assert.ok(source.includes('importBackendStatus'), 'expected the import panel to branch on a backend-availability state');
    assert.ok(source.includes('Import backend not installed yet'), 'expected a clear non-fatal message when the migration has not been applied');
});

console.log('\nLegacy workbook import: ' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) {
    process.exitCode = 1;
}
