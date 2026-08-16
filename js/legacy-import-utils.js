// Birdie Squad Golf Club - pure helpers for the admin Excel workbook import.
// No XLSX/Supabase dependency here on purpose: this file only turns
// already-extracted worksheet rows into normalized import candidates and
// categorizes them against already-loaded club data. That keeps it usable
// unmodified both in the browser (js/birdie-mvp.js) and under plain Node
// for local tests (scripts/test-legacy-import.js) with zero dependencies.
//
// normalizeName()/legacyGameKey() must stay in lockstep with
// private.normalize_text()/private.legacy_game_key() in
// supabase/migrations/20260816120000_legacy_workbook_import.sql — the
// database RPC re-derives both independently and is the final authority.
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.BirdieLegacyImport = factory();
    }
})(typeof window !== 'undefined' ? window : this, function () {
    'use strict';

    function normalizeName(value) {
        const normalized = String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toLowerCase();
        return normalized || null;
    }

    function legacyGameKey(gameNumber, venue, eventDate) {
        if (gameNumber == null || !Number.isFinite(gameNumber)) return null;
        const normVenue = normalizeName(venue) || '';
        return eventDate ? (gameNumber + '|' + normVenue + '|' + eventDate) : (gameNumber + '|' + normVenue);
    }

    // rows = array-of-arrays as produced by XLSX.utils.sheet_to_json(sheet,
    // { header: 1, raw: false, defval: '' }) — label-based, not a hard-coded
    // row/column number, per the validated "Player details" layout.
    function parsePlayerDetailsRows(rows) {
        let headerIndex = -1;
        let nameCol = -1;
        let hcCol = -1;
        for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i];
            const nameIdx = row.findIndex(function (cell) { return String(cell || '').trim().toLowerCase() === 'member name'; });
            if (nameIdx !== -1) {
                headerIndex = i;
                nameCol = nameIdx;
                hcCol = row.findIndex(function (cell) { return String(cell || '').trim().toLowerCase() === 'hc'; });
                break;
            }
        }
        if (headerIndex === -1) return [];

        const members = [];
        for (let i = headerIndex + 1; i < rows.length; i += 1) {
            const row = rows[i];
            const name = String(row[nameCol] || '').trim();
            if (!name) continue;
            const hc = hcCol !== -1 ? String(row[hcCol] || '').trim() : '';
            members.push({ full_name: name, current_handicap: hc || null });
        }
        return members;
    }

    // rows = array-of-arrays from XLSX.utils.sheet_to_json(sheet, { header:
    // 1, defval: null }). Column A game#, B venue, C date, D descriptor
    // (ignored), E: one roster member per column in rosterOrder. eventDate
    // must already be a real Date instance (or null) — never a raw string —
    // so an unparsed date becomes TBC rather than a guessed value.
    function parseGamesRows(rows, rosterOrder) {
        const games = [];
        rows.forEach(function (row) {
            const gameNumber = Number(row[0]);
            if (!Number.isFinite(gameNumber) || gameNumber <= 0) return;

            const venue = String(row[1] || '').trim();
            const dateCell = row[2];
            const eventDate = (dateCell instanceof Date && !Number.isNaN(dateCell.getTime()))
                ? dateCell.toISOString().slice(0, 10)
                : null;

            const players = [];
            for (let i = 0; i < rosterOrder.length; i += 1) {
                const cell = row[4 + i];
                const score = Number(cell);
                if (cell != null && cell !== '' && Number.isFinite(score) && score > 0) {
                    players.push({ full_name: rosterOrder[i], final_score: Math.round(score) });
                }
            }
            games.push({ game_number: Math.round(gameNumber), venue: venue, event_date: eventDate, players: players });
        });
        return games;
    }

    // existingMembers: [{ id, full_name, current_handicap }]
    function categorizeMember(parsedMember, existingMembers) {
        const norm = normalizeName(parsedMember.full_name);
        const matches = existingMembers.filter(function (m) { return normalizeName(m.full_name) === norm; });
        if (matches.length === 0) return Object.assign({}, parsedMember, { category: 'new' });
        if (matches.length === 1) {
            const changed = !!parsedMember.current_handicap && matches[0].current_handicap !== parsedMember.current_handicap;
            return Object.assign({}, parsedMember, { category: changed ? 'update' : 'unchanged' });
        }
        return Object.assign({}, parsedMember, { category: 'conflict', reason: 'Multiple existing members share this name.' });
    }

    // existingExcelDays: [{ id, legacy_import_key, source_type }] — already
    // filtered by the caller to source_type === 'excel_import'.
    function categorizeGame(parsedGame, existingExcelDays) {
        const key = legacyGameKey(parsedGame.game_number, parsedGame.venue, parsedGame.event_date);
        if (!key) return Object.assign({}, parsedGame, { legacy_key: null, existingDay: null, category: 'conflict', reason: 'Missing a usable game number.' });
        const existingDay = existingExcelDays.find(function (day) { return day.legacy_import_key === key; }) || null;
        return Object.assign({}, parsedGame, { legacy_key: key, existingDay: existingDay });
    }

    function buildImportPayload(parsed, preview) {
        return {
            filename: parsed.filename,
            checksum: parsed.checksum,
            members: preview.members
                .filter(function (member) { return member.category !== 'conflict'; })
                .map(function (member) { return { full_name: member.full_name, current_handicap: member.current_handicap }; }),
            games: preview.games
                .filter(function (game) { return game.category !== 'conflict'; })
                .map(function (game) { return { game_number: game.game_number, venue: game.venue, event_date: game.event_date, players: game.players }; })
        };
    }

    return {
        normalizeName: normalizeName,
        legacyGameKey: legacyGameKey,
        parsePlayerDetailsRows: parsePlayerDetailsRows,
        parseGamesRows: parseGamesRows,
        categorizeMember: categorizeMember,
        categorizeGame: categorizeGame,
        buildImportPayload: buildImportPayload
    };
});
