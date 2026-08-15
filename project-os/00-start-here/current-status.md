# Current Status

## Summary
Birdie Squad is currently a working static public website that is being prepared for a tightly scoped golf-day MVP. The public site must be preserved. The MVP will add Supabase-backed authentication, events, a digital scorecard, scorer-controlled score entry, and a live leaderboard without rebuilding the site or attempting to clone Golf GameBook.

## What Exists
- Static HTML/CSS/vanilla JavaScript website.
- Custom Node development server on port 4173.
- Vercel static deployment configuration.
- Public pages including Home, About, Club Activities, Member Network, Partnerships, Governance, Contact, Get Involved, and Events.
- Static events data and event countdown functionality.
- Prototype login UI in `js/main.js` using hard-coded credentials and browser `localStorage`.
- Existing Birdie Squad spreadsheet workflow supplied by the club, including member/player names, current handicaps, game scores, rankings, differentials, history, and Order of Merit logic.
- Project OS structure and agent-control rules.

## What Works
- Public static site navigation and content.
- Existing responsive styling and Birdie Squad branding.
- Static event display/countdown.
- Prototype login UI flow, but it is not secure and must not be treated as production authentication.
- Existing spreadsheet ranks final game results from lowest to highest and provides the club's familiar operational reference.

## What Is Incomplete
- No production backend.
- No production database.
- No real authentication provider.
- No secure protected member/admin area.
- No digital golf-day data model.
- No hole-by-hole score capture.
- No automatic live leaderboard.
- No live digital player scorecard.
- Events are still maintained in static JavaScript rather than a database.
- Contact enquiries are not persisted.

## Approved MVP Outcome
The first usable prototype must support this exact journey:
1. A real user signs in.
2. A member sees additional event/golf-day features after login.
3. The Events page shows a simple upcoming-events calendar.
4. An authorised scorer/admin opens a golf day and selects participating members.
5. One designated scorer captures scores using a mobile-friendly interface.
6. The system calculates totals and rankings automatically.
7. Logged-in members can see the live leaderboard remotely.
8. A member can open an individual player's digital scorecard.
9. A historical result imported from the supplied spreadsheet reproduces the spreadsheet's ranking as an acceptance test.

## Scope Lock: Not Part of MVP
Do not build GPS, maps/course tracking, automatic handicap adjustment, handicap differential automation, Admin Points, Order of Merit automation, personal statistics, friends/social feeds, messaging, Ryder Cup formats, multi-round tournaments, smartwatch features, payments, sponsor dashboards, or a general CRM.

## UX Non-Negotiable
The scorer must immediately recognise the workflow from the existing spreadsheet. Do not introduce a complex golf-management interface. Preserve familiar concepts: Game/Golf Day, Venue, Date, Player, Handicap, Score, Position. Make the mobile workflow obvious without training.

## Current Blocker
A new dedicated Supabase project is not yet created. Supabase reports that a new project in the connected Apprigate organisation currently costs R0/month. Creation requires explicit user confirmation before proceeding.

## Known Risks
- Existing hard-coded credentials are public and must be removed from production use.
- Role enforcement must happen through Supabase Auth/RLS, not browser-only hiding.
- Supabase secret/service-role keys must never be exposed in the static frontend.
- Do not blindly reproduce complex handicap formulas before the club validates the MVP.
- Do not migrate every Excel sheet; migrate the workflow, roster, current handicap reference, and validation data needed for the MVP.
- Realtime must remain simple and appropriate for prototype scale.

## What Needs Validation
- Supabase project creation and health.
- Database schema and RLS policies.
- Real authentication and role enforcement.
- Mobile scorer workflow.
- Historical spreadsheet ranking parity.
- Live leaderboard updates in a second logged-in session.
- Events calendar and member-only event enhancements.
- Vercel preview deployment before production merge.

## Last Updated
2026-08-15 — ChatGPT/GitHub/Supabase audit and MVP planning. No application source code changed in this planning step.