# DEV MODE — Rich Event Details + Poster Upload

## Mission
Extend the existing Birdie Squad Supabase golf-day MVP so a golf day can also be presented as a proper promotional event, restoring the useful richer event experience that existed in the old static `events-data.js` implementation.

Work only on `agent/supabase-golf-day-mvp`. Finish this feature in the same branch and PR #1. Do not merge to `main`.

This is an extension of the existing architecture, NOT a redesign. Preserve Supabase Auth/RLS, live scoring, Realtime, Excel import, historical read-only rules, and the recent mobile-responsive fixes.

## Why this exists
The old static event model already supported:
- detailed/short descriptions
- reporting time
- tee-off time
- green fee
- note/instructions
- sponsor
- prizes
- poster image
- featured event presentation
- gallery/report hooks

The current Supabase `golf_days` creator only captures Game #, date, title, venue and `is_public`. The richer information must now be database-backed rather than hard-coded.

## Required MVP data extension
Add nullable presentation fields to `public.golf_days` (or an equally simple 1:1 event-details design if inspection proves materially safer):
- `short_description text`
- `description text`
- `reporting_time time`
- `tee_off_time time`
- `green_fee text`
- `event_note text`
- `sponsor_name text`
- `prizes jsonb not null default '[]'::jsonb`
- `poster_path text`
- `poster_alt text`
- `featured boolean not null default false`

Do not alter scoring fields or scoring logic.

`prizes` should stay intentionally simple for this phase, e.g. an array of `{label, value}` items. Do not add a prize-management subsystem.

## Poster/media upload
Implement direct poster upload from the Events admin/management create/edit experience using Supabase Storage.

Preferred MVP:
- create a dedicated public-read bucket for event posters (for example `event-posters`)
- browser uploads JPG/JPEG/PNG/WebP only
- sensible file-size limit (small promotional poster, not unlimited file storage)
- writes/deletes restricted to approved `admin`/`management` users via Storage RLS
- public visitors can read poster images for public events
- store the object path in `golf_days.poster_path`; derive the public URL in the browser rather than storing a brittle full URL
- use collision-safe paths such as `<golf_day_id>/<timestamp-or-random>.<ext>`
- when replacing a poster, avoid leaving uncontrolled orphan files; clean up the old object when safe
- never expose a service-role/secret key in frontend code

If Supabase Storage cannot safely be configured through migration in this repo, stop only for that material blocker and explain exactly what dashboard action is needed. Do not silently fall back to hard-coded repository images.

## Create / edit golf-day UI
Keep the existing fast creation flow, but add an optional `Event / promotion details` section so ordinary scorer setup is not made cumbersome.

At minimum allow admin/management to enter/edit:
- title
- date
- venue
- Game #
- public calendar toggle
- featured toggle
- short description
- full description
- reporting time
- tee-off time
- green fee
- note/instructions
- sponsor
- zero or more prize rows (label + value)
- poster file + alt text

Do not require promotional fields to create a golf day. A golf day with no poster/prize/description must continue working exactly as today.

There must be an edit path for an already-created app golf day so a poster or prize details can be added later without recreating the round.

Historical `closed + excel_import` rounds remain read-only. Do not let the new edit UI mutate those records.

## Public Events page
Replace the current thin Supabase public list with database-backed rich event rendering while preserving safe static fallback if Supabase is unavailable.

For `is_public = true` scheduled/live days:
- render a poster when present
- title, date, venue
- short description
- reporting time / tee-off time when present
- green fee when present
- sponsor when present
- prize summary when present
- status/live indication
- member-golf-hub CTA

Restore a database-backed Featured Event treatment:
- choose an explicitly `featured = true` upcoming/live public event when available
- otherwise use the nearest upcoming public event
- use the existing established Birdie visual style/classes where practical rather than inventing a new design language
- poster should be prominent but responsive
- show fuller event details + prizes

Do not show empty labels like `Sponsor:` or `Green Fee:` when the field is null.

## Member Golf Hub calendar + detail
Do NOT cram a poster and all fields into the small monthly calendar cell.

Instead:
- calendar cell remains compact and usable; title remains the main content
- optionally add a tiny unobtrusive marker/badge if the event has prizes/poster
- clicking the calendar event opens the existing golf-day detail
- the golf-day detail should include the event presentation block (poster/details/prizes) above the leaderboard/scorer when those fields exist
- preserve live leaderboard and score-entry behaviour exactly
- presentation block must follow the recent mobile rules: no page-level horizontal overflow, no oversized nested containers, no rigid desktop width

## Homepage integration
If the existing homepage countdown/next-event feature can be safely switched from hard-coded `events-data.js` to the same public Supabase event source without expanding scope significantly, do it. Do not duplicate event data in two places.

If that would materially destabilize the current phase, document it as the next small follow-up; the Events page and calendar are required now.

## Future content/news seam — design for it, do not overbuild it
The user wants future member updates, newsletters, event reports and sponsor-facing reports.

For this pass:
- do NOT build a full CMS/newsletter engine
- document a future `club_posts`/content model direction and media strategy in Project OS
- make the poster/media implementation reusable in principle, but do not weaken public/private access boundaries just to be generic
- event posters can be public; future member-only documents may require a separate private bucket/policy

Existing static `report`/gallery concepts are useful reference only. Do not fabricate reports or migrate fake content.

## Security / RLS
- anonymous users may only receive presentation data for `is_public = true` events allowed by existing/public RLS
- approved members can continue reading club golf data according to current policy
- only current authorized golf-day managers (`admin`/`management`) may change event presentation fields or posters
- scorer/member roles must not gain event-edit or Storage-write privileges
- do not loosen existing golf scoring RLS
- do not expose secrets

## Migration compatibility
This branch already has live-applied Supabase migrations that were subsequently mirrored back into repo history. Inspect actual current branch migrations before adding a new migration.

Add a NEW forward migration; do not rewrite an already-applied migration.

The normal Member Golf Hub must not crash if poster data is absent. Existing records must continue to render with null/default values.

## Tests / acceptance
Add regression coverage sufficient to prove:
1. existing golf day with no rich fields still renders/works
2. admin/management create/edit rich fields
3. member/scorer cannot edit rich fields or upload/delete posters
4. public query only exposes eligible public event presentation
5. prize JSON renders safely and empty arrays do not create empty UI
6. poster upload accepts only allowed image types/size
7. public event card uses uploaded poster when present and safe fallback when absent
8. member monthly calendar stays compact
9. selected member golf-day detail shows event details without breaking leaderboard/scorer
10. mobile widths 320/360/375/390/400/430 remain free of page-level horizontal overflow in the changed event/detail areas
11. legacy Excel import tests remain green
12. mobile CSS tests remain green
13. secret scan remains green

Run the full existing validation suite and update CI if a new test is appropriate.

## Project OS / PR
Update:
- `project-os/00-start-here/current-status.md`
- `project-os/00-start-here/next-action.md`
- `project-os/04-technical/data-model.md`
- `project-os/08-logs/change-log.md`
- PR #1 body/comment

Explicitly record that future news/newsletters/sponsor reports are an intentional next publishing layer, not part of this implementation unless trivially enabled by the same model.

## Stop conditions
Do not stop for routine implementation questions.
Stop only for a material security, cost, irreversible-data, or required-credential blocker.

Do not merge to `main`.