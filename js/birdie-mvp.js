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
        refreshTimer: null,
        pendingImport: null,
        importBackendStatus: 'unknown',
        presentationFlags: {},
        currentPresentation: null
    };

    const POSTER_BUCKET = 'event-posters';
    const POSTER_MAX_BYTES = 5 * 1024 * 1024;
    const POSTER_ALLOWED_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

    function isElement(target) {
        return target && target.nodeType === 1;
    }

    function isStaffRole(role) {
        return role === 'admin' || role === 'management' || role === 'scorer';
    }

    function canManageGolfDays(role) {
        return role === 'admin' || role === 'management';
    }

    // A closed Excel-imported historical round is a read-only record, not a
    // live round that can be reopened, staffed or hand-scored. Its data
    // lives entirely in `final_score_override`; there is nothing to score.
    function isReadOnlyHistoricalDay(day) {
        return !!day && day.status === 'closed' && day.source_type === 'excel_import';
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
            // Deliberately excludes legacy_import_key: this is the ordinary
            // hub load and must keep working even if the optional Gate 2B
            // import migration has not been applied yet. Only the Excel
            // import feature itself (admin-only) probes for those objects.
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

    // Probes whether the optional Gate 2B import objects (workbook_imports
    // table + import_legacy_workbook RPC, added together in the same
    // migration) exist yet, without ever throwing. Never blocks or breaks
    // the ordinary Golf Hub — only decides what the admin-only import panel
    // shows. Non-admins never even attempt this.
    async function checkImportBackendAvailable() {
        const profile = BirdieAuth.getProfile();
        if (!profile || profile.role !== 'admin') {
            state.importBackendStatus = 'unavailable';
            return;
        }
        try {
            const client = await BirdieAuth.ensureClient();
            const result = await client.from('workbook_imports').select('id').limit(1);
            state.importBackendStatus = result.error ? 'unavailable' : 'available';
        } catch (error) {
            state.importBackendStatus = 'unavailable';
        }
    }

    // Lightweight per-day flags (has a poster / has prizes) for the tiny
    // calendar badge, fetched separately from loadGolfDays() so the base
    // hub load never depends on the event-details migration existing.
    // Never throws — a missing migration just means no badges, not a
    // broken calendar.
    async function loadPresentationFlags() {
        try {
            const client = await BirdieAuth.ensureClient();
            const result = await client.from('golf_days').select('id, poster_path, prizes');
            if (result.error) throw result.error;
            const flags = {};
            (result.data || []).forEach(function (row) {
                flags[row.id] = {
                    hasPoster: !!row.poster_path,
                    hasPrizes: Array.isArray(row.prizes) && row.prizes.length > 0
                };
            });
            state.presentationFlags = flags;
        } catch (error) {
            console.error('Birdie MVP presentation flags unavailable (migration may not be applied yet):', error);
            state.presentationFlags = {};
        }
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

    function renderPendingApprovalHub() {
        const mount = getMount();
        if (!mount) return;
        const session = BirdieAuth.getSession();
        const email = session && session.user && session.user.email ? session.user.email : 'Your account';
        mount.innerHTML = `
            <div class="mvp-state-card mvp-state-pending">
                <p class="mvp-eyebrow">Signed in</p>
                <h3>Account awaiting club approval</h3>
                <p>${escapeHtml(email)} is signed in but has not yet been approved for club golf data. Contact a club administrator to approve this account, then log in again.</p>
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
                        const flags = state.presentationFlags[day.id];
                        const badgeClass = flags && (flags.hasPoster || flags.hasPrizes) ? ' has-presentation' : '';
                        return `<button type="button" class="mvp-calendar-event${badgeClass}" data-open-day="${day.id}" title="${escapeHtml(day.title)}">${escapeHtml(day.title)}</button>`;
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

    // Shared by the create form and the edit-event-details form so the
    // markup/field set never drifts between the two. `info` is null/empty
    // for a brand-new golf day.
    function renderPromoFieldsGrid(info) {
        info = info || {};
        const prizes = Array.isArray(info.prizes) ? info.prizes : [];
        const prizeRows = Array.from({ length: 4 }, function (_, index) {
            const prize = prizes[index] || {};
            return `
                <div class="mvp-prize-row">
                    <input type="text" name="prize_label_${index}" placeholder="1st Prize" value="${escapeHtml(prize.label || '')}">
                    <input type="text" name="prize_value_${index}" placeholder="R1500" value="${escapeHtml(prize.value || '')}">
                </div>
            `;
        }).join('');

        return `
            <label class="mvp-check"><input type="checkbox" name="featured" ${info.featured ? 'checked' : ''}> Feature this event on the public Events page</label>
            <label class="mvp-span-2">Short description<input type="text" name="short_description" maxlength="180" value="${escapeHtml(info.short_description || '')}" placeholder="One-line summary for the calendar/card"></label>
            <label class="mvp-span-2">Full description<textarea name="description" rows="3" placeholder="Longer description shown on the featured event">${escapeHtml(info.description || '')}</textarea></label>
            <label>Reporting time<input type="time" name="reporting_time" value="${escapeHtml(info.reporting_time ? String(info.reporting_time).slice(0, 5) : '')}"></label>
            <label>Tee-off time<input type="time" name="tee_off_time" value="${escapeHtml(info.tee_off_time ? String(info.tee_off_time).slice(0, 5) : '')}"></label>
            <label>Green fee<input type="text" name="green_fee" value="${escapeHtml(info.green_fee || '')}" placeholder="R300.00"></label>
            <label>Sponsor<input type="text" name="sponsor_name" value="${escapeHtml(info.sponsor_name || '')}" placeholder="Sponsor name"></label>
            <label class="mvp-span-2">Note / instructions<input type="text" name="event_note" value="${escapeHtml(info.event_note || '')}" placeholder="Wear club colours, etc."></label>
            <label class="mvp-span-2">Poster image (JPG, PNG or WebP, up to 5MB)<input type="file" name="poster_file" accept="image/jpeg,image/png,image/webp"></label>
            <label class="mvp-span-2">Poster alt text<input type="text" name="poster_alt" value="${escapeHtml(info.poster_alt || '')}" placeholder="Describe the poster for screen readers"></label>
            <div class="mvp-span-2 mvp-prize-rows">
                <p class="mvp-small-note">Prizes (optional — leave a row blank to skip it)</p>
                ${prizeRows}
            </div>
        `;
    }

    function readPromoFieldsFromForm(form) {
        const data = new FormData(form);
        const prizes = [];
        for (let i = 0; i < 4; i += 1) {
            const label = String(data.get('prize_label_' + i) || '').trim();
            const value = String(data.get('prize_value_' + i) || '').trim();
            if (label || value) prizes.push({ label: label, value: value });
        }
        return {
            featured: data.get('featured') === 'on',
            short_description: String(data.get('short_description') || '').trim() || null,
            description: String(data.get('description') || '').trim() || null,
            reporting_time: String(data.get('reporting_time') || '').trim() || null,
            tee_off_time: String(data.get('tee_off_time') || '').trim() || null,
            green_fee: String(data.get('green_fee') || '').trim() || null,
            event_note: String(data.get('event_note') || '').trim() || null,
            sponsor_name: String(data.get('sponsor_name') || '').trim() || null,
            prizes: prizes,
            poster_alt: String(data.get('poster_alt') || '').trim() || null
        };
    }

    // Uploads the poster selected in `form` (if any) to a collision-safe
    // <golf_day_id>/<timestamp>-<random>.<ext> path, removes the previous
    // poster object once the new one is safely uploaded (best-effort, never
    // blocks on cleanup failure), and returns the path to store on the
    // golf_days row. Returns the unchanged previous path if no new file was
    // chosen. Client-side type/size checks give a fast, friendly error;
    // the storage bucket itself (event-posters, 5MB, jpeg/png/webp only)
    // is the real server-side enforcement boundary.
    async function uploadPosterIfProvided(form, dayId, previousPosterPath) {
        const fileInput = form.querySelector('[name="poster_file"]');
        const file = fileInput && fileInput.files ? fileInput.files[0] : null;
        if (!file) return previousPosterPath || null;

        const ext = POSTER_ALLOWED_TYPES[file.type];
        if (!ext) throw new Error('Poster must be a JPG, PNG or WebP image.');
        if (file.size > POSTER_MAX_BYTES) throw new Error('Poster must be smaller than 5MB.');

        const client = await BirdieAuth.ensureClient();
        const path = dayId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        const uploadResult = await client.storage.from(POSTER_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (uploadResult.error) throw uploadResult.error;

        if (previousPosterPath) {
            client.storage.from(POSTER_BUCKET).remove([previousPosterPath]).catch(function (error) {
                console.error('Birdie MVP could not remove the previous poster (non-fatal):', error);
            });
        }
        return path;
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
                    <details class="mvp-promo-details mvp-span-2">
                        <summary>Event / promotion details (optional)</summary>
                        <div class="mvp-form-grid">${renderPromoFieldsGrid(null)}</div>
                    </details>
                    <button type="submit" class="btn btn-primary mvp-span-2">Create Golf Day</button>
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
        const profile = BirdieAuth.getProfile();
        if (!profile || profile.approved === false) {
            renderPendingApprovalHub();
            return;
        }

        mount.innerHTML = '<div class="mvp-loading">Loading member golf hub...</div>';
        try {
            await Promise.all([loadGolfDays(), loadMembers(), checkImportBackendAvailable(), loadPresentationFlags()]);
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
                ${renderImportPanel()}
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

    // Separate, independently-guarded from the scoring/leaderboard queries
    // above: a missing event-details migration must never break opening a
    // golf day, only mean no presentation block is shown for it.
    async function loadCurrentDayPresentation(client, dayId) {
        state.currentPresentation = null;
        try {
            const result = await client
                .from('golf_days')
                .select('short_description, description, reporting_time, tee_off_time, green_fee, event_note, sponsor_name, prizes, poster_path, poster_alt, featured')
                .eq('id', dayId)
                .maybeSingle();
            if (result.error) throw result.error;
            const info = result.data;
            if (!info) return;
            let posterUrl = '';
            if (info.poster_path) {
                const urlResult = client.storage.from(POSTER_BUCKET).getPublicUrl(info.poster_path);
                posterUrl = urlResult && urlResult.data ? urlResult.data.publicUrl : '';
            }
            state.currentPresentation = Object.assign({}, info, { posterUrl: posterUrl });
        } catch (error) {
            console.error('Birdie MVP event presentation unavailable (migration may not be applied yet):', error);
            state.currentPresentation = null;
        }
    }

    async function loadCurrentDayData(dayId) {
        const client = await BirdieAuth.ensureClient();
        const results = await Promise.all([
            client.from('live_leaderboard').select('*').eq('golf_day_id', dayId).order('position', { ascending: true, nullsFirst: false }).order('player_name'),
            client.from('golf_day_players').select('id, golf_day_id, member_id, handicap_at_start, final_score_override, score_source, sort_order, members(full_name, current_handicap)').eq('golf_day_id', dayId).order('sort_order', { ascending: true, nullsFirst: false }),
            loadCurrentDayPresentation(client, dayId)
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
        if (isReadOnlyHistoricalDay(day)) return '';
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
        if (isReadOnlyHistoricalDay(day)) return '';
        if (!BirdieAuth.getProfile() || !canManageGolfDays(BirdieAuth.getProfile().role)) return '';
        return `<div class="mvp-status-actions">${day.status !== 'live' ? '<button type="button" class="btn btn-secondary" data-day-status="live">Start Live Round</button>' : ''}${day.status !== 'closed' ? '<button type="button" class="btn btn-outline" data-day-status="closed">Close Round</button>' : ''}</div>`;
    }

    function renderScoreGrid(day) {
        if (isReadOnlyHistoricalDay(day)) return '';
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
            return `<tr><th class="mvp-player-sticky"><strong>${escapeHtml(name)}</strong><small>HC ${escapeHtml(player.handicap_at_start || '-')}</small><span class="mvp-player-mobile-total" data-mobile-total-for="${player.id}">Total <strong>${total}</strong></span></th>${cells}<td class="mvp-total-sticky" data-total-for="${player.id}"><strong>${total}</strong>${imported ? '<small>Excel</small>' : ''}</td></tr>`;
        }).join('');

        return `
            <section class="mvp-score-entry">
                <div class="mvp-panel-heading"><div><p class="mvp-eyebrow">Scorer view</p><h3>Live Score Sheet</h3><p>Players run down the left, holes run across the top — familiar like the club spreadsheet.</p></div></div>
                <div class="mvp-score-grid-wrap"><table class="mvp-score-grid"><thead><tr><th class="mvp-player-sticky">Player</th>${holeHeaders}<th class="mvp-total-sticky">Total</th></tr></thead><tbody>${rows}</tbody></table></div>
                <p class="mvp-small-note">Scores save when you leave a cell. Members watching the leaderboard receive the update automatically.</p>
            </section>
        `;
    }

    // The promotional presentation (poster/description/prizes/etc.) shown
    // above the leaderboard/scorer when any such field exists for this
    // golf day. Nothing renders — not even an empty card — when the day
    // has none of these fields set, or the migration isn't applied yet
    // (state.currentPresentation is null in both cases).
    function renderPresentationBlock() {
        const info = state.currentPresentation;
        if (!info) return '';
        const hasAny = info.posterUrl || info.short_description || info.description
            || info.reporting_time || info.tee_off_time || info.green_fee
            || info.event_note || info.sponsor_name
            || (Array.isArray(info.prizes) && info.prizes.length);
        if (!hasAny) return '';

        const metaRows = [];
        if (info.reporting_time) metaRows.push('<p><strong>Reporting Time:</strong> ' + escapeHtml(String(info.reporting_time).slice(0, 5)) + '</p>');
        if (info.tee_off_time) metaRows.push('<p><strong>Tee Off:</strong> ' + escapeHtml(String(info.tee_off_time).slice(0, 5)) + '</p>');
        if (info.green_fee) metaRows.push('<p><strong>Green Fee:</strong> ' + escapeHtml(info.green_fee) + '</p>');
        if (info.sponsor_name) metaRows.push('<p><strong>Sponsor:</strong> ' + escapeHtml(info.sponsor_name) + '</p>');
        if (info.event_note) metaRows.push('<p><strong>Note:</strong> ' + escapeHtml(info.event_note) + '</p>');

        const prizesHtml = Array.isArray(info.prizes) && info.prizes.length
            ? '<div class="event-prizes"><h3>Prizes</h3><ul>' + info.prizes.map(function (prize) {
                return '<li><span>' + escapeHtml(prize.label || '') + '</span><strong>' + escapeHtml(prize.value || '') + '</strong></li>';
            }).join('') + '</ul></div>'
            : '';

        return `
            <section class="mvp-event-presentation">
                ${info.posterUrl ? '<img src="' + escapeHtml(info.posterUrl) + '" alt="' + escapeHtml(info.poster_alt || 'Event poster') + '" class="mvp-event-poster">' : ''}
                ${info.short_description ? '<p class="mvp-event-summary">' + escapeHtml(info.short_description) + '</p>' : ''}
                ${info.description ? '<p>' + escapeHtml(info.description) + '</p>' : ''}
                ${metaRows.length ? '<div class="mvp-event-meta">' + metaRows.join('') + '</div>' : ''}
                ${prizesHtml}
            </section>
        `;
    }

    function renderEditEventForm(day) {
        if (isReadOnlyHistoricalDay(day)) return '';
        if (!BirdieAuth.getProfile() || !canManageGolfDays(BirdieAuth.getProfile().role)) return '';
        return `
            <details class="mvp-admin-details mvp-promo-details">
                <summary>Edit event / promotion details</summary>
                <form id="mvp-edit-event-form" class="mvp-form-grid" data-day-id="${day.id}">
                    ${renderPromoFieldsGrid(state.currentPresentation)}
                    <button type="submit" class="btn btn-secondary mvp-span-2">Save Event Details</button>
                </form>
            </details>
        `;
    }

    function renderDayDetail(day) {
        const detail = document.getElementById('mvp-day-detail');
        if (!detail) return;
        detail.innerHTML = `
            <div class="mvp-day-hero"><div><p class="mvp-eyebrow">${day.game_number ? 'Game ' + day.game_number : 'Club golf day'}</p><h2>${escapeHtml(day.title)}</h2><p>${escapeHtml(day.venue || 'Venue TBC')} · ${escapeHtml(formatDate(day.event_date))}</p></div><span class="mvp-status mvp-status-${escapeHtml(day.status)}">${escapeHtml(day.status)}</span></div>
            ${renderPresentationBlock()}
            ${renderDayStatusControls(day)}
            ${renderEditEventForm(day)}
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

    // Updates leaderboard totals/positions and the score grid's total cells
    // and (non-focused) values in place, without recreating the score grid's
    // <input> elements. This preserves scroll position, focus and the
    // in-progress `is-saved` state on the scorer's inputs — a full
    // openGolfDay() re-render would reset all three on every save.
    function applyScoreGridLiveUpdate() {
        const day = getCurrentDay();
        state.currentPlayers.forEach(function (player) {
            const leaderboard = getLeaderboardRow(player.id);
            const total = leaderboard && leaderboard.total_score != null ? leaderboard.total_score : '-';
            const totalCell = document.querySelector('[data-total-for="' + player.id + '"] strong');
            if (totalCell) totalCell.textContent = total;
            const mobileTotalCell = document.querySelector('[data-mobile-total-for="' + player.id + '"] strong');
            if (mobileTotalCell) mobileTotalCell.textContent = total;

            if (player.score_source === 'imported_total' || !day) return;
            for (let hole = 1; hole <= day.hole_count; hole += 1) {
                const input = document.querySelector('.mvp-score-input[data-player-id="' + player.id + '"][data-hole="' + hole + '"]');
                if (!input || document.activeElement === input) continue;
                const value = String(scoreFor(player.id, hole));
                if (input.value !== value) input.value = value;
            }
        });
    }

    function updateLeaderboardSection() {
        const section = document.querySelector('#mvp-day-detail .mvp-leaderboard');
        if (!section) return false;
        const heading = section.querySelector('.mvp-panel-heading');
        section.innerHTML = (heading ? heading.outerHTML : '') + renderLeaderboard();
        return true;
    }

    async function refreshCurrentDayLite(dayId) {
        if (state.currentDayId !== dayId) return;
        if (!document.getElementById('mvp-day-detail')) {
            await openGolfDay(dayId);
            return;
        }
        await loadCurrentDayData(dayId);
        if (!updateLeaderboardSection()) {
            await openGolfDay(dayId);
            return;
        }
        applyScoreGridLiveUpdate();
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
        const promo = readPromoFieldsFromForm(form);
        const basePayload = {
            game_number: data.get('game_number') ? Number(data.get('game_number')) : null,
            title: String(data.get('title') || '').trim(),
            venue: String(data.get('venue') || '').trim(),
            event_date: String(data.get('event_date') || ''),
            status: 'scheduled', scoring_method: 'gross_stroke_v1', hole_count: 18,
            is_public: data.get('is_public') === 'on', source_type: 'app'
        };

        // The fast creation flow must keep working even if the event-details
        // migration hasn't been applied to the live project yet — try with
        // the promo fields first, and fall back to base-only on failure
        // rather than blocking golf-day creation entirely.
        let result = await client.from('golf_days').insert(Object.assign({}, basePayload, promo)).select('id').single();
        if (result.error) {
            console.error('Birdie MVP golf day create with event details failed, retrying without them (migration may not be applied yet):', result.error);
            result = await client.from('golf_days').insert(basePayload).select('id').single();
            if (result.error) throw result.error;
            window.alert('The golf day was created, but the event/promotion details could not be saved yet — ask your developer to apply the latest database migration.');
        }
        const newDayId = result.data.id;

        try {
            const posterPath = await uploadPosterIfProvided(form, newDayId, null);
            if (posterPath) {
                const posterUpdate = await client.from('golf_days').update({ poster_path: posterPath }).eq('id', newDayId);
                if (posterUpdate.error) throw posterUpdate.error;
            }
        } catch (posterError) {
            console.error('Birdie MVP poster upload failed (golf day still created):', posterError);
            window.alert('The golf day was created, but the poster could not be uploaded: ' + (posterError.message || 'unknown error'));
        }

        state.currentDayId = newDayId;
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
            await refreshCurrentDayLite(state.currentDayId);
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

    async function updateGolfDayPresentation(form) {
        const dayId = form.getAttribute('data-day-id');
        if (!dayId) return;
        const client = await BirdieAuth.ensureClient();
        const promo = readPromoFieldsFromForm(form);
        const previousPosterPath = state.currentPresentation ? state.currentPresentation.poster_path : null;

        const posterPath = await uploadPosterIfProvided(form, dayId, previousPosterPath);
        const payload = Object.assign({}, promo, { poster_path: posterPath });
        const result = await client.from('golf_days').update(payload).eq('id', dayId);
        if (result.error) throw result.error;
        await openGolfDay(dayId);
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

    function setRealtimeStatusWarning(message) {
        const bar = document.querySelector('.mvp-member-bar');
        if (!bar) return;
        let warning = bar.querySelector('.mvp-realtime-warning');
        if (!warning) {
            warning = document.createElement('span');
            warning.className = 'mvp-realtime-warning';
            bar.appendChild(warning);
        }
        warning.textContent = message;
    }

    function clearRealtimeStatusWarning() {
        const warning = document.querySelector('.mvp-realtime-warning');
        if (warning) warning.remove();
    }

    // A hole_scores change (the frequent, per-keystroke case, including the
    // scorer's own save landing back over Realtime) uses the lightweight
    // path so the score grid's scroll/focus/is-saved state survive it.
    // Rarer staff actions (add player, create/close a golf day) still get a
    // full re-render since they change the surrounding controls, not just totals.
    function scheduleRealtimeRefresh(payload) {
        if (!BirdieAuth.getSession()) return;
        if (state.refreshTimer) window.clearTimeout(state.refreshTimer);
        const table = payload && payload.table;
        state.refreshTimer = window.setTimeout(function () {
            if (!state.currentDayId) {
                renderMemberHub();
                return;
            }
            if (table === 'hole_scores') {
                refreshCurrentDayLite(state.currentDayId).catch(function (error) {
                    console.error('Birdie MVP live score refresh failed:', error);
                });
                return;
            }
            openGolfDay(state.currentDayId);
        }, 250);
    }

    async function manageRealtimeSubscription() {
        const client = await BirdieAuth.ensureClient();
        if (!client) return;
        if (state.realtimeChannel) {
            await client.removeChannel(state.realtimeChannel);
            state.realtimeChannel = null;
        }
        clearRealtimeStatusWarning();
        if (!BirdieAuth.getSession()) return;
        state.realtimeChannel = client
            .channel('birdie-squad-mvp-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores' }, scheduleRealtimeRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'golf_day_players' }, scheduleRealtimeRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'golf_days' }, scheduleRealtimeRefresh)
            .subscribe(function (status, error) {
                if (status === 'SUBSCRIBED') {
                    console.info('Birdie MVP Realtime connected.');
                    clearRealtimeStatusWarning();
                    return;
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    console.error('Birdie MVP Realtime connection issue:', status, error);
                    setRealtimeStatusWarning('Live updates unavailable right now — refresh to see the latest scores.');
                }
            });
    }

    // -----------------------------------------------------------------
    // Legacy Excel workbook import (admin only)
    //
    // The workbook is parsed entirely in the browser (nothing is written
    // until Admin explicitly confirms the preview). Pinned to the last
    // npm-published SheetJS (xlsx) release — Apache-2.0, still served from
    // jsDelivr's `+esm` transform, the same distribution mechanism already
    // used for the Supabase client in this file. Newer SheetJS builds
    // (0.20.x+) moved to cdn.sheetjs.com, a distribution this codebase does
    // not otherwise depend on; 0.18.5 keeps a single trusted CDN provider.
    //
    // Row parsing, normalization, legacy-key derivation and categorization
    // live in js/legacy-import-utils.js (window.BirdieLegacyImport) so the
    // exact same logic can run under a plain Node test without a browser,
    // Supabase, or the XLSX library itself.
    // -----------------------------------------------------------------
    const XLSX_MODULE_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';
    let xlsxModulePromise = null;

    function ensureXlsx() {
        if (!xlsxModulePromise) xlsxModulePromise = import(XLSX_MODULE_URL);
        return xlsxModulePromise;
    }

    async function computeSha256Hex(arrayBuffer) {
        const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
        return Array.from(new Uint8Array(digest)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
    }

    function findSheetName(workbook, wantedLower) {
        return workbook.SheetNames.find(function (name) { return name.trim().toLowerCase() === wantedLower; })
            || workbook.SheetNames.find(function (name) { return name.trim().toLowerCase().indexOf(wantedLower) !== -1; })
            || null;
    }

    async function parseWorkbookFile(file) {
        if (!/\.xlsx$/i.test(file.name)) {
            throw new Error('Only .xlsx workbook files are supported.');
        }
        const buffer = await file.arrayBuffer();
        const checksum = await computeSha256Hex(buffer);
        const XLSX = await ensureXlsx();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

        const playerSheetName = findSheetName(workbook, 'player details') || findSheetName(workbook, 'player');
        const gamesSheetName = findSheetName(workbook, 'games');
        if (!playerSheetName || !gamesSheetName) {
            throw new Error('This workbook is missing the expected "Player details" and "Games" sheets.');
        }

        const playerRows = XLSX.utils.sheet_to_json(workbook.Sheets[playerSheetName], { header: 1, raw: false, defval: '' });
        const members = BirdieLegacyImport.parsePlayerDetailsRows(playerRows);
        if (!members.length) {
            throw new Error('No roster row was found next to "Member Name" on the Player details sheet.');
        }

        // The Games header row is the authority for which column holds
        // which player's score — it is never derived from Player details.
        const gameRows = XLSX.utils.sheet_to_json(workbook.Sheets[gamesSheetName], { header: 1, defval: null });
        const games = BirdieLegacyImport.parseGamesRows(gameRows);

        return { filename: file.name, checksum: checksum, members: members, games: games };
    }

    // Read-only comparison against currently loaded Supabase data. Never
    // writes anything; the atomic RPC is the only thing that ever commits.
    async function buildImportPreview(parsed) {
        const client = await BirdieAuth.ensureClient();

        const existingImport = await client.from('workbook_imports').select('id, filename, imported_at').eq('checksum_sha256', parsed.checksum).maybeSingle();
        if (existingImport.error) throw existingImport.error;
        if (existingImport.data) {
            return { alreadyImported: existingImport.data, members: [], games: [] };
        }

        const membersResult = await client.from('members').select('id, full_name, current_handicap');
        if (membersResult.error) throw membersResult.error;
        const existingMembers = membersResult.data || [];

        const memberPreview = parsed.members.map(function (member) {
            return BirdieLegacyImport.categorizeMember(member, existingMembers);
        });

        const existingExcelDays = (state.golfDays || []).filter(function (day) { return day.source_type === 'excel_import'; });
        const matchedDayIds = [];
        const gamesWithKeys = parsed.games.map(function (game) {
            const categorized = BirdieLegacyImport.categorizeGame(game, existingExcelDays);
            if (categorized.existingDay) matchedDayIds.push(categorized.existingDay.id);
            return categorized;
        });

        const existingPlayersByDay = {};
        if (matchedDayIds.length) {
            const playersResult = await client.from('golf_day_players').select('golf_day_id, member_id, final_score_override, members(full_name)').in('golf_day_id', matchedDayIds);
            if (playersResult.error) throw playersResult.error;
            (playersResult.data || []).forEach(function (row) {
                if (!existingPlayersByDay[row.golf_day_id]) existingPlayersByDay[row.golf_day_id] = [];
                existingPlayersByDay[row.golf_day_id].push(row);
            });
        }

        const gamePreview = gamesWithKeys.map(function (game) {
            if (game.category === 'conflict') return game;
            if (!game.existingDay) return Object.assign({}, game, { category: 'new' });
            const existingRows = existingPlayersByDay[game.existingDay.id] || [];
            let changed = false;
            game.players.forEach(function (player) {
                const norm = BirdieLegacyImport.normalizeName(player.full_name);
                const existingRow = existingRows.find(function (row) { return row.members && BirdieLegacyImport.normalizeName(row.members.full_name) === norm; });
                if (!existingRow || existingRow.final_score_override !== player.final_score) changed = true;
            });
            return Object.assign({}, game, { category: changed ? 'update' : 'unchanged' });
        });

        return { alreadyImported: null, members: memberPreview, games: gamePreview };
    }

    function importCategoryLabel(category) {
        const labels = { new: 'New', update: 'Update', unchanged: 'Unchanged', conflict: 'Skipped — needs review' };
        return labels[category] || category;
    }

    function renderImportPreview(parsed, preview) {
        if (preview.alreadyImported) {
            const when = preview.alreadyImported.imported_at ? formatDate(String(preview.alreadyImported.imported_at).slice(0, 10)) : 'earlier';
            return `
                <div class="mvp-state-card mvp-state-pending">
                    <h3>Already imported</h3>
                    <p>This exact workbook (${escapeHtml(preview.alreadyImported.filename)}) was already imported on ${escapeHtml(when)}. Nothing further to do — choose a newer workbook if the club has played since then.</p>
                </div>
            `;
        }

        const memberCounts = { new: 0, update: 0, unchanged: 0, conflict: 0 };
        preview.members.forEach(function (m) { memberCounts[m.category] = (memberCounts[m.category] || 0) + 1; });
        const gameCounts = { new: 0, update: 0, unchanged: 0, conflict: 0 };
        preview.games.forEach(function (g) { gameCounts[g.category] = (gameCounts[g.category] || 0) + 1; });

        const gameRows = preview.games.map(function (game) {
            return `
                <tr>
                    <td>${game.game_number != null ? escapeHtml(game.game_number) : '—'}</td>
                    <td>${escapeHtml(game.venue || 'Venue TBC')}</td>
                    <td>${game.event_date ? escapeHtml(formatDate(game.event_date)) : 'Date TBC'}</td>
                    <td>${game.players.length}</td>
                    <td><span class="mvp-import-badge mvp-import-badge-${escapeHtml(game.category)}">${escapeHtml(importCategoryLabel(game.category))}</span>${game.reason ? '<small>' + escapeHtml(game.reason) + '</small>' : ''}</td>
                </tr>
            `;
        }).join('');

        const conflictMembers = preview.members.filter(function (m) { return m.category === 'conflict'; });

        return `
            <div class="mvp-import-summary">
                <div><strong>${memberCounts.new}</strong><span>New players</span></div>
                <div><strong>${memberCounts.update}</strong><span>Handicap updates</span></div>
                <div><strong>${gameCounts.new}</strong><span>New games</span></div>
                <div><strong>${gameCounts.update}</strong><span>Games to update</span></div>
                <div><strong>${gameCounts.unchanged}</strong><span>Unchanged games</span></div>
                <div><strong>${gameCounts.conflict + memberCounts.conflict}</strong><span>Skipped / needs review</span></div>
            </div>
            <p class="mvp-small-note">Live rounds already being played in the app will never be overwritten by a workbook import.</p>
            ${conflictMembers.length ? `<p class="mvp-small-note">Skipped players (need manual review): ${conflictMembers.map(function (m) { return escapeHtml(m.full_name); }).join(', ')}.</p>` : ''}
            <div class="mvp-table-wrap">
                <table class="mvp-leaderboard-table">
                    <thead><tr><th>Game</th><th>Venue</th><th>Date</th><th>Players</th><th>Status</th></tr></thead>
                    <tbody>${gameRows || '<tr><td colspan="5">No games were found in this workbook.</td></tr>'}</tbody>
                </table>
            </div>
            <button type="button" class="btn btn-primary" data-import-commit>Import Workbook</button>
        `;
    }

    function renderImportPanel() {
        const profile = BirdieAuth.getProfile();
        if (!profile || profile.role !== 'admin') return '';

        if (state.importBackendStatus !== 'available') {
            return `
                <section class="mvp-panel mvp-import-panel">
                    <div class="mvp-panel-heading">
                        <div>
                            <p class="mvp-eyebrow">Admin only</p>
                            <h3>Import Latest Club Workbook</h3>
                        </div>
                    </div>
                    <p class="mvp-small-note">Import backend not installed yet. Ask your developer to apply the latest database migration before this feature is available. The rest of the Golf Hub is unaffected.</p>
                </section>
            `;
        }

        return `
            <section class="mvp-panel mvp-import-panel">
                <div class="mvp-panel-heading">
                    <div>
                        <p class="mvp-eyebrow">Admin only</p>
                        <h3>Import Latest Club Workbook</h3>
                        <p>Bring newer legacy games from the club's Excel workbook into the platform. The workbook remains your independent backup.</p>
                    </div>
                </div>
                <form id="mvp-import-form" class="mvp-inline-form">
                    <label>Choose Excel File<input type="file" id="mvp-import-file" accept=".xlsx" required></label>
                    <button type="submit" class="btn btn-secondary">Preview Import</button>
                </form>
                <div id="mvp-import-result"></div>
            </section>
        `;
    }

    async function handleImportPreviewSubmit(form) {
        const resultEl = document.getElementById('mvp-import-result');
        const fileInput = form.querySelector('#mvp-import-file');
        const file = fileInput && fileInput.files ? fileInput.files[0] : null;
        if (!resultEl) return;
        if (!file) {
            resultEl.innerHTML = '<p class="mvp-small-note">Choose an .xlsx file first.</p>';
            return;
        }

        resultEl.innerHTML = '<div class="mvp-loading">Reading workbook...</div>';
        try {
            const parsed = await parseWorkbookFile(file);
            const preview = await buildImportPreview(parsed);
            state.pendingImport = { parsed: parsed, preview: preview };
            resultEl.innerHTML = renderImportPreview(parsed, preview);
        } catch (error) {
            console.error('Birdie MVP workbook preview failed:', error);
            state.pendingImport = null;
            resultEl.innerHTML = `<div class="mvp-state-card mvp-state-error"><h3>Could not read this workbook</h3><p>${escapeHtml(error.message || 'Please check the file and try again.')}</p></div>`;
        }
    }

    async function handleImportCommit() {
        const resultEl = document.getElementById('mvp-import-result');
        if (!resultEl || !state.pendingImport) return;
        const { parsed, preview } = state.pendingImport;
        const payload = BirdieLegacyImport.buildImportPayload(parsed, preview);
        const commitBtn = resultEl.querySelector('[data-import-commit]');
        if (commitBtn) {
            commitBtn.disabled = true;
            commitBtn.textContent = 'Importing...';
        }

        try {
            const client = await BirdieAuth.ensureClient();
            const result = await client.rpc('import_legacy_workbook', { payload: payload });
            if (result.error) throw result.error;
            const summary = result.data || {};
            state.pendingImport = null;
            resultEl.innerHTML = `
                <div class="mvp-state-card">
                    <h3>Import complete</h3>
                    <p>${escapeHtml(summary.games_created || 0)} new game(s), ${escapeHtml(summary.games_updated || 0)} updated, ${escapeHtml(summary.members_created || 0)} new player(s), ${escapeHtml(summary.members_updated || 0)} handicap update(s). ${(summary.games_skipped || summary.members_skipped || summary.players_skipped) ? 'Some rows needed manual review and were skipped.' : ''}</p>
                </div>
            `;
            await renderMemberHub();
        } catch (error) {
            console.error('Birdie MVP workbook import failed:', error);
            if (commitBtn) {
                commitBtn.disabled = false;
                commitBtn.textContent = 'Import Workbook';
            }
            const message = document.createElement('div');
            message.className = 'mvp-state-card mvp-state-error';
            message.innerHTML = `<h3>Import failed</h3><p>${escapeHtml(error.message || 'Please try again.')}</p>`;
            resultEl.insertBefore(message, resultEl.firstChild);
        }
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
        if (statusButton) { updateDayStatus(statusButton.getAttribute('data-day-status')).catch(function (error) { console.error('Birdie MVP status update failed:', error); window.alert('Could not update the round status.'); }); return; }
        const importCommit = event.target.closest('[data-import-commit]');
        if (importCommit) { handleImportCommit(); return; }
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
            return;
        }
        if (event.target.id === 'mvp-edit-event-form') {
            event.preventDefault();
            updateGolfDayPresentation(event.target).catch(function (error) { console.error('Birdie MVP event details update failed:', error); window.alert(error.message || 'Could not save event details.'); });
            return;
        }
        if (event.target.id === 'mvp-import-form') {
            event.preventDefault();
            handleImportPreviewSubmit(event.target).catch(function (error) { console.error('Birdie MVP workbook preview failed:', error); window.alert('Could not read that workbook.'); });
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
