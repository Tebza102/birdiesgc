// Focused, framework-free regression checks for rich event details +
// poster upload (project-os/10-prompts/claude-event-details-poster-media.md).
//
// There is no live Supabase project or browser available in this
// environment, so RLS/Storage-policy behaviour (member/scorer cannot edit
// event fields or upload/delete posters, public query only exposes
// eligible rows, etc.) is implemented and reviewable in
// supabase/migrations/20260816130000_event_details_and_poster.sql but not
// execute-tested here. What this script CAN prove deterministically:
//   - the ordinary Golf Hub loader still never selects the new columns
//     (the same migration-compatibility discipline established for Gate 2B)
//   - empty/absent presentation data produces no empty UI (no bare
//     "Sponsor:"/"Green Fee:" labels, no prize section for an empty array)
//   - a missing poster falls back to omitting the image, never a fake one
//   - the client-side poster type/size limits match what the migration
//     configures on the storage bucket itself (the real enforcement
//     boundary), so the two can't silently drift apart
//   - the presentation block and the edit-event form never bypass the
//     existing read-only-historical-round / admin-role gates
//   - the day-detail render still includes the leaderboard/scorer
//     alongside the new presentation block
//   - the calendar badge doesn't touch the calendar cell's own sizing
//
// Run with: node scripts/test-event-details.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const birdieMvpJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'birdie-mvp.js'), 'utf8');
const birdiePublicEventsJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'birdie-public-events.js'), 'utf8');
const migrationSql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20260816130000_event_details_and_poster.sql'), 'utf8');
const mvpCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'mvp.css'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const eventsHtml = fs.readFileSync(path.join(__dirname, '..', 'events.html'), 'utf8');
const mainJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const eventsDataJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'events-data.js'), 'utf8');

const TOP_LEVEL_HTML_FILES = [
    'index.html',
    'about.html',
    'contact.html',
    'events.html',
    'get-involved.html',
    'governance.html',
    'member-network.html',
    'programmes.html',
    'sponsors.html'
];

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

function extractFunction(source, name) {
    const match = new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n    \\}').exec(source);
    assert.ok(match, 'could not locate function ' + name + '() in the source');
    return match[0];
}

test('loadGolfDays() (the ordinary hub loader) still does not select any new event-details column', function () {
    const fn = extractFunction(birdieMvpJs, 'loadGolfDays');
    const selectMatch = /\.select\(\s*'([^']*)'\s*\)/.exec(fn);
    assert.ok(selectMatch, 'could not locate the .select(...) call inside loadGolfDays()');
    ['short_description', 'description', 'reporting_time', 'tee_off_time', 'green_fee', 'event_note', 'sponsor_name', 'prizes', 'poster_path', 'poster_alt', 'featured'].forEach(function (col) {
        assert.ok(!selectMatch[1].includes(col), 'loadGolfDays() must not select ' + col + ', or the ordinary hub breaks before this migration is applied');
    });
});

test('presentation-flag and presentation-detail loaders never throw on a missing migration', function () {
    const flags = extractFunction(birdieMvpJs, 'loadPresentationFlags');
    assert.match(flags, /try\s*\{[\s\S]*catch/, 'loadPresentationFlags() must catch its own errors');
    const detail = extractFunction(birdieMvpJs, 'loadCurrentDayPresentation');
    assert.match(detail, /try\s*\{[\s\S]*catch/, 'loadCurrentDayPresentation() must catch its own errors');
});

test('createGolfDay() falls back to a base-only insert if the promo-field insert fails (migration not applied yet)', function () {
    const fn = extractFunction(birdieMvpJs, 'createGolfDay');
    assert.match(fn, /insert\(Object\.assign\(\{\}, basePayload, promo\)\)/);
    assert.match(fn, /if \(result\.error\) \{[\s\S]*?insert\(basePayload\)/, 'expected a retry with basePayload only when the promo-field insert fails');
});

test('the presentation block renders nothing when there is no presentation data at all', function () {
    const fn = extractFunction(birdieMvpJs, 'renderPresentationBlock');
    assert.match(fn, /if \(!info\) return '';/);
    assert.match(fn, /if \(!hasAny\) return '';/);
});

test('empty/null individual fields never produce bare "Label:" UI (guarded, not unconditional)', function () {
    const fn = extractFunction(birdieMvpJs, 'renderPresentationBlock');
    // Each optional meta line must be pushed only inside an `if (info.<field>)` guard.
    ['reporting_time', 'tee_off_time', 'green_fee', 'sponsor_name', 'event_note'].forEach(function (field) {
        const guarded = new RegExp('if \\(info\\.' + field + '\\) metaRows\\.push');
        assert.match(fn, guarded, 'expected ' + field + ' to be guarded before rendering its label');
    });
});

test('an empty prizes array renders no prize section (mvp-mvp.js and the public page agree)', function () {
    const mvpFn = extractFunction(birdieMvpJs, 'renderPresentationBlock');
    assert.match(mvpFn, /Array\.isArray\(info\.prizes\) && info\.prizes\.length/);
    const publicFn = extractFunction(birdiePublicEventsJs, 'renderPrizesHtml');
    assert.match(publicFn, /if \(!Array\.isArray\(prizes\) \|\| !prizes\.length\) return '';/);
});

test('a golf day with no poster omits the image entirely rather than showing a fallback/placeholder photo', function () {
    const featured = extractFunction(birdiePublicEventsJs, 'renderFeaturedCard');
    assert.match(featured, /const mediaHtml = posterUrl\s*\n\s*\?/, 'expected the media block to be conditional on posterUrl');
    assert.doesNotMatch(featured, /images\/events\//, 'must not fall back to an unrelated static event photo');
});

test('client-side poster type/size limits match the storage bucket configured by the migration', function () {
    const sizeMatch = /POSTER_MAX_BYTES = (\d+) \* 1024 \* 1024/.exec(birdieMvpJs);
    assert.ok(sizeMatch, 'could not find POSTER_MAX_BYTES in js/birdie-mvp.js');
    const clientMaxBytes = Number(sizeMatch[1]) * 1024 * 1024;

    const bucketMatch = /file_size_limit\s*=\s*excluded\.file_size_limit/.test(migrationSql);
    assert.ok(bucketMatch, 'expected the migration to configure file_size_limit on the event-posters bucket');
    const limitValueMatch = /values \('event-posters', 'event-posters', true, (\d+),/.exec(migrationSql);
    assert.ok(limitValueMatch, 'could not find the numeric file_size_limit value in the migration');
    assert.equal(Number(limitValueMatch[1]), clientMaxBytes, 'the bucket file_size_limit must match POSTER_MAX_BYTES so the client gives a friendly error before the server would reject it anyway');

    ['image/jpeg', 'image/png', 'image/webp'].forEach(function (mime) {
        assert.ok(birdieMvpJs.includes("'" + mime + "'"), 'js/birdie-mvp.js must accept ' + mime);
        assert.ok(migrationSql.includes("'" + mime + "'"), 'the migration bucket must allow ' + mime);
    });
});

test('poster writes/deletes are restricted to approved admin/management in the migration, not just the client', function () {
    ['event_posters_admin_insert', 'event_posters_admin_update', 'event_posters_admin_delete'].forEach(function (policy) {
        const policyBlock = new RegExp('create policy ' + policy + '[\\s\\S]*?;').exec(migrationSql);
        assert.ok(policyBlock, 'expected a ' + policy + ' policy in the migration');
        assert.match(policyBlock[0], /role in \('admin', 'management'\)/);
        assert.match(policyBlock[0], /approved = true/);
    });
    const readPolicy = /create policy event_posters_public_read[\s\S]*?;/.exec(migrationSql);
    assert.ok(readPolicy, 'expected a public read policy for event-posters');
    assert.match(readPolicy[0], /to public/);
});

test('golf_days write RLS is untouched — no new insert/update/delete policy loosens it beyond the existing admin/management gate', function () {
    assert.doesNotMatch(migrationSql, /create policy[\s\S]*?on public\.golf_days/, 'this migration must not add any new golf_days RLS policy; the existing admin/management write policies already cover the new columns');
});

test('the edit-event form and the promo fields it shares with create respect the read-only-historical and admin-role gates', function () {
    const fn = extractFunction(birdieMvpJs, 'renderEditEventForm');
    assert.match(fn, /if \(isReadOnlyHistoricalDay\(day\)\) return '';/);
    assert.match(fn, /if \(!BirdieAuth\.getProfile\(\) \|\| !canManageGolfDays\(BirdieAuth\.getProfile\(\)\.role\)\) return '';/);
});

test('day detail still renders the leaderboard and score grid alongside the new presentation block', function () {
    const fn = extractFunction(birdieMvpJs, 'renderDayDetail');
    assert.match(fn, /renderPresentationBlock\(\)/);
    assert.match(fn, /renderLeaderboard\(\)/);
    assert.match(fn, /renderScoreGrid\(day\)/);
});

test('the calendar presentation badge is a CSS ::after marker, not extra DOM that could grow the compact cell', function () {
    assert.match(mvpCss, /\.mvp-calendar-event\.has-presentation::after\s*\{/, 'expected a ::after-based badge, not additional cell markup');
    // The underlying calendar cell/button sizing rules must be unchanged by this pass.
    assert.match(mvpCss, /\.mvp-calendar-cell\s*\{\s*\n\s*min-height:\s*72px/);
});

test('the poster image and prize rows stay width-bound on mobile (no fixed-width element that could force page scroll)', function () {
    assert.match(mvpCss, /\.mvp-event-poster\s*\{\s*\n\s*display:\s*block;\s*\n\s*width:\s*100%/);
    assert.doesNotMatch(mvpCss, /\.mvp-event-poster\s*\{[^}]*width:\s*\d+px/);
    const mobileBlock = /@media \(max-width: 640px\) \{[\s\S]*$/.exec(mvpCss);
    assert.ok(mobileBlock, 'could not find the mobile media query block');
    assert.match(mobileBlock[0], /\.mvp-prize-row\s*\{\s*\n\s*grid-template-columns:\s*1fr;/, 'expected prize rows to stack to a single column on mobile');
});

// Signatures of the specific obsolete World Cup-era popup found live in
// production (project-os/10-prompts/claude-remove-popup-everywhere-production-cache.md):
// a homepage-only "Bafana Bafana" announcement popup, JS-injected into
// document.body, gated by a sessionStorage key, shown after a timer. This
// deliberately does not ban the generic word "modal", since the real
// auth-modal login modal must remain legal.
const OBSOLETE_POPUP_SIGNATURES = [
    /event-popup/i,
    /initHomepageAnnouncementPopup/i,
    /bafana/i,
    /world[\s-]?cup/i,
    /birdiesgc_bafana_support_popup_closed/i,
    /Birdie-SGC-Bafana-Support-Poster/i
];

test('the legacy World Cup-era automatic poster popup is fully removed from every top-level page and shared asset, while the new event-poster system remains', function () {
    assert.doesNotMatch(mvpCss, /\.event-popup/i, 'expected no .event-popup* CSS left in mvp.css');
    assert.doesNotMatch(eventsDataJs, /event-popup/i, 'expected no event-popup reference in events-data.js');
    assert.doesNotMatch(birdieMvpJs, /event-popup/i, 'expected no event-popup trigger in birdie-mvp.js');
    assert.doesNotMatch(birdiePublicEventsJs, /event-popup/i, 'expected no event-popup trigger in birdie-public-events.js');
    for (const sig of OBSOLETE_POPUP_SIGNATURES) {
        assert.doesNotMatch(styleCss, sig, 'found ' + sig + ' in css/style.css');
        assert.doesNotMatch(mainJs, sig, 'found ' + sig + ' in js/main.js');
    }
    for (const file of TOP_LEVEL_HTML_FILES) {
        const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
        for (const sig of OBSOLETE_POPUP_SIGNATURES) {
            assert.doesNotMatch(html, sig, 'found ' + sig + ' in ' + file);
        }
    }
    // The new Supabase-backed poster system must still be present.
    assert.match(migrationSql, /event-posters/);
    assert.match(mvpCss, /\.mvp-event-poster\s*\{/);
    assert.match(birdiePublicEventsJs, /Featured/i);
});

test('every top-level page loads the cache-busted shared style.css and main.js (forces browsers off any stale cached popup asset)', function () {
    for (const file of TOP_LEVEL_HTML_FILES) {
        const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
        assert.match(html, /href="css\/style\.css\?v=[^"]+"/, file + ' does not load a cache-busted css/style.css');
        assert.match(html, /src="js\/main\.js\?v=[^"]+"/, file + ' does not load a cache-busted js/main.js');
    }
    assert.match(indexHtml, /src="js\/events-data\.js\?v=[^"]+"/, 'index.html does not load a cache-busted js/events-data.js');
    assert.match(eventsHtml, /src="js\/events-data\.js\?v=[^"]+"/, 'events.html does not load a cache-busted js/events-data.js');
    assert.match(eventsHtml, /href="css\/mvp\.css\?v=[^"]+"/, 'events.html does not load a cache-busted css/mvp.css');
    assert.match(eventsHtml, /src="js\/birdie-mvp\.js\?v=[^"]+"/, 'events.html does not load a cache-busted js/birdie-mvp.js');
    assert.match(eventsHtml, /src="js\/birdie-public-events\.js\?v=[^"]+"/, 'events.html does not load a cache-busted js/birdie-public-events.js');
});

test('vercel.json sets a revalidation Cache-Control header on HTML routes', function () {
    const vercelJson = fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8');
    assert.match(vercelJson, /must-revalidate/);
});

console.log('\nEvent details / poster: ' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) {
    process.exitCode = 1;
}
