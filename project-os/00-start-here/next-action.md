# Next Action

## Current Objective
Move Birdie Squad from a static website with prototype authentication to the smallest usable Supabase-backed golf-day prototype while preserving the current website and familiar club workflow.

## Execution Gate
Do not modify application source until the backend project and schema are deliberately established and verified. The database must reflect the supplied spreadsheet workflow rather than invented golf rules.

## Safest Next 7 Actions
1. Obtain explicit confirmation to create the dedicated Birdie Squad Supabase project in the connected Apprigate organisation at the quoted R0/month cost.
2. Create the project and verify it reaches a healthy state.
3. Create the MVP schema, grants, constraints, indexes, RLS policies, and Realtime configuration; then run Supabase security/performance advisors and fix material findings.
4. Seed/import the minimum useful club data from the supplied spreadsheet: member roster, current handicap reference where reliable, and one historical golf-day validation dataset.
5. Validate that the database reproduces the historical spreadsheet ranking before building UI around it.
6. Replace the prototype hard-coded login and connect the existing static site to Supabase using only the project URL and publishable browser key.
7. Build and test the Events calendar, member-only golf-day view, scorer capture screen, digital scorecard, and live leaderboard on the feature branch; deploy only to preview until reviewed.

## Exact MVP User Journeys
### Public visitor
- Browse existing public website.
- View basic upcoming events.
- Login remains available.

### Logged-in member
- Sign in with real Supabase Auth credentials.
- See additional golf-day/event actions.
- Open current/live golf day.
- View live leaderboard.
- Open a player's digital scorecard.
- Cannot change scores.

### Scorer / management / admin
- Sign in.
- Open/create a golf day.
- Select participating players from the existing club roster.
- Capture/update scores from a phone with minimal taps.
- See totals and ranking update automatically.
- Finalise a golf day when scoring is complete.

## UX Rule
The scorer screen must feel like a simplified digital continuation of the current Excel process. Prioritise names, game number/title, venue, date, handicap reference, scores, totals, and position. Do not require golf-software training.

## Do Not Do Yet
- Do not rebuild in Next.js/React or change framework.
- Do not redesign the public website.
- Do not automate complex handicap/differential rules.
- Do not build Order of Merit/Admin Points/statistics/GPS/social/tournament/watch features.
- Do not expose Supabase secret/service-role credentials.
- Do not merge to `main` or deploy to production before preview validation.
- Do not add abstractions or dependencies unless required for the approved MVP.

## Definition of Done for MVP
The prototype is done when a scorer can capture a golf day from a phone; a second logged-in member can watch the leaderboard change; an individual player scorecard can be opened; the historical validation game ranks in the same order as the supplied spreadsheet; and the existing public website remains functional.
