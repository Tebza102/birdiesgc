# Claude Finisher Brief — Birdie Squad Golf Day MVP

You are the implementation finisher for the Birdie Squad Golf Club MVP. Your job is to finish the existing work safely and decisively, not redesign it.

## Core instruction

Take the current repository state on branch `agent/supabase-golf-day-mvp` and drive it to a clean, reviewable MVP completion state with the fewest possible user interruptions.

Do not start over. Do not replace the architecture. Do not invent new product scope. Do not migrate frameworks. Do not rewrite working code merely for taste.

The product principle is simple:

**The club already understands its Excel workflow. The digital product must feel like that workflow becoming live and automatic, not like members are being forced to learn new golf software.**

---

## Repository and branch

Repository: `Tebza102/birdiesgc`

Work only on:

`agent/supabase-golf-day-mvp`

Current PR:

`#1 — Birdie Squad Supabase golf-day MVP`

Do not merge to `main` yourself. Do not deploy to the production domain. A safe preview or local/browser validation is allowed and expected.

---

## Mandatory preflight before editing

Read these files first, in this order:

1. `project-os/00-start-here/current-status.md`
2. `project-os/00-start-here/next-action.md`
3. `project-os/04-technical/architecture.md`
4. `project-os/04-technical/auth-and-roles.md`
5. `project-os/04-technical/data-model.md`
6. `project-os/04-technical/tech-stack.md`
7. `project-os/08-logs/change-log.md`
8. `project-os/10-prompts/birdie-golf-day-mvp-master-build-prompt.md`
9. this file

Then inspect the actual branch diff and runtime paths before changing anything.

Do not trust stale prose over current code/database evidence. Reconcile documentation with the actual branch state.

---

## Current verified state — do not redo this work

### Gate 1 is complete

Supabase project:
- Name: `Birdie Squad Golf Club`
- Project ref: `ydrrhlpvblwgwboyuwkj`
- Organisation: Apprigate
- Region: `eu-west-1`

Verified backend work already exists:
- `members`
- `user_profiles`
- `golf_days`
- `golf_day_players`
- `hole_scores`
- `live_leaderboard`
- RLS on exposed tables
- approved-account requirement
- roles: `member`, `scorer`, `management`, `admin`
- Realtime publication for golf days, participants and hole scores
- schema migrations committed under `supabase/migrations/`

Spreadsheet seed already exists:
- 83 roster members
- historical Game 15 at STATEMINES GC
- 22 imported final scores

Historical acceptance result is already proven and must remain unchanged:
1. MISS CAROL SIBIYA — 71
2. MR SLENDA SITHEBE — 72
3. MR DUKE MAPHUNYE — 75

The ranking also preserves Excel-style tied positions.

A live score calculation test has already passed.

### Auth/RLS proof already completed

The Supabase Auth user `apprigate@gmail.com` exists and is approved as `admin` in `user_profiles`.

Database permission tests have already shown:
- Admin can read the roster/golf data.
- Admin can create a golf day, add a player and enter a score.
- The leaderboard calculates after a score write.
- A member-role simulation can read permitted golf data but cannot perform staff writes.
- Test rows were rolled back/removed.

Do not weaken these policies.

### CI status at handoff

The GitHub Actions workflow `Birdie MVP Check` is currently passing on the branch after fixing a false-positive secret scan.

Preserve or improve that check. Do not disable security tests to get green CI.

---

## Existing frontend work already implemented

Inspect before editing:
- `events.html`
- `js/birdie-mvp.js`
- `js/birdie-public-events.js`
- `js/events-data.js`
- `css/mvp.css`
- `js/main.js`

The branch already contains:
- Supabase email/password login bridge on Events
- database-backed public golf-day list
- logged-in member golf calendar
- golf-day detail view
- leaderboard
- individual digital scorecard
- admin/management create-golf-day form
- staff add-player flow
- Excel-familiar 18-hole scorer grid
- Realtime refresh subscriptions
- historical imported totals shown honestly rather than fabricated as hole scores
- stale 31 May 2026 event corrected from upcoming to past

Do not discard this implementation unless a concrete defect proves replacement is necessary.

---

# Your finishing mission

Finish the remaining work in one disciplined pass.

## 1. Remove legacy fake authentication completely

The old insecure hard-coded credentials/localStorage auth in `js/main.js` must not remain a functioning authentication path anywhere on the site.

Required outcome:
- no hard-coded production-usable usernames/passwords remain in shipped JavaScript;
- no custom `birdiesgc_auth_session` grants access;
- existing Login controls continue to behave coherently;
- Supabase Auth becomes the only real login authority;
- public pages remain publicly usable;
- authenticated role data comes from `user_profiles`/RLS, not browser-stored roles.

Use the smallest architecture that makes this true across the current static site. Do not add a framework.

If centralising the Supabase auth bridge is cleaner than interception hacks, do so minimally. Preserve the current visual language.

## 2. Finish the Events/member-golf experience

Ensure the Events page has a coherent hierarchy for:

Public visitor:
- normal public event information;
- database-backed public golf days when explicitly public;
- clear Login entry point.

Approved member:
- calendar/list of golf days;
- golf-day detail;
- leaderboard;
- player scorecard;
- no score editing controls.

Scorer/management/admin:
- same member view plus only the permitted create/manage/scoring controls.

Do not create a dashboard full of unrelated cards.

## 3. Make scorer capture genuinely usable on a phone

Current Excel-familiar player-by-hole grid is a valid starting point, but verify it on a narrow viewport.

The scorer must be able to:
- identify the golf day immediately;
- find a player quickly;
- identify the hole clearly;
- enter/update a numeric stroke score with minimal taps;
- see clear saving/saved/error state;
- correct a previous score;
- understand the running total and completion state;
- move through the round without fighting horizontal layout.

Preserve Excel familiarity, but do not force a desktop spreadsheet interaction onto a phone if it is demonstrably awkward.

A small responsive enhancement is preferred over a redesign. Examples may include sticky player/total columns, a focused mobile score-entry control, or a responsive table pattern. Choose the smallest solution that tests well.

Do not introduce Stableford/net/par analytics unless course metadata actually exists and the approved MVP requires it.

## 4. Validate real Auth behaviour in-browser

Use the existing Admin Auth user for admin-side browser testing. Never ask for or log its password in source, docs, CI or terminal history.

Validate:
- login form actually signs in against Supabase;
- role resolves to Admin;
- authorised controls appear;
- logout works;
- refresh/session persistence behaves sensibly;
- failed login is visibly handled;
- an authenticated-but-unapproved user cannot access club scoring data if such a safe test identity is available.

Do not create users by directly inserting into `auth.users`.

If a second safe test Auth identity cannot be created without privileged Supabase Auth administration or user email confirmation, do not hack around it. Finish every other task and report the exact single manual requirement at the end.

## 5. Validate member read-only behaviour

True end-to-end goal:
- member can read permitted golf days, leaderboard and scorecard;
- member cannot create golf days;
- member cannot add players;
- member cannot insert/update/delete scores;
- direct API attempts remain blocked even if buttons are manipulated.

Database-level member write blocking has already been proven through role simulation. Preserve it.

If a real second member Auth account becomes safely available, perform the browser-level version too.

## 6. Validate Realtime with two sessions where possible

Target demonstration:
- Session A is authorised scorer/admin.
- Session B is approved member.
- A score changes in Session A.
- Session B updates without a manual full-page reload.

Inspect Realtime subscription errors explicitly.

If a true second Auth user is the only missing prerequisite, do not fake a pass. Mark this one item blocked and complete all other work.

## 7. Confirm historical and live scoring still behave correctly

Do not change the approved scoring boundary:
- live total = sum of recorded strokes;
- holes completed = number of recorded hole scores;
- lower total ranks higher;
- ties preserve shared rank behaviour compatible with the existing Excel ranking;
- handicap remains informational only for MVP.

Re-run the Game 15 acceptance query after any database/view changes.

Never fabricate hole-by-hole scores for imported historical rounds.

## 8. Public event integration must be resilient

Ensure Supabase-backed public golf-day rendering does not destroy the static Events fallback when Supabase is unavailable.

Past static events must not masquerade as upcoming events based only on stale status strings.

Do not build a full event CMS.

## 9. Error handling must be obvious

No silent score loss.

For score saves:
- visible saving state;
- success state;
- clear failure state;
- failed value remains understandable/correctable;
- no duplicate hole-score row for same player/hole.

For loading/auth failures:
- show useful user-facing message;
- log enough technical detail for debugging without secrets.

## 10. Run full repository validation

At minimum run and pass:
- JavaScript syntax checks for shipped JS;
- `npm run build`;
- local server smoke test for `/events` and MVP JS assets;
- GitHub Actions `Birdie MVP Check`;
- secret scan showing no `service_role`/secret key is shipped;
- Supabase Security Advisor after any schema/RLS change;
- Supabase Performance Advisor if database structures are changed;
- Game 15 leaderboard parity query;
- auth/RLS allowed + forbidden operation checks where relevant;
- responsive browser checks at phone and desktop widths.

Do not dismiss failing checks as irrelevant without proving why.

## 11. Preview validation

Check whether this repository has an existing Vercel project/integration that can produce a safe preview for the feature branch/PR.

Rules:
- preview only;
- no production deployment;
- no domain/DNS changes;
- no Vercel project recreation merely for convenience;
- no new paid infrastructure without user approval.

If there is no usable Vercel project/integration, do not block code completion. Perform strong local/browser validation and record `Preview deployment unavailable / requires Vercel project connection` as a concise handoff item.

## 12. Clean the PR and Project OS

Before stopping:
- update `project-os/00-start-here/current-status.md` to the actual final state;
- update `project-os/00-start-here/next-action.md` so it reflects only what remains;
- update architecture/auth/data docs only if implementation changed them;
- append a meaningful entry to `project-os/08-logs/change-log.md`;
- update PR #1 body with actual pass/fail status;
- keep PR draft if a critical validation is still blocked;
- if all engineering checks pass and only human acceptance remains, it is acceptable to mark the PR ready for review, but still do not merge it.

---

# Hard scope boundaries

Do NOT implement:
- GPS
- course maps
- smartwatch features
- automatic handicap updates
- differential calculations
- Stableford engine
- Match Play/Ryder Cup formats
- tournament engine
- Admin Points automation
- Order of Merit automation
- personal statistics/analytics
- social feed/friends/chat
- payments
- sponsor dashboard
- CRM
- notifications
- React/Next/Vue/Svelte migration
- unrelated public-site redesign

If you notice one of these opportunities, log it as future scope and continue.

---

# Decision rules

When you encounter ambiguity:

1. Prefer current club workflow demonstrated by Excel.
2. Prefer the existing proven branch implementation.
3. Prefer the smallest reversible change.
4. Never invent golf rules.
5. Never weaken RLS to make frontend code easier.
6. Never expose a Supabase secret/service-role key.
7. Do not ask the user routine implementation questions that can be answered from code, database state, Project OS or the approved MVP contract.
8. Ask for user input only if the missing information changes security, cost, data integrity, deployment ownership, or the actual club scoring rule.

---

# Anti-loop rule

If something fails:
- inspect the exact error/log/network/database response;
- make one evidence-based fix;
- rerun the relevant test;
- after two failed attempts at the same root issue, stop random edits and re-diagnose from evidence.

Do not create parallel alternate implementations just to escape a bug.

---

# Final acceptance criteria

The engineering work is complete when all achievable items below are proven:

1. Existing public website remains functional.
2. Fake hard-coded login is gone as an auth path.
3. `apprigate@gmail.com` can sign in through real Supabase Auth as Admin.
4. Approved member data access is controlled by RLS.
5. Admin/scorer can create/open a golf day and add roster players.
6. One scorer can enter/change hole scores from a phone-friendly interface.
7. Score rows are unique per player/hole.
8. Running totals and holes-completed update automatically.
9. Leaderboard ranks lower totals first and handles ties correctly.
10. Member can open an individual digital scorecard.
11. Historical Game 15 still reproduces Excel ranking.
12. Realtime updates a second member session when a score changes, if a second approved Auth identity is available.
13. CI is green.
14. No backend secrets are in shipped code.
15. PR #1 and Project OS accurately describe the final state.
16. Nothing is merged to `main` until human review.

When these are satisfied, stop. Do not add polish/features beyond what is required for a clear club pilot.

---

# Required final response from you

When finished, return a compact handoff with exactly these sections:

## Completed
List what you actually changed and proved.

## Tests passed
List concrete tests and results.

## Still blocked
Only genuine blockers, each with the minimum human action required. If none, write `None`.

## Ready for user test
State exactly what page/preview to open and what login to use (email only, never password), followed by a 3–5 step test script.

## Do not merge yet / Ready for review
State one of these clearly and explain the single reason in one sentence.
