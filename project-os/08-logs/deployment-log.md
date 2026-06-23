# Deployment Log

Record deployment attempts and outcomes.

## Template

### YYYY-MM-DD HH:MM — Deployment Attempt

**Platform:** Vercel/Firebase/Netlify/Render/Railway/Other

**Branch:** branch name

**Commit:** commit hash if available

**Result:** Success/Failed

**Build Command:** command

**Errors:** error summary

**Environment Variables Checked:** Yes/No

**Live URL:** URL if relevant

**Post-Deployment Tests:**
- test result

**Next Action:**
- action

---

### 2026-06-14 - Production Domain Incident

**Platform:** Vercel website with third-party DNS and mail hosting

**Result:** Root cause confirmed; DNS repair pending at provider

**Build Command:** `npm.cmd run build`

**Errors:** Apex domain resolves to old LiteSpeed host `164.160.91.17`; Vercel CLI network access was blocked by the runtime.

**Environment Variables Checked:** Not required for static site

**Live URL:** `https://birdiesgc.co.za`

**Post-Deployment Tests:**
- Local static build passed.
- Apex A record confirmed incorrect through default resolver, `1.1.1.1`, and `8.8.8.8`.
- `www` CNAME confirmed pointed to Vercel.
- MX and mail host confirmed unchanged.

**Next Action:**
- Update only apex `@` A record to Vercel's required value, previously confirmed as `76.76.21.21`.
- Verify apex, www, SSL, and email after DNS propagation.
