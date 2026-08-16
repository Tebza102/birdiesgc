// Focused, framework-free regression checks for the mobile Events / Member
// Golf Hub fix (project-os/10-prompts/claude-mobile-responsive-golf-hub.md).
//
// There is no browser/devtools automation available in this environment, so
// this cannot replace an actual real-device check at 320/360/375/390/430px.
// What it CAN do, deterministically, without a browser:
//   1. Assert the specific CSS rules the fix depends on are actually present
//      (so a future edit can't silently reintroduce the forced 1320px score
//      grid, the stacked mobile gutters, or an unreadable header again).
//   2. Do the same cell-width arithmetic a human would do with devtools —
//      given the mobile player-sticky width and score-input width/padding
//      pulled directly out of the real CSS, prove that at least two hole
//      cells fit beside the player identity at 360px and 375px viewports
//      under a documented, conservative gutter/card-padding assumption.
//
// Run with: node scripts/test-mobile-css.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const styleCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
const mvpCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'mvp.css'), 'utf8');
const birdieMvpJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'birdie-mvp.js'), 'utf8');

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

function extractMobileBlock(css, maxWidthPx) {
    const marker = '@media (max-width: ' + maxWidthPx + 'px)';
    const start = css.indexOf(marker);
    assert.ok(start !== -1, 'could not find "' + marker + '" in the stylesheet');
    // Walk brace depth from the block's opening "{" to find its matching "}".
    let depth = 0;
    let i = css.indexOf('{', start);
    const blockStart = i;
    for (; i < css.length; i += 1) {
        if (css[i] === '{') depth += 1;
        else if (css[i] === '}') {
            depth -= 1;
            if (depth === 0) break;
        }
    }
    return css.slice(blockStart, i + 1);
}

function firstNumber(text, propertyPattern) {
    const match = propertyPattern.exec(text);
    assert.ok(match, 'could not find expected property in the extracted block');
    return parseFloat(match[1]);
}

const mobileHeader = extractMobileBlock(styleCss, 767);
const mobileHub = extractMobileBlock(mvpCss, 640);

test('mobile .container gutter is reduced, not stacked with a second section padding', function () {
    assert.match(mobileHeader, /\.container\s*\{[^}]*padding:\s*0\s*var\(--spacing-sm\)/);
    // The specific bug the review found: .member-golf-section (or .mvp-panel/
    // .mvp-day-detail as a page-gutter, not card-interior, rule) adding its
    // own left/right padding on top of .container's — must not reappear.
    assert.doesNotMatch(mobileHub, /\.member-golf-section,\s*\n\s*\.mvp-day-detail,\s*\n\s*\.mvp-panel\s*\{\s*\n\s*padding-left/);
});

test('mobile header is shorter and no longer the 80px desktop-derived logo', function () {
    assert.match(mobileHeader, /\.logo-img\s*\{[^}]*height:\s*(4\d|5\d|60)px/, 'expected a roughly 52-60px mobile logo height');
    assert.doesNotMatch(mobileHeader, /\.logo-img\s*\{[^}]*height:\s*80px/);
});

test('mobile header has an opaque/blurred background so it does not visually erase content while scrolling', function () {
    assert.match(mobileHeader, /\.header-container\s*\{[^}]*background-color:\s*rgba\(/);
    assert.match(mobileHeader, /\.header-container\s*\{[^}]*backdrop-filter:/);
});

test('mobile nav-mobile top offset was adjusted to match the shorter header', function () {
    assert.match(mobileHeader, /\.nav-mobile\s*\{[^}]*top:\s*\d+px/);
});

test('mobile hamburger bars keep a visible colour against the now-light header background', function () {
    assert.match(mobileHeader, /\.mobile-menu-btn span\s*\{[^}]*background-color:\s*var\(--primary-green\)/);
});

test('mobile leaderboard player-name cell allows wrapping instead of forcing nowrap', function () {
    assert.match(mobileHub, /\.mvp-leaderboard-table td:nth-child\(2\)[\s\S]*?white-space:\s*normal/);
});

test('mobile score grid no longer forces the desktop 1320px min-width', function () {
    assert.match(mobileHub, /\.mvp-score-grid\s*\{\s*\n\s*min-width:\s*0/);
});

test('mobile score grid drops the sticky Total column in favour of the player-cell echo', function () {
    assert.match(mobileHub, /\.mvp-total-sticky\s*\{\s*\n\s*display:\s*none/);
    assert.match(mobileHub, /\.mvp-player-mobile-total\s*\{[^}]*display:\s*block/);
});

test('js/birdie-mvp.js renders the mobile total echo and keeps it in sync on live updates', function () {
    assert.match(birdieMvpJs, /data-mobile-total-for="\$\{player\.id\}"/, 'expected the score grid row to render a mobile total echo per player');
    const liveUpdateMatch = /function applyScoreGridLiveUpdate\s*\(\)\s*\{[\s\S]*?\n {4}\}/.exec(birdieMvpJs);
    assert.ok(liveUpdateMatch, 'could not locate applyScoreGridLiveUpdate()');
    assert.match(liveUpdateMatch[0], /data-mobile-total-for/, 'applyScoreGridLiveUpdate() must also update the mobile total echo, not just the desktop one');
});

// --- Phone-width arithmetic, using the real numbers straight out of the CSS ---
//
// Assumption (documented, conservative — matches the actual markup):
// viewport width minus (container gutter * 2) minus (card padding * 2) minus
// borders leaves the width available to .mvp-score-grid-wrap. Container
// gutter = --spacing-sm = 16px; mobile card padding = --spacing-sm = 16px;
// borders ~2px. This is the same arithmetic a human would do with devtools.
const SPACING_SM_PX = 16;
const CARD_BORDER_PX = 2;

function availableScoreGridWidth(viewportPx) {
    return viewportPx - (SPACING_SM_PX * 2) - (SPACING_SM_PX * 2) - CARD_BORDER_PX;
}

function mobilePlayerStickyWidthPx() {
    return firstNumber(mobileHub, /\.mvp-player-sticky\s*\{[^}]*min-width:\s*(\d+)px/);
}

function mobileScoreInputCellWidthPx() {
    const inputWidth = firstNumber(mobileHub, /\.mvp-score-input\s*\{[^}]*width:\s*(\d+)px/);
    const cellPaddingMatch = /\.mvp-score-grid th,\s*\n\s*\.mvp-score-grid td\s*\{\s*\n\s*padding:\s*([\d.]+)rem\s+([\d.]+)rem/.exec(mobileHub);
    assert.ok(cellPaddingMatch, 'could not find mobile .mvp-score-grid cell padding');
    const horizontalPaddingRem = parseFloat(cellPaddingMatch[2]) * 2; // left + right
    const horizontalPaddingPx = horizontalPaddingRem * 16; // 1rem == 16px at the site's base font size
    return inputWidth + horizontalPaddingPx;
}

[320, 360, 375, 390, 400, 430].forEach(function (viewport) {
    test('at ' + viewport + 'px, at least two hole score cells fit beside the player identity', function () {
        const available = availableScoreGridWidth(viewport);
        const playerCol = mobilePlayerStickyWidthPx();
        const cellWidth = mobileScoreInputCellWidthPx();
        const remaining = available - playerCol;
        const visibleHoleCells = Math.floor(remaining / cellWidth);
        assert.ok(
            visibleHoleCells >= 2,
            'expected >= 2 visible hole cells at ' + viewport + 'px, got ' + visibleHoleCells +
            ' (available=' + available + 'px, player column=' + playerCol + 'px, cell=' + cellWidth + 'px)'
        );
    });
});

console.log('\nMobile Golf Hub CSS: ' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) {
    process.exitCode = 1;
}
