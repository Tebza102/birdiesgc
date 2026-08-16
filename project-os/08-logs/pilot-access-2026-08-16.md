# Pilot Access Configuration — 2026-08-16

## Purpose
Record the approved pilot management access state for Birdie Squad Golf Club. This file intentionally contains no passwords, reset tokens, service-role keys, or other secrets.

## Approved privileged accounts

| Person / function | Login email | Platform role | Linked roster member | Status |
|---|---|---|---|---|
| System Administrator | apprigate@gmail.com | admin | none | approved |
| Chairman — Tinini Mokotong | smokotong@birdiesgc.co.za | management | MR TININI MOKOTONG | approved |
| Treasurer — Katleho Sebusi | ksebusi@birdiesgc.co.za | management | MR KATLEHO SEBUSI | approved |

## Pilot access policy
- The System Administrator remains the sole `admin` account for this pilot.
- Chairman and Treasurer use the existing `management` role.
- `management` retains the current database permissions for club operations: manage members, golf days, participants, and scoring where existing RLS permits it.
- Broader member-login rollout is intentionally deferred to a later phase.
- Passwords are managed through Supabase Auth and must never be committed to GitHub.

## Verification performed
The live Supabase project was checked after account creation and showed exactly these three approved `admin`/`management` accounts. Chairman and Treasurer were linked to their existing roster member records.

## Live backend status
- Gate 2D rich event details + poster support is now applied to live Supabase.
- The `event-posters` bucket is public-read, accepts JPG/PNG/WebP up to 5 MB, and restricts insert/update/delete to approved `admin`/`management` users.
- The repository migration was corrected for hosted Supabase by removing an unnecessary attempt to alter ownership-controlled `storage.objects` RLS state.
- The legacy workbook `SECURITY DEFINER` RPC no longer grants EXECUTE to `anon`/`public`; authenticated access remains and the function's internal approved-admin check remains authoritative.

## Security advisor status
- Anonymous execution warning for `import_legacy_workbook` was cleared by revoking `anon`/`public` EXECUTE.
- The remaining authenticated SECURITY DEFINER warning is expected because signed-in admins use this RPC and it performs its own server-side approved-admin check.
- Supabase leaked-password protection is still disabled and should be enabled before broader membership rollout if the project plan supports it.

## Deployment note
A separate Vercel pilot project `birdiesgc-pilot` was created and linked to this GitHub repository so the existing production site at `www.birdiesgc.co.za` is not overwritten during pilot testing. The final publish from the linked authenticated checkout still requires `vercel --prod --yes` to be executed successfully. Do not treat the pilot URL as live until that deployment is confirmed.
