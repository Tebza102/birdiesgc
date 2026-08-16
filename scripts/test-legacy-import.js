// Focused, framework-free tests for the legacy Excel workbook import.
//
// This only exercises js/legacy-import-utils.js — the pure row-parsing,
// normalization and categorization logic that is safe to run without a
// browser, Supabase, or the XLSX library. It intentionally does NOT try to
// re-implement or call supabase/migrations/20260816120000_legacy_workbook_import.sql.
// That migration is the actual authority for:
//   - re-import of the same legacy game not duplicating it (unique index on
//     golf_days.legacy_import_key, matched-by-key upsert)
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

// A synthetic fixture matching the validated "Player details" layout:
// columns in a different order than A/B (proving label-based lookup, not a
// hard-coded column index), including the contact/ICE columns the import
// must ignore, and both plain and plus-handicap values.
const playerDetailsRows = [
    ['Club Roster - do not edit'],
    [],
    ['SAGU#', 'Member Name', 'HC', 'Cell #', 'ICE Name', 'ICE Cell #', 'Date Joined'],
    ['S001', 'MISS CAROL SIBIYA', '12', '082 000 0001', 'Jane', '082 111 1111', '2020-01-01'],
    ['S002', 'MR SLENDA SITHEBE', '+4', '082 000 0002', 'John', '082 111 1112', '2020-01-02'],
    ['S003', 'MR DUKE MAPHUNYE', '4', '082 000 0003', 'Amy', '082 111 1113', '2020-01-03'],
    ['S004', 'MR VELI HLOPHE', '+2', '082 000 0004', 'Sam', '082 111 1114', '2020-01-04'],
    ['S005', 'MR TOM NTSHANGASE', '5', '082 000 0005', 'Kim', '082 111 1115', '2020-01-05'],
    ['', '', '', '', '', '', ''] // trailing blank row must stop parsing cleanly
];

// A synthetic "Games" fixture: a title row and a non-numeric header-ish row
// that must be skipped, then one real data row reproducing the actual
// Game 15 acceptance values (column A game#, B venue, C date, D descriptor
// ignored, E: onward one column per roster member in the order above).
const gamesRows = [
    ['Monthly Medal Results'],
    ['GAME #', 'VENUE', 'DATE', 'TYPE', 'C. SIBIYA', 'S. SITHEBE', 'D. MAPHUNYE', 'V. HLOPHE', 'T. NTSHANGASE'],
    [15, 'STATEMINES GC', new Date('2026-04-01T00:00:00Z'), 'Medal', 71, 72, 75, 76, 77]
];

test('parsePlayerDetailsRows finds the roster via labelled columns, not a fixed index', function () {
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

test('parseGamesRows skips non-numeric rows and maps score columns to roster order', function () {
    const roster = BirdieLegacyImport.parsePlayerDetailsRows(playerDetailsRows).map(function (m) { return m.full_name; });
    const games = BirdieLegacyImport.parseGamesRows(gamesRows, roster);
    assert.equal(games.length, 1);
    const game = games[0];
    assert.equal(game.game_number, 15);
    assert.equal(game.venue, 'STATEMINES GC');
    assert.equal(game.event_date, '2026-04-01');
    assert.deepEqual(game.players, [
        { full_name: 'MISS CAROL SIBIYA', final_score: 71 },
        { full_name: 'MR SLENDA SITHEBE', final_score: 72 },
        { full_name: 'MR DUKE MAPHUNYE', final_score: 75 },
        { full_name: 'MR VELI HLOPHE', final_score: 76 },
        { full_name: 'MR TOM NTSHANGASE', final_score: 77 }
    ]);
});

test('an unparsed/ambiguous date is left null (TBC), never guessed', function () {
    const roster = ['MISS CAROL SIBIYA'];
    const rowsWithTextDate = [[15, 'STATEMINES GC', 'sometime in April', 'Medal', 71]];
    const games = BirdieLegacyImport.parseGamesRows(rowsWithTextDate, roster);
    assert.equal(games[0].event_date, null);
});

test('Game 15-style payload reproduces Carol 71 / Slenda 72 / Duke 75 ordering', function () {
    const roster = BirdieLegacyImport.parsePlayerDetailsRows(playerDetailsRows).map(function (m) { return m.full_name; });
    const games = BirdieLegacyImport.parseGamesRows(gamesRows, roster);
    const ranked = games[0].players.slice().sort(function (a, b) { return a.final_score - b.final_score; });
    assert.deepEqual(ranked.slice(0, 3).map(function (p) { return p.full_name; }), [
        'MISS CAROL SIBIYA', 'MR SLENDA SITHEBE', 'MR DUKE MAPHUNYE'
    ]);
    assert.deepEqual(ranked.slice(0, 3).map(function (p) { return p.final_score; }), [71, 72, 75]);
});

test('legacyGameKey is deterministic for repeat imports of the same game', function () {
    const keyA = BirdieLegacyImport.legacyGameKey(15, 'STATEMINES GC', null);
    const keyB = BirdieLegacyImport.legacyGameKey(15, '  statemines gc  ', null);
    assert.equal(keyA, keyB);
    assert.equal(keyA, '15|statemines gc');
});

test('legacyGameKey returns null without a game number, forcing a skip rather than a guess', function () {
    assert.equal(BirdieLegacyImport.legacyGameKey(null, 'STATEMINES GC', null), null);
});

test('categorizeMember: brand new name is "new"', function () {
    const result = BirdieLegacyImport.categorizeMember({ full_name: 'MR NEW PLAYER', current_handicap: '10' }, []);
    assert.equal(result.category, 'new');
});

test('categorizeMember: exact single match with a changed handicap is "update"', function () {
    const existing = [{ id: 'm1', full_name: 'MR DUKE MAPHUNYE', current_handicap: '4' }];
    const result = BirdieLegacyImport.categorizeMember({ full_name: 'MR DUKE MAPHUNYE', current_handicap: '5' }, existing);
    assert.equal(result.category, 'update');
});

test('categorizeMember: exact single match with the same handicap is "unchanged"', function () {
    const existing = [{ id: 'm1', full_name: 'mr duke maphunye', current_handicap: '4' }];
    const result = BirdieLegacyImport.categorizeMember({ full_name: 'MR DUKE MAPHUNYE', current_handicap: '4' }, existing);
    assert.equal(result.category, 'unchanged');
});

test('categorizeMember: ambiguous name (multiple matches) is skipped as a conflict, never guessed', function () {
    const existing = [
        { id: 'm1', full_name: 'MR JOHN SMITH', current_handicap: '4' },
        { id: 'm2', full_name: 'MR  JOHN   SMITH', current_handicap: '9' }
    ];
    const result = BirdieLegacyImport.categorizeMember({ full_name: 'MR JOHN SMITH', current_handicap: '4' }, existing);
    assert.equal(result.category, 'conflict');
});

test('categorizeGame: matches an existing excel_import day by its legacy key (re-import dedup)', function () {
    const existingExcelDays = [{ id: 'day-1', legacy_import_key: '15|statemines gc', source_type: 'excel_import' }];
    const result = BirdieLegacyImport.categorizeGame({ game_number: 15, venue: 'STATEMINES GC', event_date: null, players: [] }, existingExcelDays);
    assert.equal(result.legacy_key, '15|statemines gc');
    assert.equal(result.existingDay.id, 'day-1');
});

test('categorizeGame: a game with no usable game number is a conflict, not a guess', function () {
    const result = BirdieLegacyImport.categorizeGame({ game_number: null, venue: 'STATEMINES GC', event_date: null, players: [] }, []);
    assert.equal(result.category, 'conflict');
    assert.equal(result.existingDay, null);
});

test('categorizeGame only ever matches within the candidate list it is given', function () {
    // Production code (js/birdie-mvp.js) always pre-filters this list to
    // source_type === 'excel_import' before calling categorizeGame, so an
    // app-created round is structurally never a candidate here. The
    // database RPC re-enforces the same rule independently and is the
    // final authority — see supabase/migrations/20260816120000_legacy_workbook_import.sql.
    const excelOnlyCandidates = [{ id: 'excel-day', legacy_import_key: '15|statemines gc', source_type: 'excel_import' }];
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

console.log('\nLegacy workbook import: ' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) {
    process.exitCode = 1;
}
