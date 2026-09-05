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
