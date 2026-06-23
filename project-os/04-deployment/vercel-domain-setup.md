# Vercel Domain Setup

Date: 2026-05-25
Project: `apprigate/birdiesgc`
Target domain: `birdiesgc.co.za`

## Current Vercel Project State
- Production deployment status: Ready
- Deployment id: `dpl_AET8G9HABhjjVcBQj85Vfos6wpja`
- Production URL: `https://birdiesgc.vercel.app`
- Env vars: none configured (not required for this static site)

## Domain Attachment State
- `birdiesgc.co.za` is currently aliased to the active production deployment.
- `www.birdiesgc.co.za` is currently aliased to the active production deployment.
- Vercel domain inspect still reports DNS configuration warning for apex verification.

## DNS Records To Use (Website Only)
Use Vercel dashboard values as source of truth.

Expected pattern:
- Apex/root (`@`):
  - Type: `A`
  - Value: `76.76.21.21` (or exact Vercel-provided value if different in dashboard)
- WWW (`www`):
  - Type: `CNAME`
  - Value: exact Vercel-provided CNAME target in Domains settings

## Explicit Safety Rules
- Do not change nameservers.
- Do not modify or remove MX records.
- Do not modify or remove TXT records used by SPF/DKIM/DMARC/mail providers.
- Do not modify `mail`, `webmail`, `smtp`, `imap`, `pop`, `autodiscover`, `cpanel`, or `whm` host records.

## Execution Steps
1. Open Vercel project -> Settings -> Domains.
2. Confirm both `birdiesgc.co.za` and `www.birdiesgc.co.za` are listed.
3. Copy the exact DNS records Vercel requests.
4. In DNS provider, update only:
   - apex A record
   - www CNAME record
5. Leave all email-related records untouched.
6. Wait for propagation.
7. Re-check domain status in Vercel until valid.
8. Validate SSL issued and active.
9. Validate website loads on both hostnames.
10. Validate MX records remain unchanged.
