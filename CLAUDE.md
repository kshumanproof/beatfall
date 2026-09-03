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
- Icons in `assets/` are built from Kris's mark by `tools/mkicon.py`, which
  reads `tools/mark.png` (his artwork, black export field flood-filled away).
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
He likes the "two scripts open…" sentence; it stays. Above the project cards:
four counts — beats filled / total, still empty (gold), beats placed this week,
days in a row — over a seven-day chain of dots and a progress rail.

The third cell was wrong three times, and the sequence is the lesson:

1. **"Cards written"** counted every card in the project, so a pasted notes
   file showed up as **171** things Kris had supposedly written. Flattering and
   confusing.
2. **"This week"** — beats placed in seven days. He rejected it: on a quiet
   week it is a zero that scolds, and a count of your own past effort is not an
   incentive.
3. **"Notes to sort"** — honest, but 158 unsorted notes is a wall. "Daunting"
   was his word, and he was right.
4. **"Nearly finished"** — the one script closest to a full board, named, with
   its bar, its percentage, the beats left and the next hole. Double width,
   because a title is not a number and will not live in a number's column. The
   title opens that board.

Every rejected version pointed backwards at the writer or at the size of the
pile. The one that stuck points at the single next thing worth an hour. A
scoreboard figure has to point somewhere, and forward is the only direction
that helps.

The chain hangs off `save()`, never off a render: a day counts when the writer
changed something, not when they opened a tab. `beatfall.days` in `localStorage`
— per-browser, private, resets on a new machine. Known limit, not a bug.

No points, no badges, no invented currency. Every figure is a count of something
they actually did.

This lived briefly as a separate band under the strip; it belongs in the strip.
A finished board steps aside for the next one behind it — complete is not
"nearly finished", it is finished — and if nothing is started the cell says so
instead of showing a leader among zero. Cell 1 dropped its "% of the way" note
when this landed, because the percentage is now said here.

Watch the cascade: `.score-cell.wide`'s narrow-screen override must sit AFTER
the desktop rule in the file. A media query adds no specificity; source order
is all that decides, and the override was silently losing at every width until
the block was moved down.

**The lockup.** Kris supplied a finished lockup on 2 Sep; the SVG is measured
off it, not eyeballed. Bars are 181x37 with a 6px gap and a ~8px corner radius
(rounded rectangles, NOT pills — the pill version was wrong); the falling card
is the same rectangle rotated -12 degrees, centred on the same axis, its lowest
corner about 4px above the top bar; three hairline ticks above it, drawn
thicker than literal because at 29px the true weight disappears.

The stack sits ON the wordmark's baseline: the mark's bottom edge IS the bottom
of the lowest card, and a replaced element's baseline is its bottom edge, so
`.brand` uses `align-items:baseline` and needs no magic offset. In his lockup
mark height is 1.33x cap height with a gap of 0.18x cap; ours runs a little
larger (29px mark against a 29px wordmark, cap 19.7 — ratio 1.47, gap 6px)
because his exact ratio turns the bars to mush at UI size. `theme.css` carries
24px/5px for the 24px wordmark on the other pages. Centre alignment is what
made it look crooked; don't go back to it.

**Removed from the dashboard, 2 Sep:** the grey subtitle ("33% of the way in.
Nothing has gone cold."). Kris likes the line but it describes ONE script, so it
belongs on that script's own page. Put it there when the project page is built —
do not put it back on the dashboard.

## The mark (2 Sep 2026)

**Branding is settled.** Kris rejected both designers' marks and then supplied
his own: three blue index cards stacked, one gold card still falling into place,
three motion ticks above it. That IS Beatfall — the name drawn.

It is redrawn as inline SVG in the header of every page, so it takes the palette
into dark mode and costs no request, and rasterised from his PNG for the
favicon, the touch icon and the phone app. Do not propose alternatives.

`/home/claude/mkfavicon.py` builds the web set from his artwork; the supplied
PNG has an opaque black export field, flood-filled away from the corners rather
than colour-keyed, so the mark's own dark ink survives.

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

## The dashboard lede (2 Sep 2026)

"One project saved. Six beats empty." One line at EVERY width — it used to wrap
to two lines on a laptop and three on a phone, which turns the first thing a
writer sees into a paragraph. `white-space:nowrap` plus
`font-size:clamp(17px, 2.55vw + 4px, 34px)`, so it shrinks to fit rather than
wrapping. Both figures are totals across every project, not the active one.

The floor of that clamp is set from the longest string the code can generate
("Twelve projects saved. 171 beats empty.") fitting a 390px phone. If the
wording gets longer, re-check the floor.

Adding `min-width:192px` to the two slate buttons — Kris asked for a matched
pair — pushed the phone into horizontal scroll, because two of them plus the
gap is wider than 390px. Under 760px they drop the fixed width and share the
row with `flex:1 1 0`, which keeps them equal by a different means.

## Project cards (2 Sep 2026)

Rebuilt from a table row into a title card.

- **A grade leads it.** Big serif percentage with COMPLETE beneath, the beat
  counts beside it as the working-out. Zero is a real answer and is shown as
  one — greyed, but stated, because a card that says nothing about an untouched
  project is worse than a card that says 0%.
- **Everything clickable is a button.** Kris's rule, and the old card broke it
  badly: Open, Details and What's missing were blue text that read as a
  caption, and the title was a link with no affordance at all. The title is now
  a plain heading — the way in is the filled blue **Open** button.
- **Next up became a control.** It was the most useful thing on the card and it
  was styled as a footnote. It is now a gold-bordered button spanning the card;
  pressing it opens the conversation about that beat, which is what the old
  "What's missing" text link did. That link is gone — one affordance, not two.
- A finished board shows a sage "Every beat has a card." panel in its place.

## The tagline (2 Sep 2026)

"Where your story falls into place." Kris's line. It lived in the header for
about an hour and he said it felt out of place. He was right, for two reasons
worth keeping:

1. It was on the dashboard TWICE, header and footer. Nobody consciously
   notices a repeat like that; they just feel the page is off.
2. In the header it sat in the slot that holds the script's NAME on a board,
   so it read as a label for what you were looking at, which it isn't.

**It lives in the footer only now**, under the lockup, where a tagline goes.
Do not put it back in the header.

The footer lockup reuses the header's `.brand` markup verbatim, just smaller
(`.foot-brand .wordmark` 22px, `.mark` 26px). The first version hand-built a
separate mark beside a separate `.foot-name`, which is exactly how two copies
of one lockup drift until somebody says the wordmark looks weird. He did.

The masthead went 29px to 34px (mark 34px to 40px) at the same time. The bar
had the room once the tagline left.

## Copy rule: no em dashes (2 Sep 2026)

Kris asked for none anywhere, and there are none: every page, `app.js` and
`theme.css` are at zero, comments included. Do not reintroduce them.

They were not swapped for one substitute, because the em dash was doing three
different jobs in this copy and one character gets two of them wrong every
time: introducing a list (now a colon), holding an aside (commas or brackets),
joining two independent clauses (a full stop). Each was rewritten by hand.

Two knock-on effects worth remembering, both of which would have shipped
silently:
- Structure labels changed from `"Feature — Save the Cat!"` to
  `"Feature · Save the Cat!"`, and TWO pieces of code strip that prefix by
  regex: `structureLine()` and the structure-switch message. Both had
  `/^[^—]*— /` and now have `/^[^·]*· /`.
- `DECLARED` still matches `[:\-–—]` on purpose. That regex reads the WRITER'S
  notes, and a writer may well type an em dash. Our copy has none; theirs is
  theirs.

## Footer, account, legal pages (2 Sep 2026)

- **Footer.** Was an italic paragraph floating under the board. Now a real
  footer: rule across the top, surface background, the mark and the tagline,
  two short columns (what happens to your material, how placing works) and the
  three links that belong at the bottom of a site.
- **Account control.** Was a 32px circle with an initial in it, bottom-left.
  That is a convention people who build software know and nobody else does, and
  the question it produces is "how do I get to my profile?" It is now a pill
  that says **Account** next to the initial, with a chevron. Below 760px it
  drops back to a circle; the capture dock's left padding clears whichever.
- **Legal pages.** Top links are real buttons now (Privacy/Terms outlined,
  "Back to the board" filled), and both docs end with a Back to the top button
  against `id="top"` on the topbar.

## Project card titles (2 Sep 2026)

Set in caps by CSS (`text-transform`), never by changing the stored name, so
what the writer typed is what is saved, exported and shown everywhere else.
Size dropped 22px to 19px with letter-spacing added, because caps at the old
size shout.

**Every card is the same shape whatever is in it.** The logline block reserves
three lines and clips past them; next-up and the finished panel share a 46px
slot; the buttons sit on the floor with `margin-top:auto`. So the grade, the
bar, the slot and the buttons start at the same height on every card in a row,
and a shelf of projects reads as a shelf rather than a pile. Verified with
`/home/claude/uniform.js`, which builds four projects in four different states
and asserts the offsets match.

A clipped logline keeps its full text in a `title` attribute and is whole
everywhere else. A logline is meant to be one sentence; three lines is already
generous.

## Credits, access and deletion (2 Sep 2026)

Decided by Kris this morning and built the same day. The whole model in one
place, because it is spread across six files.

### Two buckets

- **Monthly** = plan.credits (150). Resets on the 1st. Whatever is left of it
  evaporates. It is what `credits_used` counts against.
- **Banked** = `credits_extra`. Bought. Never renews, never expires, and is
  only touched once the month's allowance is gone.

`spend(profile, ent, n)` in `api/_lib/core.js` is the only thing that moves
either number, and the order is not negotiable: monthly first. Spending banked
first looks protective but burns what somebody paid for while their free
allowance expires unused.

**The bug this replaced.** `allowance` was `plan.credits + credits_extra` and
the monthly reset only zeroed `credits_used`. So one $6 top-up raised that
account's allowance by 100 credits EVERY MONTH, forever. Kris found it by
asking a question about rollover. Verified fixed by `/home/claude/credits.js`,
which walks the spillover and asserts a new month still reads 150.

### Pricing

Pack is **50 credits for $6**, down from 100. Not a cost decision: measured
cost is about a penny a credit, so 100/$6 was still 80% margin. It is an
anchoring decision. The plan is 150 for $12 (8c a credit); a pack at 100/$6
was 6c, ie CHEAPER than subscribing, which taught people to skip the plan.
50/$6 is 12c, so the plan is plainly the better deal.

Measured with `/home/claude/cost.js` and `cost2.js`, which drive the real
flows with a fake `ai_sample` and size the actual payloads: a 3-turn
conversation is $0.0064, a 200-note import is $0.0333.

### Warnings

Counted DOWN in credits, never up in percent. "Eight left" is actionable;
"95% used" is not. Kris proposed 95%; that is 8 credits, one evening, too late
to be a warning.

- **30 left** a gold count rides on the Account pill. No interruption.
- **10 left** one strip above the dock, dismissible, once per credit period
  (`beatfall.lowseen` in localStorage, keyed to `period_start`).
- **0** the message comes from the server where the writer is standing.

### Access when a plan ends

Kris's call, and he overruled me on it: this is SaaS, the subscription buys
access, when it lapses you lose access. `api/projects.js` returns 402 for
`ent.key === 'none'`, and the client shows `showLocked()`.

The one door left open is **export**, which lives on `api/account.js` and is
NOT gated. That is deliberate: closing the boards is a business decision,
holding a writer's notes hostage is a different thing. The locked screen leads
with Choose a plan and Download everything.

Banked credits survive a lapse untouched. They are unusable while there is no
subscription, because the door is shut, but they are still there on return.

### Six-month deletion

`api/cleanup.js`, on Vercel's daily cron (`vercel.json`, 04:00 UTC). Six
months with no sign-in and no live subscription and the auth user is deleted,
which cascades to profile, projects, usage and events. A warning email goes at
five months, once, recorded as a `deletion_warned` event so a second pass will
not repeat it.

**Kris's actions before this does anything:** set `CRON_SECRET` in Vercel (the
endpoint refuses without it), and `RESEND_API_KEY` + `MAIL_FROM` or the
warning email goes nowhere while deletion still happens on time. Test with
`/api/cleanup?dry=1` and the secret, which reports what it WOULD do.

### Where billing is written down

Three places, and they have to agree:

- **`public/billing.html`** is the plain version and the one to keep current.
  Price, what a credit buys, the two buckets, the warning ladder, what happens
  on cancel, the six-month rule, refunds. Linked from the footer, from Settings,
  and from the top bar of both legal pages.
- **Terms §8 and §8b** are the contract, and open with a pointer to that page.
- **Privacy** retention list carries the six-month rule.

Every number on billing.html is also a constant in `api/_lib/core.js`. Change
one, change the other in the same commit or the page starts lying.

### Cancelling

`confirmCancel()` in index.html. A sheet that states four facts and the
six-month rule, with a checkbox that has to be ticked before Continue works,
and a "Download my work first" button right there. Then `action: 'cancel'` in
billing.js opens Stripe's portal deep-linked to its cancel step
(`flow_data.type = 'subscription_cancel'`).

The checkbox is not a dark pattern: nothing is hidden behind it and the button
sits next to it. It exists so "I didn't know my boards would close" is not a
sentence anybody can honestly say afterwards. Stripe's own cancel screen says
nothing about what happens to a person's WORK, which is the only part a writer
cares about.

A pack can still be bought while a cancellation is scheduled. Kris's call and
he was right: buying credits was never a way to keep access, access is the
subscription, and blocking the purchase decides for them. The copy says the
credits would wait in their account instead.
