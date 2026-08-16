# DEV MODE — Pilot Auth Reliability + Password Recovery

Work only on `agent/supabase-golf-day-mvp`. Do not merge to `main`.

## Verified live facts — treat these as ground truth
- Supabase project: `ydrrhlpvblwgwboyuwkj`.
- `apprigate@gmail.com`: confirmed, approved, role `admin`, successful sign-in exists.
- `smokotong@birdiesgc.co.za`: confirmed, has a password, approved, role `management`, linked to `MR TININI MOKOTONG`, but `last_sign_in_at` is null.
- `ksebusi@birdiesgc.co.za`: confirmed, has a password, approved, role `management`, linked to `MR KATLEHO SEBUSI`, but `last_sign_in_at` is null.
- Therefore do not recreate users or alter their roles. The problem to solve is frontend auth reliability / deployment clarity / password recovery UX.
- The public `www.birdiesgc.co.za` is still the older production site. The pilot must remain isolated on the separate Vercel project `birdiesgc-pilot`; do not replace the real public domain and do not merge PR #1.

## Goal
Make the static-site Supabase login dependable and self-explanatory on desktop and mobile, and add a complete forgot/reset-password flow suitable for the current management-only pilot.

## 1. Harden Supabase client loading
Current `js/main.js` dynamically imports Supabase only from jsDelivr. A failed/stalled CDN import can make auth look unresponsive.

Implement a small loader that:
- keeps the existing pinned `@supabase/supabase-js@2.111.0` version;
- tries the current jsDelivr ESM URL first;
- on failure/timeout, tries a second reputable ESM CDN fallback (for example esm.sh) at the exact same version;
- uses a finite timeout per attempt (roughly 8-12 seconds);
- if both fail, rejects with a user-visible message such as `Login service could not load. Check your connection and try again.` instead of silently hanging;
- still creates exactly one shared GoTrue/Supabase client.

No secret/service-role key may be introduced. Keep the existing browser-safe publishable key only.

## 2. Make sign-in visibly responsive
On submit:
- disable submit while working;
- change text to `Signing in…`;
- show an `aria-live` status message immediately (`Connecting securely…`);
- enforce a finite login timeout rather than leaving the button indefinitely disabled;
- restore the button on every failure path;
- give useful but non-sensitive errors:
  - invalid credentials -> `Email or password is incorrect. You can use Forgot password below.`
  - email not confirmed -> clear confirmation guidance;
  - network/CDN/timeout -> `Could not reach the login service. Check your connection and try again.`
  - other -> `Login failed. Please try again or use Forgot password.`
- log the underlying Supabase error to console for diagnosis, but do not display tokens, keys, stack dumps, or internal IDs.

Do not alter the existing approved-profile/RLS fail-closed behavior.

## 3. Password visibility toggle
For the login password input:
- add an accessible `Show` / `Hide` control beside the password field;
- use `aria-pressed` and an appropriate label;
- preserve password-manager/autocomplete behavior (`autocomplete="current-password"`);
- keep it usable at 320px mobile width with no horizontal overflow.

Also use the same pattern for new-password and confirm-password fields in recovery mode.

## 4. Forgot-password request
Add a `Forgot password?` action inside the login modal.

Behavior:
- use the email already entered in the login form;
- if empty, focus email and show `Enter your email first.`;
- call `supabase.auth.resetPasswordForEmail(email, { redirectTo })`;
- `redirectTo` must point back to the current deployment origin, preferably a stable public path such as `${window.location.origin}/events?password-recovery=1`;
- never reveal whether an email exists. On accepted request say: `If that email belongs to an account, a password reset link has been sent.`
- button shows `Sending…` and cannot be spam-clicked while pending;
- show a clear error if recovery email cannot be sent.

Follow current official Supabase JS guidance for `resetPasswordForEmail`, `PASSWORD_RECOVERY`, and `updateUser({ password })`.

## 5. Complete recovery state on return from email
The current `onAuthStateChange` ignores the event type. Correct this.

When Supabase emits `PASSWORD_RECOVERY`:
- keep the recovery session;
- open the auth modal automatically in `Set a new password` mode;
- show New password + Confirm password;
- both have Show/Hide controls;
- require a reasonable minimum length (at least 8 characters; do not invent complex arbitrary rules);
- confirm values match before calling Supabase;
- call `supabase.auth.updateUser({ password: newPassword })`;
- on success display `Password updated. You can now sign in with your new password.` and return the modal to normal login mode;
- remove/reset recovery query/hash noise from the visible URL when safe using `history.replaceState`, without breaking the Supabase session;
- do not route the user into privileged UI until the password update succeeds and the normal approved-profile flow has run.

## 6. Supabase redirect URL requirement
The code must work with Supabase Auth redirect allowlisting. Document this clearly in Project OS and the final report.

For the isolated Vercel pilot deployment, the deployment origin used by `redirectTo` must be added under Supabase Authentication -> URL Configuration -> Redirect URLs before recovery can be accepted reliably.

Do not change `www.birdiesgc.co.za` or point the pilot there. If the stable pilot alias is `https://birdiesgc-pilot.vercel.app`, document adding:
- `https://birdiesgc-pilot.vercel.app/**`

If Vercel gives a different stable pilot production alias, use that actual origin instead.

## 7. Preserve current pilot authorization
Do not recreate or mutate Chairman/Treasurer/Auth accounts.
Do not broaden management privileges.
Do not enable broader member login rollout.
Do not weaken RLS.
Do not modify scoring, Excel import, event/poster schema, Realtime, historical results, or mobile score-sheet rules.

## 8. Add focused regression coverage
Create `scripts/test-auth-ui.js` (or equivalent existing style) and wire it into `.github/workflows/mvp-check.yml`.

Static/regression checks should cover at minimum:
- login submit has loading/status/error recovery paths;
- Supabase CDN loader has a fallback and finite timeout;
- password visibility toggle exists and preserves `current-password` autocomplete;
- forgot-password uses `resetPasswordForEmail` and current-origin redirect;
- recovery handles `PASSWORD_RECOVERY`;
- password update uses `updateUser({ password: ... })`;
- new/confirm password matching and minimum length are checked;
- no service-role/secret key introduced;
- existing role/profile approval checks remain present;
- mobile auth UI cannot force page-level horizontal overflow.

Run all existing suites too:
- legacy import 24/24;
- mobile CSS 15/15;
- event details 14/14;
- new auth tests all passing;
- JS syntax, build, secret scan and local server smoke.

## 9. Deployment / acceptance
After tests pass:
- push to the same `agent/supabase-golf-day-mvp` branch;
- update PR #1;
- do not merge to `main`;
- deploy only to the separate `birdiesgc-pilot` Vercel project if deployment permission is available;
- never deploy this WIP branch over the existing `birdiesgc` project / `www.birdiesgc.co.za`.

Final report must include:
- commit SHA;
- exact pilot URL if deployed;
- CI results;
- whether Supabase redirect URL configuration still needs a human dashboard step;
- honest statement whether an actual browser login was performed (do not claim it if no credentials were available).
