# Auth and Roles

## Auth Provider
Supabase Auth with email/password for the pilot. The existing hard-coded credentials in `js/main.js` are prototype-only and must be removed before production merge.

## Identity Model
Not every golfer needs a website login.
- `members` is the club/player roster imported from the spreadsheet. A roster row may exist without an Auth account.
- `user_profiles` is the application-authorisation record for a Supabase Auth user.
- `user_profiles.member_id` may link a login to a roster member but is optional during the pilot.

This avoids creating dozens of unnecessary login accounts merely because a player exists in Excel.

## Account Approval Model
Authentication alone is not membership authorisation.

Every new Supabase Auth user receives:
- role: `member`
- approved: `false`

An account must be explicitly approved by controlled administration before it can read club/member scoring data. This protects the pilot even if someone discovers the public Supabase project key or creates an Auth account outside the intended UI.

Do not use `user_metadata` for roles or approval decisions.

## Roles
| Role | Can Do | Cannot Do |
|---|---|---|
| Public | View normal website and explicitly public golf-day/event information | View member roster/scoring data or modify anything |
| Unapproved Auth user | Sign in and see no protected club scoring data | Read roster/results or modify golf data |
| Member | View member golf calendar, leaderboard and digital scorecards | Create golf days, add players or edit scores |
| Scorer | Member permissions plus add golf-day players and capture/update scores | Change platform security, approve users, or create broader administration |
| Management | Scorer permissions plus create/manage golf days and roster data within MVP scope | Bypass RLS or access platform secrets |
| Admin | Management permissions and controlled pilot account/role administration outside the browser client | Bypass security controls or expose secrets |

## Protected Areas
- Member golf-day/live leaderboard data requires a real Supabase session and `user_profiles.approved = true`.
- Score writes additionally require role `scorer`, `management`, or `admin`.
- Golf-day create/status administration requires role `management` or `admin`.
- UI visibility is convenience only; RLS is authoritative.

## Public Routes
Existing public website pages remain public. Only explicitly published golf-day/event rows may be exposed to `anon`.

## Login Flow
1. User opens the existing Login UI.
2. On the Events MVP page, the form is converted to email/password and submitted to Supabase Auth.
3. Supabase establishes the user session.
4. The application reads the user's own `user_profiles` row.
5. If `approved = true`, the UI reveals the role-appropriate member/scorer/admin experience.
6. Supabase RLS independently evaluates every read/write.
7. Logout uses Supabase Auth and removes the session.

## Current Events-Page Compatibility Bridge
The shared legacy `js/main.js` still creates the original login modal and hard-coded prototype listeners. To minimise risk while Gate 2 is validated, `js/birdie-mvp.js` loads before `js/main.js` on `events.html` and registers capture-phase login/form handlers. It removes the legacy localStorage session and intercepts login/logout on the Events page before the old handler can authenticate hard-coded credentials.

This is an interim migration technique, not the final production auth architecture. Before production merge, the hard-coded credential implementation must be removed from shared `js/main.js` so all pages use one real auth source.

## Role Enforcement
- Do not authorise through `birdiesgc_auth_session`.
- Do not hard-code passwords or application roles in JavaScript.
- Do not rely on button hiding for security.
- Do not use user-editable Auth metadata for authorisation.
- Database-backed `user_profiles.role` + `user_profiles.approved` and RLS are the source of truth.
- Browser code receives only the Supabase project URL and publishable key.
- Never put a Supabase secret/service-role key in static assets.

## Initial Account Strategy
Create only the few accounts needed for the pilot:
- one management/admin/scorer account;
- one normal member account;
- optionally the chairman's own account after the workflow is validated.

Accounts can be approved/assigned roles through controlled database administration during the pilot. Do not build a full user-management dashboard until actual club usage justifies it.

## Auth Risks
- Hard-coded prototype credentials remain elsewhere in shared `js/main.js` until the final auth cleanup.
- End-to-end RLS still requires testing with real approved and unapproved users.
- Static pages cannot be considered protected merely because links are hidden.
- Role changes may require session/data refresh before UI state reflects them.
- Open Auth signup must never equal automatic club access; the `approved` gate exists specifically to prevent this.

## Definition of Done
Auth is complete only when:
- old hard-coded credentials no longer authenticate anywhere in the production candidate;
- a real approved Supabase user can sign in/out;
- an unapproved Auth account cannot access member golf data;
- approved members can read permitted data but cannot edit scores;
- approved scorer/admin accounts can perform only their intended writes;
- direct data access is blocked/allowed consistently by RLS independent of the UI.

## Debug Notes
Before fixing auth, use `/project-os/09-agent-skills/auth-debug-skill.md`. After schema/policy changes, run Supabase Security Advisor. If an auth/RLS issue survives two controlled attempts, stop and return to Plan Mode rather than looping.
