# DEV MODE — Claude Instruction: Mobile Responsive Golf Hub / Scorecard Fix

## Objective
Fix the mobile responsiveness problems visible in the latest real-device screenshots of the Birdie Squad Events / Member Golf Hub, without changing the scoring workflow, Supabase architecture, desktop UX, or golf rules.

Work only on `agent/supabase-golf-day-mvp`. Read the current Project OS and PR #1 state first. Inspect the current `css/style.css`, `css/mvp.css`, `events.html`, and scorer/leaderboard rendering in `js/birdie-mvp.js` before editing. Do not merge to `main`. Do not stop for routine questions.

## What the real phone screenshots show
On a narrow phone viewport:
1. The Member Golf Hub / day detail sits inside too many nested gutters and card paddings, leaving an unnecessarily narrow content column and oversized empty side space.
2. The fixed mobile header/logo overlays the leaderboard/score sheet while scrolling; the mobile logo/header are too tall for a utility/admin screen.
3. The leaderboard is rigid and horizontally clipped because table cells inherit `white-space: nowrap` and the action column adds more width than the phone can afford.
4. The live score grid is effectively unusable on a small screen: the current mobile player sticky column is ~168px and total sticky column ~70px. Inside the already-narrow nested container these two frozen columns consume almost the entire viewport, so no score-entry hole cells are visible.
5. Player names are clipped rather than wrapping/remaining identifiable.
6. Panels/cards/borders are visually heavy on mobile and section vertical spacing is excessive relative to the viewport.

## Root causes already identified in current CSS
- Global `.container` uses `padding: 0 var(--spacing-md)` (24px each side).
- The current `@media (max-width: 640px)` in `mvp.css` also adds left/right padding to `.member-golf-section`, producing nested/double gutters.
- `.mvp-panel` / `.mvp-day-detail` retain large desktop vertical padding and card treatment.
- `.mvp-score-grid` has desktop `min-width: 1320px`.
- Mobile `.mvp-player-sticky` is still 168px; `.mvp-total-sticky` remains 70px and sticky.
- Score inputs are 52px on mobile.
- Leaderboard cells use `white-space: nowrap` globally.
- Mobile header logo is 80px and the header remains fixed/transparent, so it visually sits over the report when scrolling.

## Required mobile outcome
Target real phone widths of 320, 360, 375, 390, 400, and 430 CSS px.

### A. Page/container behaviour
- No page-level horizontal scrolling.
- Keep normal mobile side gutters around 12–16px, not stacked 24px + 16px nested padding.
- Reduce unnecessary top/bottom padding and gaps in the Events, Member Golf Hub, import panel, day detail, and report areas on narrow screens.
- Reduce mobile card/panel padding and radius where useful; keep the premium visual language but avoid a card-inside-card-inside-card feel.
- The admin import panel, calendar, day list, day hero, add-player controls, leaderboard and score sheet must all fit the viewport.
- Desktop/tablet layout at >= 900px should remain visually unchanged unless a tiny consistency adjustment is required.

### B. Mobile fixed header
- Make the mobile header materially more compact (rough target logo 52–60px, smaller header vertical padding).
- Prevent the logo/header from visually covering the report/scorecard while scrolling. A compact opaque/translucent/blurred mobile header is acceptable.
- Hamburger/login/logout controls must remain visible and accessible against the mobile header background.
- Adjust mobile-nav top offset to match the new header height.
- Do not redesign the desktop header.

### C. Leaderboard / live report
At 360–390px, a member should be able to understand the leaderboard without horizontal page scrolling:
- Keep the core information visible: `POS | PLAYER | THRU | TOTAL/Score`.
- Player names may wrap to two lines; do not truncate names beyond recognition.
- Avoid global nowrap on the player/action cells at mobile widths.
- Keep individual scorecard access. If the current fifth `View card` column makes the table too wide, move/stack/compact that action in a mobile-safe way rather than deleting the capability.
- A small internal table scroll is acceptable only as a last fallback on ~320px; 360px+ should fit the core leaderboard cleanly.

### D. Live Score Sheet — highest priority
Keep the club's spreadsheet-familiar model: players vertically, holes horizontally. Do NOT redesign it into a generic golf app.

On a 360–390px viewport:
- The player's name must remain clearly identifiable while scoring. Wrap to two lines if needed; do not clip names.
- At least **two hole score-entry cells must be visible beside the player identity** without the user first zooming or rotating the phone. More is better.
- Hole columns must horizontally scroll smoothly with touch inside `.mvp-score-grid-wrap`; the whole page must not scroll sideways.
- Keep the player column sticky/frozen on the left because this preserves the spreadsheet mental model.
- The current sticky Total column must not consume the remaining viewport. You may make the Total column non-sticky on narrow screens, shrink it significantly, or echo the live total inside the sticky player cell for mobile while leaving the desktop Total column intact. Choose the smallest robust implementation.
- If a mobile total is echoed in the player cell, ensure `applyScoreGridLiveUpdate()` updates it in place along with the desktop total and does not re-render inputs or lose focus/scroll position.
- Score inputs must remain comfortably tappable (minimum practical target around 42–44px square) but should not be oversized.
- Keep the current lightweight save/Realtime behaviour and visual saved/error states.
- Sticky header/player layering must not cover inputs incorrectly.

### E. Individual digital scorecard
- Ensure the individual 18-hole scorecard fits a phone naturally (for example a compact 3–6 column wrapped grid depending on viewport) with no page-level overflow.
- Keep hole number and score legible.

### F. Calendar/import/admin controls
- Make file input / Preview Import / Import controls responsive and full-width/stacked where appropriate.
- Add-player select/button and round-status controls should not overflow or leave large empty gaps.
- Calendar must stay usable without microscopic text or horizontal overflow.

## Do not change
- No framework migration.
- No Supabase schema/RLS/scoring changes.
- No handicap/net/Stableford logic.
- No change to imported historical read-only rules.
- No deletion of leaderboard, individual scorecards, realtime, or Excel import capabilities.
- Do not merge to `main`.

## Implementation preference
Prefer CSS breakpoint fixes and small, targeted markup/JS changes only where CSS alone cannot provide a usable score sheet. Avoid adding a new UI framework or large responsive library.

It is acceptable to add a narrowly scoped mobile CSS section/file if that keeps risk low, but avoid duplicate/conflicting rules. If adding a new stylesheet, make sure load order is deterministic and document why.

## Acceptance checks
Test at 320px, 360px, 375px, 390px/400px and desktop >= 1024px if browser/devtools are available.

At minimum prove:
1. `document.documentElement.scrollWidth <= document.documentElement.clientWidth` on the Events page at mobile widths (no page-level horizontal overflow).
2. Member Hub normal load works.
3. Mobile leaderboard shows core Pos/Player/Thru/Total information and player names remain identifiable.
4. Mobile scorer shows player identity plus at least two hole inputs at 360–390px.
5. Horizontal scrolling happens inside the score-grid wrapper only.
6. Score input focus/scroll position survives saves as before.
7. Mobile fixed header no longer obscures the scorer/leaderboard in a visually disruptive way.
8. Individual scorecard is readable on mobile.
9. Import panel and add-player controls fit mobile.
10. Desktop layout is not regressed.

Run the existing full validation suite:
- `node --check` on shipped JS/scripts
- legacy import unit tests
- secret scan
- `npm run build`
- local server smoke test
- GitHub Actions `Birdie MVP Check`

If practical, add a small deterministic responsive regression test or browser assertion for page-level overflow / required mobile scorer width, but do not introduce a heavy testing framework only for this.

Update Project OS/change log and PR #1 with the mobile acceptance details and what was changed. Keep PR #1 open and unmerged.
