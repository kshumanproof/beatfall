/* Drive the real, shipped app.html headlessly. Every assertion below is about
   something changed tonight. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PAGE = 'file://' + path.resolve('stub.html');

function board(name, filled, structure = 'stc') {
  const slots = ['open','theme','setup','cat','debate','br2','bstory','fun','mid','bad','lost','dark','br3','fin','final'];
  return {
    id: 'p-' + name.toLowerCase().replace(/\W/g,''), name, structure, brief: {}, outline: {},
    characters: [], is_sample: false, created_from: 'new_project',
    updated_at: '2026-09-01T00:00:00Z',
    cards: slots.slice(0, filled).map((s, i) => ({id: i+1, text: 'card for ' + s, slot: s, pinned: true}))
  };
}

const results = [];
function check(name, ok, detail) {
  results.push({name, ok, detail});
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || !detail ? '' : '\n          ' + detail));
}

async function open(browser, {account, projects, closed, reason, query}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  // Fonts and the favicon are not reachable offline and say nothing about the
  // code under test.
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/ERR_TUNNEL|ERR_FILE_NOT_FOUND|ERR_NAME_NOT_RESOLVED|favicon/.test(t))
      errors.push('console: ' + t);
  });
  await page.addInitScript(([a, p, c, r]) => {
    window.__ACCOUNT__ = a; window.__PROJECTS__ = p;
    window.__CLOSED__ = c; window.__REASON__ = r;
  }, [account, projects, !!closed, reason || null]);
  await page.goto(PAGE + (query || ''));
  await page.waitForTimeout(700);
  return { page, errors };
}

/* Relative, not fixed. These used to be real dates, so as time passed the
   renewal drifted into the past and the trial drifted into its own final week,
   and a suite nobody had touched started failing on the strength of the
   calendar. Anything the app measures in "how long until" has to be measured
   from now here too. */
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

const PAID = {email:'w@example.com', display_name:'Writer', plan:'beatfall',
  unlimited:false, trialing:false, credits_left:150, credits_allowance:150,
  credits_banked:0, current_period_end:inDays(19), has_history:true,
  plans:{beatfall:{credits:150,price:12}}, price_month:12, price_year:99};

const TRIAL = Object.assign({}, PAID, {plan:'trial', trialing:true,
  credits_left:25, credits_allowance:25, trial_ends_at:inDays(13),
  current_period_end:null, has_history:false});

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ---------------------------------------------------------- the boot hold
  {
    const { page, errors } = await open(browser, {account: PAID, projects: [board('Night Haul', 9)]});
    check('boot hold is lifted once the shelf is drawn',
      await page.evaluate(() => !document.documentElement.classList.contains('booting')));
    check('the shelf is what you land on',
      await page.evaluate(() => !document.getElementById('slate').hidden));
    check('no page errors on a normal boot', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // -------------------------------------------------- a brand-new account
  {
    const { page, errors } = await open(browser, {account: TRIAL, projects: []});
    const shelf = await page.evaluate(() => ({
      cards: document.querySelectorAll('#slategrid .pcard:not(.newcard)').length,
      blanks: document.querySelectorAll('#slategrid .newcard').length,
      score: document.getElementById('slatescore').hidden,
      lede: document.getElementById('slatelede').textContent.trim(),
      welcome: !document.getElementById('firstrun').hidden,
      credits: (document.getElementById('frcredits') || {}).textContent || '',
      creditsShown: !(document.getElementById('frcredits') || {}).hidden,
      pasteCost: (document.getElementById('frpastecost') || {}).textContent || '',
      // Read the app's own price table rather than typing a figure here. A test
      // that pins 2 fails the day the price moves, for the only reason a test
      // must never fail: the test was the thing that was out of date.
      importCost: CREDIT.import
    }));
    check('no Untitled project on a bare shelf', shelf.cards === 0, 'found ' + shelf.cards);
    check('the way to start is still there', shelf.blanks === 1, 'blank cards: ' + shelf.blanks);
    check('no scoreboard of noughts', shelf.score === true);
    check('the lede says nothing is saved', /Nothing saved yet/.test(shelf.lede), shelf.lede);
    check('the welcome sheet opens', shelf.welcome);
    check('it states the trial allowance', shelf.creditsShown && /25 credits/.test(shelf.credits), shelf.credits);
    check('the paid choice names its price',
      new RegExp('\\b' + shelf.importCost + ' credits?\\b').test(shelf.pasteCost),
      JSON.stringify(shelf.pasteCost) + ' should name ' + shelf.importCost);
    check('no page errors on a new account', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------- naming a first project, no ghost
  {
    const { page, errors } = await open(browser, {account: TRIAL, projects: []});
    await page.evaluate(() => {
      document.getElementById('firstrun').hidden = true;
      document.querySelector('#slategrid .newcard').click();
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      document.getElementById('f-name').value = 'The Spillway';
      const f = document.getElementById('f-format'); f.value = 'stc';
      f.dispatchEvent(new Event('change'));
      document.getElementById('newgo').click();
    });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => state.projects.map(p => p.name));
    check('a first project replaces the placeholder rather than sitting beside it',
      after.length === 1 && after[0] === 'The Spillway', JSON.stringify(after));
    check('no page errors naming a project', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------- the importer picks a target
  {
    const { page } = await open(browser, {account: PAID,
      projects: [board('Night Haul', 9), board('Dirt Money', 4)]});
    const fromShelf = await page.evaluate(() => {
      state.view = 'slate';
      showFirstRun('welcome');
      document.querySelector('#firstrun .fr[data-go="paste"]').click();
      return importIntoNew;
    });
    check('from the shelf, an import makes its own project', fromShelf === true,
      'importIntoNew was ' + fromShelf);
    const fromBoard = await page.evaluate(() => {
      closeImport();
      setView('board', true);
      showFirstRun('welcome');
      document.querySelector('#firstrun .fr[data-go="paste"]').click();
      return importIntoNew;
    });
    check('from a board, an import fills that board', fromBoard === false,
      'importIntoNew was ' + fromBoard);
    await page.close();
  }

  // ------------------------------------------------------ editing a card
  {
    const { page, errors } = await open(browser, {account: PAID, projects: [board('Night Haul', 9)]});
    await page.evaluate(() => { state.activeId = state.projects[0].id; setView('board', true); });
    await page.waitForTimeout(200);
    const edit = await page.evaluate(() => {
      const card = document.querySelector('#board .icard');
      const btn = card && card.querySelector('.edit');
      if (!btn) return {found: false};
      btn.click();
      const body = card.querySelector('.body');
      return {found: true, editable: body.getAttribute('contenteditable') === 'true',
              tip: btn.getAttribute('data-tip') || ''};
    });
    check('a card carries a visible edit control', edit.found);
    check('pressing it makes the card editable', edit.editable === true);
    check('and it says what it does', /Change the wording/.test(edit.tip || ''), edit.tip);
    check('no page errors on the board', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------- a closed account keeps its work
  {
    const { page, errors } = await open(browser, {account: PAID, closed: true, reason: 'plan_ended',
      projects: [board('Night Haul', 9), board('Dirt Money', 15)]});
    const locked = await page.evaluate(() => ({
      up: !!document.querySelector('.locked'),
      heading: (document.querySelector('.locked h1') || {}).textContent || '',
      rows: document.querySelectorAll('.lp-row').length,
      names: [...document.querySelectorAll('.lp-name')].map(e => e.textContent),
      buttons: [...document.querySelectorAll('.locked-acts .bigbtn')].map(b => b.textContent.trim()),
      boardVisible: !document.getElementById('boardview').hidden,
      month: PRICES.month, year: PRICES.year
    }));
    check('the locked screen is up', locked.up);
    check('a lapsed plan is called a plan, not a trial',
      /plan has ended/.test(locked.heading), locked.heading);
    check('every board is listed', locked.rows === 2, 'rows: ' + locked.rows + ' ' + JSON.stringify(locked.names));
    check('both prices are offered, not just the yearly',
      locked.buttons.some(b => b.indexOf('$' + locked.month + ' a month') === 0)
      && locked.buttons.some(b => b.indexOf('$' + locked.year + ' a year') === 0),
      JSON.stringify(locked.buttons) + ' should offer $' + locked.month + ' and $' + locked.year);
    check('no board is left open underneath', locked.boardVisible === false);
    const pdf = await page.evaluate(async () => {
      window.__ERR__ = null;
      const orig = window.onerror;
      try { await exportPDF(state.projects[0]); } catch (e) { window.__ERR__ = String(e); }
      return window.__PDF__ || {err: window.__ERR__};
    });
    check('and pressing Save as PDF actually builds one', !!pdf && /Night Haul/i.test(pdf.text || ''),
      pdf ? pdf.name : 'no PDF produced');
    check('no page errors on the locked screen', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ----------------------------------------- a trial that ran out says so
  {
    const { page } = await open(browser, {account: TRIAL, closed: true, reason: 'trial_ended',
      projects: [board('Night Haul', 3)]});
    const h = await page.evaluate(() => (document.querySelector('.locked h1') || {}).textContent || '');
    check('an expired trial is not called an ended plan', /free trial has ended/.test(h), h);
    await page.close();
  }

  // ------------------------------------------- the credit marks scale
  {
    const { page } = await open(browser, {account: TRIAL, projects: [board('Night Haul', 3)]});
    const marks = await page.evaluate(() => {
      const out = {};
      BF.onCredits({left: 25, allowance: 25, banked: 0});
      out.freshTrialChip = !!document.getElementById('avatarlow');
      out.freshTrialStrip = !!document.getElementById('lowstrip');
      BF.onCredits({left: 4, allowance: 25, banked: 0});
      out.lowTrialChip = !!document.getElementById('avatarlow');
      return out;
    });
    check('a full trial is not warned it is running low', marks.freshTrialChip === false);
    check('and gets no strip either', marks.freshTrialStrip === false);
    check('but a nearly-spent trial is warned', marks.lowTrialChip === true);
    await page.close();
  }

  {
    const { page } = await open(browser, {account: PAID, projects: [board('Night Haul', 9)]});
    const paid = await page.evaluate(() => {
      const out = {};
      BF.onCredits({left: 150, allowance: 150, banked: 0});
      out.full = !!document.getElementById('avatarlow');
      BF.onCredits({left: 30, allowance: 150, banked: 0});
      out.at30 = !!document.getElementById('avatarlow');
      return out;
    });
    check('a full paid month is quiet', paid.full === false);
    check('and 30 left still warns, exactly as before', paid.at30 === true);
    await page.close();
  }

  // ------------------------------------------ coming back from Stripe
  {
    const { page, errors } = await open(browser, {account: PAID, projects: [board('Night Haul', 9)],
      query: '?checkout=done'});
    const strip = await page.evaluate(() => {
      const b = document.getElementById('lowstrip');
      return {shown: !!b, text: b ? b.textContent : '', url: location.search};
    });
    check('a completed checkout is confirmed on the dashboard', strip.shown && /You're set/.test(strip.text), strip.text);
    check('and the address is cleaned so a refresh does not repeat it', strip.url === '', strip.url);
    check('no page errors returning from Stripe', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  {
    const { page } = await open(browser, {account: Object.assign({}, PAID, {cancel_at_period_end: true}),
      projects: [board('Night Haul', 9)], query: '?billing=back'});
    const strip = await page.evaluate(() => {
      const b = document.getElementById('lowstrip');
      return b ? b.textContent : '';
    });
    check('returning from the portal states what is now true',
      /cancelled/i.test(strip) && /keeps working/i.test(strip), strip || 'no strip');
    await page.close();
  }

  // ------------------------------------------------- the plan label
  {
    const { page } = await open(browser, {account: PAID, projects: [board('Night Haul', 9)]});
    const label = await page.evaluate(() => document.getElementById('whoplan').textContent);
    check('nobody is quoted a monthly price we cannot verify',
      !/\$12 a month/.test(label) && /Beatfall/.test(label), label);
    await page.close();
  }

  // ------------------------------------------ the trial says goodbye
  {
    const soon = Object.assign({}, TRIAL,
      {trial_ends_at: new Date(Date.now() + 5 * 86400000).toISOString()});
    const { page } = await open(browser, {account: soon, projects: [board('Night Haul', 3)]});
    const said = await page.evaluate(() => {
      const b = document.getElementById('lowstrip');
      return b ? b.textContent : '';
    });
    check('a week out, the trial says how long is left', /5 days left/.test(said), said || 'nothing');
    const twice = await page.evaluate(() => {
      const b = document.getElementById('lowstrip'); if (b) b.remove();
      trialRamp(ME);
      return !!document.getElementById('lowstrip');
    });
    check('and does not say it again', twice === false);

    // the flag must not be spent when the notice could not be shown
    const notBurned = await page.evaluate(() => {
      const email = 'other@example.com';
      Object.keys(localStorage).filter(k => k.indexOf('beatfall.trialsaid') === 0)
        .forEach(k => localStorage.removeItem(k));
      // something else is already holding the foot of the window
      sayStrip('<b>Checkout cancelled.</b>', 'good');
      trialRamp({email, trialing: true,
        trial_ends_at: new Date(Date.now() + 5 * 86400000).toISOString()});
      const burned = !!localStorage.getItem('beatfall.trialsaid.week.' + email);
      document.getElementById('lowstrip').remove();
      trialRamp({email, trialing: true,
        trial_ends_at: new Date(Date.now() + 5 * 86400000).toISOString()});
      const shownNow = !!document.getElementById('lowstrip');
      return {burned, shownNow};
    });
    check('a warning that could not be shown is not counted as said',
      notBurned.burned === false, JSON.stringify(notBurned));
    check('and it appears at the next chance', notBurned.shownNow === true,
      JSON.stringify(notBurned));

    const expired = await page.evaluate(() => {
      const b = document.getElementById('lowstrip'); if (b) b.remove();
      trialRamp({email: 'x@y.z', trialing: true,
        trial_ends_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString()});
      return !!document.getElementById('lowstrip');
    });
    check('a trial that already ended does not say it ends today', expired === false);
    await page.close();
  }

  {
    const last = Object.assign({}, TRIAL,
      {trial_ends_at: new Date(Date.now() + 1.2 * 86400000).toISOString()});
    const { page } = await open(browser, {account: last, projects: [board('Night Haul', 3)]});
    const said = await page.evaluate(() => {
      const b = document.getElementById('lowstrip');
      return {text: b ? b.textContent : '',
              plans: b ? [...b.querySelectorAll('button')].some(x => /See the plans/.test(x.textContent)) : false};
    });
    check('two days out it says what happens to the boards',
      /trial ends/.test(said.text) && /download any board/.test(said.text), said.text || 'nothing');
    check('and offers the plans', said.plans === true);
    await page.close();
  }

  // ------------------------------------------ a save that will not land
  {
    const { page, errors } = await open(browser, {account: PAID, projects: [board('Night Haul', 9)]});
    const rescue = await page.evaluate(async () => {
      BF.saveProject = async () => { throw Object.assign(new Error('nope'), {status: 500}); };
      const p = P(); p.name = 'Night Haul edited'; dirty.add(p);
      for (let i = 0; i < 14; i++) { try { await flush(); } catch (e) {} }
      const bar = document.getElementById('rescue');
      return {up: !!bar, text: bar ? bar.textContent : '',
              offers: bar ? [...bar.querySelectorAll('button')].map(b => b.textContent) : []};
    });
    check('a save that keeps failing eventually offers a way out', rescue.up === true,
      'no rescue strip after fourteen failures');
    check('it says nothing has been lost', /has been lost|Nothing you have written/.test(rescue.text),
      rescue.text.slice(0, 120));
    check('and hands over a copy', rescue.offers.some(o => /Download a copy/.test(o)),
      JSON.stringify(rescue.offers));
    check('no page errors while saving fails', errors.length === 0, errors.join('\n'));

    // and it comes down again when saving comes back
    const recovered = await page.evaluate(async () => {
      BF.saveProject = async p => Object.assign({}, p, {id: p.id || 'srv1', updated_at: new Date().toISOString()});
      const p = P(); p.name = 'Night Haul back'; dirty.add(p);
      await flush();
      await new Promise(r => setTimeout(r, 60));
      return {bar: !!document.getElementById('rescue'), fails: saveFails};
    });
    check('and comes down when saving works again', recovered.bar === false,
      JSON.stringify(recovered));
    check('and stops counting failures', recovered.fails === 0, JSON.stringify(recovered));
    await page.close();
  }

  // ------------------------------------------ dismissing it means dismissed
  {
    const { page } = await open(browser, {account: PAID, projects: [board('Night Haul', 9)]});
    const stayed = await page.evaluate(async () => {
      BF.saveProject = async () => { throw Object.assign(new Error('nope'), {status: 500}); };
      const p = P(); p.name = 'edited'; dirty.add(p);
      for (let i = 0; i < 14; i++) { try { await flush(); } catch (e) {} }
      const bar = document.getElementById('rescue');
      [...bar.querySelectorAll('button')].find(b => /Hide this/.test(b.textContent)).click();
      for (let i = 0; i < 6; i++) { try { await flush(); } catch (e) {} }
      return !!document.getElementById('rescue');
    });
    check('hiding the rescue bar keeps it hidden', stayed === false,
      'it came back on the next retry');
    await page.close();
  }

  // ------------------------------------------ the placeholder stays known
  {
    const { page } = await open(browser, {account: TRIAL, projects: []});
    const survives = await page.evaluate(() => {
      const before = bareShelf();
      // what happens the moment the placeholder reaches the server
      state.projects[0].id = 'srv-placeholder';
      const after = bareShelf();
      return {before, after};
    });
    check('the shelf is still known to be bare after the placeholder saves',
      survives.before === true && survives.after === true, JSON.stringify(survives));

    const clean = await page.evaluate(() => {
      dirty.clear();
      save();
      return dirty.size;
    });
    check('and an untouched placeholder is never queued for saving', clean === 0,
      'it was queued, which is how it reached the database');

    const noGhost = await page.evaluate(() => {
      dirty.add(state.projects[0]);
      const pr = blankProject('The Spillway', 'stc');
      takePlaceholder(pr);
      return {projects: state.projects.map(p => p.name), queued: dirty.size};
    });
    check('replacing it leaves exactly one project', noGhost.projects.length === 1,
      JSON.stringify(noGhost));
    check('and nothing queued to write the ghost anyway', noGhost.queued === 0,
      JSON.stringify(noGhost));
    await page.close();
  }

  /* ---- the masthead and the wait wall ---------------------------------
     The tagline is a CSS mask, and a mask that fails draws a solid bar rather
     than nothing, which reads as a design decision instead of a fault. It
     shipped broken for a fortnight that way. And the column it now sits in
     could quietly have cost the bar its alignment: a flex column takes its
     baseline from its FIRST item, so the project name beside the lockup still
     sits on the wordmark. If that ever stops being true the name drops about
     17px and the whole bar looks wrong. */
  {
    const { page, errors } = await open(browser, {
      account: {plan: 'pro', credits_used: 0},
      projects: [board('The Spillway', 15)],
    });
    const m = await page.evaluate(() => {
      const tag = document.querySelector('header .masthead .brandtag');
      const mk = document.querySelector('header .masthead .brandmark');
      if (!tag || !mk) return null;
      const t = tag.getBoundingClientRect(), k = mk.getBoundingClientRect();
      // A span of text dropped into the same baseline aligned row, because
      // the project name is empty on a fresh board.
      const s = document.createElement('span');
      s.textContent = 'Xg'; s.style.font = '14px monospace'; s.style.lineHeight = '1';
      document.querySelector('header .lead').appendChild(s);
      const r = s.getBoundingClientRect();
      s.remove();
      const cs = getComputedStyle(tag);
      return {tw: t.width, th: t.height, under: t.top >= k.bottom - 1,
              masked: (cs.maskImage || cs.webkitMaskImage || '').indexOf('svg') > 0,
              drift: Math.abs(r.bottom - k.bottom),
              bar: document.querySelector('header .topline').getBoundingClientRect().height};
    });
    check('the tagline is in the app header', !!m && m.tw > 100,
      m ? JSON.stringify(m) : 'no .brandtag in the top bar');
    if (m) {
      check('and it is the artwork, not a solid bar', m.masked);
      check('and it sits under the wordmark', m.under);
      // Cap height, not box height: the box carries the descender on the p.
      check('and its capitals reach 8px (' + (m.th * 25.58 / 32.66).toFixed(1) + 'px)',
        m.th * 25.58 / 32.66 >= 8, String(m.th));
      check('and the project name still sits on the wordmark',
        m.drift <= 4, m.drift + 'px off the mark');
      check('and the bar did not grow to take it', m.bar <= 80, m.bar + 'px');
    }

    const wall = await page.evaluate(() => {
      showWall(true);
      const el = document.getElementById('loadwall');
      const cs = getComputedStyle(el);
      const opened = document.getElementById('loadbar').style.width;
      wallStep('Reading notes 41 to 80 of 83', .48);
      return {up: el.hidden === false, bg: cs.backgroundColor,
              blur: cs.backdropFilter || cs.webkitBackdropFilter, opened,
              step: document.getElementById('loadstep').textContent,
              moved: document.getElementById('loadbar').style.width,
              down: (showWall(false), el.hidden)};
    });
    check('the wait wall goes up for a read', wall.up);
    check('and it veils the sheet rather than covering it',
      /rgba\(|\/\s*0?\.\d/.test(wall.bg) && /blur/.test(wall.blur || ''),
      wall.bg + ' | ' + wall.blur);
    check('and it opens on the first pass with an empty rail',
      wall.opened === '0%', wall.opened);
    check('and the status line names the pass the read is actually on',
      wall.step === 'Reading notes 41 to 80 of 83', wall.step);
    check('and the rail only moves when it is told to', wall.moved === '48%', wall.moved);
    check('and the wall comes down again', wall.down === true);
    check('no page errors around the wall', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* ---- the padlock, and the class name that must not be `locked` ---------
     `.locked` on its own is the full-screen one-device blocker: position fixed
     over the whole app. A card given that class grew to fill the window, which
     is the SECOND time this file has cost somebody an hour (the first was the
     Outline nav button, written up in CLAUDE.md). The size check below is the
     real one: it fails whatever the class is called if a locked card stops
     being a card. */
  {
    const { page, errors } = await open(browser, {
      account: {plan: 'pro', credits_used: 0},
      projects: [board('The Spillway', 15)],
    });
    await page.evaluate(() => {
      state.activeId = state.projects[0].id; setView('board'); render();
    });
    await page.waitForTimeout(300);

    const lock = await page.evaluate(() => {
      const size = () => {
        const c = document.querySelector('.icard');
        const b = c.getBoundingClientRect();
        return {w: Math.round(b.width), h: Math.round(b.height),
                pos: getComputedStyle(c).position};
      };
      const id = +document.querySelector('.icard').dataset.id;
      const before = size();
      document.querySelector('.icard .pin').click();
      const shut = size();
      const el = document.querySelector('.icard');
      const out = {
        before, shut,
        flag: P().cards.find(c => c.id === id).locked === true,
        draggable: el.draggable,
        moveDisabled: el.querySelector('.move').disabled,
        gold: el.className,
      };
      document.querySelector('.icard .pin').click();
      out.open = size();
      out.unflagged = !P().cards.find(c => c.id === id).locked;
      out.draggableAgain = document.querySelector('.icard').draggable;
      return out;
    });

    check('the padlock locks the card', lock.flag);
    check('and a locked card is not the full-screen blocker in disguise',
      lock.shut.w === lock.before.w && lock.shut.h === lock.before.h
      && lock.shut.pos === 'relative',
      JSON.stringify(lock.before) + ' became ' + JSON.stringify(lock.shut));
    check('and it cannot be dragged', lock.draggable === false);
    check('and the move menu refuses too', lock.moveDisabled === true);
    check('and it carries the gold edge', /card-locked/.test(lock.gold), lock.gold);
    check('the padlock unlocks it again', lock.unflagged && lock.draggableAgain === true);
    check('and the card is the size it started', lock.open.w === lock.before.w);

    /* Nothing but the padlock may lock. Every placement used to set the old
       flag, which is what made the control decoration. */
    const placing = await page.evaluate(() => {
      const c = P().cards[1];
      c.slot = 'mid'; render();
      const byHand = !c.locked;
      const fresh = {id: 9001, text: 'a new one', slot: 'open'};
      P().cards.push(fresh); render();
      return byHand && !P().cards.find(x => x.id === 9001).locked;
    });
    check('and a placement never locks anything on its own', placing === true);
    check('no page errors around the padlock', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* ---- asking before it spends ------------------------------------------
     Nothing may take a credit without the writer having agreed to that price
     at least once, before the charge. Once per KIND, not once per press and
     not once per price: five questions in the life of an account. This is the
     money path, so it gets held down properly. */
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    const asked = [];
    page.on('dialog', async d => { asked.push(d.message()); await d.accept(); });
    await page.addInitScript(([a, p]) => {
      window.__ACCOUNT__ = a; window.__PROJECTS__ = p;
    }, [{id: 'u1', plan: 'pro', credits_used: 0}, [board('The Spillway', 12)]]);
    await page.goto(PAGE);
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      state.activeId = state.projects[0].id; setView('board'); render();
    });
    await page.waitForTimeout(300);

    const marked = await page.evaluate(() =>
      [...document.querySelectorAll('[data-costed]')].every(e => !!e.dataset.kind));
    check('every paid control records which kind it is', marked === true);

    // the same kind three times asks once
    await page.evaluate(async () => {
      const w = () => new Promise(r => setTimeout(r, 90));
      for (let i = 0; i < 3; i++){
        document.getElementById('whatsmissing').click(); await w(); closeAsk();
      }
    });
    check('it asks the first time a kind is used', asked.length === 1, JSON.stringify(asked));
    const talkCost = await page.evaluate(() => CREDIT.conversation);
    check('and names the price',
      new RegExp('costs ' + talkCost + ' credits?', 'i').test(asked[0] || ''),
      asked[0] + '  (should name ' + talkCost + ')');
    check('and does not ask again for that kind', asked.length === 1,
      asked.length + ' dialogs for three presses of one kind');

    const kept = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('beatfall.spendok') || '{}'));
    check('and remembers it against the account', !!(kept.u1 && kept.u1.conversation),
      JSON.stringify(kept));

    /* Refusing must stop the action, not merely warn about it. A gate that
       asks and then runs anyway is worse than no gate. */
    const refused = await page.evaluate(async () => {
      localStorage.removeItem('beatfall.spendok');
      window.confirm = () => false;
      document.getElementById('whatsmissing').click();
      await new Promise(r => setTimeout(r, 150));
      return {open: !document.getElementById('askscrim').hidden,
              kept: localStorage.getItem('beatfall.spendok')};
    });
    check('answering no stops the action running', refused.open === false,
      'the conversation opened anyway');
    check('and no agreement is recorded', !refused.kept, String(refused.kept));

    /* And the escape hatch for anyone who wants the toll booth every time. */
    const always = await page.evaluate(async () => {
      localStorage.setItem('beatfall.askalways', '1');
      let n = 0;
      window.confirm = () => { n++; return true; };
      const w = () => new Promise(r => setTimeout(r, 90));
      for (let i = 0; i < 3; i++){
        document.getElementById('whatsmissing').click(); await w(); closeAsk();
      }
      localStorage.removeItem('beatfall.askalways');
      return n;
    });
    check('and "ask before every credit" really does ask every time', always === 3,
      always + ' of 3');
    check('no page errors around the spend gate', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------------------------- vision --
  /* A photograph is a note with a picture on it. These check that it really is
     one, rather than a second system wearing a note's clothes: it groups and
     filters with the others, it files under a beat, it deletes with the same
     confirm, and the two things it must NOT do are be offered as a beat card
     or be sent to a paid conversation about a filename. */
  {
    const proj = board('The Spillway', 4);
    proj.characters = [
      {id: 'c1', name: 'Mara Vance', role: 'Protagonist', want: 'the bar'},
      {id: 'c2', name: 'Dale Rusk',  role: 'Antagonist',  want: 'out'}
    ];
    proj.cards.push({id: 70, slot: '__shelf', kind: 'photo', img: 'u1/face.jpg',
                     text: 'a face in the crowd'});
    proj.cards.push({id: 71, slot: '__shelf', kind: 'research', text: 'a written note'});

    const { page, errors } = await open(browser, {account: PAID, projects: [proj]});
    await page.evaluate(() => { state.activeId = state.projects[0].id; setView('notes', true); });
    await page.waitForTimeout(400);

    const seen = await page.evaluate(() => {
      const card = [...document.querySelectorAll('.ncard.photo')][0];
      const chips = [...document.querySelectorAll('.fchip')].map(b => b.textContent.trim());
      const selects = card ? [...card.querySelectorAll('select')] : [];
      return {
        card: !!card,
        chip: (card && card.querySelector('.chip').textContent) || '',
        chips,
        src: (card && card.querySelector('.nphoto img').getAttribute('src')) || '',
        caption: (card && card.querySelector('.t').textContent) || '',
        paid: !!(card && card.querySelector('.noteask')),
        boardOption: selects.some(s => /Make it a card on the board/.test(s.innerHTML)),
        fileOption:  selects.some(s => /Keep it a note, filed under/.test(s.innerHTML)),
        faceOption:  selects.some(s => /Put this face on/.test(s.innerHTML)),
        kindOption:  selects.some(s => /Open question/.test(s.innerHTML)),
        dropdowns:   selects.length,
        // and the type control is still there on a written note, where it belongs
        writtenKinds: (() => {
          const w = [...document.querySelectorAll('.ncard')].find(e => !e.classList.contains('photo'));
          return w ? [...w.querySelectorAll('select')].some(s => /Open question/.test(s.innerHTML)) : null;
        })()
      };
    });

    check('a photo note appears in Notes like any other', seen.card === true);
    check('and is labelled Vision', /Vision/.test(seen.chip), seen.chip);
    check('and gets its own filter, because the project has pictures',
      seen.chips.some(t => /^Vision/.test(t)), JSON.stringify(seen.chips));
    check('the picture is actually fetched and shown',
      seen.src.indexOf('data:image') === 0, seen.src.slice(0, 40));
    check('and the filename became a caption you can edit',
      /a face in the crowd/.test(seen.caption), seen.caption);
    check('a picture is never offered as a card on the board',
      seen.boardOption === false, 'a photo can be made a beat card');
    check('but can still be filed under a beat', seen.fileOption === true);
    check('and is never sent to a paid conversation about a filename',
      seen.paid === false, 'the credit-charging control is on a photo card');

    /* A PHOTOGRAPH HAS NO TYPE TO CHANGE, AND CHANGING IT DESTROYED THE PICTURE.
       Setting the kind to anything else makes this stop being a photo card, and
       the frame that draws the image only exists on a photo card: the file
       stayed in storage, the caption stayed on screen, and the picture was gone
       with no way back. Two controls, and they are the only two things a
       picture can do. */
    check('a picture is not offered a type to be reclassified as',
      seen.kindOption === false, 'the type dropdown is on a photo card');
    check('which leaves exactly two controls on it, a beat and a character',
      seen.dropdowns === 2, seen.dropdowns + ' dropdowns on a photo card');
    check('and a written note keeps its type control',
      seen.writtenKinds === true, 'regrouping a misfiled note is no longer possible');

    // ---- the whole point: put it on somebody
    check('a photo offers the characters', seen.faceOption === true);
    const assigned = await page.evaluate(async () => {
      const card = document.querySelector('.ncard.photo');
      const who = [...card.querySelectorAll('select')]
        .find(s => /Put this face on/.test(s.innerHTML));
      who.value = 'c1';
      who.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 200));
      const p = state.projects[0];
      return {
        face: (p.characters.find(c => c.id === 'c1') || {}).face || '',
        other: (p.characters.find(c => c.id === 'c2') || {}).face || '',
        says: (document.querySelector('.ncard.photo .face') || {}).textContent || '',
        stillThere: p.cards.filter(c => c.kind === 'photo').length
      };
    });
    check('assigning puts the face on that character', assigned.face === 'u1/face.jpg',
      JSON.stringify(assigned));
    check('and on nobody else', assigned.other === '');
    check('and the card says whose sheet it is on',
      /Mara Vance/.test(assigned.says), assigned.says);
    check('and the picture stays in Vision rather than being consumed',
      assigned.stillThere === 1, 'the photo left Notes when it was assigned');

    // ---- one picture is never two people's face
    const moved = await page.evaluate(async () => {
      const card = document.querySelector('.ncard.photo');
      const who = [...card.querySelectorAll('select')]
        .find(s => /Put this face on/.test(s.innerHTML));
      who.value = 'c2';
      who.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 200));
      const p = state.projects[0];
      return [(p.characters.find(c => c.id === 'c1') || {}).face || '',
              (p.characters.find(c => c.id === 'c2') || {}).face || ''];
    });
    check('moving a face to somebody else takes it off the first',
      moved[0] === '' && moved[1] === 'u1/face.jpg', JSON.stringify(moved));

    // ---- and it comes off the sheet when the picture is thrown away
    await page.evaluate(() => { window.confirm = () => true; });
    const afterDelete = await page.evaluate(async () => {
      document.querySelector('.ncard.photo .del').click();
      await new Promise(r => setTimeout(r, 200));
      const p = state.projects[0];
      return {
        photos: p.cards.filter(c => c.kind === 'photo').length,
        face: (p.characters.find(c => c.id === 'c2') || {}).face || ''
      };
    });
    check('deleting a picture takes it off the sheet too', afterDelete.photos === 0
      && afterDelete.face === '', JSON.stringify(afterDelete));

    check('no page errors around pictures', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // --------------------------------------------- a picture that is gone --
  /* Thirty days after a plan ends the pictures are swept and the words stay.
     The card is still there and has to say what happened rather than showing a
     broken image icon and letting the writer think the app lost it. */
  {
    const proj = board('The Spillway', 4);
    proj.cards.push({id: 72, slot: '__shelf', kind: 'photo', img: 'u1/missing.jpg',
                     text: 'a picture that was swept'});
    const { page, errors } = await open(browser, {account: PAID, projects: [proj]});
    await page.evaluate(() => { state.activeId = state.projects[0].id; setView('notes', true); });
    await page.waitForTimeout(400);
    const gone = await page.evaluate(() => {
      const box = document.querySelector('.ncard.photo .nphoto');
      return {said: box ? box.textContent : '',
              note: !!document.querySelector('.ncard.photo'),
              words: (document.querySelector('.ncard.photo .t') || {}).textContent || ''};
    });
    check('a swept picture still leaves its note behind', gone.note === true);
    check('and the words are untouched', /a picture that was swept/.test(gone.words), gone.words);
    check('and it says the picture is gone rather than showing a broken one',
      /no longer stored/i.test(gone.said), gone.said);
    check('no page errors on a missing picture', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------- pictures from this computer --
  /* The desk half of the capture. A file goes in, it is redrawn smaller and
     re-encoded as a JPEG before it ever reaches the network, and what lands is
     a note like any other with the filename as its first caption. */
  {
    const proj = board('The Spillway', 4);
    const { page, errors } = await open(browser, {account: PAID, projects: [proj]});
    await page.evaluate(() => { state.activeId = state.projects[0].id; setView('notes', true); });
    await page.waitForTimeout(300);

    // A real 8x8 PNG, so the canvas has something to decode.
    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHElEQVQoz2P8//8/AzZgYmJiYmL'
      + '6//8/AzbAxMTExMTEBABPQwX1eN5ZzAAAAABJRU5ErkJggg==', 'base64');
    await page.setInputFiles('#photofile', [
      { name: 'the_bar_at_four.png', mimeType: 'image/png', buffer: PNG }
    ]);
    await page.waitForTimeout(700);

    const got = await page.evaluate(() => {
      const p = state.projects[0];
      const shot = p.cards.filter(c => c.kind === 'photo');
      return {
        made: shot.length,
        caption: (shot[0] || {}).text || '',
        path: (shot[0] || {}).img || '',
        shelf: (shot[0] || {}).slot || '',
        sent: (window.__UPLOADED__ || []).map(u => u.type),
        onScreen: document.querySelectorAll('.ncard.photo').length,
        button: (document.getElementById('photoadd') || {}).disabled
      };
    });
    check('a picture chosen on this computer becomes a note', got.made === 1,
      JSON.stringify(got));
    check('and lands in Notes with everything else', got.shelf === '__shelf', got.shelf);
    check('and the filename becomes a readable caption',
      got.caption === 'the bar at four', got.caption);
    check('and it carries the path, not the bytes',
      /^u1\//.test(got.path) && got.path.length < 40, got.path);
    check('a PNG is re-encoded as a JPEG before it is sent',
      JSON.stringify(got.sent) === '["image/jpeg"]', JSON.stringify(got.sent));
    check('and it is on screen straight away', got.onScreen === 1);
    check('and the button goes back to being pressable', got.button === false);

    // ---- no room left
    const refused = await page.evaluate(async () => {
      window.__NO_ROOM__ = true;
      const before = state.projects[0].cards.filter(c => c.kind === 'photo').length;
      return before;
    });
    await page.setInputFiles('#photofile', [
      { name: 'one_too_many.png', mimeType: 'image/png', buffer: PNG }
    ]);
    await page.waitForTimeout(700);
    const full = await page.evaluate(() => ({
      said: (document.getElementById('photoerr') || {}).textContent || '',
      hidden: (document.getElementById('photoerr') || {}).hidden,
      photos: state.projects[0].cards.filter(c => c.kind === 'photo').length
    }));
    check('a full account is told in words', /no room/i.test(full.said) && !full.hidden,
      JSON.stringify(full));
    check('and no empty card is left behind', full.photos === refused, JSON.stringify(full));
    check('no page errors importing pictures', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + ' of ' + results.length + ' passed');
  if (failed.length) { console.log('\nFAILED:'); failed.forEach(f => console.log('  ' + f.name)); process.exit(1); }
})();
