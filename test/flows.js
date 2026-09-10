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

const PAID = {email:'w@example.com', display_name:'Writer', plan:'beatfall', unlimited:false,
  trialing:false, credits_left:150, credits_allowance:150, credits_banked:0,
  current_period_end:'2026-10-01T00:00:00Z', has_history:true,
  plans:{beatfall:{credits:150,price:12}}, price_month:12, price_year:99};

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
      const btn = [...card.querySelectorAll('button')].find(b => /^edit$/i.test(b.textContent.trim()));
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

    // the two beat actions are different things and now say so
    const acts = await page.evaluate(() => {
      const card = [...document.querySelectorAll('#notesbody .ncard')]
        .find(c => /forty and tired/.test(c.textContent));
      const sels = [...card.querySelectorAll('select')];
      return sels.map(s => (s.options[0] || {}).textContent || '');
    });
    check('the notes page offers turning a note into a card',
      acts.some(a => /Turn into a beat card/.test(a)), JSON.stringify(acts));
    check('and filing one under a beat, which is not the same thing',
      acts.some(a => /File under a beat/.test(a)), JSON.stringify(acts));

    const both = await page.evaluate(() => {
      const card = [...document.querySelectorAll('#notesbody .ncard')]
        .find(c => /forty and tired/.test(c.textContent));
      const file = [...card.querySelectorAll('select')]
        .find(s => /File under a beat/.test(s.options[0].textContent));
      file.value = 'setup'; file.dispatchEvent(new Event('change'));
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

    // a line break must not weld two lines into one word
    const broke = await page.evaluate(() => {
      setView('notes', true);
      const card = [...document.querySelectorAll('#notesbody .ncard')]
        .find(c => /I do not steal cars/.test(c.textContent));
      const t = card.querySelector('.t');
      [...card.querySelectorAll('button')].find(b => /^edit$/i.test(b.textContent.trim())).click();
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
    const cycle = await page.evaluate(() => {
      const n0 = P().cards.length;
      document.querySelector('#board .icard .del').click();
      const n1 = P().cards.length;
      undo();
      return {n0, n1, n2: P().cards.length};
    });
    check('deleting a card removes exactly one', cycle.n1 === cycle.n0 - 1, JSON.stringify(cycle));
    check('and undo brings it back', cycle.n2 === cycle.n0, JSON.stringify(cycle));

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
    proj.characters = [{id: 'c1', name: 'Dale Rusk', role: 'protagonist', want: 'to get through the weekend'}];
    proj.cards.push({id: 80, text: 'a note that is not a beat', slot: '__shelf', kind: 'research'});
    proj.cards.push({id: 82, slot: '__shelf', kind: 'research',
      text: Array.from({length: 98}, (_, i) => 'word' + i).join(' ')
            + ' ninety ninth word of this research note'});
    proj.cards.push({id: 81, text: 'an idea set aside', slot: '__none'});
    const { page, errors } = await open(browser, [proj]);
    const pdf = await page.evaluate(async () => {
      await exportPDF(P());
      return window.__PDF__ || null;
    });
    check('the PDF builds', !!pdf, 'nothing produced');
    if (pdf) {
      check('it carries the project name', /Night Haul/i.test(pdf.text), pdf.name);
      check('it carries the board', /the card for open/i.test(pdf.text));
      check('it carries the outline prose', /two in the morning/i.test(pdf.text));
      check('it carries the cast', /Dale Rusk/i.test(pdf.text));
      check('it carries what was set aside', /an idea set aside/i.test(pdf.text));
      check('it carries the other notes', /not a beat/i.test(pdf.text));
      check('and prints a long one whole rather than cutting it',
        /ninety ninth word of this research note/i.test(pdf.text),
        'a long note was truncated');
      check('and heads that section', /other notes/i.test(pdf.text));
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

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + ' of ' + results.length + ' passed');
  if (failed.length) { console.log('\nFAILED:'); failed.forEach(f => console.log('  ' + f.name + (f.detail ? '  [' + String(f.detail).slice(0,90) + ']' : ''))); }
})();
