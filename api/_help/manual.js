// ============================================================================
// THE MANUAL. EVERYTHING BEATFALL DOES, DESCRIBED RATHER THAN ANSWERED.
//
// WHY THIS EXISTS, AND WHY IT IS NOT MORE QUESTIONS AND ANSWERS.
//
// content.js is a list of 75 questions with answers. It can answer those 75
// questions and whatever can be stitched together from them, and nothing else.
// Kris asked the help desk whether two projects could be merged. Nobody had
// written that question down, so the desk did the honest thing with nothing to
// go on: it said it had no answer and handed over an email address.
//
// The question was perfectly answerable. A complete description of what a
// project is and what can be done to one contains the answer, because merging
// is not among the things listed. A list of anticipated questions can only
// answer anticipated questions. A description of the product answers the ones
// nobody thought of, which is most of them.
//
// So this file describes Beatfall: every screen, every control, what pressing
// it does, what the rules are, what the limits are, and what is deliberately
// not there. The help desk reads it with every question and reasons from it.
//
// TWO FILES, TWO JOBS, NO DISAGREEMENT.
//   content.js  is what the help PAGE draws: browsable cards, one per common
//               question, written in the words a writer would type.
//   manual.js   is the complete description, and it is the authority. Where
//               the two ever differ, this one is right, and the desk is told
//               so in its instructions.
//
// EVERY NUMBER IS READ FROM core.js AND NEVER TYPED. A price written into
// prose is a price that goes stale, and this product has fixed that same bug
// three times. If you are about to type a figure into this file, import it.
//
// HOUSE RULES, same as everywhere else. Plain language. One idea per sentence.
// Never "AI", never "the model", never "Claude": the metered capability is
// "the writing help". No em dashes. Say what happens, not what the system is
// doing internally.
//
// WHEN THE PRODUCT CHANGES, CHANGE THIS. A description that used to be true is
// worse than a missing one, because somebody will follow it.
// ============================================================================
import { PLANS, PAID_PLAN, PRICE_MONTH, PRICE_YEAR, TOPUP_CREDITS, TOPUP_PRICE,
         COST, lowMark, lastMark } from '../_lib/core.js';

const PLAN  = PLANS[PAID_PLAN].credits;
const TRIAL = PLANS.trial.credits;

const PART_A = `
=============================================================================
PART 1. WHAT BEATFALL IS
=============================================================================

Beatfall is a beat board for screenwriters. A writer brings a file of
scattered notes. Beatfall separates them, works out which ones are story
beats and which are notes about characters, lines, images or research, places
the beats into whichever of nine structures the writer chose, and shows the
holes between them.

The product is the empty beat, not the full board. An empty beat costs
nothing and a wrong one costs trust, so Beatfall asks rather than guesses.

It never writes a script. It will not write prose, dialogue, or a beat. If a
writer asks it to, it says that is their job and asks a better question
instead.

THE SHAPE OF THE APP, TOP TO BOTTOM.

  The dashboard is the shelf of projects. It is where a writer lands.
  A project is one script. It holds a board, notes, characters and an outline.
  Inside a project there are four views, reached from the bar at the top:
    Board       the beats, with cards standing in them
    Outline     the story in order, with prose written under each beat
    Characters  a sheet per person
    Notes       everything that is not a beat card

  Those four are destinations, not toggles. The bar never changes shape and
  the blue one says where you are. You leave a view by going to another one.

THE TWO COLOURS, AND THEY MEAN SOMETHING.

  Blue means you can press it and it is free.
  Gold means two related things: there is a gap here, and the control that
  gets you out of the gap spends a credit.

  Gold text and gold rules mark what is missing: the open count, the name of
  an empty beat, a dashed line where a card should be. Gold controls charge.
  Nothing free is ever gold, and that is a rule rather than a habit.

WHAT IS FREE, FOREVER.

  Typing a note and placing it on the board.
  Moving, editing, locking and deleting cards.
  The whole outline, including every word written in it.
  Characters, typed in by hand.
  Adding pictures.
  Every export: the PDF of a board, and the download of the whole account.

WHAT COSTS CREDITS. Only the writing help, which is Beatfall reading or
asking. Part 15 lists every price.


=============================================================================
PART 2. ACCOUNTS AND SIGNING IN
=============================================================================

THERE IS NO PASSWORD. Signing in is by a six digit code sent to an email
address. Type the address, press Email me a code, read the code, type it in,
press Sign me in.

The code works once and lasts an hour.

A code rather than a link, on purpose. A link has to leave the browser for a
mail app and find its way back, and on a phone it signs in whichever device
opened it, which is the wrong one about half the time. Six digits travel the
other way: the reader carries them, so the session lands on the machine they
are sitting at.

THE SAME BOX SIGNS IN AND SIGNS UP. There is no separate registration. If the
address has no account, one is made when the code is typed. Nothing on that
screen needs to be chosen first.

WHEN THE CODE DOES NOT ARRIVE. The screen that says "Check your email" carries
two ways out, and they are the answer to almost every sign-in problem:
  Send it again, which resends to the same address.
  Use a different email, which puts the address box back so a typo can be
  fixed.

WHEN THE CODE IS REFUSED. Beatfall says the code did not work, that it may
have expired or a digit may be off, and to ask for a new one. The box is
selected so retyping overwrites it. An hour is the whole life of a code.

IF SOMEBODY OPENS THE EMAIL ON A DIFFERENT DEVICE. With a code this mostly
does not arise, because the code is typed into whichever browser is in front
of the writer. Reading the mail on a phone and typing the digits on a laptop
signs the laptop in, which is usually what was wanted.

CHANGING THE EMAIL ADDRESS ON AN ACCOUNT IS NOT SELF SERVE. The address box in
Settings is deliberately fixed, because the address is how an account is
reached. Write to support@beatfall.app.

THE TRIAL. ${TRIAL} credits and 14 days, with no card. A trial account has
every feature a paid one has. The only differences are the size of the credit
allowance and the fact that it ends.

TWO WARNINGS BEFORE A TRIAL ENDS, each shown once ever and keyed to the
account rather than the browser: one about a week out, one about two days
out. Neither is a nag and neither repeats.


=============================================================================
PART 3. THE DASHBOARD
=============================================================================

The dashboard is the shelf. It opens with one line stating totals across
every project, for example "Three projects saved. Six beats empty."

THE SCOREBOARD, which is hidden entirely on a brand new account because every
figure on it would be a nought about a project nobody has made.

  Beats filled      how many beats have at least one card, across every
                    project, over the total number of beats
  Beats still empty the same total from the other side, in gold
  Nearly finished   the one project closest to a full board, named, with its
                    bar, its percentage, the beats left, and the next hole.
                    It is double width because a title will not live in a
                    number's column. Pressing the title opens that board. A
                    finished board steps aside for the next one behind it,
                    because complete is not nearly finished.
  From your phone   only when notes are waiting. The count, and a way in.
  In a row          the run of consecutive days the writer changed something,
                    with a calendar month beside it. A day counts when
                    something was saved, not when a tab was opened.

  There are no points, no badges and no invented currency. Every figure is a
  count of something the writer actually did.

A PROJECT CARD carries, top to bottom: the title in capitals, how long ago it
was touched, the logline, a big percentage with COMPLETE under it, the beat
counts, the structure, a progress bar, one wide control, and three buttons.

  The wide control is Next up on an unfinished board: it names the next
  useful empty beat and opens the conversation about it. That conversation
  costs ${COST.conversation} credits and the card says so.
  On a finished board the same slot reads Finished, and the control is Save
  as PDF, which downloads without leaving the dashboard.

  The three buttons on the floor of the card are Open, Details and Delete.
  Open goes to the board. Details opens the project sheet for the title,
  format, logline, protagonist and genre. Delete removes the project.

  Every card can be deleted, including the last one. Deleting the last one
  leaves the dashed New project box on its own, the same as a new account.

DELETING A PROJECT ASKS FIRST, and the confirm names the project and says how
many cards go with it. It cannot be undone, and it takes the board, the
notes, the outline and the characters with it. Download everything from
Settings first if any of it might be wanted later.

THE SHELF IS GROUPED BY MEDIUM. Features, Television, Short films, Vertical.
Headings only appear when there is more than one group.

THE WELCOME SHEET opens on an EMPTY account rather than a NEW one: no
projects, or one untouched project still called Untitled. It offers three
ways in: paste notes you already have, start something from scratch, or look
at the example. The same sheet is reachable any time from What Beatfall does
in the account menu.


=============================================================================
PART 4. MAKING A PROJECT
=============================================================================

New project, from the dashboard, opens a sheet. Only the format is required.
Everything else is optional and can be filled in later from Details.

  Title          Untitled is fine for now
  Format         the structure the board will have. This is the one required
                 answer, and both buttons stay disabled until it is chosen,
                 because it decides which beats the board has.
  Logline        with a link beside it to answer questions for one, which
                 costs ${COST.logline} credits
  Who it's about
  Genre
  Setting
  Comps

Two ways out of the sheet: Create from notes, which makes the project and
opens the paste box, and Create an empty board, which makes it and opens the
board.

THE FORMAT IS ASKED, NEVER ASSUMED. The sheet used to arrive pre-filled,
which quietly answered the one question it said was required. It now starts
unanswered unless a default was set in Settings.

THE STRUCTURE CAN BE CHANGED LATER, from the bar above the board or from
Details, and nothing is lost when it is. Part 12 covers exactly what happens.

THERE IS A LIMIT OF SIXTY PROJECTS on an account. Nobody has come close.


=============================================================================
PART 5. CATCHING ONE NOTE, AND PLACING IT
=============================================================================

The capture bar sits under the header on every board, in the same place
whether the writer is looking at the first beat or the last. It holds a box
labelled Capture a thought and two buttons.

THE BOX grows a line at a time to five lines and scrolls after that. Enter
places the note. Shift and Enter is a new line, which is the bargain every
other box in Beatfall makes.

PLACE IT is free and always will be. It takes what is in the box and asks
where it goes. It never makes more than one card, and the card says exactly
what was typed.

  What happens when it is pressed:
  Beatfall proposes instantly from its own built-in matcher, so capture never
  waits on a network. If the writing help is reachable, a better answer
  replaces that a moment later, unless the writer has already chosen.

  Up to two beats are offered, best first, each with a percentage and one
  sentence saying why. Under them sits a list of every beat on the board, so
  choosing a beat Beatfall did not offer is always one press away. Beside
  that, Set it aside for now.

  When the best guess is under 92 per cent, Beatfall says so in plain words
  and offers a short conversation before it offers a placement, because a
  wrong confident placement costs more than two questions do.

  When it cannot place the note at all, it says that too, and asks for who it
  happens to or what changes.

  Nothing is placed until the writer presses something. Cancel leaves the
  note in the box.

A NOTE THAT IS TOO LONG FOR ONE CARD. Past about 250 characters, or two
lines, a strip appears under the box saying so and offering Sort my notes
instead. Past 1,000 characters Place it is disabled, because that box takes
one note and a whole notes file belongs in the importer.

Nothing is ever truncated. The text stays exactly where it was pasted. What
changes is what the bar offers to do with it, and if the writer backs out of
the importer the text goes back in the box.

WHAT'S MISSING, in the bar above the board, ignores the box entirely. It
reads the board, picks the most useful empty beat itself, and opens a
conversation about it. It costs ${COST.conversation} credits. Once every beat
has a card it disappears and Save as PDF takes its place.

HOW IT PICKS. It does not walk the board left to right. Writers arrive with
an opening and a rough ending, so it bisects: with both ends down, the widest
span is the whole story and its middle is the midpoint. Answer that and the
widest span becomes the first half. Each press halves what is still unknown.


=============================================================================
PART 6. THE BOARD
=============================================================================

Acts are horizontal bands, not columns, so a five act structure never runs
off the right of the screen. Each act shows a progress rail and a count.

AN EMPTY BEAT shows the job that beat has to do, a dashed gold line where the
card should be, and two ways in:
  What goes here?  a conversation about this beat. ${COST.conversation} credits.
  The bulb         three ideas built wherever possible out of notes the
                   writer already wrote. ${COST.ideas} credits.

A GAP is an empty beat with work on both sides. Empty beats at the ends are
not gaps, they are simply not written yet.

A CARD carries four controls at its top right. They fade in on hover, and on
a touchscreen they stay visible, because there is no hover on a tablet and
without that there was no way to delete a card at all.

  Pencil    edit the wording. Double clicking the card does the same.
  Three dots move this card to another beat, set it aside, or file it under
            Other notes as a particular kind.
  Padlock   lock the card in place. A locked card cannot be dragged and its
            move menu is refused. The shackle changes shape and the colour
            goes gold, two signals rather than one.
  Cross     delete. It always asks first, quoting the card, and it says undo
            will bring it back, because it will.

THE GOLD EDGE DOWN THE LEFT OF A CARD MEANS LOCKED, and locked means one
thing: somebody pressed the padlock. Nothing else sets it.

A card written by the writing help wears a small Suggested label until the
wording is changed. Changing one word removes it.

DRAGGING. Any unlocked card can be dragged onto any beat, or onto the Set
aside tray. A beat holds as many cards as the writer puts there. Nothing is
ever evicted to make room, and no card moves itself: if a card should move,
the writer moves it.

SET ASIDE is a tray under the board. It holds possible beat cards that have
not found a beat. A card in it may carry a line reading "possibly Midpoint",
which is Beatfall saying where it thinks it goes without putting it there. A
card in Set aside also carries Did we get it wrong?, which opens a short
conversation to work out what it actually is. That costs
${COST.conversation} credits.

UNDO IS THIRTY DEEP, and Ctrl or Cmd with Z works anywhere outside a text
box. There is a circular arrow in the bar above the board that appears only
when there is something to undo.

  Undoable: dropping a card, the move menu, the padlock, deleting a card,
  placing a note, changing the structure, adding a card from a conversation
  or an idea, and taking a note off a beat.

  Undo restores the whole state at that moment, not only the one card.

RECEIPTS. When something moves, a strip appears above the board naming what
happened, with Undo in it. Deleting raises one, filing a note raises one,
changing the structure raises one. Dragging a card does not, because the
board is its own receipt.

THE BAR ABOVE THE BOARD carries the structure chooser, the undo arrow, a
meter reading how many beats have a card, one line naming what is still
missing, and either What's missing? or Save as PDF.

THE LINE THAT NAMES WHAT IS MISSING says where, not just how many. It reads
"Two notes both name Midpoint" when a beat is doubled, or "3 gaps between
what you have", or "6 beats still empty", and it is blank on a finished
board.
`;

const PART_B = `
=============================================================================
PART 7. GETTING A WHOLE FILE OF NOTES IN
=============================================================================

This is the feature Beatfall exists for. A writer pastes the messy notes file
they already have, and Beatfall separates it into notes, works out which are
beats, and shows the result before anything on the board changes.

WHERE THE PASTE BOX IS. Four doors, all leading to the same sheet:
  Paste in your notes, in the project menu.
  Paste in your notes, the gold button on the capture bar.
  Sort my notes, which appears under the capture box when what is in it is
  too long to be one note.
  Create from notes, on the New project sheet.

WHAT IT ACCEPTS. Paste anything, or drag a file onto the box. Text files:
.txt, .md, .markdown, .text, .fountain, .csv and .rtf. Several files can be
dropped at once and they are joined. Anything else is ignored.

There is no file picker in this flow. Dragging the file onto the box is the
way in.

WHAT IT COSTS. Reading a file costs ${COST.import} credits, flat, whatever the
size of the file. A thousand notes costs the same as ten. Pasting is free and
nothing is charged until Sort my notes is pressed. Collapsing duplicates does
not reduce the price.

If the balance will not cover the read, the sheet says so before a word is
typed, and offers a way to top up. Nothing is blocked: the button still works
and gives the same answer, this only says it earlier.

WHAT HAPPENS WHEN SORT MY NOTES IS PRESSED.

  Separating. The file is cut into notes and then glued back together where
  it was cut wrongly. A section heading like MIDPOINT: is not a note: if it
  names a beat it declares the one note directly beneath it, which is better
  evidence than anything Beatfall could infer. A one line quote folds into
  the scene above it. An attribution line joins its quote. A heading followed
  by fragments, like five candidate titles, becomes one note, because five
  candidate titles are one decision the writer is making. The writer's own
  asides, like "too cute, leave it in notes", fold back onto the note they
  are about.

  Reading the whole file once. What the file says about itself: the title,
  logline, genre, format, setting and protagonist if they are stated, who the
  characters are, and whether more than one named story is in there.

  Another story is decided in code, not asked about, on the one thing
  actually in the text: DID THE WRITER NAME IT. "Another project: dirt track
  racers, title maybe DIRT MONEY" is a project. "Unrelated horror idea: a
  motel pool fills with seawater" is a note. A story found that way takes
  exactly the one note that named it and nothing else.

  Settling the structure BEFORE anything is classified. Only a format the
  writer typed may switch it. A format inferred from a genre line is a guess,
  and a guess must never move somebody off the structure they chose.

  Classifying, in batches of forty, by number, so a reply cannot be truncated
  into nonsense and a note that does not come back is left unplaced rather
  than guessed at.

  The casting call. Every beat is asked once, with all the plausible notes
  laid out under it, and the same question is asked three times. A beat is
  only filled by a note that won it in at least two of the three. The figure
  on the card is a count of agreements rather than an opinion of itself: two
  of three is 67 per cent, three of three is 100.

WHAT THE WRITER SEES WHILE IT WORKS. A wall over the page, with the gold card
falling onto the blue stack, and a status line that names the pass actually
running: looking at the whole file, separating the ideas, reading notes 41 to
80 of 83, weighing the notes against each beat, placing what it is sure of.
The rail only moves when a pass has genuinely finished. There is no
percentage, because the weights are estimates of time and never of certainty.

The wall veils rather than covers, so the writer's own paste is faintly there
behind it. There is a Stop button. Stopping changes nothing.

THE THRESHOLDS, AND WHY A FULL BOARD IS NOT THE GOAL.
  At or above 78 per cent, a note takes the beat.
  Between 55 and 78, it goes to Set aside carrying its guess, so the writer
  reads "possibly The First Attempt" and settles it with one drag.
  Below 55, nothing is claimed.
  A beat takes at most three cards from a read, whatever the reading says.

THE REVIEW SHEET. Nothing reaches the board until this is read. It is headed
"Here's what I found".

  At the top, project details found in the notes, and the people the notes
  describe, which become character sheets. Existing fields are never
  overwritten.

  Then one row per note. Each row has:
    A tick box, ticked by default.
    A chip saying how the note was read: Beat, Character, Line, Clue or
    reveal, Structural idea, Open question, Rule you set, Research, Image,
    Voice & theme, Vision.
    The note, and under it where it is going, in words: "to Midpoint (you
    said so)", "to Midpoint (100% sure)", "Other notes, Clue or reveal", "Set
    aside, possibly The First Attempt, only 61% sure", "Set aside, Midpoint
    already has 3 cards".
    Did we get it wrong?, on every row including a confident one, because a
    note sitting on Cold Open at 100 per cent is exactly where a writer wants
    to say no it isn't. ${COST.conversation} credits.
    A dropdown listing every beat, Other notes and Set aside. Free, instant,
    and it overrules whatever the reading decided.
    Throw this away, which turns the row into "Thrown away" with an Undo
    beside it.

  THE TICK AND THE BIN ARE DIFFERENT QUESTIONS. Unticking says not now, and
  the note waits in the pile to be offered again. Throwing it away says
  never. They are two separate presses on purpose.

  The count line says both figures whenever they differ, for example "79 of
  83 notes ticked, 24 onto the board, 4 already there, 3 say the same thing".
  A number that silently means something narrower than it says is worse than
  no number.

  Pressing Add selected notes writes the ticked ones. Unticked ones go to the
  pile rather than vanishing. Cancelling parks them too, because a writer who
  unticked six rows has made six decisions.

DUPLICATES. Three separate tests, and none of them ever deletes a note
without showing the writer.
  The same words, allowing for curly quotes, spacing, capitals and a trailing
  full stop or comma. Those are typing, not meaning. "Yes." and "Yes?" stay
  two notes.
  The same words rearranged, at 85 per cent overlap on content words, both at
  least four words long. The threshold is high because "Dale drives north at
  dawn" and "Dale drives south at dusk" share five words out of seven and are
  opposites.
  The same moment written twice in different words, which only a reader can
  see.

  What happens: the repeat stays on the sheet, unticked, sitting directly
  under the note it repeats, saying why. Beatfall is allowed to have an
  opinion about which of two sentences to keep. It is not allowed to act on
  that opinion behind the writer's back. Tick it and it lands like any other
  note.

IF THE READ FAILS. "Couldn't read that file. Nothing was added. Your text is
still above." Nothing is charged for a read that did not happen, and being
out of credits gets its own message rather than being reported as a failure
to read.


=============================================================================
PART 8. NOTES FROM YOUR PHONE
=============================================================================

Notes sent from the phone app land in a pile. They never touch a board on
their own. The pile is the truth and everything else is an offer.

THE DASHBOARD CELL shows the count whenever the pile is not empty, and opens
the pile. There is no cell when there is nothing waiting, because a cell that
reads zero every day is a reproach.

A GREETING appears at most once every twelve hours, on arriving rather than
on returning to a tab. It says how many came in, how many of those are
pictures, and which script they were filed under. It offers Sort them onto
the board or Not now. Declining costs nothing and changes nothing.

THE PILE groups notes by the script the phone filed them under. A group for
notes the phone did not file is called Not filed, and it sorts last, because
it is the one that needs a decision and a decision should not be first in the
list. The unfiled group carries a chooser listing every script plus A new
script, which asks for a working title.

EACH GROUP OFFERS THREE THINGS.

  Place them myself. Free. Pictures land straight into Vision. Typed notes
  open a review sheet built from the notes themselves, every row arriving
  honest: no kind, no beat, no confidence, because nothing has read them.
  Every row carries the same free dropdown.

  Read them for me. ${COST.import} credits. This is the ordinary paste flow:
  the same read, the same review sheet, the same promise that nothing changes
  until it is read. Phone notes get no private door onto a board.

  Throw away. This asks out loud, and says plainly that these notes are not
  on a board yet and the phone has already let them go, so the pile is the
  only copy and it cannot be undone. Pictures in a thrown away group are
  deleted from storage as well.

A GROUP OF NOTHING BUT PICTURES is never offered the paid read, and its line
says free rather than quoting a price. Nothing to read means nothing to
charge for.

A NOTE LEAVES THE PILE because it landed somewhere, or because it was thrown
away. Never because it resembles something else. Being wrong in that
direction means a writer sees a note twice. Being wrong the other way means
they never see it at all.


=============================================================================
PART 9. THE NOTES PAGE
=============================================================================

Notes holds everything in the project that is not a beat card on the board.
The heading reads Other notes.

TEN KINDS, and they are how the page is grouped:
  Vision           a picture
  Character        a note about a person
  Clue or reveal   information planted or turned
  Image            a written note about something visual
  Structural idea  shape, act logic, ordering
  Voice & theme    tone, meaning, register
  Line             a line of dialogue
  Open question    something unresolved
  Rule you set     a constraint, which Beatfall is told to obey
  Research         reference and fact, and the catch-all

A chip for a kind only appears when that kind has something in it, which is
why Vision simply is not there on a project with no pictures.

A SEARCH BOX filters by the words in the notes. A filter row filters by kind.

EVERY NOTE CARD CARRIES:
  A pencil to edit the wording, and double clicking does the same.
  A cross to delete, which asks first and can be undone.
  A dropdown to change how it is grouped.
  A dropdown that sends it to a beat, with two groups in it that do genuinely
  different things.
  A date, bottom right, invisible until the card is hovered.
  Did we get it wrong?, unless the note is already filed under a beat or is a
  picture. ${COST.conversation} credits.

THE TWO WAYS A NOTE CAN MEET A BEAT, and the difference matters:

  Make it a card on the board CONSUMES the note. It leaves Notes and becomes
  a card standing in that beat.

  Keep it a note, filed under KEEPS it a note. It stays in Notes, and it also
  shows up under that beat in the Outline as supporting material. It never
  reaches the board. The board shows only a count, never the content.

  A filed note carries a line reading "Filed under Midpoint" and a button
  reading Remove from beat, which puts it back without deleting anything.

A CHARACTER NOTE CAN SAY WHO IT IS ABOUT. A character note is frequently one
word, and "Skinny." is not a note until you know whose. The control only
appears on notes of kind Character, and only when at least one character has
a name. It stays in Notes; it does not reach the Characters page.

A PICTURE CANNOT BECOME A BOARD CARD. A beat card is a sentence describing
what happens. A photograph of a doorway is reference for the scene, not the
scene. The option is simply absent.

A PICTURE HAS NO KIND DROPDOWN either. Changing a picture's kind used to
destroy it: the frame that draws the image only exists on a picture card, so
the file stayed in storage, the caption stayed on the page, and the picture
was gone with no way back.


=============================================================================
PART 10. PICTURES
=============================================================================

A photograph is a note with a picture on it. Not a new drawer, not a new
object. That is why it inherits grouping, search, filing under a beat, the
delete confirm, undo and the date stamp without any new machinery.

Vision is the Notes page filtered to pictures.

THREE WAYS IN.
  Add pictures, on the Notes page. Up to 25 at a time.
  Dragging files onto the Notes page, or onto a character card.
  Pasting. A screenshot lives on the clipboard and never touches the disk,
  and a frame off a film is exactly the example this feature exists for.

THE PASTE RULE IS WHAT IS ON THE CLIPBOARD, NOT WHERE THE CURSOR IS. Words on
the clipboard with the cursor in a text box means the writer is pasting
words, so Beatfall stays out of the way. A picture and no words has no other
meaning, because a text box cannot hold an image. A pasted picture also
switches the view to Notes, since it would otherwise land somewhere the
writer is not looking. A dropped one does not, because it landed where they
dropped it.

WHAT HAPPENS TO A FILE. It is redrawn to 1600 pixels on the long edge before
it leaves the machine, which also strips the location data a phone writes
into every photograph. The server strips it again, because "the client
already did it" is not a thing to believe about somebody's location.

WHO CAN SEE THEM. Nobody but the account that owns them. The bucket is
private, the browser never touches it directly, and pictures are shown
through links that expire within the hour. This matters more here than
anywhere else in Beatfall, because a photograph is very often of a person who
never heard of this app.

HOW MANY. About 130 pictures per account. The Notes page starts saying how
much room is left once it is four fifths full. A number always on screen is a
number nobody reads.

A PICTURE ON A CHARACTER. Assigning does not consume it: it stays in Vision
and also appears on the sheet, the same grammar as filing a note under a
beat. A character wears one reference at a time, and choosing a second
replaces the first rather than making a gallery. The one that lost the job is
still in Vision.

The word is reference, never face. Half of what gets pinned to a character is
not a face: it is the jacket, the car, the hands, the way somebody stands.

FULL SIZE. Pressing a thumbnail opens the picture on a dark ground, from
Notes and from the Outline. Escape closes it.

DELETING A PICTURE NOTE does not immediately delete the file, because undo
has to bring back a picture and not a grey box. The file is swept the
following night if nothing points at it.

PICTURES AND A LAPSED PLAN. This is the one exception to "nothing is
deleted". Sending new pictures is refused straight away, and the pictures
already there come off thirty days after a plan ends. The note each one was
on stays, with whatever was written on it, and the card says the picture is
no longer stored. Reading and downloading stay open the whole time, because
somebody whose plan lapsed must always be able to take their pictures away.
Text is never deleted for a lapsed plan.
`;

const PART_C = `
=============================================================================
PART 11. CHARACTERS
=============================================================================

A sheet per person, with ten fields. They are also the ten questions the
interview asks, which is the point: it asks about whatever is still blank and
skips the rest, so filling the form yourself makes the conversation shorter.

  Name                    a placeholder is fine
  Part they play          protagonist, antagonist, mentor and so on
  Who they are            age, work, where they are when the story opens
  What they want          the thing they are chasing
  What they need          usually not the same thing
  The wound               what happened before page one
  The lie they believe    the false thing the wound taught them
  What's in the way       outside them, and inside them
  How they change         or how they refuse to
  How they talk           and what they would never say

A NAME IS NOT A CHARACTER, and the card does not claim it is. The percentage
on a card weighs the fields, and Name is worth nothing. A card with only a
name reads 0 per cent.

TYPING THE SHEET IN BY HAND IS FREE AND ALWAYS WILL BE.

ANSWER CHARACTER QUESTIONS costs ${COST.character} credits. It asks up to ten
questions, one at a time, and only about fields that are still blank. All ten
plus the write-up ride one session, so it bills once however many questions
it takes.

  Fill in the blanks is live from the first answer, so quitting at question
  three still buys three fields.

  Nothing already typed is ever overwritten. That is checked twice, because
  the writer may have typed into a field while an answer was in flight.

  It pushes back once on a generic answer. "He wants revenge" is a genre, not
  a want.

THIS FEEDS THE BOARD, or it would be a second app bolted on. What is written
here goes into every beat conversation, every set of ideas and every
placement, so "what goes here?" can ask about what is unresolved for THIS
protagonist rather than about a midpoint in the abstract.

DELETING A CHARACTER does not ask first, and undo is the way back.

A CHARACTER'S REFERENCE PICTURE is managed from the character's own card and
from the picture's card in Vision. Taking it off is not a delete and does not
ask: the picture stays in Vision, which is the whole point, because swapping
Monday's reference for Tuesday's better one is the common case.


=============================================================================
PART 12. THE OUTLINE
=============================================================================

The Outline is the story in order, with prose written under each beat. It is
where a board becomes something to read start to finish.

THE GATE. The Outline opens once every beat of the current structure has at
least one card. An outline of fifteen empty prompts is not an outline, and
that is the whole of its job.

  Until then the button is greyed with a small "locked" chip on it, and it
  still works: pressing it says how many beats still need cards.

  ONCE IT HAS BEEN OPENED, IT STAYS OPEN. Taking a card off a beat afterwards
  cannot take a writer's prose away from them, and leaving a beat open on
  purpose is a thing this app tells them they are allowed to do.

  This is the only gate of its kind in Beatfall. The PDF has none, at any
  time, including on a closed account.

A BEAT IN THE OUTLINE shows its name, its act, the job it has to do, the
cards standing in it, any notes filed under it, and the prose.

PASSAGES. Every beat has one box per saved passage plus an empty one at the
bottom, whose prompt reads "What happens in this beat?".

  SAVE IS NOT DECORATION HERE. Leaving a box commits it, leaving the Outline
  commits it, and leaving the page commits it, so nothing typed is ever lost.
  What Save does that none of those do is close this passage and open the
  next box under it, with the cursor already in it. A beat is rarely one
  paragraph.

  The Save button is absent until there is something uncommitted, because one
  that is always there and usually pointless teaches a writer to ignore it. A
  small "Saved" appears and fades on its own.

  A written passage sits on card stock. The empty one keeps a dashed border,
  which is what unwritten looks like everywhere else in this app.

  Emptying a box and leaving it deletes that passage. Delete passage does it
  outright, and can be undone.

THREE THINGS CAN SIT UNDER A BEAT, and they get there differently on purpose.
  A card from Set aside, dragged from the rail. It becomes a real beat card
  and carries Return to Set aside.
  A note, dragged from the rail. It stays a note and carries Return to Notes.
  A passage, typed. It carries Delete passage, which is the only one styled
  as destructive, because prose has no earlier home to return to.

THE RAIL, down the right, holds Set aside and Your notes, with the same kind
filters as the Notes page. Anything filed under a beat disappears from the
rail because it is showing there instead, not because it has left.

THE WORD COUNT at the top counts every passage, including unplaced ones.

CHANGING THE STRUCTURE, AND WHAT SURVIVES IT.

  The chooser is in the bar above the board, and Details does the same thing.
  It asks first, and the confirm says exactly what will move: how many cards
  are being reorganised, how many passages will be kept for placing, and how
  many filed notes return to Other notes. When there is nothing to lose it
  does not ask at all.

  Every beat card is rescored into the new shape, longest notes first. Every
  field on the card survives, including the padlock. Nothing is deleted and
  nothing is left homeless.

  Notes and Set aside cards are carried across untouched. A structure has
  nothing to say about a note.

  Filed notes lose their beat and return visibly to Other notes.

  Outline passages on a beat the new structure also has stay exactly where
  they are. Everything else goes into a gold panel above the Outline headed
  Unplaced Outline passages, each stamped with the beat and the structure it
  came from. The writer drags each one to where it belongs now. No
  similarity score guesses for prose.

  The whole switch is one undo.


=============================================================================
PART 13. THE NINE STRUCTURES
=============================================================================

Every project has exactly one, chosen when it is made and changeable later.

FEATURE, SAVE THE CAT, 15 beats, in three acts.
  Opening Image, Theme Stated, Setup, Catalyst, Debate, Break Into Two,
  B Story, Fun and Games, Midpoint, Bad Guys Close In, All Is Lost,
  Dark Night, Break Into Three, Finale, Final Image.

FEATURE, CLASSIC THREE-ACT, 9 beats, in three acts.
  Opening Image, Setup, Inciting Incident, Plot Point One, Rising Action,
  Midpoint, Low Point, Climax, Resolution.

EITHER, STORY CIRCLE, 8 stages, in four movements: Order, Descent, Chaos,
Return.
  You, Need, Go, Search, Find, Take, Return, Change.

SHORT FILM, EIGHT BEATS, for 5 to 20 minutes, in three movements: Set Up,
Push, Land.
  Hook; Who, and What They Want; The Disruption; The First Attempt; The Cost;
  The Turn; The Choice; Final Image.

VERTICAL, ONE EPISODE, 60 to 120 seconds, in three movements: Detonate,
Escalate, Cut.
  Hook 0 to 15s, Friction 15 to 60s, Spike 60 to 90s, Button last 5 to 10s.

VERTICAL, SEASON ARC, 11 beats across 60 to 100 episodes.
  Episode One Hook, The Setup, The Paywall Turn around ep 10, First Big
  Reveal, Complication Layers, Midpoint Reversal around ep 40, The Dark
  Middle, The Lowest Point, The Turn, Payoffs In Order, The Central Arc
  Lands.

TV, BROADCAST HOUR, 9 beats, teaser plus four acts.
  Teaser, Act One In, Act One Out, Act Two In, Act Two Out, Act Three In,
  Act Three Out, Act Four Climax, Tag.

TV, STREAMING HOUR, 7 beats, five acts, serialized.
  Cold Open, Act One, Act Two, Act Three Turn, Act Three Cost, Act Four,
  Closing Hook.

TV, HALF-HOUR COMEDY, 8 beats, cold open plus three acts plus a tag.
  Cold Open, A Story Setup, B Story Setup, Complication, Escalation, Low
  Point, Resolution, Tag.

A default structure for new projects can be set in Settings.


=============================================================================
PART 14. TAKING WORK OUT
=============================================================================

Two exports, and neither is ever gated. Closing a board is a business
decision. Holding a writer's notes is a different thing.

SAVE AS PDF, per project, free. It is offered from the project menu, from the
bar once the board is full, from a finished card on the dashboard, and from
the screen a closed account sees.

  The document has seven sections, in this order:
    Cover, with the title, logline, format, genre, tone, setting,
    protagonist, and one standing line of counts.
    The board, act by act, every beat at a glance. A box that cannot show
    everything says MORE IN THE OUTLINE.
    The outline, beat by beat in order, with the cards, the filed notes, the
    pictures filed under that beat, and the prose. Empty beats print too,
    marked OPEN, because a hole you are writing towards belongs in a writing
    companion.
    Passages with nowhere to go, if there are any.
    Characters, only the fields that have something in them. A name with
    nothing behind it does not print.
    Vision, a contact sheet of the pictures not already printed elsewhere.
    Set aside.
    Loose notes, grouped by kind.

  Nothing is printed twice. A picture under a beat is not repeated in the
  contact sheet, and a note filed under a beat is not repeated in Loose
  notes.

  The file is named after the project, for example night-haul-beats.pdf.

  THERE IS NO COMPLETENESS GATE ON THE PDF, at any time. A half built board
  with the holes showing is still the writer's, and the PDF prints the gaps.

  Emoji and writing systems the built-in PDF fonts cannot spell are dropped
  rather than printed as garbage. Accents and smart quotes survive.

DOWNLOAD EVERYTHING, from Settings, free. Every project, card and note as a
single file, so nothing is locked in. It is a backup rather than something to
read: for something to read or send, export a board as a PDF.

BOTH WORK AFTER A PLAN ENDS. That is deliberate and it is the point of the
screen a closed account sees, which lists every board with its own Save as
PDF button.
`;

const PART_D = `
=============================================================================
PART 15. CREDITS, PLANS AND BILLING
=============================================================================

A credit is one piece of work, not one message. A conversation costs the same
whether it takes two questions or five, because charging per turn would teach
writers to answer in three words to save money.

WHAT EVERYTHING COSTS.
  Placing a note on the board      free
  Moving, editing, deleting cards  free
  The outline, every word of it    free
  Characters typed by hand         free
  Pictures                         free
  Every export                     free
  A conversation about a beat      ${COST.conversation} credits
  A set of ideas                   ${COST.ideas} credits
  Help finding a logline           ${COST.logline} credits
  A character interview            ${COST.character} credits
  Reading in a notes file          ${COST.import} credits

Ideas sits on the same price as a conversation on purpose, even though it is
cheaper to run: it is how somebody finds out whether this app is any good, so
it should be pressed without doing arithmetic first.

THE PLAN. ${PLAN} credits a month, $${PRICE_MONTH} a month or $${PRICE_YEAR} a
year. The year is two months free against the monthly rate.

  An annual subscriber draws ${PLAN} a month, not the year's worth at once,
  and those expire on the reset day like anybody else's.

THE TRIAL. 14 days, ${TRIAL} credits, no card.

TOP-UP PACKS. ${TOPUP_CREDITS} credits for $${TOPUP_PRICE}. They never expire.

  A pack is priced above the subscription rate on purpose, so it can never
  undercut the plan. It is sized to one script rather than to a month.

TWO BUCKETS, AND THE ORDER IS NOT NEGOTIABLE.
  Monthly credits come with the plan, reset on the writer's own day, and
  whatever is left of them evaporates.
  Bought credits never renew and never expire.
  This month's are always spent first. Spending bought ones first would burn
  what somebody paid for while their free allowance expired unused.

THE RESET DAY IS THE DAY OF THE MONTH THE ACCOUNT WAS MADE, not the 1st.
Signing up on the 28th and getting a fresh allowance on the 1st would be a
month and a half of credits for one month's money. On a short month a 31st
lands on the last day rather than skidding into the next one.

WARNINGS, COUNTED DOWN IN CREDITS RATHER THAN UP IN PERCENT. "Eight left" is
something a writer can act on. "95 per cent used" is not.
  At ${lowMark(PLAN)} left on a plan, or ${lowMark(TRIAL)} on a trial, a gold
  count rides on the Account pill. No interruption.
  At ${lastMark(PLAN)} left, or ${lastMark(TRIAL)} on a trial, one strip
  appears above the capture bar, dismissible, once per credit period.
  At zero, the message comes from the server, where the writer is standing.

  Bought credits count towards the figure, so somebody holding a pack is not
  warned about a month they are not relying on.

BEING ASKED BEFORE IT SPENDS. Three things, all on by default:
  Every gold control carries its price in the explainer that appears when it
  is hovered or focused.
  On a touchscreen the first tap shows the price and runs nothing. The second
  tap runs it. A tap that reveals a control is a tap that did not press it.
  The first time an account uses each paid kind, a box asks and explains what
  gold means. Five of those in the life of an account, not five a day.
  Settings has a tick box to ask every single time instead.

RUNNING OUT DOES NOT CLOSE ANYTHING. The board, the outline, placing notes,
pictures and every export keep working. Only the writing help needs credits.

MANAGING THE SUBSCRIPTION. Changing the card, switching between monthly and
annual, and cancelling all happen on Stripe's own pages, reached from Manage
billing in Settings. A monthly subscriber is offered the switch to annual in
Settings, and it goes through the billing portal so nobody ends up paying
twice.

CANCELLING. Settings, Cancel plan. A sheet states six things before anything
happens, and a box has to be ticked before Continue is live:
  The boards close, because the subscription is what opens them.
  The writing is not deleted. Every project, card, note and outline stays.
  Pictures come off after thirty days. The note each was on stays.
  Everything can still be downloaded, any time, including afterwards.
  Bought credits stay in the account and are not taken back.
  After six months with no sign-in the account is deleted, with an email
  about a month before, and signing in resets the clock.

  The tick box is not a dark pattern. Nothing is hidden behind it and the
  button is next to it. It exists so that "I didn't know my boards would
  close" is not a sentence anybody can honestly say afterwards.

  Cancelling takes effect at the end of the period already paid for.

  A pack can still be bought while a cancellation is scheduled. Buying
  credits was never a way to keep access, and the copy says the credits would
  wait in the account instead.

A FAILED PAYMENT does not switch anything off while the bank is being
retried. Settings says so and points at Manage billing.


=============================================================================
PART 16. SETTINGS
=============================================================================

Reached from the account pill, top right. Four panes.

PROFILE. The name the app uses, the email address (fixed, see Part 2), light
or dark or automatic, and which structure new projects start on. Also Delete
account, which needs the email typed exactly and then asks again.

USAGE. How many credits have been used this month and how many are left, when
they come back, how many bought credits are in the account, a count per kind
of action, and a ledger of where the credits went with a time against each.

PLAN AND BILLING. The two plan cards, a notice saying exactly where the
account stands, Manage billing, Add credits, and Cancel plan.

YOUR DATA. Download everything, a plain description of who can see the
writing, and links to the Privacy Policy and the Terms.

ONE SETTING LIVES IN THE BROWSER RATHER THAN THE ACCOUNT: Ask before every
credit. It is a habit rather than something worth a column in a database, so
it is per browser and says so.


=============================================================================
PART 17. THE PHONE APP
=============================================================================

Beatfall on a phone is for catching notes. It is deliberately not a small
board: there is no honest way to drag cards around a 390 pixel column, and a
writer's first impression should not be a cramped version of the real thing.

WHAT IT DOES. Sign in with the same six digit code and the same account.
Choose which script a note belongs to, or name a new one. Type or dictate a
note. Take or choose a photograph. Send.

WHAT IT DOES NOT DO. Rearranging a board, switching structure, bulk import,
or any of the writing help.

IT WORKS WITH NO SIGNAL. A note is written to the phone's own storage before
the screen says it was kept, and the network is never in that path. Notes
wait and go when there is a connection.

WHAT ARRIVES AT THE DESK goes into the pile described in Part 8. Nothing from
a phone ever touches a board on its own.

A LAPSED ACCOUNT CAN STILL SEND TYPED NOTES. It cannot send pictures, and the
phone says why and points at the computer. Text is words in a database.
Pictures are bytes on a bill that keeps arriving after somebody stopped
paying.

THE WEB APP ON A PHONE. Opening the board on a phone shows the app pitch
rather than a cramped board. Signing up on a phone works, deliberately: the
board needs a bigger screen but creating an account does not, and the phone
is where somebody hears about this and goes looking. The homepage, the
Privacy Policy, the Terms and the billing page all read normally on a phone.


=============================================================================
PART 18. RULES, LIMITS AND THINGS THAT SURPRISE PEOPLE
=============================================================================

ONE BROWSER AT A TIME. An account may edit Beatfall from one browser
installation at a time. Tabs in the same browser are one device. A different
browser or a different computer is another one.

  Opening Beatfall somewhere else closes it here, and the browser that was
  closed says so with a full screen notice offering "Use Beatfall here
  instead", which claims it back. Anything already saved is safe.

  This is not enforced on the phone app. Opening the phone does not close the
  desktop board.

THE LAST SAVE WINS. There is no merge dialog and no version conflict
question. A tab that comes back to focus with nothing unsaved re-reads the
projects first, so a stale tab catches up rather than overwriting. Anything
typed and not yet saved is left alone.

A SMALL SCREEN GETS THE APP, NOT THE BOARD. Two conditions, both required:
the shorter side of the screen is under 700 pixels, and it is a touch screen.
Every iPad passes. Documents like the Privacy Policy and the Terms are never
gated.

LIMITS WORTH KNOWING.
  Sixty projects per account.
  A note typed into the capture box: 1,000 characters, past which it belongs
  in the importer.
  A beat takes at most three cards from a read. By hand there is no limit.
  Up to ten questions in a character interview, five in a beat conversation
  or a note conversation.
  About 130 pictures per account, 25 in one go.
  Undo is thirty deep.

SIX MONTHS. An account nobody signs into for six months is deleted along with
everything in it. An email goes about a month before. Signing in resets the
clock. An account with a live subscription is never touched.

WHAT HAPPENS TO WRITING. Nothing written in Beatfall trains a model. The
Privacy Policy names the subprocessors, and Terms section 5 is the one to
read before putting a project you care about into any tool, including this
one.


=============================================================================
PART 19. WHEN SOMETHING GOES WRONG
=============================================================================

SAVING STOPS WORKING. A grey mark appears reading "not saved, retrying".
Beatfall keeps trying. After about a minute a strip says plainly that nothing
written has been lost and offers Download a copy, which writes everything
open to a file. Keep the tab open. The strip comes down by itself when saving
recovers, and it outranks every other message on the screen, because a writer
whose work is not saving does not need to be told about credits.

BEATFALL CANNOT LOAD YOUR PROJECTS. It says so, says the saved projects have
not been changed, and offers Try again.

OUT OF CREDITS. Everything free keeps working. The message says when the
credits come back and what a pack costs. Nothing is charged for an attempt
that was refused, and during a read the notes stay in the box.

A READ FAILED. "Couldn't read that file. Nothing was added. Your text is
still above." Nothing was charged. Splitting a very large file in two is
worth trying.

SIGNED OUT UNEXPECTEDLY. Sign in again with a fresh code. Work already saved
is safe.

A CONVERSATION STOPS OR WILL NOT ANSWER. "Couldn't get an answer just now."
Nothing is charged for an answer that did not arrive, and a conversation bills
once regardless.

A PICTURE WILL NOT ADD. The message says which rule it hit: the file is not a
JPEG, PNG or WebP; there is no room left; the file could not be read. Nothing
else in the batch is affected beyond the point it stopped.

NOTES THAT LOOK MISSING AFTER A READ. Check Set aside and check Other notes.
A note Beatfall was not sure about goes to Set aside carrying its guess, and
a note that is not a beat goes to Other notes under its kind. Nothing is
thrown away by a read.

ANYTHING NOT COVERED HERE, or anything about a specific account, a payment, a
sign-in that cannot be completed, or an email address that needs changing,
goes to support@beatfall.app.


=============================================================================
PART 20. WHAT BEATFALL DELIBERATELY DOES NOT DO
=============================================================================

This list is as much a part of the product as the features. When somebody
asks for one of these, the answer is that it does not exist, and that is a
complete answer rather than a gap.

  IT DOES NOT WRITE THE SCRIPT. No prose, no dialogue, no scene description,
  no writing a beat for the writer. It asks questions and it places cards.

  THERE IS NO WAY TO MERGE TWO PROJECTS. Cards cannot be moved from one
  project to another either. A card belongs to the project it was made in.
  Somebody who duplicated a project by accident should keep the one with more
  on its board and delete the other; the delete confirm names the card count,
  which is the quickest way to be sure which is which.

  THERE IS NO SHARING AND NO COLLABORATION. One account, one writer. No
  co-writers, no comments, no permissions, no shared boards, no public links.
  The way to show somebody a board is the PDF.

  THERE IS NO SCRIPT WRITING AND NO SCREENPLAY FORMATTING. Beatfall stops at
  the outline. It does not produce a screenplay, and it does not import or
  export Final Draft, Fountain or Celtx files. A .fountain file can be
  dropped into the importer, but it is read as text.

  THERE IS NO REVISION HISTORY AND NO VERSIONS. Undo is thirty deep within a
  session. Beyond that, the PDF and the download are how a moment is kept.

  THERE IS NO TEMPLATE LIBRARY AND NO CUSTOM STRUCTURE. The nine in Part 13
  are the nine. A structure cannot be edited, and beats cannot be added,
  renamed or removed.

  THERE IS NO CALENDAR, NO DEADLINE, NO WORD TARGET AND NO REMINDER. The
  streak counts days the writer changed something and nothing else.

  THERE IS NO SEARCH ACROSS PROJECTS. The search on the Notes page searches
  that project's notes.

  THERE IS NO TRASH OR ARCHIVE. A deleted project is gone, which is why the
  confirm says so and why the download exists.

  THE EMAIL ADDRESS ON AN ACCOUNT CANNOT BE CHANGED IN THE APP. That one goes
  to support@beatfall.app.

  A PHOTOGRAPH CANNOT BECOME A BEAT CARD, and a photograph is never sent to a
  paid conversation.

  BEATS ARE NOT REARRANGED AUTOMATICALLY. Nothing moves a card the writer
  placed, and nothing is evicted from a beat to make room.
`;

/* The whole thing, in order. Assembled at call time so the interpolated
   figures are always whatever core.js says today. */
export const MANUAL_TEXT = () => [PART_A, PART_B, PART_C, PART_D].join('\n');
