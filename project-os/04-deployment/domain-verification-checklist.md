# Domain Verification Checklist

Date: 2026-05-25
Domain: `birdiesgc.co.za`

## Pre-Change
- [x] Production deployment is Ready on Vercel.
- [x] Vercel aliases include apex and www for this deployment.
- [x] Current DNS snapshot captured in `current-dns-snapshot.md`.
- [x] Email safety constraints documented.

## DNS Change Rules
- [ ] Only change apex A record.
- [ ] Only change www CNAME record.
- [ ] Do not change nameservers.
- [ ] Do not touch MX/TXT/mail-related records.

## DNS Validation (Run after registrar update)
- [ ] `nslookup -type=a birdiesgc.co.za`
- [ ] `nslookup -type=cname www.birdiesgc.co.za`
- [ ] `nslookup -type=mx birdiesgc.co.za`
- [ ] `nslookup -type=txt birdiesgc.co.za`

## Vercel Validation
- [ ] Domain status is Valid in Vercel.
- [ ] SSL certificate is Active.
- [ ] Root/apex redirects to chosen primary host.
- [ ] Website loads successfully from custom domain.

## Email Safety Validation
- [ ] MX records still resolve to current email host.
- [ ] SPF/DKIM/DMARC TXT records remain unchanged.
- [ ] Email send/receive test passes.

## Completion
- [ ] Update `project-os/00-control-center/current-status.md` with final verified state.
- [ ] Update `project-os/00-control-center/next-action.md` with any remaining action.
