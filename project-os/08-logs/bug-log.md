# Bug Log

Record bugs, symptoms, hypotheses, evidence, and fixes.

## Bug Investigation Template

### Bug ID
BUG-YYYYMMDD-001

### Title
Short bug title.

### Status
Open / Investigating / Fix planned / Fixed / Won't fix

### Severity
Low / Medium / High / Critical

### Area
Frontend / Backend / Auth / Database / Deployment / UI / API / Integration / Other

### Observed Behavior
What actually happened.

### Expected Behavior
What should happen.

### Steps to Reproduce
1. Step one
2. Step two
3. Step three

### Evidence
Error messages, screenshots, logs, file references, test results.

### Suspected Cause
Hypothesis before fixing.

### Related Files
- file path

### Attempt History
Record each fix attempt and result.

### Recommended Next Step
What should happen next.

---

### Bug ID
BUG-20260614-001

### Title
Apex domain serves LiteSpeed directory listing instead of Vercel website

### Status
Fix planned - external DNS change required

### Severity
Critical

### Area
Deployment / DNS

### Observed Behavior
Opening `https://birdiesgc.co.za` shows an `Index of /` LiteSpeed directory listing containing only `cgi-bin`.

### Expected Behavior
The apex domain should serve the Birdie Squad website from the existing Vercel project.

### Evidence
- Apex A record resolves to `164.160.91.17`.
- `www.birdiesgc.co.za` resolves to Vercel CNAME `0e6b0c3e663a0b5e.vercel-dns-017.com`.
- MX resolves to `mail.birdiesgc.co.za`, and the mail host uses `164.160.91.17`.
- Local static build passes.

### Root Cause
The apex website A record points to the old LiteSpeed/cPanel hosting IP instead of Vercel. This is DNS routing failure, not an application crash.

### Attempt History
- Confirmed DNS state using the system resolver, Cloudflare `1.1.1.1`, and Google `8.8.8.8`.
- Confirmed the same incorrect apex result from all resolvers.
- Attempted Vercel CLI inspection/deployment; network access to the npm registry was blocked in this runtime.
- No application code, nameservers, MX, TXT, or mail records were changed.

### Recommended Next Step
Change only the apex `@` A record from `164.160.91.17` to Vercel's required apex value, previously confirmed as `76.76.21.21`. Preserve all mail-related records.
