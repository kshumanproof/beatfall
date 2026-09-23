/* The pages that are not the app.
 *
 * Right now that means one: /delete.html, the public way out of Beatfall. It
 * gets a suite of its own because it is the only page whose absence or
 * breakage stops the phone app from being publishable at all. Google requires
 * a deletion route that works for somebody who has already uninstalled the
 * app, which means this page has to work with no session, on a phone, for a
 * store reviewer who has never seen Beatfall before.
 *
 * The stub is built here rather than by hand: the real file is read from
 * public/, its CDN script and app.js are swapped for a fake BF, and nothing
 * else about it is touched. A test that runs against a copy is a test of the
 * copy.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const STUB = `<script>
(function(){
  const BF = {}; window.BF = BF;
  window.__CALLS__ = [];
  const ACCOUNT = window.__ACCOUNT__ || {email:'w@example.com', subscription_status:'active'};
  BF.ready = () => document.documentElement.classList.remove('booting');
  BF.isSmallScreen = () => false;
  BF.deviceId = () => 'web_stub';
  BF.track = (n) => window.__CALLS__.push('track:' + n);
  BF.explain = (e) => (e && e.message) || 'Something went wrong.';
  BF.init = async () => (window.__SIGNED_OUT__ ? null
    : {user:{id:'u1', email: ACCOUNT.email}});
  BF.api = async (p, o) => {
    const body = o && o.body ? JSON.parse(o.body) : {};
    window.__CALLS__.push(p.split('?')[0] + ':' + (body.action || (o && o.method) || 'GET'));
    if (window.__DELETE_FAILS__ && body.action === 'delete_account') {
      const e = new Error('Your subscription could not be reached.'); e.status = 502; throw e;
    }
    if (p.indexOf('/api/account') === 0) return ACCOUNT;
    /* The admin reports. This page had no suite at all, which is how it went
       on quoting a stale top-up size for a day and how an unguarded field
       could blank the whole thing. */
    if (p.indexOf('/api/admin') === 0) {
      if (window.__DENIED__) { const e = new Error('not_admin'); e.status = 403; throw e; }
      return window.__ADMIN__ || {};
    }
    return {};
  };
  // Enough of the shared platform layer for the pages that are not the app.
  BF.readMode  = () => 'light';
  BF.applyMode = () => {};
  BF.cycleMode = () => {};
  BF.requireSession = async () => ({user:{id:'u1', email: ACCOUNT.email}});
  BF.signOut = () => window.__CALLS__.push('signout');
  BF.money = n => '$' + (Math.round(n * 100) / 100).toFixed(2);
  BF.when  = iso => iso ? 'recently' : '·';
  BF.sb = { auth: {
    signInWithOtp: async (o) => {
      window.__CALLS__.push('otp:' + o.email);
      if (o.options && o.options.shouldCreateUser === false) window.__NOCREATE__ = true;
      return window.__NO_SUCH_USER__
        ? {error:{message:'Signups not allowed for otp'}} : {error:null};
    },
    verifyOtp: async (o) => {
      window.__CALLS__.push('verify:' + o.token);
      if (String(o.token) !== '123456') return {error:{message:'Token has expired or is invalid'}};
      window.__SIGNED_OUT__ = false;
      return {error:null};
    },
    signOut: async () => { window.__CALLS__.push('signout'); },
  }};
})();
</script>`;

function build(file) {
  let s = fs.readFileSync(path.resolve('../public/' + file), 'utf8');
  s = s.replace(/<script src="https:\/\/[^"]*"><\/script>\n?/g, '');
  s = s.replace('<script src="/app.js"></script>', () => STUB);
  s = s.replace(/href="\/theme\.css"/g, 'href="../public/theme.css"');
  const out = 'stub-' + file;
  fs.writeFileSync(out, s);
  return 'file://' + path.resolve(out);
}

const results = [];
function check(name, ok, detail) {
  results.push({name, ok});
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || !detail ? '' : '\n          ' + detail));
}

async function page(browser, url, before, arg) {
  const p = await browser.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => {
    const t = m.text();
    /* The font stylesheet is a real network request and this suite runs with
       no network. It is not the page being broken. */
    if (m.type() === 'error'
        && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|favicon|fonts\./.test(t)) {
      errors.push('console: ' + t);
    }
  });
  if (before) await p.addInitScript(before, arg);
  await p.goto(url);
  await p.waitForTimeout(350);
  return { p, errors };
}

(async () => {
  const url = build('delete.html');
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ------------------------------------------- somebody who is already signed in
  {
    const { p, errors } = await page(browser, url);
    const st = await p.evaluate(() => ({
      go: !document.getElementById('stepgo').hidden,
      who: document.getElementById('who').textContent,
      dead: document.getElementById('kill').disabled,
      lists: document.querySelectorAll('.gone li:not([hidden])').length,
      sub: !document.getElementById('subline').hidden,
    }));
    check('a signed in visitor lands on the confirm step', st.go === true, JSON.stringify(st));
    check('and is told which account they are about to remove', /Signed in as/.test(st.who), st.who);
    check('what gets deleted is listed before anything is asked', st.lists >= 3, String(st.lists));
    check('a live subscription is named as part of what ends', st.sub === true);
    check('the button is dead until the email is typed', st.dead === true);

    const typed = await p.evaluate(() => {
      const el = document.getElementById('confirm');
      el.value = 'someone@else.com'; el.dispatchEvent(new Event('input'));
      const wrong = document.getElementById('kill').disabled;
      el.value = ' W@Example.com '; el.dispatchEvent(new Event('input'));
      return {wrong, right: document.getElementById('kill').disabled};
    });
    check('the wrong address leaves it dead', typed.wrong === true);
    check('the right one wakes it, whatever the case and spacing', typed.right === false);

    const done = await p.evaluate(async () => {
      document.getElementById('kill').click();
      await new Promise(r => setTimeout(r, 200));
      return {calls: window.__CALLS__.slice(),
              done: !document.getElementById('stepdone').hidden,
              go: !document.getElementById('stepgo').hidden};
    });
    check('pressing it asks the server to delete the account',
      done.calls.indexOf('/api/account:delete_account') >= 0, JSON.stringify(done.calls));
    check('it signs the browser out afterwards',
      done.calls.indexOf('signout') >= 0, JSON.stringify(done.calls));
    check('and the page says so plainly', done.done === true && done.go === false,
      JSON.stringify(done));
    check('no page errors on the signed in route', errors.length === 0, errors.join('\n'));
    await p.close();
  }

  // ------------------------------ a failure must not look like a deleted account
  {
    const { p } = await page(browser, url, () => { window.__DELETE_FAILS__ = true; });
    const after = await p.evaluate(async () => {
      const el = document.getElementById('confirm');
      el.value = 'w@example.com'; el.dispatchEvent(new Event('input'));
      document.getElementById('kill').click();
      await new Promise(r => setTimeout(r, 200));
      return {done: !document.getElementById('stepdone').hidden,
              err: document.getElementById('err').textContent,
              again: !document.getElementById('kill').disabled};
    });
    check('a server that refuses does not get a farewell screen', after.done === false);
    check('it says what happened instead', after.err.length > 0, after.err);
    check('and the button comes back so they can try again', after.again === true);
    await p.close();
  }

  // ----------------------- the reason this page exists: no app, no session, no idea
  {
    const { p, errors } = await page(browser, url, () => { window.__SIGNED_OUT__ = true; });
    const first = await p.evaluate(() => ({
      who: !document.getElementById('stepwho').hidden,
      go: !document.getElementById('stepgo').hidden,
      stuck: !document.getElementById('stuck').hidden,
    }));
    check('a stranger with no session is asked who they are', first.who === true,
      JSON.stringify(first));
    check('and is not shown a delete button they cannot use', first.go === false);
    check('there is a way out for somebody who lost the email address',
      first.stuck === true);

    const sent = await p.evaluate(async () => {
      document.getElementById('email').value = 'w@example.com';
      document.getElementById('askform').dispatchEvent(new Event('submit', {cancelable:true}));
      await new Promise(r => setTimeout(r, 250));
      return {code: !document.getElementById('stepcode').hidden,
              to: document.getElementById('sentTo').textContent,
              nocreate: !!window.__NOCREATE__};
    });
    check('typing an address sends a code', sent.code === true && sent.to === 'w@example.com',
      JSON.stringify(sent));
    /* The single most important line in this file. On the sign-in page the
       same box is allowed to create an account. Here that would mean a
       stranger typing any address gets an account made for them so that they
       can delete it. */
    check('and the code never creates an account that did not exist',
      sent.nocreate === true);

    const wrong = await p.evaluate(async () => {
      document.getElementById('code').value = '000000';
      document.getElementById('codeform').dispatchEvent(new Event('submit', {cancelable:true}));
      await new Promise(r => setTimeout(r, 250));
      return {err: document.getElementById('err').textContent,
              go: !document.getElementById('stepgo').hidden};
    });
    check('a bad code is refused and explained', /didn’t work|didn't work/.test(wrong.err),
      wrong.err);
    check('and does not let anybody through', wrong.go === false);

    const right = await p.evaluate(async () => {
      document.getElementById('code').value = '123456';
      document.getElementById('codeform').dispatchEvent(new Event('submit', {cancelable:true}));
      await new Promise(r => setTimeout(r, 300));
      return {go: !document.getElementById('stepgo').hidden,
              who: document.getElementById('who').textContent};
    });
    check('the right code reaches the confirm step', right.go === true, JSON.stringify(right));
    check('naming the account it is about to remove', /w@example\.com/.test(right.who), right.who);
    check('no page errors on the signed out route', errors.length === 0, errors.join('\n'));
    await p.close();
  }

  // ------------------------------------------- an address with no account behind it
  {
    const { p } = await page(browser, url, () => {
      window.__SIGNED_OUT__ = true; window.__NO_SUCH_USER__ = true;
    });
    const said = await p.evaluate(async () => {
      document.getElementById('email').value = 'nobody@example.com';
      document.getElementById('askform').dispatchEvent(new Event('submit', {cancelable:true}));
      await new Promise(r => setTimeout(r, 250));
      return {err: document.getElementById('err').textContent,
              code: !document.getElementById('stepcode').hidden};
    });
    check('an address with no account is told so, not left waiting for a code',
      /no Beatfall account/.test(said.err), said.err);
    check('and is not sent to the code step', said.code === false);
    await p.close();
  }

  /* ------------------- the legal pages, opened from inside the phone app
     They are handed to a sheet that sits on top of the app. What must not be
     on them there is a way OUT of the app: on a phone "Back to the board"
     leads to a board that cannot be used, and the writer is then two taps from
     being outside Beatfall with no way back in. */
  for (const doc of ['privacy.html', 'terms.html']) {
    const u = build(doc);
    const { p, errors } = await page(browser, u + '?app=1');
    const st = await p.evaluate(() => {
      const shown = Array.from(document.querySelectorAll('.topbar .right a'))
        .filter(a => !a.hidden).map(a => a.getAttribute('href'));
      const brand = document.querySelector('.topbar .brand');
      return {shown, brandLinks: !!(brand && brand.getAttribute('href')),
              words: document.querySelector('.doc').textContent.length};
    });
    check(doc + ' in the app offers no way back to the board',
      st.shown.every(h => h !== '/app'), st.shown.join(' '));
    check('and does not point at a page about money',
      st.shown.every(h => String(h).indexOf('billing') < 0), st.shown.join(' '));
    check('the other document is still one tap away, inside the sheet',
      st.shown.length === 1, st.shown.join(' '));
    check('the mark is not a link out either', st.brandLinks === false);
    check('and the document itself is all still there', st.words > 3000, String(st.words));
    check('no page errors in app mode', errors.length === 0, errors.join('\n'));
    await p.close();

    /* And on a desktop the page is untouched, because the same file serves
       both and the writer at a keyboard does want a way back. */
    const { p: q } = await page(browser, u);
    const web = await q.evaluate(() => Array.from(document.querySelectorAll('.topbar .right a'))
      .filter(a => !a.hidden).map(a => a.getAttribute('href')));
    check(doc + ' in a browser keeps its whole top bar', web.length === 3, web.join(' '));
    await q.close();
  }

  /* ------------------- the masthead, on the pages that share one top bar
     The tagline is a CSS mask over a data URI, and a mask that fails renders
     as a solid bar rather than as nothing, so it looks like a design decision
     instead of a fault. It shipped broken for a fortnight that way, invisible
     only because the element had no width. These measure the thing itself:
     that it is there, that it is under the wordmark, and that it is big enough
     to read. Cap height is the test, not box height, because the box includes
     the descender on the p. */
  const CAP = 25.58 / 32.66;      // the art's ascender over its full ink box
  for (const [doc, out] of [['login.html', true], ['privacy.html', false]]) {
    const u = build(doc);
    const { p } = await page(browser, u, out ? (() => { window.__SIGNED_OUT__ = true; }) : null);
    const m = await p.evaluate(() => {
      const tag = document.querySelector('.topbar-in > .masthead .brandtag');
      const mk = document.querySelector('.topbar-in > .masthead .brandmark');
      if (!tag || !mk) return null;
      const t = tag.getBoundingClientRect(), k = mk.getBoundingClientRect();
      const cs = getComputedStyle(tag);
      return {tw: t.width, th: t.height, under: t.top >= k.bottom - 1,
              masked: (cs.maskImage || cs.webkitMaskImage || '').indexOf('svg') > 0};
    });
    check(doc + ': the tagline is in the header', !!m && m.tw > 100,
      m ? JSON.stringify(m) : 'no .brandtag in the top bar');
    if (m) {
      check('and it is the artwork, not a solid bar', m.masked);
      check('and it sits under the wordmark', m.under);
      check('and its capitals reach 8px (' + (m.th * CAP).toFixed(1) + 'px)',
        m.th * CAP >= 8, String(m.th));
    }
    await p.setViewportSize({width: 390, height: 844});
    await p.waitForTimeout(200);
    const small = await p.$eval('.masthead .brandtag', el => getComputedStyle(el).display);
    check('and it comes off on a phone rather than blurring', small === 'none', small);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth);
    check('and nothing runs off a 390px phone', wide <= 391, String(wide));
    await p.close();
  }

  /* ==================================================== THE ADMIN REPORTS
   *
   * This page has never had a suite, and the two things that have actually
   * gone wrong on it are both things a suite catches: a figure typed into the
   * template that went stale when the real one moved, and a field read without
   * a guard that blanks the whole page when the server is a version behind.
   *
   * It is also the page Kris will read every morning during the test, so what
   * it says has to be true.
   */
  const adminUrl = build('admin.html');

  const REPORT = {
    window_days: 30,
    totals: {people: 6, active_in_window: 4, returned: 3, paying: 2,
             cost_usd: 2.41, calls: 512},
    mine: {people: 2, cost_usd: 1.13, calls: 214},
    money: {
      topup: [
        {label: 'Ran out of credits', n: 5, who: 3},
        {label: 'Opened the top-up',  n: 2, who: 2},
        {label: 'Credits landed',     n: 1, who: 1}
      ],
      plan: [
        {label: 'Opened checkout', n: 3, who: 3},
        {label: 'Subscribed',      n: 2, who: 2},
        {label: 'Cancelled',       n: 0, who: 0}
      ]
    },
    stripe_configured: true,
    stripe_live: false,
    credits_per_active_user: {median: 40, p75: 62, p90: 71, max: 88},
    cost_per_active_user_usd: {median: 0.31, p90: 0.62, max: 0.71},
    plans: {trial: {credits: 25}, beatfall: {credits: 75}},
    pricing: {month: 15, year: 149, topup_credits: 25, topup_price: 6},
    events: {placed_by_hand: 40, import_completed: 6},
    funnel: [{label: 'Signed up', n: 6, from_prev: null},
             {label: 'Paying', n: 2, from_prev: 33}],
    internal_count: 2,
    by_path: [{key: 'import', users: 3, meaningful: 2, d1: 2, d7: 1, paid: 1}],
    sources: [{key: 'direct', users: 6, activated: 3, paid: 2, cost_usd: 2.41}],
    failures: [{name: 'import_failed', n: 1}, {name: 'ai_request_failed', n: 0}],
    cancel_reasons: {},
    users: [{id: 'u1', email: 'w@example.com', name: 'Writer', plan: 'beatfall',
             status: 'active', created_at: '2026-09-01T00:00:00Z',
             last_seen_at: '2026-09-22T00:00:00Z', real_projects: 2, real_cards: 40,
             calls: 120, credits: 60, allowance: 75, cost_usd: 0.31, kinds: {import: 3}}]
  };

  {
    const { p, errors } = await page(browser, adminUrl,
      r => { window.__ADMIN__ = r; }, REPORT);
    const seen = await p.evaluate(() => ({
      up: !document.getElementById('body').hidden,
      denied: !document.getElementById('denied').hidden,
      tiles: [...document.querySelectorAll('#stats .stat .n')].map(e => e.textContent),
      mine: document.getElementById('mine').textContent,
      money: [...document.querySelectorAll('#money .cap')].map(c =>
        c.querySelector('h3').textContent),
      chain: [...document.querySelectorAll('#money .cap:first-child div b')]
        .map(b => b.textContent),
      growthOpen: document.getElementById('growth').open,
      // Panels that must NOT be folded away: this is the morning read.
      wrong: [...document.querySelectorAll('.panel h2')]
        .filter(h => !h.closest('#growth')).map(h => h.textContent),
      people: document.querySelectorAll('#rows tr').length
    }));

    check('the admin page draws', seen.up === true && seen.denied === false);
    check('the six tiles are the six external figures',
      seen.tiles.join(',') === '6,4,3,2,$2.41,512', seen.tiles.join(','));
    check('and what was left out of them is said out loud',
      /2 of your own accounts/.test(seen.mine) && /\$1\.13/.test(seen.mine), seen.mine);
    check('the money path is the first thing after the tiles',
      /Running out/.test(seen.money[0] || ''), JSON.stringify(seen.money));
    check('each stage says how many times AND how many people',
      seen.chain[0] === '53 people', JSON.stringify(seen.chain));
    check('a stage nobody reached still prints its zero',
      seen.chain.length === 3 && /^1/.test(seen.chain[2]), JSON.stringify(seen.chain));
    check('the growth panels start folded away', seen.growthOpen === false);
    check('what went wrong is not folded away',
      seen.wrong.some(h => /went wrong/i.test(h)), seen.wrong.join(' | '));
    check('and neither are the people', seen.wrong.some(h => /People/.test(h)));
    check('the People table lists everybody', seen.people === 1, String(seen.people));
    check('no page errors on the admin reports', errors.length === 0, errors.join('\n'));
    await p.close();
  }

  /* WHICH STRIPE THIS IS, read off the server rather than typed here. It was
     a literal in the template for about an hour, which would have gone stale
     the moment the live key was pasted into Vercel. */
  {
    const { p } = await page(browser, adminUrl,
      r => { window.__ADMIN__ = r; }, Object.assign({}, REPORT, {stripe_live: false}));
    const t = await p.evaluate(() =>
      document.querySelectorAll('#money .cap h3')[2].textContent);
    check('test mode says test mode', /test mode/i.test(t), t);
    await p.close();
  }
  {
    const { p } = await page(browser, adminUrl,
      r => { window.__ADMIN__ = r; }, Object.assign({}, REPORT, {stripe_live: true}));
    const live = await p.evaluate(() => ({
      head: document.querySelectorAll('#money .cap h3')[2].textContent,
      cards: document.querySelectorAll('#money .cap')[2]
        .querySelectorAll('b')[0].textContent
    }));
    check('and a live key says live, with no edit to the page',
      /is live/i.test(live.head) && live.cards === 'real', JSON.stringify(live));
    await p.close();
  }

  // A version of the server that does not know about the new fields must not
  // blank the page. Kris deploys these separately, so this state is real.
  {
    const older = Object.assign({}, REPORT);
    delete older.money; delete older.mine;
    delete older.stripe_live; delete older.stripe_configured;
    const { p, errors } = await page(browser, adminUrl,
      r => { window.__ADMIN__ = r; }, older);
    const ok = await p.evaluate(() => ({
      up: !document.getElementById('body').hidden,
      people: document.querySelectorAll('#rows tr').length
    }));
    check('an older server does not blank the page',
      ok.up === true && ok.people === 1, JSON.stringify(ok));
    check('and throws nothing while doing it', errors.length === 0, errors.join('\n'));
    await p.close();
  }

  // Not an admin. The request 401s or 403s and nothing is drawn.
  {
    const { p, errors } = await page(browser, adminUrl, () => { window.__DENIED__ = true; });
    const st = await p.evaluate(() => ({
      denied: !document.getElementById('denied').hidden,
      body: !document.getElementById('body').hidden,
      figures: document.querySelectorAll('#stats .stat').length
    }));
    check('a refused account sees the denied line', st.denied === true);
    check('and no figures are drawn at all',
      st.body === false && st.figures === 0, JSON.stringify(st));
    check('no page errors being refused', errors.length === 0, errors.join('\n'));
    await p.close();
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + ' of ' + results.length + ' passed');
  if (failed.length) {
    console.log('\nFAILED:');
    failed.forEach(f => console.log('  ' + f.name));
    process.exit(1);
  }
})();
