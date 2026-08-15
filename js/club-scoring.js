// Birdie Squad Golf Club - Club Scoring MVP
// Scope: real auth, familiar score table, digital hole capture, live refresh.
(function () {
    'use strict';

    const db = window.birdieSupabase;
    if (!db) {
        document.addEventListener('DOMContentLoaded', function () {
            const status = document.getElementById('scoring-status');
            if (status) status.textContent = 'Scoring service is unavailable. Please refresh.';
        });
        return;
    }

    const state = {
        user: null,
        profile: null,
        golfDays: [],
        selectedGolfDay: null,
        players: [],
        scores: [],
        channel: null
    };

    const STAFF_ROLES = ['admin', 'management', 'scorer'];

    function el(id) { return document.getElementById(id); }
    function isStaff() { return !!state.profile && state.profile.approved && STAFF_ROLES.includes(state.profile.role); }

    function setStatus(message, kind) {
        const node = el('scoring-status');
        if (!node) return;
        node.textContent = message || '';
        node.dataset.kind = kind || 'info';
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function cleanMemberName(name) {
        return String(name || '').replace(/^(MR|MISS|MRS|MS)\s+/i, '').trim();
    }

    async function loadProfile() {
        if (!state.user) {
            state.profile = null;
            return;
        }
        const { data, error } = await db
            .from('user_profiles')
            .select('id, member_id, role, approved')
            .eq('id', state.user.id)
            .maybeSingle();
        if (error) throw error;
        state.profile = data || null;
    }

    async function refreshSession() {
        const { data, error } = await db.auth.getSession();
        if (error) throw error;
        state.user = data.session ? data.session.user : null;
        await loadProfile();
        renderAccessState();
        if (state.user && state.profile && state.profile.approved) {
            await loadGolfDays();
        } else {
            clearMemberData();
        }
    }

    function renderAccessState() {
        const loginPanel = el('login-panel');
        const memberPanel = el('member-panel');
        const pendingPanel = el('pending-panel');
        const userLabel = el('current-user-label');
        const staffPanel = el('staff-panel');

        if (!state.user) {
            if (loginPanel) loginPanel.hidden = false;
            if (memberPanel) memberPanel.hidden = true;
            if (pendingPanel) pendingPanel.hidden = true;
            if (staffPanel) staffPanel.hidden = true;
            setStatus('Sign in to view club scorecards and live results.');
            return;
        }

        if (loginPanel) loginPanel.hidden = true;
        if (userLabel) userLabel.textContent = state.user.email || 'Signed-in member';

        if (!state.profile || !state.profile.approved) {
            if (pendingPanel) pendingPanel.hidden = false;
            if (memberPanel) memberPanel.hidden = true;
            if (staffPanel) staffPanel.hidden = true;
            setStatus('Your account is signed in and awaiting club approval.', 'warning');
            return;
        }

        if (pendingPanel) pendingPanel.hidden = true;
        if (memberPanel) memberPanel.hidden = false;
        if (staffPanel) staffPanel.hidden = !isStaff();
        setStatus('Club scoring is connected.', 'success');
    }

    function clearMemberData() {
        state.golfDays = [];
        state.selectedGolfDay = null;
        state.players = [];
        state.scores = [];
        if (state.channel) {
            db.removeChannel(state.channel);
            state.channel = null;
        }
        const table = el('leaderboard-body');
        if (table) table.innerHTML = '';
    }

    async function loadGolfDays() {
        const { data, error } = await db
            .from('golf_days')
            .select('id, game_number, title, venue, event_date, status, scoring_method, hole_count')
            .order('game_number', { ascending: false })
            .order('event_date', { ascending: false });
        if (error) throw error;
        state.golfDays = data || [];
        renderGolfDaySelect();

        const requestedId = new URLSearchParams(window.location.search).get('game');
        const initial = state.golfDays.find(function (day) { return day.id === requestedId; }) || state.golfDays[0];
        if (initial) await selectGolfDay(initial.id);
    }

    function renderGolfDaySelect() {
        const select = el('golf-day-select');
        if (!select) return;
        select.innerHTML = state.golfDays.map(function (day) {
            const game = day.game_number ? 'Game ' + day.game_number + ' — ' : '';
            return '<option value="' + escapeHtml(day.id) + '">' + escapeHtml(game + day.title + (day.venue ? ' · ' + day.venue : '')) + '</option>';
        }).join('');
    }

    async function selectGolfDay(id) {
        state.selectedGolfDay = state.golfDays.find(function (day) { return day.id === id; }) || null;
        if (!state.selectedGolfDay) return;

        const select = el('golf-day-select');
        if (select) select.value = id;
        renderGolfDayHeader();
        await Promise.all([loadPlayers(), loadScores()]);
        renderLeaderboard();
        renderScorerControls();
        subscribeToScores();
    }

    function renderGolfDayHeader() {
        const day = state.selectedGolfDay;
        if (!day) return;
        const title = el('golf-day-title');
        const meta = el('golf-day-meta');
        const badge = el('golf-day-status');
        if (title) title.textContent = day.title;
        if (meta) meta.textContent = [day.venue, day.event_date || '', day.game_number ? 'Game ' + day.game_number : ''].filter(Boolean).join(' · ');
        if (badge) {
            badge.textContent = String(day.status || '').toUpperCase();
            badge.dataset.status = day.status || '';
        }
    }

    async function loadPlayers() {
        const { data, error } = await db
            .from('golf_day_players')
            .select('id, member_id, handicap_at_start, final_score_override, score_source, sort_order, members(full_name)')
            .eq('golf_day_id', state.selectedGolfDay.id)
            .order('sort_order', { ascending: true, nullsFirst: false });
        if (error) throw error;
        state.players = data || [];
    }

    async function loadScores() {
        const playerIds = state.players.map(function (player) { return player.id; });
        if (!playerIds.length) {
            state.scores = [];
            return;
        }
        const { data, error } = await db
            .from('hole_scores')
            .select('id, golf_day_player_id, hole_number, strokes, updated_at')
            .in('golf_day_player_id', playerIds)
            .order('hole_number', { ascending: true });
        if (error) throw error;
        state.scores = data || [];
    }

    function scoreSummary(player) {
        const holeRows = state.scores.filter(function (score) { return score.golf_day_player_id === player.id; });
        const liveTotal = holeRows.reduce(function (sum, row) { return sum + Number(row.strokes || 0); }, 0);
        const thru = holeRows.length;
        const imported = player.score_source === 'imported_total' && player.final_score_override != null;
        return {
            total: imported ? Number(player.final_score_override) : (thru ? liveTotal : null),
            thru: imported ? (state.selectedGolfDay.hole_count || 18) : thru,
            imported: imported
        };
    }

    function leaderboardRows() {
        return state.players.map(function (player) {
            const summary = scoreSummary(player);
            return {
                player: player,
                name: cleanMemberName(player.members && player.members.full_name),
                handicap: player.handicap_at_start || '—',
                total: summary.total,
                thru: summary.thru,
                imported: summary.imported
            };
        }).sort(function (a, b) {
            if (a.total == null && b.total == null) return a.name.localeCompare(b.name);
            if (a.total == null) return 1;
            if (b.total == null) return -1;
            if (a.total !== b.total) return a.total - b.total;
            return a.name.localeCompare(b.name);
        });
    }

    function renderLeaderboard() {
        const body = el('leaderboard-body');
        if (!body) return;
        const rows = leaderboardRows();
        body.innerHTML = rows.map(function (row, index) {
            return '<tr data-player-id="' + escapeHtml(row.player.id) + '">' +
                '<td class="rank-cell">' + (row.total == null ? '—' : String(index + 1)) + '</td>' +
                '<td><button class="scorecard-link" type="button" data-scorecard-player="' + escapeHtml(row.player.id) + '">' + escapeHtml(row.name) + '</button></td>' +
                '<td>' + escapeHtml(row.handicap) + '</td>' +
                '<td>' + (row.thru ? escapeHtml(row.thru) : '—') + '</td>' +
                '<td class="score-cell">' + (row.total == null ? '—' : escapeHtml(row.total)) + '</td>' +
                '</tr>';
        }).join('');

        body.querySelectorAll('[data-scorecard-player]').forEach(function (button) {
            button.addEventListener('click', function () { openScorecard(button.dataset.scorecardPlayer); });
        });
    }

    function openScorecard(playerId) {
        const player = state.players.find(function (item) { return item.id === playerId; });
        if (!player) return;
        const name = cleanMemberName(player.members && player.members.full_name);
        const rows = state.scores.filter(function (score) { return score.golf_day_player_id === playerId; });
        const byHole = {};
        rows.forEach(function (score) { byHole[score.hole_number] = score.strokes; });
        const summary = scoreSummary(player);
        const grid = Array.from({ length: state.selectedGolfDay.hole_count || 18 }, function (_, index) {
            const hole = index + 1;
            return '<div class="hole-box"><span>Hole ' + hole + '</span><strong>' + (byHole[hole] || '—') + '</strong></div>';
        }).join('');

        const dialog = el('scorecard-dialog');
        if (!dialog) return;
        el('scorecard-name').textContent = name;
        el('scorecard-total').textContent = summary.total == null ? 'No score yet' : 'Total: ' + summary.total + ' · Thru ' + summary.thru;
        el('scorecard-grid').innerHTML = grid;
        if (typeof dialog.showModal === 'function') dialog.showModal();
    }

    function renderScorerControls() {
        if (!isStaff()) return;
        const playerSelect = el('score-player-select');
        if (!playerSelect) return;
        playerSelect.innerHTML = state.players.map(function (player) {
            return '<option value="' + escapeHtml(player.id) + '">' + escapeHtml(cleanMemberName(player.members && player.members.full_name)) + '</option>';
        }).join('');
    }

    async function saveHoleScore(event) {
        event.preventDefault();
        if (!isStaff() || !state.selectedGolfDay) return;

        const playerId = el('score-player-select').value;
        const hole = Number(el('score-hole').value);
        const strokes = Number(el('score-strokes').value);
        const holeCount = state.selectedGolfDay.hole_count || 18;

        if (!playerId || !Number.isInteger(hole) || hole < 1 || hole > holeCount || !Number.isInteger(strokes) || strokes < 1 || strokes > 30) {
            setStatus('Enter a valid player, hole and strokes.', 'warning');
            return;
        }

        setStatus('Saving score…');
        const { error } = await db.from('hole_scores').upsert({
            golf_day_player_id: playerId,
            hole_number: hole,
            strokes: strokes,
            updated_by: state.user.id
        }, { onConflict: 'golf_day_player_id,hole_number' });

        if (error) {
            setStatus(error.message || 'Score could not be saved.', 'error');
            return;
        }

        await loadScores();
        renderLeaderboard();
        const nextHole = Math.min(hole + 1, holeCount);
        el('score-hole').value = String(nextHole);
        el('score-strokes').value = '';
        setStatus('Score saved. Leaderboard updated.', 'success');
    }

    function subscribeToScores() {
        if (state.channel) db.removeChannel(state.channel);
        if (!state.selectedGolfDay || !state.user) return;

        state.channel = db
            .channel('birdie-scores-' + state.selectedGolfDay.id)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores' }, async function () {
                await loadScores();
                renderLeaderboard();
            })
            .subscribe();
    }

    async function signIn(event) {
        event.preventDefault();
        const email = el('login-email').value.trim();
        const password = el('login-password').value;
        setStatus('Signing in…');
        const { error } = await db.auth.signInWithPassword({ email: email, password: password });
        if (error) {
            setStatus('Login failed. Check your email and password.', 'error');
            return;
        }
        await refreshSession();
    }

    async function signOut() {
        await db.auth.signOut();
        state.user = null;
        state.profile = null;
        clearMemberData();
        renderAccessState();
    }

    async function init() {
        const loginForm = el('login-form');
        const scoreForm = el('score-entry-form');
        const daySelect = el('golf-day-select');
        const logout = el('logout-button');
        const closeScorecard = el('scorecard-close');

        if (loginForm) loginForm.addEventListener('submit', signIn);
        if (scoreForm) scoreForm.addEventListener('submit', saveHoleScore);
        if (daySelect) daySelect.addEventListener('change', function () { selectGolfDay(daySelect.value).catch(handleError); });
        if (logout) logout.addEventListener('click', signOut);
        if (closeScorecard) closeScorecard.addEventListener('click', function () { el('scorecard-dialog').close(); });

        db.auth.onAuthStateChange(function () {
            window.setTimeout(function () { refreshSession().catch(handleError); }, 0);
        });

        await refreshSession();
    }

    function handleError(error) {
        console.error(error);
        setStatus((error && error.message) || 'Something went wrong. Please refresh and try again.', 'error');
    }

    document.addEventListener('DOMContentLoaded', function () {
        init().catch(handleError);
    });
})();
