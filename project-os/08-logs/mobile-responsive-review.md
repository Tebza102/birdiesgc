# Mobile Responsiveness Review — 2026-08-16

Real-device screenshots exposed a usability regression on narrow screens in the Events / Member Golf Hub. The desktop layout is acceptable; the mobile failure is primarily responsive CSS rather than a golf-workflow or Supabase problem.

## Findings
- Nested mobile gutters shrink the usable Member Hub width too aggressively: global `.container` padding combines with additional `.member-golf-section` small-screen padding.
- The fixed mobile header/logo is too tall and visually overlays leaderboard/scorer content when scrolling.
- Leaderboard inherits `white-space: nowrap`, causing rigid/clipped rows on a phone.
- The scorer keeps a wide sticky player column plus sticky Total column while the score grid retains a very large desktop min-width. Inside the narrowed container, the two frozen columns can consume nearly the whole visible area and hide the hole inputs.
- Player names clip rather than wrap enough to remain identifiable.
- Mobile panel padding, borders/radii and section vertical spacing are heavier than needed for the available viewport.

## Required fix
See `project-os/10-prompts/claude-mobile-responsive-golf-hub.md` for the implementation and acceptance brief. Preserve the spreadsheet mental model and desktop layout; mobile must show player identity plus at least two hole inputs at 360–390px with horizontal scrolling contained inside the score grid only.
