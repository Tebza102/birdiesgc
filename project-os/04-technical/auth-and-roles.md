# Auth and Roles

## Auth Provider
Supabase Auth. The current hard-coded credentials in `js/main.js` are prototype-only and must be removed from production use as part of this MVP.

## Identity Model
Not every golfer needs a website login.
- `members` represents the club/player roster and may exist without an Auth user.
- `profiles` represents authenticated website users and can optionally link to a roster member.

This prevents the spreadsheet roster from being artificially converted into dozens of login accounts.

## Roles
| Role | Can Do | Cannot Do |
|---|---|---|
| Public | View normal website and basic published events | View member-only scoring data or modify anything |
| Member | View member event extras, live leaderboard and digital scorecards | Create golf days or edit scores |
| Scorer | Member permissions plus capture/update scores for active golf days | Change platform security or unrelated administration |
| Management | Scorer permissions plus manage MVP golf-day/event data | Bypass RLS or access platform secrets |
| Admin | Manage MVP users/roles and golf-day/event data within approved scope | Bypass security controls from browser or expose secrets |

## Protected Areas
- Member golf-day/live leaderboard experience requires authenticated access unless an individual event is later explicitly approved for public viewing.
- Scorer/admin capture screens require the appropriate application role.
- Button visibility is a UX convenience only; database RLS is the authoritative access control.

## Public Routes
Existing public website pages remain public. Events may display basic published information publicly.

## Login Flow
1. User opens existing Login UI.
2. Email/password is submitted to Supabase Auth.
3. Supabase returns a valid user session.
4. The application loads the user's profile/role.
5. UI reveals authorised member/scorer/admin actions.
6. Supabase RLS independently enforces every data read/write.
7. Logout uses Supabase Auth and clears the Supabase session.

## Role Enforcement
- Do not use the existing custom `birdiesgc_auth_session` object for authorisation.
- Do not hard-code passwords or roles in JavaScript.
- Do not rely on user-editable `user_metadata` for authorisation.
- Use database-backed application roles with carefully reviewed RLS policies.
- Avoid role designs that create RLS recursion. Validate policies with real authenticated test users before considering auth complete.

## Initial Account Strategy
Do not create login accounts for the entire roster. For prototype testing, create only the small number of authorised users needed for chairman/management/scorer/member testing. Additional members can be invited later without changing the roster model.

## Auth Risks
- Existing public hard-coded credentials.
- Static pages cannot be considered protected merely because links are hidden.
- Incorrect RLS could expose scores or permit unauthorised edits.
- A secret/service-role key in browser code would be a critical failure.
- Role changes and session freshness must be tested before relying on them.

## Definition of Done
Auth is complete only when:
- old hard-coded credentials no longer authenticate;
- a real Supabase user can sign in/out;
- members can read permitted data but cannot edit scores;
- scorer/admin can perform only approved writes;
- direct API attempts are blocked/allowed consistently by RLS independent of the UI.

## Debug Notes
Before fixing auth, use `/project-os/09-agent-skills/auth-debug-skill.md`. After schema/policy changes, run Supabase security advisors.
