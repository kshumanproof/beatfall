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

## 4 September 2026: Homepage polish and conversion pass

### Requested

Preserve the approved homepage direction while correcting the before-and-after demonstration, tightening functional copy, polishing responsive behavior, and completing basic search and sharing metadata.

### Changes

- Rebuilt the demonstration so every After item comes from the visible Before notes.
- Added a visible “Kept in Notes” area for material that is not placed as a beat.
- Kept Theme Stated and Midpoint open to demonstrate deliberate uncertainty.
- Shortened the “Paste the whole mess” explanation.
- Changed the second step from “Review the board” to “Beatfall sorts them” and clarified where each kind of material goes.
- Changed the trust statement to the clearer “Your writing isn’t used to train AI.”
- Standardized the lower pricing call to action as “Start 14 days free.”
- Added canonical, Open Graph, and Twitter metadata.
- Added `robots.txt` and a sitemap covering the public homepage, billing, privacy, and terms pages.
- Tightened the phone hero and ensured primary phone actions meet a 44-pixel minimum target height.

### Testing

- Visually inspected the complete page at 1440-pixel desktop, 768-pixel tablet, and 390-pixel phone widths.
- Saved full-page review captures as `Claude outputs/homepage-desktop.png` and `Claude outputs/homepage-mobile.png`.
- Confirmed no horizontal overflow at tablet or phone widths.
- Confirmed the primary phone call to action is 51 pixels high.
- Confirmed exactly one H1, followed by four H2s and three H3s.
- Confirmed canonical, Open Graph, and Twitter text metadata are present.
- Confirmed `robots.txt` and `sitemap.xml` are served successfully.
- Confirmed all conversion buttons use “Start 14 days free,” except the deliberately shorter header button.
- Confirmed no em dashes or stale wordmark-only links were introduced.

### Intentionally unchanged

- The hero wording, visual concept, section order, palette, typography, pricing, founder statement, and footer destinations remain unchanged.
- No testimonials, badges, animation, feature grid, extra tiers, or generic AI marketing were added.
- No social preview image was invented. Text sharing metadata is ready, but the image should be an approved Beatfall asset rather than an unrelated generated graphic.

## 4 September 2026: Homepage simplification and real product visuals

### Requested

Shorten the homepage, replace invented product illustrations with genuine Beatfall screens, keep the current web product truthful on phones, and restore the Beatfall tagline.

### Changes

- Replaced the invented note stack and sample board with a deterministic crop of the real Night Haul beat board.
- Added a separate, narrower Night Haul crop for phone screens so the project identity, a placed card, and open beats remain visible.
- Added a real dashboard crop showing project completion, open beats, and the next beat to work on.
- Removed the entire Before and After demonstration and the three-step How It Works section.
- Reduced the trust section to three direct promises.
- Compressed pricing into one line with one call to action.
- Reduced the founder section while preserving the approved founder statement.
- Added the official tagline, “Where your story falls into place.”, directly below the official footer lockup.
- Kept the dashboard proof off phone layouts so the mobile homepage represents the current web product without implying that a companion app exists.

### Testing

- Visually inspected the complete homepage at 1440-pixel desktop, 768-pixel tablet, and 390-pixel phone widths.
- Updated the full-page review captures in `Claude outputs/` and added a tablet capture.
- Confirmed no horizontal overflow at any tested width.
- Confirmed the phone hero loads the focused mobile board crop while desktop and tablet load the wide board crop.
- Confirmed the dashboard is visible on desktop and tablet and omitted on phones.
- Confirmed exactly one H1 and three H2s.
- Confirmed the primary call to action is 51 pixels high at every tested width.
- Confirmed the tagline is visible at every tested width.
- Confirmed no browser errors occurred during the responsive visual checks.

### Intentionally unchanged

- The approved hero headline, functional description, authorship promise, pricing, and founder statement remain unchanged.
- The source screenshots were not retouched or regenerated. Only cropping, resizing, and WebP compression were applied.
- No authenticated app mechanics, mobile files, or mobile-app marketing were added.

## 4 September 2026: Help page and Account menu

### Requested

Complete the second item from the product audit: add a concise, searchable Help page and put it under Account.

### Changes

- Added `public/help.html` with short answers for importing notes, adding one note, uncertain placements, moving and settling cards, empty beats, structure changes, exporting, credits, and undo.
- Added live in-page search with a result count, a clear action, and a useful no-results state.
- Added the existing keyboard shortcuts for undo, submit, a new line, and close.
- Added a direct “Report a problem” email action with guidance on what information to include.
- Added “Help & shortcuts” to the Account menus in the board, Settings, and Admin.
- Removed the direct “Give feedback” item from the board menu because feedback and problem reporting now have a clearer home on the Help page.
- Renamed “What Beatfall does” to “How Beatfall works.” It still opens the existing product explainer and remains separate from task help.
- Added Help to the public sitemap and the setup file map.
- Used the official icon-plus-wordmark lockup on the new page.

### Testing

- Visually inspected Help at 1440-pixel desktop, 768-pixel tablet, and 390-pixel phone widths, plus forced dark mode.
- Saved full-page review captures as `Claude outputs/help-desktop.png`, `help-tablet.png`, `help-mobile.png`, and `help-dark.png`.
- Confirmed no horizontal overflow at any tested width.
- Confirmed search returns only the matching answer for “export,” shows the no-results state for an unknown term, and restores all ten answer areas after clearing.
- Confirmed the board return link, billing link, and problem-report email use the intended destinations.
- Confirmed the Help link appears exactly once in each Account menu.
- Confirmed the official lockup, one H1, and 44-pixel navigation target at every tested width.
- Confirmed the saved light, dark, and auto mode choice carries onto the Help page.
- Confirmed no browser errors occurred during the responsive and search checks.

### Intentionally unchanged

- No board, import, placement, saving, billing, or account-data mechanics were changed.
- The existing product explainer remains available as “How Beatfall works.”
- No mobile-app files or mobile-app marketing were added.

## 4 September 2026: Universal header and signed-in homepage routing

### Requested

Make the `/app` dashboard header the universal page header, make every logo link return to `/app`, and ensure the public homepage is only shown to people who are not signed in.

### Changes

- Standardized the shared page header to the dashboard's 76-pixel height, 29-pixel mark, 34-pixel wordmark, spacing, width, border, and sticky behavior.
- Applied the same header to Help, Billing, Privacy, Terms, Sign in, Settings, Admin, and the public homepage.
- Added the universal header to Sign in and removed the smaller duplicate logo from its marketing panel.
- Changed every linked Beatfall lockup in the site to `/app`, including page headers, the homepage footer, the app footer, Settings, and the ended-plan screen.
- Added an early session check at `/`. A valid persisted Supabase session is sent directly to `/app`; only signed-out visitors see the public homepage.
- Kept the homepage hidden while the session check runs so signed-in writers do not see a flash of marketing content before the redirect.
- Kept the homepage available if the account service cannot be reached, rather than leaving signed-out visitors on a blank page.
- Simplified narrow headers by keeping the universal lockup and primary board action while hiding secondary legal-page buttons that do not fit.

### Testing

- Measured the homepage, app, Help, Billing, Privacy, Terms, Sign in, Settings, and Admin headers at 1440 pixels wide.
- Confirmed every desktop header is 76 pixels high with a 29-pixel mark and 34-pixel wordmark.
- Confirmed every linked Beatfall lockup points to `/app`; no lockup points to `/`.
- Confirmed all nine pages have no horizontal overflow at 1440 and 390 pixels wide.
- Confirmed narrow shared pages use the same responsive lockup sizes as the app: a 31-pixel mark and 26-pixel wordmark.
- Simulated a signed-out Supabase session and confirmed `/` remains visible.
- Simulated a persisted signed-in Supabase session and confirmed `/` redirects to `/app` before revealing the homepage.
- Visually inspected the updated Help, Sign in, and Privacy headers at desktop and phone widths.

### Intentionally unchanged

- The projects dashboard remains the first view loaded by `/app`.
- The public homepage content remains unchanged for signed-out visitors.
- No project, account, billing, or mobile-app mechanics were changed.

## 4 September 2026: Project-title display, safe error states, and signed-out routing

### Requested

Display every project title in the project switcher in uppercase, complete the third product-audit item for missing and failed pages, and send people to the homepage after they sign out.

### Changes

- Made project titles display in uppercase throughout the project switcher, matching the dashboard cards.
- Kept the writer's original capitalization in saved project data; the uppercase treatment is visual only.
- Added `public/404.html` as the site's polished not-found page with the universal header, the official lockup, and clear routes to Projects and Help.
- Replaced the board's unsafe load-failure fallback. Beatfall no longer creates and displays a temporary Untitled project when the saved project shelf cannot be reached.
- Added a dedicated “Beatfall couldn’t load your projects” state that stops the board from opening, confirms that saved projects were not changed, and offers Try again, Help, and Sign out.
- Changed every explicit sign-out and post-account-deletion destination from Sign in to the public homepage.
- Changed signed-out and expired-session redirects from protected pages to the public homepage. The Sign in page is now reached only through the homepage's Sign in and trial actions.
- Added the not-found page to the setup file map.

### Testing

- Simulated a project API failure and confirmed the dedicated failure state appears with no temporary or editable board visible.
- Confirmed the failure state has no browser errors or horizontal overflow at 1440 and 390 pixels wide.
- Confirmed its universal header measures 77 pixels on desktop and 69 pixels on phone, matching the site's one-pixel borders.
- Confirmed its phone actions fill the available width and retain their intended 42-pixel height.
- Confirmed a mixed-case project title keeps its original text value while its switcher display computes to uppercase.
- Confirmed Sign out lands on `/`, while choosing Sign in on the homepage still lands on `/login.html`.
- Confirmed no code path outside the homepage links people directly to `/login.html`.
- Visually inspected the 404 page in desktop light mode and phone dark mode.
- Confirmed the 404 page uses the official `/app` lockup link, has no browser errors or overflow, and matches the universal desktop and phone header dimensions.
- Saved review captures as `Claude outputs/error-load-desktop.png`, `error-load-mobile.png`, `error-404-desktop.png`, and `error-404-mobile.png`.

### Intentionally unchanged

- Project names are not rewritten in the database, exports, or edit fields.
- The login page and its copy remain available when a signed-out visitor deliberately chooses Sign in or a trial action.
- No project content, database schema, billing behavior, or mobile-app files were changed.

## 4 September 2026: Functional-copy pass

### Requested

Make controls and tooltips explain their immediate result in basic language, reduce repeated reassurance, and keep fuller guarantees only where they affect a decision.

### Changes

- Renamed the requested controls: “Sort them out” to “Sort my notes,” “Flesh it out” to “Answer a few questions,” “Write the card” to “Create a card,” and “Start the board” to “Create an empty board.”
- Renamed “Notes that aren't beats” to “Other notes” and carried that name through import results, card movement, and note-management language.
- Replaced the notes-import introduction with the approved direct explanation of what Beatfall accepts, what it identifies, and when the board changes.
- Simplified the new-project introduction, field hints, logline help, and the paired creation choices.
- Renamed import review's “Build the board” action to “Add selected notes” and shortened its explanation of where each type of note goes.
- Simplified uncertain-placement messages and gave every route into the same conversation the same “Answer a few questions” label.
- Simplified the conversation-to-card and idea-to-card flow to “Create a card,” “Edit this idea,” and “Add to the board.”
- Shortened the Other notes introduction and clarified its grouping, beat-conversion, removal, and deletion controls.
- Rewrote the board, outline, character, note, account, project-menu, dashboard, and card tooltips around the immediate result of clicking.
- Kept credit costs attached to every paid control.
- Kept fuller safety language for destructive actions, imports, billing changes, failed saving, and failed project loading.

### Testing

- Loaded the authenticated app with two projects, beat cards, a set-aside card, and an Other note through a local account/API simulation.
- Confirmed all requested old labels are absent from the shipped interface.
- Confirmed the exact approved import introduction and the revised import cost sentence render correctly.
- Confirmed the import sheet, project menu, Other notes view, uncertain-placement panel, conversation action, new-project sheet, and import-review screen show the intended labels and tooltips.
- Confirmed every rendered tooltip in the tested flows is 24 words or fewer.
- Confirmed paid controls still display their one- or two-credit cost.
- Confirmed no horizontal overflow at 1440 and 1024 pixels wide.
- Confirmed no browser errors during the complete interaction pass.
- Saved visual review captures as `Claude outputs/copy-import.png`, `copy-placement.png`, `copy-other-notes.png`, and `copy-new-project.png`.

### Intentionally unchanged

- Story-beat descriptions and the writer-facing editorial voice inside the board remain intact; they explain story function rather than a button click.
- Privacy promises, destructive-action warnings, subscription consequences, and data-safety error messages remain explicit.
- No project placement, import, saving, billing, account, database, or mobile-app mechanics were changed.

## 4 September 2026: Marketing-copy and credit-cost display pass

### Requested

Make the marketing explain Beatfall through the transformation from scattered notes to a structured board, preserve its strongest lines, shorten the Sign in pitch, and move action-specific credit costs out of the normal interface and into hover explainers.

### Changes

- Replaced the homepage hero description with the approved direct summary: Beatfall finds the beats, places what it can, and shows what is still missing.
- Aligned the homepage description used by search results and social previews with the same transformation.
- Shortened the Sign in pitch to the same direct explanation.
- Restored “Paste the whole mess.” as the Sign in pitch's lead-in.
- Preserved “Your notes already know the story. They're just in the wrong order.”, “It asks before it guesses. It never writes your script.”, and “Where your story falls into place.”
- Kept the real Night Haul board and projects dashboard as the proof of transformation instead of adding another feature list.
- Removed printed credit costs from paid action buttons, links, dashboard project cards, the project menu, and the notes-import sheet.
- Kept each action's exact one- or two-credit cost in its hover and keyboard-focus explainer, before the action runs.
- Updated the real product proof images so the homepage no longer shows stale inline credit costs from an earlier interface.

### Testing

- Visually inspected the complete homepage at 1440-pixel desktop and 390-pixel phone widths.
- Visually inspected the Sign in page in desktop light and dark modes.
- Confirmed the four approved marketing lines are present in their intended locations.
- Confirmed the homepage and Sign in page have no horizontal overflow at the tested widths.
- Loaded an authenticated dashboard with a real project-card flow and confirmed no paid action prints its credit cost.
- Confirmed the dashboard's Next up action, project-menu notes importer, import action, logline help, character questions, and What's missing action all state their exact cost in the hover/focus explainer.
- Confirmed the import sheet no longer repeats its cost as visible body copy.
- Confirmed the homepage's real board and dashboard proof images contain no visible inline credit costs.
- Confirmed no browser errors occurred during the marketing, responsive, dark-mode, and authenticated interaction checks.
- Saved review captures as `Claude outputs/marketing-homepage-desktop.png`, `marketing-homepage-mobile.png`, `marketing-login-desktop.png`, `marketing-login-dark.png`, and `credit-cost-hover.png`.

### Intentionally unchanged

- The approved homepage structure, pricing, founder statement, trust copy, and real product visuals remain in place.
- Credit balances, plan allowances, and the detailed Billing and Usage explanations remain visible because they are account information, not costs attached to action labels.
- Gold still identifies writing-help actions that spend credits; the explainer now carries the number.
- No project placement, import, saving, billing, account, database, or mobile-app mechanics were changed.

## 4 September 2026: Protection against conflicting saves

### Requested

Prevent one tab or computer from silently overwriting a newer version of the same project, while keeping the future mobile app limited to append-only notes associated with a chosen project.

### Changes

- Added an atomic version condition to existing-project saves using the database's existing `updated_at` value.
- A stale save now returns a specific conflict response and the newer saved project instead of overwriting it.
- Added a blocking conflict dialog that names the project and confirms that neither version has been overwritten.
- Added “Save my changes as a copy,” which preserves the newer original and creates a separately named recovered project from the stale tab's work.
- Added “Discard my changes and use the saved version,” with an explicit confirmation before the local changes are replaced.
- Re-checks the server at the moment either choice is made, so the writer receives the latest version even if it changed again while the dialog was open.
- Stopped conflict responses from entering the ordinary automatic retry loop.
- Serialized saves inside one browser so two quick edits cannot race one another with the same starting version.
- Added saved-content fingerprints so opening a board or switching views no longer writes an unchanged project or creates false conflicts.
- Kept the local project in memory and in Beatfall's browser crash cushion until a recovery choice succeeds.
- Updated `CLAUDE.md` with the decided mobile flow: choose or name a project, type or dictate one note, append it separately, and review grouped incoming notes on the web.
- Used the existing project timestamp and database trigger, so the version-check portion itself needs no new project field.

### Testing

- Simulated two tabs loading the same project version.
- Confirmed opening the project and switching to its board produced no project write.
- Confirmed the first tab saved normally and received a new database version.
- Confirmed the stale second tab received a conflict, retained its local edit, and did not change the newer database project.
- Confirmed “Save my changes as a copy” kept both versions with the correct content and opened the recovered copy.
- Confirmed “Discard my changes and use the saved version” loaded the latest original without creating another project.
- Confirmed the conflict dialog fits at 1440-pixel desktop and 390-pixel narrow widths.
- Confirmed the projects API passes a JavaScript syntax check and no browser errors occurred during the complete two-tab flow.
- Saved review captures as `Claude outputs/conflict-desktop.png`, `conflict-mobile.png`, and `conflict-resolved.png`.

### Intentionally unchanged

- Mobile files, incoming-note storage, speech capture, and the web pending-notes dialog were not built in this step; only their conflict-free boundary was recorded.
- No project column, trigger, billing rule, AI behavior, placement rule, or project format changed.
- Automatic restore points remain the next separate mechanical improvement.

## 4 September 2026: One active web device

### Requested

Allow one web browser/device to edit an account at a time. Opening Beatfall on
a laptop should immediately stop an already-open desktop browser from reading
or changing the account. Identify the browser installation rather than using
its IP address, and preserve the future phone app's append-only capture role.

### Changes

- Added a random first-party browser id stored locally as `beatfall.web-device`.
- Tabs in one browser profile share that id and remain one allowed device.
- Added `POST /api/session` to claim the active web session, `GET /api/session`
  to check it, and `DELETE /api/session` to release it on local sign-out.
- Added the active web browser id and claim time to the account profile.
- Every authenticated web endpoint now rejects a browser after another device
  has claimed the account, so the old device cannot load, save, bill, export,
  use writing help, or reach admin data.
- Supabase Realtime sends the ownership change to the open earlier browser;
  window focus, returning to a visible tab, every protected request, and a slow
  two-minute heartbeat cover a dropped live connection without wasteful polling.
- Added a blocking “Beatfall is open on another device” screen with a clear
  “Use Beatfall here instead” action that transfers ownership back.
- Web sign-out releases only the current browser session rather than globally
  signing out other Supabase clients.
- Recorded the mobile boundary in `CLAUDE.md`: future append-only capture
  endpoints explicitly bypass the web-device rule and cannot claim web editing.
- Kept Claude's concurrent Outline passage, Save, drag/Undo, and delete work
  intact; the only shared-file addition is the startup guard for this screen.

### Testing

- Passed JavaScript syntax checks for the shared platform layer, device-session
  API, account guard, projects API, and merged application.
- Simulated two independent browser storage identities against the complete
  application. Confirmed the second browser claimed the account and the first
  received the live blocking screen in under one second.
- Confirmed transferring the session back reopened the first browser and then
  blocked the second one.
- Confirmed two tabs sharing one browser id remained active together.
- Confirmed the blocking screen includes the official icon-and-wordmark lockup,
  the Beatfall tagline, plain explanation, takeover action, and local sign-out.
- Confirmed the second browser remained usable while the replaced browser was
  blocked from the application.
- Re-tested Claude's merged Outline work: an empty passage had no active save
  state; typing revealed Save; Save retained the passage, opened and focused a
  new blank box; delete removed it; and Undo restored it.
- Verified the unpushed marketing pass remains present: approved homepage and
  Sign in copy, tagline, real board/dashboard images, and action costs carried
  in hover/focus explainers rather than printed beside controls.

### Deployment note

- Run the active-device block from `supabase/schema.sql` in Supabase before
  deploying this code. It adds two columns and enables live profile updates;
  every statement is safe to re-run.

## 5 September 2026: Outline passages, and Save opens the next one

### Requested

In the Outline, typing a note and having no way to keep it where it sits. Save
should keep the passage where it was placed, open a fresh "Nothing on this beat
yet" box under it, and the Save button should appear only once there is
something to save.

### Changes

- A beat now holds a list of passages instead of one box. Old projects stored a
  single string; that is read as a list of one, so nothing written before today
  is lost and the database is unchanged.
- Save keeps the passage, opens an empty box beneath it, and puts the cursor
  there. Leaving a box still commits it, so nothing typed is ever lost, but
  only Save opens the next one.
- Removed the 400ms keystroke autosave. A box now commits on blur, on leaving
  the Outline, and on the page or tab being hidden.
- The Save row is absent until the box differs from what is stored, and a
  "Saved" receipt fades out on its own.
- A written passage sits on card stock; only the last, unwritten box keeps the
  dashed outline.
- The word count and the PDF read passages through the same accessors.

### Cross-agent note

This change was written against `public/index.html` before Codex moved the
application to `public/app.html`, and was committed there, which overwrote the
public homepage in the working tree. The homepage is intact in commit
`f3df9d0`. Both agents were editing `public/app.html` at the same time tonight;
this work was rebased three times onto Codex's newer versions and none of the
save-conflict work was lost.

### Testing

- Outline suite: an old one-string outline reads with a fresh box under it; no
  Save button until typing; Save keeps the passage and opens the next; each
  Save stacks another; editing in place adds nothing; clearing a passage and
  leaving deletes only that one; the count sums them; the list reaches the
  server; leaving the outline and hiding the tab both keep what was typed.
- Save-payload, navigation, capture-bar, board-placement, and PDF suites all
  pass against the merged file.
- No em dashes in `public/app.html`, including the four that arrived with the
  conflict sheet, which are now a colon and a comma.

### Intentionally unchanged

- Codex's save-conflict sheet, project fingerprints, and `updated_at`
  concurrency check are untouched.
- No placement, import, billing, account, or database mechanics were changed.

## 5 September 2026: Undo on an outline drag, and deleting a passage

### Requested

Dragging a note or a set-aside card onto a beat in the Outline gave no visible
way to put it back. Typed passages had no way to be deleted.

### Changes

- Dropping a set-aside card onto a beat now raises the Undo bar, which names
  the beat it came from. Undo returns the card to Set aside. Dropping a note
  already did this.
- Every written passage carries a delete in its top right corner, hidden until
  hover or keyboard focus, in the same shape as the cross on a board card.
  Deleting raises the Undo bar and Undo brings the passage back.
- The Undo bar reads "removed from" when a move has no destination, rather than
  saying something moved to nowhere.

### Testing

- The drag: the card lands on the beat, the bar comes up naming Set aside, and
  Undo returns the card to Set aside.
- The delete: two written passages carry a delete and the trailing empty box
  does not, the control is invisible at rest, deleting the first leaves the
  second and the empty box, the word count follows, and Undo restores it.
- Outline, save-payload, navigation, board-placement and PDF suites all pass.
- No em dashes in `public/app.html`.

### Intentionally unchanged

- Codex's save-conflict work, and all placement, import, billing, account and
  database mechanics.

## Open at the end of 5 September 2026

Carried forward so whoever picks this up next does not have to rediscover it.

- The `characters` column has to be added to the live database once. The
  statement is the last line of `supabase/schema.sql`. Until it runs, character
  sheets save in the browser and are lost on reload.
- The import review lets a writer untick individual notes but not individual
  characters. Characters found in a notes file are all in or all out.
- `route: 0` is a dead entry in the COST and CREDIT tables. Nothing reads it.
- Credit arithmetic has not been checked against the live database with a
  Stripe test-mode purchase.
- `contact@`, `privacy@` and `legal@` at beatfall.app need to exist and forward.
- Two agents work in this tree. Read `public/app.html` from disk immediately
  before editing it, and write it back the same minute. Tonight it changed four
  times in ninety seconds while a change was being prepared against it.

## 5 September 2026: Put the project structure where the work happens

### Requested

Move the current story structure out of the small header line and the project
menu. Give it a clearer, larger home below the note capture bar and before the
board or Outline. A structure change must not lose cards, filed notes, or any
of the passage work already added to the Outline.

### Changes

- Added one project-level Story structure bar between the capture/tray area and
  the Board or Outline. It carries the selector, completion meter, placed count,
  and empty count. The compact header now carries only the project name.
- The bar is visible on Board and Outline, and stays out of the Dashboard,
  Characters, and Notes views.
- A structure change now explains what will move before it proceeds.
- Rebuilt beat cards retain their existing metadata instead of being reduced to
  only id, text, slot, and pinned state.
- Notes filed beneath an old beat return to Other notes when that beat structure
  goes away.
- Outline passages whose beat ids do not exist in the new structure move into a
  visible Unplaced Outline passages section. Their source beat and source
  structure are shown, and each passage can be dragged onto its new beat.
- The Outline word count and PDF include those unplaced passages, so they cannot
  quietly disappear from either measure or export.
- Older projects that already contain passages stranded under obsolete beat ids
  recover those passages into the same visible section when the Outline opens.
- The existing Undo restores the complete pre-change project, including its
  structure, passage locations, and filed-note locations.

### Testing

- Loaded a saved Save the Cat project with a placed card, a filed note, a
  set-aside card, and four Outline passages, then switched it to Classic
  Three-Act in the rendered app.
- Confirmed all four passages remained exact and visible, the word count stayed
  at 22, the filed note returned to Other notes, and all three cards remained.
- Confirmed custom, declared, and suggested card metadata survived the rebuild.
- Used Undo and confirmed the Save the Cat structure, all four original passage
  locations, and the note's original Theme Stated filing were restored.
- Confirmed the structure bar renders on Board and Outline, is hidden on the
  Dashboard, and the old header structure line is gone.
- Parsed the finished inline application script successfully.

### Intentionally unchanged

- Claude's existing multi-passage Save, passage delete, and drag/Undo behavior
  remain in place.
- Outline access rules, the passage-delete styling, and broader Outline card
  movement are separate steps and were not changed here.
- No database schema or API payload shape changed; the recovery list lives in
  the existing Outline JSON.

## 5 September 2026: A permanent return trip for additional cards

### Requested

An item dragged from Set aside beneath an Outline beat is an additional card,
but the writer needs a clear way to move it back after the temporary Undo bar
is gone.

### Changes

- Set-aside items filed beneath a beat are now labelled Additional card, which
  describes what they are doing there rather than where they used to live.
- Each additional card has an always-visible Return to Set aside button on both
  the Outline and Board. Ordinary filed notes keep their separate return-to-
  notes control.
- Returning the card raises a receipt that names its old beat and Set aside as
  its destination, with a visible Undo button.
- The return only removes `attachedTo`. The card remains a beat idea in Set
  aside, and all of its other saved fields remain unchanged.
- Removed a duplicated block of filed-note CSS while adding the control.

### Testing

- Loaded a project with a primary Setup card, an additional Set aside card
  filed beneath Setup, and a research note filed beneath the same beat.
- Confirmed Additional card and Return to Set aside are always visible in both
  light and dark modes, on both Outline and Board.
- Returned the card and confirmed it appeared in the Set aside rail, the Setup
  attachment cleared, and its extra test metadata remained intact.
- Confirmed the receipt read Returned to Set aside and offered Undo.
- Used Undo and confirmed the additional card returned beneath Setup while Set
  aside became empty again. The research note and its separate action were not
  changed.
- Parsed the finished inline application script successfully.

### Intentionally unchanged

- Passage-delete styling, empty-passage wording, Outline access rules, card
  ordering, and the structure-switch work are untouched.
- No database or API changes are required.

## 5 September 2026: One action system beneath every Outline beat

### Requested

Make the newly visible passage deletion feel related to removing additional
cards and filed notes. Evaluate whether Set aside ideas, categorized notes, and
typed Outline details should enter and leave a beat through one coherent
system rather than three accidental-looking interactions.

### UX decision

The entry methods remain intentionally different. Additional cards and notes
already exist, so dragging them to a beat is direct manipulation. Outline prose
does not exist yet, so typing it in place is the natural action. Consistency is
applied after placement: every item identifies what it is, every exit action
names where it goes, and every completed exit produces the same Undo receipt.

### Changes

- Added one shared, always-visible Outline action style.
- Additional cards use Return to Set aside.
- Filed categorized notes now use Return to Notes instead of a hover-only
  curved arrow.
- Saved typed passages now use a visible Delete passage button instead of a
  tiny hover-only cross.
- Movement actions remain blue; deletion is red. Their size, border, type,
  alignment, hover state, and focus state otherwise match.
- Both kinds of dragged-in material produce an adaptive placement receipt:
  Additional card added for Set aside material and Note filed under the beat
  for categorized notes.
- Clean passages keep Delete passage visible and hide Save. Editing reveals
  Save without displacing Delete passage. The unwritten trailing box never has
  a delete action.

### Testing

- Rendered a Setup beat containing a primary card, an additional card, a filed
  research note, two saved passages, and the trailing empty passage.
- Confirmed Return to Set aside, Return to Notes, and both Delete passage
  controls were simultaneously visible and visually related in light and dark
  modes.
- Deleted the first passage and confirmed only the second remained; Undo
  restored both passages.
- Returned the research note and confirmed its beat attachment cleared while
  its note type and extra metadata remained; Undo restored the attachment.
- Confirmed the additional card was unaffected by both operations.
- Edited and saved an existing passage: Save appeared only while dirty, hid
  after saving, no extra passage was created, and Delete passage stayed visible.
- Parsed the finished inline application script successfully.

### Intentionally unchanged

- Drag mechanics, card and note classification, passage storage, the Notes
  screen, empty-passage wording, and Outline access rules were not changed.
- No database or API changes are required.

## 5 September 2026: Outline starts after the board is complete

### Requested

Do not let a writer begin the Outline until every beat in the project's current
structure has at least one card. Once the Outline has begun, later rearranging
must not take it away.

### Changes

- A project that has never opened Outline now shows Outline as locked until
  every beat has a card. The navigation label and tooltip state exactly how
  many beats still need cards.
- Clicking the locked control keeps the writer on the Board and shows a clear
  explanation with the structure's total beat count and the number remaining.
- The first successful Outline opening stores `outline.__started = true` in
  the existing Outline JSON. From then on the project keeps Outline access even
  if a card is moved, removed, or remapped by a structure change.
- Existing projects with any saved Outline writing are treated as already
  started, so this gate never strands earlier work.
- Switching projects from Outline now commits visible boxes to their original
  project before changing the active project. A locked destination opens on
  its Board instead of inheriting the previous project's Outline or prose.
- Every trailing Outline box now uses the same direct prompt: What happens in
  this beat?
- Structure conversion and stranded-prose recovery preserve the start marker
  and ignore reserved `__` Outline keys when walking beat ids.

### Testing

- Confirmed a one-card Save the Cat project reported 14 beats remaining,
  stayed on Board when Outline was clicked, and showed no irrelevant Undo.
- Confirmed a complete 15-beat project opened Outline, created the start
  marker, and rendered 15 matching What happens in this beat? prompts without
  fabricating prose.
- Moved a card off that completed board and confirmed its already-started
  Outline still opened with one beat empty.
- Confirmed an older one-card project with saved Outline prose opened despite
  14 empty beats, preserved the prose exactly, and acquired the start marker.
- Switched from that Outline to the incomplete project and confirmed the new
  project landed on Board, remained locked, and received none of the earlier
  project's prose.
- Parsed the finished inline application script successfully.

### Intentionally unchanged

- This is a one-time start gate, not permanent completeness policing. Writers
  may deliberately leave a beat open after Outline has begun.
- Card placement, additional-card handling, filed-note handling, and passage
  actions are unchanged.
- No database schema or API payload change is required; the marker lives in the
  existing Outline JSON.

## 5 September 2026: Strict Outline gate and a clean Board

### Correction requested

The earlier one-time Outline unlock was too permissive. Outline must be
unavailable whenever any beat is empty, even when the project already contains
Outline prose. Material added while outlining must also respect the existing
data model: Set aside ideas are cards; categorized notes and typed passages are
Outline material, not Board cards.

### Changes

- Outline now requires every beat in the current structure to have a card on
  every opening. Existing prose and the obsolete `outline.__started` marker no
  longer bypass the gate.
- Saved Outline writing is preserved while locked and becomes visible again
  when the Board is complete.
- A remembered Outline view, a switch from another project, and a structure
  change can no longer leave an incomplete project showing Outline.
- Dragging a Set aside idea into Outline now makes it a real beat card: its slot
  becomes the destination beat, its placed dot is filled, and it uses the
  ordinary Board card with the move menu, dot, and delete X.
- `pinned` remains the only state that creates the gold card edge. The new
  origin marker never changes color or styling.
- The real card keeps Return to Set aside in Outline. Returning it clears its
  beat placement and placed-dot state, with the normal Undo receipt.
- Existing projects are upgraded automatically: older Set aside attachments
  become real pinned cards in the beat where the writer placed them, with all
  unrelated card data preserved.
- Categorized notes may still be filed beneath a beat in Outline, but no filed
  notes render on Board. Typed Outline passages were already Outline-only and
  remain so.

### Testing

- Loaded an incomplete 1-of-15 project containing saved prose and an old
  `__started` marker. Outline remained locked, stayed on Board when clicked,
  and accurately reported 14 missing beats.
- Loaded a complete project containing a legacy attached Set aside card and a
  filed research note. The legacy item became a real pinned Setup card with all
  three standard Board controls; its unrelated test metadata survived.
- Confirmed the Board contained zero attached-note rows and no research-note
  text, while the filed research note remained visible beneath Setup in
  Outline.
- Confirmed the additional card showed Return to Set aside in Outline and
  returned cleanly without moving or deleting the research note.
- Toggled the placed dot on the migrated card and confirmed the `pinned` class
  and gold edge disappeared with the hollow dot, then returned with the filled
  dot. No Outline-specific gold class exists.
- Confirmed the automatic migration persisted the real beat slot, placed-dot
  state, origin marker, and unrelated card metadata through the normal save.
- Parsed the finished inline application script successfully.

### Intentionally unchanged

- The existing placed-dot behavior, three-dot move menu, delete X, and Board
  card styling remain the card system. No parallel card controls were added.
- Notes keep their categories and remain accessible from Notes while filed in
  Outline. Typed passages remain in the existing Outline JSON.
- No database schema or API payload changes are required; the origin marker is
  one field inside the existing card JSON.

## 5 September 2026: Outline lock no longer covers the app

### Problem found

The Outline navigation button used the generic class `locked`. Beatfall already
uses that class for the full-screen one-device session blocker, so CSS expanded
the small Outline control across the viewport and intercepted clicks meant for
the Board and other sections.

### Fix and testing

- Renamed the navigation-only state to `outline-locked`. The full-screen
  session blocker keeps its existing `locked` class and behavior.
- Opened an incomplete project from the projects dashboard and confirmed its
  Board remained fully usable.
- Opened Characters and Notes, then returned to Board successfully.
- Clicked the locked Outline control and confirmed only Outline was refused;
  the writer stayed on Board and received the correct 14-beat explanation.
- Parsed the finished inline application script successfully.

No project data, access rule, database schema, or API behavior changed.

## 5 September 2026: One story, one version

### Problem found

Dirt Money had forked into "Dirt Money, recovered copy" and then "Dirt Money,
recovered copy recovered copy". Changing the structure on the board was enough
to do it.

The cause was in `api/projects.js`. Every save carried the timestamp the browser
had read and the update only applied if the row still matched it exactly. Two
faults, both reachable on an ordinary day. A project the browser had not re-read
carried no timestamp at all, and the first branch refused that outright, so
every save of it failed on sight. And an exact string match on a timestamptz is
fragile in the ways timestamps always are. Each refusal offered to keep the
writer's work as a second project, so one script became three.

### Changes

- `api/projects.js` updates the row. No precondition, no `version_conflict`,
  no 409. The last save wins, which is what one writer with one account editing
  their own script expects.
- Removed the conflict sheet, its stylesheet block, the conflict queue, the
  copy and discard paths, and the "recovered copy" naming.
- Added `refreshOnReturn()`. A tab returning to the foreground with nothing
  unsaved reloads the projects first, so a desktop left open overnight catches
  up to what the laptop wrote instead of pushing last night's copy over it. A
  tab holding unsaved work is left alone, because that work is the newer of the
  two.

### Also fixed

The project switcher was slicing every title in half. `.tabs` is a flex column
with a 230px max height, so with twelve scripts each row shrank to 18px around
30px of text. Rows are now `flex:0 0 auto` with a real line-height; the list
scrolls instead. It looked fine at eight scripts, which is why it shipped.

### Testing

- A save carrying no timestamp lands, does not fork the project, and reports
  "saved".
- A save from a timestamp behind the server still lands.
- A tab returning to the foreground picks up another device's version.
- A tab with unsaved work keeps it.
- Twelve scripts: no row clipped, every row 32px, the list scrolls.
- Outline passages, Save, delete, drag and return, board placement, PDF, save
  payload, navigation and capture bar all pass.
- Confirmed the Outline lock refuses only Outline: Board, Characters and Notes
  stay reachable from anywhere.

### Intentionally unchanged

- The Outline gate stays. Kris wants Outline locked until every beat has a card
  and everything else open, which is what it does.
- The one-device session claim is untouched.

### Left for Kris

- The junk projects from the old behaviour are still in the account: "Dirt
  Money, recovered copy" and "Dirt Money, recovered copy recovered copy". Check
  which one holds the newest work before deleting the others.

## 5 September 2026: The board keeps its shape, and the Outline stops being a vault

### Why

The Outline was locked away because material added there was rendering on the
Beat Board and wrecking its design. The lock was a workaround for a layout
problem, so this fixes the layout problem and lets the lock go back to doing
only its own job.

### The board was sizing itself to its contents

`main` sits in a flex column and carried `margin:0 auto`. An auto margin on the
cross axis switches off the stretch a flex item would otherwise get, so `main`
sized to its own content. Dirt Money, whose cards are short, came out 622px wide
and rendered two columns. Night Haul, same structure, same beats, holds long
cards and filled the window at five. One project looked like a different app
from the next. `width:100%` makes it definite; `max-width` still caps it and the
auto margins still centre it.

### What the board shows of the Outline

That it exists, and nothing else. A beat carrying prose or filed notes now shows
a count in its head, in the same quiet key as the undecided flag: "2 passages ·
1 note". Pressing it opens the Outline scrolled to that beat, which makes the
board a table of contents into the writing rather than a place the writing
leaks into. A beat with nothing written says nothing.

### The gate opens once and stays open

Outline still waits until every beat has a card. But taking a card off a beat
afterwards no longer takes a writer's prose away from them: the first successful
opening records `__started` in the outline object, and access survives card
removal and structure changes. Leaving a beat open on purpose is something this
app tells writers they are allowed to do. A project that has never qualified is
still held at the Board.

### A price a finger can read

The rule is that nothing spends a credit without saying so first. Moving prices
into hover explainers kept that for a mouse and quietly broke it for a finger:
there is no hover on a touch screen, and the tap that would reveal the explainer
is the same tap that runs the action. On a touch screen a paid control now
answers the first tap with its price and does nothing else; the second tap runs
it. Free controls and mouse behaviour are untouched. The test is `data-costed`,
which `marksCost()` sets, so it cannot drift from the COST table.

### Testing

- Short cards and long cards now render the same column count at 1253 and 1440.
- No outline prose and no filed-note rows appear anywhere on the board.
- The mark counts passages and notes, singular and plural, is absent on a bare
  beat, and opens the Outline at its own beat.
- Removing a card from a started project leaves the Outline open with its
  writing intact; a structure change does not shut it; a project that never
  qualified stays at the Board.
- On a touch screen the first tap on a paid control spends nothing and shows the
  price, the second runs it, and a free control still works on one tap.
- Outline passages, save payload, capture bar, board placement, drag and return,
  PDF, and the save-sync suite all pass.

## 5 September 2026: The reader stops throwing away the two best signals in a file

### What the Mayberry file exposed

Kris pasted a short film. Two of eight beats were placed. The Hook, which he had
typed OPENING: over, was in Notes tagged IMAGE. The ending, which he had typed
ENDING IDEA: over, was in Notes tagged IMAGE, and Final Image was empty. The
diner scene, the same. The Choice card read "Possible final turn During the town
ceremony", with his own label printed on the front of it.

Three separate faults, all of them ours.

### Placement was gated on the kind of note

`const named = kind === "beat" && S.slots.some(...)`. The instant the reader
called a note an image it could not reach the board, however well it fitted, and
the prompt above it said in as many words that images are not beats. But in a
film every beat is an image: the first slot of Save the Cat is called Opening
Image. The taxonomy was competing with the placement instead of describing what
was left over after it. Placement is now judged on whether the note is a moment
that meets the beat's requirement, whatever kind of note it is, and the prompt
says the same.

### Headings only matched a beat's exact name

`beatFromHeading` compared the writer's label against the slot name and nothing
else, so it caught MIDPOINT: and missed OPENING:, ENDING IDEA:, FIRST SHOT:,
LAST SHOT:, CLOSING IMAGE: and every other thing a person actually types. Added
`HEAD_ALIAS`, per slot, per structure. Only unambiguous aliases are in it:
MID-STORY over a scene in an eight beat short could be The Cost or The Turn, and
"Possible final turn" over the climax speech turned out to mean The Choice, so
neither is aliased. A declared placement skips the confidence gate, which makes
a wrong one worse than none.

### A position label was being glued to the card

`headerLine` classes a label as an attribution ("Rusk calls Dale:") when it is
not shouty, and an attribution is prepended to the line below it. Any heading
that talks about position in the story is now a section heading whatever its
case, so it either declares a beat or is dropped, and never ends up as the first
words of a card.

### And a half placed note now goes where it can be seen

A note the reader was 55 to 74 per cent sure about kept its own kind, so it
landed on the note shelf, where the "possibly The Cost" hint is never drawn.
Anything carrying a hint now lands in Set aside, which is where a writer can
read the guess and act on it with one drag.

### Testing

- `foldNotes` on the real Mayberry file: both headings resolve, Final Image gets
  the gazebo, Hook gets the clock shop, no label is glued to any card, no stub
  notes are left behind, and MID-STORY and "Possible final turn" correctly
  declare nothing.
- The whole import path with a reader that names scenes as images and clues
  while still naming their beats: seven of eight beats filled, Final Image
  holding both endings as an undecided pair, Who and What They Want correctly
  empty, and the two uncertain notes in Set aside with their hints.
- Outline, gate, board trace, touch pricing, save sync, save payload, capture
  bar, board placement, PDF and the import rename guard all pass.

### Not fixed, on purpose

The format is still chosen on the new project sheet before the file is read,
even when the file states it in its second line. That is the next thing.

## 5 September 2026: A full board is not the goal

### What the second Mayberry run showed

Seven of eight beats filled and Set aside came back empty, which is the failure
I asked Kris to watch for. The Hook, the Disruption, the Turn, the Choice and
both endings are right, and both endings sitting on Final Image together is the
best single piece of reading the app has done. But two cards landed one beat
early: the jail cell took The First Attempt when it belongs at The Cost, and
"agrees to attend one event" took Who and What They Want when it is The First
Attempt. The Cost was left empty while the note that belongs in it, Tommy being
assigned to protect him, was still on the note shelf.

### Cause

Removing the kind gate was right, but the confidence floor of 75 had been doing
half its work in company with that gate and was left carrying the whole load
alone. A note that only sort of fits could take a beat away from the note that
fits it exactly.

### Changes

- `PLACE_SURE` (80) and `SUGGEST_SURE` (55) are named constants instead of bare
  numbers in two places. 80 rather than 85 on purpose: a higher floor would have
  thrown away the second ending, which was correct and was placed at a figure in
  that band. The review sheet already prints the real confidence beside every
  placement, so this number can be set from what the reader reports rather than
  from instinct.
- Three rules added to the classifier: a note may only take a beat it satisfies
  on its own terms; if it is really the beat before or after, name that one; if
  two beats are being weighed for one note, that is not certainty, so leave it
  null. And plainly: empty beats and unplaced notes are the normal result on a
  real file, and a board where every beat came out full usually means notes were
  stretched to reach them.

### Testing

- The same import path with the two stretched notes at 78 and 79 and the second
  ending at 84: both stretches go to Set aside carrying "possibly The First
  Attempt" and "possibly Who, and What They Want", the second ending stays on
  Final Image beside the first, and Tommy's escort reaches Set aside with
  "possibly The Cost" instead of sitting on the note shelf.
- Headings, outline, gate, board trace, touch pricing, save sync, save payload,
  board placement, import rename guard and PDF all pass.

## 5 September 2026: The review sheet settles two arguments

### The numbers, read off a real run

Kris sent the review sheet for the Mayberry file. The reader's entire range for
a judgment it had to make itself was 68 to 82. Sorted by what it reported:

    82  The Choice          right
    78  The Disruption      right
    75  Who and What...     wrong, that note is The First Attempt
    70  The Cost            wrong, that note is The Turn
    68  The Turn            wrong, that note is a request for a scene

The line between its right answers and its wrong ones falls between 75 and 78.

That settles the floor and it corrects me twice. 85 would have been a disaster:
this reader never reports 85 for its own judgment on a file like this. 80, which
shipped an hour ago, was still too high, because it threw away The Disruption, a
correct placement, and caught nothing in exchange. `PLACE_SURE` is 78, measured.
Anyone moving it again should read a review sheet first.

### The kind was still deciding the beat, inside the reader's head

Removing the code gate was necessary and not sufficient. The prompt asked for
the kind before the beat id, so the reader committed to "image", then answered
the beat id consistently with what it had just said. The fake jail cell, the
second ending, the diner flyers and Tommy's escort all came back typed image or
clue with no beat at all. Not blocked by us this time. Never offered.

The classifier now asks for b FIRST, says in as many words that a note written
as an image, a shot, a line or a clue can be a beat and that what it is written
as has no bearing on where it goes, and describes k as a label for the shelf
that never restricts b. The example reply carries k "image" with a beat id, so
the shape of the answer says the same thing as the words.

### Testing

- Replayed the exact figures from that review sheet against this build: Hook and
  Final Image by heading, The Disruption at 78 and The Choice at 82 placed, and
  the three wrong ones in Set aside carrying their guesses. Four of eight, all
  four right, three visible hints. That is the shape the product promises.
- Headings, outline, gate, board trace, touch pricing, save sync, save payload,
  board placement, import rename guard all pass.

### Still open

Pass one is doing very well: logline, protagonist, genre, tone, setting and
format all correct, four people with roles. But the two lines it read those from
("I'm thinking of calling this THE MIDGET OF MAYBERRY", "Short film. Southern
dark comedy...") also land on the note shelf as structural ideas. Once a line
has been used as a project detail it should not also be filed as a note.

## 5 September 2026: The board is cast, not sorted

### Why

Four runs on the Mayberry file gave four different boards, and the last two ran
on identical code. The cause was the question we were asking. For each note in
turn, which beat is this? Asked that way a note is never compared against the
note that should have had the beat, and an empty slot always looks like a fit.
That is how the jail cell took The First Attempt while the note that belonged
there sat on the shelf, and it is why more rules kept moving the problem around
instead of removing it.

### The casting call

A third pass, `castTheBoard`, runs once after the batch pass and before anything
is assembled. Every beat is asked once, with its requirement and every plausible
note laid out beneath it, and the answer is a choice between candidates rather
than a verdict on one note. It is also the only moment anything sees the whole
board at once.

- Beats the writer declared with a heading are not up for audition and are shown
  as already set.
- A character sketch is never a candidate. That is enforced in code now, not
  asked for in a sentence, because the reader put Eli's bio on the board once.
- A note may be named for at most one beat.
- Null is a real answer and the prompt says so twice. A beat with nothing that
  truly satisfies it stays open.
- Anything the casting call looked at and passed over loses the beat it won in
  the batch pass, and keeps its earlier guess as the "possibly" hint in Set
  aside.
- If the call fails or returns nothing, the batch result stands. The pass is an
  improvement, never a dependency.
- Skipped when the plausible pool is over 90 notes, and on secondary stories,
  which do not have a board to cast.

### A bug this found before it shipped

`Number(null)` is 0, and 0 is a real note: the first line of the file. A beat
answered null, which is the answer we most want the reader free to give, would
have quietly taken whatever the writer typed first. On the test it took "I'm
thinking of calling this THE MIDGET OF MAYBERRY" and put it on Who, and What
They Want. The field is now read as a number only when it actually is one.

### Testing

Replaying the reader's real 5 September answers through the batch pass and
letting the casting call see them all together: the writer's Hook and Final
Image are untouched and never offered as candidates, Eli's bio never auditions,
Sherry's admission is reached down for and given The Turn, Tommy's escort comes
off the shelf to The Cost, the diner flyers move off Who and What They Want to
The First Attempt where they belong, the note casting passed over loses its beat
and appears in Set aside with its guess, and a beat answered null is left open.
Seven of eight, and the eighth an honest hole. With the casting call made to
fail, the board falls back to the batch result rather than collapsing.

Outline, gate, board trace, touch pricing, save sync, save payload, board
placement, import rename guard and PDF all pass.

## 5 September 2026: Three things the casting call's first run exposed

The casting call did its job. "Eli absolutely hates the phrase but agrees to
attend one event" went to The First Attempt, which is where it belongs and where
nothing had put it in five previous runs. Sherry's admission got a beat. The
board came back coherent. Three faults showed up with it, two of them mine.

### The review sheet said 0% sure

Every placement the casting call made was reported as "0% sure", because the
sheet was still printing the batch pass's confidence for a decision the batch
pass did not make. A board that reads as nought per cent sure of itself is not
one anybody is going to trust, and it looked like a bug because it was one. The
casting call's own figure is carried through now.

### A note that came second fell all the way to the note shelf

The jail cell had a beat in the run before and lost it to a better candidate,
which is correct. But losing the audition dropped it out of Set aside entirely
and onto the note shelf, where the near miss is never even drawn. So the casting
call is now asked for the runner up on each beat, and a runner up lands in Set
aside carrying the beat it nearly won. One drag settles it.

### A stated want is not a scene

"Eli WANT: get through the weekend, take the money, keep the shop open" was cast
into Who, and What They Want. It answers that beat exactly and it is still
wrong: it is the writer telling the reader about the character, not a moment
with a camera on it. Same class of error as the bio two runs ago, in a new
costume. The casting call is now told so by name, next to the rule about
character sketches.

### Also hardened

`alt` is read as a number only when it actually is one, the same guard the `n`
field already had, so a null runner up can never mean note zero. A note cannot
be recorded as nearly winning a beat it actually won, or one already taken.

### Testing

Every casting assertion passes, plus two new ones: no placement is reported at
nought per cent, and the runner up appears in Set aside labelled with the beat
it nearly won. The fallback path still holds: with the casting call made to
fail, the batch result stands.

## 5 September 2026: Asked twice, ignored twice, so now it is a rule

### The WANT line

"Eli WANT: get through the weekend, take the money, keep the shop open" was cast
into Who, and What They Want again, at 78 per cent, one run after the prompt was
told by name not to do that. Asked twice and ignored twice is the signal to stop
asking. `isStatement()` now bars any note carrying a labelled WANT, NEED, ARC,
GOAL, FLAW, THEME, VOICE, TONE, BACKSTORY or PREMISE from auditioning at all,
the same way a character sketch is barred.

It is worth writing down why the reader keeps reaching for it. These lines are
the truest sentences in the file, and the WANT line answers a beat called Who,
and What They Want more directly than any scene ever could. It is still not a
scene. It is the writer talking about the character, and on the board it is a
card nobody can shoot. The first pass already puts both lines where they belong,
in the brief and on the character sheet.

### "only 0% sure" on the runner ups

The casting call scores the note it picks and never the one it passes over, so a
runner up has no figure, and the review sheet was printing "only 0% sure" beside
notes the reader had actually thought hard about. Three of the five notes in Set
aside read that way. A runner up is marked as one now and the row says "possibly
The Disruption, the runner up for it" instead of quoting a number that was never
measured.

### Testing

The casting suite now includes a reader that reaches for the WANT line at 78 per
cent and is refused, and a check that nothing in Set aside is described as
nought per cent sure. Everything else still passes, including the fallback with
the casting call unavailable.

## 5 September 2026: Read it three times and keep what agrees

### What was actually wrong

Six rounds of "it put that note on the wrong beat, add a rule". Each rule was
defensible, each one helped the note it was written for, and each one shoved
something else somewhere new. The pattern was the tell. Placement is a judgment
on ambiguous material answered at the model's normal sampling temperature, so it
moves between runs on identical input. Every one of those rounds was treating a
single roll of the dice as a defect.

Some were real defects and stay fixed: the kind gate in code, the ordering of b
and k, `Number(null)` meaning note zero, the 0% on the review sheet, headings,
bios and WANT lines. The rest was chasing variance with rules, which cannot work,
because a rule that catches this run's mistake has no opinion about next run's.

### The change

The casting call asks the same question three times and keeps what agrees. A
beat is only filled by a note that won it in at least two of the three readings.
The three calls carry the same session id, so they are one charge to the writer,
and they run together so the wait is one call long.

What the readings disagree about is, by definition, the uncertain part of the
file. A note one reading in three put on a beat goes to Set aside carrying that
beat, and the sheet says "one reading in three put it there" rather than quoting
a figure. A beat the readings split over is left open, which is the honest
answer: two good candidates and no way to choose is exactly what a hole in the
board is for.

The confidence on a card is now a count of agreements. Two of three is 67, three
of three is 100. The review sheets proved the reader's own figure does not
separate its right answers from its wrong ones: on 5 September it was 92 per cent
certain of the single plainly wrong placement in the file. A count of agreements
is a measurement.

Partial outage degrades rather than fails: with fewer than three replies a simple
majority of what came back is used, and with none the batch pass stands.

### Testing

Three readings that agree, disagree and split on purpose. Two of three settles a
beat at 67, three of three at 100, a beat the readings split over is left open
with both candidates in Set aside named for it, a note no reading chose is set
aside, the WANT line is refused however hard a reading reaches for it, the board
is read exactly three times, and nothing anywhere is described as nought per cent
sure. The fallback with the casting call unavailable still holds.

## 5 September 2026: Two ways to start the next one

Eleven scripts on the shelf, and New project lived at the top of the page and
nowhere else, so starting a twelfth meant scrolling all the way back.

Not a floating button. That is a phone convention, it would be the only piece of
furniture on that page that hovers over the work, and on a short window it sits
on top of the cards it is meant to help you add to. This page reads like a table
with index cards on it and nothing else on it floats.

- The "Your scripts" row parks under the masthead when you scroll past it, at
  76px, the same offset the structure bar uses. It already holds the label, the
  rule and the button, so the button comes along for free and the section label
  stays readable. Static again under 700px, where the shelf is one column and
  the header would eat the screen.
- One blank card at the end of the shelf, dashed, the way an empty beat is drawn
  on the board, reading New project. It is what the next script looks like
  before it is written, and it means a writer who has just finished reading
  everything they own does not have to go anywhere to start another. One card
  for the whole shelf, never one per section.

### Testing

Eleven projects across three media: the header is sticky at 76px with ground
under it so cards pass behind rather than through, exactly one blank card exists
and it is the last on the shelf, and scrolled to the very bottom both ways in
are on screen at once.

## 5 September 2026: Two doors to the PDF, neither of them locked

Kris could not find Save as PDF on his own board. It was the third project
action inside a menu whose main job is switching projects, so on an eleven
script account it sat under a scrolling list of every title he owns. It is also
the only thing in this app that takes a writer's work OUT of it, and it was
harder to reach than "See an example".

- Moved to the top of the action group, above Project details.
- The line that says "every beat has a card" now offers it. That sentence was
  doing nothing but congratulating the writer at the exact moment they want the
  board on paper, so it is the door. No new control, and it appears only when
  there is something to celebrate. An unfinished board keeps saying what is
  missing and offers nothing.

### Not locked, on purpose

The question was whether to gate the PDF behind a complete board the way Outline
is gated. No, and the two are not alike. The Outline lock earns itself: an
outline of eight empty prompts is not an outline, and that writing surface
depends on the spine being settled. Export is different. It is how work leaves
the app, onto a table or to a collaborator, and gating it behind a completeness
score is the app holding a writer's own material against a metric it invented.
It would also contradict the footer.

There is a craft argument too. The PDF already prints empty beats as gaps.
Spreading a half-built board on a table with the holes showing is one of the
best uses of the feature, not a degraded one.

### Testing

Save as PDF is the first of the project actions and sits above Project details.
A finished board carries the door in its own sentence and pressing it produces
the file. A half-built board says what is missing and offers no door, while the
menu item stays present and enabled.

## 5 September 2026: The bar stops asking and starts offering

The Save as PDF link glued to the end of the "every beat has a card" line looked
accidental, and it deserved to. Same colour, same size, same weight as the
status text it followed, joined by a full stop, so the eye could not tell where
the state ended and the control began. Worse, it was gold, and gold in this app
means the action spends credits. The one colour a writer has been taught to read
as money was sitting on the one action that is always free.

### It is a button now, and it takes a slot rather than adding one

`What's missing?` hides the moment every beat has a card, which leaves a hole in
the capture bar at exactly the moment the board is finished. Save as PDF stands
there instead. Same position, same size, only ever one of the two present: while
beats are open the bar asks what is missing, and when the last card lands the
question has no answer left and the offer takes its place. Nothing on the bar
moves. The gapcount line is a status line again with no control inside it.

### Not red

Red was floated and is wrong. Red is Delete and Empty this board, and a writer
taught that red destroys should never meet it on the control that hands them
their work. Not gold either. The colour is the navy a completed project already
wears on the dashboard, so the board finishing and the card going navy read as
the same event.

Set to `--win-2` rather than `--win`: at full strength in light mode it came out
within a few points of the blue on Place it beside it, and the pair read as two
primaries. The deeper navy with the warm `--win-ink` type is plainly a different
kind of control, and in dark mode it sits well against the pale blue Place it.

### Testing

A finished board swaps the question for the offer, a half-built board asks the
question and offers nothing, the status line carries no control, pressing the
button produces the file, and Save as PDF remains first in the project menu and
enabled at every stage, because export is never conditional.

## 5 September 2026: A finished card hands you the script

No fourth button in the row. Open, Details and Delete is balanced with Delete on
its own end, and export is not a shelf-level urgency for most cards.

The slot already existed and was doing nothing. On an unfinished card that bar
is a live control: Next up, the beat name, a chevron, and pressing it drops the
writer into the conversation about that hole. On a finished card the same box,
the same height, the same place held a plain div reading "Every beat has a
card." It looked pressable and it was not, which is precisely the fault fixed in
the structure bar an hour earlier, one level up.

So the finished card's bar is a control now: FINISHED / Save as PDF, with a
download mark where the chevron was. The percentage and "15 of 15 beats"
directly above already state the board is complete, so the bar gives up the
sentence and does a job.

- `exportPDF(which)` takes an optional project and reads `proj` throughout, so
  the shelf can print a finished script without opening it. Called with nothing
  it prints the project you are standing in, which is every other caller.
- Pressing it leaves the writer on the dashboard. Three finished scripts, three
  PDFs for a meeting, without entering a single project.
- The chevron's gold is legible on paper stock and nearly gone on navy, so the
  mark and the label take `--win-ink` on a finished card.

### Testing

An unfinished card still says what is next and a finished one carries the
control, both in a 46px box so nothing on the shelf shifts. No inert div is left
behind. Pressing it downloads the project whose card was pressed, not the one
last opened, and the view stays on the dashboard.

## 5 September 2026: An empty beat in the Outline says so

The board reads at a glance and the Outline did not, and the reason is not that
gold is too quiet. It is that on the board an empty beat is a visible absence of
white card, while in the Outline every beat ends in an empty dashed box whether
it holds cards or not. The only difference between a hole and an unwritten beat
was four points of hue on a ten pixel heading: gold #7B5A13 against warm grey
#726859.

Three changes, all in the colour this app already uses for missing.

- The Outline only ever set the `gap` class, which means an empty beat NOT
  sitting between two full ones got no mark at all. The board golds every empty
  beat and reserves the gap dot for one in the middle. Same two states, same two
  classes, both surfaces now.
- The hole says what it is: "no card yet", in the same nine pixel gold as the
  undecided flag, right after the beat name. Named rather than merely tinted.
- The empty beat's write box is drawn in `--gold-hair` instead of the neutral
  rule. It is the biggest shape on the row and does most of the work. A beat
  that has cards and simply has not been written under keeps the quiet
  hairline, so the distinction stays meaningful.

### Not red

Red was suggested and is wrong for the same reason it was wrong on the PDF
button. Red in this app is Delete and Empty this board. A beat nobody has
written yet is not an error, it is the ordinary state of unfinished work, and
gold is already the word for missing right across the board. Better to say the
same word louder than to invent a third meaning for red.

## 5 September 2026: A blank card on every shelf, and a hairline sealed

### One per section

The blank card went at the end of the whole page, which put it under Short films
and nowhere else. Each medium is its own shelf, so a writer looking at their
television projects had to go back to the top to start another one. Every
section ends in its own blank now, including a section holding a single project.

### The navy hairline in the left margin

Kris saw the edge of a card sliding up the left side of the sticky header. The
cause: `.pcard.current`, the project you are standing in, carries a 1px ring as
`box-shadow: 0 0 0 1px`, and a spread shadow paints one pixel OUTSIDE the box.
The card and the sticky header share a left edge at the wrap's content box, so
that one pixel of navy was outside the header's background and slid up the
padding as the shelf scrolled under.

Fixed with two offset copies of the header's own background,
`box-shadow: 34px 0 0 var(--ground), -34px 0 0 var(--ground)`, which paints the
wrap's padding on both sides without touching the layout and without hard-coding
the padding, which changes at the narrow breakpoint.

### Testing

Four media, four sections, one blank card each and each last in its own section.
The header sticks at 76px with ground under it and now paints past its own box
on both sides. Scrolled to the foot of the shelf, both New project and the last
blank card are on screen.


## 2026-09-06 - The bar rearranged, and the wall-of-text trap closed

### What changed

Kris: "maybe the notes button could replace what's missing beside place it and
what's missing could go next to the beat counter where it says 'X beats still
empty'."

Three moves, one idea: a control belongs beside the thing it acts on.

1. The notes importer now has a door on the capture bar, next to Place it, as
   a matched pair. One note goes on the board; a page of them goes to the
   importer. It used to live only in the project menu, three clicks away and
   invisible to anyone who had not gone looking. Same words as the menu item,
   "Paste in your notes", and it carries its price the same way.

2. What's missing? and Save as PDF moved off the capture bar and onto the
   structure bar, on the line with the beat count. While beats are empty the
   line reads "14 beats still empty" with What's missing? beside it; when the
   last card lands the question has no answer left and Save as PDF takes its
   place. The status text goes quiet on a finished board rather than repeating
   the meter directly above it.

3. Pasting a page of notes into the one-note box used to make one enormous
   card, silently, with nothing offering to sort it. Two lines or more and the
   bar now says what Place it would do and offers the importer holding the same
   text. Nothing is decided for the writer: Place it still works and still
   makes one card. If they back out of the importer without running it, their
   text goes back in the box they pasted it into.

### Testing

Empty board, half-built board and finished board, at 1400px and at 880px:
the pair on the capture bar keeps equal widths, What's missing? and Save as PDF
swap in the right places and never both show, and the offer line wraps rather
than overflowing. Three lines pasted into the note box raises the offer, carries
the text into the importer with the word count correct, and Cancel puts it back.
Both new controls carry data-costed, so a finger gets the price before the
spend. Full suite re-run: vshape, vfile, vundel, vcast, vsync, voutline-app,
vnote, vplace, vboard, vsave, vshelf, vout, vcarddl, vcost, vrename, vpdfcast
all pass. No em dashes.

No project data, access rule, database schema, or API behavior changed.


## 2026-09-06 - A ceiling on Place it

Kris: "should we add a character/sentence cap to the place it input field...to
prevent them from pasting a whole shitload of notes into this box and throwing
the system off."

He is right about the leak. Place it is free and it sends the note to the model
(`smartProposal` interpolates the raw text into the prompt with no bound), so
without a ceiling the free door will carry a whole notes file through it, and
the model asked which single beat a 3,000 word paste belongs in answers badly
and deserves to.

Two marks, neither of them a maxlength. A maxlength eats the tail of a paste in
silence and a writer who cannot see what was cut has lost work. The text always
stays in the box; what changes is what the bar offers to do with it.

- NOTE_LONG, 250 characters, or two lines: the offer line appears and Place it
  still works. Measured on a Save the Cat board, 220 characters is 202px of
  card and still reads as an index card; 320 is 287px, 480 is 413px. The wall is
  a grid, so the tallest card in an act sets the height of every beat in that
  act, which is how one long note leaves four empty beats sitting in 400px of
  white space.
- NOTE_MAX, 1,000 characters, about 170 words: Place it goes disabled, the bar
  says "That is 1,745 characters. This box takes one note," and the importer is
  offered beside it. No honest note about one beat runs 170 words, so the
  ceiling never touches a writer working the way the box intends.

`propose()` checks the ceiling too, because Enter also places a note and a
disabled button is not a rule.

### Testing

Under 250 quiet; 300 characters raises "That is long for one card" with Place it
still live; three lines raises the line count; 2,000 characters disables Place
it and names the count. Enter over the ceiling makes no card, opens no proposal
and keeps all 2,000 characters in the box. Back under the ceiling Place it works
again. Suite re-run: vshape, vfile, vundel, vcast, vsync, voutline-app, vnote,
vsave, vshelf, vout, vcarddl, vcost, vrename all pass. No em dashes.

No project data, access rule, database schema, or API behavior changed.


## 2026-09-06 - Two board fixes

### See an example no longer overwrites the writer's project

Kris clicked See an example inside Dirt Money and it wiped the board. The two
lines that did it were `proj.cards = []` and `proj.isSample = true`: it emptied
the board, the Notes shelf and everything set aside, then marked his own script
as a demo, with no confirmation, in a menu where Empty this board sits directly
beneath it and asks first.

The example now gets its own project, "Example - The Spillway", pushed onto the
shelf like any other. Opening it again reuses the one already there instead of
breeding copies, and if the writer has added cards of their own to it, it is
theirs and gets left alone. Sample cards carry `fromSample: true` so that check
is exact rather than a guess. The help sheet's third choice routes through the
same handler, so both doors are fixed by the one change.

### The wordmark stopped reloading the application

`<a class="brand" href="/app">` meant a plain click on the wordmark reloaded all
480KB of Beatfall and the writer watched it boot through a flash of the
dashboard to arrive somewhere already on screen. It now switches view in the
page the way the house icon does. The href stays, so a middle click still opens
the app in a new tab, and modifier clicks are left alone.

### Testing

A project holding a board card, a shelf note, a set-aside idea, outline prose
and a character: after See an example it is byte for byte unchanged and not
marked as a sample, and the example is a second project on the shelf holding its
nine cards. Pressing it twice more makes no further projects and no duplicate
cards. After adding a card to the example by hand, pressing it again leaves that
work alone. The wordmark switches to the dashboard with zero page navigations.
Suite re-run: vshape, vfile, vundel, vcast, vsync, voutline-app, vnote, vsave,
vshelf, vout, vcarddl, vcost, vrename all pass. No em dashes.

No access rule, database schema, or API behavior changed.


## 2026-09-07 - The audit pass: the refresh flash, and five things the signup flow was getting wrong

Kris asked for a read of the whole platform and then for everything found to be
fixed, mobile excluded. The phone stays out of scope until the web app is right.

### The flash on refresh

Pressing refresh showed the wordmark, a project called Untitled, the capture bar
and an empty board for the best part of a second before the real view arrived.
Nothing was broken. `public/app.html` simply had no boot guard, so the static
shell painted immediately while `start()` spent three round trips finding out
what to draw: read the config, restore the Supabase session, claim this browser
through `POST /api/session`, load the projects. Only then does `setView("slate")`
correct the page.

The public homepage already solved this in January's terms: `auth-checking` on
the root element and `visibility:hidden` on the body until the session check
resolves. The application never got the same treatment.

- `booting` goes on the root element in the head, before any stylesheet, and
  `html.booting body{visibility:hidden}` sits with the other structural rules.
  The background is declared on `body` and propagates to the canvas, so the room
  is still the right colour while the page is held.
- `BF.ready()` in `app.js` takes it off. Every path that ends a boot calls it:
  the first view drawing, the project-load failure, the ended-plan screen, both
  device screens, the small-screen gate, and the unconfigured notice. It is
  harmless on the pages that never set the class.
- A six-second timer in the head lifts the hold whatever happens. A hold that
  only code can release is a blank page on the day that code fails to load.

Settings has its own honest loading state and was left alone.

### A new account was told it was nearly out of credits

`LOW_NOTICE` is 30 and `LAST_NOTICE` is 10, both set against the 150 a paid
month carries: a fifth left, and a fifteenth left. The trial carries 25. So the
flat comparison fired on the first load of every new account, and a writer's
first ever screen put a gold count on the Account pill telling them they were
running low before they had spent anything.

The marks are the share those numbers always meant, whichever is lower: at 150
they compute to 30 and 10, exactly what shipped, and at 25 they are 5 and 2.

### The trial is 25 credits and every page said 150

Kris's call: keep 25 and say so. `billing.html` said "You get 150 credits a
month" with nothing anywhere about the trial's own allowance, so a trial writer
read 150 and would have hit a wall at 25.

- The short version now separates the plan's 150 from the trial's 25 and says
  what 25 buys: a notes file read in, and twenty conversations after it.
- Section 1 carries the number beside the fourteen days, and says plainly that
  running the credits down does not close the board, because adding and
  organizing notes is free on the trial exactly as it is on a plan.
- Terms section 8 carries the same number, since the two must agree.
- The plan pane in Settings prints the trial's allowance against the days left,
  where a writer who has read the billing page has 150 in mind.

### Day fifteen told writers a plan had ended that they never had

The trial expires, `entitlement` returns `none`, `/api/projects` answers 402 and
the client draws `showLocked()`, whose heading read **Your plan has ended.** to
somebody who had never subscribed. The server's message said the same.

`api/projects.js` now sends a `reason` with the 402, decided on whether the
account has ever carried a Stripe subscription, and both the server message and
the locked screen say trial or plan accordingly.

The other half of that screen was worse. **Choose a plan** named a decision and
then made it: one button, straight into the annual checkout at $99, with no
choice offered anywhere on the page. It is two buttons now, `$12 a month` and
`$99 a year`, with Download everything on its own row beneath them.

Both prices came off the page and into one place. `/api/account` serves
`price_month` and `price_year` from `core.js`, the plan pane reads them, and a
`PRICES` mirror beside the existing `CREDIT` mirror covers the locked screen,
which has to name them before that call has answered. The annual saving is
computed rather than typed. This is the lesson the admin plan card taught when
it went on saying 100 for $6: nothing on a screen that quotes a price should be
a literal.

Also: the lockup inside the locked screen had drifted, its falling gold card
34 wide everywhere else in the site and 32.8 here.

### Three measurements that were not measuring anything

1. `login.html` counts the magic links a browser asks for, in first-party
   storage, and its comment said the app hands the count over on the first
   authenticated call. Nothing read that key. The drop-off between asking for a
   link and arriving, which is the cost of magic-link auth and the number that
   comment called worth knowing before ten writers hit it, was not being
   recorded at either end. `BF.sendAuthFunnel()` hands it over and clears it.
2. `BF.sendTouch()` was written, correct, and never called. Attribution was
   captured into localStorage on every visit and never delivered, while
   `/api/account` sat waiting with a working `attribution` action. Both it and
   the funnel are called from `requireSession`, which is the first moment any
   protected page is certain it has a session.
3. `requireUser` fires an event when it has to create a profile row, commented
   as the only place in the system that can tell a new account from a returning
   one. The `handle_new_user` trigger writes that row and a `signed_up` event
   first, so the branch is not reached on a normal signup. It is a fallback for
   a database whose trigger did not run, and it is named `profile_recreated`
   now rather than counted as an ordinary signup.

### The homepage lockup stopped loading the whole application to bounce

Every linked lockup in the site points at `/app`, which is right everywhere it
was decided. The public homepage is the exception and could not have been one
when that rule was written: the early session check now sends anybody holding a
session straight to `/app`, so a person reading the homepage is signed out by
definition, and pressing the lockup loaded 487KB of application in order to be
redirected back to the page they were already on. Both homepage lockups point
at `/`. No other lockup changed.

### Testing

- Every touched file parses: the inline application script, `app.js`, and the
  four API modules.
- Em dashes are at zero across every page, `app.js`, `theme.css` and `api/`.
  One had been sitting in `core.js` since before that rule was audited there.
- No duplicate element ids were introduced.
- Both new credit marks were checked against both allowances: 150 gives 30 and
  10 unchanged, 25 gives 5 and 2, and a full allowance warns about nothing.
- Every boot path was walked for its `BF.ready()`: first view, load failure,
  ended plan, device replaced, device setup failure, small-screen gate,
  unconfigured, and the timer behind all of them.
- `BF.onCredits` is only ever called after an await, so the two new marks are
  past their temporal dead zone at both call sites.

### Left alone on purpose

`settle()` is a stub returning an empty list, and seven call sites still feed
its result to `showSettled()`, which returns early on nothing. That is dead
wiring, not a defect: auto-float was removed deliberately and the receipts it
used to raise are meant never to appear. `showSettled` itself is alive and
carries every Undo receipt in the app. Removing the seven would touch placement,
import and notes for no visible gain, which is the only real regression risk in
this pass, so it stays until it is worth its own step.

`CLAUDE.md` has two sections that no longer describe the code: conflicting saves
still documents the 409 sheet removed on 5 September, and the Outline start gate
still describes the strict version the board-shape work replaced the same day.
Both are history rather than guidance now, and neither was rewritten here.

No project data, placement rule, import behaviour, database schema or API
payload shape changed.


## 2026-09-09 - The walk from the homepage to the first spend

Kris: "there are three options. the top one about having notes already allows
them to use credits before they even know what they have as far as number of
credits. they know they have 14 days free, but that's it." Then: go through the
workflow of a new sign up. The homepage is not up for redesign and did not
change beyond three hrefs.

Walking it end to end turned up four things, and they are one problem seen four
times: the product knows what the trial is and never tells the person on it.

### Sign in was the first thing a trial button said

The homepage has two controls landing on the same page and they are not the same
errand. Somebody pressing **Start free** or **Start 14 days free** arrived at a
page headed **Sign in**, with the answer buried four paragraphs down in "New
here? The same box works."

The three start buttons now carry `?start=1`. The page reads it and changes its
heading, its sub-line, its document title and the fine print, which addresses
whichever audience did not arrive. The box, the field, the link and every
mechanic are identical either way, and the homepage's own design is untouched.
"Use a different email" returns to the heading the page arrived with rather than
always to Sign in.

### The promise line said how long the trial was and nothing about what it holds

It sits beside the button and it is the last thing read before somebody hands
over an address, and it read "14 days free. No card required." It now says the
board is free to use and that 25 credits cover the writing help. The free half
goes first because it is the more important one: a writer who reads "free" and
then meets a credit they did not know they had has been surprised by us.

### The one paid door on the welcome sheet was the recommended one, unpriced

**I have notes already** is the top choice, labelled the fastest way to see what
this does, and it is the only one of the three that spends anything. It carried
no price. It opens the paste sheet, which carried no price either: the "2
credits" had ended up in the tooltip on Sort my notes and nowhere else, which is
a price only a mouse can find, and it is the exact arrangement the touch-pricing
work rejected on 5 September.

That is a regression against a written decision. `CLAUDE.md`: reading a file
"gets a whole sentence on the paste sheet instead, because the button's label is
rewritten while it works and a chip would be wiped." The sentence was gone.

- The paste sheet has it back, in the copy, built from `CREDIT` rather than
  typed: what it costs, that pasting is free, that nothing is charged until Sort
  my notes, and that the results come before the board changes.
- The welcome sheet's paste choice carries its cost in the hint slot. That slot
  is blue, and blue in this app means free and touchable, so the price takes a
  `.cost` span in gold. Gold is what every other paid control wears.
- And the sheet says what the account holds, once, above the three choices,
  read from `/api/account` rather than written into the page: the number, and
  that adding notes, moving cards, the outline and the PDF are free. It is the
  only place in the whole signup where a writer can see their budget without
  going looking for it in a popover.

### The first frame was a scoreboard of noughts about a script nobody wrote

`load()` puts one blank Untitled in front of a new writer so `P()` always has
something to return. It is not a project they made and it has never been saved,
and the shelf drew it: a card reading UNTITLED at 0% COMPLETE, over a scoreboard
reading 0 of 15 filled, 15 still empty, none this week, no days in a row.

`bareShelf()` is the one test for it, and both surfaces ask before drawing. The
lede already handled this correctly and now the rest agrees with it: "Nothing
saved yet. Start where you are.", one dashed New project card, and no scoreboard
until there is something real to count. The blank card is appended per shelf and
a bare account has no shelves, so it is appended directly in that case.

**And the ghost that would have followed.** Hiding the placeholder made the
blank New project card the only way in from the shelf, and `commitIntake` pushes
a new project rather than taking the placeholder's place, so a writer naming
their first script would have been left with it sitting beside them forever.
That bug is older than this change and reachable today; it is fixed at the
source. On a bare shelf a new project and the example both replace the
placeholder instead of queueing behind it. It has no id, no cards and no name
the writer chose, so there is nothing to lose.

### Testing

- Every touched file parses, and em dashes stay at zero across all three.
- No duplicate ids introduced.
- All three doors off the welcome sheet walked on a bare account: naming a
  project, pasting notes, and the example each leave exactly one project on the
  shelf and no Untitled beside it.
- `blankCard` is a declaration inside `renderSlate`, so calling it before its
  textual position is fine.
- `showFirstRun` runs after `/api/account`, so the allowance line has a real
  number; with `ME` absent the line hides rather than inventing one.
- The unpriced import path is unchanged in behaviour, only in what it says.

### Found in the same flow, left for its own step

The welcome sheet's paste choice calls `openImport(false)`, which means "into
the board in front of you". Opened as the empty-account greeting that is
harmless, because the placeholder is empty. But the same sheet opens from **How
Beatfall works** in the account menu, and a writer sitting on the dashboard with
nine scripts who chooses it imports into whichever board was last active. That
is the shape of the Night Haul overwrite from 3 September, which `openImport
(intoNew)` exists to prevent. The fix is to pass `state.view === "slate"`, but
it lands in the import build, which is the most bug-prone path in this app and
has a history of fixes exposing each other. It deserves a step of its own rather
than riding along here.

No project data, placement rule, import behaviour, database schema or API
payload shape changed.


## 2026-09-09 - A closed account keeps its work, and three screens stop disagreeing

Kris brought an outside UI/UX audit. Most of it was real and is acted on below.
Two things about that audit are worth recording, because they change how the
next one should be read.

It praised the project-conflict dialog at length, including "Save my changes as
a copy" as the safest default. That dialog was deleted on 5 September when Dirt
Money forked into three copies; last save wins now. It was reading `CLAUDE.md`,
whose conflicting-saves and Outline-gate sections still describe code that no
longer exists. And it missed the one item on either list that can destroy work:
the welcome sheet's paste choice landing on whichever board was last open.

### The importer no longer lands on a board nobody is looking at

`if (go === "paste") openImport(false)` means "into the project in front of
you". As the empty-account greeting that is harmless. But the same sheet opens
from **How Beatfall works** in the account menu, and a writer standing on the
dashboard with nine scripts had no project in front of them: the file went into
whichever board was last active. That is the exact shape of the paste that
renamed NIGHT HAUL to BLACK RIVER and dropped a comedy's beats into it.

It is `openImport(state.view === "slate")` now: from the shelf the import makes
its own project, from a board it fills that board. And group zero's new project
takes the placeholder's place on a bare account rather than arriving beside an
Untitled nobody created, the same guard the new-project and example paths got.

### A cancelled account keeps its boards, as PDFs

Kris: they cannot add to the boards, but they should be able to download the
boards they have. Agreed, with one change: any board, not only finished ones. A
half-built board with the holes showing is still the writer's work, and gating
export on a completeness score is what the 5 September PDF decision refused.

`api/projects.js` refused every method with 402 when the plan was gone, so the
only door out was `/api/account` export: one JSON file of the whole account,
which is a backup and not somebody's script. Reads are open now and every write
still refuses. `closed` comes back with the GET, `BF.loadProjects` carries it,
and `start()` draws the locked screen over a shelf that is already in memory.

The locked screen lists every project with its beat count and Save as PDF.
`exportPDF` already took a project, for the finished dashboard card, so the
machinery was there. Nothing on that screen writes.

### Three screens were telling three different stories about a lapsed plan

The standalone Settings page said, to somebody whose plan had ended: "Your
projects, boards and notes are all still here and the board works normally.
It's the writing help that's switched off." The server refuses to open a board
without a plan. Stripe returns people to that page after cancelling, so the one
screen a leaving customer reads was the one contradicting what would happen. Its
cancellation copy said the same, promising that only the writing help stops.

Both now say what is true: the boards close to changes, nothing is deleted, and
any board can still be downloaded as a PDF or the account exported whole.

The in-app past-due notice had the opposite fault. It said "Until it goes
through, the writing help is off." `entitlement` counts `past_due` as paid, so
nothing is switched off while Stripe retries the card. It now says everything
keeps working, and what actually happens if the retries run out.

The cancellation sheet's third fact said "One file, no conditions", which is
now half the truth: every board as its own PDF, or the whole account as one
file.

### Annual subscribers stopped being quoted a monthly price

The account menu read "Beatfall · $12 a month" for everybody on a plan,
including the people paying $99 a year. Nothing on the account records which
they chose, so rather than guess a figure it says "Beatfall" and the date their
money next moves, or the date it ends when a cancellation is scheduled.

### Editing a card was a double-click and nothing else

No control, no label, no hint. A writer who never guessed it could not change a
word they had typed. There is a pencil beside the move, settle and delete marks
now, and the double-click still works because it is the fast way once you know.
The four microcontrols also gained real hit areas: the padding grew and the
glyphs did not, so a finger has something to aim at without the card turning
into a toolbar. They reveal on keyboard focus as well as hover.

### Help stopped describing an interface from four days ago

"Open the project menu and choose a structure" has been wrong since the
structure bar moved below the capture row on 5 September. That answer now says
where the control is and what a switch preserves, including the Outline prose
that gets stranded and the fact that the whole thing can be undone.

### Testing

- Every touched file parses: the inline application script, `app.js`,
  `settings.html`'s script, and `api/projects.js`.
- Em dashes remain zero across the pages, `app.js`, `theme.css` and `api/`.
- The read/write split was checked against `entitlement`: `closed` is only ever
  true for `key === 'none'`, GET is the only method that passes it, and
  `api/claude.js` still refuses the writing help on the same test.
- `past_due` was confirmed against `entitlement` and `api/claude.js` before the
  copy was changed rather than after.

### Deliberately not done

Durable recovery is the audit's second priority and it is right, but undo
surviving a refresh and an escape hatch for a save that keeps failing both land
in the save path, which is the most load-bearing code in the app. It gets its
own step rather than riding along with nine other changes.

No project data, placement rule, import parsing, database schema or API payload
shape changed. The only API change is which methods a closed account may call.


## 2026-09-09 (later) - Cancelling worked, and Stripe stopped dropping people somewhere strange

Kris tested the billing flow by hand, which is how both of these were found.

### Continue to cancel returned "request failed"

Two faults, stacked, and the second hid the first.

Stripe requires the subscription being cancelled, by id. `flow_data` carried
only `{ type: 'subscription_cancel' }`, so the call was rejected outright. That
control has never worked; nobody had pressed it.

And nothing in `api/billing.js` caught anything. An uncaught Stripe refusal is a
bare 500 with no body, and `BF.api` prints its own last-resort string when there
is nothing to show, so a writer trying to cancel their subscription read the
words "request failed" and the real reason never left the server.

The cancel flow names the subscription now, and falls back to the plain portal
when there is no subscription on file rather than pretending there is one to
end. The whole endpoint has a net under it: Stripe's words go to the log, the
writer gets a sentence, and the response says nothing was charged or changed.

`BF.explain` is the last thing between a failed request and somebody's screen,
and it used to hand back whatever the wire said. An error code is not a
sentence: anything arriving without a space in it is now replaced with one.

Also in that file: `checkout_started` read `body.interval`, a field the client
does not send, so every annual checkout ever started was recorded as monthly.

### Stripe handed people back to a page that exists nowhere else

Every return url pointed at `/settings.html`, the standalone full-page settings
screen. Kris cancelled on Stripe, pressed Go back to Beatfall, and landed on a
version of the app he had never seen, with a different account menu, and had to
press Board to get home. It is also the page whose copy contradicted the product
until this morning, and the duplication is why it drifted in the first place.

All six return urls go to `/app` now, which is where somebody paying or
cancelling was trying to get to anyway. The query says what happened and the app
says it back, in the strip the low-credit notice already uses, with a blue
ground rather than gold because a completed payment is not something missing.
The query is taken off the address so a refresh does not repeat it.

Returning from the portal is the one case that says nothing on the way in.
Coming back means they were there, not what they did, so it waits for
`/api/account` and then states whatever is now true: cancelled and running until
a date, or subscribed with the next payment named. Guessing would have meant
telling somebody who changed their mind that they had cancelled.

This leaves `settings.html` reachable only from Admin. It is out of the customer
path entirely, which is the first half of collapsing the two settings screens
into one.

### Testing

- `api/billing.js` and the inline application script both parse.
- No `settings.html` remains in any Stripe return url.
- Em dashes stay at zero.
- `billingReturn()` runs after the boot awaits, so the module-level `let` it
  sets is past its temporal dead zone, the same check the credit marks needed.

### Still true, and worth stating because Kris asked

Cancelling does not close anything immediately. `cancel_at_period_end` leaves
the subscription active, `entitlement` still returns the paid plan, and the
boards stay open until the period ends. The new strip says so in as many words.


## 2026-09-10 - The audit, and what it turned up underneath the writing

Kris asked for a full pass: new user, existing user, admin, board, notes,
characters, downloads, billing, credits. 52 product flows and 45 regression
checks were driven against the real `public/app.html`, and all eight API
endpoints plus the schema were read line by line. The product itself came
through well. What did not was the layer under it.

Everything below is fixed. The one item that cannot be fixed from here is first.

### KRIS'S ACTION: run `supabase/schema.sql` again

`create policy "own profile edit" on public.profiles for update using (auth.uid() = id);`

That said the row must be yours and never said which columns of it you may
touch, and Supabase grants the signed-in role UPDATE on this schema by default.
Anyone signed in could open a console and set their own `credits_extra`,
`plan`, `subscription_status` and `is_admin`. Admin then opens `/admin`, which
holds every other writer's email, plan and cancel reason. The same shape on
`events`, where an INSERT policy made `cleanProps` advice rather than a wall:
the allowlist exists so that table can never hold a sentence somebody wrote,
and that is a promise in the Privacy Policy.

The new block at the foot of the file revokes both and keeps the select side
intact, which is what realtime needs for the device-takeover notice. Nothing
legitimate wrote to either table from the browser; every write already goes
through the server with the service key. Safe to re-run, like the rest.

**Until that runs, nothing else in this entry matters much.**

### The writing help was free for anyone who noticed

A multi-turn feature bills once by sending a session id, and the browser chose
it. The server only asked whether it had seen that id before, so the same word
on every request made everything after the first action free, forever. Worse,
a usage row carried the id even for the free actions, so placing one note paid
for every import afterwards.

Three bounds, none of which change the protocol the client already speaks: the
earlier call must be the same KIND, so a conversation cannot pay for an import;
it must be RECENT, because no real conversation spans a day; and one payment
covers at most twenty turns, because the longest thing here is a ten-question
interview and unlimited is not a number. A free call now records no session id
at all.

`COST[kind] ?? 1` also never fired its default: `COST` is an object literal, so
`COST['toString']` is a function rather than undefined, and a non-numeric cost
skipped the balance check, the dedupe and the debit together. An unknown kind
is refused now rather than priced at a guess.

### Twenty calls at once were paid for by one credit

The balance was read at the start of a request and written back as a finished
number at the end. Twenty parallel calls with one credit left all read the same
figure, all ran, and all wrote the same figure. `charge()` in `core.js` applies
the patch only if the row still holds the values it was computed from, and
starts again from a fresh read when it does not. No migration: the condition is
the values themselves.

The same shape of bug sat in the month rollover, where two requests landing
together on the first both reset `credits_used` to zero and the second erased
what the first had spent. That update is conditional in the database now too.

### There was no ceiling on what one request could cost

The per-call limit capped each message at sixty thousand characters and never
capped how many messages. Two hundred of them is roughly three dollars of spend
for one credit, and the comment above it said a runaway request could not cost
a fortune. The budget is the whole call now, spent from the last turn backwards
so the oldest fall off first, with a ceiling on the count as well.

### Deleting an account left the card being charged

Delete removed the writer and never told Stripe. The subscription went on
billing, with no account left to cancel from, and the profile row took the
customer and subscription ids with it, so afterwards there was nothing to look
it up by. Cancelling comes first now, a failure to cancel stops the deletion
rather than proceeding quietly, and the result of the delete is checked instead
of success being reported regardless. That last one meant a writer could clear
their browser believing they were gone while every project stayed in the
database.

### The top-up could be free, doubled, or taken and not given

No check that the payment succeeded, so a delayed method that later failed
still handed over the credits. No guard against being told twice, and Stripe
redelivers on any error. And a missing account answered "fine", so Stripe never
retried and the customer paid for nothing.

The receipt is written first now, carrying Stripe's own event id, and the unique
index on that column is what makes a redelivery bounce. A missing account
answers 503 so Stripe tries again.

### A card that asks for verification ate the rest of the trial

`plan: live && plan ? plan : (... : 'none')`. A subscription created
`incomplete`, which is what happens when a bank wants verification, is not live
and not trialing, so this wrote `none`. A writer on day three who started
checkout and did not finish the bank's step lost the other eleven days that
instant, permanently. Nothing here lowers a plan any more;
`customer.subscription.deleted` has its own case and remains the only thing
that ends one.

### Nobody could get all of their work out

Two doors and both leaked. The PDF carried the board, the outline, the cast and
everything set aside, and skipped Other Notes entirely, while the cover page
COUNTED them: a writer read "12 notes" on the front of a file containing none
of them. And the account export, commented "everything a person has, in one
file", omitted the characters column, which is the file the deletion warning
email tells people to download.

The PDF has an Other notes section grouped the way the Notes screen groups it.
The export carries `characters`, and the sample and origin fields with it.

### The six-month cleanup would have deleted your own account

It exempted live subscriptions and unexpired trials, and checked neither
`is_admin` nor `is_internal`. An owner has no subscription and a trial date long
past. It also counted an account as warned whether or not the mail actually
went, so with no mail key set it reported warnings it had never sent and then
deleted those accounts thirty days later. Both fixed, with a separate
`could_not_warn` count, and the batch is ordered oldest-first so a backlog
drains instead of handing back the same rows.

### Things the app said that were not true

The past-due notice claimed the writing help was off. `entitlement` counts
`past_due` as paid, so nothing is switched off while the bank is retried.

The admin dashboard filtered owner accounts out of one calculation and not the
others, so credits-per-user and cost-per-user - the two figures the page exists
to produce - counted QA accounts. In a cohort of ten that is not noise, it is
the answer. The percentile was biased one rank high, so with ten active writers
the "90th percentile" was simply the heaviest one and the allowance would have
been set from it. The People table also showed sample-inclusive project and
card counts, so every writer looked like they had done a board's worth of work
before writing anything, while the real pair was computed, sent and never used.

### The product itself

**A note could not be edited.** Its type could change, it could be sent to a
beat, taken off a beat or deleted. Its words could not be changed, here or
anywhere in the app: a typo in an imported note was permanent unless the writer
deleted it and retyped it. Same pencil and same behaviour as a board card.

**"Send to a beat" turned it into a card and never said so.** Filing a note
UNDER a beat, so it stays a note, existed only as a drag inside the Outline. Two
different actions, named for what they do, both offered where a writer is
looking at their notes.

**The trial ended without a word.** Day fourteen arrived and the first anyone
heard of it was a locked screen. Two moments now, a week out and two days out,
each shown once ever, neither blocking anything. The two-day one says what
happens to the boards and offers the plans.

**A failing save had no way out.** Eleven grey pixels and a retry every five
seconds, forever, with a crash cushion being written that nothing ever read. A
minute of failures now raises one strip that says nothing has been lost and
hands over everything in the tab as a file. The retry continues underneath.

**A brand-new writer's first request could crash.** The fallback profile insert
discarded its error and the next line dereferenced the null. A first call that
raced the database trigger answered with a stack trace.

### Testing

102 checks pass: 45 regression and 57 product flows, both against the real
`public/app.html` rather than a copy. `test/flows.js` joins `test/drive.js` in
the repository. New coverage this pass: note editing and the two beat actions,
the Other notes section in the PDF, both trial warnings and their once-ever
behaviour, and the rescue strip after fourteen failed saves.

Every touched file parses. Em dashes remain zero across the pages, `app.js`,
`theme.css`, `api/` and now `schema.sql`, which had three from before that rule
was audited there.

### One thing worth recording about the tooling

The working copy of `app.html` used for this pass turned out to be missing the
Stripe-return work committed earlier the same night: the bridge that reads files
off the machine had been handing back a snapshot one write behind. It was caught
by comparing the function lists of the two copies before committing, and the
missing work was restored rather than overwritten. Anything edited across that
bridge should be compared, not trusted, before it is written back.

No placement rule, import parse, structure logic or database column changed.


## 2026-09-10 (second pass) - Auditing the audit

Kris asked for the whole aggressive pass again, against the fixed code, before
pushing. That was the right instinct: the most likely place for a new bug is
whatever was changed an hour ago, and the pass found nine real ones in the
morning's own fixes. Two of them were worse than what they replaced.

### The two fixes that cancelled each other out

The session ceiling was inert. One change stopped free calls recording a session
id, so a paid call could not be seeded by a free one. Another counted the rows
carrying that id to cap how many turns one payment covers. Together the count
could never exceed one, the ceiling never fired, and one credit bought unlimited
writing help for eight hours. Better than "forever", which is what it replaced,
and not what the comment above it claimed.

The real shape: ask whether this session was ever PAID for, which is the
question that stops a free `place` buying an import, and count every row to
enforce the ceiling. The free rows carry the id again, because the count needs
them; what closes the hole is `credits > 0` on the lookup, not the absence of an
id on the row.

### Charging after the work is not metering

`charge()` made the debit conditional on the balance it was computed from, and
the comment said that closed the parallel-spend hole. It did not. The check was
at the start and the debit at the end, so twenty requests with one credit left
all passed the check, all called Anthropic, and all got an answer; the
compare-and-set then fixed the number while nineteen calls' worth of spend had
already happened.

The charge is taken BEFORE the upstream call now. A request that cannot pay
never reaches Anthropic. That trade brings a duty: `refund()` puts the credits
straight back when the work fails, on both the upstream-error and network paths.

`refund()` had a bug of its own on first writing. It put the whole amount back
into whichever bucket had room, so a bought credit could return as a monthly
one - a credit that never expires quietly becoming one that dies on the 1st.
`charge()` reports which bucket each credit came from and the refund honours it.

And `charge()` treated a lost reply as a failed condition and retried, which
would charge twice. An error and a non-matching condition are different things
now.

### Other faults in the morning's work

- The whole-call input budget filled from the newest message backwards and could
  stop on an assistant turn. Anthropic refuses a conversation that opens on the
  assistant, so a long thread broke permanently with a 502 and no way back. The
  front is trimmed to the first user turn.
- An empty message in that loop discarded every older turn behind it.
- The cleanup job's new exclusions were applied in JavaScript after the limit,
  so the skipped rows are the oldest and hold the same batch slots on every run.
  Enough of them at the head and the batch never reaches an account that needs
  warning, which is the failure the morning's fix was written to prevent. They
  are query filters now.
- `delete_account` classified an already-cancelled subscription by error code.
  Stripe answers that with a plain 400, not `resource_missing`, so a writer who
  cancelled through the portal was told to cancel before deleting - which they
  had done and could not do again. They could never delete their account. It
  reads the subscription's status before deciding, and if the delete then fails
  it no longer says "nothing was removed" when the subscription has just been
  cancelled.
- The top-up receipt-before-grant made a transient database failure permanent:
  the receipt said granted, the credits never arrived, and every retry was
  suppressed. A duplicate key is now distinguished from a database that did not
  answer, and the second returns 503 so Stripe tries again.
- `Stripe` was imported dynamically in `account.js`, which Vercel's bundler does
  not reliably trace. Static import.

### And in the client

- The rescue bar never came down. Saving recovered, the counter reset, and the
  bar went on saying Beatfall could not reach your projects for the rest of the
  session - while silencing the credit warning, both Stripe messages and the
  trial notice, because it outranks all three. It is removed on the first
  successful save, and dismissing it now sticks rather than returning five
  seconds later.
- The failure counter ran per project rather than per attempt, so an import that
  made twelve projects tripped the ceiling on its first failed round.
- `trialRamp` wrote its once-ever flag before knowing whether the notice
  appeared. A writer coming back from a cancelled checkout saw "Checkout
  cancelled", which holds the foot of the window, and burned their one week's
  warning without seeing it - the person that happens to being exactly the
  person deciding whether to pay. The flag is spent only when a bar exists, and
  it is keyed to the account rather than the browser.
- A trial that ended hours ago announced that it ends today: `Math.ceil` of a
  small negative is negative zero, and negative zero is not less than zero.
- `bareShelf()` inferred the placeholder from having no id, and merely opening
  the dashboard saved it and gave it one. Every branch built on it then stopped
  working, which is how naming a first script left an Untitled beside it - the
  exact outcome the morning's comment said it prevented. The placeholder says so
  on itself now, and gets a baseline fingerprint so an untouched one is never
  written to the database at all, which is what this file has always claimed
  about it. `takePlaceholder()` also clears it from the save queue, or it was
  written to the server after being dropped from the shelf.
- Shift+Enter in a note edit welded two lines into one word, because the commit
  reads textContent. Every Enter commits, as on a board card.
- Changing a note's type never reached the server. `renderNotes()` does not
  save, and that was the one control in the row that did not go through
  something that does.
- The new PDF notes section put each note through `slotBox`, which is built for
  a beat card: fixed height, first seven lines, cut mid-word. A research note is
  not a sentence. That section flows now and prints every word, and says which
  beat a note is filed under, which the screen said and the page did not.

### Testing

116 checks pass: 55 regression and 61 product flows, both against the real
`public/app.html`. Everything above has a check on it, including the ones that
are only visible in sequence: a warning suppressed by another strip is not
counted as said, the rescue bar comes down when saving returns, the shelf is
still known to be bare after the placeholder saves, and a hundred-word note
survives the PDF whole.

### Still not covered

The server. All eight endpoints were read twice and changed, and none of them
have been run. The charge-before-work reordering in particular wants one real
conversation and one real import against the live database before it is trusted,
and `cleanup.js` should be run once with `?dry=1` because its new query filters
use PostgREST `or()` syntax that has not been executed.


## 2026-09-10 (third pass) - Running the server, at last

Kris asked, before pushing: will the app still work? The honest answer was that
the client had 116 checks on it and the server had been read twice and run
never. So the server got run.

`test/server/` holds a stand-in for the Supabase client - the chained builder,
`{data, error}` rather than throwing, and `maybeSingle()` returning a null row
rather than an error when nothing matched, which is exactly what the new
compare-and-set debit depends on. Each suite copies the real endpoint and swaps
two things: `requireUser`, which needs a live Supabase and a token, and the
database handle. Everything else in those files is the shipped code.

74 server checks, all passing:

- **credits (18).** A charge applies and comes out of the month first; one that
  spans both buckets takes the month before the bought credits and reports the
  split honestly; an empty account is refused and nothing is taken; a lost race
  retries against the new balance and charges exactly once; a lost REPLY is not
  retried as a conflict, because that would charge twice; twenty requests
  against one credit produce exactly one success and a balance that never passes
  the allowance; and a refund puts each credit back in the bucket it came from.
- **the AI proxy (22).** A conversation succeeds, costs one credit, reports the
  real balance and writes a usage row. The rest of a session is free. Placing a
  note is free AND does not pay for an import reusing its session. A
  conversation does not pay for an import. An empty account is refused BEFORE
  the model is called. An upstream failure and a network failure each give the
  credits back. An unknown action is refused rather than priced at a guess. A
  long thread never opens on the assistant, and an empty turn does not discard
  the history behind it.
- **the project gate (16).** Paid, trial, past-due and owner accounts all load
  their projects and none of them is told the boards are closed - which is the
  failure that would have locked out a paying writer. A lapsed account reads its
  work, is told the boards are closed, is told it was a plan rather than a
  trial, and gets its projects back, which is what makes the per-board PDF
  possible; its writes and deletes are refused. An expired trial is called a
  trial. And the export carries the characters.
- **the Stripe webhook (12).** A paid pack grants once and writes one receipt; a
  redelivery grants nothing and is accepted rather than retried forever; an
  unpaid session and a nonsense amount grant nothing; an unmatched customer gets
  a 503 so Stripe tries again rather than a 200 that loses the money. A
  subscription created `incomplete` does not end the trial or move its date, and
  a genuine cancellation still does.
- **the cleanup job (6).** On a dry run nothing is deleted, the owner and the QA
  account are never even scanned, the paying account is skipped, exactly one
  abandoned account is acted on, and it reports how many it could not warn.

### One thing was changed rather than shipped untested

The morning's cleanup query used a PostgREST `or()` with a `not.in` inside it,
to keep live subscriptions out of the batch. That syntax cannot be exercised
here, and a nightly cron that silently errors is worse than the backlog it was
avoiding: an owner or QA account is idle forever by nature and belongs in the
query, but a subscriber idle for five months is not a row that sits at the head
of the queue permanently. The two `.eq()` filters stay, the subscription check
went back into the loop, and the reason is written above it.

### Where it still is not proof

The fake is not Postgres. Row-level security, column defaults, foreign keys and
PostgREST's own grammar are outside it, so a filter these suites accept can
still be refused by the real server. Stripe and Anthropic are stubbed at the
boundary, so what is tested is how these files behave given an answer, not
whether it is the answer those services would give.

Total across everything: 190 checks. 116 on the client, 74 on the server.

Also: the last em dash in the repository was in `package.json`'s description.
