// Birdie Squad Golf Club - public Supabase golf-day list.
// Anonymous visitors see only rows explicitly marked public by RLS.
// Reuses the shared window.BirdieAuth Supabase client (js/main.js) so the
// page never creates more than one GoTrueClient instance.
(function () {
    'use strict';

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDate(dateString) {
        if (!dateString) return 'Date to be confirmed';
        const date = new Date(dateString + 'T00:00:00+02:00');
        if (Number.isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-ZA', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }

    function todayInSouthAfrica() {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Africa/Johannesburg',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(new Date());
        const values = {};
        parts.forEach(function (part) {
            if (part.type !== 'literal') values[part.type] = part.value;
        });
        return `${values.year}-${values.month}-${values.day}`;
    }

    function renderPublicDays(days) {
        const mount = document.getElementById('events-list-mount');
        if (!mount || !days.length) return;

        mount.innerHTML = days.map(function (day) {
            return `
                <article class="event-calendar-card">
                    <div>
                        <p class="event-calendar-date">${escapeHtml(formatDate(day.event_date))}</p>
                        <h3>${escapeHtml(day.title)}</h3>
                        <p>${escapeHtml(day.status === 'live' ? 'Golf day currently in progress.' : 'Upcoming Birdie Squad golf day.')}</p>
                    </div>
                    <div class="event-calendar-meta">
                        <p><strong>Venue:</strong> ${escapeHtml(day.venue || 'To be confirmed')}</p>
                        ${day.game_number ? `<p><strong>Game:</strong> ${escapeHtml(day.game_number)}</p>` : ''}
                        <p><strong>Status:</strong> ${escapeHtml(day.status)}</p>
                        <a href="#member-golf-hub" class="programme-link">Member golf hub &rarr;</a>
                    </div>
                </article>
            `;
        }).join('');
    }

    async function loadPublicGolfDays() {
        try {
            const client = await window.BirdieAuth.ensureClient();
            const today = todayInSouthAfrica();
            const result = await client
                .from('golf_days')
                .select('id, game_number, title, venue, event_date, status, is_public')
                .eq('is_public', true)
                .or(`status.eq.live,and(status.eq.scheduled,event_date.gte.${today})`)
                .order('event_date', { ascending: true, nullsFirst: false });

            if (result.error) throw result.error;
            renderPublicDays(result.data || []);
        } catch (error) {
            // Preserve the static events fallback if Supabase is temporarily unavailable.
            console.error('Birdie public events load failed:', error);
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        window.setTimeout(loadPublicGolfDays, 0);
    });
})();
