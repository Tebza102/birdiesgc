# Tech Stack

## Frontend Stack
- Framework: None; preserve existing static website.
- Language: HTML5 + CSS3 + vanilla JavaScript.
- Build tool: None required for current static deployment.
- Styling: Existing `css/style.css` and Birdie Squad brand styles.
- UI library: None.
- Forms: Native HTML + controlled JavaScript.
- Charts: None for MVP.
- PDF/export: None for MVP.

## Backend Stack
- Managed backend: Supabase.
- Runtime/API: Supabase Data API backed by Postgres.
- Serverless/functions: None planned for MVP unless security requires it.
- Database SDK/client: Supabase JavaScript client in the browser.
- Auth SDK: Supabase Auth through the same client.

## Database and Storage
- Database: Supabase Postgres.
- Storage: Not required for MVP scorecard workflow.
- Realtime: Supabase Realtime Postgres Changes for score updates/leaderboard refresh at prototype scale.

## Deployment
- Hosting: Vercel static hosting.
- Build command: Existing static no-op build (`npm run build`).
- Output folder: Static repository root as currently configured.
- Runtime version: Preserve current deployment configuration; do not change for this MVP unless deployment proves it necessary.

## Browser Configuration
Only browser-safe Supabase values may be present in public code:
- Supabase project URL.
- Supabase publishable key (`sb_publishable_...`).

Never commit or expose Supabase secret keys, service-role keys, database passwords, or private tokens.

## Package Management
- Existing project has no runtime dependencies.
- Do not introduce a framework migration.
- If a client dependency becomes necessary, pin its version and make the smallest possible package change. Prefer an implementation that does not introduce a bundler/build-system migration.

## Stack Decisions
This stack is intentionally conservative. The objective is a fast club-testing prototype, not a full golf SaaS rewrite. Supabase provides Auth, Postgres, RLS and Realtime while allowing the existing static website and familiar visual experience to remain in place. The architecture should be revisited only after real club usage provides evidence for a larger platform rebuild.
