# Beatfall work log

Shared record for work completed by Codex and Claude. Read this file before making changes and append to it after each completed, tested change.

## Standing decisions

- `CLAUDE.md` is project history and guidance, not an immutable specification.
- Work proceeds one approved change at a time.
- The official page lockup is the Beatfall icon and wordmark together. A wordmark without the icon is stale.
- Current priority is the web application. Mobile work is out of scope until Kris explicitly returns to it.
- Functional copy should be as direct as possible. More expressive writing is reserved for places where marketing or brand voice benefits from it.
- Kris runs all Git commands. Agents do not run Git in this repository.

## 4 September 2026: Public homepage

### Requested

Add a real public homepage at `/`. Move the signed-in web application to `/app` and preserve its existing behavior.

### Changes

- Moved the existing authenticated board from `public/index.html` to `public/app.html`.
- Added a new public homepage at `public/index.html` using the official icon-plus-wordmark lockup.
- Added a concrete notes-to-board demonstration, a three-step product explanation, authorship and privacy messaging, pricing, and founder positioning.
- Updated sign-in and magic-link destinations to `/app`.
- Updated affected in-product and legal-page links so “Back to the board” goes to `/app` while page branding can return to the public homepage.

### Copy direction

- Lead with the writer's existing mess becoming a visible story.
- Keep “It asks before it guesses. It never writes your script.”
- Explain functions plainly after the headline.
- Do not market Beatfall as screenplay-generation software.

### Testing

- Served the complete `public/` folder locally and confirmed the homepage, app, sign-in, billing, privacy, and terms files all return successfully.
- Reviewed the homepage visually at desktop width and at a 390 by 844 phone-sized viewport.
- Confirmed the phone-sized page has no horizontal overflow.
- Confirmed the primary homepage call to action reaches the sign-in page.
- Confirmed existing-session and magic-link sign-in paths now target `/app`.
- Added a root-page fallback that carries a returning Supabase magic link to `/app` if the redirect allowlist has not been updated yet.
- Confirmed every page uses the official icon-plus-wordmark lockup. No standalone linked wordmarks remain.
- Confirmed the touched user-interface files contain no em dashes.
- Confirmed the homepage has no duplicate element IDs.

### Deployment note

- Add `https://beatfall.app/app` to the Supabase Authentication redirect URLs before the production domain goes live. The homepage fallback prevents a failed sign-in if Supabase temporarily falls back to the site root.

### Intentionally unchanged

- No authenticated product mechanics were redesigned.
- No mobile files were changed.
- No new product features were added.
