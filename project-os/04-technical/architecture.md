# Architecture

## Architecture Decision
For the prototype, preserve the existing static HTML/CSS/vanilla-JavaScript website. Do not rebuild the application in a new framework. Add Supabase as the managed backend for authentication, Postgres data, Row Level Security, and small-scale Realtime updates.

## Project Structure
Current public application remains rooted in static `.html` files with shared `css/style.css` and JavaScript in `js/`.

Expected MVP additions/changes should be minimal and may include:
- Supabase browser configuration/client module.
- Authentication integration replacing the hard-coded credential array.
- Golf-day member/live view.
- Scorer/admin golf-day capture view.
- Existing Events page enhanced rather than replaced.
- Existing stylesheet extended with MVP-specific components.

Before creating any new file, search for an existing equivalent and reuse it where practical.

## Frontend
- Framework: none; existing static HTML.
- Language: vanilla JavaScript.
- Styling: existing custom CSS and Birdie Squad design system.
- State: small local UI state only; persistent business data belongs in Supabase.
- Auth session: Supabase Auth client session, not custom `localStorage` role records.
- Mobile priority: scorer capture and live leaderboard must work comfortably on a phone.

## Backend
- Managed service: Supabase.
- Database: Supabase Postgres.
- Authentication: Supabase Auth.
- Data API: Supabase client/Data API using browser-safe publishable key.
- Server functions: none required for first MVP unless a verified security/business requirement cannot be solved safely with Postgres/RLS.
- Realtime: Supabase Realtime Postgres Changes for prototype-scale score/leaderboard refresh.

## Database
Core entities:
- `members`: club roster imported from the spreadsheet; membership does not require a login account.
- `profiles`: authenticated website users and their application role; may link to a member.
- `courses`: minimal reusable course identity.
- `course_holes`: hole number, par, optional stroke index for a course.
- `golf_days`: the digital equivalent of a spreadsheet Game row/event.
- `golf_day_players`: participating players and handicap snapshot for that golf day.
- `hole_scores`: one player's score per hole with audit fields.

Do not create tables for advanced features until needed.

## Data Flow
### Score capture
Scorer opens golf day → selects player/hole → enters strokes → validated row is inserted/updated in `hole_scores` → totals/holes-completed are recalculated → leaderboard UI refreshes → subscribed members see the new ordering.

### Events
Public user sees basic published event information. Authenticated members receive additional golf-day actions and live scoring access where available.

### Spreadsheet migration
The spreadsheet is a source/reference, not the permanent database. Import only the roster/current handicap reference and a controlled historical validation set needed for MVP acceptance. Preserve original Excel source outside runtime code.

## Authentication and Authorization
Authentication proves identity; RLS authorises data access.
- Public: basic published events only.
- Member: read live golf-day information and scorecards.
- Scorer: member access plus score-entry/update permissions.
- Management/Admin: scorer permissions plus golf-day/event administration required by MVP.

Never trust a browser-hidden button as access control. Never use user-editable metadata for authorisation. Never expose a Supabase secret/service-role key in the frontend.

## Leaderboard Calculation
First MVP must reproduce the club's currently validated scoring/ranking process. Do not invent handicap mathematics. Ranking validation begins with the historical spreadsheet result. Hole-by-hole strokes sum into total score; ranking logic follows the club's confirmed MVP rule. Any later net/Stableford/handicap logic requires a separate approved change.

## Realtime
Use the simplest appropriate Realtime mechanism for prototype scale. Subscribe only to required scoring/golf-day tables or rows. Do not build a custom WebSocket service.

## Deployment
- Hosting: preserve Vercel static deployment.
- Development/feature branch: `agent/supabase-golf-day-mvp`.
- Production branch: `main` remains untouched until review/approval.
- Existing DNS/email records are outside this feature's scope and must not be changed.

## Security
- Enable RLS on every exposed public-schema table.
- Grant only required privileges to `anon` and `authenticated`.
- Browser receives project URL + publishable key only.
- Role-based write access must be enforced in database policies.
- Run Supabase security and performance advisors after schema work.

## Key Risks
- Recreating Excel rather than simplifying its workflow.
- Automating unverified golf rules.
- Hard-coded/weak role checks.
- Building advanced features before club validation.
- Excessive redesign that creates adoption shock.
- Breaking the current public site while adding member features.

## Agent Notes
Read `project-os/10-prompts/birdie-golf-day-mvp-master-build-prompt.md` before implementation. The prompt is the MVP scope contract; deviations require explicit approval.