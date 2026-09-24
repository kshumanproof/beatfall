// ============================================================================
// BEATFALL SUPPORT MANUAL
//
// The help desk's factual description of the current product.
//
// It is not marketing copy, a design history, or a record of why the product
// works the way it does. It says what exists, what each control does, what it
// costs, what its limits are, and what does not exist. The reasoning behind a
// decision belongs in CLAUDE.md and in the code comments, not here: a
// reference full of arguments teaches whatever reads it to argue.
//
// api/_help/content.js holds worked answers to common questions. This manual
// is the authority where the two disagree.
//
// EVERY PRICE, ALLOWANCE AND CREDIT COST IS IMPORTED FROM core.js AND NEVER
// TYPED. Figures that live in other files are named in prose and are listed at
// the foot of this file so they can be found when they move.
//
// House rules: plain language, one idea per sentence, no em dashes. Never
// "AI", "the model" or "Claude"; the metered capability is "the writing help".
// ============================================================================
import { PLANS, PAID_PLAN, PRICE_MONTH, PRICE_YEAR, TOPUP_CREDITS, TOPUP_PRICE,
         COST, lowMark, lastMark } from '../_lib/core.js';

const PLAN  = PLANS[PAID_PLAN].credits;
const TRIAL = PLANS.trial.credits;

const PART_1 = `
=============================================================================
1. WHAT BEATFALL IS
=============================================================================

Beatfall is note organization for storytellers.

It turns scattered story notes into a working beat board. The writer pastes
the whole mess. Beatfall finds the possible beats, places what it can, sets
uncertain material aside, and shows what is missing. The writer makes every
final decision. It never writes the script. It helps the writer see the story
already inside their notes.

Beatfall does not write screenplay pages, scenes, dialogue or action. The
writing help asks questions, offers possibilities and organizes material the
writer already has.

A project is one script. It can hold:

  A beat board.
  Other notes.
  Character sheets.
  Pictures, in Vision.
  An outline written beneath the beats.
  Cards that have been set aside.

Inside a project there are four destinations: Board, Outline, Characters and
Notes. The dashboard is the shelf holding every project.

COLOURS.

Blue controls are ordinary actions and spend no credits.

Gold controls use the writing help and spend credits. Their hover or focus
explanation states the price before the action runs.

Gold is also used to mark missing material, such as an empty beat or the
dashed line where a card would sit. A gold rule or label is not always a
button.

CREDITS AND ACCESS ARE DIFFERENT THINGS.

Most of Beatfall costs no credits. An open trial or an active plan is still
required to edit a board.

These spend no credits while the board is open:

  Typing and placing a note.
  Moving, editing, locking and deleting cards.
  Writing and editing the Outline.
  Filling character sheets by hand.
  Adding pictures.
  Exporting a project as a PDF.
  Downloading the account data.

Only the writing help spends credits. Section 17 lists every price.


=============================================================================
2. ACCOUNTS AND SIGNING IN
=============================================================================

Beatfall has no passwords.

To sign in:

  Enter an email address.
  Press Email me a code.
  Read the six digit code in the email.
  Type it into Beatfall.
  Press Sign me in.

A code works once and lasts an hour.

The same form signs in and signs up. If the address has no account, one is
created once the code is verified.

IF THE CODE DOES NOT ARRIVE.

The screen offers Send it again and Use a different email. The second returns
to the address field so a typing mistake can be corrected.

A refused code has usually expired or has a digit wrong. Ask for a new one.

Because Beatfall uses a code rather than a sign-in link, the email can be read
on one device and the code typed on another. The device where the code is
typed is the one that gets signed in.

CHANGING THE EMAIL ADDRESS.

The address on an account cannot be changed inside Beatfall. Write to
support@beatfall.app.

THE TRIAL.

Fourteen days and ${TRIAL} credits, with no payment card.

A trial has every feature a paid account has. The differences are the size of
the credit allowance and the end date.

Two warnings come before a trial ends, about a week out and about two days
out. Neither repeats.


=============================================================================
3. THE HOMEPAGE AND SMALL SCREENS
=============================================================================

The public homepage is for signed-out visitors. A signed-in visitor who opens
the root address is sent to the dashboard.

On a small touch device, Beatfall shows the phone app information rather than
a cramped version of the board.

The small-screen gate applies when both of these are true:

  The shorter side of the screen is under 700 pixels.
  The device has a touch screen.

Tablets wide enough to pass both conditions get the board.

The homepage, sign-in, billing page, Help page, Privacy Policy and Terms all
read normally on a phone.


=============================================================================
4. THE DASHBOARD
=============================================================================

The dashboard is the project shelf and the normal landing place after signing
in. Its opening line states how many projects are saved and how many beats are
still empty across all of them.

THE SCOREBOARD.

Hidden on a new account with nothing on it. Otherwise it can show:

  Beats filled, counting beats with at least one card across every project.
  Beats still empty.
  Nearly finished, the incomplete project closest to a full board. A finished
  project is not shown here.
  From your phone, only while captures are waiting.
  In a row, the run of consecutive days on which work was saved. Opening
  Beatfall does not count. A phone capture counts once it has been sent.

PROJECT CARDS.

A card can show the title in capitals, when it was last changed, the logline,
a completion percentage, the filled and open beat counts, the structure, a
progress bar, one wide control, and three buttons.

The wide control is Next up on an unfinished board. It names a useful empty
beat and opens a paid conversation about it, at ${COST.conversation} credits,
and the control says so. On a finished board the same slot offers Save as PDF,
which downloads without leaving the dashboard.

The three buttons are Open, Details and Delete.

Delete asks first. The confirmation names the project and how many cards go
with it. It cannot be undone, and it takes the board, the notes, the outline
and the character sheets. Pictures no longer referenced by any project are
removed by a later cleanup.

Every project can be deleted, including the last one.

PROJECT GROUPS.

When more than one kind of project exists, the shelf groups them: Features,
Television, Short films, Vertical.

THE WELCOME SHEET.

It appears on an account with no projects, or one untouched project still
called Untitled. It offers three ways in: paste notes you already have, start
something from scratch, or look at the example.

The same explainer opens any time from How Beatfall works in the Account menu.


=============================================================================
5. MAKING AND EDITING A PROJECT
=============================================================================

New project, on the dashboard, opens the project sheet:

  Title.
  Format.
  Logline.
  Who it is about.
  Genre.
  Setting.
  Comps.

Only Format is required. Everything else can be left blank and filled in later
through Details. If no default structure has been chosen in Settings, Format
starts unanswered and both creation buttons stay disabled until it is set.

Two ways out: Create from notes, which makes the project and opens the notes
importer, and Create an empty board, which makes it and opens the board.

A PROJECT CREATED FROM THE PHONE IS AN EXCEPTION. The phone asks only for a
working title. When the server creates that project it starts on Save the Cat.
The structure can be changed at the desk afterwards, and changing it keeps
every note.

The structure can be changed from Details or from the chooser above the board.
Section 14 says exactly what moves.

An account can hold up to 60 projects.
`;

const PART_2 = `
=============================================================================
6. CATCHING AND PLACING ONE NOTE
=============================================================================

The capture bar sits under the project header on the board. It holds a box
labelled Capture a thought, Place it, and Paste in your notes.

The box grows as the writer types, to five visible lines, then scrolls. Enter
places the note. Shift and Enter is a new line.

PLACE IT.

Free, and always will be. It handles one note at a time and never changes the
writer's wording.

When pressed, Beatfall's built-in matcher suggests a destination immediately,
so capture never waits on a network. If the writing help is reachable, a
second and usually better reading replaces it a moment later, unless the
writer has already chosen. That second reading costs nothing.

The panel can show:

  Up to two suggested beats, best first.
  A confidence percentage on each.
  One sentence saying why.
  A chooser holding every beat on the board.
  Set it aside for now.
  Cancel.

Nothing is placed until the writer presses something. Cancel leaves the note
in the box.

When Beatfall is not confident, it offers a short paid conversation to work
out what the note is before placing it. That is optional. Choosing a beat
directly is always available and always free.

LONG NOTES.

Past about 250 characters, or two lines, a strip appears offering Sort my
notes instead.

Past 1,000 characters, Place it is disabled, because that box takes one note.
The text stays exactly where it was pasted and can be moved into the importer.
Nothing is ever silently truncated.

WHAT'S MISSING.

What's missing ignores the capture box. It reads the board, picks an empty
beat and opens a conversation about it. ${COST.conversation} credits.

It does not walk the board left to right. It bisects: with both ends of the
story down, the widest span is the whole story and its middle is the midpoint.
Answer that and the widest span becomes the first half. Each press halves what
is still unknown.

Once every beat has a card, What's missing is replaced by Save as PDF.


=============================================================================
7. THE BOARD
=============================================================================

Beats sit in horizontal act bands. Each act shows its progress and how many of
its beats have cards.

AN EMPTY BEAT shows the beat name, the job that beat has to do, a dashed space
where the card would go, and two ways in:

  What goes here?, a conversation about this beat. ${COST.conversation} credits.
  A bulb, which offers three ideas. ${COST.ideas} credits.

Both prices are in the hover or focus explanation.

A gap is an empty beat with filled beats on both sides. An empty beat at
either end of the story is not a gap.

CARDS. A beat card carries four controls, top right:

  Pencil, which edits the wording. Double-clicking the card does the same.
  Three dots, which move the card to another beat, to Set aside, or file it
  under Other notes as a chosen kind.
  Padlock, which stops the card being dragged and disables the move menu. A
  locked card has a gold left edge. Only the padlock sets that.
  Cross, which deletes after a confirmation that says Undo can bring it back.

On a touchscreen the four stay visible, because there is no hover.

A card written from a writing-help suggestion wears a Suggested label until
the wording is changed.

DRAGGING. Any unlocked card can be dragged to another beat or to Set aside. A
beat holds as many cards as the writer puts in it. Beatfall never removes a
card to make room for another, and never moves a card the writer placed.

Dragging raises no receipt. The card is visibly where it was dropped.

SET ASIDE holds possible beat cards with no settled position. A card there may
carry a line such as "possibly Midpoint", which is Beatfall naming where it
thinks the card goes without putting it there. Did we get it wrong? opens a
short conversation about such a card, at ${COST.conversation} credits.

UNDO holds up to 30 states from the current session. Ctrl+Z, or Cmd+Z on a
Mac, works anywhere outside a text box. The undo arrow appears in the
structure bar only when there is something to undo.

It covers moving a card, deleting one, locking or unlocking one, placing a
note, adding a card from a conversation or an idea, changing the structure,
and taking a note off a beat.

Undo is not revision history. It is gone when the session ends or the page
reloads.

RECEIPTS. After a change that is not self-evident, a strip above the board
names what happened and offers Undo.

THE STRUCTURE BAR above the board and Outline holds the structure chooser, the
undo arrow when there is one, how many beats have cards, a progress rail, one
line describing what is still missing, and either What's missing? or Save as
PDF.

That line names where rather than only how many: it can read "Two notes both
name Midpoint", or "3 gaps between what you have", or "6 beats still empty".
On a finished board it is blank.


=============================================================================
8. IMPORTING A FILE OR A LARGE GROUP OF NOTES
=============================================================================

The importer opens from Paste in your notes in the project menu, Paste in your
notes beside the capture box, Sort my notes under a long capture, or Create
from notes while making a project.

Text can be pasted, or text files dragged onto the box. Accepted extensions:
.txt, .md, .markdown, .text, .fountain, .csv, .rtf. Several files can be
dropped together and their text is joined. There is no file picker in this
flow; dragging is the way in.

WHAT IT COSTS. ${COST.import} credits, flat, whatever the size of the file.
A thousand notes costs the same as ten. Pasting is free and nothing is charged
until Sort my notes is pressed.

If the balance will not cover it, the sheet says so before a word is typed and
offers a way to top up. The button still works and still gives the same
answer; this only says it earlier.

THE READ. Beatfall separates the text into individual notes, then glues back
together the things that are not separate ideas. A heading that names a beat
declares the note directly beneath it, which is stronger evidence than
anything Beatfall could infer. A one line quote folds into the scene above it.
A heading followed by fragments, such as five candidate titles, becomes one
note.

It then looks for project details stated in the notes, character information,
and any second story the writer named. A format the writer typed can change
the structure. A genre line cannot.

Notes are classified in batches, and an import places at most three cards on
one beat.

Then the casting call. Every beat is asked once with all its plausible notes
laid out, and the same question is asked three times. A beat is only filled by
a note that won it in at least two of the three. That is where the figures on
the review sheet come from: two of three is 67 per cent, three of three is
100.

PLACEMENT THRESHOLDS.

  At 78 per cent or above, a note takes the beat.
  Between 55 and 78, it goes to Set aside carrying its guess.
  Below 55, nothing is claimed for it.

These are proposals. Nothing reaches the board until the review sheet has been
read.

WHILE IT WORKS, a wall names the pass actually running: looking at the whole
file, separating the ideas, reading notes 41 to 80 of 83, weighing the notes
against each beat, placing what it is sure of. Stop cancels, and a stopped
read changes nothing.

THE REVIEW SHEET is headed Here's what I found. It can show project details
found in the notes, the people the notes describe, and one row per note.

Each row carries a tick box, a chip naming how the note was read, the note
itself, and where it is going. The destination line is written out, for
example:

  to Midpoint (you said so)
  to Midpoint (100% sure)
  Other notes, Clue or reveal
  Set aside, possibly The First Attempt, only 61% sure
  Set aside, Midpoint already has 3 cards
  Set aside, an event but not clearly any one beat

Every row also carries Did we get it wrong?, at ${COST.conversation} credits,
and a free chooser listing every beat, Other notes and Set aside. The chooser
is instant and overrules whatever the read decided.

Existing project details are never overwritten. Existing character fields are
never overwritten.

THE TICK AND THE BIN ARE DIFFERENT. Unticking means not now, and the note
waits to be offered again. Throw this away means never, and the row shows an
Undo beside it until the sheet is committed.

The count line states both figures when they differ, for example "79 of 83
notes ticked, 24 onto the board, 4 already there, 3 say the same thing".

Add selected notes writes the ticked rows. Unticked rows are parked rather
than discarded, and cancelling the sheet parks them too.

DUPLICATES. Beatfall spots three kinds: text identical apart from spacing,
capitals, quotes or a trailing full stop; notes sharing nearly all their
content words; and the same moment written twice in different words.

A likely duplicate stays on the sheet, unticked, sitting directly under the
note it repeats, with a line saying why. Ticking it keeps it. A read never
silently deletes one.

FAILED READS. Nothing is added and nothing stays charged. The text is still in
the box. Splitting a very large file in two is worth trying.


=============================================================================
9. NOTES FROM YOUR PHONE
=============================================================================

Notes sent from the phone land in a pending pile. They never change a board on
their own.

The dashboard shows From your phone while anything is waiting. Coming back
after a while, Beatfall may show a greeting describing what arrived. Declining
it discards nothing.

The pile groups captures by project. Captures with no project sit under Not
filed, which carries a chooser for an existing project or a new working title.

Each group offers up to three things.

PLACE THEM MYSELF is free. Typed captures open a review sheet with no
classification on it, because nothing has read them. Every row has the free
chooser. Pictures go straight into Vision for that project and never reach the
paid reader.

READ THEM FOR ME is the ordinary importer, at ${COST.import} credits, with the
same review sheet before anything changes.

THROW AWAY asks first. A pending capture may be the only copy left, because
the phone releases its own copy once the server confirms arrival. It cannot be
undone, and pictures in that group are deleted from storage too.

A group holding only pictures is never offered the paid read.

A capture leaves the pile because it landed somewhere or because it was thrown
away. Never because it resembles something else.
`;

const PART_3 = `
=============================================================================
10. THE NOTES PAGE AND OTHER NOTES
=============================================================================

The Notes destination is headed Other notes. It holds everything in the
project that is not a beat card on the board.

Notes are grouped by kind: Vision, Character, Clue or reveal, Image,
Structural idea, Voice and theme, Line, Open question, Rule you set, Research.

A filter chip appears only when that kind has something in it, which is why
Vision simply is not there on a project with no pictures.

The search box searches the words in this project's notes. It does not search
other projects.

A note card can carry a pencil to edit, a cross to delete, a chooser for how
it is grouped, a chooser that sends it toward a beat, a date visible on hover,
and Did we get it wrong?

Deleting asks first and can be undone.

Did we get it wrong? is not offered on a picture, or on a note already filed
under a beat.

TWO WAYS TO SEND A NOTE TOWARD A BEAT, and they do different things.

Make it a card on the board consumes the note. It leaves Other notes and
becomes a card standing in that beat.

Keep it a note, filed under keeps it a note. It stays in Other notes and also
appears beneath that beat in the Outline as supporting material. It never
reaches the board, which shows only a count.

A filed note reads Filed under followed by the beat name, and carries Remove
from beat, which unfiles it without deleting anything.

A Character note can also say which character it is about. It stays in Other
notes and does not become a character sheet.


=============================================================================
11. PICTURES AND VISION
=============================================================================

A picture is a note of kind Vision. Vision is the Notes page filtered to
pictures.

WAYS IN, on the desktop:

  Add pictures, on the Notes page.
  Dragging image files onto the Notes page.
  Dragging an image onto a character card.
  Choosing a reference from a character.
  Pasting from the clipboard.

Up to 25 in one batch. Adding straight to a character takes one.

JPEG, PNG and WebP. The desktop redraws a picture as JPEG before sending it.

Pasting a picture while looking at another view switches to Notes afterwards,
so the result is not somewhere the writer cannot see. If the clipboard holds
words and the cursor is in a text box, the ordinary text paste happens
instead.

PREPARATION. Both the desktop and the phone reduce a picture to about 1,600
pixels on the long edge before upload, which also drops the location data a
phone writes into a photograph. The server strips that metadata again from
JPEG files. A single file may not exceed 1.5 MB after preparation.

STORAGE AND WHO CAN SEE THEM. Pictures live in a private bucket. Other
Beatfall accounts cannot reach them, and the app shows them through links that
expire within the hour. The ordinary admin dashboard cannot display them or
the writing attached to them.

The hosting and storage providers necessarily process what is stored. Beatfall
personnel may reach a specific account's material only in the narrow
circumstances set out in the Privacy Policy and Terms: when the writer asks
for help, when legally required, or during a specific security or abuse
investigation.

Pictures are never sent to the writing help and are not used to train a model.

HOW MANY. The account has 40 MB of picture storage, which is roughly 130
normal pictures. The Notes page starts estimating the room left once about
four fifths of it is used.

CHARACTER REFERENCES. Assigning a picture to a character does not remove it
from Vision. A character wears one reference at a time; choosing another
replaces the assignment and the first picture stays in Vision. Removing a
reference does not delete the picture.

The visible word is reference, never face, because half of what gets pinned to
a character is the jacket, the car, the hands or the way somebody stands.

BEAT REFERENCES. A picture can be filed beneath a beat as supporting material
and appears there in the Outline. A picture cannot become a beat card: a beat
card describes what happens, and a photograph is reference for it.

FULL SIZE. Pressing a thumbnail opens the picture on a dark ground. Escape
closes it.

DELETING. Deleting a picture note asks first and can be undone, so the stored
file is not removed at once. An overnight sweep removes image files nothing
points at.

AFTER A PLAN ENDS. New uploads need an open trial or an active plan. Pictures
already there stay for 30 days and are then removed; the note and its caption
remain, and the card says the picture is no longer stored. Until they go they
can still be viewed and printed into a PDF. Text is never removed because a
plan ended.


=============================================================================
12. CHARACTERS
=============================================================================

One sheet per person, with ten fields:

  Name.
  Part they play.
  Who they are.
  What they want.
  What they need.
  The wound.
  The lie they believe.
  What's in the way.
  How they change.
  How they talk.

Filling them in by hand costs nothing.

The percentage on a card weighs the substantive fields. A name on its own does
not move it.

ANSWER CHARACTER QUESTIONS costs ${COST.character} credits. It asks up to ten
questions, one at a time, and only about fields still blank. The whole
interview is one charge however many questions it takes.

Fill in the blanks is available from the first answer, so stopping at question
three still keeps three fields. Nothing already typed is overwritten.

What is written here is available to the other writing-help features in that
project, so a conversation about a beat can ask what is unresolved for this
protagonist rather than about a midpoint in the abstract.

DELETING A CHARACTER does not ask first. Undo is the way back. The character's
reference picture stays in Vision.


=============================================================================
13. THE OUTLINE
=============================================================================

The Outline is the story in structural order. Each beat can show its name, its
act, the job it has to do, the cards standing in it, notes filed under it,
pictures filed under it, and passages written by the writer.

ACCESS. The Outline opens once every beat in the current structure has at
least one card. Until then the control is visibly locked, and pressing it says
how many beats still need cards.

Once it has been opened for a project it stays open. Taking a card off a beat
later does not hide prose the writer has already written.

The PDF has no such gate. A PDF can be made from an incomplete board at any
time.

PASSAGES. Every beat has an empty box reading What happens in this beat?

Leaving the box, leaving the Outline or leaving the page commits what is in
it, so nothing typed is lost.

Save does the one thing none of those do: it closes this passage, opens
another beneath it, and puts the cursor there. It appears only when there is
something uncommitted.

A written passage sits on card stock. The empty one keeps a dashed border.

Clearing a passage and leaving it deletes that passage. Delete passage removes
it outright and can be undone.

THE RAIL down the right holds Set aside, Your notes, and the kind filters.

Dragging a Set aside card beneath a beat makes it a real beat card. It arrives
unlocked and carries Return to Set aside.

Dragging an Other note beneath a beat files it as supporting material. It
stays a note and carries Return to Notes.

Typing in the box makes outline prose, and Delete passage removes it.

UNPLACED OUTLINE PASSAGES. If a structure change removes a beat that had prose
under it, the prose is not deleted. It appears in a panel above the Outline
naming the beat and structure it came from, and the writer drags each passage
to where it belongs now.

WORD COUNT. The count at the top includes assigned passages and unplaced ones.


=============================================================================
14. CHANGING THE STORY STRUCTURE
=============================================================================

The structure can be changed from the chooser above the board or from Details.

If the change will move existing work, Beatfall asks first and says exactly
what will happen: how many cards are being reorganized, how many passages will
be kept for placing, how many filed notes return to Other notes. With nothing
to lose it does not ask.

During the change:

  Beat cards are rescored for the new structure.
  Card wording is unchanged.
  Card lock state is unchanged.
  Set aside cards stay set aside.
  Other notes stay Other notes.
  Notes filed under old beats return to unfiled Other notes.
  Outline prose on a beat the new structure also has stays where it is.
  Other outline prose moves to Unplaced Outline passages.

The whole change is one undo.

Nothing is deleted because a structure changed.
`;

const PART_4 = `
=============================================================================
15. THE AVAILABLE STRUCTURES
=============================================================================

There are nine. A project uses one at a time, and any project can be moved to
any of the others. Custom structures cannot be built, and beats cannot be
added, removed or renamed inside a structure.

FEATURE, SAVE THE CAT!, 15 beats.
Opening Image, Theme Stated, Setup, Catalyst, Debate, Break Into Two,
B Story, Fun and Games, Midpoint, Bad Guys Close In, All Is Lost,
Dark Night, Break Into Three, Finale, Final Image.

FEATURE, CLASSIC THREE-ACT, 9 beats.
Opening Image, Setup, Inciting Incident, Plot Point One, Rising Action,
Midpoint, Low Point, Climax, Resolution.

EITHER LENGTH, STORY CIRCLE, 8 stages.
You, Need, Go, Search, Find, Take, Return, Change.

SHORT FILM, EIGHT BEATS, for 5 to 20 minutes.
Hook, Who and What They Want, The Disruption, The First Attempt, The Cost,
The Turn, The Choice, Final Image.

VERTICAL, ONE EPISODE, for 60 to 120 seconds, 4 beats.
Hook in the first 15 seconds, Friction from 15 to 60 seconds, Spike from 60
to 90 seconds, Button in the last 5 to 10 seconds.

VERTICAL, SEASON ARC, for 60 to 100 episodes, 11 beats.
Episode One Hook, The Setup, The Paywall Turn at about episode 10,
First Big Reveal, Complication Layers, Midpoint Reversal at about episode 40,
The Dark Middle, The Lowest Point, The Turn, Payoffs In Order,
The Central Arc Lands.

TELEVISION, BROADCAST HOUR, teaser and four acts, 9 beats.
Teaser, Act One In, Act One Out, Act Two In, Act Two Out, Act Three In,
Act Three Out, Act Four Climax, Tag.

TELEVISION, STREAMING HOUR, five acts, serialized, 7 beats.
Cold Open, Act One, Act Two, Act Three Turn, Act Three Cost, Act Four,
Closing Hook.

TELEVISION, HALF-HOUR COMEDY, cold open, three acts and a tag, 8 beats.
Cold Open, A Story Setup, B Story Setup, Complication, Escalation,
Low Point, Resolution, Tag.

WHICH ONE TO PICK is the writer's call. Beatfall never changes a structure on
its own. The one thing that can is the writer's own notes file: a line in it
that states a format, such as "Format: Half-hour comedy", is read as an
instruction and applied before the notes are sorted. A format Beatfall merely
infers from the material never moves a project.

The structure appears on the project card on the dashboard, in the structure
bar above the board, and in Project details.


=============================================================================
16. TAKING WORK OUT
=============================================================================

Two exports, both free, and neither spends a credit.

SAVE AS PDF is one project, laid out to read. It is in the project menu beside
the project name, in the structure bar on a finished board, and on each
project card on the dashboard.

The document has six sections in this order:

  A cover with the title, the structure, the logline and the date.
  The board, one page per act, every beat as a box in order.
  The outline, every beat in order with its cards, its filed notes, its
    pictures and its written passages, including beats with nothing under them.
  Characters, one block each, only the fields that have something in them.
  Set aside.
  Loose notes, and a contact sheet of any pictures not already printed.

A note filed under a beat prints under that beat and is not repeated in Loose
notes. A picture printed under a beat or on a character prints once.

A box on the board page that cannot show everything it holds says MORE IN THE
OUTLINE. The outline carries the full text.

Emoji and writing systems the document fonts cannot spell are dropped from the
PDF. Accents, curly quotes and dashes print normally.

DOWNLOAD EVERYTHING is the whole account as one JSON file. It is in Settings
under Your data. It contains every project, every card, every note, every
character, every outline passage and the account's own details.

It contains the paths and captions of pictures, not the picture files. To keep
the images themselves, save a PDF of each project, or open each picture and
save it.

Download everything keeps working after a plan ends. The boards close and the
export does not, which is deliberate: ending a subscription closes access to
the product, it does not hold a writer's material.

There is no import of a Beatfall export back into Beatfall, and no export to
Final Draft, Fountain, Word or Scrivener.


=============================================================================
17. CREDITS, PLANS AND BILLING
=============================================================================

WHAT A CREDIT IS. A credit is the unit for the writing help. Everything else
in Beatfall is free and is not counted: typing, dragging, placing notes by
hand, the Outline, Characters typed in by hand, pictures, search, the PDF and
Download everything.

WHAT EACH ACTION COSTS.

  Placing a note 0 credits.
  Reading in a notes file ${COST.import} credits.
  A conversation about a beat ${COST.conversation} credits.
  A set of three ideas ${COST.ideas} credits.
  Help finding a logline ${COST.logline} credits.
  A character interview ${COST.character} credits.

A price is shown on the control before it is pressed, either on the button or
in its hover and focus explanation.

Some of those prices cover more than one exchange. A reading covers the whole
file however many notes are in it. A logline session covers the questions and
the written draft. A character interview covers up to ten questions and the
write-up. Each bills once.

THE TRIAL. Fourteen days and ${TRIAL} credits, with no payment card. Every
feature is available.

THE PLAN. $${PRICE_MONTH} a month or $${PRICE_YEAR} a year, and ${PLAN} credits a month either
way. The year is the cheaper of the two.

TOP-UP PACKS. ${TOPUP_CREDITS} credits for $${TOPUP_PRICE}, bought as often as wanted, including
while a cancellation is already scheduled.

THE TWO KINDS OF CREDIT BEHAVE DIFFERENTLY.

Monthly credits refresh on the writer's own renewal day, which is the day of
the month they subscribed, not the first of the month. Whatever is left of
them on that day does not carry over.

Bought credits never expire and are only touched once the month's allowance is
spent. They survive a cancellation, and are there again on return, though they
cannot be spent while there is no plan.

An annual plan draws ${PLAN} credits a month like a monthly one. It does not
release a year of credits at once.

WARNINGS. At ${lowMark(PLAN)} left on a plan the count on the Account pill turns gold. At
${lastMark(PLAN)} left a strip appears once for that period. At zero the message comes from
whatever was just pressed.

Running out stops the writing help and nothing else. The board, the Outline,
the notes and the exports all carry on.

WHERE TO LOOK. Settings, then This month, shows the count used, the count
left, the date it comes back, the bought balance, and a log of where each
credit went with the date.

PAYING AND CHANGING A PLAN. Checkout and every change to a subscription happen
on Stripe's pages, reached from Settings, then Plan and billing. Card details
are never typed into Beatfall and Beatfall never sees them.

Switching between monthly and annual is done in the Stripe portal, which
prorates what has already been paid. Starting a second checkout instead would
mean paying twice.

CANCELLING. Settings, then Plan and billing, then Cancel. A sheet states what
happens, with a Download my work first button on it and a box to tick before
Continue works. The actual cancellation happens on Stripe's own page.

Access lasts until the end of the period already paid for.

WHEN A PLAN ENDS. The boards close and a screen appears offering a plan and
Download everything. Nothing written is deleted. Pictures are removed 30 days
after a plan ends; text is not.

REFUNDS. Unless local law says otherwise, part periods are not refunded and
credit packs are not refunded. The trial is there so nobody has to pay to find
out.

A FAILED PAYMENT does not delete anything. Stripe retries, and the account is
treated as lapsed until it succeeds.


=============================================================================
18. SETTINGS AND THE ACCOUNT MENU
=============================================================================

THE ACCOUNT MENU is the pill at the top right of every signed-in page. It
shows the name, the email address, the plan, the renewal or end date, and the
credit count, then:

  Settings.
  Mode, which switches between Auto, Light and Dark.
  Help and shortcuts, which opens the Help page.
  How Beatfall works, which reopens the welcome sheet.
  Sign out.

Auto mode follows the device's own light and dark setting.

SETTINGS is a panel over the board with four sections.

PROFILE holds the display name, the email address, the mode switch, the
structure new projects start on, and Delete account.

The email address is shown and cannot be edited. Write to support@beatfall.app
to change it.

The structure chosen here only affects projects made afterwards. Existing
projects keep theirs.

THIS MONTH holds the credit figures and the log described above.

PLAN AND BILLING holds the current plan, the renewal or end date, the buttons
that open Stripe, the top-up pack and Cancel.

YOUR DATA holds Download everything and links to the Privacy Policy and the
Terms.

DELETING AN ACCOUNT is at the bottom of Profile. It requires typing the
account's own email address and then confirming. It removes every project,
note, character, outline passage and picture, cancels a live subscription, and
removes the sign-in itself. It cannot be undone, and there is no grace period,
so Download everything first.

An account can also be deleted from the phone app, and from a signed-out page
at /delete.html using an emailed code. All three do the same thing.

Signing out ends the session in that browser only.
`;

const PART_5 = `
=============================================================================
19. THE PHONE APP
=============================================================================

The phone app is for capture. It is a real app for iPhone and Android, not the
website on a small screen, and it deliberately has no board on it.

WHAT IT DOES. Type or dictate one note, attach a picture to it, choose which
script it belongs to, and send them to the account when ready.

WHAT IT DOES NOT DO. No board, no dragging, no structure choice, no reading in
a file, no outline, no characters, no editing of anything already on a board.

SIGNING IN is the same six digit code as the website, on the same account.
Signing in on the phone does not sign the computer out. The one-browser rule
covers browsers only.

KEEP AND SEND ARE TWO DIFFERENT THINGS, and this is the part worth reading
twice.

Keep writes the note to the phone itself. It works with no signal. The box
stays focused so the next note can be typed straight away.

Send is a separate button that appears while anything is waiting, and it is
the only thing that moves notes to the account. Nothing sends by itself.

So the working pattern is: type, Keep, type, Keep, change script, Keep again,
and press Send when it suits. Kept notes stay on the phone through closing the
app, restarting the phone and losing signal.

A failed Send changes nothing and says so. The notes are still on the phone
and Send can be pressed again later.

DICTATION is the phone keyboard's own microphone, not a Beatfall feature.
Beatfall receives whatever the keyboard types.

CHOOSING A SCRIPT. The app lists the scripts on the account. It opens on
whichever was used last. A new script can be started from the phone by naming
it, which creates a named shell with no structure; the structure is chosen on
the computer before its notes are sorted.

PICTURES. A picture is attached to the note being written and goes with it on
Send. There is no separate picture mode and no second Keep.

WHERE NOTES ARRIVE. Sent notes land in the pending pile described in section
9. They do not change a board by themselves. The next visit on the computer
offers Place them myself, Read them for me, or Throw away.

Sending the same note twice cannot create two copies. Each note carries an id
made on the phone, and the account accepts each id once.

THE ACCOUNT SCREEN on the phone shows the signed-in address, how many notes
are waiting, the plan and credits, links to support, the Privacy Policy and
the Terms, Sign out, and Delete my account.

Deleting from the phone deletes the whole account, not the app's copy.


=============================================================================
20. SAVING, SESSIONS AND WHAT IS STORED
=============================================================================

SAVING IS AUTOMATIC. There is no Save button for a board. A change is written
shortly after it is made.

The one Save button in the product is in the Outline, and it closes a passage
and opens a fresh one rather than being the thing that saves.

IF SAVING FAILS, Beatfall says so rather than staying quiet. A strip appears
saying nothing has been lost and offering the work as a file to download. The
strip comes down once saving recovers. The browser also keeps a local copy as
a cushion.

ONE BROWSER AT A TIME. An account can edit Beatfall from one browser
installation at a time. Opening it in a second browser takes over, and the
first one blocks itself with a button to take the account back.

Tabs in the same browser are one browser. A different browser, or a different
computer, is a second one. The phone app is not covered by this rule.

WHAT IS STORED. The projects, cards, notes, characters, outline passages,
pictures, the account's own details, and a log of counts: how many credits
were spent on what, and when. The log records the kind of action and never the
words.

WHO CAN SEE IT. The database locks a writer's work to their account, so no
other Beatfall account can reach it. The ordinary admin tools can count cards
and cannot read them.

The hosting and storage providers necessarily process what is stored. Beatfall
personnel may reach a specific account's material only in the narrow
circumstances set out in the Privacy Policy and Terms: when the writer asks
for help, when legally required, or during a specific security or abuse
investigation.

Nothing written in Beatfall is used to train a model.

HOW LONG IT IS KEPT.

  While the account exists, the writing is kept.
  Pictures are removed 30 days after a plan ends. Text is not.
  An account with no sign-in and no live subscription for six months is
    deleted, with an emailed warning at five months and at least a month
    between that warning and the deletion.
  Deleting an account removes everything at once.

The Privacy Policy and the Terms are the authority on all of this, and the
billing page is the authority on the money.


=============================================================================
21. HELP AND HUMAN SUPPORT
=============================================================================

THE HELP BUBBLE sits in the bottom right corner of every page, signed in or
signed out. Pressing it opens a chat panel in place.

It answers questions about Beatfall in plain language, and it remembers the
conversation it is in, so a follow-up such as "so that is all I have to do?"
is understood against what was just said.

It cannot see the writer's projects, cards, notes or account. It answers
questions about how Beatfall works. It cannot look up a particular board, read
a note, check a payment or change anything.

THE HELP PAGE at /help.html holds the same material as short written answers,
grouped by topic, with a search box. It is reached from the account menu under
Help and shortcuts.

WHEN THE CHAT CANNOT ANSWER, it offers a support form rather than leaving the
question unanswered. That happens when the question needs someone to look at
the account, when it reports something broken, or when the answer is simply
not something Beatfall knows.

THE SUPPORT FORM can also be opened directly at any time. It asks:

  What kind of thing it is: something broken, cannot get in, lost work, a
    question about how to do something, plan or payment, a suggestion, privacy
    or data, or something else.
  Where it happened: signing in, dashboard, a board, the Outline, notes or
    pictures, characters, importing notes, the phone app, settings or billing,
    or somewhere else.
  What happened, in the writer's own words.
  An email address to reply to.

It sends to support@beatfall.app and replies go to the address given. The
page, the browser and whether the writer was signed in are attached
automatically so nobody has to be asked for them. Nothing else about the
account is attached, and no card, note or project is read to fill the form in.

WRITING DIRECTLY to support@beatfall.app works just as well. The form exists
because it asks the two questions that otherwise cost a round trip.

THERE ARE LIMITS on both, to keep an open endpoint from being abused: a small
number of questions an hour per person, and a smaller number of tickets. Both
reset within the hour and both say so when reached.

THE OTHER ADDRESSES. privacy@beatfall.app and legal@beatfall.app are in the
Privacy Policy and the Terms for requests of that kind. Sign-in codes and
deletion warnings come from noreply@beatfall.app, which is not read; replies to
it reach nobody.


=============================================================================
22. WHAT BEATFALL DELIBERATELY DOES NOT DO
=============================================================================

None of the following exists. A writer asking for one of these should be told
plainly that it is not there, and not sent to support to ask about it.

MERGE TWO PROJECTS. There is no way to merge projects, and no way to move a
card, a note or a character from one project to another. Two projects made by
mistake are handled by keeping the one being worked on and deleting the other,
or by copying the wording across by hand and then deleting it.

COLLABORATION. One account, one writer. There are no shared projects, no
invited collaborators, no comments, no roles and no team plan. Sharing work
means exporting a PDF and sending it.

WRITE THE SCRIPT. Beatfall organizes notes. It does not write scenes,
dialogue, action or a screenplay, and it has no screenplay editor and no
screenplay formatting. Nothing on a board becomes a script page.

REVISION HISTORY. Undo holds up to 30 steps in the current session only. There
are no earlier versions of a project, no snapshots, no restore points and no
way back to how a board looked yesterday. A deleted project is gone.

CUSTOM STRUCTURES. The nine are fixed. Beats cannot be added, removed,
renamed or reordered, and a structure of the writer's own cannot be built.

IMPORTING FROM OTHER APPS. Beatfall reads pasted text, .txt and .md files.
There is no import from Final Draft, Fountain, Word, Scrivener, Notion,
Google Docs or a Beatfall export, and no export to any of them beyond the PDF
and the JSON.

CALENDARS, DEADLINES AND REMINDERS. There are no due dates, no goals, no
streak targets other than the plain count on the dashboard, and no
notifications by email or on the phone.

THE BOARD ON A PHONE. The phone app captures notes. It does not show a board,
and a phone browser is sent to the app information rather than a cramped
board.

AUDIO. There is no recording and no transcription inside Beatfall. Dictation
on the phone is the phone keyboard's own.

CHANGING AN EMAIL ADDRESS, and refunding part of a period. Both are handled by
writing to support@beatfall.app rather than by a control in the product.
`;

export const MANUAL_TEXT = () => [PART_1, PART_2, PART_3, PART_4, PART_5].join('\n');
