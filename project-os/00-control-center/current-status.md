# Current Status

Date: 2026-06-14
Scope: Production domain outage recovery with email hosting protection

## Objective
Connect website traffic for `birdiesgc.co.za` to Vercel while preserving existing email hosting records.

## Verified State
- Vercel project: `apprigate/birdiesgc`
- Production deployment: Ready (`dpl_AET8G9HABhjjVcBQj85Vfos6wpja`)
- Deployment URL: `https://birdiesgc-elf5smn01-apprigate.vercel.app`
- Vercel aliases include:
  - `birdiesgc.co.za`
  - `www.birdiesgc.co.za`
- Environment variables: none required for current static deployment.
- Local static build passes.

## DNS Safety State
- Nameservers are third-party (`ns3.za-dns.com`, `ns5.za-dns.com`) and must remain unchanged.
- Apex `birdiesgc.co.za` currently resolves to `164.160.91.17`, which serves a LiteSpeed directory listing instead of the website.
- `www.birdiesgc.co.za` correctly resolves by CNAME to `0e6b0c3e663a0b5e.vercel-dns-017.com`.
- MX remains `mail.birdiesgc.co.za`; `mail.birdiesgc.co.za` resolves to `164.160.91.17`.
- SPF TXT includes `164.160.91.17`, so the old hosting IP must remain available for mail.
- Required website-only repair: change the apex `@` A record from `164.160.91.17` to Vercel's required apex value, previously confirmed as `76.76.21.21`.

## Blockers
- The authoritative DNS provider panel is not accessible from this workspace.
- The apex A-record change must be made in the DNS provider panel.
- Vercel CLI network access was blocked during the incident response, so the existing production deployment could not be refreshed from this runtime.

## Controlled Files Updated
- `project-os/04-deployment/current-dns-snapshot.md`
- `project-os/04-deployment/vercel-domain-setup.md`
- `project-os/04-deployment/domain-verification-checklist.md`
- `project-os/09-agent-skills/domain-deployment-agent.md`
- `project-os/00-control-center/current-status.md`
- `project-os/00-control-center/next-action.md`

## Last Updated
2026-06-14 by Codex deployment incident response.
