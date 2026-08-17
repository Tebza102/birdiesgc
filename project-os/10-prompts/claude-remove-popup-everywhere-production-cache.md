# DEV MODE — CLAUDE INSTRUCTION

## Objective
The user is still seeing the old World Cup-era promotional/poster popup after Gate 2F. Treat this as a production/cache defect, not as another CSS-only cleanup. Remove the obsolete popup from every CURRENT Birdie Squad URL the club uses, including both the public production site and the isolated pilot. Do not remove the new Supabase event-poster feature.

## Verified facts — use these as ground truth
- Feature branch `agent/supabase-golf-day-mvp` at commit `9de4907` has already removed all `.event-popup*` CSS and has regression checks. No active `event-popup` markup/JS trigger was found there.
- Public production `main` is still a different code line and **still contains the old `.event-popup*` CSS block in `css/style.css`**.
- `main/js/main.js` currently has no `event-popup` string, and the root of `main` has only `js/main.js` + `js/events-data.js`; there is no service worker in the current repository tree.
- The current public site is `https://www.birdiesgc.co.za/` and the pilot is `https://birdiesgc-pilot.vercel.app/`.
- Pilot PR #1 must remain unmerged. Do not replace the whole public site with the MVP branch.

## Important distinction
Do NOT remove or disable any of the NEW Supabase-backed event-poster functionality:
- `event-posters` Supabase Storage bucket
- poster upload/edit UI in `js/birdie-mvp.js`
- `.mvp-event-poster` presentation
- Featured Event poster rendering in `js/birdie-public-events.js`
- calendar poster/prize indicators

The target is only the obsolete World Cup-era automatic popup and any stale cached copy of it.

## Part A — prove where it is still coming from
Before changing code, inspect CURRENT served output (not only git source) for all normal club URLs:

Public production:
- `https://www.birdiesgc.co.za/`
- `https://www.birdiesgc.co.za/index.html`
- `https://www.birdiesgc.co.za/events`
- `https://www.birdiesgc.co.za/events.html`
- every other top-level HTML page linked from the main nav

Pilot:
- `https://birdiesgc-pilot.vercel.app/`
- `https://birdiesgc-pilot.vercel.app/index.html`
- `https://birdiesgc-pilot.vercel.app/events`
- `https://birdiesgc-pilot.vercel.app/events.html`
- every other top-level HTML page linked from the main nav

For each environment inspect served HTML plus the actual linked CSS/JS responses. Search for more than the literal class name. Search for:
- `event-popup`
- `popup`
- `modal`
- `poster`
- `world cup`, `worldcup`, `world-cup`
- old promotional image filenames
- `setTimeout`, `setInterval`
- `localStorage`, `sessionStorage`
- code that appends a full-screen overlay/dialog to `document.body`
- inline scripts
- service-worker registrations or cached-worker files

If the popup can be visually reproduced in a real browser, inspect the DOM while it is visible and record the element id/class/image URL/script initiator. Do not assume the old class name is the only possible implementation.

## Part B — production hotfix without merging the MVP
The public `main` branch must also be cleaned, but do NOT merge PR #1 and do NOT replace production with the MVP.

Create a dedicated hotfix branch from current `main`, e.g.:
`hotfix/remove-legacy-popup-everywhere`

On that branch:
1. Remove the entire obsolete `.event-popup*` CSS block from `css/style.css`.
2. Remove any active old popup HTML/JS/image reference found during Part A.
3. Keep the existing public site otherwise unchanged.
4. Do not migrate the Supabase MVP/auth/scoring code into production as part of this hotfix.

## Part C — force browsers to stop using stale popup assets
Because the user still sees the popup after code cleanup, add a small cache-busting measure to BOTH current public production and the pilot.

Use the least-invasive static-site approach:
- version the shared stylesheet and main JS references in every top-level HTML page, e.g. `css/style.css?v=20260817-popupfix` and `js/main.js?v=20260817-popupfix` (use one consistent version token);
- also version `js/events-data.js` anywhere it is loaded if it participated in the old event presentation;
- do not rename Supabase storage objects or uploaded poster files;
- ensure HTML responses are revalidated/no-cache via Vercel config if needed, but do not globally disable caching of images/fonts unnecessarily.

If you add Vercel headers, scope them narrowly to HTML documents and/or the few shared JS/CSS files involved. Avoid a blanket `no-store` for all assets unless you can justify it.

## Part D — regression proof
Add checks on BOTH code lines:

Pilot branch:
- preserve existing Gate 2F regression that fails if `event-popup` returns;
- extend it to scan all top-level HTML files, not only `/` and `/events`;
- check served output for `popup`-style obsolete overlay markup where practical;
- confirm the NEW event poster markers remain.

Production hotfix branch:
- add a small smoke/regression check (or equivalent script) that scans every top-level HTML/JS/CSS file for the obsolete popup implementation;
- verify `css/style.css` no longer contains `.event-popup`;
- verify all top-level HTML pages use the new cache-busted `style.css` and `main.js` references.

Do not write a test that bans the generic word `modal` globally, because the legitimate login modal exists. Target the obsolete promotional popup signatures/asset references.

## Part E — deploy both current environments
After tests pass:

1. Redeploy `birdiesgc-pilot` from `agent/supabase-golf-day-mvp` with the cache-busting update.
2. Deploy the narrow production hotfix from `hotfix/remove-legacy-popup-everywhere` to the existing public `birdiesgc` Vercel project / `www.birdiesgc.co.za`.
3. Do NOT merge PR #1 into `main`.
4. Do not change the public site's content/features beyond this popup/cache hotfix.

If production deploy requires merging the tiny hotfix branch into `main` because of Git integration, this specific hotfix merge is allowed, but it must contain ONLY the popup/cache cleanup—not any MVP feature work. Record the exact commit(s) merged.

## Part F — acceptance on all canonical URLs
After deployment, verify with a real browser where possible, plus direct HTTP/source checks:

- no automatic World Cup-era popup appears on first load;
- no popup appears after waiting at least 20 seconds;
- no popup appears after navigating between pages;
- no popup appears after refresh;
- no popup appears in a fresh private/incognito session;
- no popup appears on desktop or a mobile-sized viewport;
- no obsolete popup markup/CSS/JS/image reference is served from the current canonical URLs;
- new Featured Event/poster functionality still works on the pilot.

Also test a cache-busting URL such as `?popupfix=1` only as a diagnostic; the normal clean URLs themselves must work without query parameters.

Historical immutable Vercel deployment URLs do not need to be rewritten; the requirement is that all CURRENT canonical/aliased Birdie Squad URLs used by the club are clean.

## Final report
Report clearly:
- exact root cause found (production source, cached asset, alternate class/trigger, etc.);
- production hotfix commit SHA;
- pilot commit SHA;
- whether any hotfix was merged to `main`;
- exact production and pilot deployment URLs;
- every canonical URL tested;
- browser/incognito/mobile checks performed;
- evidence that the old popup does not appear after waiting 20 seconds;
- evidence that the new Supabase poster system remains intact;
- CI/test results.

Do not stop at “no `event-popup` string found.” The user is still seeing a popup, so reproduce/trace the visible popup or prove and eliminate stale production/cache delivery.
