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
      return card ? {slot: card.slot, pinned: card.pinned} : null;
    });
    check('choosing a beat puts the card exactly there',
      placed && placed.slot === 'last', JSON.stringify(placed));
    // Not pinned, deliberately: it behaves exactly as accepting a suggestion
    // does. Pinning only a hand-placed card would put a gold edge on it and
    // teach a distinction nobody asked for.
    check('and behaves the same as accepting a suggestion', placed && placed.pinned === false,
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
      return {left: plan[0].notes.map(n => n.text), skipped: revSkipped};
    });
    check('a note already in Other notes is dropped, full stop or not',
      seen.left.indexOf('the dog barks at nothing') < 0, seen.left.join(' | '));
    check('a note already in Set aside is dropped',
      seen.left.indexOf('A car idles across the street.') < 0, seen.left.join(' | '));
    check('a note already on the board is dropped',
      seen.left.indexOf('the card for open') < 0, seen.left.join(' | '));
    check('and a genuinely new note survives', seen.left.length === 1, seen.left.join(' | '));
    check('all three are counted as already there', seen.skipped === 3, 'skipped: ' + seen.skipped);
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
              go: document.getElementById('revgo').disabled};
    });
    check('a batch that was all copies says so', /already on your board/.test(seen.text),
      seen.text.slice(0, 90));
    check('and there is nothing to press', seen.go === true);
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

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + ' of ' + results.length + ' passed');
  if (failed.length) { console.log('\nFAILED:'); failed.forEach(f => console.log('  ' + f.name + (f.detail ? '  [' + String(f.detail).slice(0,90) + ']' : ''))); }
})();
