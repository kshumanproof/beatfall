// ============================================================================
// EVERYTHING BEATFALL DOES, WRITTEN DOWN ONCE.
//
// This is the only description of how the product works, and two things read
// it: the help page a writer can browse, and the help chat that answers their
// question in their own words. One source, so the page and the answer can
// never disagree, which is the failure this file exists to prevent.
//
// It lives in api/ as a module rather than as a text file beside the page for
// the same reason api/_email/deletion-warning.js does: Vercel functions do not
// reliably ship sibling assets, and help that fails to load is worse than no
// help at all.
//
// HOW TO WRITE AN ENTRY.
//
//   `q` is the QUESTION A WRITER WOULD TYPE, in their words and not ours. It
//   is both the heading on the page and the thing the chat matches against, so
//   "Why can't I open the Outline?" earns its place and "Outline access
//   control" does not.
//
//   `a` is the answer, and it is the whole answer. The chat is told to answer
//   only from this file, so anything not written here is something it will
//   have to admit it does not know. That is the correct behaviour and it is
//   also the reason to be thorough.
//
//   `also` lists ids worth reading next.
//
// HOUSE RULES, same as everywhere else in Beatfall. Plain language. One idea
// per sentence. Never "AI", never "the model", never "Claude": the metered
// capability is "the writing help". No em dashes. Say what happens, not what
// the system is doing internally.
//
// WHEN THE PRODUCT CHANGES, CHANGE THIS. An answer that used to be true is
// worse than a missing one, because somebody will follow it.
// ============================================================================

export const HELP = [

// ------------------------------------------------------------ the basics --
{
  id: "what-is-beatfall",
  section: "Starting out",
  q: "What does Beatfall actually do?",
  a: "Beatfall turns a pile of notes into a beat board. You paste in whatever "
   + "you already have, however messy, and it works out which lines are story "
   + "beats and which are notes about characters, dialogue or research. The "
   + "beats go onto a board shaped by the structure you chose. Everything else "
   + "goes to the Notes page where you can still reach it.\n\n"
   + "The point of the board is not the cards on it. It is the gaps between "
   + "them: the beats nobody has written yet, which is what a board shows you "
   + "and a document never does.",
  also: ["first-project", "paste-notes"]
},
{
  id: "signing-in",
  section: "Starting out",
  q: "How do I sign in? I do not have a password.",
  a: "There is no password. Type your email address and Beatfall sends you a "
   + "six digit code, which you type into the same page. The code lasts an "
   + "hour.\n\n"
   + "It is a code rather than a link on purpose. A link signs in whichever "
   + "device opened your email, which is the wrong one about half the time. A "
   + "code signs in the machine you are sitting at.\n\n"
   + "If the email does not arrive, check the spam folder, then ask for "
   + "another. Each new code cancels the one before it, so use the newest.",
  also: ["wrong-device", "trial"]
},
{
  id: "trial",
  section: "Starting out",
  q: "How does the free trial work?",
  a: "Fourteen days, and no card. You get 25 credits to spend on the writing "
   + "help during that time. Everything that does not use the writing help is "
   + "free and stays free, including placing notes on the board yourself.\n\n"
   + "You are told a week before the trial ends and again two days before. "
   + "When it ends the boards close until you pick a plan. Nothing you wrote is "
   + "deleted, and you can download all of it at any point, including after "
   + "the trial has ended.",
  also: ["credits-what", "plan-ends", "download-everything"]
},
{
  id: "first-project",
  section: "Projects",
  q: "How do I add a new project?",
  a: "Press New project on the dashboard. The dashed box at the end of your "
   + "shelf does the same thing.\n\n"
   + "You will be asked for the format, and that is the only answer Beatfall "
   + "insists on, because it decides which beats your board has. A title and a "
   + "logline are optional and you can add them later.\n\n"
   + "Then choose one of two ways in. Start the board gives you an empty board "
   + "to fill yourself. Start from my notes opens the box where you paste what "
   + "you already have, and Beatfall reads it.",
  also: ["paste-notes", "structures", "project-details"]
},
{
  id: "project-details",
  section: "Projects",
  q: "How do I change a project's title, logline or genre?",
  a: "Press Details on the project card on the dashboard, or open the project "
   + "menu beside the title while you are on its board. Title, logline, who it "
   + "is about, genre and comparable films all live there.\n\n"
   + "Nothing an import does will ever rename a project you have named "
   + "yourself. Beatfall will only fill in a title that is still a placeholder "
   + "like Untitled.",
  also: ["logline-help", "structures"]
},
{
  id: "delete-project",
  section: "Projects",
  q: "How do I delete a project?",
  a: "Press Delete on its card on the dashboard. You will be asked to confirm, "
   + "and told how many cards go with it.\n\n"
   + "It cannot be undone, and it takes the board, the notes, the outline and "
   + "the characters with it. If you might want any of it later, use Download "
   + "everything in Settings first.\n\n"
   + "You can delete your last project. The shelf goes back to the dashed New "
   + "project box, the same as a new account.",
  also: ["download-everything", "undo"]
},
{
  id: "how-many-projects",
  section: "Projects",
  q: "Is there a limit on how many projects I can have?",
  a: "Sixty. If you reach it, delete one you have finished with. Nobody has "
   + "come close.",
  also: ["delete-project"]
},

// ------------------------------------------------------ getting notes in --
{
  id: "paste-notes",
  section: "Getting your notes in",
  q: "How do I get my existing notes into Beatfall?",
  a: "Open the project menu beside the title and choose Paste in your notes, "
   + "or choose Start from my notes when you create the project. Paste the "
   + "text, or drop in a .txt or .md file.\n\n"
   + "Beatfall reads the whole thing and shows you what it found before "
   + "anything touches your board: one row per note, each saying how it was "
   + "read and where it would go. You tick and untick, change any row, and "
   + "only then press Add to the board.\n\n"
   + "Reading a file costs 5 credits however long the file is.",
  also: ["review-sheet", "credits-what", "note-kinds"]
},
{
  id: "review-sheet",
  section: "Getting your notes in",
  q: "What is the sheet that appears after Beatfall reads my notes?",
  a: "It is everything Beatfall is proposing, before any of it happens. Each "
   + "row is one note, with a chip saying how it was read and a dropdown "
   + "saying where it would land. Change anything you disagree with.\n\n"
   + "A note you untick does not vanish. It goes to the pile of notes waiting "
   + "to be sorted, and it is there next time you sit down.\n\n"
   + "Nothing is added to your board until you press the button, and pressing "
   + "Back leaves your board exactly as it was.",
  also: ["paste-notes", "uncertain", "phone-pile"]
},
{
  id: "one-note",
  section: "Getting your notes in",
  q: "How do I add a single note?",
  a: "Type it into the bar under the header on any board, then press Place it. "
   + "Beatfall suggests where it belongs and you make the final call. That is "
   + "free and has no limit worth thinking about.\n\n"
   + "Press Enter to place it. Shift and Enter together give you a new line "
   + "without sending.\n\n"
   + "Or press Place it myself and choose the beat yourself, which does not "
   + "use the writing help at all.",
  also: ["uncertain", "credits-free"]
},
{
  id: "duplicates",
  section: "Getting your notes in",
  q: "What happens if the same note comes in twice?",
  a: "It is treated as one note. Beatfall ignores capitals, extra spaces, "
   + "curly quotes and a trailing full stop when deciding whether two notes "
   + "are the same, so a line you caught twice on your phone does not become "
   + "two cards.\n\n"
   + "The review sheet tells you when it has collapsed copies, and how many.",
  also: ["review-sheet", "phone-capture"]
},

// ------------------------------------------------------------- the board --
{
  id: "board-basics",
  section: "The board",
  q: "How does the beat board work?",
  a: "Each box on the board is one beat of your chosen structure, in order, "
   + "grouped into acts. A beat with a card in it is written. A beat with a "
   + "dashed gold edge and nothing in it is a hole, and those are the point.\n\n"
   + "A beat holds up to three cards. Drag a card to move it between beats.",
  also: ["move-card", "empty-beat", "structures"]
},
{
  id: "move-card",
  section: "The board",
  q: "How do I move a card to a different beat?",
  a: "Drag it, or use the move control on the card itself and pick the beat "
   + "from the list.\n\n"
   + "The small circle on a card marks the placement as settled. A filled "
   + "circle means you have decided, the card gets a gold edge, and nothing "
   + "Beatfall does later will move it.",
  also: ["board-basics", "lock-card", "undo"]
},
{
  id: "lock-card",
  section: "The board",
  q: "What does the padlock on a card do?",
  a: "It locks the card's words. A locked card cannot be edited or deleted "
   + "until you unlock it, which is there for a line you have got exactly "
   + "right and do not want to lose to a stray click.\n\n"
   + "The circle beside it is a different thing: that settles where the card "
   + "sits, not what it says.",
  also: ["move-card"]
},
{
  id: "card-controls-touch",
  section: "The board",
  q: "I am on a touchscreen and cannot see the controls on a card.",
  a: "You should. On any screen with no mouse, the delete, edit, move and "
   + "padlock controls stay visible rather than appearing when you hover.\n\n"
   + "They do not appear on the first tap, deliberately: a tap that only "
   + "reveals a control is a tap that did nothing, which is worse.\n\n"
   + "If they are genuinely missing, that is a fault and worth reporting.",
  also: ["small-screen"]
},
{
  id: "set-aside",
  section: "The board",
  q: "What is Set aside?",
  a: "A shelf beside the board for cards that look like beats but have nowhere "
   + "to go yet. Notes land there when Beatfall is not confident enough to "
   + "place them, and when a beat is already full.\n\n"
   + "Drag one onto a beat whenever you decide where it belongs. From the "
   + "Outline you can send it back again with Return to Set aside.\n\n"
   + "Set aside is for possible beats. Notes about characters, lines and "
   + "research live on the Notes page instead.",
  also: ["uncertain", "notes-page", "board-basics"]
},
{
  id: "uncertain",
  section: "The board",
  q: "Why did Beatfall not place my note?",
  a: "Because it was not sure enough, and a wrong beat costs you more than an "
   + "empty one.\n\n"
   + "When it is confident it places the card. When it is only fairly "
   + "confident it offers you the two beats it is choosing between and you "
   + "pick. When it is not confident it places nothing and the note goes to "
   + "Set aside, where you can put it wherever you like.\n\n"
   + "There is a separate case worth knowing: if it was sure but that beat "
   + "already holds three cards, the card goes to Set aside and says so. That "
   + "is a full beat, not a doubt.",
  also: ["set-aside", "board-basics"]
},
{
  id: "undo",
  section: "The board",
  q: "I made a mistake. How do I undo it?",
  a: "Control and Z, or Command and Z on a Mac. Beatfall remembers the last "
   + "thirty changes to your board, not just the most recent one.\n\n"
   + "Undo covers the board: placing, moving, deleting and structure changes. "
   + "It does not reach across to a project you have deleted, which is why "
   + "that one asks first.",
  also: ["delete-project", "shortcuts"]
},

// ------------------------------------------------ the writing help proper --
{
  id: "empty-beat",
  section: "Working on an empty beat",
  q: "What does “What's missing?” do?",
  a: "It starts a short conversation about that one empty beat. It asks you up "
   + "to five questions about what happens there, then offers a card built "
   + "from your answers. Nothing reaches your board until you approve it.\n\n"
   + "It knows which script it is in, what the beat is for, and who your "
   + "characters are, so the questions are about your story rather than about "
   + "screenwriting in general.\n\n"
   + "It costs 2 credits for the whole conversation, however many questions "
   + "you answer. Stopping early still costs the same 2, and answering all "
   + "five costs no more.",
  also: ["ideas", "credits-what", "gold-means"]
},
{
  id: "ideas",
  section: "Working on an empty beat",
  q: "What is the Ideas button?",
  a: "Three suggestions for what could happen in an empty beat, in one go, "
   + "with no questions first. It is the fastest thing in the app and it is "
   + "meant to be pressed without deliberating.\n\n"
   + "Take one, take none, or use one as a starting point and rewrite it. It "
   + "costs 2 credits whether you take one or not.",
  also: ["empty-beat", "credits-what"]
},
{
  id: "logline-help",
  section: "Working on an empty beat",
  q: "Can Beatfall help me write a logline?",
  a: "Yes. Open the project details and choose Answer questions for a logline. "
   + "It asks you a handful of questions about the story and then writes a "
   + "logline from your answers, which you can edit or throw away.\n\n"
   + "It costs 3 credits for the whole thing, questions and write-up together. "
   + "Typing your own logline in by hand is free.",
  also: ["project-details", "credits-what"]
},
{
  id: "gold-means",
  section: "Working on an empty beat",
  q: "What does the gold mean?",
  a: "Two related things, and they never conflict.\n\n"
   + "Gold text and gold dashed lines mean there is a gap here: an empty beat, "
   + "a count of what is missing.\n\n"
   + "A gold button means pressing it spends a credit. Every paid control in "
   + "Beatfall is a way out of one of those gaps, which is why it is the same "
   + "colour.\n\n"
   + "Blue means you can press it and it is free.",
  also: ["credits-what", "credits-free"]
},

// ------------------------------------------------------------ the notes --
{
  id: "notes-page",
  section: "Notes",
  q: "What is the Notes page for?",
  a: "Everything from your notes that is not a story beat. Characters, lines "
   + "of dialogue, images, clues, themes, open questions, research, and "
   + "pictures.\n\n"
   + "They are grouped by kind, and a group only appears when you have "
   + "something in it. Use the chips at the top to show one kind at a time.",
  also: ["note-kinds", "file-under-beat", "vision"]
},
{
  id: "note-kinds",
  section: "Notes",
  q: "What are the different kinds of note?",
  a: "Vision for pictures. Beat for something that happens. Character. Voice "
   + "and theme. Line, for a piece of dialogue. Image, for something you can "
   + "see. Clue or reveal. Structural idea. Open question. Rule you set, for "
   + "the rules of your world. Research.\n\n"
   + "Beatfall assigns one when it reads your notes, and you can change it on "
   + "any note with the dropdown on its card.",
  also: ["notes-page", "note-about"]
},
{
  id: "file-under-beat",
  section: "Notes",
  q: "Can I attach a note to a particular beat?",
  a: "Yes. Use Send this note to a beat on the note's card and choose the beat. "
   + "The note stays a note, and it also appears under that beat in the "
   + "Outline, where you are doing the writing.\n\n"
   + "It is not converted into a card and deleting the beat's card does not "
   + "destroy it. Return to Notes in the Outline sends it back.",
  also: ["notes-page", "outline"]
},
{
  id: "note-about",
  section: "Notes",
  q: "Can I say which character a note is about?",
  a: "On a note marked as a Character, yes. There is a dropdown that says This "
   + "note is about, listing the characters in that project.\n\n"
   + "Character notes are often one word, and “Skinny.” is not a "
   + "note until you know whose. The attribution shows on the note itself and "
   + "prints in the PDF. It does not change the Characters page.",
  also: ["characters", "note-kinds"]
},

// ----------------------------------------------------------------- vision --
{
  id: "vision",
  section: "Pictures",
  q: "What is Vision?",
  a: "Your pictures. A photograph in Beatfall is a note with a picture on it, "
   + "so it lives on the Notes page with everything else and behaves like any "
   + "other note: you can file it under a beat, search it, delete it and get "
   + "it back with undo.\n\n"
   + "The Vision group only appears once a project has a picture in it.",
  also: ["add-picture", "picture-character", "picture-pdf"]
},
{
  id: "add-picture",
  section: "Pictures",
  q: "How do I add a picture?",
  a: "Three ways, and all of them land in the same place.\n\n"
   + "Press Add pictures on the Notes page and choose files.\n\n"
   + "Drag image files onto the Notes page from your computer.\n\n"
   + "Paste a screenshot straight from your clipboard, anywhere in the app. "
   + "That one matters most: a frame grabbed from a film never touches your "
   + "disk, and pasting is what your hands do anyway.\n\n"
   + "You can also take or choose a picture on the phone app and send it with "
   + "your notes.",
  also: ["vision", "picture-phone", "picture-room"]
},
{
  id: "picture-character",
  section: "Pictures",
  q: "How do I put a picture on a character?",
  a: "Two ways. On a character's card there is a dashed box with a plus in it: "
   + "press that and choose a picture, and it goes onto that character and "
   + "into Vision at the same time.\n\n"
   + "Or on a picture already in Vision, use Use as a reference for and pick "
   + "the character.\n\n"
   + "A character wears one reference at a time. The x on the picture takes it "
   + "off that character and leaves the photograph in Vision, which is what "
   + "you want when you find a better one.",
  also: ["vision", "characters"]
},
{
  id: "picture-room",
  section: "Pictures",
  q: "How many pictures can I add?",
  a: "About 130 per account. Pictures are shrunk before they are stored, so "
   + "the limit is 40MB rather than a count, and most are around 300KB.\n\n"
   + "Beatfall tells you when you are close, and says so plainly if there is "
   + "no room left. Deleting pictures frees it up again within a day.",
  also: ["add-picture", "picture-private"]
},
{
  id: "picture-private",
  section: "Pictures",
  q: "Who can see my pictures?",
  a: "Only you. They are stored privately and shown through links that expire "
   + "within the hour, so a link that escaped your browser history stops "
   + "working the same afternoon. There is no public web address for any "
   + "picture you upload.\n\n"
   + "The location data your phone writes into a photograph is stripped before "
   + "it is stored. A picture taken in a bar does not record the bar.",
  also: ["vision", "picture-deleted"]
},
{
  id: "picture-deleted",
  section: "Pictures",
  q: "What happens to my pictures if I stop paying?",
  a: "Pictures are removed thirty days after a plan ends. Your writing is "
   + "not, ever.\n\n"
   + "The reason for the difference is weight. A board of text costs almost "
   + "nothing to keep forever, and photographs are the only part of a closed "
   + "account with real size to them. Download everything before then if you "
   + "want to keep them, and it includes the pictures.\n\n"
   + "Deleting your account removes every picture immediately.",
  also: ["plan-ends", "download-everything", "delete-account"]
},
{
  id: "picture-pdf",
  section: "Pictures",
  q: "Do pictures show up in the PDF?",
  a: "Yes, and each one exactly once. A picture filed under a beat prints "
   + "under that beat in the outline. A character's reference prints on their "
   + "block. Everything else prints as a contact sheet in a Vision section at "
   + "the back.",
  also: ["pdf", "vision"]
},

// ------------------------------------------------------------ characters --
{
  id: "characters",
  section: "Characters",
  q: "What is the Characters page?",
  a: "A sheet per character with ten fields: their name, the part they play, "
   + "who they are, what they want, what they need, the wound, the lie they "
   + "believe, what is in the way, how they change, and how they speak.\n\n"
   + "Filling them in is free. What they are for is the board: every "
   + "conversation about an empty beat reads your characters, so it can ask "
   + "about what is unresolved for your protagonist rather than about a "
   + "Midpoint in the abstract.",
  also: ["character-interview", "picture-character"]
},
{
  id: "character-interview",
  section: "Characters",
  q: "What is “Answer character questions”?",
  a: "An interview that fills in the blanks on a character sheet. It asks "
   + "about the fields you have left empty, up to ten of them, then writes "
   + "them up. Fields you have already filled in are left alone.\n\n"
   + "It costs 3 credits for the whole thing. Filling the sheet in yourself "
   + "costs nothing, and the more you fill in first the shorter the interview "
   + "gets.\n\n"
   + "Stopping after three questions still buys you those three answers.",
  also: ["characters", "credits-what"]
},

// --------------------------------------------------------------- outline --
{
  id: "outline",
  section: "The Outline",
  q: "What is the Outline?",
  a: "Your board as a document, in order, with a writing box under every beat. "
   + "It is where the prose happens once the shape is settled.\n\n"
   + "Each beat can hold several passages. Save closes the one you are in and "
   + "opens a fresh box underneath, because a beat is rarely one paragraph. "
   + "Cards and any notes you have filed under a beat show up beside the box "
   + "so you are writing with them in front of you.",
  also: ["outline-locked", "file-under-beat", "pdf"]
},
{
  id: "outline-locked",
  section: "The Outline",
  q: "Why can't I open the Outline?",
  a: "Because your board is not full yet. Every beat in your structure needs "
   + "at least one card before the Outline opens, and the locked button tells "
   + "you how many are still empty.\n\n"
   + "The reason is that an outline written around holes has to be rewritten "
   + "when the holes get filled. Shape first, prose second.\n\n"
   + "Once you have opened it, it stays open for that project even if the "
   + "board later goes incomplete. Nothing you have written is ever hidden "
   + "from you.",
  also: ["outline", "empty-beat"]
},
{
  id: "outline-unplaced",
  section: "The Outline",
  q: "What are Unplaced Outline passages?",
  a: "Prose that was written under a beat which no longer exists, almost "
   + "always because you changed the structure. Rather than delete it, "
   + "Beatfall puts it in a stack at the top of the Outline with a note of "
   + "which beat it came from, and you drag each passage to its new home.\n\n"
   + "Unplaced passages are counted in your word count and printed in the PDF, "
   + "so nothing is lost while it waits.",
  also: ["change-structure", "outline"]
},

// ------------------------------------------------------------------- pdf --
{
  id: "pdf",
  section: "Saving as a PDF",
  q: "How do I get my work out as a document?",
  a: "Save as PDF, from the project menu, or from the Finished button on a "
   + "completed card on the dashboard.\n\n"
   + "You get six sections: a cover, the board as a map, the outline in "
   + "reading order with every beat and its cards and prose, your characters, "
   + "anything set aside, and your loose notes. Pictures print where they "
   + "belong.\n\n"
   + "It builds in your browser, so nothing is uploaded to make it.",
  also: ["picture-pdf", "download-everything"]
},

// ------------------------------------------------------------ structures --
{
  id: "structures",
  section: "Structure",
  q: "Which story structures can I use?",
  a: "Nine. Save the Cat with fifteen beats and Classic Three-Act with nine, "
   + "both for features. The Story Circle in eight stages, for either. A short "
   + "film in eight beats. Two vertical shapes, one episode and a season arc. "
   + "And three for television: a broadcast hour with a teaser and four acts, "
   + "a streaming hour in five acts, and a half-hour comedy with a cold open, "
   + "three acts and a tag.\n\n"
   + "The format is the one thing you have to answer when you start a project, "
   + "because it decides which beats your board has.",
  also: ["change-structure", "first-project"]
},
{
  id: "change-structure",
  section: "Structure",
  q: "Can I change the structure after I have started?",
  a: "Yes, from the structure bar under the capture bar, and nothing is lost "
   + "when you do.\n\n"
   + "Your cards are scored against the new structure and moved to where they "
   + "fit. Any card that has nowhere to go lands in Set aside where you can "
   + "see it. Notes filed under a beat that no longer exists return to the "
   + "Notes page. Outline prose written under a missing beat goes to the "
   + "Unplaced stack for you to drag back.\n\n"
   + "Undo reverses the whole switch in one step.",
  also: ["structures", "outline-unplaced", "undo"]
},

// --------------------------------------------------------------- credits --
{
  id: "credits-what",
  section: "Credits",
  q: "What are credits and what do they cost?",
  a: "Credits pay for the writing help, and nothing else in Beatfall uses "
   + "them.\n\n"
   + "A conversation about an empty beat is 2. A set of ideas is 2. A logline "
   + "is 3. A character interview is 3. Reading in a file of notes is 5, "
   + "however long the file.\n\n"
   + "A plan gives you 75 a month. The trial gives you 25.",
  also: ["credits-free", "credits-reset", "topup"]
},
{
  id: "credits-free",
  section: "Credits",
  q: "What can I do without spending credits?",
  a: "Most of it. Placing a note on the board, including letting Beatfall "
   + "suggest where it goes. Writing and editing cards by hand. The whole "
   + "Outline. Filling in character sheets yourself. Adding, filing and "
   + "deleting pictures. Changing structure. Saving as a PDF. Downloading "
   + "everything.\n\n"
   + "If a control is blue it is free. Gold means it spends a credit.",
  also: ["gold-means", "credits-what"]
},
{
  id: "credits-reset",
  section: "Credits",
  q: "When do my credits reset?",
  a: "On your own day of the month, which is the day you signed up, not the "
   + "first of the month.\n\n"
   + "Whatever is left of that month's allowance does not roll over. Credits "
   + "you bought in a pack are different and never expire.",
  also: ["topup", "credits-what"]
},
{
  id: "topup",
  section: "Credits",
  q: "I have run out of credits. What now?",
  a: "Either wait for your reset day, or buy a pack: 25 credits for $6, from "
   + "Add credits in Settings.\n\n"
   + "Bought credits never expire and are only spent once the month's "
   + "allowance is gone, so a pack is never wasted by a reset.\n\n"
   + "Everything that does not use the writing help keeps working while you "
   + "are out. You can still write, place, move, outline and export.",
  also: ["credits-reset", "credits-free", "credits-warning"]
},
{
  id: "credits-warning",
  section: "Credits",
  q: "Will Beatfall warn me before I run out?",
  a: "Twice. A gold count appears on your account button when you are getting "
   + "low, which does not interrupt anything. A single strip appears near the "
   + "end, once per month, which you can dismiss.\n\n"
   + "They are counted down in credits left rather than up in a percentage, "
   + "because eight left tells you something and ninety per cent used does "
   + "not.",
  also: ["topup", "credits-what"]
},

// ------------------------------------------------------- plan and account --
{
  id: "what-it-costs",
  section: "Your plan",
  q: "What does Beatfall cost?",
  a: "$15 a month, or $149 a year, which is two months free. One plan, and it "
   + "is the same plan either way: 75 credits a month.\n\n"
   + "Before that, fourteen days free with no card.",
  also: ["trial", "credits-what", "switch-annual"]
},
{
  id: "switch-annual",
  section: "Your plan",
  q: "Can I switch between monthly and yearly?",
  a: "Yes, from Plan and billing in Settings. Your allowance does not change, "
   + "only what you pay and how often.\n\n"
   + "An annual plan draws the same 75 credits a month rather than 900 at "
   + "once, and they expire on your reset day like anybody else's.",
  also: ["what-it-costs", "credits-reset"]
},
{
  id: "cancel",
  section: "Your plan",
  q: "How do I cancel?",
  a: "Settings, Plan and billing, Cancel plan. Beatfall tells you exactly what "
   + "happens first and asks you to tick that you have read it, with a button "
   + "to download your work right there. Then it hands you to Stripe's own "
   + "cancel screen.\n\n"
   + "Your plan runs to the end of the period you have paid for. After that "
   + "the boards close. Your writing is not deleted, you can still download "
   + "all of it, and everything is exactly where you left it if you come back. "
   + "Pictures come off after thirty days.",
  also: ["plan-ends", "download-everything", "picture-deleted"]
},
{
  id: "plan-ends",
  section: "Your plan",
  q: "What happens when my plan or trial ends?",
  a: "The boards close and you get a screen with two things on it: pick a "
   + "plan, or download everything.\n\n"
   + "Nothing is deleted. Every project is listed on that screen and each one "
   + "can still be saved as a PDF. Any credits you bought are still there when "
   + "you come back.\n\n"
   + "Pictures are removed thirty days later. The writing is not.",
  also: ["download-everything", "picture-deleted", "cancel"]
},
{
  id: "download-everything",
  section: "Your account",
  q: "How do I get all my work out of Beatfall?",
  a: "Settings, Your data, Download everything. It is one file with every "
   + "project, board, note, character, outline passage and picture in it.\n\n"
   + "It works whether or not you have a plan, on purpose. Closing the boards "
   + "is a business decision and holding your notes hostage is a different "
   + "thing.\n\n"
   + "For a readable document rather than a data file, use Save as PDF on each "
   + "project.",
  also: ["pdf", "plan-ends", "delete-account"]
},
{
  id: "delete-account",
  section: "Your account",
  q: "How do I delete my account?",
  a: "Settings, Your account, Delete my account. You type your email address "
   + "to confirm. The phone app has the same thing on its account screen, and "
   + "there is a page on the website that works even if you have uninstalled "
   + "everything.\n\n"
   + "It cancels any subscription, then removes every project, note, "
   + "character, outline and picture, immediately and permanently. It cannot "
   + "be undone.\n\n"
   + "Download everything first if there is any doubt.",
  also: ["download-everything", "picture-deleted"]
},
{
  id: "abandoned",
  section: "Your account",
  q: "Will my work be deleted if I do not use Beatfall for a while?",
  a: "Only after six months with no sign-in and no subscription, and you are "
   + "emailed a month before it happens. Signing in once resets the clock.\n\n"
   + "If that warning email cannot be delivered, nothing is deleted.",
  also: ["delete-account", "download-everything"]
},
{
  id: "change-email",
  section: "Your account",
  q: "Can I change my email address or my name?",
  a: "Your display name is in Settings, under Profile.\n\n"
   + "Changing the email address the account signs in with is not something "
   + "you can do yourself yet. Write to support@beatfall.app and it can be "
   + "done for you.",
  also: ["signing-in", "contact"]
},
{
  id: "dark-mode",
  section: "Your account",
  q: "Can I use Beatfall in dark mode?",
  a: "Yes. The setting is in the account menu at the top right: Light, Dark or "
   + "Auto, which follows whatever your computer is set to.",
  also: []
},

// --------------------------------------------------------------- the phone --
{
  id: "phone-what",
  section: "The phone app",
  q: "What does the Beatfall phone app do?",
  a: "It catches notes, and that is all it does on purpose. There is no board "
   + "on the phone, because dragging cards around a phone screen is not a "
   + "thing anybody wants to do.\n\n"
   + "You open it, the cursor is already blinking, you type or dictate the "
   + "thought, and you press Keep. Later you press Send and it goes to your "
   + "account, where it waits until you sit down at your computer.\n\n"
   + "It uses the same account and the same sign-in code as the website.",
  also: ["phone-capture", "phone-send", "phone-pile"]
},
{
  id: "phone-capture",
  section: "The phone app",
  q: "How do I catch a note on my phone?",
  a: "Type it in the box and press Keep. The note is written to your phone's "
   + "own storage before the screen says it is kept, so it survives no signal, "
   + "a flat battery and a force quit.\n\n"
   + "Above the box is the script the note will be filed under. Press Change "
   + "to pick a different one, or to start a new one by name. That choice is "
   + "remembered until you change it.\n\n"
   + "Nothing sends by itself. Notes stay on the phone until you press Send.",
  also: ["phone-send", "phone-offline", "phone-title"]
},
{
  id: "phone-title",
  section: "The phone app",
  q: "Can I start a new script from my phone?",
  a: "Yes. Press Change above the box and type a working title. You can catch "
   + "notes against it straight away, even with no signal.\n\n"
   + "It becomes a real script on your account the first time you press Send. "
   + "You choose its structure at your computer, before the notes get sorted "
   + "onto a board.",
  also: ["phone-capture", "first-project"]
},
{
  id: "phone-send",
  section: "The phone app",
  q: "How do my phone notes get to my computer?",
  a: "Press the Send button, which appears at the bottom of the screen "
   + "whenever anything is waiting and says how many.\n\n"
   + "They do not go to a board. They wait in a pile on your account, and the "
   + "next time you open Beatfall at your desk it tells you what came in and "
   + "asks where you want it.\n\n"
   + "Send is the only thing that sends. Nothing leaves the phone on its own, "
   + "so you can catch five notes, switch scripts, catch three more, and they "
   + "all go when you say.",
  also: ["phone-pile", "phone-offline"]
},
{
  id: "phone-offline",
  section: "The phone app",
  q: "Does the phone app work with no signal?",
  a: "Yes, and that is the whole reason it exists as an app rather than a "
   + "website. Notes are saved to the phone itself the moment you press Keep. "
   + "A note typed in a car park with no bars is still there tomorrow.\n\n"
   + "Send needs a connection. If it fails, nothing is lost: the notes stay "
   + "where they are and you press Send again when you have signal.",
  also: ["phone-capture", "phone-send"]
},
{
  id: "picture-phone",
  section: "The phone app",
  q: "Can I send a photograph from my phone?",
  a: "Yes. Under the box there are two buttons: Photo takes one with the "
   + "camera, Library picks one you already have. It attaches to the note you "
   + "are writing, and you can add a line about it or leave it with no words "
   + "at all.\n\n"
   + "The picture is shrunk and saved to your phone before anything is sent, "
   + "so it survives having no signal exactly like a typed note does. It goes "
   + "when you press Send, and arrives in Vision on the script you filed it "
   + "under.\n\n"
   + "Sending pictures needs an active plan. Typed notes always come through.",
  also: ["vision", "phone-send", "plan-ends"]
},
{
  id: "phone-delete",
  section: "The phone app",
  q: "How do I throw away a note on my phone?",
  a: "Press and hold it in the list, then confirm. If it has a picture the "
   + "picture goes too.\n\n"
   + "A note you have already sent is also removed from your account when you "
   + "throw it away on the phone.",
  also: ["phone-capture"]
},
{
  id: "phone-gone",
  section: "The phone app",
  q: "My phone notes disappeared after I sent them.",
  a: "That is correct, and it is deliberate. Once a note is safely on your "
   + "account the phone lets go of it, because this app is not an archive and "
   + "a second pile to read through is the thing Beatfall exists to end.\n\n"
   + "The list says so: nothing waiting means everything you caught is on your "
   + "account, ready to sort at your desk.",
  also: ["phone-send", "phone-pile"]
},

// --------------------------------------------- what the desk does with them --
{
  id: "phone-pile",
  section: "Notes from your phone",
  q: "Where do my phone notes go when I get to my computer?",
  a: "Into a pile, grouped by script. The dashboard shows a count, and if you "
   + "have been away more than half a day Beatfall greets you with what came "
   + "in.\n\n"
   + "Nothing has touched a board. For each group you choose: place them "
   + "yourself, which is free and gives you one row per note with a dropdown, "
   + "or have them read, which costs 5 credits and sorts them the way an "
   + "imported file is sorted. Or throw the whole group away.\n\n"
   + "Pictures never go through the paid read. They go straight into Vision on "
   + "that script, because there is nothing in a photograph to read.",
  also: ["phone-send", "review-sheet", "vision"]
},

// ------------------------------------------- the rules that surprise people --
{
  id: "one-browser",
  section: "Rules worth knowing",
  q: "Why was I signed out when I opened Beatfall somewhere else?",
  a: "An account edits Beatfall in one browser at a time. Open it on another "
   + "computer and the first one stops and tells you, with a button to make "
   + "itself active again.\n\n"
   + "This is not about sharing. It is about two browsers holding different "
   + "versions of the same board and overwriting each other's work. Tabs in "
   + "the same browser are one browser and do not conflict.\n\n"
   + "The phone app is exempt. Catching notes on your phone never closes the "
   + "board you left open at home.",
  also: ["conflict", "phone-what"]
},
{
  id: "small-screen",
  section: "Rules worth knowing",
  q: "Why won't the board open on my phone?",
  a: "Because a beat board is a spatial thing and there is no honest way to "
   + "drag cards around a phone screen. Rather than give you a cramped version "
   + "of the real product, Beatfall shows you the phone app instead, which is "
   + "built for a phone.\n\n"
   + "Tablets are fine. So are touchscreen laptops. The legal pages, the "
   + "billing page and signing up all work on a phone.",
  also: ["phone-what", "card-controls-touch"]
},
{
  id: "wrong-device",
  section: "Rules worth knowing",
  q: "I opened my sign-in email on my phone and now my laptop is not signed in.",
  a: "Sign-in is per browser, so the code signs in whatever you typed it "
   + "into.\n\n"
   + "Your account is fine. Ask for a new code from the computer you want to "
   + "use and type it there. Nothing is lost and the account already exists.",
  also: ["signing-in", "one-browser"]
},
{
  id: "conflict",
  section: "Rules worth knowing",
  q: "Beatfall says my changes conflict with a saved version.",
  a: "Two browsers began with the same version of a project and both tried to "
   + "save. Rather than quietly overwrite one of them, Beatfall stops and asks "
   + "you.\n\n"
   + "Save my changes as a copy keeps both: the newer saved version stays, and "
   + "your work becomes a second project with “recovered copy” in "
   + "the name. Discard my changes throws away what is in front of you and "
   + "keeps what was saved.\n\n"
   + "Nothing is decided until you choose, and your work stays in the browser "
   + "until it is.",
  also: ["one-browser", "save-failed"]
},

// ------------------------------------------------------ when things break --
{
  id: "save-failed",
  section: "When something goes wrong",
  q: "Beatfall says it cannot save my work.",
  a: "A strip appears across the top saying so, and it hands you the whole "
   + "project as a file to download so nothing is trapped in a browser tab. "
   + "The strip goes away by itself once saving recovers.\n\n"
   + "Usually this is the connection. Keep the tab open, because your work is "
   + "still in it, and it will save itself when the connection comes back.",
  also: ["conflict", "download-everything"]
},
{
  id: "no-answer",
  section: "When something goes wrong",
  q: "The writing help says it couldn't get an answer.",
  a: "Something upstream was busy or unreachable. No credits are charged for a "
   + "request that failed, so trying again in a moment costs you nothing.\n\n"
   + "If it keeps happening, write to support@beatfall.app and say which "
   + "button you pressed.",
  also: ["contact", "credits-what"]
},
{
  id: "missing-cards",
  section: "When something goes wrong",
  q: "Some of my notes are not on the board.",
  a: "Look on the Notes page and on the Set aside shelf first. Most notes in a "
   + "file are not beats, so they land on Notes by design, and beats Beatfall "
   + "was unsure about land on Set aside.\n\n"
   + "The review sheet you saw before anything was added says exactly what "
   + "went where and how many were collapsed as copies.\n\n"
   + "If a note is genuinely nowhere, that is a fault and worth reporting with "
   + "the project name.",
  also: ["notes-page", "set-aside", "review-sheet", "contact"]
},
{
  id: "shortcuts",
  section: "When something goes wrong",
  q: "What keyboard shortcuts are there?",
  a: "Control or Command with Z undoes the last board change, up to thirty "
   + "deep.\n\n"
   + "Enter places a note or sends an answer. Shift with Enter gives a new "
   + "line without sending.\n\n"
   + "Escape closes whatever is open: a menu, a sheet, or a conversation.",
  also: ["undo"]
},
{
  id: "contact",
  section: "When something goes wrong",
  q: "How do I contact a human?",
  a: "support@beatfall.app. Say what you were trying to do, what happened "
   + "instead, and which page you were on. If it is about a particular "
   + "project, the name of it helps.\n\n"
   + "Beatfall is run by one person, so an answer may take a day.",
  also: []
},
{
  id: "my-material",
  section: "When something goes wrong",
  q: "What happens to my writing? Is it used to train anything?",
  a: "No. Your material is yours, it is not used to train anything, and it is "
   + "not shown to other people.\n\n"
   + "When you use the writing help, the part of your project it needs is sent "
   + "to the company that provides it so it can answer. The Privacy Policy "
   + "names them and says exactly what is sent. Everything else stays on your "
   + "account.",
  also: ["download-everything", "contact"]
}

];

/* The sections, in the order the help page shows them. Kept here rather than
   derived from the entries so the running order is a decision somebody made
   rather than a side effect of what happened to be written first. */
export const SECTIONS = [
  "Starting out",
  "Projects",
  "Getting your notes in",
  "The board",
  "Working on an empty beat",
  "Notes",
  "Pictures",
  "Characters",
  "The Outline",
  "Saving as a PDF",
  "Structure",
  "Credits",
  "Your plan",
  "Your account",
  "The phone app",
  "Notes from your phone",
  "Rules worth knowing",
  "When something goes wrong"
];
