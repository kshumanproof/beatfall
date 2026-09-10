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

const PAID = {email:'w@example.com', display_name:'Writer', plan:'beatfall',
  unlimited:false, trialing:false, credits_left:150, credits_allowance:150,
  credits_banked:0, current_period_end:'2026-10-01T00:00:00Z', has_history:true,
  plans:{beatfall:{credits:150,price:12}}, price_month:12, price_year:99};

const TRIAL = Object.assign({}, PAID, {plan:'trial', trialing:true,
  credits_left:25, credits_allowance:25, trial_ends_at:'2026-09-20T00:00:00Z',
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
      pasteCost: (document.getElementById('frpastecost') || {}).textContent || ''
    }));
    check('no Untitled project on a bare shelf', shelf.cards === 0, 'found ' + shelf.cards);
    check('the way to start is still there', shelf.blanks === 1, 'blank cards: ' + shelf.blanks);
    check('no scoreboard of noughts', shelf.score === true);
    check('the lede says nothing is saved', /Nothing saved yet/.test(shelf.lede), shelf.lede);
    check('the welcome sheet opens', shelf.welcome);
    check('it states the trial allowance', shelf.creditsShown && /25 credits/.test(shelf.credits), shelf.credits);
    check('the paid choice names its price', /2 credits/.test(shelf.pasteCost), JSON.stringify(shelf.pasteCost));
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
      boardVisible: !document.getElementById('boardview').hidden
    }));
    check('the locked screen is up', locked.up);
    check('a lapsed plan is called a plan, not a trial',
      /plan has ended/.test(locked.heading), locked.heading);
    check('every board is listed', locked.rows === 2, 'rows: ' + locked.rows + ' ' + JSON.stringify(locked.names));
    check('both prices are offered, not just the yearly',
      locked.buttons.some(b => /12 a month/.test(b)) && locked.buttons.some(b => /99 a year/.test(b)),
      JSON.stringify(locked.buttons));
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

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + ' of ' + results.length + ' passed');
  if (failed.length) { console.log('\nFAILED:'); failed.forEach(f => console.log('  ' + f.name)); process.exit(1); }
})();
