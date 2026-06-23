# Next Action

## Immediate Next Step
Use the DNS provider panel for `birdiesgc.co.za` and make one website-only repair:
1. Change apex `@` A record from `164.160.91.17` to `76.76.21.21`, unless the Vercel Domains screen currently shows a different required apex value.
2. Leave the working `www` CNAME unchanged: `0e6b0c3e663a0b5e.vercel-dns-017.com`.

## Do Not Change
- Nameservers
- MX records
- TXT records (SPF, DKIM, DMARC, mail verification)
- Mail-related host records (`mail`, `webmail`, `smtp`, `imap`, `pop`, `autodiscover`, `cpanel`, `whm`)

## Verification After Update
Run:
- `nslookup -type=a birdiesgc.co.za`
- `nslookup -type=cname www.birdiesgc.co.za`
- `nslookup -type=mx birdiesgc.co.za`
- `nslookup -type=txt birdiesgc.co.za`

Then confirm in Vercel:
- Domain Valid status
- SSL Active
- Site loads from custom domain
- Apex redirect behavior matches chosen primary domain
- Email send/receive remains functional

## Done When
- Custom domain fully valid in Vercel
- Website served from custom domain
- Email DNS records unchanged and email flow unaffected
