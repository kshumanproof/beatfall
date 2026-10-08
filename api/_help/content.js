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
  a: "Beatfall organizes your notes into a story structure and shows which beats still need work. Story beats appear on the board. Character notes, dialogue and research remain on the Notes page.",
  also: ["first-project", "paste-notes"]
},
{
  id: "signing-in",
  section: "Starting out",
  q: "How do I sign in? I do not have a password.",
  a: "Enter your email address to receive a six-digit code. Enter that code on the device where you want to use Beatfall. It expires after one hour.\n\nIf it does not arrive, check your spam folder or request a new code. Use the newest code.",
  also: ["wrong-device", "trial"]
},
{
  id: "trial",
  section: "Starting out",
  q: "How does the free trial work?",
  a: "Your free trial lasts 14 days and includes 25 credits. No payment card is required.\n\nWhen it ends, subscribe to continue editing. You can still download your project data and project PDFs.",
  also: ["credits-what", "plan-ends", "download-everything"]
},
{
  id: "first-project",
  section: "Projects",
  q: "How do I add a new project?",
  a: "Select New project, then choose a format and story structure. You can add a title and logline now or later.\n\nChoose Start the board for an empty board, or Start from my notes to import existing notes.",
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
  a: "Select Delete on the project's dashboard card and confirm. This deletes its cards, notes, outline, character information and pictures.\n\nDownload your work first if you want to keep a copy.",
  also: ["download-everything", "undo"]
},
/* Kris asked this one of the help chat on 24 September and nothing here
   covered it. Two projects where there should be one is an ordinary thing to
   do by accident, from a double press or from the phone, and the honest
   answer is short. Written down so the desk stops treating a real answer as a
   gap it has to apologise for. */
{
  id: "merge-projects",
  section: "Projects",
  q: "Can I merge two projects into one? I duplicated one by mistake.",
  a: "Beatfall cannot merge projects. Review both projects and copy any work you want to keep into one before deleting the other.\n\nDownload their project data first if you want a backup.",
  also: ["delete-project", "download-everything", "duplicates"]
},
{
  id: "how-many-projects",
  section: "Projects",
  q: "Is there a limit on how many projects I can have?",
  a: "You can have up to 60 projects. If you reach the limit, download any work you want to keep before deleting a project.",
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
   + "Importing up to 1,000 notes costs 5 credits. Split larger collections into separate imports. Each import costs 5 credits.",
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
  a: "Type a note and select Place it to see a suggested beat, or Place it myself to choose one. Neither uses credits.\n\nEnter submits the note; Shift+Enter adds a new line.",
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
  a: "Each box represents a beat in your chosen structure. Empty beats show where your story still needs development. Each beat holds up to three cards.\n\nDrag a card to move it between beats.",
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
  a: "The padlock keeps a card in its current location. Unlock it to move it. You can still edit its text or delete it after confirming.",
  also: ["move-card"]
},
{
  id: "card-controls-touch",
  section: "The board",
  q: "I am on a touchscreen and cannot see the controls on a card.",
  a: "Card controls should remain visible on touchscreens. If the edit, move, delete or lock controls are missing, contact support.",
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
  a: "Beatfall may leave a note in Set aside when its placement is uncertain or the suggested beat already holds three cards. You can move it onto a beat yourself.",
  also: ["set-aside", "board-basics"]
},
{
  id: "undo",
  section: "The board",
  q: "I made a mistake. How do I undo it?",
  a: "Press Ctrl+Z, or Cmd+Z on Mac, to undo board changes. Beatfall keeps up to 30 undo steps while the page remains open. Undo does not restore a deleted project.",
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
  a: "Ideas offers three possible directions for an empty beat. Choose one, revise one or leave them all. A set costs 2 credits, whether you use a suggestion or not.",
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
  a: "Gold dashed borders identify empty beats. Gold writing-help buttons use credits. Check the displayed cost before continuing.",
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
  a: "On a Character note, use This note is about to select a character. The selected name appears on the note and in the PDF. This does not change the character's profile.",
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
  a: "Select Add pictures on the Notes page, drag in image files or paste a picture from your clipboard. You can also send pictures from the phone app.",
  also: ["vision", "picture-phone", "picture-room"]
},
{
  id: "picture-character",
  section: "Pictures",
  q: "How do I put a picture on a character?",
  a: "On a character's card, select the picture box and choose a picture. You can also select Use as a reference for on a picture in Vision and choose the character.\n\nEach character can have one reference picture. Select the × to remove the reference from the character. The picture remains in Vision.",
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
  a: "Pictures are stored privately. Beatfall uses temporary links to display them. Anyone with a working link may view its picture until the link expires. Embedded location data is removed before storage.",
  also: ["vision", "picture-deleted"]
},
{
  id: "picture-deleted",
  section: "Pictures",
  q: "What happens to my pictures if I stop paying?",
  a: "Photos are deleted 30 days after your subscription ends. Their notes and captions remain, subject to the inactive-account policy.\n\nThe project-data download does not include picture files. Download project PDFs containing your pictures before the deadline.\n\nDeleting your account removes its pictures.",
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
  a: "Answer up to ten questions about empty fields, then use Fill in the blanks to create suggested text. Existing fields remain unchanged. The session costs 3 credits, even if you stop early.",
  also: ["characters", "credits-what"]
},

// --------------------------------------------------------------- outline --
{
  id: "outline",
  section: "The Outline",
  q: "What is the Outline?",
  a: "The Outline presents your story in beat order, with space to write under each beat. Your cards and attached notes appear alongside the writing fields.\n\nEach beat can hold several passages. Select Save to finish a passage and open a new writing field.",
  also: ["outline-locked", "file-under-beat", "pdf"]
},
{
  id: "outline-locked",
  section: "The Outline",
  q: "Why can't I open the Outline?",
  a: "Every beat needs at least one card before the Outline first opens. The button shows how many beats remain empty.\n\nOnce opened, the Outline stays available for that project, even if you later remove cards.",
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
  section: "Downloading PDFs",
  q: "How do I get my work out as a document?",
  a: "Download PDF, from the project menu, or from the Finished button on a "
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
   + "for up to 1,000 notes. Split larger collections into separate imports. Each import costs 5 credits.\n\n"
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
   + "deleting pictures. Changing structure. Downloading PDFs. Downloading "
   + "everything.\n\n"
   + "If a control is blue it is free. Gold means it spends a credit.",
  also: ["gold-means", "credits-what"]
},
{
  id: "credits-reset",
  section: "Credits",
  q: "When do my credits reset?",
  a: "Your monthly allowance resets on the day of the month you signed up. Unused monthly credits do not roll over.\n\nPurchased credits are used after your monthly allowance and do not expire while your account remains open.",
  also: ["topup", "credits-what"]
},
{
  id: "topup",
  section: "Credits",
  q: "I have run out of credits. What now?",
  a: "Wait until your monthly allowance resets, or select Add credits in Settings to buy 25 credits for $6.\n\nPurchased credits are used after your monthly allowance and do not expire while your account remains open.\n\nWhile your trial or subscription is active, you can continue editing, placing notes and downloading your work without credits.",
  also: ["credits-reset", "credits-free", "credits-warning"]
},
{
  id: "credits-warning",
  section: "Credits",
  q: "Will Beatfall warn me before I run out?",
  a: "A credit count appears on your account button when your balance is low. A dismissible notice also appears when you are close to running out.",
  also: ["topup", "credits-what"]
},

// ------------------------------------------------------- plan and account --
{
  id: "what-it-costs",
  section: "Your plan",
  q: "What does Beatfall cost?",
  a: "Beatfall costs $15 per month or $149 per year. Both include 75 credits each month. The annual plan saves $31 compared with paying monthly for a year.\n\nNew accounts receive a 14-day free trial with no payment card required.",
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
  a: "Open Settings → Plan and billing → Cancel plan. Review the information, then continue to Stripe to confirm cancellation.\n\nAccess continues until your paid period ends. After that, you can download your work but cannot edit projects. Photos are deleted after 30 days.",
  also: ["plan-ends", "download-everything", "picture-deleted"]
},
{
  id: "plan-ends",
  section: "Your plan",
  q: "What happens when my plan or trial ends?",
  a: "When your trial or subscription ends, you can download project data and project PDFs but cannot edit projects.\n\nPhotos are deleted after 30 days. Accounts without an active subscription are deleted after six months without a sign-in.",
  also: ["download-everything", "picture-deleted", "cancel"]
},
{
  id: "download-everything",
  section: "Your account",
  q: "How do I get all my work out of Beatfall?",
  a: "Open Settings → Your work → Download project data. The file contains project details, cards, notes, outlines and character information. Picture files are not included.\n\nYou can download this file without an active subscription. For a readable copy, use Download PDF on a project.",
  also: ["pdf", "plan-ends", "delete-account"]
},
{
  id: "delete-account",
  section: "Your account",
  q: "How do I delete my account?",
  a: "Download any work you want to keep before deleting your account. In Settings, select Delete my account. Enter your account email address and confirm deletion.\n\nAccount deletion cancels your subscription and removes your account contents. This cannot be undone.",
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
  a: "Open the account menu and select Appearance to switch between Light, Dark and Auto. Auto uses light during the day and dark at night.",
  also: []
},

// --------------------------------------------------------------- the phone --
{
  id: "phone-what",
  section: "The phone app",
  q: "What does the Beatfall phone app do?",
  a: "The phone app lets you collect typed notes, dictated notes and pictures. Use a computer or tablet to work on the beat board.\n\nPress Keep to save a note on your phone. Press Send to send saved notes to your account. It uses the same account as the website.",
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
  a: "Press Keep to save a note on your phone. You can collect notes without an internet connection. Sending them to your account requires a connection.\n\nIf sending fails, the notes remain on your phone for another attempt.",
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
  q: "How do I delete a note on my phone?",
  a: "Press and hold the note, then confirm deletion. Its attached picture is also deleted.",
  also: ["phone-capture"]
},
{
  id: "phone-gone",
  section: "The phone app",
  q: "My phone notes disappeared after I sent them.",
  a: "After a note is successfully sent to your account, it is removed from the phone's waiting list. Open Beatfall on your computer to review and sort it.",
  also: ["phone-send", "phone-pile"]
},

// --------------------------------------------- what the desk does with them --
{
  id: "phone-pile",
  section: "Notes from your phone",
  q: "Where do my phone notes go when I get to my computer?",
  a: "Your phone notes wait on your account, grouped by project. On your computer, review each group and choose whether to place the notes yourself for free or have Beatfall read them for 5 credits. You can also delete a group.\n\nPictures are added to Vision without using the paid note-reading feature. Beatfall does not analyze their contents.",
  also: ["phone-send", "review-sheet", "vision"]
},

// ------------------------------------------- the rules that surprise people --
{
  id: "one-browser",
  section: "Rules worth knowing",
  q: "Why was I signed out when I opened Beatfall somewhere else?",
  a: "Only one browser can edit your account at a time. Opening Beatfall in another browser pauses editing in the first to reduce conflicting saves. The phone app can collect notes while your board remains open.",
  also: ["conflict", "phone-what"]
},
{
  id: "small-screen",
  section: "Rules worth knowing",
  q: "Why won't the board open on my phone?",
  a: "The beat board requires a computer or tablet. On a phone, use the Beatfall app to collect notes and pictures. Sign-in, billing and legal pages remain available in your phone's browser.",
  also: ["phone-what", "card-controls-touch"]
},
{
  id: "wrong-device",
  section: "Rules worth knowing",
  q: "I opened my sign-in email on my phone and now my laptop is not signed in.",
  a: "Enter the sign-in code in the browser where you want to use Beatfall. If necessary, request a new code from that browser and use the newest code.",
  also: ["signing-in", "one-browser"]
},
{
  id: "conflict",
  section: "Rules worth knowing",
  q: "What happens if I have the same project open in two places?",
  a: "Only one browser can edit an account at a time. Opening Beatfall "
   + "somewhere else takes over, and the first one blocks itself with a button "
   + "to take the account back.\n\n"
   + "Within that, the last save wins. A tab that has been sitting in the "
   + "background reloads before it is allowed to save, so an old copy cannot "
   + "land on top of newer work.\n\n"
   + "Tabs in the same browser are one browser. Your phone is not counted: the "
   + "app only adds notes and can never overwrite a board.",
  also: ["one-browser", "save-failed"]
},

// ------------------------------------------------------ when things break --
{
  id: "save-failed",
  section: "When something goes wrong",
  q: "Beatfall says it cannot save my work.",
  a: "If saving continues to fail, a notice appears at the bottom of the page with a Download a copy button.\n\nKeep the tab open while Beatfall retries, and download a backup of your current work. The notice disappears when saving succeeds.",
  also: ["conflict", "download-everything"]
},
{
  id: "no-answer",
  section: "When something goes wrong",
  q: "The writing help says it couldn't get an answer.",
  a: "Please try again. A failed request does not charge credits, but a successful retry may use credits.\n\nIf the problem continues, email support@beatfall.app and tell us which feature you used.",
  also: ["contact", "credits-what"]
},
{
  id: "missing-cards",
  section: "When something goes wrong",
  q: "Some of my notes are not on the board.",
  a: "Check the Notes page and Set aside first. Notes may be stored there instead of placed on a beat.\n\nIf you still cannot find a note, contact support with the project name.",
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
  q: "How do I contact support?",
  a: "Email support@beatfall.app. Include what you were trying to do, what happened, the page you were using and the project name if relevant.",
  also: []
},
{
  id: "my-material",
  section: "When something goes wrong",
  q: "What happens to my writing? Is it used to train anything?",
  a: "You retain ownership of your writing. When you use writing help, relevant project text is sent to OpenAI to generate a response.\n\nSee the Privacy Policy for information about training, retention and the limited circumstances in which Beatfall may access your work.",
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
  "Downloading PDFs",
  "Structure",
  "Credits",
  "Your plan",
  "Your account",
  "The phone app",
  "Notes from your phone",
  "Rules worth knowing",
  "When something goes wrong"
];
