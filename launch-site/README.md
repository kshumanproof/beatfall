# Beatfall launch page: local review build

This is an independent launch site. Its intended Vercel project root is this
directory, with `public` as its output directory. It does not import desktop
app scripts, mobile scripts, authentication, store links or Chatling.

CURRENT PHASE: page, signup endpoint and migration built/tested locally.
NOT LIVE. The migration must be run in Supabase and the separate Vercel project
must be configured before the form can collect real emails. Admin integration
and final live verification remain pending.

The form expects POST /api/launch-signup with email, explicit consent=true,
consent_version, bounded source/medium/campaign and a website honeypot.
Only a successful response with JSON {"ok":true} displays success. Missing
backend, failed save, malformed response and offline operation display failure
and preserve the entered email. Tests execute the real migration in temporary
PostgreSQL (PGlite), never against Supabase or existing app accounts.

Database setup: run supabase/launch-list.sql in Supabase SQL editor. It creates
only launch_leads, launch_signup_limits and register_launch_lead. Rerunning is
safe. Both tables have RLS; anon/authenticated cannot access either table or
the private function. Only the server service role can submit or read leads.

The endpoint needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, server-only, in
the NEW Vercel project. Kris enters these himself. No OpenAI, Stripe, mail or
app-session keys are needed. Production origins: https://beatfall.app and
https://www.beatfall.app. LAUNCH_SITE_URL can additionally allow the new
project's exact preview origin for pre-launch testing. Do not change the beta
project's SITE_URL or mobile API_BASE.

Rate limits are stored atomically in Postgres, not per server instance:
10 attempts per fixed ten-minute bucket and 100 per UTC day per coded network
identifier. The identifier is an HMAC of the Vercel-provided client IP and UTC
date. No raw IP is stored. Old buckets are purged during subsequent signups
once older than 48 hours. This is abuse reduction, not a claim to stop every
bot. There is no email send, paid service, account creation or credit charge.
Duplicates preserve first attribution and permission date; an explicit rejoin
after removal renews permission without creating another row.

Before publishing:
- Run the tested additive launch-leads migration, separate from accounts.
- Configure the new project's server-only database settings and allowed origin.
- Verify a real signup, duplicate and failed save on the separate deployment.
- Add/test protected Launch list admin reporting and export as agreed.
- Create a separate Vercel project, then attach the public domain carefully.
- Keep beta app SITE_URL, mobile API_BASE and shared auth/sync behavior intact.
- Preserve all existing mail DNS records when changing the web address.

Assets are byte-for-byte copies of the existing approved local brand and
screenshots. No mobile app/store assets were changed.
Typography uses the exact deployed Google Fonts assets, served locally with
their licenses, and the existing homepage's responsive font sizes.

Run npm test for page, typography comparison, handler, SQL permissions,
duplicates, abuse limits and an integrated browser-to-database test. Browser
tests accept BROWSER_EXECUTABLE for a locally installed Chrome/Chromium.
