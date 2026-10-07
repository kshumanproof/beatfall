/* Drive the real, shipped app.html headlessly. Every assertion below is about
   something changed tonight. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PAGE = 'file://' + path.resolve('stub.html');

function board(name, filled, structure = 'stc') {
  /* 'last', not 'final'. Save the Cat's fifteenth beat is Final Image and its
     id is `last`, so this fixture spent its life filling fourteen beats while
     every test that asked for fifteen believed it had them. Same trap as the
     `.locked` collision: a name that reads right and is not the one in the
     code. flows.js has the same list; keep them the same. */
  const slots = ['open','theme','setup','cat','debate','br2','bstory','fun','mid','bad','lost','dark','br3','fin','last'];
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

async function open(browser, {account, projects, closed, reason, query, days, capfail, store}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  /* Where the page tried to GO, which is not the same as where it ended up.
     A redirect to /admin.html from a file on disk lands on a browser error
     screen, so page.url() afterwards says chrome-error and nothing about
     whether the app did the right thing. The request is the evidence. */
  const navs = [];
  page.on('request', r => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navs.push(r.url());
  });
  // Fonts and the favicon are not reachable offline and say nothing about the
  // code under test.
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/ERR_TUNNEL|ERR_FILE_NOT_FOUND|ERR_NAME_NOT_RESOLVED|favicon/.test(t))
      errors.push('console: ' + t);
  });
  await page.addInitScript(([a, p, c, r, d, f, ls]) => {
    window.__ACCOUNT__ = a; window.__PROJECTS__ = p;
    window.__CLOSED__ = c; window.__REASON__ = r;
    window.__DAYS__ = d || []; window.__CAPFAIL__ = !!f;
    /* Seeded BEFORE the app runs, because the whole question about the streak
       is what this browser already had in it when somebody signed in. */
    try { Object.keys(ls || {}).forEach(k => localStorage.setItem(k, ls[k])); } catch (e) {}
  }, [account, projects, !!closed, reason || null, days || [], !!capfail, store || null]);
  await page.goto(PAGE + (query || ''));
  await page.waitForTimeout(700);
  return { page, errors, navs };
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
      /* A brand-new account is walked through first. The greeting, which is
         where the three ways in live, follows once the walkthrough is done
         with. Both are checked below. */
      walk: !document.getElementById('walk').hidden,
      welcome: !document.getElementById('firstrun').hidden
    }));
    check('no Untitled project on a bare shelf', shelf.cards === 0, 'found ' + shelf.cards);
    check('the way to start is still there', shelf.blanks === 1, 'blank cards: ' + shelf.blanks);
    check('no scoreboard of noughts', shelf.score === true);
    check('the lede says nothing is saved', /Nothing saved yet/.test(shelf.lede), shelf.lede);
    check('the walkthrough opens on an account that has never used anything',
      shelf.walk === true);
    check('and the greeting waits behind it rather than stacking on top',
      shelf.welcome === false);

    /* WALKING THROUGH IT. Five steps, Back absent on the first, the last
       button saying what it does, and the greeting arriving at the end. */
    const wt = await page.evaluate(() => {
      const at = () => ({
        step: [...document.querySelectorAll('#walk .wt-step')]
              .findIndex(e => e.classList.contains('on')),
        back: document.getElementById('wtback').hidden,
        next: document.getElementById('wtnext').textContent,
        lit:  [...document.querySelectorAll('#wtdots b')]
              .filter(d => d.classList.contains('on')).length
      });
      const seen = [at()];
      for (let i = 0; i < 4; i++){ document.getElementById('wtnext').click(); seen.push(at()); }
      return {seen, steps: document.querySelectorAll('#walk .wt-step').length,
              dots: document.querySelectorAll('#wtdots b').length,
              /* The price on the gold chip comes off the app's own table.
                 CREDIT is a browser global, so it is read in here rather than
                 typed into an assertion out there. */
              cost: document.getElementById('wtcost').textContent,
              want: CREDIT.conversation};
    });
    check('it is five steps and five dots',
      wt.steps === 5 && wt.dots === 5, JSON.stringify({s: wt.steps, d: wt.dots}));
    check('Next moves one step at a time',
      wt.seen.map(x => x.step).join(',') === '0,1,2,3,4',
      wt.seen.map(x => x.step).join(','));
    check('exactly one step and one dot are lit at a time',
      wt.seen.every(x => x.lit === 1), JSON.stringify(wt.seen.map(x => x.lit)));
    check('Back is absent on the first step and there after it',
      wt.seen[0].back === true && wt.seen.slice(1).every(x => x.back === false),
      JSON.stringify(wt.seen.map(x => x.back)));
    check('the last button says what it does rather than Next again',
      wt.seen[4].next === 'Get started', wt.seen[4].next);
    check('and the credit price on it is the price the app charges',
      new RegExp('\\b' + wt.want + ' credits?\\b').test(wt.cost),
      JSON.stringify(wt.cost) + ' should name ' + wt.want);

    /* The greeting fills its own figures when it opens, so what it says is
       read after the handover and not from the shelf snapshot above, which was
       taken while this sheet was still shut. */
    const done = await page.evaluate(() => {
      document.getElementById('wtnext').click();
      return {walk: document.getElementById('walk').hidden,
              welcome: !document.getElementById('firstrun').hidden,
              credits: document.getElementById('frcredits').textContent,
              creditsShown: !document.getElementById('frcredits').hidden,
              pasteCost: document.getElementById('frpastecost').textContent,
              want: CREDIT.import};
    });
    check('finishing it closes the walkthrough', done.walk === true);
    check('and hands over the three ways in', done.welcome === true);

    /* THE GREETING HAS A VISIBLE WAY OUT. Escape and a click outside both
       closed it from the day it was built and neither of them said so. */
    const shut = await page.evaluate(() => {
      const x = document.getElementById('frclose');
      if (x) x.click();
      return {there: !!x, closed: document.getElementById('firstrun').hidden};
    });
    check('the greeting can be closed by pressing something',
      shut.there === true, 'no close control on the only sheet that opens by itself');
    check('and pressing it closes it', shut.closed === true);

    check('it states the trial allowance',
      done.creditsShown && /25 credits/.test(done.credits), done.credits);
    check('the paid choice names its price',
      new RegExp('\\b' + done.want + ' credits?\\b').test(done.pasteCost),
      JSON.stringify(done.pasteCost) + ' should name ' + done.want);
    check('no page errors on a new account', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* THE TOUR OPENS ONCE. `bare` stays true until a real project exists, and an
     Untitled board with nothing on it counts as bare, so this used to reopen on
     every refresh until the writer had both named something and put a card in
     it. Kris found it by refreshing. */
  {
    const seen = Object.assign({}, TRIAL, {onboarding_seen: true});
    /* An Untitled board with nothing on it, which is the exact shelf Kris was
       refreshing when he found this. It still counts as empty everywhere else
       in the app, deliberately, so the fix cannot lean on the project count. */
    const { page, errors } = await open(browser,
      {account: seen, projects: [{id: 'p-untitled', name: 'Untitled', structure: 'stc',
        brief: {}, outline: {}, characters: [], cards: [], is_sample: false,
        created_from: 'new_project', updated_at: '2026-10-01T00:00:00Z'}]});
    const st = await page.evaluate(() => ({
      walk: !document.getElementById('walk').hidden,
      welcome: !document.getElementById('firstrun').hidden
    }));
    check('an account that has already been walked through is not walked again',
      st.walk === false, 'the tutorial came back after it was skipped');
    /* AND NEITHER IS THE GREETING. It used to open on any empty shelf, which
       meant a writer who skipped the tour and started an Untitled board got
       the whole introduction again on every refresh and every sign-in. Once
       ever, from a new account, and after that the dashed New project card is
       the only thing a returning writer needs. */
    check('and the greeting does not come back either',
      st.welcome === false, 'the introduction reopened on a second visit');
    check('no page errors on a second visit', errors.length === 0, errors.join('\n'));
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

  /* ------------------- an admin address has no boards, and is not sold one
   *
   * Admin and unlimited used to be the same switch, so the account that reads
   * the platform's numbers was necessarily the account somebody writes on.
   * Split apart, an admin address arrives at a shut board, and the plan-ended
   * screen is the wrong thing to show it: nothing has ended and there is
   * nothing to buy. Beatfall would be trying to sell Kris a subscription for
   * the account he uses to look at how many subscriptions he has sold. */
  {
    const { page, errors, navs } = await open(browser, {
      account: Object.assign({}, PAID, {is_admin: true, plan: 'none', unlimited: false}),
      closed: true, reason: 'plan_ended', projects: []});
    await page.waitForTimeout(400);
    check('an admin address at a shut board is sent to the reports',
      navs.some(u => /admin\.html$/.test(u)), navs.join(' | '));
    check('no page errors sending an admin to the reports',
      errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* A writer whose plan really did end is not bounced anywhere. They get the
     locked screen, which is true for them and offers them a way back in. */
  {
    const { page, navs } = await open(browser, {
      account: Object.assign({}, PAID, {is_admin: false, plan: 'none'}),
      closed: true, reason: 'plan_ended', projects: [board('Night Haul', 9)]});
    await page.waitForTimeout(400);
    const seen = await page.evaluate(() => ({
      locked: !!document.querySelector('.locked'),
      heading: (document.querySelector('.locked h1') || {}).textContent || ''
    }));
    check('a lapsed writer is not bounced anywhere',
      !navs.some(u => /admin\.html$/.test(u)), navs.join(' | '));
    check('they get the locked screen, as before',
      seen.locked === true && /plan has ended/.test(seen.heading), seen.heading);
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
        faceOption:  selects.some(s => /Use as a reference for/.test(s.innerHTML)),
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
    check('a photo offers the characters as a reference', seen.faceOption === true);
    const assigned = await page.evaluate(async () => {
      const card = document.querySelector('.ncard.photo');
      const who = [...card.querySelectorAll('select')]
        .find(s => /Use as a reference for/.test(s.innerHTML));
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
        .find(s => /Use as a reference for/.test(s.innerHTML));
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

  // ------------------------------------------ the face, from the character --
  /* Two ways in and one way out, both on the character's own card.
     Taking a face off is not deleting the picture: it stays in Vision, ready to
     go on somebody else. That is how a writer who finds a better reference on
     Tuesday swaps the one they found on Monday. */
  {
    const proj = board('The Spillway', 4);
    proj.characters = [
      {id: 'c1', name: 'Mara Vance', role: 'Protagonist', want: 'the bar', face: 'u1/face.jpg'},
      {id: 'c2', name: 'Dale Rusk',  role: 'Antagonist',  want: 'out'}
    ];
    proj.cards.push({id: 70, slot: '__shelf', kind: 'photo', img: 'u1/face.jpg',
                     text: 'a face in the crowd'});

    const { page, errors } = await open(browser, {account: PAID, projects: [proj]});
    await page.evaluate(() => { state.activeId = state.projects[0].id; setView('cast', true); });
    await page.waitForTimeout(400);

    const shelf = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.ccard')];
      return {
        count: cards.length,
        // a button inside a button is not a thing a browser will build
        anyNestedButtons: cards.some(c => c.tagName === 'BUTTON' && c.querySelector('button')),
        reachable: cards.every(c => c.getAttribute('role') === 'button'
                                 && c.getAttribute('tabindex') === '0'),
        withFace: cards.filter(c => c.querySelector('.cface img')).length,
        removers: cards.filter(c => c.querySelector('.cface .facex')).length,
        adders:   cards.filter(c => c.querySelector('.cface-add')).length,
        src: (cards[0].querySelector('.cface img') || {}).getAttribute
             ? cards[0].querySelector('.cface img').getAttribute('src') : ''
      };
    });
    check('a character wearing a face shows it', shelf.withFace === 1, JSON.stringify(shelf));
    check('and the picture really loads there',
      String(shelf.src).indexOf('data:image') === 0, String(shelf.src).slice(0, 30));
    check('only the one wearing a face offers to take it off', shelf.removers === 1);
    check('and only the one without offers to add one', shelf.adders === 1);
    check('the card is still reachable by keyboard after losing its button',
      shelf.reachable === true, 'role or tabindex missing');
    check('and no button was nested inside another one',
      shelf.anyNestedButtons === false, 'a browser will not build that markup');

    // ---- taking it off, and what survives
    const removed = await page.evaluate(async () => {
      document.querySelector('.ccard .cface .facex').click();
      await new Promise(r => setTimeout(r, 200));
      const p = state.projects[0];
      return {
        face: (p.characters.find(c => c.id === 'c1') || {}).face || '',
        photos: p.cards.filter(c => c.kind === 'photo').length,
        sheetOpened: !document.getElementById('sheetchar').hidden
      };
    });
    check('taking a face off the card removes it from the character',
      removed.face === '', JSON.stringify(removed));
    check('and the picture is still in Vision, ready for somebody else',
      removed.photos === 1, 'taking a face off deleted the photograph');
    check('and pressing the little x did not open the sheet underneath it',
      removed.sheetOpened === false, 'the click went through to the card');

    // ---- and it comes back
    const back = await page.evaluate(async () => {
      undo();
      await new Promise(r => setTimeout(r, 200));
      return (state.projects[0].characters.find(c => c.id === 'c1') || {}).face || '';
    });
    check('and undo puts the face back', back === 'u1/face.jpg', back);
    check('no page errors around faces', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ---------------------------------- adding a face from the character card --
  /* The same upload as the Notes page, told where it is going. The picture
     lands on that character AND in Vision: never a picture that lives somewhere
     the Notes page cannot see. */
  {
    const proj = board('The Spillway', 4);
    proj.characters = [{id: 'c1', name: 'Mara Vance', role: 'Protagonist', want: 'the bar'}];
    const { page, errors } = await open(browser, {account: PAID, projects: [proj]});
    await page.evaluate(() => { state.activeId = state.projects[0].id; setView('cast', true); });
    await page.waitForTimeout(300);

    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHElEQVQoz2P8//8/AzZgYmJiYmL'
      + '6//8/AzbAxMTExMTEBABPQwX1eN5ZzAAAAABJRU5ErkJggg==', 'base64');

    await page.evaluate(() => { document.querySelector('.ccard .cface-add').click(); });
    const one = await page.evaluate(() =>
      !document.getElementById('photofile').hasAttribute('multiple'));
    check('a character card asks for one picture, because it wears one face',
      one === true, 'the picker still allows several');

    await page.setInputFiles('#photofile', [
      { name: 'mara_reference.png', mimeType: 'image/png', buffer: PNG }
    ]);
    await page.waitForTimeout(800);

    const landed = await page.evaluate(() => {
      const p = state.projects[0];
      const shot = p.cards.filter(c => c.kind === 'photo');
      return {
        onCharacter: (p.characters[0] || {}).face || '',
        inVision: shot.length,
        samePicture: shot.length === 1 && shot[0].img === (p.characters[0] || {}).face,
        caption: (shot[0] || {}).text || '',
        showing: !!document.querySelector('.ccard .cface img')
      };
    });
    check('a picture added from a character card goes on that character',
      !!landed.onCharacter, JSON.stringify(landed));
    check('and into Vision with everything else', landed.inVision === 1);
    check('and they are the same picture, not two copies',
      landed.samePicture === true, JSON.stringify(landed));
    check('and it carries a caption like any other note',
      landed.caption === 'mara reference', landed.caption);
    check('and the card is showing it straight away', landed.showing === true);

    // The Notes page must not inherit that one-picture rule afterwards.
    await page.evaluate(() => { setView('notes', true); });
    await page.waitForTimeout(200);
    const many = await page.evaluate(() => {
      document.getElementById('photoadd').click();
      return document.getElementById('photofile').hasAttribute('multiple');
    });
    check('and the Notes page can still add several at once',
      many === true, 'the one-picture rule leaked out of the character card');

    check('no page errors adding a face', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------------- a screen with no mouse --
  /* A touchscreen laptop or a large tablet is not a small screen. It sails
     through the gate that keeps phones off the board, and it has no hover.
     Every control that fades in on hover is therefore invisible AND
     unreachable there: the delete, the pencil, the move and the padlock on a
     board card, the delete and the pencil on a note, and the x that takes a
     reference off a character.

     There was no way to delete a card on a Surface. This is the check that
     says so out loud.

     A context with hasTouch is how Chromium is told there is a finger and no
     mouse; it reports (hover: none) and (pointer: coarse) exactly as the real
     thing does. The viewport stays large on purpose, because the point is a
     BIG touchscreen, which is the case the small-screen gate does not catch. */
  {
    const proj = board('The Spillway', 4);
    proj.characters = [{id:'c1', name:'Mara Vance', role:'Protagonist', face:'u1/face.jpg'}];
    proj.cards.push({id: 70, slot: '__shelf', kind: 'photo', img: 'u1/face.jpg',
                     text: 'a face in the crowd'});
    proj.cards.push({id: 71, slot: '__shelf', kind: 'research', text: 'a written note'});

    const ctx = await browser.newContext({ hasTouch: true, viewport: {width: 1280, height: 900} });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(([a, p]) => { window.__ACCOUNT__ = a; window.__PROJECTS__ = p; },
      [PAID, [proj]]);
    await page.goto(PAGE);
    await page.waitForTimeout(700);
    await page.evaluate(() => { state.activeId = state.projects[0].id; setView('board', true); });
    await page.waitForTimeout(300);

    const seen = o => Number(o) > .2;
    const board1 = await page.evaluate(() => {
      const card = document.querySelector('#board .icard');
      const o = el => el ? getComputedStyle(el).opacity : '0';
      return {
        noHover: window.matchMedia('(hover: none)').matches,
        del:  o(card && card.querySelector('.del')),
        edit: o(card && card.querySelector('.edit')),
        move: o(card && card.querySelector('.move')),
        pin:  o(card && card.querySelector('.pin'))
      };
    });
    check('the browser really is reporting no hover', board1.noHover === true,
      'the emulation did not take, so the rest of this block proves nothing');
    check('a board card\u2019s delete can be seen without a mouse', seen(board1.del), board1.del);
    check('and its pencil', seen(board1.edit), board1.edit);
    check('and its move control', seen(board1.move), board1.move);
    check('and its padlock', seen(board1.pin), board1.pin);

    // and it is not merely visible, it actually works
    await page.evaluate(() => { window.confirm = () => true; });
    const pressed = await page.evaluate(async () => {
      const before = P().cards.filter(c => c.slot !== '__shelf').length;
      document.querySelector('#board .icard .del').click();
      await new Promise(r => setTimeout(r, 200));
      return { before, after: P().cards.filter(c => c.slot !== '__shelf').length };
    });
    check('and pressing it with no hover really deletes the card',
      pressed.after === pressed.before - 1, JSON.stringify(pressed));

    await page.evaluate(() => setView('notes', true));
    await page.waitForTimeout(300);
    const notes = await page.evaluate(() => {
      const card = document.querySelector('.ncard');
      const o = el => el ? getComputedStyle(el).opacity : '0';
      return { del: o(card && card.querySelector('.del')),
               edit: o(card && card.querySelector('.edit')) };
    });
    check('a note\u2019s delete can be seen without a mouse', seen(notes.del), notes.del);
    check('and its pencil', seen(notes.edit), notes.edit);

    await page.evaluate(() => setView('cast', true));
    await page.waitForTimeout(300);
    const face = await page.evaluate(() => {
      const x = document.querySelector('.ccard .cface .facex');
      return x ? getComputedStyle(x).opacity : '0';
    });
    check('and the x that removes a reference image', seen(face), face);

    check('no page errors without a mouse', errors.length === 0, errors.join('\n'));
    await ctx.close();
  }

  // ------------------------------------ a picture filed under a beat, shown --
  /* Filing a photograph under a beat used to print a Vision chip and a caption
     in the Outline: the app telling you a picture exists and then not showing
     it. The whole reason to file one under a beat is to have the frame beside
     the box you are typing in. */
  {
    const proj = board('The Spillway', 15);
    /* The Outline is gated until every beat has a card OR it has been opened
       once before. Marking it started is the honest way in: it is the state a
       writer who has been here already is in, and it does not depend on this
       fixture's slot ids matching the structure exactly. */
    proj.outline = {__started: true};
    proj.cards.push({id: 70, slot: '__shelf', kind: 'photo', img: 'u1/rain.jpg',
                     attachedTo: 'open', text: "A man sits in a car while it's raining."});
    proj.cards.push({id: 71, slot: '__shelf', kind: 'research',
                     attachedTo: 'open', text: 'a written note filed on the same beat'});

    const { page, errors } = await open(browser, {account: PAID, projects: [proj]});
    await page.evaluate(() => { state.activeId = state.projects[0].id; setView('outline', true); });
    await page.waitForTimeout(500);

    const row = await page.evaluate(() => {
      const beat = document.querySelector('#outlinebody .obeat[data-slot="open"]');
      const pic  = beat && beat.querySelector('.anote.haspic');
      const txt  = beat && beat.querySelector('.anote:not(.haspic)');
      return {
        beatThere: !!beat,
        picRow: !!pic,
        img: pic ? pic.querySelector('.athumb img').getAttribute('src') : '',
        caption: pic ? pic.querySelector('.at').textContent : '',
        stillUnpinnable: !!(pic && pic.querySelector('.unpin')),
        // a written note filed on the same beat is untouched
        textRow: !!txt,
        textHasThumb: !!(txt && txt.querySelector('.athumb'))
      };
    });
    check('the beat is in the Outline', row.beatThere === true);
    check('a filed picture shows the actual picture, not just a caption',
      String(row.img).indexOf('data:image') === 0, String(row.img).slice(0, 30));
    check('and keeps its caption beside it',
      /sits in a car/.test(row.caption), row.caption);
    check('and can still be taken off the beat', row.stillUnpinnable === true);
    check('a written note filed on the same beat is unchanged',
      row.textRow === true && row.textHasThumb === false, JSON.stringify(row));

    // ---- and one press makes it the size it was taken at
    const big = await page.evaluate(async () => {
      document.querySelector('.anote.haspic .athumb').click();
      await new Promise(r => setTimeout(r, 200));
      const v = document.querySelector('.picview');
      return { open: !!v,
               src: v ? v.querySelector('img').getAttribute('src') : '',
               cap: v ? v.querySelector('.cap').textContent : '' };
    });
    check('pressing the thumbnail opens it full size', big.open === true);
    check('and it is the same picture', String(big.src).indexOf('data:image') === 0);
    check('and carries the caption', /sits in a car/.test(big.cap), big.cap);

    const closed = await page.evaluate(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      await new Promise(r => setTimeout(r, 150));
      const stillOpen = !!document.querySelector('.picview');
      // and the viewer does not leave a key listener behind to eat the next Escape
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      return { stillOpen, leaks: document.querySelectorAll('.picview').length };
    });
    check('escape closes it', closed.stillOpen === false);
    check('and it leaves nothing behind', closed.leaks === 0);

    check('no page errors around filed pictures', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------- dropped, and pasted, pictures --
  /* The file picker is how a writer adds a picture once they have gone looking
     for the way. These are the two they reach for without looking. Paste is the
     one that matters most: a frame off a film is the whole example this feature
     was built for, and a screenshot lives on the clipboard and never touches
     the disk. */
  {
    const proj = board('The Spillway', 4);
    proj.characters = [{id: 'c1', name: 'Mara Vance', role: 'Protagonist'}];
    const { page, errors } = await open(browser, {account: PAID, projects: [proj]});
    await page.evaluate(() => { state.activeId = state.projects[0].id; setView('notes', true); });
    await page.waitForTimeout(300);

    /* A real drop, built the way a browser builds one. DataTransfer is
       constructible in Chromium, so this is the same event shape the operating
       system delivers rather than a hand-made object the handler is written to
       accept. */
    const dropped = await page.evaluate(async () => {
      const png = Uint8Array.from(atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHElEQVQoz2P8//8/AzZgYmJiYmL'
        + '6//8/AzbAxMTExMTEBABPQwX1eN5ZzAAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([png], 'rain_on_glass.png', {type: 'image/png'}));

      const view = document.getElementById('notesview');
      view.dispatchEvent(new DragEvent('dragenter', {dataTransfer: dt, bubbles: true}));
      const litUp = view.classList.contains('dropping');
      view.dispatchEvent(new DragEvent('drop', {dataTransfer: dt, bubbles: true}));
      await new Promise(r => setTimeout(r, 800));
      return {
        litUp,
        stillLit: view.classList.contains('dropping'),
        photos: P().cards.filter(c => c.kind === 'photo').length,
        caption: (P().cards.find(c => c.kind === 'photo') || {}).text || ''
      };
    });
    check('a page carrying a picture over it says so', dropped.litUp === true);
    check('and stops saying so once it lands', dropped.stillLit === false);
    check('a dropped picture becomes a note', dropped.photos === 1, JSON.stringify(dropped));
    check('with the filename as its caption',
      dropped.caption === 'rain on glass', dropped.caption);

    // ---- pasted from the clipboard, from somewhere else in the app
    const pasted = await page.evaluate(async () => {
      setView('board', true);
      await new Promise(r => setTimeout(r, 150));
      const png = Uint8Array.from(atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHElEQVQoz2P8//8/AzZgYmJiYmL'
        + '6//8/AzbAxMTExMTEBABPQwX1eN5ZzAAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([png], 'screenshot.png', {type: 'image/png'}));
      document.body.focus();
      document.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true}));
      await new Promise(r => setTimeout(r, 900));
      return { photos: P().cards.filter(c => c.kind === 'photo').length, view: state.view };
    });
    check('a screenshot pasted anywhere in the app lands in Vision',
      pasted.photos === 2, JSON.stringify(pasted));
    check('and the writer is taken to where it landed',
      pasted.view === 'notes', pasted.view);

    /* AND IT NEVER STEALS A PASTE OF WORDS. The rule is what is on the
       clipboard, not where the caret is: "never while typing" would mean never
       on the board, because the board focuses the capture bar the moment it
       opens. Words plus a caret in a text box is a paste of words and has to
       keep working. A picture and no words has no other meaning. */
    const pastedWords = await page.evaluate(async () => {
      setView('board', true);
      await new Promise(r => setTimeout(r, 150));
      const before = P().cards.filter(c => c.kind === 'photo').length;
      const box = document.getElementById('input') || document.querySelector('textarea');
      box.focus();
      const dt = new DataTransfer();
      dt.setData('text/plain', 'he finds out his brother knew all along');
      box.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true}));
      await new Promise(r => setTimeout(r, 400));
      return { before, after: P().cards.filter(c => c.kind === 'photo').length };
    });
    check('pasting words into a box is never turned into a picture',
      pastedWords.after === pastedWords.before, JSON.stringify(pastedWords));

    // ---- and onto one character
    const ontoPerson = await page.evaluate(async () => {
      setView('cast', true);
      await new Promise(r => setTimeout(r, 250));
      const png = Uint8Array.from(atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHElEQVQoz2P8//8/AzZgYmJiYmL'
        + '6//8/AzbAxMTExMTEBABPQwX1eN5ZzAAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([png], 'mara.png', {type: 'image/png'}));
      const card = document.querySelector('.ccard');
      card.dispatchEvent(new DragEvent('drop', {dataTransfer: dt, bubbles: true}));
      await new Promise(r => setTimeout(r, 900));
      const p = state.projects[0];
      const shot = p.cards.filter(c => c.kind === 'photo');
      return { face: (p.characters[0] || {}).face || '',
               inVision: shot.length,
               same: shot.some(x => x.img === (p.characters[0] || {}).face) };
    });
    check('a picture dropped on a character becomes their reference',
      !!ontoPerson.face, JSON.stringify(ontoPerson));
    check('and is in Vision too, not hidden on the character',
      ontoPerson.same === true, JSON.stringify(ontoPerson));

    check('no page errors dropping or pasting', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ------------------------------------------------- whose note is this --
  /* A character note is frequently one word. "Skinny." "Quiet." "Funny." Those
     are notes about a PERSON, and without knowing which person they mean
     nothing. The importer can tell a note is about somebody and cannot tell
     who, because the note does not say. So the writer says. */
  {
    const proj = board('The Spillway', 4);
    proj.characters = [
      {id: 'c1', name: 'Luke',   role: 'Protagonist', want: 'out'},
      {id: 'c2', name: 'Nicole', role: 'Deuteragonist', want: 'in'}
    ];
    proj.cards.push({id: 90, slot: '__shelf', kind: 'character', text: 'Skinny.'});
    proj.cards.push({id: 91, slot: '__shelf', kind: 'clue', text: 'A trap, reset.'});

    const { page, errors } = await open(browser, {account: PAID, projects: [proj]});
    await page.evaluate(() => { state.activeId = state.projects[0].id; setView('notes', true); });
    await page.waitForTimeout(400);

    const offered = await page.evaluate(() => {
      const pick = k => {
        const card = [...document.querySelectorAll('.ncard.' + k)][0];
        return card ? [...card.querySelectorAll('select')]
          .some(s => /This note is about/.test(s.innerHTML)) : null;
      };
      return { character: pick('character'), clue: pick('clue') };
    });
    check('a character note offers the people in the story', offered.character === true);
    check('and a clue does not, because it would do nothing there',
      offered.clue === false, 'the attribution control is on a note it cannot serve');

    const said = await page.evaluate(async () => {
      const card = document.querySelector('.ncard.character');
      const who = [...card.querySelectorAll('select')]
        .find(s => /This note is about/.test(s.innerHTML));
      who.value = 'c1';
      who.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 200));
      const p = state.projects[0];
      return {
        about: (p.cards.find(c => c.id === 90) || {}).about || '',
        says: (document.querySelector('.ncard.character .face') || {}).textContent || '',
        stillANote: p.cards.filter(c => c.kind === 'character').length
      };
    });
    check('choosing somebody records it on the note', said.about === 'c1',
      JSON.stringify(said));
    check('and the card says whose it is', /Luke/.test(said.says), said.says);
    check('and the note stays in Notes rather than being consumed',
      said.stillANote === 1, 'the note left Notes when it was attributed');

    const cleared = await page.evaluate(async () => {
      const card = document.querySelector('.ncard.character');
      const who = [...card.querySelectorAll('select')]
        .find(s => /This note is about/.test(s.innerHTML));
      who.value = '__off';
      who.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 200));
      return (state.projects[0].cards.find(c => c.id === 90) || {}).about || '';
    });
    check('and it can be taken back off again', cleared === '', cleared);

    // and the page says it too
    const printed = await page.evaluate(async () => {
      const p = state.projects[0];
      p.cards.find(c => c.id === 90).about = 'c2';
      await exportPDF(p);
      return (window.__PDF__ || {}).text || '';
    });
    check('and the PDF prints who a note is about',
      /ABOUT NICOLE/i.test(printed), 'the attribution is on screen and not on paper');

    check('no page errors attributing a note', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* ================================== THE STREAK BELONGS TO THE ACCOUNT
   *
   * It used to be a list in local storage added to whatever the server said,
   * so it was the browser's streak rather than the writer's. Kris found it by
   * signing back into an account he had not opened in a fortnight and being
   * shown days he had worked on a different one.
   */
  {
    const back = (n) => {                       // n days ago, as the app stamps them
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
           + '-' + String(d.getDate()).padStart(2, '0');
    };
    const run4 = [back(3), back(2), back(1), back(0)];

    // 1. The account's own days are what gets counted.
    const { page, errors } = await open(browser, {
      account: PAID, projects: [board('Night Haul', 9)], days: run4});
    const own = await page.evaluate(() => ({run: chain().run, loaded: chainLoaded}));
    check('the streak counts the days the account worked', own.run === 4, String(own.run));
    check('and knows the server answered', own.loaded === true);
    check('no page errors reading the streak', errors.length === 0, errors.join('\n'));
    await page.close();

    /* 2. THE BUG ITSELF. Another account's days, and the old browser-wide
          list, both sitting in this browser from an earlier sign-in. Neither
          may be counted for whoever signs in next.

          Run with the request FAILING on purpose. On a good connection the
          stale key is cleaned up, and a check taken after that cleanup proves
          only that the cleanup happened: put the bug back and it still passes,
          because there is nothing left to read. Failing the request leaves
          every one of those keys sitting there, which is the only way to ask
          whether the streak would read them. */
    const { page: p2 } = await open(browser, {
      account: PAID, projects: [board('Night Haul', 9)],
      capfail: true,
      store: {'beatfall.days.someone-else@example.com': JSON.stringify(run4),
              'beatfall.days': JSON.stringify(run4)}
    });
    const clean = await p2.evaluate(() => ({
      run: chain().run,
      stillThere: !!localStorage.getItem('beatfall.days'),
      theirs: !!localStorage.getItem('beatfall.days.someone-else@example.com')
    }));
    check('somebody else’s streak on this computer is not yours',
      clean.run === 0, clean.run + ' days inherited from another account');
    check('with both stale lists still sitting in the browser',
      clean.stillThere && clean.theirs, 'the test proved nothing, they were cleaned up first');
    await p2.close();

    // And on a good connection the old browser-wide list is swept away.
    const { page: p2b } = await open(browser, {
      account: PAID, projects: [board('Night Haul', 9)], days: run4,
      store: {'beatfall.days': JSON.stringify([back(9)])}
    });
    const swept = await p2b.evaluate(() => ({
      old: localStorage.getItem('beatfall.days'),
      mine: JSON.parse(localStorage.getItem('beatfall.days.w@example.com') || 'null')
    }));
    check('the old browser-wide list is cleared out once the account answers',
      swept.old === null, swept.old);
    check('and this account caches its own days', (swept.mine || []).length === 4,
      JSON.stringify(swept.mine));
    await p2b.close();

    /* 3. A request that failed is not a writer who did nothing. Zeroing the
          streak on a dropped connection is the fix overshooting. */
    const { page: p3 } = await open(browser, {
      account: PAID, projects: [board('Night Haul', 9)],
      capfail: true,
      store: {'beatfall.days.w@example.com': JSON.stringify(run4)}
    });
    const held = await p3.evaluate(() => ({run: chain().run, loaded: chainLoaded}));
    check('a streak survives a connection that dropped', held.run === 4, String(held.run));
    check('and the app knows it is working from a cache', held.loaded === false);
    await p3.close();
  }

  /* ============================== EVERY SCRIPT CAN BE THROWN AWAY
   *
   * Delete appeared only once there were two projects, so a writer with one
   * had to make a second to get rid of the first. The guard existed because
   * remove() left state.projects empty and P() reads its first entry.
   */
  {
    const { page, errors } = await open(browser, {
      account: PAID, projects: [board('Night Haul', 9)]});
    const before = await page.evaluate(() => ({
      cards: document.querySelectorAll('#slategrid .pcard:not(.newcard)').length,
      del: document.querySelectorAll('#slategrid .pcard .btn.del').length
    }));
    check('a lone script can still be deleted', before.cards === 1 && before.del === 1,
      'cards: ' + before.cards + ' delete buttons: ' + before.del);

    const after = await page.evaluate(async () => {
      window.confirm = () => true;
      document.querySelector('#slategrid .pcard .btn.del').click();
      await new Promise(r => setTimeout(r, 0));
      return {
        cards: document.querySelectorAll('#slategrid .pcard:not(.newcard)').length,
        blanks: document.querySelectorAll('#slategrid .newcard').length,
        lede: document.getElementById('slatelede').textContent.trim(),
        // P() reading undefined is what the old guard was really protecting.
        alive: !!P(),
        placeholder: !!(state.projects[0] || {}).placeholder,
        queued: dirty.size,
        sent: window.__CALLS__.filter(c => c === 'delete').length
      };
    });
    check('deleting the last one leaves the dashed box on its own',
      after.cards === 0 && after.blanks === 1,
      'cards: ' + after.cards + ' blanks: ' + after.blanks);
    check('and the lede goes back to saying nothing is saved',
      /Nothing saved yet/.test(after.lede), after.lede);
    check('the app still has a project to read', after.alive === true);
    check('and it is the blank, not a saved one', after.placeholder === true);
    check('the delete really went to the server', after.sent === 1, String(after.sent));
    check('and nothing is left queued to be written back',
      after.queued === 0, after.queued + ' still in the save queue');
    check('no page errors deleting the last script', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* A board deleted within the debounce of its own last edit was being written
     back to the server after the delete had gone, so it reappeared. */
  {
    const { page } = await open(browser, {
      account: PAID, projects: [board('Night Haul', 9), board('The Duffel Bag', 3)]});
    const after = await page.evaluate(async () => {
      window.confirm = () => true;
      const p = state.projects[0];
      p.cards.push({id: 9001, slot: '__shelf', text: 'an edit made a moment ago'});
      save();                                   // queues it, debounced
      const queuedFirst = dirty.has(p);
      document.querySelector('#slategrid .pcard .btn.del').click();
      await new Promise(r => setTimeout(r, 0));
      return {queuedFirst, stillQueued: dirty.has(p), left: state.projects.length};
    });
    check('an edit does queue the board it changed', after.queuedFirst === true);
    check('deleting a board takes it out of the save queue',
      after.stillQueued === false, 'it would have been written back after the delete');
    check('and the other script is untouched', after.left === 1, String(after.left));
    await page.close();
  }

  /* THE FORMAT MENU AND THE SHELF HEADINGS READ OFF THE SAME STRING.
   *
   * A structure's label is "<medium> · <name> (<shape>)", and the medium
   * half is not stored anywhere else: `mediumOf` splits the label and looks
   * the lead up in MEDIA, which is how the shelf groups a writer's scripts.
   *
   * The lookup ends in `|| MEDIA[MEDIA.length - 1]`, so a lead that matches
   * nothing lands silently in the last group rather than failing. Rename a
   * medium in a label and the menu reads correctly while the grouping is
   * quietly running on the fallback, which is the kind of wrong that only
   * shows up the day somebody adds a sixth medium. So assert the match is
   * real for every structure, by name, rather than that the shelf happens to
   * look right.
   */
  {
    const { page, errors } = await open(browser, {
      account: PAID,
      projects: [board('Night Haul', 9), board('The Long Way Round', 4, 'circle')]});
    const seen = await page.evaluate(() => {
      const leads = Object.keys(STRUCTURES).map(k => ({
        key: k, lead: STRUCTURES[k].label.split('·')[0].trim() }));
      const names = MEDIA.map(m => m.from);
      return {
        leads,
        orphans: leads.filter(l => names.indexOf(l.lead) < 0).map(l => l.key),
        /* `from` is the string in the label; `name` is what a writer reads on
           the shelf. On the one that fits any length they are the same word on
           purpose, and that is the pair that disagreed. */
        anyPair: MEDIA[MEDIA.length - 1].from + '/' + MEDIA[MEDIA.length - 1].name,
        circleGroup: mediumOf('circle').name,
        headings: [...document.querySelectorAll('#slategrid .sg-name')]
          .map(h => h.textContent.trim()),
        /* STRUCTURES is a global in the app, not out here. Read the count
           where it lives, the way every other figure in this suite does. */
        howMany: Object.keys(STRUCTURES).length,
        menu: [...document.querySelectorAll('#f-format option')].map(o => o.textContent)
      };
    });
    check('every structure names a medium the shelf actually has',
      seen.orphans.length === 0,
      'these fall through to the last group: ' + seen.orphans.join(', '));
    check('the one that fits any length says so on both halves',
      seen.anyPair === 'Any length/Any length', seen.anyPair);
    check('and the Story Circle is grouped under it',
      seen.circleGroup === 'Any length', seen.circleGroup);
    check('so a feature and a Story Circle sit on two named shelves',
      seen.headings.join(',') === 'Features,Any length', seen.headings.join(','));
    /* The word it used to carry. "Either" on a menu is a word with nothing
       after it: either what? */
    check('no format on the menu reads "Either"',
      seen.menu.length > 1 && !seen.menu.some(t => /\bEither\b/.test(t)),
      seen.menu.join(' | '));
    check('and every format on the menu still names its medium',
      seen.menu.filter(t => t.indexOf('·') > 0).length === seen.howMany,
      seen.menu.join(' | '));
    check('no page errors reading the formats', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* ONE READ HAS A CEILING, AND IT IS CHECKED BEFORE ANYTHING IS SPENT.
   *
   * There was no ceiling at all until today. The paste box has no maxlength on
   * purpose, and nothing downstream counted the notes, so the only limit on a
   * single 5-credit read was the server's budget of 150 upstream calls: 5,840
   * notes, about a dollar of reading against the dollar those credits are
   * worth, and then five credits charged for every call past the hundred and
   * fiftieth with nothing on screen saying so.
   *
   * The whole gate runs locally, before ai_sample is ever reached, which is
   * what lets it promise nothing was charged. So these checks need no model and
   * no network: the question is only ever whether the read was started.
   */
  {
    const { page, errors } = await open(browser, {
      account: PAID, projects: [board('Night Haul', 9)]});

    /* Did the read begin? The one thing that matters. ai_sample is the single
       door to the metered proxy, so counting presses on it is the honest
       measure of "was a credit spent", and it is far better than watching the
       network, which under file:// goes nowhere and would make a spend look
       like a refusal. */
    await page.evaluate(() => {
      window.__ASKED__ = 0;
      ai_sample = async function () { window.__ASKED__++; return { text: '{}' }; };
      ai_sample.json = async function () { window.__ASKED__++; return {}; };
      ai_sample.limits = async () => ({ images: false });
    });

    const press = async (text) => page.evaluate(async (t) => {
      openImport(true);
      const box = document.getElementById('dumptext');
      box.value = t;
      box.dispatchEvent(new Event('input'));
      const go = document.getElementById('dumpgo');
      const big = document.getElementById('dumpbig');
      const before = window.__ASKED__;
      const shown = { off: go.disabled, warned: !big.hidden, says: big.textContent };
      go.click();
      await new Promise(r => setTimeout(r, 60));
      return Object.assign(shown, { asked: window.__ASKED__ - before,
        count: document.getElementById('dumpcount').textContent });
    }, text);

    const ceiling = await page.evaluate(() => IMPORT_MAX_NOTES);
    check('there is a ceiling on one read at all', ceiling > 0, String(ceiling));

    // An ordinary file. Nothing about it should have changed.
    const ok = await press(Array.from({ length: 40 },
      (_, i) => 'the truck is still in the lot, note ' + i).join('\n'));
    check('a normal notes file is read as it always was', ok.asked > 0, String(ok.asked));
    check('with nothing said about size', ok.warned === false, ok.says);
    check('and the button live', ok.off === false);

    /* THE ONE THAT MATTERS. A file past the ceiling must not reach the proxy,
       because reaching it is the charge: /api/claude takes the five credits
       BEFORE it calls anybody. */
    const huge = Array.from({ length: ceiling + 200 },
      (_, i) => 'a separate idea about the haul, number ' + i).join('\n');
    const big = await press(huge);
    check('a file past the ceiling is not read', big.asked === 0,
      'it sent ' + big.asked + ' calls, which is the charge');
    check('and the button is off before it is pressed', big.off === true);
    check('and it says so without being pressed', big.warned === true);
    check('naming the real figure rather than a vague "too big"',
      /1,200 notes/.test(big.says) && /covers 1,000/.test(big.says), big.says);
    check('and promising what a writer needs to hear',
      /charged/.test(big.says) && /untouched|in the box/.test(big.says), big.says);
    check('the price of reading it in parts is the real one',
      new RegExp('own ' + 5 + ' credits').test(big.says), big.says);

    /* THE SHORT-CIRCUIT IS A CLAIM, SO CHECK IT.
     *
     * countDump runs on every keystroke and folding is a regex pass per line,
     * so it only folds when the line count is already over the ceiling, on the
     * grounds that the fold never produces more items than there are lines. If
     * that is ever false the gate refuses a file it should have read.
     *
     * This file is 1,100 lines and folds to well under the ceiling, because a
     * short continuation whose subject is already above it joins the note above
     * rather than starting a new one. A gate that counted lines and stopped
     * there would turn it away. */
    const folds = [];
    for (let i = 0; i < 550; i++) folds.push('Dale drives out to the lot, run ' + i,
      'He keeps driving.');
    const folded = await press(folds.join('\n'));
    check('a long file that folds under the ceiling is still read',
      folded.asked > 0, 'it was refused with ' + folded.asked + ' calls sent');
    check('and is not warned about', folded.warned === false, folded.says);

    /* THE GATE'S CONTRACT, IN BOTH DIRECTIONS. Zero under the ceiling, and over
       it the REAL folded count rather than the line count, because that number
       is printed to a writer. The first version of this returned the line count
       on the cheap path and the name did not say so; this is what holds the
       rename down. */
    const contract = await page.evaluate((cap) => {
      const small = ['Dale drives out to the lot.', 'He keeps driving.',
                     'MIDPOINT:', 'The money is already gone.'].join('\n');
      /* Over the ceiling in lines AND in notes, with every line its own note,
         so the folded figure and the line figure are different numbers and the
         check can tell which one came back. */
      const lines = [];
      for (let i = 0; i < cap + 300; i++)
        lines.push('A wholly separate moment in the story, number ' + i + '.');
      lines.push('TITLE IDEAS:');          // a heading, which is not a note
      return { under: importOverCeiling(small),
               over: importOverCeiling(lines.join('\n')),
               trueNotes: splitForImport(lines.join('\n')).length,
               rawLines: lines.length };
    }, ceiling);
    check('under the ceiling the gate answers zero and folds nothing',
      contract.under === 0, String(contract.under));
    check('over it, the figure is the folded note count, not the line count',
      contract.over === contract.trueNotes && contract.over !== contract.rawLines,
      JSON.stringify(contract));

    /* ASKING WHICH STRUCTURE A FILE WILL BE READ AGAINST MUST NOT RE-CUT THE
       BOARD. The gate calls it merely to count, and the version of this that
       wrote to proj.structure on the way past would change a writer's
       structure because they pasted into the box and thought better of it. */
    const untouched = await page.evaluate(() => {
      const was = P().structure;
      importStructureFor('Format: Three-Act\nDale drives out to the lot.');
      importOverCeiling('Format: Three-Act\nDale drives out to the lot.');
      return { was, now: P().structure };
    });
    check('counting a file never moves the project onto another structure',
      untouched.was === untouched.now, JSON.stringify(untouched));

    /* THE FOUR ANSWERS importStructureFor HAS TO GIVE.
     *
     * This decision used to live inline in claudePlan and was lifted out so the
     * ceiling could ask it without spending a credit. Lifting it is the part
     * that could have broken something, and the fourth case below is the one
     * that matters: a writer standing on a feature with cards on it pastes a
     * half-hour comedy's notes, and the file's own "Format:" line must NOT
     * re-cut the board they are looking at. That is the Night Haul overwrite,
     * which cost a day and is the worst bug this app has had. */
    const cases = await page.evaluate(() => {
      const proj = P();
      const cards = proj.cards;
      const was = proj.structure;
      const ask = (raw, intoNew, withCards) => {
        importIntoNew = intoNew;
        proj.cards = withCards ? cards : [];
        proj.structure = was;
        return importStructureFor(raw);
      };
      const plain = 'Dale drives out to the lot.';
      /* Three-Act, because that is a format localBrief actually recognises.
         "Format: Story Circle" is silently dropped today, which is a separate
         gap in the same fix and is raised on its own. */
      const says  = 'Format: Three-Act\nDale drives out to the lot.';
      const out = {
        silent:   ask(plain, false, true),
        intoNew:  ask(says,  true,  true),
        emptyOne: ask(says,  false, false),
        hasCards: ask(says,  false, true)
      };
      importIntoNew = false; proj.cards = cards; proj.structure = was;
      return Object.assign(out, { was });
    });
    check('a file that states no format leaves the structure alone',
      cases.silent === cases.was, JSON.stringify(cases));
    check('a dashboard import takes the format the file states',
      cases.intoNew === 'three', cases.intoNew);
    check('and so does an empty board, which has nothing to lose',
      cases.emptyOne === 'three', cases.emptyOne);
    check('but a board with cards on it is never re-cut by a pasted file',
      cases.hasCards === cases.was,
      'it moved to ' + cases.hasCards + ', which is the Night Haul overwrite');

    check('no page errors around the ceiling', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* WHICH READER ANSWERS, PINNED FOR A WHOLE PIECE OF WORK.
   *
   * Testing scaffolding, and on the live site none of it exists: production
   * carries no testing flag, the control is not drawn, and pinProvider hands
   * its options back untouched.
   *
   * The pin is the part worth checking. An import is between nine and
   * twenty-nine calls - one to read the file, one per batch of forty notes,
   * then the casting call three times over so two readings out of three can
   * agree on a beat. If the menu were read per call, a flip halfway through
   * would produce a board half of each reader built, and comparing that
   * compares nothing. Every multi-turn feature already mints one session id to
   * bill once, which is exactly the unit of work the pin needs.
   */
  {
    const { page, errors } = await open(browser, {
      account: PAID, projects: [board('Night Haul', 9)]});

    const hidden = await page.evaluate(() => ({
      btn: document.getElementById('providerbtn').hidden,
      sep: document.getElementById('providersep').hidden,
      sent: pinProvider({ kind: 'conversation', session: 's1' })
    }));
    check('an ordinary account is shown no reader control at all',
      hidden.btn === true && hidden.sep === true, JSON.stringify(hidden));
    check('and nothing it sends mentions a provider',
      hidden.sent.provider === undefined, JSON.stringify(hidden.sent));

    /* The flag alone is not enough and neither is being an admin. The testing
       site points at the real database, so a writer who found their way onto
       it is a real person with real boards. */
    const locks = await page.evaluate(() => {
      const out = {};
      setupProvider({ testing: false, is_admin: true, provider: 'openai' });
      out.adminOnly = document.getElementById('providerbtn').hidden;
      setupProvider({ testing: true, is_admin: false, provider: 'openai' });
      out.flagOnly = document.getElementById('providerbtn').hidden;
      return out;
    });
    check('the testing flag without an admin draws nothing',
      locks.flagOnly === true, String(locks.flagOnly));
    check('and an admin without the testing flag draws nothing either',
      locks.adminOnly === true, String(locks.adminOnly));

    /* IT OPENS ON WHATEVER PRODUCTION RUNS, AND THE SERVER SAYS WHICH.
       The browser cannot import a server constant, so /api/account carries the
       answer and this adopts it. A hardcoded word here would have read "Claude"
       for the whole afternoon after production moved to OpenAI, so the control
       would have named one reader while the other one answered. */
    const on = await page.evaluate(() => {
      try { localStorage.removeItem('beatfall.provider'); } catch (e) {}
      setupProvider({ testing: true, is_admin: true, provider: 'openai' });
      const a = { shown: !document.getElementById('providerbtn').hidden,
                  says: document.getElementById('providerlabel').textContent,
                  sent: pinProvider({ kind: 'ideas' }).provider };
      // and it follows the server rather than a word written in this file
      try { localStorage.removeItem('beatfall.provider'); } catch (e) {}
      setupProvider({ testing: true, is_admin: true, provider: 'claude' });
      a.followed = pinProvider({ kind: 'ideas' }).provider;
      try { localStorage.removeItem('beatfall.provider'); } catch (e) {}
      setupProvider({ testing: true, is_admin: true, provider: 'openai' });
      return a;
    });
    check('both together draw the control', on.shown === true);
    check('and it opens on what the server says production runs',
      on.says === 'OpenAI' && on.sent === 'openai', JSON.stringify(on));
    check('and it would follow the server the other way too, not a typed word',
      on.followed === 'claude', on.followed);

    /* THE PIN. One import, one reader, whatever the menu does meanwhile. */
    const pinned = await page.evaluate(() => {
      const sid = 'import-session-1';
      const first = pinProvider({ kind: 'import', session: sid }).provider;
      document.getElementById('providerbtn').click();      // flip, mid-read
      const label = document.getElementById('providerlabel').textContent;
      const rest = [];
      // the five batches and then the casting call three times over
      for (let i = 0; i < 8; i++)
        rest.push(pinProvider({ kind: 'import', session: sid }).provider);
      // and the next piece of work, which is where the flip belongs
      const next = pinProvider({ kind: 'import', session: 'import-session-2' }).provider;
      const loose = pinProvider({ kind: 'place' }).provider;
      return { first, label, rest, next, loose };
    });
    check('flipping it mid-import does not change who is reading that file',
      pinned.rest.every(p => p === pinned.first),
      pinned.first + ' then ' + pinned.rest.join(','));
    check('all three readings of the casting call agree on a reader',
      new Set(pinned.rest.slice(-3)).size === 1, pinned.rest.slice(-3).join(','));
    check('but the menu says the new one straight away',
      pinned.label === 'Claude', pinned.label);
    check('and the next read is the one that uses it',
      pinned.next === 'claude', pinned.next);
    check('as does a one-off call, which has no session to belong to',
      pinned.loose === 'claude', pinned.loose);

    /* The choice survives a refresh, because a comparison is run over an
       afternoon and losing it on every reload would mean half the runs were
       secretly the wrong reader. */
    const kept = await page.evaluate(() => {
      const was = localStorage.getItem('beatfall.provider');
      aiProvider = null;                           // as a fresh page would start
      setupProvider({ testing: true, is_admin: true, provider: 'openai' });
      return { stored: was, after: aiProvider };
    });
    check('a choice made by hand survives a reload, over the server default',
      kept.stored === 'claude' && kept.after === 'claude', JSON.stringify(kept));

    check('no page errors around the reader control', errors.length === 0,
      errors.join('\n'));
    await page.close();
  }

  /* AN OWNER'S ALLOWANCE IS A SIGN, NOT A FIGURE.
   *
   * The owner account carries 1,000,000 credits because the arithmetic needs a
   * number, and everywhere it can reach a screen it is meant to print as an
   * infinity sign. Settings always did. The board did not, and the way it hid
   * is the part worth a check: the load-time call was wrapped in a test for
   * unlimited, so the pill was simply BLANK on an owner's account and nothing
   * looked wrong. Then the writing help answers, BF.ai calls straight back in
   * with the raw figures, and an account with no limit is told it has
   * "999,910 of 1,000,000 credits left".
   *
   * So this drives it the way it actually broke: paint it on load, then paint
   * it again the way a finished call does.
   */
  {
    const OWNER = Object.assign({}, PAID, { unlimited: true, is_admin: true,
      credits_left: 999910, credits_allowance: 1000000, credits_banked: 0 });
    const { page, errors } = await open(browser, {
      account: OWNER, projects: [board('Night Haul', 9)]});

    const seen = await page.evaluate(() => {
      const el = document.getElementById('credits');
      const onLoad = { text: el.textContent, hidden: el.hidden };
      // exactly what BF.ai does when a call comes back
      BF.onCredits({ left: 999908, allowance: 1000000, banked: 0 });
      return { onLoad, after: el.textContent,
               hiddenAfter: el.hidden,
               chip: !!document.getElementById('avatarlow'),
               out: document.getElementById('avatar').classList.contains('out') };
    });

    check('an owner sees the sign rather than a number on load',
      seen.onLoad.text === '∞' && seen.onLoad.hidden === false,
      JSON.stringify(seen.onLoad));
    check('and still the sign after the writing help answers',
      seen.after === '∞', seen.after);
    check('no six figure count anywhere on that pill',
      !/\d/.test(seen.after) && !/\d/.test(seen.onLoad.text),
      seen.onLoad.text + ' then ' + seen.after);
    check('no low credit chip on an account that cannot run low',
      seen.chip === false);
    check('and the pill is never in its out of credits state',
      seen.out === false);

    /* And none of that may touch an ordinary account, which still needs its
       real figures. */
    const { page: p2 } = await open(browser, {
      account: PAID, projects: [board('Night Haul', 9)]});
    const normal = await p2.evaluate(() => {
      BF.onCredits({ left: 42, allowance: 150, banked: 0 });
      return document.getElementById('credits').textContent;
    });
    check('an ordinary account still reads its real count',
      /42 of 150/.test(normal), normal);
    await p2.close();

    check('no page errors painting the credit pill', errors.length === 0,
      errors.join('\n'));
    await page.close();
  }

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + ' of ' + results.length + ' passed');
  if (failed.length) { console.log('\nFAILED:'); failed.forEach(f => console.log('  ' + f.name)); process.exit(1); }
})();
