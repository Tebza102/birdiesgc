// Regression check for the production hotfix
// (project-os/10-prompts/claude-remove-popup-everywhere-production-cache.md).
//
// This scans every top-level HTML page plus the two shared static assets
// (css/style.css, js/main.js) that every page loads, and js/events-data.js
// where it is loaded, for the obsolete World Cup-era "Bafana Bafana
// support" announcement popup and any equivalent implementation. It does
// NOT ban the word "modal" globally, because the real login modal
// (auth-modal in the Supabase MVP line, not present on this static
// production line) must remain legal elsewhere.
//
// Run with: node scripts/test-no-legacy-popup.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const TOP_LEVEL_HTML = [
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

const styleCss = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
const mainJs = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
const eventsDataJs = fs.readFileSync(path.join(ROOT, 'js', 'events-data.js'), 'utf8');

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
        console.error('    ' + error.message);
    }
}

// Signatures of the specific obsolete popup implementation found live in
// production (a homepage-only announcement popup, JS-injected into
// document.body, gated by a sessionStorage key, shown after a timer),
// plus the generic class-name family it used.
const OBSOLETE_SIGNATURES = [
    /event-popup/i,
    /initHomepageAnnouncementPopup/i,
    /bafana/i,
    /world[\s-]?cup/i,
    /birdiesgc_bafana_support_popup_closed/i,
    /Birdie-SGC-Bafana-Support-Poster/i
];

test('css/style.css contains no obsolete popup rules', function () {
    for (const sig of OBSOLETE_SIGNATURES) {
        assert.doesNotMatch(styleCss, sig, 'found ' + sig + ' in css/style.css');
    }
});

test('js/main.js contains no obsolete popup trigger, timer, or storage key', function () {
    for (const sig of OBSOLETE_SIGNATURES) {
        assert.doesNotMatch(mainJs, sig, 'found ' + sig + ' in js/main.js');
    }
    // Defensive: no code anywhere in the shared script should build a
    // full-screen overlay and append it to document.body from a
    // setTimeout/sessionStorage-gated homepage-only path.
    assert.doesNotMatch(
        mainJs,
        /sessionStorage\.[gs]etItem\([^)]*popup/i,
        'found a sessionStorage popup-dismissal key'
    );
});

test('js/events-data.js contains no obsolete popup reference', function () {
    for (const sig of OBSOLETE_SIGNATURES) {
        assert.doesNotMatch(eventsDataJs, sig, 'found ' + sig + ' in js/events-data.js');
    }
});

for (const file of TOP_LEVEL_HTML) {
    test(file + ' contains no obsolete popup markup/reference', function () {
        const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
        for (const sig of OBSOLETE_SIGNATURES) {
            assert.doesNotMatch(html, sig, 'found ' + sig + ' in ' + file);
        }
    });
}

test('every top-level page loads the cache-busted shared style.css and main.js', function () {
    for (const file of TOP_LEVEL_HTML) {
        const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
        assert.match(
            html,
            /href="css\/style\.css\?v=[^"]+"/,
            file + ' does not load a cache-busted css/style.css'
        );
        assert.match(
            html,
            /src="js\/main\.js\?v=[^"]+"/,
            file + ' does not load a cache-busted js/main.js'
        );
    }
});

test('index.html and events.html load a cache-busted js/events-data.js', function () {
    for (const file of ['index.html', 'events.html']) {
        const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
        assert.match(
            html,
            /src="js\/events-data\.js\?v=[^"]+"/,
            file + ' does not load a cache-busted js/events-data.js'
        );
    }
});

test('vercel.json sets a revalidation Cache-Control header on HTML routes', function () {
    const vercelJson = fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8');
    assert.match(vercelJson, /must-revalidate/);
});

console.log('\nProduction legacy-popup removal: ' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) {
    process.exitCode = 1;
}
