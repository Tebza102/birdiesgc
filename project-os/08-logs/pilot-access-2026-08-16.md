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

## Deployment note
This access configuration is live in Supabase immediately. Frontend availability still depends on deploying a build that uses the shared Supabase Auth implementation; do not assume the public production site is running the feature branch until deployment is verified.
