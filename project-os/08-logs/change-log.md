# Change Log

Record every meaningful project change.

## Template

### YYYY-MM-DD HH:MM — Change Title

**Changed by:** Human/Agent/Tool

**Files changed:**
- file path

**Summary:**
What changed and why.

**Tests run:**
- test/check

**Result:**
Pass/Fail/Not run

**Risks remaining:**
- risk

**Next action:**
- action

### 2026-05-31 15:30 - Creative Skills Library Upgrade (Frontend + 3D)

**Changed by:** Codex

**Files changed:**
- project-os/09-agent-skills/frontend-design-skill.md
- project-os/09-agent-skills/3d-design-skill.md
- project-os/09-agent-skills/ui-design-skill.md
- project-os/09-agent-skills/graphic-design-skill.md
- project-os/09-agent-skills/reference-art-direction-skill.md
- project-os/09-agent-skills/video-generation-skill.md
- project-os/09-agent-skills/video-editing-skill.md
- project-os/09-agent-skills/digital-stationery-design-skill.md
- TEMPLATE_MANIFEST.json
- README.md

**Summary:**
Added dedicated frontend design and 3D design skills, updated related creative skills to enforce anti-generic output rules and 3D decision flow, and refreshed template manifest and README metadata.

**Tests run:**
- Verified new skill files exist in `project-os/09-agent-skills`
- Verified `TEMPLATE_MANIFEST.json` version and file count
- Verified no source application code files were added or modified

**Result:**
Pass

**Risks remaining:**
- Existing users of previous verbose skill versions may need a quick review to align wording with this updated concise format.

**Next action:**
- Run a simulated prompt set against the updated skills to validate instruction quality and coverage.

### 2026-05-31 16:05 - Skills Library Upgrade v1.4 (Video-To-Website)

**Changed by:** Codex

**Files changed:**
- project-os/09-agent-skills/video-to-website-skill.md
- project-os/09-agent-skills/frontend-design-skill.md
- project-os/09-agent-skills/video-generation-skill.md
- project-os/09-agent-skills/video-editing-skill.md
- project-os/09-agent-skills/3d-design-skill.md
- project-os/09-agent-skills/reference-art-direction-skill.md
- TEMPLATE_MANIFEST.json
- README.md

**Summary:**
Added a dedicated video-to-website skill for scroll-driven canvas storytelling workflows and cross-referenced it across frontend, video, 3D, and reference skills. Updated template version metadata to v1.4.

**Tests run:**
- Verified new skill file creation
- Verified cross-reference insertion in targeted skill files
- Verified manifest version/file count
- Verified documentation-only scope

**Result:**
Pass

**Risks remaining:**
- `project-os/10-prompts/master-codex-operating-prompt.md` was requested for update in source instructions but does not exist in this template.

**Next action:**
- Add the missing master operating prompt file to `project-os/10-prompts` if future prompt-level integration is required.

### 2026-08-15 20:40 — Birdie Squad Golf-Day MVP Gate 1 + Gate 2 Foundation

**Changed by:** ChatGPT using GitHub and Supabase connectors

**Files changed:**
- events.html
- js/birdie-mvp.js
- js/events-data.js
- css/mvp.css
- project-os/00-start-here/current-status.md
- project-os/00-start-here/next-action.md
- project-os/04-technical/architecture.md
- project-os/04-technical/auth-and-roles.md
- project-os/04-technical/data-model.md
- project-os/04-technical/tech-stack.md
- project-os/10-prompts/birdie-golf-day-mvp-master-build-prompt.md
- supabase/migrations/20260815182736_birdie_squad_mvp_foundation.sql
- supabase/migrations/20260815182835_harden_updated_at_function.sql
- supabase/migrations/20260815182852_optimize_rls_write_policies.sql
- supabase/migrations/20260815183930_require_approved_club_accounts.sql
- supabase/seed_historical_game15.sql

**Summary:**
Created and secured the dedicated Birdie Squad Supabase backend, imported the existing club roster and Game 15 spreadsheet validation dataset, proved ranking parity with Excel, and implemented the first Events-page member golf hub on a feature branch. The UI intentionally uses a spreadsheet-familiar score-entry grid rather than a complex golf-management design. New Auth accounts require explicit club approval before protected data is visible.

**Tests run:**
- Supabase project health verified.
- Applied four recorded database migrations.
- Imported 83 roster members and 22 Game 15 results.
- Queried `live_leaderboard` and confirmed exact spreadsheet ranking parity including ties.
- Created temporary live-scoring test data, entered three hole scores for two players, confirmed automatic hole count/score total/rank, then deleted test data.
- Confirmed historical validation golf day is invisible to anonymous role.
- Supabase Security Advisor rerun after RLS/auth changes: zero findings.
- Re-fetched `js/birdie-mvp.js` from the feature branch in sections to inspect the committed integration and event-handler order.
- Compared feature branch against `main`; branch remains isolated and ahead with only intended MVP/Project-OS/Supabase files.

**Result:**
Pass for Gate 1. Gate 2 implementation is ready for real authenticated browser validation.

**Risks remaining:**
- No real Supabase Auth pilot accounts exist yet, so role/RLS/Reatime behaviour has not been proven in two browser sessions.
- Shared `js/main.js` still contains old hard-coded prototype credentials outside the scoped Events-page bridge; remove before production merge.
- Private Vercel preview/deployment still requires validation.

**Next action:**
- Bootstrap one approved staff account and one approved member account, run the two-session scoring test, then remove legacy shared auth before preparing the private chairman preview.

### 2026-08-16 09:00 — Site-Wide Legacy Auth Removal + Finishing Pass

**Changed by:** Claude (finishing brief `project-os/10-prompts/claude-finish-birdie-mvp.md`)

**Files changed:**
- js/main.js
- js/birdie-mvp.js
- js/birdie-public-events.js
- events.html
- css/mvp.css
- .github/workflows/mvp-check.yml
- project-os/00-start-here/current-status.md
- project-os/00-start-here/next-action.md

**Summary:**
Removed the hard-coded `admin`/`management`/`member` username+password array and the `birdiesgc_auth_session` localStorage session — the last functioning insecure login path, previously still live on every page except Events. Replaced it with a single shared Supabase Auth bridge (`window.BirdieAuth`) in `js/main.js`, loaded on every page, so Login/Logout is one real code path everywhere. `js/birdie-mvp.js` no longer creates its own Supabase client or intercepts clicks in the capture phase; it now consumes `window.BirdieAuth` for session/profile/client and only renders golf-day data. `js/birdie-public-events.js` reuses the same shared client instead of instantiating a second one. Reordered `events.html` script tags (`main.js` before `birdie-mvp.js`/`birdie-public-events.js`) since the interception workaround is gone. Enlarged score-input tap targets (44–46px) and tightened the sticky player column on narrow viewports for phone scorer usability. Updated the CI smoke test to check the publishable key in its new location (`js/main.js`) and `BirdieAuth` usage in `js/birdie-mvp.js`. No database/schema/RLS changes were made.

**Tests run:**
- `node --check` on all shipped JS files (`js/*.js`, `scripts/*.js`): pass.
- Secret scan (`grep -RIn -E 'service_role|sb_secret_'` over shipped `.html`/`.js`/`.css`): no matches.
- `npm run build`: pass (no-op static build).
- Local dev-server smoke test replicating the CI workflow (`/events`, `js/main.js`, `js/birdie-mvp.js`, `js/birdie-public-events.js` all served; required strings present in each): pass.

**Result:**
Pass for all checks achievable without a browser + real password or Supabase Auth administration access.

**Risks remaining:**
- Real-browser sign-in with `apprigate@gmail.com`, phone-device scorer feel, and two-session Realtime have not been re-verified in this pass — they require a human with the pilot password/device or Supabase Auth admin access, none of which are available in this environment. The prior database-level RLS proof (2026-08-15) still stands since no schema/RLS/policy changes were made.
- No Vercel project is linked in this workspace, so no preview URL exists yet.

**Next action:**
- A human should sign in on the Events page with the pilot account, run create-day → add-player → score-entry → leaderboard end to end, check the scorer grid on an actual phone, and link a Vercel project if a preview link is wanted before review.
