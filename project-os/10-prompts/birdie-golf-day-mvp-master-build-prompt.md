# Birdie Squad Golf Day MVP — Master Build Contract

## Mission
Build the smallest usable Birdie Squad golf-day platform that replaces the club's current paper-scorecard + Excel-consolidation workflow with a familiar digital process.

The prototype must be suitable for the club to test for several months. It is not a Golf GameBook clone and it is not a full golf-management SaaS product.

The central outcome is:

**One authorised scorer captures scores → the platform calculates/consolidates → logged-in members can follow the live leaderboard and individual digital scorecards from anywhere.**

## Non-Negotiable Operating Method
Do not begin application-source implementation by guessing.

Before each implementation phase:
1. Read all required Project OS files and this contract.
2. Inspect the current code paths that already solve or resemble the task.
3. Inspect the supplied spreadsheet/workflow evidence relevant to the task.
4. State internally the smallest change that satisfies the requirement.
5. Identify dependencies, permissions, data flow, failure modes and acceptance test before editing.
6. Make the controlled change.
7. Test it immediately.
8. If the same issue survives two controlled attempts, stop changing code, return to diagnosis, inspect logs/evidence, and revise the plan. Never enter a random-fix loop.

The purpose is high first-pass quality with minimal user intervention.

## Existing System to Preserve
Repository: `Tebza102/birdiesgc`.

Existing application:
- Static HTML/CSS/vanilla JavaScript.
- Vercel static hosting configuration.
- Existing Birdie Squad visual identity and public pages.
- Events page and static event rendering.
- Existing login modal UI, currently backed by insecure hard-coded credentials.

Do not rebuild the site in Next.js, React, Vue, Svelte or another framework for this prototype.
Do not redesign unrelated pages.
Do not alter DNS/email infrastructure.

## Source of Truth for User Behaviour
The club already uses a paper scorecard and an Excel workbook. The new interface must feel like a simplification of that workflow, not a foreign golf application.

Use familiar operational language prominently:
- Game / Golf Day
- Venue
- Date
- Player
- Handicap
- Hole
- Score
- Total
- Position

A scorer familiar with the spreadsheet should understand the screen without training documentation.

## Golf GameBook Reference Rule
Golf GameBook screenshots/concepts are product references only. Borrow the following concepts:
1. Simple digital scorecard.
2. Real-time leaderboard.
3. Ability to follow a game remotely.
4. One scorer/marker may record scores for the group/field.

Do not copy the product's branding, layouts or proprietary visual assets. Do not implement its advanced feature set.

## MVP Scope
### 1. Real Authentication
Replace the hard-coded credential comparison and custom localStorage auth session with Supabase Auth.

Required roles:
- member
- scorer
- management
- admin

Not every roster member needs a login account. Keep roster `members` separate from authenticated `profiles`.

### 2. Events Calendar
Enhance the existing Events page rather than replacing it.

Public visitor:
- sees basic published upcoming events in a simple calendar/list.

Logged-in member:
- sees additional golf-day actions/details.
- can open the live leaderboard/digital scorecards for an active golf day.

Scorer/management/admin:
- sees the relevant Manage Golf Day action.

Do not build a complex event-management suite.

### 3. Golf Day Setup
Authorised user can:
- create/open a golf day;
- set game/title, date, venue and optional course;
- select participating players from the imported club roster;
- capture a handicap snapshot if available;
- move the golf day through a simple status such as draft/open/live/final.

### 4. Score Capture
One designated scorer remains the default operating model.

The score-entry screen must be mobile-first, fast and forgiving:
- identify the golf day clearly;
- choose/switch player easily;
- identify current hole clearly;
- enter/update strokes with minimal taps;
- save reliably;
- make previous entries easy to review/correct;
- show obvious progress through the round;
- never make the scorer manually total the card.

Do not give all members write access during the pilot.

### 5. Digital Scorecard
For each participating player, provide a clear 18-hole scorecard showing as data permits:
- player name;
- handicap snapshot/reference;
- holes 1–18;
- par where course-hole data exists;
- strokes entered;
- front-nine/out total;
- back-nine/in total;
- overall total;
- holes completed.

Do not invent unavailable golf metrics.

### 6. Live Leaderboard
A logged-in member can open the current golf day and see the leaderboard update as the scorer saves scores.

Minimum leaderboard fields:
- position;
- player name;
- holes completed / `thru`;
- current total score.

Tapping a player opens their digital scorecard.

Use Supabase Realtime at prototype scale; do not build a custom realtime server.

## Database Contract
Use Supabase Postgres and keep the schema deliberately small.

### `members`
Club/player roster independent of login.
Suggested fields:
- id uuid primary key
- full_name text required
- email text nullable
- current_handicap numeric nullable
- legacy_name text nullable
- active boolean default true
- created_at / updated_at

### `profiles`
Authenticated app profile.
Suggested fields:
- id uuid primary key referencing auth.users
- member_id uuid nullable referencing members
- full_name text
- role constrained to member/scorer/management/admin
- active boolean
- created_at / updated_at

### `courses`
- id
- name
- active

### `course_holes`
- id
- course_id
- hole_number 1–18
- par
- stroke_index nullable
- unique course + hole

### `golf_days`
- id
- game_number nullable
- title
- date
- venue
- course_id nullable
- status constrained to a small approved set
- created_by
- timestamps

### `golf_day_players`
- id
- golf_day_id
- member_id
- handicap_at_start nullable
- status
- unique golf day + member

### `hole_scores`
- id
- golf_day_player_id
- hole_number 1–18
- strokes positive integer
- updated_by auth user id
- updated_at
- unique player participation + hole

Do not introduce advanced tournament/statistics schemas.

## Spreadsheet Migration Contract
The supplied workbook is a reference/source dataset, not a schema blueprint.

Known useful workbook areas:
- `Player details`: roster and current handicap reference.
- `Games`: historical game/final-score data.
- `Ranking`: expected ranking/order for validation.

Reference-only for later phases:
- `Handicaps`
- `Differentials`
- `Players History`
- `Admin Points`
- `OoM`
- `Order of Merit`

Do not automate those advanced calculations now.

### Historical Acceptance Dataset
Import one reliable historical golf-day result and its participating players/final scores from the workbook. The digital ranking must reproduce the spreadsheet's ranking before the scoring system is accepted.

If the spreadsheet contains ambiguous or inconsistent golf formulas, do not invent a correction. Preserve the confirmed MVP behaviour and document the ambiguity for a later club decision.

## Scoring Rule Boundary
For the initial validation mode:
- total score = sum of recorded strokes;
- lower final score ranks higher, consistent with the confirmed spreadsheet ranking behaviour;
- holes completed = number of recorded holes.

Do not implement Stableford, automatic net scoring, handicap differential logic, handicap updates, Order of Merit or alternative competition formats unless explicitly approved after the pilot.

## Security Contract
Use current Supabase guidance.

Required:
- Use project URL + browser-safe publishable key in frontend.
- Never expose secret/service-role keys or database credentials.
- Enable RLS on every exposed public-schema table.
- Explicitly grant only required privileges.
- Public/anon receives only approved public event data.
- Authenticated members receive approved read access.
- Score writes require scorer/management/admin authorisation at the database policy level.
- Do not use user-editable `user_metadata` for authorisation.
- Do not treat hidden buttons/routes as security.
- Test RLS by attempting both allowed and forbidden operations.
- Run Supabase Security Advisor and Performance Advisor after schema changes and address material findings.

## Realtime Contract
Use the least complex approach appropriate for the pilot.
- Enable Realtime only on tables actually required for the live scoring experience.
- Prefer narrowly scoped subscriptions to the active golf day.
- A second logged-in browser/session must visibly update after score changes without manual page reload.

## UX Contract
### Adoption principle
Reduce behavioural change. The platform replaces the spreadsheet consolidation step before it tries to reinvent how the club plays golf.

### Scorer experience
The scorer should recognise the relationship to Excel immediately. Avoid dashboards full of unrelated cards and analytics.

Ideal first-screen information hierarchy:
1. Golf Day / Game number.
2. Venue and date.
3. Current player / player list.
4. Current hole and score entry.
5. Progress/completion state.
6. Current leaderboard access.

### Member experience
Members are observers in MVP:
- simple event/golf-day context;
- LIVE indicator when relevant;
- leaderboard;
- player scorecard drill-down.

### Error handling
Every save must give clear success/failure feedback. Never silently lose a score. Prevent duplicate hole-score rows through database constraints/upsert logic. A failed save must remain visibly unresolved until retried or corrected.

## Out of Scope — Hard Stop
Do not build any of the following in this branch:
- GPS or course maps
- smartwatch features
- personal performance analytics/statistics
- automatic handicap updates
- handicap differential engine
- Admin Points automation
- Order of Merit automation
- Stableford/Match Play/Ryder Cup/multi-format tournament engine
- multiple-round tournament management
- friends/follow/social feed
- messaging/chat
- media feed
- payments
- sponsor dashboard
- CRM
- push notifications
- complex reporting/export system

If one of these appears useful while implementing, log it as a future idea and continue the approved MVP.

## Build Order
Do not reorder without a technical reason documented in Project OS.

### Phase A — Interrogate and Baseline
- Verify repository state and existing functionality.
- Read Project OS and this contract.
- Verify spreadsheet mappings and historical acceptance dataset.
- Confirm exact files to change.

### Phase B — Backend First
- Create dedicated Supabase project after required user/cost confirmation.
- Create minimal schema.
- Apply constraints/indexes.
- Configure grants/RLS.
- Configure Realtime.
- Seed roster and validation data.
- Run SQL validation queries.
- Run security/performance advisors.

Do not begin major UI implementation until backend foundations pass.

### Phase C — Authentication
- Connect current static website to Supabase.
- Replace hard-coded credential logic while preserving familiar login UI where practical.
- Validate member versus scorer write permissions.

### Phase D — Events
- Move/bridge appropriate event data to Supabase.
- Render a simple upcoming-events calendar/list.
- Add member-only golf-day actions after login.

### Phase E — Golf-Day UI
- Golf-day setup/participant selection for authorised users.
- Mobile score-entry workflow.
- Digital scorecard.
- Live leaderboard.

### Phase F — QA
Test at minimum:
- public site still works;
- responsive/mobile scorer path;
- real sign-in/sign-out;
- unauthorised member cannot write scores even through direct API calls;
- scorer can create/update permitted scoring data;
- duplicate score rows cannot be created for same player/hole;
- totals are correct;
- historical ranking parity with spreadsheet;
- second session receives realtime update;
- final golf day remains readable;
- error feedback exists for failed saves.

### Phase G — Review and Preview
- Review diff for scope drift.
- Update Project OS current status, architecture, data/auth docs and change log.
- Deploy feature branch to preview only.
- Do not merge `main` until user/club review.

## Decision Rules for Ambiguity
When a requirement is ambiguous:
1. Prefer the behaviour already demonstrated by the club's spreadsheet/current process.
2. Prefer the smallest reversible implementation.
3. Do not invent golf rules.
4. Do not ask the user a question if the answer can be safely derived from repository, spreadsheet, Supabase state or existing agreed scope.
5. Ask only when a missing decision would materially change data integrity, cost, security or the visible club workflow.

## Anti-Loop Rules
- Diagnose before editing.
- One evidence-based fix per failure.
- Do not repeat the same failed approach more than twice.
- Use logs/database queries/browser console/network evidence before changing architecture.
- Do not solve a local bug by adding a new framework/dependency unless the root cause proves it necessary.
- Record blockers rather than hiding them with mock data or fake success states.

## Definition of Done
The MVP is complete only when this demonstration works end-to-end:

1. Chairman/member signs in using real Supabase Auth.
2. Opens Events and sees the upcoming-event calendar.
3. Opens a current golf day and sees the live leaderboard.
4. In a separate authorised scorer session, one player's hole score is entered/changed.
5. The database persists it exactly once.
6. Totals/ranking recalculate correctly.
7. The chairman/member session updates live without reloading.
8. Tapping the player opens a digital 18-hole scorecard.
9. A seeded historical result reproduces the workbook's expected ranking.
10. Existing public Birdie Squad pages still work.

Once those ten conditions pass, stop adding features. The club must test the prototype before Phase 2 scope is defined.
