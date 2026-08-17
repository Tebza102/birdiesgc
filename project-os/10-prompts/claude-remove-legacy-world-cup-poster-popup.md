# DEV MODE — Remove Legacy World Cup Poster Popup

Work only on `agent/supabase-golf-day-mvp`. Do not merge to `main`.

## User request
Remove the old poster popup the club used previously around the World Cup period. This is a legacy promotional popup and must no longer appear anywhere in the pilot app.

## Important boundary
Do **not** remove or weaken the new Gate 2D event/poster feature. The current Supabase-backed poster flow must remain intact:
- Admin/Management can upload event posters to the `event-posters` Supabase Storage bucket.
- Featured Event presentation may show an uploaded poster inline on the Events page.
- Calendar/event details may show poster/media details as designed.

The thing to remove is only the old automatic/modal popup behaviour.

## What to inspect
1. Search the entire current branch (including HTML, JS, CSS, image references and any old inline scripts) for legacy popup behaviour and World Cup-era poster references.
2. The stylesheet still contains legacy `.event-popup*` styles. Determine whether any active or stale code/markup still creates an `event-popup`/poster modal.
3. Check whether the popup is created on page load, after a timer, from session/localStorage state, or from a legacy static event script.
4. Confirm there is no service worker/cache script deliberately rehydrating old popup markup.

## Required change
- Remove the old automatic promotional/poster popup completely.
- Remove dead popup-specific JS/HTML/CSS and the obsolete poster asset/reference if it is used only by that popup.
- Do not remove normal login modal functionality (`auth-modal`).
- Do not remove Featured Event cards, event poster upload, calendar poster indicators, or Supabase Storage poster rendering.
- Do not change scoring, auth roles, Excel import, Realtime, RLS, or management permissions.

## Defensive acceptance
If the old popup can be injected by a legacy script after DOM ready, remove that source rather than merely hiding it. Do not leave a permanent `display:none !important` workaround unless the source truly cannot be removed safely.

## Tests
Run all existing checks:
- JS syntax
- secret scan
- build
- legacy import 24/24
- mobile CSS 15/15
- event details 14/14
- auth UI 20/20
- local server smoke

Add a tiny regression assertion if useful that ensures the legacy popup trigger/markup no longer exists while the new `event-posters` / Featured Event code still does.

## Deployment
After tests pass:
- commit and push to `agent/supabase-golf-day-mvp`;
- update PR #1;
- deploy only to the separate Vercel project `birdiesgc-pilot`;
- verify `https://birdiesgc-pilot.vercel.app/` and `/events` load without the legacy popup;
- do not touch the existing `birdiesgc` Vercel project or `www.birdiesgc.co.za`;
- do not merge to `main`.

## Final report
Report:
- exact legacy popup source found;
- files removed/changed;
- commit SHA;
- CI status;
- exact pilot URL deployed;
- confirmation that new Supabase event poster upload/display remains present.
