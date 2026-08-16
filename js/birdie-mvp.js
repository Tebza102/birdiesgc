// Birdie Squad Golf Club - Supabase MVP bridge for the Events page.
// Keeps the existing static site intact while adding the member golf-day
// workflow. Real authentication is owned by the shared `window.BirdieAuth`
// bridge in js/main.js; this file only renders golf-day data.
(function () {
    'use strict';

    const state = {
        golfDays: [],
        members: [],
        currentDayId: null,
        currentPlayers: [],
        currentScores: [],
        currentLeaderboard: [],
        realtimeChannel: null,
        calendarCursor: null,
        refreshTimer: null
    };

    function isElement(target) {
        return target && target.nodeType === 1;
    }

    function isStaffRole(role) {
        return role === 'admin' || role === 'management' || role === 'scorer';
    }

    function canManageGolfDays(role) {
        return role === 'admin' || role === 'management';
    }

    function roleLabel(role) {
        const labels = { admin: 'Admin', management: 'Management', scorer: 'Scorer', member: 'Member' };
        return labels[role] || 'Member';
    }

    function getMount() {
        return document.getElementById('member-golf-mount');
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function setMountMessage(title, message, tone) {
        const mount = getMount();
        if (!mount) return;
        mount.innerHTML = `
            <div class="mvp-state-card ${tone ? 'mvp-state-' + tone : ''}">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    }

    function formatDate(dateString) {
        if (!dateString) return 'Date to be confirmed';
        const date = new Date(dateString + 'T00:00:00+02:00');
        if (Number.isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatMonth(date) {
        return date.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
    }

    async function loadGolfDays() {
        const client = await BirdieAuth.ensureClient();
        const result = await client
            .from('golf_days')
            .select('id, game_number, title, venue, event_date, status, hole_count, is_public, source_type, source_reference, created_at')
            .order('event_date', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });
        if (result.error) throw result.error;
        state.golfDays = result.data || [];
        return state.golfDays;
    }

    async function loadMembers() {
        if (!BirdieAuth.getProfile() || !isStaffRole(BirdieAuth.getProfile().role)) {
            state.members = [];
            return [];
        }
        const client = await BirdieAuth.ensureClient();
        const result = await client.from('members').select('id, full_name, current_handicap, active').eq('active', true).order('full_name');
        if (result.error) throw result.error;
        state.members = result.data || [];
        return state.members;
    }

    function renderLoggedOutHub() {
        const mount = getMount();
        if (!mount) return;
        mount.innerHTML = `
            <div class="mvp-login-card">
                <div>
                    <p class="mvp-eyebrow">Member access</p>
                    <h3>Live golf days start here</h3>
                    <p>Log in to view the club calendar, live leaderboard and digital scorecards.</p>
                </div>
                <button type="button" class="btn btn-primary" data-mvp-login>Member Login</button>
            </div>
        `;
    }

    function chooseCalendarCursor(days) {
        if (state.calendarCursor) return;
        const upcoming = days.filter(function (day) {
            return day.event_date && day.status !== 'closed' && day.status !== 'cancelled';
        }).sort(function (a, b) { return a.event_date.localeCompare(b.event_date); });
        const base = upcoming.length ? new Date(upcoming[0].event_date + 'T00:00:00') : new Date();
        state.calendarCursor = new Date(base.getFullYear(), base.getMonth(), 1);
    }

    function renderCalendar(days) {
        chooseCalendarCursor(days);
        const cursor = state.calendarCursor || new Date();
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        const first = new Date(year, month, 1);
        const last = new Date(year, month + 1, 0);
        const mondayOffset = (first.getDay() + 6) % 7;
        const cells = [];
        const dayMap = {};

        days.forEach(function (day) {
            if (!day.event_date) return;
            if (!dayMap[day.event_date]) dayMap[day.event_date] = [];
            dayMap[day.event_date].push(day);
        });

        for (let i = 0; i < mondayOffset; i += 1) cells.push('<div class="mvp-calendar-cell is-empty"></div>');

        for (let dayNumber = 1; dayNumber <= last.getDate(); dayNumber += 1) {
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
            const events = dayMap[key] || [];
            cells.push(`
                <div class="mvp-calendar-cell ${events.length ? 'has-event' : ''}">
                    <span class="mvp-calendar-number">${dayNumber}</span>
                    ${events.map(function (day) {
                        return `<button type="button" class="mvp-calendar-event" data-open-day="${day.id}" title="${escapeHtml(day.title)}">${escapeHtml(day.title)}</button>`;
                    }).join('')}
                </div>
            `);
        }

        return `
            <div class="mvp-calendar">
                <div class="mvp-calendar-toolbar">
                    <button type="button" class="mvp-icon-button" data-calendar-shift="-1" aria-label="Previous month">&larr;</button>
                    <h4>${escapeHtml(formatMonth(cursor))}</h4>
                    <button type="button" class="mvp-icon-button" data-calendar-shift="1" aria-label="Next month">&rarr;</button>
                </div>
                <div class="mvp-calendar-weekdays"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
                <div class="mvp-calendar-grid">${cells.join('')}</div>
            </div>
        `;
    }

    function renderGolfDayList(days) {
        if (!days.length) return '<div class="mvp-empty"><p>No golf days have been created yet.</p></div>';
        return `<div class="mvp-day-list">${days.map(function (day) {
            return `
                <button type="button" class="mvp-day-row ${state.currentDayId === day.id ? 'is-active' : ''}" data-open-day="${day.id}">
                    <span><strong>${escapeHtml(day.title)}</strong><small>${escapeHtml(day.venue || 'Venue TBC')} · ${escapeHtml(formatDate(day.event_date))}</small></span>
                    <span class="mvp-status mvp-status-${escapeHtml(day.status)}">${escapeHtml(day.status)}</span>
                </button>
            `;
        }).join('')}</div>`;
    }

    function renderCreateDayForm() {
        if (!BirdieAuth.getProfile() || !canManageGolfDays(BirdieAuth.getProfile().role)) return '';
        return `
            <details class="mvp-admin-details">
                <summary>Create a new golf day</summary>
                <form id="mvp-create-day-form" class="mvp-form-grid">
                    <label>Game #<input name="game_number" type="number" min="1" inputmode="numeric" placeholder="16"></label>
                    <label>Date<input name="event_date" type="date" required></label>
                    <label class="mvp-span-2">Golf day name<input name="title" type="text" required placeholder="Monthly Medal"></label>
                    <label class="mvp-span-2">Venue<input name="venue" type="text" required placeholder="Nigel GC"></label>
                    <label class="mvp-check"><input name="is_public" type="checkbox" checked> Show on club calendar</label>
                    <button type="submit" class="btn btn-primary">Create Golf Day</button>
                </form>
            </details>
        `;
    }

    async function renderMemberHub() {
        const mount = getMount();
        if (!mount) return;
        if (!BirdieAuth.getSession()) {
            renderLoggedOutHub();
            return;
        }

        mount.innerHTML = '<div class="mvp-loading">Loading member golf hub...</div>';
        try {
            await Promise.all([loadGolfDays(), loadMembers()]);
            const userEmail = BirdieAuth.getSession().user && BirdieAuth.getSession().user.email ? BirdieAuth.getSession().user.email : '';
            const role = BirdieAuth.getProfile() && BirdieAuth.getProfile().role ? BirdieAuth.getProfile().role : 'member';

            mount.innerHTML = `
                <div class="mvp-member-bar">
                    <div><p class="mvp-eyebrow">Signed in</p><strong>${escapeHtml(userEmail)}</strong></div>
                    <span class="mvp-role-pill">${escapeHtml(roleLabel(role))}</span>
                </div>
                <div class="mvp-hub-grid">
                    <section class="mvp-panel">
                        <div class="mvp-panel-heading"><div><p class="mvp-eyebrow">Club calendar</p><h3>Golf Days</h3></div></div>
                        ${renderCalendar(state.golfDays)}
                        ${renderCreateDayForm()}
                    </section>
                    <section class="mvp-panel">
                        <div class="mvp-panel-heading"><div><p class="mvp-eyebrow">Results & live play</p><h3>Golf Day List</h3></div></div>
                        ${renderGolfDayList(state.golfDays)}
                    </section>
                </div>
                <section id="mvp-day-detail" class="mvp-day-detail"><div class="mvp-empty"><p>Select a golf day to view its leaderboard and scorecard.</p></div></section>
            `;

            if (state.currentDayId && state.golfDays.some(function (day) { return day.id === state.currentDayId; })) {
                await openGolfDay(state.currentDayId);
            } else if (state.golfDays.length) {
                await openGolfDay(state.golfDays[0].id);
            }
        } catch (error) {
            console.error('Birdie MVP hub load failed:', error);
            setMountMessage('Could not load member golf data', 'Please try again. If the issue continues, contact the club administrator.', 'error');
        }
    }

    async function loadCurrentDayData(dayId) {
        const client = await BirdieAuth.ensureClient();
        const results = await Promise.all([
            client.from('live_leaderboard').select('*').eq('golf_day_id', dayId).order('position', { ascending: true, nullsFirst: false }).order('player_name'),
            client.from('golf_day_players').select('id, golf_day_id, member_id, handicap_at_start, final_score_override, score_source, sort_order, members(full_name, current_handicap)').eq('golf_day_id', dayId).order('sort_order', { ascending: true, nullsFirst: false })
        ]);
        if (results[0].error) throw results[0].error;
        if (results[1].error) throw results[1].error;
        state.currentLeaderboard = results[0].data || [];
        state.currentPlayers = results[1].data || [];

        const playerIds = state.currentPlayers.map(function (player) { return player.id; });
        if (!playerIds.length) {
            state.currentScores = [];
            return;
        }
        const scoresResult = await client.from('hole_scores').select('id, golf_day_player_id, hole_number, strokes, updated_at').in('golf_day_player_id', playerIds).order('hole_number');
        if (scoresResult.error) throw scoresResult.error;
        state.currentScores = scoresResult.data || [];
    }

    function getCurrentDay() {
        return state.golfDays.find(function (day) { return day.id === state.currentDayId; }) || null;
    }

    function getLeaderboardRow(playerId) {
        return state.currentLeaderboard.find(function (row) { return row.golf_day_player_id === playerId; }) || null;
    }

    function scoreFor(playerId, holeNumber) {
        const row = state.currentScores.find(function (score) { return score.golf_day_player_id === playerId && score.hole_number === holeNumber; });
        return row ? row.strokes : '';
    }

    function playerName(player) {
        if (player.members && player.members.full_name) return player.members.full_name;
        const leaderboard = getLeaderboardRow(player.id);
        return leaderboard ? leaderboard.player_name : 'Player';
    }

    function renderLeaderboard() {
        if (!state.currentLeaderboard.length) return '<div class="mvp-empty"><p>No players have been added to this golf day yet.</p></div>';
        return `
            <div class="mvp-table-wrap">
                <table class="mvp-leaderboard-table">
                    <thead><tr><th>Pos</th><th>Player</th><th>Thru</th><th>Score</th><th></th></tr></thead>
                    <tbody>${state.currentLeaderboard.map(function (row) {
                        const thru = row.score_source === 'imported_total' ? 'Final' : `${row.holes_completed}/${row.hole_count}`;
                        return `<tr><td class="mvp-position">${row.position == null ? '-' : row.position}</td><td><strong>${escapeHtml(row.player_name)}</strong></td><td>${escapeHtml(thru)}</td><td class="mvp-score-total">${row.total_score == null ? '-' : row.total_score}</td><td><button type="button" class="mvp-link-button" data-view-card="${row.golf_day_player_id}">View card</button></td></tr>`;
                    }).join('')}</tbody>
                </table>
            </div>
            <div id="mvp-scorecard-panel"></div>
        `;
    }

    function renderAddPlayer(day) {
        if (!BirdieAuth.getProfile() || !isStaffRole(BirdieAuth.getProfile().role)) return '';
        const existing = new Set(state.currentPlayers.map(function (player) { return player.member_id; }));
        const available = state.members.filter(function (member) { return !existing.has(member.id); });
        if (!available.length) return '<p class="mvp-small-note">All active roster members are already on this golf day.</p>';
        return `
            <form id="mvp-add-player-form" class="mvp-inline-form" data-day-id="${day.id}">
                <label>Add player<select name="member_id" required><option value="">Select member</option>${available.map(function (member) {
                    return `<option value="${member.id}">${escapeHtml(member.full_name)}${member.current_handicap ? ' · HC ' + escapeHtml(member.current_handicap) : ''}</option>`;
                }).join('')}</select></label>
                <button type="submit" class="btn btn-secondary">Add</button>
            </form>
        `;
    }

    function renderDayStatusControls(day) {
        if (!BirdieAuth.getProfile() || !canManageGolfDays(BirdieAuth.getProfile().role)) return '';
        return `<div class="mvp-status-actions">${day.status !== 'live' ? '<button type="button" class="btn btn-secondary" data-day-status="live">Start Live Round</button>' : ''}${day.status !== 'closed' ? '<button type="button" class="btn btn-outline" data-day-status="closed">Close Round</button>' : ''}</div>`;
    }

    function renderScoreGrid(day) {
        if (!BirdieAuth.getProfile() || !isStaffRole(BirdieAuth.getProfile().role) || !state.currentPlayers.length) return '';
        const holeHeaders = Array.from({ length: day.hole_count }, function (_, index) { return `<th>H${index + 1}</th>`; }).join('');
        const rows = state.currentPlayers.map(function (player) {
            const imported = player.score_source === 'imported_total';
            const leaderboard = getLeaderboardRow(player.id);
            const total = leaderboard && leaderboard.total_score != null ? leaderboard.total_score : '-';
            const name = playerName(player);
            const cells = Array.from({ length: day.hole_count }, function (_, index) {
                const hole = index + 1;
                if (imported) return '<td class="mvp-imported-cell">—</td>';
                const value = scoreFor(player.id, hole);
                return `<td><input class="mvp-score-input" type="number" inputmode="numeric" min="1" max="30" value="${value}" data-player-id="${player.id}" data-hole="${hole}" aria-label="${escapeHtml(name)} hole ${hole}"></td>`;
            }).join('');
            return `<tr><th class="mvp-player-sticky"><strong>${escapeHtml(name)}</strong><small>HC ${escapeHtml(player.handicap_at_start || '-')}</small></th>${cells}<td class="mvp-total-sticky"><strong>${total}</strong>${imported ? '<small>Excel</small>' : ''}</td></tr>`;
        }).join('');

        return `
            <section class="mvp-score-entry">
                <div class="mvp-panel-heading"><div><p class="mvp-eyebrow">Scorer view</p><h3>Live Score Sheet</h3><p>Players run down the left, holes run across the top — familiar like the club spreadsheet.</p></div></div>
                <div class="mvp-score-grid-wrap"><table class="mvp-score-grid"><thead><tr><th class="mvp-player-sticky">Player</th>${holeHeaders}<th class="mvp-total-sticky">Total</th></tr></thead><tbody>${rows}</tbody></table></div>
                <p class="mvp-small-note">Scores save when you leave a cell. Members watching the leaderboard receive the update automatically.</p>
            </section>
        `;
    }

    function renderDayDetail(day) {
        const detail = document.getElementById('mvp-day-detail');
        if (!detail) return;
        detail.innerHTML = `
            <div class="mvp-day-hero"><div><p class="mvp-eyebrow">${day.game_number ? 'Game ' + day.game_number : 'Club golf day'}</p><h2>${escapeHtml(day.title)}</h2><p>${escapeHtml(day.venue || 'Venue TBC')} · ${escapeHtml(formatDate(day.event_date))}</p></div><span class="mvp-status mvp-status-${escapeHtml(day.status)}">${escapeHtml(day.status)}</span></div>
            ${renderDayStatusControls(day)}
            ${renderAddPlayer(day)}
            <section class="mvp-leaderboard"><div class="mvp-panel-heading"><div><p class="mvp-eyebrow">Member view</p><h3>${day.status === 'live' ? 'Live Leaderboard' : 'Leaderboard'}</h3></div></div>${renderLeaderboard()}</section>
            ${renderScoreGrid(day)}
        `;
    }

    async function openGolfDay(dayId) {
        state.currentDayId = dayId;
        const day = getCurrentDay();
        if (!day) return;
        const detail = document.getElementById('mvp-day-detail');
        if (detail) detail.innerHTML = '<div class="mvp-loading">Loading golf day...</div>';
        try {
            await loadCurrentDayData(dayId);
            renderDayDetail(day);
            document.querySelectorAll('.mvp-day-row').forEach(function (row) { row.classList.toggle('is-active', row.getAttribute('data-open-day') === dayId); });
        } catch (error) {
            console.error('Birdie MVP day load failed:', error);
            if (detail) detail.innerHTML = '<div class="mvp-state-card mvp-state-error"><h3>Could not load this golf day</h3><p>Please try again.</p></div>';
        }
    }

    function renderIndividualScorecard(playerId) {
        const panel = document.getElementById('mvp-scorecard-panel');
        if (!panel) return;
        const player = state.currentPlayers.find(function (row) { return row.id === playerId; });
        const leaderboard = getLeaderboardRow(playerId);
        if (!player || !leaderboard) return;
        const scores = state.currentScores.filter(function (row) { return row.golf_day_player_id === playerId; }).sort(function (a, b) { return a.hole_number - b.hole_number; });

        if (player.score_source === 'imported_total' && !scores.length) {
            panel.innerHTML = `<div class="mvp-scorecard-card"><button type="button" class="mvp-scorecard-close" data-close-card>&times;</button><p class="mvp-eyebrow">Imported Excel result</p><h4>${escapeHtml(playerName(player))}</h4><div class="mvp-scorecard-total">Final score <strong>${leaderboard.total_score}</strong></div><p>The historical spreadsheet stores the final total only. Hole-by-hole scoring starts with new digital golf days.</p></div>`;
            return;
        }

        const scoreMap = {};
        scores.forEach(function (row) { scoreMap[row.hole_number] = row.strokes; });
        const day = getCurrentDay();
        const holes = Array.from({ length: day ? day.hole_count : 18 }, function (_, index) {
            const hole = index + 1;
            return `<div><span>H${hole}</span><strong>${scoreMap[hole] == null ? '-' : scoreMap[hole]}</strong></div>`;
        }).join('');
        panel.innerHTML = `<div class="mvp-scorecard-card"><button type="button" class="mvp-scorecard-close" data-close-card>&times;</button><p class="mvp-eyebrow">Digital scorecard</p><h4>${escapeHtml(playerName(player))}</h4><div class="mvp-mini-scorecard">${holes}</div><div class="mvp-scorecard-total">Total <strong>${leaderboard.total_score == null ? '-' : leaderboard.total_score}</strong></div></div>`;
    }

    async function createGolfDay(form) {
        const client = await BirdieAuth.ensureClient();
        const data = new FormData(form);
        const payload = {
            game_number: data.get('game_number') ? Number(data.get('game_number')) : null,
            title: String(data.get('title') || '').trim(),
            venue: String(data.get('venue') || '').trim(),
            event_date: String(data.get('event_date') || ''),
            status: 'scheduled', scoring_method: 'gross_stroke_v1', hole_count: 18,
            is_public: data.get('is_public') === 'on', source_type: 'app'
        };
        const result = await client.from('golf_days').insert(payload).select('id').single();
        if (result.error) throw result.error;
        state.currentDayId = result.data.id;
        await renderMemberHub();
    }

    async function addPlayer(form) {
        const memberId = form.member_id.value;
        if (!memberId || !state.currentDayId) return;
        const member = state.members.find(function (row) { return row.id === memberId; });
        if (!member) return;
        const client = await BirdieAuth.ensureClient();
        const result = await client.from('golf_day_players').insert({ golf_day_id: state.currentDayId, member_id: memberId, handicap_at_start: member.current_handicap, score_source: 'live' });
        if (result.error) throw result.error;
        await openGolfDay(state.currentDayId);
    }

    async function saveScore(input) {
        const playerId = input.getAttribute('data-player-id');
        const holeNumber = Number(input.getAttribute('data-hole'));
        const raw = input.value.trim();
        const client = await BirdieAuth.ensureClient();
        input.classList.add('is-saving');
        try {
            if (!raw) {
                const result = await client.from('hole_scores').delete().eq('golf_day_player_id', playerId).eq('hole_number', holeNumber);
                if (result.error) throw result.error;
            } else {
                const strokes = Number(raw);
                if (!Number.isInteger(strokes) || strokes < 1 || strokes > 30) throw new Error('Score must be between 1 and 30.');
                const result = await client.from('hole_scores').upsert({ golf_day_player_id: playerId, hole_number: holeNumber, strokes: strokes }, { onConflict: 'golf_day_player_id,hole_number' });
                if (result.error) throw result.error;
            }
            input.classList.remove('is-error');
            input.classList.add('is-saved');
            window.setTimeout(function () { input.classList.remove('is-saved'); }, 700);
            await openGolfDay(state.currentDayId);
        } catch (error) {
            console.error('Birdie MVP score save failed:', error);
            input.classList.add('is-error');
            window.alert(error.message || 'Could not save score.');
        } finally {
            input.classList.remove('is-saving');
        }
    }

    async function updateDayStatus(status) {
        if (!state.currentDayId) return;
        const client = await BirdieAuth.ensureClient();
        const result = await client.from('golf_days').update({ status: status }).eq('id', state.currentDayId);
        if (result.error) throw result.error;
        await renderMemberHub();
    }

    function shiftCalendar(direction) {
        const cursor = state.calendarCursor || new Date();
        state.calendarCursor = new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
        const calendar = document.querySelector('.mvp-calendar');
        if (!calendar) return;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = renderCalendar(state.golfDays);
        calendar.replaceWith(wrapper.firstElementChild);
    }

    function scheduleRealtimeRefresh() {
        if (!BirdieAuth.getSession()) return;
        if (state.refreshTimer) window.clearTimeout(state.refreshTimer);
        state.refreshTimer = window.setTimeout(function () {
            if (state.currentDayId) openGolfDay(state.currentDayId);
            else renderMemberHub();
        }, 250);
    }

    async function manageRealtimeSubscription() {
        const client = await BirdieAuth.ensureClient();
        if (!client) return;
        if (state.realtimeChannel) {
            await client.removeChannel(state.realtimeChannel);
            state.realtimeChannel = null;
        }
        if (!BirdieAuth.getSession()) return;
        state.realtimeChannel = client
            .channel('birdie-squad-mvp-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores' }, scheduleRealtimeRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'golf_day_players' }, scheduleRealtimeRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'golf_days' }, scheduleRealtimeRefresh)
            .subscribe();
    }

    document.addEventListener('click', function (event) {
        if (!isElement(event.target)) return;
        const login = event.target.closest('[data-mvp-login]');
        if (login) {
            const modal = document.getElementById('auth-modal');
            if (modal) {
                modal.classList.add('active');
                const input = modal.querySelector('#auth-username');
                if (input) input.focus();
            }
            return;
        }
        const openDay = event.target.closest('[data-open-day]');
        if (openDay) { const dayId = openDay.getAttribute('data-open-day'); if (dayId) openGolfDay(dayId); return; }
        const card = event.target.closest('[data-view-card]');
        if (card) { renderIndividualScorecard(card.getAttribute('data-view-card')); return; }
        if (event.target.closest('[data-close-card]')) { const panel = document.getElementById('mvp-scorecard-panel'); if (panel) panel.innerHTML = ''; return; }
        const calendarShift = event.target.closest('[data-calendar-shift]');
        if (calendarShift) { shiftCalendar(Number(calendarShift.getAttribute('data-calendar-shift')) || 0); return; }
        const statusButton = event.target.closest('[data-day-status]');
        if (statusButton) updateDayStatus(statusButton.getAttribute('data-day-status')).catch(function (error) { console.error('Birdie MVP status update failed:', error); window.alert('Could not update the round status.'); });
    });

    document.addEventListener('submit', function (event) {
        if (!isElement(event.target)) return;
        if (event.target.id === 'mvp-create-day-form') {
            event.preventDefault();
            createGolfDay(event.target).catch(function (error) { console.error('Birdie MVP golf day create failed:', error); window.alert('Could not create the golf day. Check the required fields and try again.'); });
            return;
        }
        if (event.target.id === 'mvp-add-player-form') {
            event.preventDefault();
            addPlayer(event.target).catch(function (error) { console.error('Birdie MVP add player failed:', error); window.alert('Could not add that player.'); });
        }
    });

    document.addEventListener('change', function (event) {
        if (!isElement(event.target) || !event.target.classList.contains('mvp-score-input')) return;
        saveScore(event.target);
    });

    async function onAuthChanged() {
        try {
            state.currentDayId = state.currentDayId && BirdieAuth.getSession() ? state.currentDayId : null;
            await renderMemberHub();
            await manageRealtimeSubscription();
        } catch (error) {
            console.error('Birdie MVP hub refresh failed:', error);
            setMountMessage('Member Golf Hub unavailable', 'The secure member connection could not be loaded. The public events page is still available.', 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        window.setTimeout(function () {
            BirdieAuth.onChange(onAuthChanged);
            BirdieAuth.refresh();
        }, 0);
    });
})();
