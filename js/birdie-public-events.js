// Birdie Squad Golf Club - public Supabase golf-day/event presentation.
// Anonymous visitors see only rows explicitly marked public by RLS.
// Reuses the shared window.BirdieAuth Supabase client (js/main.js) so the
// page never creates more than one GoTrueClient instance, and
// window.BirdieEventUtils (js/main.js) for the countdown timer so there is
// one countdown implementation shared by the static fallback and this
// live-data path.
//
// Runs on both events.html (featured card + calendar list) and index.html
// (homepage "next event" countdown) — the same Supabase query feeds both,
// so event data is never duplicated between the two pages.
(function () {
    'use strict';

    const POSTER_BUCKET = 'event-posters';

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

    function formatTime(timeString) {
        return timeString ? String(timeString).slice(0, 5) : '';
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

    async function getPosterUrl(client, posterPath) {
        if (!posterPath) return '';
        try {
            const result = client.storage.from(POSTER_BUCKET).getPublicUrl(posterPath);
            return result && result.data ? result.data.publicUrl : '';
        } catch (error) {
            console.error('Birdie public events: could not resolve poster URL:', error);
            return '';
        }
    }

    // Explicit featured=true wins; otherwise the nearest upcoming/live
    // public event (days are already sorted event_date ascending).
    function pickFeaturedDay(days) {
        return days.find(function (day) { return day.featured; }) || days[0] || null;
    }

    function renderPrizesHtml(prizes) {
        if (!Array.isArray(prizes) || !prizes.length) return '';
        return `
            <div class="event-prizes">
                <h3>Prizes</h3>
                <ul>${prizes.map(function (prize) {
                    return '<li><span>' + escapeHtml(prize.label || '') + '</span><strong>' + escapeHtml(prize.value || '') + '</strong></li>';
                }).join('')}</ul>
            </div>
        `;
    }

    function renderFeaturedCard(day, posterUrl) {
        const metaRows = [
            '<p><strong>Date:</strong> ' + escapeHtml(formatDate(day.event_date)) + '</p>',
            '<p><strong>Venue:</strong> ' + escapeHtml(day.venue || 'To be confirmed') + '</p>'
        ];
        if (day.reporting_time) metaRows.push('<p><strong>Reporting Time:</strong> ' + escapeHtml(formatTime(day.reporting_time)) + '</p>');
        if (day.tee_off_time) metaRows.push('<p><strong>Tee Off:</strong> ' + escapeHtml(formatTime(day.tee_off_time)) + '</p>');
        if (day.green_fee) metaRows.push('<p><strong>Green Fee:</strong> ' + escapeHtml(day.green_fee) + '</p>');
        if (day.event_note) metaRows.push('<p><strong>Note:</strong> ' + escapeHtml(day.event_note) + '</p>');
        if (day.sponsor_name) metaRows.push('<p><strong>Sponsor:</strong> ' + escapeHtml(day.sponsor_name) + '</p>');

        // No fake/placeholder poster when none was uploaded — omit the
        // media block entirely rather than showing unrelated imagery.
        const mediaHtml = posterUrl
            ? '<div class="event-featured-media"><img src="' + escapeHtml(posterUrl) + '" alt="' + escapeHtml(day.poster_alt || (day.title + ' poster')) + '" class="event-featured-image" loading="lazy"></div>'
            : '';

        return `
            <article id="${escapeHtml(day.id)}" class="event-featured-card${posterUrl ? '' : ' event-featured-card-no-media'}">
                ${mediaHtml}
                <div class="event-featured-content">
                    <p class="event-featured-kicker">${escapeHtml(day.status === 'live' ? 'Live Now' : 'Featured Event')}</p>
                    <h2>${escapeHtml(day.title)}</h2>
                    ${day.short_description ? '<p class="event-featured-desc">' + escapeHtml(day.short_description) + '</p>' : ''}
                    <div class="event-featured-meta">${metaRows.join('')}</div>
                    ${renderPrizesHtml(day.prizes)}
                    <div class="event-cta-group">
                        <a href="events.html#member-golf-hub" class="btn btn-primary">Member Golf Hub</a>
                        <a href="contact.html" class="btn btn-outline">Contact Club</a>
                    </div>
                </div>
            </article>
        `;
    }

    function toCountdownEventShape(day) {
        const time = day.reporting_time || day.tee_off_time;
        if (!day.event_date || !time) return null;
        return { date: day.event_date, reportingTime: formatTime(time) };
    }

    function renderFeaturedSection(days, posterUrlByPath) {
        const mount = document.getElementById('events-featured-mount');
        if (!mount) return; // not on the Events page
        const featured = pickFeaturedDay(days);
        if (!featured) return; // keep the static fallback already rendered by main.js

        const posterUrl = featured.poster_path ? (posterUrlByPath[featured.poster_path] || '') : '';
        const utils = window.BirdieEventUtils;
        const countdownShape = toCountdownEventShape(featured);
        const countdownHtml = countdownShape && utils
            ? `<div class="events-page-countdown"><h3>Countdown to Tee-Off Day</h3>${utils.renderCountdownMarkup(countdownShape)}</div>`
            : '';

        mount.innerHTML = renderFeaturedCard(featured, posterUrl) + countdownHtml;
        if (countdownShape && utils) utils.startCountdownTimer(mount, countdownShape);
    }

    function renderPublicDayCard(day, posterUrlByPath) {
        const posterUrl = day.poster_path ? (posterUrlByPath[day.poster_path] || '') : '';
        const thumbHtml = posterUrl
            ? '<img src="' + escapeHtml(posterUrl) + '" alt="' + escapeHtml(day.poster_alt || (day.title + ' poster')) + '" class="event-calendar-thumb" loading="lazy">'
            : '';
        const descriptionHtml = day.short_description
            ? escapeHtml(day.short_description)
            : escapeHtml(day.status === 'live' ? 'Golf day currently in progress.' : 'Upcoming Birdie Squad golf day.');

        return `
            <article class="event-calendar-card">
                <div>
                    ${thumbHtml}
                    <p class="event-calendar-date">${escapeHtml(formatDate(day.event_date))}</p>
                    <h3>${escapeHtml(day.title)}</h3>
                    <p>${descriptionHtml}</p>
                </div>
                <div class="event-calendar-meta">
                    <p><strong>Venue:</strong> ${escapeHtml(day.venue || 'To be confirmed')}</p>
                    ${day.reporting_time ? '<p><strong>Reporting:</strong> ' + escapeHtml(formatTime(day.reporting_time)) + '</p>' : ''}
                    ${day.tee_off_time ? '<p><strong>Tee Off:</strong> ' + escapeHtml(formatTime(day.tee_off_time)) + '</p>' : ''}
                    ${day.green_fee ? '<p><strong>Green Fee:</strong> ' + escapeHtml(day.green_fee) + '</p>' : ''}
                    ${day.sponsor_name ? '<p><strong>Sponsor:</strong> ' + escapeHtml(day.sponsor_name) + '</p>' : ''}
                    ${day.game_number ? '<p><strong>Game:</strong> ' + escapeHtml(day.game_number) + '</p>' : ''}
                    <a href="#member-golf-hub" class="programme-link">Member golf hub &rarr;</a>
                </div>
            </article>
        `;
    }

    function renderPublicDays(days, posterUrlByPath) {
        const mount = document.getElementById('events-list-mount');
        if (!mount || !days.length) return; // keep the static fallback
        mount.innerHTML = days.map(function (day) { return renderPublicDayCard(day, posterUrlByPath); }).join('');
    }

    function updateHomepageNextEvent(days, posterUrlByPath) {
        const heroSection = document.querySelector('.hero');
        if (!heroSection) return; // not the homepage
        const featured = pickFeaturedDay(days);
        if (!featured) return; // nothing public/upcoming — leave the hero as-is

        const utils = window.BirdieEventUtils;
        const countdownShape = utils ? toCountdownEventShape(featured) : null;
        const cardHtml = `
            <p class="home-event-kicker">${escapeHtml(featured.status === 'live' ? 'Live Now' : 'Next Event')}</p>
            <h2>${escapeHtml(featured.title)}</h2>
            <p class="home-event-meta">${escapeHtml(formatDate(featured.event_date))} · ${escapeHtml(featured.venue || 'Venue TBC')}</p>
            ${countdownShape && utils ? utils.renderCountdownMarkup(countdownShape) : ''}
            <a href="events.html#${escapeHtml(featured.id)}" class="btn btn-primary">View Event Details</a>
        `;

        let section = document.getElementById('home-next-event');
        if (!section) {
            section = document.createElement('section');
            section.id = 'home-next-event';
            section.className = 'home-event-countdown-section';
            section.innerHTML = '<div class="container"><div class="home-event-countdown-card"></div></div>';
            heroSection.insertAdjacentElement('afterend', section);
        }
        const card = section.querySelector('.home-event-countdown-card');
        if (!card) return;
        card.innerHTML = cardHtml;
        if (countdownShape && utils) utils.startCountdownTimer(card, countdownShape);
    }

    async function loadPublicGolfDays() {
        let client;
        try {
            client = await window.BirdieAuth.ensureClient();
        } catch (error) {
            // Preserve the static events fallback if Supabase is temporarily unavailable.
            console.error('Birdie public events: Supabase client unavailable, keeping static fallback:', error);
            return;
        }

        const today = todayInSouthAfrica();
        const baseColumns = 'id, game_number, title, venue, event_date, status, is_public';
        const richColumns = baseColumns + ', short_description, description, reporting_time, tee_off_time, green_fee, event_note, sponsor_name, prizes, poster_path, poster_alt, featured';

        async function queryPublicDays(columns) {
            const result = await client
                .from('golf_days')
                .select(columns)
                .eq('is_public', true)
                .or(`status.eq.live,and(status.eq.scheduled,event_date.gte.${today})`)
                .order('event_date', { ascending: true, nullsFirst: false });
            if (result.error) throw result.error;
            return result.data || [];
        }

        let days;
        try {
            days = await queryPublicDays(richColumns);
        } catch (richError) {
            // The rich presentation columns may not exist yet if this
            // migration hasn't been applied to the live project. Fall back
            // to the base-schema columns so the public list still works.
            console.error('Birdie public events: rich event query failed, retrying with base columns only:', richError);
            try {
                days = await queryPublicDays(baseColumns);
            } catch (baseError) {
                console.error('Birdie public events load failed entirely, keeping static fallback:', baseError);
                return;
            }
        }

        if (!days.length) return; // preserve the static fallback content

        const posterUrlByPath = {};
        for (const day of days) {
            if (day.poster_path && !(day.poster_path in posterUrlByPath)) {
                posterUrlByPath[day.poster_path] = await getPosterUrl(client, day.poster_path);
            }
        }

        renderPublicDays(days, posterUrlByPath);
        renderFeaturedSection(days, posterUrlByPath);
        updateHomepageNextEvent(days, posterUrlByPath);
    }

    document.addEventListener('DOMContentLoaded', function () {
        window.setTimeout(loadPublicGolfDays, 0);
    });
})();
