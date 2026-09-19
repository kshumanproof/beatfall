/* The product itself, not tonight's changes: placing a note, the notes shelf,
   characters, the outline, structure switching, undo, and the PDF. */
const { chromium } = require('playwright');
const path = require('path');
const PAGE = 'file://' + path.resolve('stub.html');

const STC = ['open','theme','setup','cat','debate','br2','bstory','fun','mid','bad','lost','dark','br3','fin','last'];

function board(name, filled, extra = {}) {
  return Object.assign({
    id: 'p-' + name.toLowerCase().replace(/\W/g,''), name, structure: 'stc',
    brief: {log: 'A driver takes one job too many.', who: 'Dale', genre: 'crime'},
    outline: {}, characters: [], is_sample: false, created_from: 'new_project',
    updated_at: '2026-09-01T00:00:00Z',
    cards: STC.slice(0, filled).map((s, i) => ({id: i+1, text: 'the card for ' + s, slot: s, pinned: true}))
  }, extra);
}

/* Dates here are relative on purpose. This fixture used to carry a fixed
   1 October, which meant every test that depends on "how far away is the
   renewal" would quietly change meaning as real time passed it, and then start
   failing on a day nobody had touched the code. The allowance comes from the
   same place the app does, so moving the plan does not break the suite. */
const inDays = n => new Date(Date.now() + n * 86400000).toISOString();
const ALLOW = 100;

const PAID = {email:'w@example.com', display_name:'Writer', plan:'beatfall', unlimited:false,
  trialing:false, credits_left:ALLOW, credits_allowance:ALLOW, credits_banked:0,
  current_period_end:inDays(21), has_history:true, cancel_at_period_end:false,
  plans:{beatfall:{credits:ALLOW,price:12}}, price_month:12, price_year:99,
  topup_credits:40, topup_price:6};

const results = [];
function check(name, ok, detail) {
  results.push({name, ok, detail});
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || !detail ? '' : '\n          ' + detail));
}

async function open(browser, projects, account = PAID) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/ERR_TUNNEL|ERR_FILE_NOT_FOUND|ERR_NAME_NOT_RESOLVED|favicon/.test(t))
      errors.push('console: ' + t);
  });
  await page.addInitScript(([a, p]) => { window.__ACCOUNT__ = a; window.__PROJECTS__ = p; }, [account, projects]);
  await page.goto(PAGE);
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const fr = document.getElementById('firstrun'); if (fr) fr.hidden = true;
    if (state.projects.length) { state.activeId = state.projects[0].id; setView('board', true); }
  });
  await page.waitForTimeout(250);
  return { page, errors };
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ------------------------------------------------- placing one note
  {
    const { page, errors } = await open(browser, [board('Night Haul', 6)]);
    const before = await page.evaluate(() => P().cards.length);
    await page.evaluate(() => {
      const i = document.getElementById('note');
      i.value = 'Dale finds the second set of keys taped under the bumper.';
      i.dispatchEvent(new Event('input'));
    });
    const state1 = await page.evaluate(() => ({
      placeEnabled: !document.getElementById('place').disabled,
      more: !document.getElementById('capturemore').hidden
    }));
    check('a normal note leaves Place it live', state1.placeEnabled);
    check('and raises no long-note offer', state1.more === false);

    // the ceiling
    await page.evaluate(() => {
      const i = document.getElementById('note');
      i.value = 'x'.repeat(1200);
      i.dispatchEvent(new Event('input'));
    });
    const over = await page.evaluate(() => ({
      disabled: document.getElementById('place').disabled,
      says: (document.getElementById('capturemoretext') || {}).textContent || '',
      kept: document.getElementById('note').value.length
    }));
    check('past the ceiling Place it is refused', over.disabled === true);
    check('the bar says how long it is', /1,?200 characters/.test(over.says.replace(/ /g,' ')), over.says);
    check('and not one character is eaten', over.kept === 1200, 'kept ' + over.kept);

    // three lines raises the importer offer
    await page.evaluate(() => {
      const i = document.getElementById('note');
      i.value = 'one line\ntwo line\nthree line';
      i.dispatchEvent(new Event('input'));
    });
    const lines = await page.evaluate(() => ({
      more: !document.getElementById('capturemore').hidden,
      placeStillLive: !document.getElementById('place').disabled
    }));
    check('three lines offers the importer', lines.more === true);
    check('but Place it still works if that is what they meant', lines.placeStillLive === true);
    check('no page errors placing notes', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------------- the notes shelf
  {
    const proj = board('Night Haul', 6);
    proj.cards.push(
      {id: 90, text: 'RONNIE: "I do not steal cars."', slot: '__shelf', kind: 'dialogue'},
      {id: 91, text: 'the diner has a payphone that still works', slot: '__shelf', kind: 'research'},
      {id: 92, text: 'Dale is forty and tired', slot: '__shelf', kind: 'character'},
      {id: 93, text: 'maybe he keeps the money', slot: '__none', maybe: 'mid'}
    );
    const { page, errors } = await open(browser, [proj]);
    await page.evaluate(() => setView('notes', true));
    await page.waitForTimeout(250);
    const notes = await page.evaluate(() => ({
      rows: document.querySelectorAll('#notesbody .note-row, #notesbody .nrow, #notesbody [data-note]').length,
      body: document.getElementById('notesbody').textContent,
      filters: document.querySelectorAll('#railfilter option, #notesview select option').length
    }));
    check('every filed note is on the Notes page',
      /I do not steal cars/.test(notes.body) && /payphone/.test(notes.body) && /forty and tired/.test(notes.body),
      notes.body.slice(0, 200));
    check('a set-aside idea is not mixed in with the notes',
      !/maybe he keeps the money/.test(notes.body));
    check('no page errors on Notes', errors.length === 0, errors.join('\n'));

    // editing a note, which was impossible anywhere in the app
    const edited = await page.evaluate(() => {
      const card = [...document.querySelectorAll('#notesbody .ncard')]
        .find(c => /payphone/.test(c.textContent));
      // The pencil, by class. It was a button labelled "Edit" in the row below
      // and is the same icon a board card uses now, so there is no text to find.
      const btn = card.querySelector('.edit');
      if (!btn) return {found: false};
      btn.click();
      const t = card.querySelector('.t');
      const wasEditable = t.getAttribute('contenteditable') === 'true';
      t.textContent = 'the diner payphone still takes coins';
      t.dispatchEvent(new Event('blur'));
      const saved = P().cards.find(c => c.id === 91);
      return {found: true, wasEditable, text: saved && saved.text};
    });
    check('a note can be edited from the Notes page', edited.found && edited.wasEditable,
      JSON.stringify(edited));
    check('and the new wording is what gets kept',
      edited.text === 'the diner payphone still takes coins', JSON.stringify(edited));

    /* The two beat actions are different things and still have to say so. They
       used to be two dropdowns side by side, which looked like one control
       duplicated; they are one dropdown with two labelled groups now, and the
       GROUP HEADINGS are what carries the difference. So this asks for the
       headings rather than for two selects. */
    const acts = await page.evaluate(() => {
      const card = [...document.querySelectorAll('#notesbody .ncard')]
        .find(c => /forty and tired/.test(c.textContent));
      const send = [...card.querySelectorAll('select')]
        .find(s => /Send this note to a beat/.test(s.options[0].textContent));
      return send ? [...send.querySelectorAll('optgroup')].map(g => g.label) : [];
    });
    check('the notes page offers turning a note into a card',
      acts.some(a => /card on the board/i.test(a)), JSON.stringify(acts));
    check('and filing one under a beat, which is not the same thing',
      acts.some(a => /Keep it a note/i.test(a)), JSON.stringify(acts));

    const both = await page.evaluate(() => {
      const card = [...document.querySelectorAll('#notesbody .ncard')]
        .find(c => /forty and tired/.test(c.textContent));
      const send = [...card.querySelectorAll('select')]
        .find(s => /Send this note to a beat/.test(s.options[0].textContent));
      send.value = 'file:setup'; send.dispatchEvent(new Event('change'));
      const n = P().cards.find(c => c.id === 92);
      return {slot: n.slot, attached: n.attachedTo, kind: n.kind};
    });
    check('filing under a beat keeps it a note',
      both.slot === '__shelf' && both.attached === 'setup', JSON.stringify(both));


    // a filed note must never turn up as a card on the board
    const board2 = await page.evaluate(() => {
      setView('board', true);
      return document.getElementById('board').textContent;
    });
    check('and it does not appear as a board card',
      !/forty and tired/.test(board2), 'a shelf note rendered on the board');

    /* The other half of the same control, checked AFTER the board assertion
       above: promoting this note makes it a card, and that check needs it to
       still be a note when it runs. One select doing two jobs is only an
       improvement if both jobs still work. */
    const promoted = await page.evaluate(() => {
      setView('notes', true); renderNotes();
      const card = [...document.querySelectorAll('#notesbody .ncard')]
        .find(c => /forty and tired/.test(c.textContent));
      const send = [...card.querySelectorAll('select')]
        .find(s => /Send this note to a beat/.test(s.options[0].textContent));
      send.value = 'card:setup'; send.dispatchEvent(new Event('change'));
      const n = P().cards.find(c => c.id === 92);
      return {slot: n.slot, kind: n.kind, attached: n.attachedTo};
    });
    check('and the other half of it makes a real board card',
      promoted.slot === 'setup' && promoted.kind === 'beat' && !promoted.attached,
      JSON.stringify(promoted));

    // a line break must not weld two lines into one word
    const broke = await page.evaluate(() => {
      setView('notes', true);
      const card = [...document.querySelectorAll('#notesbody .ncard')]
        .find(c => /I do not steal cars/.test(c.textContent));
      const t = card.querySelector('.t');
      card.querySelector('.edit').click();
      const ev = new KeyboardEvent('keydown', {key: 'Enter', shiftKey: true, cancelable: true});
      const prevented = !t.dispatchEvent(ev);
      return {prevented, editable: t.getAttribute('contenteditable')};
    });
    check('a line break inside a note is refused rather than welded',
      broke.prevented === true, JSON.stringify(broke));

    // regrouping a note has to reach the server
    const regrouped = await page.evaluate(() => {
      dirty.clear();
      const card = [...document.querySelectorAll('#notesbody .ncard')]
        .find(c => /payphone|coins/.test(c.textContent));
      const sel = [...card.querySelectorAll('select')]
        .find(s => /Everything|Research|Dialogue|Character/.test(s.options[0].textContent)
                || !/beat/i.test(s.options[0].textContent));
      sel.value = 'line'; sel.dispatchEvent(new Event('change'));
      return dirty.size;
    });
    check('changing a note type queues it to be saved', regrouped > 0,
      'the change would have been lost on closing the tab');
    await page.close();
  }

  // ------------------------------------------------- characters
  {
    const { page, errors } = await open(browser, [board('Night Haul', 6)]);
    await page.evaluate(() => setView('cast', true));
    await page.waitForTimeout(200);
    await page.evaluate(() => document.getElementById('castnew').click());
    await page.waitForTimeout(200);
    const sheet = await page.evaluate(() => ({
      open: !document.getElementById('sheetchar').hidden,
      fields: document.querySelectorAll('#charfields input, #charfields textarea, #charfields select').length
    }));
    check('the character sheet opens', sheet.open === true);
    check('with its ten fields', sheet.fields >= 10, 'fields: ' + sheet.fields);
    const saved = await page.evaluate(() => {
      const first = document.querySelector('#charfields input, #charfields textarea');
      first.value = 'Dale Rusk';
      first.dispatchEvent(new Event('input'));
      document.getElementById('charsave').click();
      return {count: cast().length, name: (cast()[0] || {}).name};
    });
    check('a character saves into the project', saved.count === 1, JSON.stringify(saved));
    const survives = await page.evaluate(() => {
      const payload = projectPayload(P());
      return Array.isArray(payload.characters) && payload.characters.length === 1;
    });
    check('and rides the save payload to the server', survives === true,
      'characters missing from the payload, which is how one vanished before');
    check('no page errors on Characters', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------------- the outline gate
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const locked = await page.evaluate(() => {
      const b = document.getElementById('outlinebtn');
      b.click();
      return {view: state.view, cls: b.className, tip: b.getAttribute('data-tip') || ''};
    });
    check('an incomplete board cannot open the Outline', locked.view === 'board');
    check('and the control says how many beats are missing', /9/.test(locked.tip), locked.tip);
    check('the lock class is the narrow one, not the full-screen blocker',
      /outline-locked/.test(locked.cls) && !/(^| )locked( |$)/.test(locked.cls), locked.cls);
    await page.close();
  }

  // ------------------------------------------------- the outline itself
  {
    const { page, errors } = await open(browser, [board('Night Haul', 15)]);
    await page.evaluate(() => setView('outline', true));
    await page.waitForTimeout(300);
    const o = await page.evaluate(() => ({
      view: state.view,
      beats: document.querySelectorAll('#outlinebody .obeat, #outlinebody [data-slot]').length,
      boxes: document.querySelectorAll('#outlinebody textarea').length
    }));
    check('a complete board opens the Outline', o.view === 'outline');
    check('every beat gets a writing box', o.boxes >= 15, 'boxes: ' + o.boxes);

    const wrote = await page.evaluate(async () => {
      const ta = document.querySelector('#outlinebody textarea');
      ta.value = 'He works the lot until the porch light comes on.';
      ta.dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 80));
      const save = [...document.querySelectorAll('#outlinebody button')]
        .find(b => /^save$/i.test(b.textContent.trim()));
      if (save) save.click(); else ta.dispatchEvent(new Event('blur'));
      await new Promise(r => setTimeout(r, 150));
      return {words: outlineWordCount(P()), passages: JSON.stringify(P().outline).length};
    });
    check('typed prose is counted', wrote.words >= 9, JSON.stringify(wrote));

    const committed = await page.evaluate(() => {
      setView('board', true);
      return outlineWordCount(P());
    });
    check('leaving the Outline commits what was typed', committed >= 9, 'words after leaving: ' + committed);
    check('no page errors in the Outline', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------------- switching structure
  {
    const proj = board('Night Haul', 15);
    proj.outline = {open: ['The lot at two in the morning.'], mid: ['The diner, and the offer.']};
    const { page, errors } = await open(browser, [proj]);
    await page.evaluate(() => setView('outline', true));
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => ({words: outlineWordCount(P()), cards: P().cards.length}));
    const after = await page.evaluate(() => {
      window.confirm = () => true;
      const sel = document.getElementById('structure');
      sel.value = 'three';
      sel.dispatchEvent(new Event('change'));
      return {words: outlineWordCount(P()), cards: P().cards.length, structure: P().structure};
    });
    check('a structure switch keeps every card', after.cards === before.cards,
      before.cards + ' -> ' + after.cards);
    check('and loses no written words', after.words === before.words,
      before.words + ' -> ' + after.words);
    check('the project is actually on the new structure', after.structure !== 'stc', after.structure);
    const undone = await page.evaluate(() => { undo(); return {structure: P().structure, words: outlineWordCount(P())}; });
    check('undo puts the old structure back', undone.structure === 'stc', JSON.stringify(undone));
    check('with the prose intact', undone.words === before.words, JSON.stringify(undone));
    check('no page errors switching structure', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------------- deleting and undo
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    /* The X asks before it deletes now, so this has to answer. Stubbing confirm
       rather than handling the page dialog keeps it synchronous, which is how
       the rest of this block is written, and it is what the "Empty the board"
       check below already does. */
    const cycle = await page.evaluate(() => {
      window.confirm = () => true;
      const n0 = P().cards.length;
      document.querySelector('#board .icard .del').click();
      const n1 = P().cards.length;
      undo();
      return {n0, n1, n2: P().cards.length};
    });
    check('deleting a card removes exactly one', cycle.n1 === cycle.n0 - 1, JSON.stringify(cycle));
    check('and undo brings it back', cycle.n2 === cycle.n0, JSON.stringify(cycle));

    /* And the question is a real gate, not a formality: saying no keeps the
       card. This is the whole point of the change, so it gets its own check. */
    const refused = await page.evaluate(() => {
      window.confirm = () => false;
      const n0 = P().cards.length;
      document.querySelector('#board .icard .del').click();
      return {n0, n1: P().cards.length};
    });
    check('and answering no keeps the card', refused.n1 === refused.n0,
      JSON.stringify(refused));

    const emptied = await page.evaluate(() => {
      window.confirm = () => true;
      const n0 = P().cards.length;
      document.getElementById('clear').click();
      const n1 = P().cards.filter(c => c.slot !== '__shelf').length;
      undo();
      return {n0, n1, n2: P().cards.length};
    });
    check('Empty this board clears the beats', emptied.n1 === 0, JSON.stringify(emptied));
    check('and undo restores them', emptied.n2 === emptied.n0, JSON.stringify(emptied));
    await page.close();
  }

  // ------------------------------------------------- the PDF
  {
    const proj = board('Night Haul', 15);
    proj.outline = {open: ['The lot at two in the morning.']};
    proj.characters = [
      {id: 'c1', name: 'Dale Rusk', role: 'protagonist', want: 'to get through the weekend'},
      /* A name and a part to play and nothing else. Role used to count as
         something written, so this printed a heading, a rule, and an inch of
         blank paper under it. */
      {id: 'c2', name: 'Bystander', role: 'minor'}
    ];
    proj.cards.push({id: 80, text: 'a note that is not a beat', slot: '__shelf', kind: 'research'});
    proj.cards.push({id: 82, slot: '__shelf', kind: 'research',
      text: Array.from({length: 98}, (_, i) => 'word' + i).join(' ')
            + ' ninety ninth word of this research note'});
    proj.cards.push({id: 81, text: 'an idea set aside', slot: '__none'});
    // A note the writer filed against a beat. It belongs in the outline under
    // that beat, and nowhere else.
    proj.cards.push({id: 83, text: 'a clue filed under theme', slot: '__shelf',
                     kind: 'clue', attachedTo: 'theme'});
    /* Pictures, in the three states that print differently: one filed under a
       beat, one worn by a character, and one filed against nothing. */
    proj.characters[0].face = 'u1/dale.jpg';
    proj.cards.push({id: 84, slot: '__shelf', kind: 'photo', img: 'u1/dale.jpg',
                     text: 'Dale on the loading dock'});
    proj.cards.push({id: 85, slot: '__shelf', kind: 'photo', img: 'u1/rain.jpg',
                     attachedTo: 'open', text: 'rain on the windscreen'});
    proj.cards.push({id: 86, slot: '__shelf', kind: 'photo', img: 'u1/loose.jpg',
                     text: 'a road nobody has decided about'});
    const { page, errors } = await open(browser, [proj]);
    const pdf = await page.evaluate(async () => {
      await exportPDF(P());
      return window.__PDF__ || null;
    });
    // Everything after the Vision heading, which is where the contact sheet is.
    const loose0 = t => (String(t).split(/\bVISION\b/i)[1] || '');
    check('the PDF builds', !!pdf, 'nothing produced');
    if (pdf) {
      check('it carries the project name', /Night Haul/i.test(pdf.text), pdf.name);
      check('it carries the board', /the card for open/i.test(pdf.text));
      check('it carries the outline prose', /two in the morning/i.test(pdf.text));
      check('it carries the cast', /Dale Rusk/i.test(pdf.text));
      check('and leaves out somebody who is only a name and a part',
        !/Bystander/i.test(pdf.text),
        'a character with nothing written about them printed an empty block');
      check('it carries what was set aside', /an idea set aside/i.test(pdf.text));
      check('it carries the other notes', /not a beat/i.test(pdf.text));
      check('and prints a long one whole rather than cutting it',
        /ninety ninth word of this research note/i.test(pdf.text),
        'a long note was truncated');
      check('and heads that section', /loose notes/i.test(pdf.text));

      /* THE OUTLINE IS THE DOCUMENT, NOT A LIST OF WHAT WAS TYPED.
         It used to print the prose and nothing else, so a beat holding four
         cards and no typed passage appeared nowhere at all and a writer's work
         vanished in the only place it gets seen. Everything standing in a beat
         prints under that beat now. */
      const outline = pdf.text.split(/THE OUTLINE/i)[1] || '';
      check('the outline section exists at all', !!outline, 'no OUTLINE heading');
      check('and carries the cards standing in each beat',
        /the card for open/i.test(outline), 'cards are missing from the outline');
      check('and the notes filed against a beat',
        /a clue filed under theme/i.test(outline), 'filed notes are missing');
      check('and says what each beat is for',
        /the first shot/i.test(outline), 'the beat descriptions are missing');
      check('and still lists a beat nobody has written under',
        /CATALYST/i.test(outline), 'empty beats vanish from the outline');

      // And a filed note is printed once, under its beat, not again in Loose notes.
      const loose = pdf.text.split(/LOOSE NOTES/i)[1] || '';
      check('a filed note is not repeated in the loose pile',
        !/a clue filed under theme/i.test(loose), 'the same note printed twice');

      /* THE PICTURES PRINT WHERE THEY BELONG, AND EACH ONE ONCE.
         Until now the document left every photograph out, so a picture filed
         under Opening Image showed in the app and printed as nothing. The
         three states go to three different places, and a picture printed in
         one of them is not repeated in the contact sheet, the same rule a
         filed note already follows. */
      check('the document has a Vision section for pictures filed against nothing',
        /VISION/i.test(pdf.text), 'no Vision section');
      check('and the loose one is in it',
        /a road nobody has decided about/i.test(loose0(pdf.text)),
        'the undecided picture is missing from the contact sheet');
      check('a picture filed under a beat prints under that beat',
        /rain on the windscreen/i.test((pdf.text.split(/THE OUTLINE/i)[1] || '')
          .split(/\bVISION\b/i)[0] || ''),
        'a filed picture did not print with its beat');
      check('and is not repeated in the contact sheet',
        !/rain on the windscreen/i.test(loose0(pdf.text)),
        'the same picture printed twice');
      check('a character\u2019s reference is not repeated either',
        !/Dale on the loading dock/i.test(loose0(pdf.text)),
        'a reference already on a character printed again in Vision');

      check('the filename is the project', /night-haul/i.test(pdf.name || ''), pdf.name);
    }
    check('no page errors exporting', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------------- the dashboard
  {
    const { page, errors } = await open(browser,
      [board('Night Haul', 15), board('Dirt Money', 4), board('The Spillway', 0)]);
    await page.evaluate(() => setView('slate', true));
    await page.waitForTimeout(250);
    const shelf = await page.evaluate(() => ({
      cards: document.querySelectorAll('#slategrid .pcard:not(.newcard)').length,
      finished: document.querySelectorAll('#slategrid .pcard.full').length,
      lede: document.getElementById('slatelede').textContent,
      score: !document.getElementById('slatescore').hidden,
      nextUp: [...document.querySelectorAll('#slategrid .pcard')].some(c => /NEXT UP/i.test(c.textContent))
    }));
    check('every project is on the shelf', shelf.cards === 3, 'cards: ' + shelf.cards);
    check('a finished board is marked finished', shelf.finished === 1, 'finished: ' + shelf.finished);
    check('the scoreboard is up when there is something to count', shelf.score === true);
    check('an unfinished card says what is next', shelf.nextUp === true);
    check('the lede counts the projects', /Three projects saved/.test(shelf.lede), shelf.lede);
    const dl = await page.evaluate(async () => {
      const b = [...document.querySelectorAll('#slategrid .pcard.full button')]
        .find(x => /PDF/i.test(x.textContent));
      if (!b) return {found: false};
      b.click();
      await new Promise(r => setTimeout(r, 500));
      return {found: true, pdf: window.__PDF__, view: state.view};
    });
    check('a finished card hands over its PDF', dl.found && !!dl.pdf, JSON.stringify(dl).slice(0,120));
    check('and does not leave the dashboard', dl.view === 'slate', dl.view);
    check('no page errors on the dashboard', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------ placing it yourself
  {
    const { page, errors } = await open(browser, [board('Night Haul', 6)]);
    const shown = await page.evaluate(() => {
      pending = {text: 'he returns home, beaten', options: []};
      paintCandidates([
        {id:'lost', name:'All Is Lost', conf:94, why:'something is lost'},
        {id:'dark', name:'Dark Night', conf:88, why:'the consequence'}
      ], true);
      const sel = document.getElementById('pickbeat');
      return {there: !!sel, options: sel ? sel.options.length : 0,
              first: sel ? sel.options[0].textContent : ''};
    });
    check('the picker is offered even when Beatfall is confident', shown.there === true);
    check('and lists every beat, not just the two guesses', shown.options === 16,
      'options: ' + shown.options + ' (1 label + 15 beats)');
    check('and says what it is for', /Place it myself/.test(shown.first), shown.first);

    const placed = await page.evaluate(() => {
      document.getElementById('note').value = 'he returns home, beaten';
      pending = {text: 'he returns home, beaten', options: []};
      const sel = document.getElementById('pickbeat');
      sel.value = 'last';
      sel.dispatchEvent(new Event('change'));
      const card = P().cards.find(c => /returns home/.test(c.text));
      return card ? {slot: card.slot, locked: card.locked, pinned: card.pinned} : null;
    });
    check('choosing a beat puts the card exactly there',
      placed && placed.slot === 'last', JSON.stringify(placed));
    /* Not locked, and it used to read `pinned === false` here. The field is
       gone: `pinned` meant "placed by hand", every placement set it, and it
       drew the gold edge, so the board called a placement settled that the
       writer had only dragged. Only the padlock locks a card now, so a hand
       placement arrives with no lock at all, which is what this asks. */
    check('and behaves the same as accepting a suggestion',
      placed && !placed.locked && placed.pinned === undefined,
      JSON.stringify(placed));
    check('no page errors placing by hand', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------ the credit ledger
  {
    const acct = Object.assign({}, PAID, {spend: [
      {kind:'import', credits:2, at:new Date().toISOString()},
      {kind:'conversation', credits:1, at:new Date(Date.now()-3*3600*1000).toISOString()},
      {kind:'character', credits:2, at:new Date(Date.now()-40*3600*1000).toISOString()}
    ]});
    const { page, errors } = await open(browser, [board('Night Haul', 6)], acct);
    const led = await page.evaluate(() => {
      openSettings('usage');
      const l = document.querySelector('.ledger');
      return {there: !!l, rows: document.querySelectorAll('.lrow').length,
              text: l ? l.textContent : ''};
    });
    check('the usage pane carries a credit log', led.there === true);
    check('with one line per charge', led.rows === 3, 'rows: ' + led.rows);
    check('naming what each one was',
      /Reading in a notes file/.test(led.text) && /A character interview/.test(led.text),
      led.text.slice(0, 200));
    const costs = await page.evaluate(() =>
      [...document.querySelectorAll('.lrow .lcost')].map(e => e.textContent.trim()));
    check('and what each one cost', costs.join('|') === '2 credits|1 credit|2 credits',
      JSON.stringify(costs));
    check('no page errors on the usage pane', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // an account that has spent nothing says so rather than showing an empty box
  {
    const { page } = await open(browser, [board('Night Haul', 6)],
      Object.assign({}, PAID, {spend: []}));
    const empty = await page.evaluate(() => {
      openSettings('usage');
      return (document.querySelector('.ledger') || {}).textContent || '';
    });
    check('an unspent account says so plainly', /Nothing has used a credit/.test(empty),
      empty.slice(0, 120));
    await page.close();
  }

  /* --------------------------------------- pointing a monthly payer at annual
     The annual card used to be dead text for anybody already subscribed: the
     cheaper plan was shown to a monthly payer with no way to take it and no
     reason given. Nothing records which interval a subscription is on, so the
     renewal date is the tell, and these cases pin both directions of that
     guess. */
  {
    const { page, errors } = await open(browser, [board('Night Haul', 6)]);
    const seen = await page.evaluate(() => {
      openSettings('plan');
      const b = document.getElementById('s-toyear');
      return {there: !!b, text: document.querySelector('.plans').textContent};
    });
    check('a monthly subscriber is offered the annual plan', seen.there === true);
    check('and told what switching saves', /saves \$45 a year/.test(seen.text),
      seen.text.slice(0, 240));
    check('and told the allowance does not change', /Same 100 credits a month/.test(seen.text),
      seen.text.slice(0, 240));
    check('no page errors on the plan pane', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // Somebody already paying yearly must never be sold the plan they are on.
  {
    const { page } = await open(browser, [board('Night Haul', 6)],
      Object.assign({}, PAID, {current_period_end: inDays(300)}));
    const seen = await page.evaluate(() => {
      openSettings('plan');
      return !!document.getElementById('s-toyear');
    });
    check('an annual subscriber is not offered annual', seen === false);
    await page.close();
  }

  // Nor somebody on the way out: that is a retention pitch, not a price one.
  {
    const { page } = await open(browser, [board('Night Haul', 6)],
      Object.assign({}, PAID, {cancel_at_period_end: true}));
    const seen = await page.evaluate(() => {
      openSettings('plan');
      return !!document.getElementById('s-toyear');
    });
    check('a cancelling subscriber is not offered annual', seen === false);
    await page.close();
  }

  // A trial has not chosen anything yet, so both plans stay on offer as plans.
  {
    const { page } = await open(browser, [board('Night Haul', 6)],
      Object.assign({}, PAID, {plan:'trial', trialing:true,
        trial_ends_at: inDays(5), current_period_end: null}));
    const seen = await page.evaluate(() => {
      openSettings('plan');
      return {upsell: !!document.getElementById('s-toyear'),
              choose: document.querySelectorAll('[data-period]').length};
    });
    check('a trial is not offered a switch', seen.upsell === false);
    check('and is still offered both plans to choose from', seen.choose === 2,
      'buttons: ' + seen.choose);
    await page.close();
  }

  /* ------------------------------------------------ the same note, twice
     Three identical notes off a phone used to arrive as three rows, and
     unticking one of them cleared it out of the pile it had never left,
     because the clearing worked by comparing text. */
  {
    const { page, errors } = await open(browser, [board('Night Haul', 6)]);
    const seen = await page.evaluate(() => {
      const same = 'a woman starts receiving voicemails from her dead sister';
      PENDING = [
        {id: 'c1', body: same, project_id: 'p-nighthaul', project_name: 'Night Haul'},
        {id: 'c2', body: same.toUpperCase() + '  ', project_id: 'p-nighthaul', project_name: 'Night Haul'},
        {id: 'c3', body: same, project_id: 'p-nighthaul', project_name: 'Night Haul'},
        {id: 'c4', body: 'he keeps the second phone in the glovebox',
         project_id: 'p-nighthaul', project_name: 'Night Haul'},
      ];
      placeGroupByHand('p-nighthaul');
      const rows = Array.from(document.querySelectorAll('#revbody .revrow'));
      return {
        rows: rows.length,
        skipped: revSkipped,
        count: document.getElementById('revcount').textContent,
        caps: plan[0].notes.map(n => (n.caps || []).join(',')),
      };
    });
    check('three copies of one note make one row', seen.rows === 2,
      'rows: ' + seen.rows);
    check('capitals and stray spaces do not make a second note',
      seen.skipped === 2, 'skipped: ' + seen.skipped);
    check('and the row stands for every copy it collapsed',
      seen.caps[0] === 'c1,c2,c3', seen.caps.join(' | '));
    check('the count line says why the sheet is shorter',
      /already there/.test(seen.count), seen.count);

    // Untick the collapsed row. Not one capture may leave the pile.
    const after = await page.evaluate(async () => {
      const sent = [];
      const real = BF.api;
      BF.api = (u, o) => { sent.push(JSON.parse(o.body)); return Promise.resolve({ok: true}); };
      plan[0].notes[0].keep = false;
      await markSorted(plan[0].notes.filter(n => n.keep && !n.gone), []);
      BF.api = real;
      return {sent, left: PENDING.map(c => c.id)};
    });
    check('unticking a note never clears its copies from the pile',
      after.left.indexOf('c1') >= 0 && after.left.indexOf('c2') >= 0
        && after.left.indexOf('c3') >= 0, after.left.join(','));
    check('and the note that was kept does leave',
      after.left.indexOf('c4') < 0, after.left.join(','));
    check('no page errors collapsing copies', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* A short note used to be swallowed by a longer one that contained it. */
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const left = await page.evaluate(async () => {
      PENDING = [
        {id: 's1', body: 'she lies', project_id: 'p-nighthaul'},
        {id: 's2', body: 'she lies to the detective about where she was on Tuesday night',
         project_id: 'p-nighthaul'},
      ];
      sortingIds = ['s1', 's2'];
      const real = BF.api;
      BF.api = () => Promise.resolve({ok: true});
      await markSorted([{text: 'she lies to the detective about where she was on Tuesday night'}], []);
      BF.api = real;
      return PENDING.map(c => c.id);
    });
    check('a short note is not swallowed by a longer one containing it',
      left.length === 1 && left[0] === 's1', left.join(','));
    await page.close();
  }

  /* Already on the board, in any of the three places a writer can see it. */
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const seen = await page.evaluate(() => {
      const p = P();
      p.cards.push({id: 901, text: 'The dog barks at nothing.', slot: '__shelf', pinned: false});
      p.cards.push({id: 902, text: 'A car idles across the street.', slot: '__none', pinned: false});
      importIntoNew = false;
      plan = [{name: p.name, isCurrent: true, brief: {}, people: [], notes: [
        {text: 'the dog barks at nothing', kind: 'beat', beat: null, conf: 0, keep: true},
        {text: 'A car idles across the street.', kind: 'beat', beat: null, conf: 0, keep: true},
        {text: 'the card for open', kind: 'beat', beat: null, conf: 0, keep: true},
        {text: 'a genuinely new note about the bridge', kind: 'beat', beat: null, conf: 0, keep: true},
      ]}];
      dedupePlan();
      const on = (t) => {
        const n = plan[0].notes.find(x => x.text === t);
        return n ? {kept: !!n.keep, board: !!n.onBoard} : null;
      };
      return {
        // Nothing is removed. A note the board already has is SHOWN, unticked,
        // saying so. Dropping it used to take its link back to the pile with
        // it, and the note could then never be cleared.
        all: plan[0].notes.length,
        shelf: on('the dog barks at nothing'),
        aside: on('A car idles across the street.'),
        board: on('the card for open'),
        fresh: on('a genuinely new note about the bridge'),
        echoes: revEchoes,
      };
    });
    check('a note already in Other notes is kept and unticked, full stop or not',
      seen.shelf && seen.shelf.kept === false && seen.shelf.board === true,
      JSON.stringify(seen.shelf));
    check('a note already in Set aside, the same',
      seen.aside && seen.aside.kept === false && seen.aside.board === true,
      JSON.stringify(seen.aside));
    check('a note already on the board, the same',
      seen.board && seen.board.kept === false && seen.board.board === true,
      JSON.stringify(seen.board));
    check('and a genuinely new note is ticked and untouched',
      seen.fresh && seen.fresh.kept === true && seen.fresh.board !== true,
      JSON.stringify(seen.fresh));
    check('none of them are removed from the sheet', seen.all === 4, String(seen.all));
    check('all three are counted as saying the same thing', seen.echoes === 3,
      'echoes: ' + seen.echoes);
    await page.close();
  }

  /* Throwing one away, and changing your mind about it. */
  {
    const { page, errors } = await open(browser, [board('Night Haul', 6)]);
    const seen = await page.evaluate(() => {
      PENDING = [
        {id: 'b1', body: 'a line worth keeping', project_id: 'p-nighthaul'},
        {id: 'b2', body: 'asdfasdf pocket dial', project_id: 'p-nighthaul'},
      ];
      placeGroupByHand('p-nighthaul');
      const rows = Array.from(document.querySelectorAll('#revbody .revrow'));
      const bins = rows.map(r => r.querySelector('.revbin')).filter(Boolean);
      bins[1].click();
      const after = Array.from(document.querySelectorAll('#revbody .revrow'));
      return {
        bins: bins.length,
        gone: after[1].className,
        noBox: after[1].querySelector('input[type=checkbox]') === null,
        undo: after[1].querySelector('.revbin').textContent,
        count: document.getElementById('revcount').textContent,
      };
    });
    check('every row offers a way to throw the note away', seen.bins === 2,
      'bins: ' + seen.bins);
    check('a thrown away row says so instead of offering a tick',
      /gone/.test(seen.gone) && seen.noBox === true, seen.gone);
    check('and offers Undo in the same place', seen.undo === 'Undo', seen.undo);
    check('the count line mentions it once, quietly',
      /1 thrown away/.test(seen.count), seen.count);

    const undone = await page.evaluate(() => {
      document.querySelectorAll('#revbody .revrow')[1].querySelector('.revbin').click();
      const row = document.querySelectorAll('#revbody .revrow')[1];
      return {ticked: !!row.querySelector('input[type=checkbox]:checked'),
              count: document.getElementById('revcount').textContent};
    });
    check('Undo puts the note back, ticked', undone.ticked === true, undone.count);
    check('and stops mentioning it', !/thrown away/.test(undone.count), undone.count);
    check('no page errors throwing a note away', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* Thrown away travels to the server as thrown away, not as sorted. */
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const sent = await page.evaluate(async () => {
      PENDING = [
        {id: 'k1', body: 'keep me', project_id: 'p-nighthaul'},
        {id: 'k2', body: 'bin me', project_id: 'p-nighthaul'},
      ];
      sortingIds = ['k1', 'k2'];
      const out = [];
      const real = BF.api;
      BF.api = (u, o) => { out.push(JSON.parse(o.body)); return Promise.resolve({ok: true}); };
      await markSorted([{text: 'keep me', caps: ['k1']}], ['k2']);
      BF.api = real;
      return out[0];
    });
    check('a placed note is marked sorted', (sent.sorted || []).join(',') === 'k1',
      JSON.stringify(sent));
    check('and a thrown away one is marked thrown away',
      (sent.dropped || []).join(',') === 'k2', JSON.stringify(sent));
    await page.close();
  }

  /* A pasted note the writer unticks on purpose waits in the pile rather than
     evaporating with the box it was pasted into. */
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const posted = await page.evaluate(async () => {
      const out = [];
      const real = BF.api;
      BF.api = (u, o) => {
        if (o && o.method === 'POST' && /captures/.test(u)) out.push(JSON.parse(o.body));
        return Promise.resolve({ok: true, captures: [], days: []});
      };
      await parkUnticked([{text: 'not this one, not yet', projectId: 'p-nighthaul',
                           projectName: 'Night Haul'}]);
      BF.api = real;
      return out[0];
    });
    check('an unticked paste is parked in the pile',
      posted && posted.captures.length === 1, JSON.stringify(posted).slice(0, 120));
    check('with the words it had and the board it was for',
      posted && posted.captures[0].body === 'not this one, not yet'
        && posted.captures[0].project_id === 'p-nighthaul',
      JSON.stringify(posted && posted.captures[0]));
    check('and marked as coming from the desk, not a phone',
      posted && posted.captures[0].source === 'desk',
      JSON.stringify(posted && posted.captures[0]));
    await page.close();
  }

  /* Nothing left to add is a sentence, not a blank sheet. */
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const seen = await page.evaluate(() => {
      importIntoNew = false;
      plan = [{name: P().name, isCurrent: true, brief: {}, people: [], notes: [
        {text: 'the card for open', kind: 'beat', beat: null, conf: 0, keep: true},
      ]}];
      dedupePlan();
      renderReview();
      return {text: document.getElementById('revbody').textContent,
              go: document.getElementById('revgo').disabled,
              label: document.getElementById('revgo').textContent};
    });
    check('a batch that is all copies says so on the row',
      /board already says this/.test(seen.text), seen.text.slice(0, 120));
    /* And there IS something to press. A dead button on a sheet full of notes
       the board already has is how a note gets stuck in the pile for ever. */
    check('and there is still a way to finish with them', seen.go === false);
    check('the button says what pressing it does', seen.label === 'Done with these',
      seen.label);
    await page.close();
  }

  /* ------------------------------------- naming a new script at the desk
     Picking "A new script" and pressing Place them myself used to refuse,
     because only the paid read could name a script. The writer knows what it
     is called, so they can say. */
  {
    const { page, errors } = await open(browser, [board('Night Haul', 6)]);
    const shown = await page.evaluate(() => {
      PENDING = [{id: 'u1', body: 'the duffel bag is still there', project_id: null},
                 {id: 'u2', body: 'he counts it twice', project_id: null}];
      showPhonePile();
      const sel = document.querySelector('#sortgroups .pgroup[data-key=""] select');
      const box = document.querySelector('#sortgroups .pgroup[data-key=""] .newname');
      return {
        caps: Array.from(sel.options).slice(0, -1).map(o => o.textContent),
        hidden: box.hidden,
      };
    });
    check('every script in the list is upper case',
      shown.caps.every(t => t === t.toUpperCase()), shown.caps.join(' | '));
    check('and the name box is out of the way until it is needed',
      shown.hidden === true);

    const opened = await page.evaluate(() => {
      const sel = document.querySelector('#sortgroups .pgroup[data-key=""] select');
      sel.value = '__new__';
      sel.dispatchEvent(new Event('change'));
      return document.querySelector('#sortgroups .pgroup[data-key=""] .newname').hidden;
    });
    check('choosing a new script asks what it is called', opened === false);

    const refused = await page.evaluate(() => {
      document.querySelector('#sortgroups [data-hand]').click();
      return {why: (document.getElementById('handwhy') || {}).textContent || '',
              made: state.projects.length};
    });
    check('pressing Place with no name asks for one instead of refusing',
      /working title/i.test(refused.why), refused.why);
    check('and no empty script is left behind', refused.made === 1,
      refused.made + ' projects');

    const done = await page.evaluate(() => {
      const box = document.querySelector('#sortgroups .pgroup[data-key=""] .newname');
      box.value = 'The Duffel Bag';
      document.querySelector('#sortgroups [data-hand]').click();
      return {
        projects: state.projects.map(p => p.name),
        active: P().name,
        rows: document.querySelectorAll('#revbody .revrow').length,
        sheet: !document.getElementById('sheetreview').hidden,
      };
    });
    check('naming it and pressing Place makes exactly that script',
      done.projects.length === 2 && done.projects[1] === 'The Duffel Bag',
      done.projects.join(' | '));
    check('and opens the review sheet on it, free, with both notes',
      done.sheet === true && done.rows === 2 && done.active === 'The Duffel Bag',
      JSON.stringify(done));
    check('no page errors naming a script by hand', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* Pressing Read them for me with a title typed means that title, not one
     the reader invents from a line in the notes. */
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const named = await page.evaluate(() => {
      PENDING = [{id: 'u1', body: 'the duffel bag is still there', project_id: null}];
      showPhonePile();
      const sel = document.querySelector('#sortgroups .pgroup[data-key=""] select');
      sel.value = '__new__';
      sel.dispatchEvent(new Event('change'));
      document.querySelector('#sortgroups .pgroup[data-key=""] .newname').value = 'Southbound Two';
      document.querySelector('#sortgroups [data-sort]').click();
      return {names: state.projects.map(p => p.name), active: P().name,
              intoNew: importIntoNew};
    });
    check('a title typed before the read is the title the read uses',
      named.active === 'Southbound Two', JSON.stringify(named));
    check('and the read is told not to invent another one',
      named.intoNew === false, String(named.intoNew));
    await page.close();
  }

  /* ------------------------------------ throwing a batch away from the pile
     Until now the only ways out of this pile were to place the notes or to
     pay to have them read, so a pocket dial had to be filed before it could
     be deleted. */
  {
    const { page, errors } = await open(browser, [board('Night Haul', 6)]);
    const asked = await page.evaluate(() => {
      PENDING = [{id: 'x1', body: 'asdf', project_id: 'p-nighthaul', project_name: 'Night Haul'},
                 {id: 'x2', body: 'pocket dial', project_id: 'p-nighthaul', project_name: 'Night Haul'}];
      showPhonePile();
      let said = '';
      window.confirm = (m) => { said = m; return false; };
      document.querySelector('#sortgroups [data-bin]').click();
      return {said, left: PENDING.length};
    });
    check('every batch in the pile can be thrown away', asked.said.length > 0, asked.said);
    check('and it says out loud that this is the only copy',
      /only copy/.test(asked.said) && /cannot be undone/.test(asked.said), asked.said);
    check('saying no keeps every note', asked.left === 2, asked.left + ' left');

    const gone = await page.evaluate(async () => {
      const sent = [];
      const real = BF.api;
      BF.api = (u, o) => { sent.push(JSON.parse(o.body)); return Promise.resolve({ok: true}); };
      window.confirm = () => true;
      document.querySelector('#sortgroups [data-bin]').click();
      await new Promise(r => setTimeout(r, 30));
      BF.api = real;
      return {sent, left: PENDING.length,
              says: document.getElementById('sortgroups').textContent};
    });
    check('saying yes empties that batch', gone.left === 0, gone.left + ' left');
    check('and tells the server they were thrown away, not sorted',
      gone.sent.length === 1 && (gone.sent[0].dropped || []).join(',') === 'x1,x2'
        && !(gone.sent[0].sorted || []).length, JSON.stringify(gone.sent));
    check('the pile then says it is empty rather than going blank',
      /Nothing waiting/.test(gone.says), gone.says.slice(0, 80));
    check('no page errors throwing a batch away', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* The dashboard cell reads as one fact with a way in, not two statements. */
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const cell = await page.evaluate(() => {
      PENDING = [{id: 'p1', body: 'a note', project_id: 'p-nighthaul'}];
      setView('slate', true);
      const el = document.querySelector('.phonecell');
      return el ? {k: el.querySelector('.score-k').textContent,
                   note: el.querySelector('.score-note').textContent.trim(),
                   link: el.querySelector('.score-open').textContent} : null;
    });
    check('the phone cell says what it is in one line',
      cell && /from your phone, waiting to be sorted/i.test(cell.k), cell && cell.k);
    check('and the line below it is only the way in',
      cell && cell.note === 'Open them' && cell.link === 'Open them',
      cell && JSON.stringify(cell));
    await page.close();
  }

  /* ------------------------------- the same note, said two different ways
     Kris typed both of these into his phone. The reader placed them on two
     different beats, both at 100 per cent, because nothing ever asked whether
     they were the same thing. */
  const MOTEL_A = "A woman finds a motel key in her husband's coat pocket from a town he claims he's never visited.";
  const MOTEL_B = "A woman discovers a motel key in her husband's jacket from a town he insists he's never been to.";

  {
    const { page, errors } = await open(browser, [board('Night Haul', 6)]);
    const seen = await page.evaluate(([A, B]) => {
      importIntoNew = false;
      plan = [{name: P().name, isCurrent: true, brief: {}, people: [], notes: [
        {text: A, kind: 'beat', beat: 'open', conf: 100, keep: true},
        // What the reader answers when it spots the restatement. Code cannot
        // reach this one: the two share six content words out of fifteen.
        {text: B, kind: 'beat', beat: 'cat', conf: 100, keep: true, echo: A},
      ]}];
      dedupePlan();
      renderReview();
      const rows = Array.from(document.querySelectorAll('#revbody .revrow'));
      return {
        rows: rows.length,
        second: rows[1].className,
        ticked: rows.map(r => !!r.querySelector('input[type=checkbox]:checked')),
        says: rows[1].querySelector('.dest').textContent,
        count: document.getElementById('revcount').textContent,
      };
    }, [MOTEL_A, MOTEL_B]);
    check('both notes stay on the sheet, nothing is removed', seen.rows === 2,
      'rows: ' + seen.rows);
    check('the first is ticked and the restatement is not',
      seen.ticked[0] === true && seen.ticked[1] === false, JSON.stringify(seen.ticked));
    check('the restatement is drawn attached to the note it repeats',
      /echo/.test(seen.second), seen.second);
    check('and says why instead of where it would have gone',
      /same as the note above/.test(seen.says), seen.says);
    check('the count says one of them was left out',
      /1 onto the board/.test(seen.count) && /1 say the same thing/.test(seen.count),
      seen.count);

    // Ticking it back on is the writer overruling the app, and it must work.
    const back = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#revbody .revrow'));
      const box = rows[1].querySelector('input[type=checkbox]');
      box.checked = true; box.dispatchEvent(new Event('change'));
      return document.getElementById('revcount').textContent;
    });
    check('ticking it back on stops it being a footnote',
      /2 onto the board/.test(back) && !/say the same thing/.test(back), back);
    check('no page errors pairing a restatement', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* What code can and cannot do on its own, which is the whole reason the
     reader is asked as well. */
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const out = await page.evaluate(([A, B]) => {
      const t = (x, y) => restates(x, y);
      return {
        // Rearranged: certain enough to act on without a reader.
        shuffled: t('He keeps the second phone in the glovebox of the truck',
                    'In the glovebox of the truck he keeps the second phone'),
        // Kris's pair, which code has no way to see: finds is not discovers.
        motel: t(A, B),
        // Opposites that share a vocabulary. Must never fire.
        opposite: t('Dale drives the truck north at dawn',
                    'Dale drives the truck south at dusk'),
        // The longer one carries a fact the shorter one does not.
        fuller: t('The dog barks at nothing',
                  'The dog barks at nothing in the yard behind the motel'),
        // Too short to judge.
        tiny: t('she lies', 'she lied'),
      };
    }, [MOTEL_A, MOTEL_B]);
    check('code catches the same words rearranged', out.shuffled === true);
    check('code does not pretend to catch synonyms', out.motel === false);
    check('two opposites sharing a vocabulary are not one note', out.opposite === false);
    check('a note that adds a fact is not a restatement', out.fuller === false);
    check('and two short notes are never guessed at', out.tiny === false);
    await page.close();
  }

  /* Caught by code alone, on the free route, with no reading paid for. */
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const free = await page.evaluate(() => {
      PENDING = [
        {id: 'e1', body: 'He keeps the second phone in the glovebox of the truck',
         project_id: 'p-nighthaul', project_name: 'Night Haul'},
        {id: 'e2', body: 'In the glovebox of the truck he keeps the second phone.',
         project_id: 'p-nighthaul', project_name: 'Night Haul'},
      ];
      placeGroupByHand('p-nighthaul');
      const rows = Array.from(document.querySelectorAll('#revbody .revrow'));
      return {rows: rows.length,
              ticked: rows.map(r => !!r.querySelector('input[type=checkbox]:checked')),
              count: document.getElementById('revcount').textContent};
    });
    check('placing by hand pairs them too, for nothing', free.rows === 2
      && free.ticked[0] === true && free.ticked[1] === false, JSON.stringify(free));
    check('and says so in the count', /say the same thing/.test(free.count), free.count);
    await page.close();
  }

  /* Against the board, not just within the batch. */
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const seen = await page.evaluate(() => {
      P().cards.push({id: 950, slot: 'open', pinned: false,
        text: 'She burns the letters in the sink before he gets home'});
      importIntoNew = false;
      plan = [{name: P().name, isCurrent: true, brief: {}, people: [], notes: [
        {text: 'Before he gets home she burns the letters in the sink.',
         kind: 'beat', beat: 'open', conf: 90, keep: true},
      ]}];
      dedupePlan();
      renderReview();
      const row = document.querySelector('#revbody .revrow');
      return {ticked: !!row.querySelector('input[type=checkbox]:checked'),
              says: row.querySelector('.dest').textContent};
    });
    check('a note your board already makes is left out', seen.ticked === false);
    check('and says it is the board it clashes with',
      /board already says this/.test(seen.says), seen.says);
    await page.close();
  }

  /* A restatement the writer leaves alone is finished with, not parked. */
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const sent = await page.evaluate(async () => {
      PENDING = [
        {id: 'p1', body: 'He keeps the second phone in the glovebox of the truck',
         project_id: 'p-nighthaul'},
        {id: 'p2', body: 'In the glovebox of the truck he keeps the second phone.',
         project_id: 'p-nighthaul'},
      ];
      placeGroupByHand('p-nighthaul');
      const out = [];
      const real = BF.api;
      BF.api = (u, o) => { out.push(JSON.parse(o.body)); return Promise.resolve({ok: true}); };
      document.getElementById('revgo').click();
      await new Promise(r => setTimeout(r, 80));
      BF.api = real;
      // Not out[0]: saving the board talks to the server first.
      const patch = out.find(x => x && Array.isArray(x.sorted)) || {};
      return {sorted: patch.sorted || [], left: PENDING.length,
              cards: P().cards.filter(c => /glovebox/i.test(c.text)).length};
    });
    check('only one of the two reaches the board', sent.cards === 1, String(sent.cards));
    check('and neither is left waiting in the pile', sent.left === 0,
      sent.left + ' left');
    check('both are marked dealt with', sent.sorted.length === 2, JSON.stringify(sent.sorted));
    await page.close();
  }

  /* ================================================ UNTICKING NEVER LOSES A NOTE
     Four ways a note could disappear, all found in one audit, all of them in
     the corners of the review sheet. Each one has a check here because each
     one was written, shipped and believed. */

  // The whole batch unticked. There is no board change, so the only thing that
  // can happen to those notes is the pile, and it used to be nothing.
  {
    const { page, errors } = await open(browser, [board('Night Haul', 6)]);
    const out = await page.evaluate(async () => {
      const posted = [];
      const real = BF.api;
      BF.api = (u, o) => {
        const b = o && o.body ? JSON.parse(o.body) : {};
        if (b.captures) posted.push(...b.captures.map(c => c.body));
        return Promise.resolve({ok: true, captures: [], days: []});
      };
      importIntoNew = false;
      plan = [{name: P().name, isCurrent: true, brief: {}, people: [], notes: [
        {text: 'she keeps the ticket stub in the visor', kind: 'beat', beat: null, conf: 0, keep: true},
        {text: 'the neighbour saw the truck at four in the morning', kind: 'beat', beat: null, conf: 0, keep: true},
      ]}];
      dedupePlan();
      renderReview();
      document.querySelectorAll('#revbody .revrow input[type=checkbox]').forEach(b2 => {
        b2.checked = false; b2.dispatchEvent(new Event('change'));
      });
      document.getElementById('revgo').click();
      await new Promise(r => setTimeout(r, 120));
      BF.api = real;
      return {posted, cards: P().cards.length};
    });
    check('unticking the whole batch parks both notes, it does not bin them',
      out.posted.length === 2, JSON.stringify(out.posted));
    check('and nothing lands on the board', out.cards === 6, String(out.cards));
    check('no page errors unticking everything', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // One group of two unticked. That group makes no project, which is right,
  // and its notes still have to go somewhere.
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const out = await page.evaluate(async () => {
      const posted = [];
      const real = BF.api;
      BF.api = (u, o) => {
        const b = o && o.body ? JSON.parse(o.body) : {};
        if (b.captures) posted.push(...b.captures.map(c => c.body));
        return Promise.resolve({ok: true, captures: [], days: []});
      };
      importIntoNew = false;
      plan = [
        {name: P().name, isCurrent: true, brief: {}, people: [], notes: [
          {text: 'he counts the money twice in the dark', kind: 'beat', beat: 'open', conf: 90, keep: true}]},
        {name: 'The Other Film', isCurrent: false, brief: {}, people: [], notes: [
          {text: 'a barn full of clocks that all say different times', kind: 'beat', beat: null, conf: 0, keep: true},
          {text: 'the auctioneer never blinks', kind: 'beat', beat: null, conf: 0, keep: true}]},
      ];
      dedupePlan();
      renderReview();
      // Untick only the second story, the way a writer says "not that film".
      const rows = Array.from(document.querySelectorAll('#revbody .revrow'));
      rows.slice(1).forEach(r => {
        const b2 = r.querySelector('input[type=checkbox]');
        b2.checked = false; b2.dispatchEvent(new Event('change'));
      });
      document.getElementById('revgo').click();
      await new Promise(r => setTimeout(r, 120));
      BF.api = real;
      return {posted, made: state.projects.length};
    });
    check('unticking one story of two parks its notes', out.posted.length === 2,
      JSON.stringify(out.posted));
    check('and does not create a project nobody ticked', out.made === 1,
      out.made + ' projects');
    await page.close();
  }

  // A park that fails must not be silent.
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const said = await page.evaluate(async () => {
      const real = BF.api;
      BF.api = (u, o) => {
        const b = o && o.body ? JSON.parse(o.body) : {};
        if (b.captures) return Promise.reject(new Error('offline'));
        return Promise.resolve({ok: true});
      };
      await parkUnticked([{text: 'one that did not make it', projectId: null}]);
      BF.api = real;
      const bar = document.getElementById('lowstrip');
      return bar ? bar.textContent : '';
    });
    check('a park that fails says so rather than swallowing it',
      /could not be saved to your pile/.test(said), said.slice(0, 90));
    check('and tells the writer to keep their own copy',
      /keep your notes file/.test(said), said.slice(0, 140));
    await page.close();
  }

  // Throw this away, on the route that had no link back to the pile.
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const sent = await page.evaluate(async () => {
      PENDING = [
        {id: 'g1', body: 'a real note about the bridge', project_id: 'p-nighthaul'},
        {id: 'g2', body: 'asdfgh pocket dial', project_id: 'p-nighthaul'},
      ];
      // What the PAID route leaves behind: the batch is claimed, but the rows
      // came back from the read as text and carry no ids.
      sortingIds = ['g1', 'g2'];
      importIntoNew = false;
      plan = [{name: P().name, isCurrent: true, brief: {}, people: [], notes: [
        {text: 'a real note about the bridge', kind: 'beat', beat: 'open', conf: 90, keep: true},
        {text: 'asdfgh pocket dial', kind: 'structural', beat: null, conf: 0, keep: true},
      ]}];
      dedupePlan();
      renderReview();
      const rows = Array.from(document.querySelectorAll('#revbody .revrow'));
      rows[1].querySelector('.revbin').click();          // throw the junk away
      const out = [];
      const real = BF.api;
      BF.api = (u, o) => { out.push(JSON.parse(o.body)); return Promise.resolve({ok: true}); };
      document.getElementById('revgo').click();
      await new Promise(r => setTimeout(r, 120));
      BF.api = real;
      const patch = out.find(x => x && (x.dropped || x.sorted)) || {};
      return {dropped: patch.dropped || [], sorted: patch.sorted || [],
              left: PENDING.map(c => c.id)};
    });
    check('throwing a note away after a read reaches the server',
      sent.dropped.join(',') === 'g2', JSON.stringify(sent));
    check('the one that was placed is marked sorted, not thrown away',
      sent.sorted.join(',') === 'g1', JSON.stringify(sent));
    check('and neither comes back tomorrow', sent.left.length === 0, sent.left.join(','));
    await page.close();
  }

  // A note the board already has can be cleared out of the pile.
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const out = await page.evaluate(async () => {
      P().cards.push({id: 970, slot: 'open', pinned: false,
        text: 'The dog will not go past the shed'});
      PENDING = [{id: 'b9', body: 'the dog will not go past the shed.',
                  project_id: 'p-nighthaul', project_name: 'Night Haul'}];
      placeGroupByHand('p-nighthaul');
      const row = document.querySelector('#revbody .revrow');
      const go = document.getElementById('revgo');
      const before = {ticked: !!row.querySelector('input[type=checkbox]:checked'),
                      says: row.querySelector('.dest').textContent,
                      dead: go.disabled, label: go.textContent};
      const real = BF.api;
      BF.api = () => Promise.resolve({ok: true});
      go.click();
      await new Promise(r => setTimeout(r, 120));
      BF.api = real;
      return {before, left: PENDING.length,
              cards: P().cards.filter(c => /past the shed/i.test(c.text)).length};
    });
    check('a note the board already has arrives unticked',
      out.before.ticked === false, JSON.stringify(out.before));
    check('and says it is the board it clashes with',
      /board already says this/.test(out.before.says), out.before.says);
    check('the button is alive so it can be finished with',
      out.before.dead === false && out.before.label === 'Done with these',
      JSON.stringify(out.before));
    check('pressing it clears the note out of the pile', out.left === 0, String(out.left));
    check('without adding a second copy to the board', out.cards === 1, String(out.cards));
    await page.close();
  }

  // And the same again through Cancel, which is what a writer actually presses
  // when they have decided none of it is for tonight.
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const out = await page.evaluate(async () => {
      const posted = [];
      const real = BF.api;
      BF.api = (u, o) => {
        const b = o && o.body ? JSON.parse(o.body) : {};
        if (b.captures) posted.push(...b.captures.map(c => c.body));
        return Promise.resolve({ok: true, captures: [], days: []});
      };
      importIntoNew = false;
      plan = [{name: P().name, isCurrent: true, brief: {}, people: [], notes: [
        {text: 'the church bell is three minutes fast', kind: 'beat', beat: null, conf: 0, keep: true},
      ]}];
      dedupePlan();
      renderReview();
      const box = document.querySelector('#revbody .revrow input[type=checkbox]');
      box.checked = false; box.dispatchEvent(new Event('change'));
      closeImport();
      await new Promise(r => setTimeout(r, 120));
      BF.api = real;
      return posted;
    });
    check('closing the sheet parks what was unticked rather than dropping it',
      out.length === 1, JSON.stringify(out));
    await page.close();
  }

  // Back hands the batch back.
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const after = await page.evaluate(() => {
      PENDING = [{id: 'r1', body: 'still mine', project_id: 'p-nighthaul'}];
      placeGroupByHand('p-nighthaul');
      const held = sortingIds.length;
      document.getElementById('revback').click();
      return {held, now: sortingIds.length};
    });
    check('the batch is claimed while the sheet is open', after.held === 1);
    check('and released the moment Back is pressed', after.now === 0,
      after.now + ' still held');
    await page.close();
  }

  /* ============================================ BACK GOES BACK, NOT NOWHERE
     Three ways into the review sheet, three different places behind it, and
     Back used to assume all three came from the paste box. */
  {
    const { page, errors } = await open(browser, [board('Night Haul', 6)]);

    // Placing by hand never touches the paste box, so Back must skip it.
    const hand = await page.evaluate(() => {
      PENDING = [{id: 'n1', body: 'the porch light is on at noon',
                  project_id: 'p-nighthaul', project_name: 'Night Haul'}];
      showPhonePile();
      document.querySelector('#sortgroups [data-hand]').click();
      const onReview = !document.getElementById('sheetreview').hidden;
      document.getElementById('revback').click();
      return {onReview,
              pile: !document.getElementById('sheetsort').hidden,
              paste: !document.getElementById('sheetpaste').hidden,
              held: sortingIds.length};
    });
    check('placing by hand opens the review sheet', hand.onReview === true);
    check('and Back from it returns to the pile, not to a box never seen',
      hand.pile === true && hand.paste === false, JSON.stringify(hand));
    check('and the batch goes back on the shelf', hand.held === 0, String(hand.held));

    // The paid route DOES go through the box, so the box gets its own Back.
    const read = await page.evaluate(() => {
      PENDING = [{id: 'n2', body: 'he pays cash for the second phone',
                  project_id: 'p-nighthaul', project_name: 'Night Haul'}];
      showPhonePile();
      document.querySelector('#sortgroups [data-sort]').click();
      const box = {open: !document.getElementById('sheetpaste').hidden,
                   back: !document.getElementById('dumpback').hidden,
                   text: dumptext.value.length > 0};
      document.getElementById('dumpback').click();
      return {box, pile: !document.getElementById('sheetsort').hidden,
              held: sortingIds.length, left: dumptext.value};
    });
    check('Read them for me opens the box with the notes in it',
      read.box.open === true && read.box.text === true, JSON.stringify(read.box));
    check('and that box has a Back, which it never did before',
      read.box.back === true);
    check('pressing it returns to the pile', read.pile === true, JSON.stringify(read));
    check('releases the batch', read.held === 0, String(read.held));
    check('and leaves nothing behind in the box', read.left === '', read.left);

    // A plain paste from the board has no pile behind it, so no Back to one.
    const plain = await page.evaluate(() => {
      openImport(false);
      return {back: !document.getElementById('dumpback').hidden};
    });
    check('a paste that did not come from the pile is not offered a Back to it',
      plain.back === false);
    check('no page errors moving backwards', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* ==================================================== WHEN DID I WRITE THIS
     Recorded on everything the writer makes, shown nowhere yet. A date can be
     put on screen later; a date never written down is gone. */
  {
    const { page } = await open(browser, [board('Night Haul', 6)]);
    const out = await page.evaluate(() => {
      const before = Date.now() - 1;
      // Placed from the capture bar. commit() is the function every route to
      // the board goes through, picker or suggestion, so it is the one worth
      // holding down rather than the select that leads to it.
      pending = {text: 'the second key is taped under the sill', options: []};
      commit('last');
      const placed = P().cards.find(c => /taped under the sill/.test(c.text));

      // Arrived through an import.
      importIntoNew = false;
      plan = [{name: P().name, isCurrent: true, brief: {}, people: [], notes: [
        {text: 'a coat left on the fence for three days', kind: 'beat', beat: 'open',
         conf: 90, keep: true}]}];
      dedupePlan();
      renderReview();
      document.getElementById('revgo').click();
      const imported = P().cards.find(c => /coat left on the fence/.test(c.text));

      // A character sheet made by hand.
      const person = blankChar();

      return {
        placed: placed ? placed.at : null,
        imported: imported ? imported.at : null,
        person: person.at || null,
        before,
        // Old cards, made before today, must stay undated rather than be
        // given a date they did not earn.
        old: P().cards.filter(c => /the card for /.test(c.text)).every(c => !c.at),
      };
    });
    check('a note placed by hand is dated', out.placed >= out.before, String(out.placed));
    check('a note that arrived in an import is dated',
      out.imported >= out.before, String(out.imported));
    check('a character sheet is dated', out.person >= out.before, String(out.person));
    check('and everything written before today stays undated rather than lying',
      out.old === true);

    // The edited date only moves when the words actually move.
    const edit = await page.evaluate(() => {
      const card = {text: 'she waits in the car', at: 1000};
      stampEdit(card, 'she waits in the car');
      const untouched = card.edited || null;
      card.text = 'she waits in the truck';
      stampEdit(card, 'she waits in the car');
      return {untouched, moved: !!card.edited, at: card.at};
    });
    check('saving without changing the words is not a rewrite',
      edit.untouched === null, String(edit.untouched));
    check('changing them is', edit.moved === true);
    check('and the day it arrived never moves', edit.at === 1000, String(edit.at));
    await page.close();
  }

  /* ================================================= AND NOW IT IS ON SCREEN
     Bottom right, hidden until the card is under the pointer, and absent
     entirely from everything that predates the recording. */
  {
    const { page, errors } = await open(browser, [board('Night Haul', 6)]);

    const shown = await page.evaluate(() => {
      const proj = P();
      // One card from today, one from last summer, one from before any of this
      // was written down. Three different answers on one board.
      proj.cards.push({id: 900, text: 'the second key is taped under the sill',
        slot: 'mid', pinned: true, at: Date.now()});
      proj.cards.push({id: 901, text: 'a coat left on the fence for three days',
        slot: 'bad', pinned: true,
        at: new Date(2025, 6, 12, 9).getTime(), edited: new Date(2025, 7, 1, 9).getTime()});
      render();

      const at = id => document.querySelector('.icard[data-id="' + id + '"]');
      const tagOf = id => at(id) && at(id).querySelector('.cdate');
      const older = tagOf(901);

      // The one that came with the board has no date and must not invent one.
      const legacy = at(1);

      const card = at(900);
      const tag = tagOf(900);
      const cbox = card.getBoundingClientRect();
      const tbox = tag.getBoundingClientRect();

      return {
        today: tag.textContent,
        thisYearHasNoYear: !/20\d\d/.test(tag.textContent),
        lastYearSaysSo: older.textContent.indexOf('2025') >= 0,
        // Both dates in the explainer once the words have been changed once.
        tipBoth: /Added .*2025.* Last changed .*2025/.test(older.getAttribute('data-tip') || ''),
        tipOne: (tag.getAttribute('data-tip') || '').indexOf('Last changed') < 0,
        legacyHasNone: !legacy.querySelector('.cdate'),
        hiddenAtRest: getComputedStyle(tag).opacity === '0',
        // Bottom right of the card it belongs to, and inside it.
        rightThird: tbox.left > cbox.left + (cbox.width * 0.5),
        bottomThird: tbox.top > cbox.top + (cbox.height * 0.5),
        insideCard: tbox.bottom <= cbox.bottom + 1 && tbox.right <= cbox.right + 1,
        cardHeight: cbox.height,
      };
    });
    check('a card made today shows the day it arrived', /\w/.test(shown.today), shown.today);
    check('and drops the year, since it is this one', shown.thisYearHasNoYear, shown.today);
    check('a card from last year keeps its year', shown.lastYearSaysSo);
    check('the explainer names both dates once the words have changed', shown.tipBoth);
    check('and only one when they have not', shown.tipOne);
    check('a card written before any of this stays undated', shown.legacyHasNone);
    check('the date is invisible until the card is under the pointer', shown.hiddenAtRest);
    check('it sits in the bottom right', shown.rightThird && shown.bottomThird,
      JSON.stringify({r: shown.rightThird, b: shown.bottomThird}));
    check('and inside the card, not hanging off it', shown.insideCard);

    // Hovering must reveal it and must not move the card, because a board that
    // reflows under the pointer is a board you cannot aim at.
    await page.hover('.icard[data-id="900"]');
    await page.waitForTimeout(200);
    const hovered = await page.evaluate(prev => {
      const card = document.querySelector('.icard[data-id="900"]');
      const tag = card.querySelector('.cdate');
      return {
        visible: getComputedStyle(tag).opacity === '1',
        sameHeight: Math.abs(card.getBoundingClientRect().height - prev) < 0.5,
      };
    }, shown.cardHeight);
    check('hovering shows it', hovered.visible);
    check('and the card does not change height when it appears', hovered.sameHeight);

    // A character sheet and a note both carry one, in the corner their own
    // layout leaves free.
    const others = await page.evaluate(() => {
      const proj = P();
      proj.characters = [Object.assign(blankChar(), {name: 'Dale', role: 'Protagonist',
        want: 'to get out from under the debt'})];
      proj.cards.push({id: 902, text: 'he never says her name out loud',
        slot: '__shelf', kind: 'line', at: Date.now()});
      setView('cast', true);
      const ccard = document.querySelector('#castgrid .ccard');
      const cmeta = ccard.querySelector('.cmeta');
      const cdate = ccard.querySelector('.cdate');
      const mbox = cmeta.getBoundingClientRect();
      const dbox = cdate.getBoundingClientRect();
      setView('notes', true);
      const ncard = document.querySelector('#notesbody .ncard');
      const ndate = ncard && ncard.querySelector('.cdate');
      const nb = ncard.getBoundingClientRect();
      const db = ndate && ndate.getBoundingClientRect();
      return {
        castHas: !!cdate,
        castHidden: getComputedStyle(cdate).opacity === '0',
        // At the right-hand end of the line it shares, not floating over it.
        castOnTheLine: Math.abs(dbox.right - mbox.right) < 2,
        noteHas: !!ndate,
        noteHidden: ndate ? getComputedStyle(ndate).opacity === '0' : false,
        noteInside: db ? (db.bottom <= nb.bottom + 1 && db.right <= nb.right + 1) : false,
        noteBottomRight: db ? (db.left > nb.left + nb.width * 0.5
          && db.top > nb.top + nb.height * 0.5) : false,
      };
    });
    check('a character sheet carries one too', others.castHas);
    check('quietly, until the card is under the pointer', others.castHidden);
    check('at the right end of the line it already had', others.castOnTheLine);
    check('and so does a note on the shelf', others.noteHas);
    check('the same way', others.noteHidden);
    check('inside its card, bottom right', others.noteInside && others.noteBottomRight);

    // Changing the words through the real control, not by calling stampEdit.
    const edited = await page.evaluate(async () => {
      setView('board', true);
      const card = document.querySelector('.icard[data-id="900"]');
      card.querySelector('.edit').click();
      const body = card.querySelector('.body');
      body.textContent = 'the second key is taped under the wheel arch';
      body.dispatchEvent(new Event('blur'));
      await new Promise(r => setTimeout(r, 150));
      const c = P().cards.find(x => x.id === 900);
      const tag = document.querySelector('.icard[data-id="900"] .cdate');
      return {
        marked: !!c.edited,
        stillSaysArrived: tag ? tag.textContent : '',
        tip: tag ? tag.getAttribute('data-tip') : '',
      };
    });
    check('changing a card in the app records that it changed', edited.marked);
    check('the face of it still says the day it arrived',
      /\w/.test(edited.stillSaysArrived), edited.stillSaysArrived);
    check('and the explainer picks up the change',
      edited.tip.indexOf('Last changed') >= 0, edited.tip);

    check('no page errors showing dates', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + ' of ' + results.length + ' passed');
  if (failed.length) { console.log('\nFAILED:'); failed.forEach(f => console.log('  ' + f.name + (f.detail ? '  [' + String(f.detail).slice(0,90) + ']' : ''))); }
})();
