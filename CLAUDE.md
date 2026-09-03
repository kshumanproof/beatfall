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
- **He runs commands in the VS Code terminal, which is Windows PowerShell.**
  `&&` is a parse error there. Chain with `;` instead, and give the whole
  command on one line ready to paste.
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

## How we talk about the AI (2 Sep 2026)

Kris's rule, and it is a product decision rather than a style one: writers and
filmmakers are broadly against generative AI, many for good reasons, and they
will still use a tool like this. What they will not forgive is having it waved
in their face.

Two halves, and both matter:

1. **Never claim we are not using it.** Every statement about what happens to a
   person's material stays plain, and Privacy still names **Anthropic** as a
   subprocessor. That is a legal disclosure and being coy there would be the
   real dishonesty. The Terms and Privacy keep their precise language.
2. **Everywhere else, drop the proper noun AND the category noun.** Not
   "Claude", not "the AI", not "the model", not "generative".

The vocabulary that replaced them:

- The product does the thing: **"Beatfall reads it"**, "Beatfall suggests where
  it belongs", "it asks".
- The metered capability is **"the writing help"**. Never "the AI features".
- Failures are **"Couldn't get an answer just now"**, never "couldn't reach
  Claude".

Code comments are deliberately left alone. They name real infrastructure, no
writer reads them, and blurring them would make the code harder to work on.

Audit with a comment-stripping grep for `Claude|\bAI\b|the model` across
`public/*.html` and `public/app.js`; user-facing hits should be zero.

## Copy standard (3 Sep 2026)

From an outside UX-writing brief Kris commissioned, adopted as the house rule:
**the brand may be evocative, the product must be plain.** Brand copy earns
emotion, UI copy earns understanding.

What that means line by line:

- Say what happens, not what the system is doing internally. "Beatfall suggests
  where it belongs", never "the board re-settled" or "it looks again".
- One idea per sentence. If a line explains the action, the reasoning behind it
  and the future benefit, cut the reasoning.
- Verbs over concepts. "You can move the card later" beats "every card follows
  you across".
- Never make the writer decode a metaphor to use a control.
- Delete lines whose only job is showing personality. Good sentence, no product
  job, no place in the UI.
- Absolutes are accuracy claims. **forever, nobody, nowhere, never, only,
  always, exactly** each need checking against Privacy, Terms and Billing before
  they ship. Three shipped absolutes were false and were removed: "free
  forever", "nobody else can read it, including us", "goes to your account and
  nowhere else".
- Screenwriting vocabulary is fine and often clearer, because the audience is
  writers: beat, logline, structure, outline, comps, card. Beatfall-only jargon
  is not.

The test: if a line reads faster after the edit with no loss of meaning, trust
or Beatfall identity, keep the edit. If the rewrite is merely nicer, leave the
original alone.

Where I declined the brief: it proposed **"AI-assisted features"** as the house
term, which would undo the naming rule above. Accuracy fixes taken, term not.
It also proposed weakening the independent-development disclosure in Terms
("similar ideas can arise independently") and pluralising "the person who runs
Beatfall"; both are inaccurate, so the disclosure kept its original force.

## The admin page (3 Sep 2026)

Two things to know before editing it.

**Every number on the plan card comes from `/api/admin`**, in the `pricing`
object built from `core.js`. The top-up used to be hardcoded in the template,
which is why it went on saying 100 for $6 after the pack became 50. Nothing on
that card should be a literal again.

**The account pill is duplicated CSS.** `index.html` does not load `theme.css`,
so `.acct`, `.avatar` and the `.pop*` rules live inline in index, admin AND
settings. Change one, change all three. The admin copy drops the Admin row (you
are standing on it) and the product-tour item, and adds Board.

The owner allowance is `1000000`, a stand-in for infinity. Anywhere it could
reach a screen it prints as an infinity sign instead.

## The welcome sheet (3 Sep 2026)

It opens on an **empty** account, not a **new** one. The test is zero projects,
or one project with no cards still called Untitled. That means signing out and
back in without typing anything shows it again, which is deliberate: on an empty
account it is the only useful thing on the screen.

What is not deliberate is greeting a paying writer who deleted their last
project. So there are two greetings, chosen by `has_history` from
`/api/account` (all-time rows in `usage`, no new column, no backfill):

- never used anything -> **"Welcome to Beatfall"**
- used it before, empty now -> **"Nothing on the shelf"**

"What Beatfall does" in the account menu opens the same sheet and always says
Welcome, because that is the explainer and the writer asking may have nine
projects open.

Two bugs fixed at the same time. The handlers used to bind on every open, so the
fourth visit put four listeners on each button: one click ran the import four
times and recorded four `first_run_choice` events. They bind once now. And
Escape closes it, which it never did; only clicking the grey area worked, and
nothing said so.

## Growth and measurement foundation (3 Sep 2026)

Built from an outside beta-infrastructure spec. The reasoning that decided
scope: everything in that document can be added later except one thing. You can
ship a share button in October. You cannot go back and watch what the first ten
writers did in September. So the event stream went in and the public surfaces
did not.

**The rule that governs the events table**: it holds counts, buckets, enum
names, booleans and timestamps. Never a card, a note, a logline, a title, a
filename, a prompt or a response. `cleanProps()` in `core.js` enforces it with
an allowlist of property names, because the comment above it will not be read
by whoever adds the next call site. Sizes go in as buckets (`bucket()` in
index.html): "between 20 and 50 notes" answers every question we have, "47"
starts to describe a particular person's file.

Three ids, three jobs: `anon_id` identifies a browser from before there was an
account, `session_id` groups one sitting (30 minutes idle ends it), `event_id`
makes a retry idempotent via a unique index.

**Attribution survives the magic link.** The referrer does not come back from
a mail client, so the browser writes what the first visit saw into
`localStorage` and hands it over on the first authenticated call. First touch
is written once and never overwritten; last touch may move. Host only, never a
full referrer URL, because those carry other people's query strings.

**`is_internal`** keeps Kris's own accounts out of every product number while
leaving them visible in People. With ten writers, two owner accounts would not
skew the funnel, they would be the funnel.

**Meaningful board** is the provisional activation marker: five real items on
a non-sample project. `MEANINGFUL_ITEMS` is a named constant because it is a
guess, it will be wrong, and whoever changes it should be able to find it.

**Where the spec was wrong.** It diagnosed the Untitled card as an abandoned
draft that inflates metrics, and prescribed draft states and cleanup. The card
is a client-side placeholder `load()` fabricates when the server returns zero
rows; it has `id: null` and never reaches the database until the writer types.
Cancelling the new-project form saves nothing. So there was nothing to clean
up. The real bug was one sentence: the dashboard said "One project saved" over
an empty account.

### Not built, and why

Share Progress, public `/share/{token}` pages, OG card generation, the
anonymous `/demo` route, evergreen SEO pages and lifecycle email hooks. Each is
a public unauthenticated surface on a product that currently has none, and each
is a project rather than a change. They need Kris's decisions before code.

## The small-screen gate (3 Sep 2026)

A phone gets the app, not the board. Kris's reasoning: the web app is a spatial
thing, there is no honest way to drag cards around a 390px column, and a
writer's first impression should not be a cramped version of the real product.

**Which pages are gated is decided by which pages load `app.js`** — index,
login, settings and admin do; Privacy, Terms and How billing works do not, and
must not. They are documents, they are linked from emails and store listings,
people open them on phones, and a privacy policy you cannot read on the device
in your hand is worse than useless. Adding `app.js` to a legal page would gate
it silently, so don't.

**Two conditions, both required.** `min(innerWidth, innerHeight) < 700` measured
on the SHORTER side, so a rotated phone is still a phone: a width-only check
lets an iPhone Pro Max through at 932px in landscape, which is the exact
experience this exists to prevent. And `pointer: coarse`, because a laptop with
a short browser window has a small viewport and is not a phone — without it,
dragging a desktop window to half height throws up a download prompt.

744 is an iPad Mini's short side, so every iPad passes and 600-class Android
tablets do not. Verified against fourteen real device sizes in `vgate.js`.

**Sign-in is deliberately not blocked.** The gate is drawn AFTER `BF.init()`,
so `detectSessionInUrl` has already redeemed any magic link. Magic links get
opened on phones constantly and the link is single-use: refusing to process it
would burn it and lose the account permanently. Tap the link on the sofa and
the laptop is already signed in.

`BF.APP_STORE` and `BF.PLAY_STORE` in `app.js` are empty. While they are, the
buttons render in place but read "Coming to the App Store" and are spans, not
links. Fill them in and they become real buttons with no other change.

## Import parse: the Night Haul test (3 Sep 2026)

Kris pasted a real 86-note file. The app reported **114**. The 28 extra, and
what each one taught:

**Section headers became notes.** "OPENING:", "FIRST CHASE:", "BIG TURN:",
"MIDPOINT:", "BREAK INTO THREE:", "ENDING:", "FINAL IMAGE:", "TITLE IDEAS:" all
landed on the Structural idea shelf as material. `isHeaderNote()` only ever
caught brief-field labels (TITLE, LOGLINE, GENRE); it had no idea a writer
organises a page with headings. `headerLine()` handles that now.

The valuable half: some of those headings NAME A BEAT. A writer who types
"MIDPOINT:" and then a line has told us where that line goes, which beats
anything a model can infer, and we were discarding it and then guessing.

**But scope it to ONE note.** The first version scoped everything until the
next heading, and that was worse than the bug: "MIDPOINT:" swallowed thirty
lines including three notes for other films entirely ("Unrelated horror idea:
a motel pool…"). A heading declares the note directly beneath it and is then
spent. On the real file that produces exactly three declarations — Midpoint,
Break Into Three, Final Image — and all three are right.

**Dialogue was split from its scene.** `"Dale?"`, `"Hey, Ronnie."`, `"I don't
steal cars."`, `"Legally."` each became a note. A one-line quote is a fragment
of the beat above it. `isQuoteFragment()` folds it up, and handles the
screenplay habit of `Dale: "Mine's brass."` too.

**Attribution lines dangled.** "Rusk calls Dale:" is setup for the next line;
alone both halves are meaningless. Folded together.

**Markdown survived, and the order was the reason.** `**NIGHT HAUL**` arrived
as `NIGHT HAUL**` because the list-marker stripper (`^\s*[-*…]+`) treats a
leading `*` as a bullet and ate the opening pair. Emphasis now comes off
BEFORE the bullet strip. Order, not regex.

**Writers' asides fold too.** "Keep that line for now", "Maybe too cute,
leave it in notes", "Could just be a character note" are about the NOTE, not
the story; on their own card they are gibberish. So do short continuations:
"He keeps driving.", "Dale just stares.", "He calls the broker." — a sentence
under ~52 characters whose subject is already in the note above finishes that
moment rather than starting a new one.

**A heading plus fragments is a LIST, and a list is one note.** Five candidate
titles are one decision the writer is making. As five cards they clutter the
shelf and each says nothing.

Result: 114 -> **83**. ChatGPT said 86 for the same file; that is a judgment,
not a spec, and every fold here is inspectable in `vsplit.js`.

### The testing mistake, which mattered more than any of it

The first round of this reported 96 and I believed it. The test harness kept
its own copy of the fold loop, so it was measuring a duplicate while the
shipped code went unexercised: new rules landed in `index.html`, the test still
ran the old logic, and the number did not move. Kris caught it by knowing his
own file.

The fold now lives in `foldNotes(raw, structureKey)`, extracted from
`claudePlan` for exactly this reason, and `vsplit.js` calls it. **A parse that
cannot be run on its own does not get checked, so it does not stay correct.**
Never re-implement logic inside a test to observe it.

Two ordering bugs came out of the same round, both mine: emphasis stripping ran
after the bullet stripper (so `**NIGHT HAUL**` lost half its markers), and
`flushList()` ran immediately after setting `listing` (so the list collapse
silently never fired at all).

### The bug that was not a counting problem

A note the model was **91% sure** about was set aside reading "only 91% sure".
It was not uncertain. Its beat was full: `MAX_PER_BEAT` (3) cleared the
placement, and the review row had no field to tell a ceiling from a doubt, so
it printed a limit as a confidence. There is now a separate `full` field, and
that row says "Midpoint already has 3 cards". Four distinct messages, checked
in `/tmp/vdest.js`.

The fixture lives at `/home/claude/_testdata/nighthaul.txt` (gitignored) and
`/tmp/vsplit.js` runs the real splitter over it without spending credits.

### The "79 notes" that were never missing

Kris ran the same file after the fold changes and the sheet said **79**. He had
counted 86 and reasonably concluded notes were being lost, and asked for a
rollback. Nothing was lost. The file folded to 83 and the model marked four as
strays, which arrive **unticked** — and `updateRevCount()` only ever counted
ticked ones. A number that silently means something narrower than it says is
worse than no number. It now reads "79 of 83 notes ticked", and the sheet says
which lines were unticked and why.

Same root cause as the missing DIRT MONEY project. A one-line pitch for another
film is genuinely ambiguous, and the grouping prompt gave two contradictory
instructions about it: "notes files carry unrelated pitches" and "never list
stray thoughts". So the same line became its own project on one run and an
unticked stray on the next. The prompt now states the test: **did the writer
NAME it.** An idea introduced as another project, or carrying a title or a
working title, is a distinct story however briefly described. An unnamed
passing thought is not.

Worth keeping in mind: pass one reads the RAW paste, not the folded notes, so
folding changes cannot affect story grouping. When grouping shifts between two
runs of the same file it is the model, and the fix is the prompt.

### Named projects are matched in code, not asked about (3 Sep 2026)

DIRT MONEY became its own project on one run and an unticked stray on the next,
from the same file. Two facts settled it:

- **Deleting a project has no effect on a later import.** `DELETE /api/projects`
  is a hard delete with no tombstone. That was Kris's first theory and it is
  not the cause.
- **The parser never dropped the note.** It survives folding intact, and pass
  one reads the RAW paste anyway, so folding cannot affect grouping.

It was the model, asked to judge "story or passing thought", answering
differently on different days. A writer cannot work with a product that decides
differently each time, so `namedProject()` decides it in code, on the one thing
actually present in the text: **did the writer name it.**

    "Another project: dirt-track racers ... Title maybe DIRT MONEY."  -> project
    "Unrelated horror idea: a motel pool fills with seawater ..."     -> note
    "Another stray: comedy about a substitute teacher ..."            -> note

A named project is added to `groups` whether the model listed it or not, and the
note that named it is routed into it via `forced`, so it never arrives empty.
Verified in `/tmp/vdirt.js` with the model stubbed to call it a stray: the
project appears anyway.

One regex lesson: the label is matched case-insensitively and the NAME captured
case-sensitively, in two steps. Doing both in one pattern needs the `i` flag,
which makes `[A-Z]` match lower case and the name capture meaningless — which
is exactly how "Title maybe DIRT MONEY", the only case this exists for, failed
the first time.

### Nothing arrives unticked any more

Errands used to come in with `keep: false`, and the counter only counted ticked
notes: Kris pasted 86, was shown 83, and drew the only conclusion that number
allowed. Two things were wrong, not one — the count was misleading AND the app
was deciding on the writer's behalf that a line of his file was worthless.

`keep: true` for everything now. A stray goes to a shelf, and a shelf is what
shelves are for. Unticking is the writer's call, and the chip on every row
already says how each line was read.

### Nothing placed: the structure switched after classification (3 Sep 2026)

The screenshot that mattered: **Classic Three-Act, 0 placed, 9 open**, and a
Set aside shelf full of cards labelled POSSIBLY: FUN / BAD / DARK / DEBATE —
which are *Save the Cat* beat ids. The notes had been sorted against one
structure and then dropped into another.

`claudePlan` classified against `proj.structure` (Save the Cat). The build then
did `target.structure = st.brief.format` and moved the project to Three-Act.
Every card was left holding a beat id that structure does not have, so
`settle()` could place none of them.

Four changes, and the order of the first two is the whole fix:

1. **Only a format the writer typed may switch the structure.** `header` comes
   from `localBrief`, which matches an actual "Format:" line. A format the model
   inferred from a genre line is a guess and must never move somebody off the
   structure they chose. That guess is what did it.
2. **The switch happens before classification**, so notes are sorted against the
   structure they will live in. The build no longer switches at all.
3. **Folding happens after the switch too.** A heading like "MIDPOINT:" declares
   a beat id, and an id only means something inside one structure. Folding first
   left three cards declared against Save the Cat in a Three-Act project.
4. **A card can never hold a beat its structure lacks.** Whatever happens
   upstream, an unknown id becomes Set aside, where the writer can see it,
   rather than vanishing into a board that cannot render it.

Also: `localBrief` only recognised "vertical" and "short" as formats, so
"Format: Three-Act" was silently dropped — the writer's own statement ignored
while the model's guess was allowed to act. Named structures are matched now.

`/tmp/vplace.js` reproduces the exact failure (model returns a different format
plus stc ids): 0 placed before, 45 after, no dead ids. `/tmp/vfmt.js` covers the
opposite case, where the file does state a format.

### The import never saved the projects it created (3 Sep 2026)

Kris's numbers gave it away: Night Haul held 7 placed + 4 set aside + 29 shelf
= **40 cards**, from an import that read **83 notes**, and the dialog said "1
new project created" over a dashboard with no new card. The other ~42 notes went
into that second project, and the second project was never written to the
server, so they vanished with it.

`save()` only ever marks `P()`, the project you are looking at. That is right
for typing on a board and wrong for an import, which touches several projects at
once. The build pushed new projects into `state.projects`, drew their cards, and
never added them to `dirty`. `dirty.add(target)` in the build loop fixes it.

**This bug is old, not new.** It only fires when an import creates a project,
which used to depend on the model deciding a stray was a story — rare and
unpredictable. Making named projects deterministic in code turned an occasional
silent loss into one that happened every run. Worth remembering: a fix that
makes something happen reliably will expose every bug downstream of it.

### Declared beats now claim their slot first

A line the writer put under "BREAK INTO THREE:" could be bumped by three
confident model guesses at the same beat, because placement ran in note order
and `MAX_PER_BEAT` is first-come. Their heading is the best evidence in the
file, not the weakest. Placement is two passes now: declarations claim their
slots, then guesses fill what is left.

And a bumped declaration used to be filed on a NOTE shelf, because the model
had called the sentence "structural" — so the writer's own heading disappeared
into Notes rather than showing up in Set aside. `if (n.declared) kind = "beat"`.

### A code-made group takes ONE note (3 Sep 2026)

Kris found this one from the board. Dirt Money held "He chooses to go back for
her", "They stop trying to escape", the Waffle House scene, the tow truck being
destroyed — every one a Night Haul note, and every one sitting BELOW the DIRT
MONEY line in his file.

Telling the model "story 1 = Dirt Money" and then letting it route freely meant
everything downstream of that sentence went into Dirt Money, because it came
after it on the page. The model did not find that story; this code did, from a
single line. **A single line is evidence for exactly one note.**

`codeMade` records which groups this code invented, and any note the model
routes into one of them that was not the note that named it goes back to group
0. Reproduced in `/tmp/vroute.js` with the model routing ~40 notes to group 1:
Dirt Money still gets 1, Night Haul keeps 82.

**The pattern worth remembering from this whole session.** Five bugs came out in
sequence, and each fix exposed the next: the structure switched after
classification (empty board) -> imports never saved the projects they created
(42 notes lost with an unsaved project) -> declared beats were bumped by model
guesses (empty Act Three) -> a code-made group swallowed everything after it.
Each was real, and each was only visible once the one before it was gone. When a
user says "you keep getting further away", that is what it looks like from their
side, and they are not wrong to say it.

### An import renamed a project and merged two films (3 Sep 2026)

The worst one. Kris pasted half-hour comedy notes ("Sidework") into **Paste your
notes on the dashboard**. NIGHT HAUL came back called BLACK RIVER, with the
comedy's beats sitting in it next to his own, and Sidework never existed. His
words: *if someone were to use this, we would have completely
deleted/overwritten their file they'd worked so hard on.*

Four separate defects lined up:

1. **The dashboard import had no project in front of it** and silently used
   whichever board was last opened. Nothing on that screen said so. Now
   `openImport(intoNew)` — true from the dashboard and from the sample board —
   and group zero makes its own project. `importStructure` carries the settled
   format to that new project instead of being written onto the open board, and
   `baseStructure` is read once before the loop so later projects don't inherit
   it from the one just created.
2. **An import could rename an existing project.** It cannot now, at all:
   `namedAlready(proj)` gates it, and only a placeholder name ("Untitled", "New
   project") is ever filled. The one exception is the writer typing in the name
   box on the review sheet — `st.typed`. There is no version of an import that
   may overwrite a name.
3. **A `TITLE:` line belonging to another film was read as this file's title.**
   BLACK RIVER was introduced by "Another project I'm working on is called:" and
   the header reader took it anyway. `localBrief` now drops any header field
   whose match sits after the first `OTHER_PROJECT` marker — position, not
   cleverness.
4. **`claimedTitle` read only the first label.** "…is called: TITLE: BLACK
   RIVER" arrives here as one sentence, and the name after "called" is the word
   TITLE. It scans every label now and takes the last one that yields a
   plausible name, skipping bare label words.

The review sheet also says which title it saw and did not take, because silence
there reads as the app having missed it.

`/home/claude/vrename.js` holds it down: two runs on
`_testdata/sidework.txt`, one from the dashboard and one from the board. Night
Haul keeps its name, its three cards and its structure; Sidework becomes its own
half-hour project; Black River gets the one line that named it. The board run
still lands the notes on the board, because that is what pasting into a board
you are looking at means.

While fixing this, `vproj.js` turned out to have a wrong expectation on the
books: "New film idea. Call it THE LONG WAY DOWN." was expected to be `null`.
The writer named it, so it is a project. The code was right and the test was
wrong, which is worth remembering the next time a test disagrees.

## The shelf, the price, and one way in (3 Sep 2026)

Five changes Kris asked for after seeing the dashboard with real projects on it.

**One way into the import.** "Paste your notes" is gone from the dashboard and
from the sample board's CTA. The box is reached through New project → **Start
from my notes**, which is now `btn-gold`. Two entrances to the same box, one of
them with no project in front of it, is what caused the Night Haul overwrite;
the gold button makes the notes path the obvious one on the sheet where the
format is chosen, which is also the sheet whose answers the parse depends on.
`--gold-ink` and `--on-gold` were added to theme.css so gold text flips with the
theme the way blue already did.

**Every spend says its price first.** `CREDIT` in index.html mirrors `COST` in
`api/_lib/core.js` — keep them together, a gap between them ends up in a support
email. `costWords`, `costTag` and `marksCost` put a small figure on the control
and append "Costs N credits." to its tooltip; `marksCost` is idempotent so a
re-render cannot stack two chips. Reading a file (2 credits) gets a whole
sentence on the paste sheet instead, because the button's label is rewritten
while it works and a chip would be wiped.

The first version set the chip in caps everywhere. On a board with fifteen empty
beats that is thirty "1 CREDIT" labels down one page — the price stops being
information and becomes noise. It is lowercase and hairline now, one per gap row
("1 credit each", since both buttons cost the same), and caps only inside the
card's Next up, where it answers a caps label.

**A finished board looks finished.** `.pcard.full` when nothing is open: gold
ground, gold hairline, gold grade and gold Open. Gold means "what's missing"
everywhere else in this app, which is only a contradiction from outside the
card — a full board has nothing missing on it, so there is no gold count to
clash with.

**Nothing runs off a card.** `Half-Hour Comedy (cold open + 3 acts + tag) · 8
beats` was overflowing. Two causes and both are fixed: `structureLine` now drops
the parenthetical as well as the medium, and `.gstat` / `.gline` got
`min-width:0`. That second one is the general defect — **a flex child will not
shrink below its content, so `white-space:nowrap` plus `text-overflow:ellipsis`
does nothing until the child is allowed to shrink.** Check for it anywhere a
nowrap line sits in a flex row.

**The shelf is grouped by medium.** Features, Television, Short films, Vertical,
Any length — read from the half of the structure label the card drops
(`mediumOf`), so there is no second copy of that fact to disagree. Headings only
appear when there is more than one group, and `#slategrid` switches between
`slate-grid` and `slate-groups` because it has to lay out cards in one case and
sections in the other.

Held down by `/home/claude/vcost.js`, which runs light and dark: one dashboard
button, the gold one on the sheet, the grouping, the finished card, nothing
spilling, and every spend carrying its price.

### The format is answered, not assumed (3 Sep 2026)

Kris pasted a one-hour drama's notes and got Save the Cat, because the
new-project sheet arrived pre-filled with Save the Cat whether or not anybody
had chosen it. The sheet says "Only the format is required" and then quietly
answered it for him. His fix, and it is the right one: **stop asking about the
format afterwards, and make the sheet insist on it up front.**

- `askStructure` — the "these notes read like a different shape" dialog — is
  **deleted**. Being asked to second-guess a choice you just made, by something
  that only inferred an alternative, is worse than not asking. A format the
  writer TYPED in the file still switches; a format the model read does nothing.
- The chooser has an unanswered first option, so "no format" is a state the
  select can be in. `gateIntake()` disables **both** Start the board and Start
  from my notes until it is answered, puts a gold ring on the field, and swaps
  the hint to "Pick one. It decides which beats your board has."
- `storedStructure()` returns null when nobody has set one. A format set in
  Settings is a choice already made, so it fills in and nothing is asked;
  `defaultStructure()` is now just `storedStructure() || "stc"` for the Settings
  menu, which needs an answer even when there is none.

**A title on the line after the words that introduce it.** His file had
"Different project accidentally in here:" then "**COLD STORAGE**", and the same
shape again for SMALL GODS. Those arrive folded into one sentence with no label
word anywhere in it and no punctuation before the title, so `TITLE_BARE` — which
needs the start of the line or a `.:;` in front — found nothing. `shoutedTail`
reads the shouted run at the END of the line, and only inside a line that has
already announced another project. Two words, or one of five letters or more:
admits SIDEWORK and COLD STORAGE, keeps out the FBI, the DMV and LA.

**A finished card is a reward now, and it is INK.** Three rejected passes to
get here, and the lesson is worth more than the colour.

Attempt one was `--gold-soft` — invisible, two shades off paper. Attempt two was
a full champagne gold — "horrific", and rightly: a whole card of mustard is not
a bigger version of a gold hairline. Attempt three was sage, which he also
didn't want. Kris suggested blue.

What all three failures had in common: **they were light cards among light
cards, which is a highlight, and a highlight is what you put on something you
have not dealt with yet.** No amount of hue-picking fixes that. A DARK card
among light ones cannot be misread — it is not selected, it is not a warning,
it is bound. Ink with a gold rule and gold type, which is this app's own
vocabulary at full strength, and the one place gold does not mean "missing",
because on that card nothing is.

Blue specifically stays out: **blue is what you can touch here**, so a blue card
reads as selected and fights every Open button sitting on it.

The other thing worth keeping from this round: after two rejected guesses, the
right move was to stop guessing. `/home/claude/vwin.js` renders the real card
in five palettes side by side, light and dark, from the real stylesheet — one
screenshot, one question, done. **"Which of these" is a far easier question than
"is this better than the one you saw ten minutes ago."**

That was only possible because the card was refactored first: every colour on a
`.pcard.full` now comes from one `--win-*` token set (`--win`, `--win-2`,
`--win-hair`, `--win-ink`, `--win-body`, `--win-mute`, `--win-chip`,
`--win-chip-ink`, `--win-track`, `--win-go-ink`, `--win-del`), so a treatment is
a palette swap and light and dark fills both work. Contrast is measured against
the WASH, not against paper: on ink, body text 12:1, the small lines 7:1, the
gold 9.6:1.

**The shelf is three across at every width.** Cards were a fixed 396px and
wrapped, so a 1280 laptop fit exactly two and the shelf read as a column of
pairs with a hole beside it. `.slate-grid` is a grid now and **column count is
the thing being designed**, not card width: three by default, four at 1500, five
at 1860, with `.slate-wrap` widening in step so the extra columns are real cards
and not slivers. Under 1060 the card tightens instead of the shelf dropping to
two — smaller grade, no NEXT UP label, and `.gline` wraps rather than clipping,
because the half that got cut at 210px was the open count, which is the number
the card exists to show. Two side effects worth keeping: `.pcard h3` is clamped
to two lines and `.ph` reserves two lines whether or not the title needs them,
so a wrapping title ("THE COLLECTION PLATE") no longer pushes its card's grade,
bar and buttons a line below every other card's.

`/home/claude/vformat.js` covers all of it against his Witness Tree paste.

## Footer and the account pill (2 Sep 2026)

`body` is a flex column at `min-height:100dvh` and `footer` takes
`margin-top:auto`, so on a short page the footer sits on the floor instead of
floating halfway up. Fixed children (the capture dock, `.acct`, every scrim)
are out of flow and unaffected.

The account pill stays fixed bottom-left. The footer reserves an 84px band at
its foot for exactly that, so scrolling to the bottom lands the pill in a space
left for it rather than on top of the brand.

## Scoreboard cell copy (2 Sep 2026)

Two rules learned the hard way, both from Kris reading it cold:

- **The label has to answer "so many WHAT".** "25 / STILL EMPTY" does not say
  25 of what. It is "Beats still empty" now.
- **The note under a cell has to be a sentence, not a dangling fragment.**
  "across your 2 boards" hanging under "BEATS FILLED" reads as disconnected.
  It is "Across your 2 boards." with a capital and a full stop, and "On your
  board." when there is one.

And where the number says it all, say nothing: the empty-beats cell has no note
unless the count is zero, in which case it says "Every one has a card."

## Email addresses (2 Sep 2026)

- **contact@beatfall.app** is the one address the PRODUCT uses. Footer feedback
  link, billing page, anywhere a writer is invited to write in.
- **privacy@** and **legal@** stay in the Privacy Policy and Terms. Those are
  named channels people expect in a legal document, and a privacy request is a
  different kind of mail from a bug report.

All three need to exist and forward somewhere Kris reads. A dead mailbox on a
Terms page is worse than no address.

## Footer copyright (2 Sep 2026)

A strip under the columns: copyright, entity, jurisdiction, and one line saying
the writing stays theirs, linking to Terms §2. The year is written by
`new Date().getFullYear()` so it cannot go stale in January.

The account pill's clearance moved to this strip's bottom padding, since it is
now the last thing in the footer.
