# Beatfall — working notes for Claude

Read this first. It is not documentation for humans; it is the state I need to
hold so Kris doesn't have to hand it back to me.

## What this is

A beat board for screenwriters. It reads a jumbled notes file, works out which
ideas are story beats and which are character/line/research notes, places the
beats into whichever of nine structures the writer chose, and shows the holes
between them. The product is the empty beat, not the board.

One principle everything follows from: **it asks rather than guesses.** An empty
beat costs nothing; a wrong one costs trust. AI placements gate on confidence —
75+ places, 55–74 offers as "possibly", below 55 places nothing.

## How Kris wants to work

- **Don't hand him lists to read.** Hold the state and act on it.
- **One step at a time.** He has said more than once that I get too far ahead.
- **Plain language.** He is not an engineer. No jargon without explanation.
- **Less, not more.** Shorter answers. No caveats he didn't ask for.
- **When he decides, execute.** Don't re-litigate a settled decision.
- **When he says he's handling something, stop raising it.**

## Hard constraints

- **Never run git in `C:\Users\KrisShuman\beatfall`.** A `git status` there once
  left a `.git/index.lock` that blocked his commits. Read `.git/logs/HEAD`
  directly if I need repo state. He runs every git command himself.
- **Never ask for or handle an API key, secret, or service_role key.** Keys go
  from the source site straight into Vercel's env box. Never screenshot one.
- I don't create his accounts, enter payment details, or deploy for him.
- Deliver files with `SendUserFile` → `device_commit_files`. Never base64 patches.

## Current state (2 Sep 2026)

Deployed at beatfall-beta.vercel.app. Auth, database, billing and the AI
pipeline work end to end. Stripe is in test mode. Domain not pointed. No writer
outside Kris has used it. Design pass done; handoff sent to a designer and an
engineer for review — feedback pending.

Stack: one 4,900-line `public/index.html` (no build step), seven Vercel
serverless functions in `api/`, Supabase Postgres with row-level security,
Claude Haiku 4.5 behind a metered server-side proxy, Stripe Checkout + portal.

Pricing: 14-day card-free trial, then $12/mo or $99/yr, 150 credits a month.
Placing notes is free forever. A whole conversation is 1 credit, an import 2.

## Verifying a change

There is no test suite. `/home/claude/mkstub.js` builds an offline copy of
`index.html` with `BF` stubbed and the real jsPDF, and the `v*.js` Playwright
scripts drive the real UI headlessly. Run them after any board change. They
catch structural breakage, not judgement.

The model is non-deterministic — two identical import runs move a beat or two.
No single run proves anything.

## Direction change: mobile companion (2 Sep 2026)

Beatfall launches as a web app **plus a phone sidekick whose job is capture**.
The phone collects notes and connects them to the writer's project on the web
app. It is explicitly NOT a small board — no spatial rearrangement on a phone.
Two independent designer reviews reached the same conclusion, and Kris has
decided it.

**The sidekick is a real native app, downloadable from the Apple App Store and
Google Play.** Kris said this plainly. It is NOT a responsive website and NOT a
PWA. The responsive breakpoints shipped on 2 Sep make the *web app* usable on a
phone — necessary, but a different thing. Do not conflate them again.

Phone does: capture a note, review one question, read the outline, approve a
proposed placement, check sync. It does not do: board rearrangement, structure
switching, bulk import.

What a native build brings that the web app has never needed: capture must work
with no signal and reconcile later (the web app's `flush()` is save-over-the-wire
or nothing — there is no offline story today); an Apple Developer account and a
Google Play account, both Kris's actions and both involving payment I must not
touch; store listings and review; and a release pipeline separate from Vercel.

**The app is being built BEFORE the ten-writer test.** Kris decided this on
2 Sep. The test does not run until the phone app exists.

### Built so far — `mobile/` in the repo

Expo SDK 57 / React Native 0.86, one screen, bundle id `com.beatfall.app` on
both platforms. Runs on a phone today through Expo Go (`npx expo start`).

- `src/store.js` — SQLite. A note is written to disk BEFORE the screen says it
  was kept; the network is never in that path. Soft deletes so a tombstone can
  sync. Client-generated ids are the sync idempotency key.
- `src/store.web.js` — memory-only, picked by Metro for `--platform web` ONLY.
  It exists so the screen can be rendered in a browser for review; expo-sqlite's
  web backend wants a WASM asset that won't resolve. Never ships to a phone.
- `src/config.js` — `SYNC_ENABLED = false`. While false, every word about
  syncing stays off the screen. There is nowhere to sync to yet, and "3 waiting
  to sync" on a first run would be a lie.
- Fonts are deep-imported per weight; importing the package root drags 4.3MB of
  unused faces into the binary.
- Icons in `assets/` are placeholders — paper and the wordmark's `b`. Branding
  is still closed; replace them when the mark lands. `tools/mkicon.py` rebuilds.
- `.vercelignore` keeps `mobile/` out of the web deployment.

**Next on the app, in order:** sign-in (Supabase magic link on the phone), a
`captures` table + `/api/captures` endpoint that is idempotent on the client id,
the sync loop, then an Inbox in the web app where phone notes arrive. A phone
note belongs to no project — it lands in one inbox and gets sorted at the desk.
Kris has not ruled on that; it is my recommendation and it is what the code
assumes. Do NOT read or write the project JSON blob from the phone — last writer
wins, and it would clobber desktop edits.

## Dashboard scoreboard (2 Sep 2026)

Kris asked for the dashboard to read like a scoreboard and be gamified a little.
He likes the "two scripts open…" sentence; it stays. Added above the project
cards: four counts — beats filled / total, still empty (gold), cards written,
days in a row — and a seven-day chain of dots, over a progress rail.

The chain hangs off `save()`, never off a render: a day counts when the writer
changed something, not when they opened a tab. It lives in `localStorage`
(`beatfall.days`), so it is per-browser and private, and it resets on a new
machine. That is a known limit, not a bug to chase yet.

No points, no badges, no invented currency. Every figure is a count of something
they actually did.

**Branding is closed.** Kris rejected both designers' marks. The existing
wordmark stays. Do not reopen the mark question or propose graphics.

## Taken from the two designer reviews

- **Post-import interpretation screen.** The highest-value item in either doc.
  After an import, report what was found ("42 usable notes: 11 beats, 24
  character/dialogue/research, 7 that need your call"), name the widest gap,
  and offer one question. Never dump the writer onto a silent board.
- **Gap Lens.** A ranked view of the most consequential holes, one focused
  question each, no auto-writing. Good idea, good name.
- **Uncertain-note review queue.** The 55–74 confidence band becomes a
  reviewable sequence rather than dead inventory in Set Aside.
- **Responsive columns** instead of a fixed row: 1440+ = 5, 1180–1439 = 4,
  900–1179 = 3, under 900 = outline-first with native capture. Solves the dead
  column at 1440 and the phone breakage in one move.
- **Structure-switch preview** — "11 cards move, 3 need review, 2 pinned stay" —
  before committing, with a named restore point.
- **Trial ramp** at days 1, 7, 11, 13, 14 and 21 rather than one warning.
- **Never encode state by colour alone.** Pair blue/gold with label, icon or
  position.
- **Keyboard-first**: C capture, Cmd+K menu, G-then-B board, Cmd+Enter place,
  Cmd+Z undo, ? shortcuts. P1, not P0.

## Rejected from those reviews, with reasons

- **The palette rewrite.** Doc 1 proposes canvas #F3EFE7, paper #FFFDF8, ink
  #24201B, action #2E5E8C — 2–4% nudges off ours with no argument. Churn.
- **Rounded corners** (4px controls, 8px modals). Square corners are the
  index-card decision; both docs praise it elsewhere and then contradict it.
- **Zoom modes** (Comfortable / Compact / Story map). Feature bloat pre-launch.
- **Dashboard → Overview.** Their point is fair — "Dashboard" is software
  language — but Kris named it. His call, not a designer's.
- Neither doc caught the broken PDF export, the invisible save failure or the
  silent out-of-credits state, because they were reading a document rather than
  running the app. Treat them as opinion on a description, not findings.

## Contrast defect — verified, real

Measured against our own grounds:

- Gold `#8A6A1E` on ground `#F1EEE7` = **4.36**, below the 4.5 AA threshold for
  normal text. Their fix, `#7B5A13`, measures 5.47. Correct — adopt for small
  gold text; keep `#D9C08A` for non-text hairlines.
- **Worse, and neither doc caught it:** `--ink-3 #9C9287` = **2.64** and
  `--ink-4 #A79C8E` = **2.33** on ground. ink-3 carries every beat-job
  description, caption and figure caption in the product. Both fail badly.
  Darkening ink-3 to roughly #6E655C-level and ink-4 to ink-3's old value is the
  real accessibility fix.
- Blue `#2C5C8F` = 5.97 and dark-mode gold `#D9BC77` = 9.70. Both fine.

## Before ten writers touch it

Ordered. Everything in the first group changes whether the test is worth running.

**Blocks the test**
1. Re-run `supabase/schema.sql` — `api/admin.js` is deployed against a
   `card_count` column a trigger maintains. If the SQL hasn't been re-run, the
   admin dashboard is failing. File is idempotent. *(Kris's action)*
2. Push the audit fixes (PDF export repair, dead code, stale comments). *(Kris)*
3. **Instrument events.** The app records exactly one client event:
   `first_run_choice`. The test would produce impressions, not data. Need
   `import_done` (notes in, beats filled), `card_placed`, `conversation_started`,
   `conversation_carded`, `ideas_used`, `project_created`, `board_returned`.
   `events` table and `BF.track` already exist.
4. Tester pack — invitation, what to try first, honest known-issues note, how to
   send feedback.

**Would distort the results**
5. Phone layout. At 390px the page scrolls to 491px; the project name prints on
   top of the beat tally; the capture field squeezes to ~11 characters. Board and
   cards are fine — it's the header and the dock. Fix, or scope the test to
   desktop deliberately. *(needs Kris's call)*
6. Out of credits says nothing. Only signal is a red number inside a closed
   popover; "Ask what's missing" stays offered and fails when clicked.
7. A failing save is invisible. Over the 400KB cap the client retries every 5s
   forever behind an 11px grey "not saved — retrying". ~400 long notes reaches it.
   A 401 hard-redirects to login, taking unsaved work with it.
8. Nothing happens after an import finishes — no pointer at the widest gap.
9. The trial ends silently on day 14. No email, no warning.

**Verify, don't build**
10. A conversation costs 1 credit, not 5, on the live build. Written, never
    confirmed against production.
11. Seven of nine structures never run against real notes. Short film first.
12. Billing edges: `4000 0000 0000 0341` → past_due; the $6 top-up webhook has
    never fired; resend `subscription.updated` to backfill the renewal date.
13. Second browser; `/admin.html` refuses a non-admin account.
14. Export the JSON and read it; then delete a throwaway account. Do this last.

**Decided, not forgotten**
15. Settings modal doesn't trap focus (tabbing escapes it). Escape works.
16. Board wrapping — four beats per row at 1440px, a fifth misses by six pixels.
    Card 262→250 would fit five. Design question, not a bug.
17. The mark — four candidates drawn, none adopted, with the designer.
18. Pre-launch legal cleanup — **Kris owns this and has said so. Do not raise it.**
19. Go live: domain, Stripe live mode, Anthropic spend cap, sign-in email design.

**Ten-writer test stays pinned at the bottom** until Kris says otherwise.

## Things already fixed that used to bite

- The importer once packed a 206-line file almost entirely into Opening Image.
  Rebuilt: index-addressed batches of 40, `MAX_PER_BEAT = 3`, confidence gate.
- Dragging a note onto an outline beat used to convert it into a beat card, and
  deleting it from the board destroyed the note. Notes now *attach* to a beat and
  keep their identity.
- "Empty this board" used to delete Notes too, with no confirmation.
- Undo was a single slot; now a 30-deep stack with Cmd/Ctrl-Z.
- Save as PDF called `claude.use("downloads")` — an artifact-runtime leftover that
  never worked on the real site.
- A project row carrying a structure key from before the rename (`vert`) threw on
  render — thirty-odd unguarded `STRUCTURES[proj.structure].slots` lookups, any
  one of which would have shown a writer a blank board. `load()` now coerces
  unknown keys to `stc` at the door.
