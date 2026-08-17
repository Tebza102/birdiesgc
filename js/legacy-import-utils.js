// Birdie Squad Golf Club - pure helpers for the admin Excel workbook import.
// No XLSX/Supabase dependency here on purpose: this file only turns
// already-extracted worksheet rows into normalized import candidates and
// categorizes them against already-loaded club data. That keeps it usable
// unmodified both in the browser (js/birdie-mvp.js) and under plain Node
// for local tests (scripts/test-legacy-import.js) with zero dependencies.
//
// The real Monthly Medal workbook layout (confirmed by direct inspection,
// not the earlier simplified guess):
//   "Player details" is HORIZONTAL — a "Member Name" row and an "HC" row,
//   with names/handicaps running across columns, not listed down rows.
//   "Games" has a header row (GAME #, VENUE, DATE, PLAYER, then one column
//   per player from column E onward) and data rows whose game number is a
//   text label such as "Game 15", not a bare number.
//
// normalizeName()/legacyGameKey() and the historical-game matching rules
// here must stay in lockstep with private.normalize_text()/
// private.legacy_game_key()/private.match_historical_golf_day() in
// supabase/migrations/20260816120000_legacy_workbook_import.sql — the
// database RPC re-derives all of this independently and is the final
// authority; the browser preview must never be trusted on its own.
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

    // Fingerprint kept as an audit/traceability aid only — it is NOT the
    // sole identity rule for matching (see matchHistoricalGame below),
    // because the same historical game can legitimately appear once with
    // no known date and later with a date once one becomes available.
    function legacyGameKey(gameNumber, venue, eventDate) {
        if (gameNumber == null || !Number.isFinite(gameNumber)) return null;
        const normVenue = normalizeName(venue) || '';
        return eventDate ? (gameNumber + '|' + normVenue + '|' + eventDate) : (gameNumber + '|' + normVenue);
    }

    function cellLabel(cell) {
        return String(cell == null ? '' : cell).trim().toLowerCase();
    }

    function findLabelColumn(row, label) {
        return row.findIndex(function (cell) { return cellLabel(cell) === label; });
    }

    // rows = array-of-arrays as produced by XLSX.utils.sheet_to_json(sheet,
    // { header: 1, raw: false, defval: '' }).
    //
    // The real sheet is horizontal: a row with "Member Name" in one column
    // (label) and player names running across the columns to its right, and
    // a separate "HC" row whose handicaps line up in the same columns.
    // Column-by-position, not a fixed row-per-player list.
    function parsePlayerDetailsRows(rows) {
        let nameRowIndex = -1;
        let nameLabelCol = -1;
        let hcRowIndex = -1;

        for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i];
            if (nameRowIndex === -1) {
                const idx = findLabelColumn(row, 'member name');
                if (idx !== -1) {
                    nameRowIndex = i;
                    nameLabelCol = idx;
                }
            }
            if (hcRowIndex === -1 && findLabelColumn(row, 'hc') !== -1) {
                hcRowIndex = i;
            }
            if (nameRowIndex !== -1 && hcRowIndex !== -1) break;
        }

        if (nameRowIndex === -1) return [];

        const nameRow = rows[nameRowIndex];
        const hcRow = hcRowIndex !== -1 ? rows[hcRowIndex] : null;

        const members = [];
        for (let col = nameLabelCol + 1; col < nameRow.length; col += 1) {
            const name = String(nameRow[col] || '').trim();
            if (!name) continue;
            const hc = hcRow ? String(hcRow[col] || '').trim() : '';
            members.push({ full_name: name, current_handicap: hc || null });
        }
        return members;
    }

    // Column A data cells are text labels such as "Game 15", not numbers.
    // A strict pattern is required; a genuinely numeric cell is still
    // accepted defensively, but Number('Game 15') (NaN) is never trusted.
    function parseGameNumberLabel(cell) {
        if (cell == null || cell === '') return null;
        if (typeof cell === 'number' && Number.isFinite(cell) && cell > 0) return Math.round(cell);
        const text = String(cell).trim();
        const labelled = /^game\s+(\d+)\s*$/i.exec(text);
        if (labelled) return Number(labelled[1]);
        if (/^\d+$/.test(text)) {
            const numeric = Number(text);
            if (Number.isFinite(numeric) && numeric > 0) return Math.round(numeric);
        }
        return null;
    }

    // Only a real Date (SheetJS cellDates:true) or a strict ISO YYYY-MM-DD
    // text value is trusted. Anything else — free text, a bare serial
    // number that didn't resolve to a Date, an obviously malformed string —
    // is left null (TBC) rather than guessed.
    function parseEventDateCell(cell) {
        if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
            return cell.toISOString().slice(0, 10);
        }
        if (typeof cell === 'string') {
            const text = cell.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                const parsed = new Date(text + 'T00:00:00Z');
                if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text) {
                    return text;
                }
            }
        }
        return null;
    }

    // rows = array-of-arrays from XLSX.utils.sheet_to_json(sheet, { header:
    // 1, defval: null }). The Games header row (GAME #, VENUE, DATE, PLAYER,
    // then one column per player from E onward) is the authority for which
    // column holds which player's score — this never depends on the order
    // members were returned from Player details.
    function parseGamesRows(rows) {
        let headerRowIndex = -1;
        let gameCol = -1;
        let venueCol = -1;
        let dateCol = -1;
        let playerLabelCol = -1;

        for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i];
            const idx = row.findIndex(function (cell) { return cellLabel(cell).replace(/\s+/g, '') === 'game#'; });
            if (idx !== -1) {
                headerRowIndex = i;
                gameCol = idx;
                venueCol = findLabelColumn(row, 'venue');
                dateCol = findLabelColumn(row, 'date');
                playerLabelCol = findLabelColumn(row, 'player');
                break;
            }
        }
        if (headerRowIndex === -1) return [];

        if (venueCol === -1) venueCol = gameCol + 1;
        if (dateCol === -1) dateCol = gameCol + 2;
        const firstPlayerCol = playerLabelCol !== -1 ? playerLabelCol + 1 : dateCol + 2;

        const headerRow = rows[headerRowIndex];
        const playerColumns = [];
        for (let col = firstPlayerCol; col < headerRow.length; col += 1) {
            const name = String(headerRow[col] || '').trim();
            if (name) playerColumns.push({ col: col, full_name: name });
        }

        const games = [];
        for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
            const row = rows[i];
            const gameNumber = parseGameNumberLabel(row[gameCol]);
            if (gameNumber == null) continue;

            const venue = venueCol !== -1 ? String(row[venueCol] || '').trim() : '';
            const eventDate = parseEventDateCell(dateCol !== -1 ? row[dateCol] : null);

            const players = [];
            playerColumns.forEach(function (pc) {
                const cell = row[pc.col];
                const score = Number(cell);
                if (cell != null && cell !== '' && Number.isFinite(score) && score > 0) {
                    players.push({ full_name: pc.full_name, final_score: Math.round(score) });
                }
            });

            games.push({ game_number: gameNumber, venue: venue, event_date: eventDate, players: players });
        }
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

    // Deterministic, conservative historical-game matching against
    // existingExcelDays: [{ id, game_number, venue, event_date,
    // source_type }], already filtered by the caller to
    // source_type === 'excel_import'.
    //
    // A missing date on either side must never split one real historical
    // game into two rows, but a genuine date conflict — or any remaining
    // ambiguity — must be surfaced rather than guessed:
    //   0 candidates (same game_number + normalized venue)         -> new
    //   incoming has a date:
    //     exactly one candidate with that exact date                -> matched
    //     >1 candidates with that exact date                        -> conflict
    //     no exact date match, exactly one null-date candidate and
    //       no other (differently) dated candidate                  -> matched (enrich)
    //     anything else                                              -> conflict
    //   incoming has no date:
    //     exactly one candidate total                                -> matched
    //     more than one candidate                                    -> conflict
    function matchHistoricalGame(parsedGame, existingExcelDays) {
        if (parsedGame.game_number == null) return { status: 'conflict', match: null };

        const normVenue = normalizeName(parsedGame.venue);
        const candidates = existingExcelDays.filter(function (day) {
            return day.game_number === parsedGame.game_number && normalizeName(day.venue) === normVenue;
        });

        if (candidates.length === 0) return { status: 'new', match: null };

        const incomingDate = parsedGame.event_date || null;

        if (incomingDate) {
            const exactMatches = candidates.filter(function (day) { return day.event_date === incomingDate; });
            if (exactMatches.length === 1) return { status: 'matched', match: exactMatches[0] };
            if (exactMatches.length > 1) return { status: 'conflict', match: null };

            const nullDateCandidates = candidates.filter(function (day) { return !day.event_date; });
            const conflictingDated = candidates.filter(function (day) { return day.event_date && day.event_date !== incomingDate; });

            if (nullDateCandidates.length === 1 && conflictingDated.length === 0) {
                return { status: 'matched', match: nullDateCandidates[0] };
            }
            return { status: 'conflict', match: null };
        }

        if (candidates.length === 1) return { status: 'matched', match: candidates[0] };
        return { status: 'conflict', match: null };
    }

    function categorizeGame(parsedGame, existingExcelDays) {
        const key = legacyGameKey(parsedGame.game_number, parsedGame.venue, parsedGame.event_date);
        const result = matchHistoricalGame(parsedGame, existingExcelDays);

        if (result.status === 'conflict') {
            const reason = parsedGame.game_number == null
                ? 'Missing a usable game number.'
                : 'Multiple possible historical matches for this game/venue; needs manual review.';
            return Object.assign({}, parsedGame, { legacy_key: key, existingDay: null, category: 'conflict', reason: reason });
        }
        if (result.status === 'new') {
            return Object.assign({}, parsedGame, { legacy_key: key, existingDay: null });
        }
        return Object.assign({}, parsedGame, { legacy_key: key, existingDay: result.match });
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
        parseGameNumberLabel: parseGameNumberLabel,
        parseEventDateCell: parseEventDateCell,
        parseGamesRows: parseGamesRows,
        categorizeMember: categorizeMember,
        matchHistoricalGame: matchHistoricalGame,
        categorizeGame: categorizeGame,
        buildImportPayload: buildImportPayload
    };
});
