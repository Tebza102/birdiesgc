# Current DNS Snapshot

Date: 2026-05-25
Project: birdiesgc
Domain: birdiesgc.co.za
Prepared by: Codex deployment agent

## Data Sources Captured Before DNS Recommendations
1. `vercel domains inspect birdiesgc.co.za`
2. `vercel domains inspect www.birdiesgc.co.za`
3. `vercel alias ls`
4. `nslookup -type=a birdiesgc.co.za`
5. `nslookup -type=cname www.birdiesgc.co.za`
6. `nslookup -type=mx birdiesgc.co.za`
7. `nslookup -type=txt birdiesgc.co.za`

## Observed Results

### Vercel Domain Inspect: Apex
- Domain exists in Vercel account: `birdiesgc.co.za`
- Registrar: Third Party
- Current nameservers: `ns3.za-dns.com`, `ns5.za-dns.com`
- Vercel warning: domain not fully configured for Vercel DNS verification yet.
- Vercel recommended website record: `A @ 76.76.21.21`

### Vercel Domain Inspect: WWW
- `www.birdiesgc.co.za` is recognized under the same domain context in Vercel.

### Vercel Alias State
- `birdiesgc.co.za` currently aliases to deployment `birdiesgc-elf5smn01-apprigate.vercel.app`
- `www.birdiesgc.co.za` currently aliases to deployment `birdiesgc-elf5smn01-apprigate.vercel.app`

### Direct DNS Query Attempt From This Runtime
- `nslookup` calls timed out from this execution environment.
- No MX/TXT values could be read directly here due network/DNS resolver timeout.

## Safe DNS Change Scope (Website Records Only)
Allowed changes only:
- Apex/root A record (`@`)
- `www` CNAME record

Forbidden changes:
- Do not change nameservers
- Do not modify MX/TXT records
- Do not modify mail-related host records (`mail`, `webmail`, `smtp`, `imap`, `pop`, `autodiscover`, `cpanel`, `whm`)

## Required Registrar Panel Validation (Manual)
Run and record from a network with DNS access:
- `nslookup -type=a birdiesgc.co.za`
- `nslookup -type=cname www.birdiesgc.co.za`
- `nslookup -type=mx birdiesgc.co.za`
- `nslookup -type=txt birdiesgc.co.za`

Store screenshots or copied outputs alongside this file after registrar-side updates.

## Incident Snapshot - 2026-06-14

### Confirmed Public DNS
- Apex A: `birdiesgc.co.za -> 164.160.91.17` - incorrect for website traffic
- WWW CNAME: `www.birdiesgc.co.za -> 0e6b0c3e663a0b5e.vercel-dns-017.com` - correct
- MX: `birdiesgc.co.za -> mail.birdiesgc.co.za` - preserve
- Mail A: `mail.birdiesgc.co.za -> 164.160.91.17` - preserve
- SPF TXT references `164.160.91.17` - preserve

### Required Repair
Change only the apex `@` A record from `164.160.91.17` to Vercel's required apex value, previously confirmed as `76.76.21.21`. Do not change nameservers, MX, TXT, or mail-related host records.
