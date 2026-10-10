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
   * MOVED OUT, 9 October 2026, to `test/admin.js`.
   *
   * The admin page used to be one screen reading one enormous object, and the
   * checks for it lived here beside the other pages that are not the app. It
   * is six screens over a split endpoint now, with its own actions, its own
   * routing and its own states, and its views are a module this page imports.
   * A module script will not load from a file URL, so that suite serves the
   * page over http instead, which is a different harness rather than a few
   * more checks in this one.
   *
   * What lives here still: admin.html in the noindex list, in the private
   * list, and out of the sitemap. Those are facts about the SITE and belong
   * with the other pages. Everything about what the page draws is in
   * test/admin.js.
   */

  /* ====================================================== THE HELP PAGE
   *
   * The written answers, and nothing else. The asking moved to Chatling on
   * 26 September: the bubble, the chat panel and the support form that used
   * to live in /helpchat.js are gone, along with the endpoint behind them.
   *
   * What is left still has to do the two things this page was rebuilt to do.
   * Draw its answers from the one place Beatfall's behaviour is written down,
   * rather than carrying a typed copy that goes stale. And work with NO
   * ACCOUNT, which is why nothing on it calls BF.init and nothing on it uses
   * BF.api: the likeliest reason somebody is here is that they cannot get in.
   */
  const helpUrl = build('help.html');

  const TOPICS = {
    support: 'support@beatfall.app',
    sections: ['Starting out', 'Projects'],
    topics: [
      {id: 'signing-in', section: 'Starting out', q: 'How do I sign in?',
       a: 'There is no password.\n\nBeatfall sends a six digit code.'},
      {id: 'first-project', section: 'Projects', q: 'How do I add a new project?',
       a: 'Press New project on the dashboard.'}
    ]
  };

  /* The page talks to /api/help with a plain fetch, so that is what gets
     stubbed. Using BF.api would be testing something the page does not do: it
     avoids it on purpose, because BF.api wants a Supabase client this page
     never builds. The endpoint is GET only now, so this stub is too. */
  const netStub = (r) => {
    window.fetch = async () => ({ok: true, json: async () => r.topics});
  };

  {
    const { p, errors } = await page(browser, helpUrl, netStub, {topics: TOPICS});
    const drawn = await p.evaluate(() => ({
      groups: document.querySelectorAll('#topics [data-group]').length,
      answers: document.querySelectorAll('#topics [data-answer]').length,
      heading: (document.querySelector('#topics h3') || {}).textContent || '',
      /* The FIRST answer on the page, not the first in each group. Every
         group's opening article is also a :first-child, so that selector
         counts paragraphs from all of them at once. */
      paras: document.querySelector('#topics [data-answer]')
             .querySelectorAll('p').length,
      loading: document.getElementById('loading').hidden
    }));
    check('the help page draws its answers from the server',
      drawn.answers === 2 && drawn.groups === 2, JSON.stringify(drawn));
    check('the heading is the question somebody would ask',
      /How do I sign in/.test(drawn.heading), drawn.heading);
    check('a multi paragraph answer stays multi paragraph', drawn.paras === 2,
      String(drawn.paras));
    check('and the loading line goes away', drawn.loading === true);
    check('no page errors on the help page', errors.length === 0, errors.join('\n'));
    await p.close();
  }

  /* THE DEAD END KRIS FOUND, in its current form. Typing something the words
     do not match must not leave somebody holding nothing. It points at the
     bubble, which is on this page too, and gives the address as the other way
     through. */
  {
    const { p } = await page(browser, helpUrl, netStub, {topics: TOPICS});
    const empty = await p.evaluate(() => {
      const box = document.getElementById('helpsearch');
      box.value = 'two doves';
      box.dispatchEvent(new Event('input'));
      const nr = document.getElementById('noresults');
      return {
        shown: !nr.hidden,
        words: nr.textContent,
        mail: !!nr.querySelector('a[href^="mailto:"]'),
        visible: document.querySelectorAll('#topics [data-answer]:not([hidden])').length
      };
    });
    check('a search that matches nothing says so', empty.shown && empty.visible === 0,
      JSON.stringify(empty));
    check('and it points at the chat rather than stopping there',
      /chat/i.test(empty.words), empty.words);
    check('with a way to reach a person beside it', empty.mail === true);
    await p.close();
  }

  /* ============================================== THE BUBBLE ON EVERY PAGE
   *
   * Kris asked where it was, standing on the dashboard. The answer was that
   * it was only on the help page. That is still the thing worth checking, and
   * it is now Chatling's script rather than ours.
   *
   * Checked in the SOURCE and not in a browser, deliberately. The widget is
   * fetched from chatling.ai, and build() strips every external script so
   * these stubs cannot reach the network. A page that has lost the tag is the
   * failure this guards against. Whether Chatling's own servers are up is not
   * something a test here can answer, or should try to.
   */
  {
    /* NOT QUITE EVERY PAGE, AND THE THREE EXCEPTIONS ARE THE POINT.
       Privacy and Terms are documents. They are linked from emails and store
       listings, they are read by the people most careful about where their
       data goes, and loading a third party's script on the page that discloses
       third parties is the one place that reads badly. Admin is Kris's own
       screen and has nobody to support. */
    const EVERYWHERE = ['index.html', 'login.html', 'billing.html', 'help.html',
                        'delete.html', '404.html', 'settings.html', 'app.html'];
    const NOWHERE = ['privacy.html', 'terms.html', 'admin.html'];
    const src = f => fs.readFileSync(path.resolve('../public/' + f), 'utf8');

    const missing = EVERYWHERE.filter(f => !/chatling\.ai\/js\/embed\.js/.test(src(f)));
    check('every page that should carry the support bubble does',
      missing.length === 0, 'missing on: ' + missing.join(', '));
    /* The SCRIPT, not the word. Privacy names Chatling in three places on
       purpose, because it is the page that discloses who processes what. */
    const strays = NOWHERE.filter(f =>
      /chatling\.ai\/js\/embed\.js/.test(src(f)) || /chtlConfig/.test(src(f)));
    check('and the documents and the admin screen do not',
      strays.length === 0, 'a third party is loading on: ' + strays.join(', '));

    /* The disclosure and the code have to agree. A page listing who processes
       what is the one page in this product that cannot be out of date. */
    const priv = src('privacy.html');
    check('the Privacy Policy names who runs the support chat',
      /Chatling/.test(priv) && /OpenAI/.test(priv), 'Chatling is not disclosed');
    check('and says it cannot reach an account or a board',
      /cannot access your projects or account/i.test(priv), '');

    /* The id is what ties the widget to this account. A page carrying the
       script with no id, or with a different one, loads a stranger's bot. */
    const ids = EVERYWHERE.map(f => (src(f).match(/chatbotId:\s*"(\d+)"/) || [])[1]);
    check('and all of them point at the same chatbot',
      ids.every(Boolean) && new Set(ids).size === 1, JSON.stringify(ids));

    /* The widget that was taken out must leave nothing behind. A stale tag
       would 404 on every page load, which is invisible until somebody thinks
       to read a console. */
    const stale = EVERYWHERE.concat(NOWHERE).filter(f => /helpchat\.js/.test(src(f)));
    check('and nothing still asks for the widget that was taken out',
      stale.length === 0, 'still referenced by: ' + stale.join(', '));
    check('and that file is gone from the site',
      !fs.existsSync(path.resolve('../public/helpchat.js')), '');
  }

  /* ================================================== WHAT SEARCH ENGINES SEE
   *
   * None of this can be checked in a browser, because none of it is behaviour:
   * it is what a crawler reads off the page before it renders anything. So
   * these read the files.
   *
   * The one that matters most is the beta. Nobody has told Google this site
   * exists, but a hostname is published to public certificate transparency
   * logs the moment an HTTPS certificate is issued, and those are scraped. A
   * beta that gets indexed before the real domain is pointed competes with the
   * real domain for the product's own name, which is slow and annoying to
   * unwind and free to prevent.
   */
  {
    const src = f => fs.readFileSync(path.resolve('../public/' + f), 'utf8');
    const PUBLIC  = ['index.html', 'login.html', 'billing.html', 'privacy.html',
                     'terms.html', 'help.html'];
    const PRIVATE = ['app.html', 'settings.html', 'admin.html',
                     'delete.html', '404.html'];

    /* THE BETA IS REFUSED AT THE HEADER, not by a tag in the HTML, and the
       difference is the whole point. The real domain will be served by this
       same project, so a tag would launch the live site invisible. */
    const vercel = JSON.parse(fs.readFileSync(path.resolve('../vercel.json'), 'utf8'));
    const rule = (vercel.headers || []).find(h =>
      (h.headers || []).some(x => x.key === 'X-Robots-Tag'));
    check('a preview domain is told not to index itself', !!rule,
      'nothing stops the beta being indexed');
    check('and it is conditional on the host, so the live site is not caught too',
      !!rule && (rule.has || []).some(h => h.type === 'host' && /vercel/.test(h.value) && /app/.test(h.value)),
      JSON.stringify(rule));
    check('and it covers every page rather than the homepage',
      !!rule && rule.source === '/(.*)', rule && rule.source);

    /* The three signed-in surfaces should not be indexed on ANY domain, so
       those carry a tag of their own as well. */
    const bare = PRIVATE.filter(f => !/name="robots"[^>]*noindex/.test(src(f)));
    check('every page behind a sign-in says noindex in its own right',
      bare.length === 0, 'missing on: ' + bare.join(', '));
    const wrongly = PUBLIC.filter(f => /name="robots"[^>]*noindex/.test(src(f)));
    check('and no public page does, which would make the site invisible',
      wrongly.length === 0, 'noindex on: ' + wrongly.join(', '));

    /* A shared link is a card or it is a grey box, and the difference is four
       tags. This used to be the homepage only. */
    const missing = { canonical: [], title: [], image: [], desc: [] };
    PUBLIC.forEach(f => {
      const h = src(f);
      if (!/<link rel="canonical" href="https:\/\/beatfall\.app/.test(h)) missing.canonical.push(f);
      if (!/property="og:title"/.test(h)) missing.title.push(f);
      if (!/property="og:image" content="https:\/\/beatfall\.app\/brand\/og\.png"/.test(h)) missing.image.push(f);
      if (!/property="og:description" content="[^"]/.test(h)) missing.desc.push(f);
    });
    check('every public page says which address is the real one',
      missing.canonical.length === 0, 'no canonical on: ' + missing.canonical.join(', '));
    check('and carries a share card rather than posting as a grey box',
      missing.title.length === 0 && missing.image.length === 0 && missing.desc.length === 0,
      JSON.stringify(missing));
    check('and the picture on that card exists',
      fs.existsSync(path.resolve('../public/brand/og.png')), 'og.png is missing');

    /* Two copies of a canonical link, or two og:title tags, is how a page ends
       up telling a crawler two different things and having one picked for it. */
    const doubled = PUBLIC.filter(f =>
      (src(f).match(/rel="canonical"/g) || []).length > 1
      || (src(f).match(/property="og:title"/g) || []).length > 1);
    check('and says each of those things exactly once',
      doubled.length === 0, 'duplicated on: ' + doubled.join(', '));

  /* ==================================== THE CORNER THE CHAT BUBBLE OWNS
   *
   * The support chat launcher is fixed to the bottom right of the WINDOW, so
   * there is no scroll position at which it is out of the way: whatever is in
   * that corner is underneath it. It was found sitting on top of Send
   * feedback in the footer, which is the worst link in the product to cover,
   * because somebody reaching for it is already having a bad time.
   *
   * Scoped to the FOOTER. A bubble passing over the body of a long page on
   * the way down is not a defect; the footer is the one part of a page whose
   * whole job is links somebody has to be able to reach.
   *
   * And it is walked down rather than measured once, because the last scroll
   * position is the one place the links are NOT in the corner: at the very
   * bottom it is the copyright strip sitting there instead. A single
   * measurement would have picked exactly the position that passes.
   *
   * The launcher is a stand-in rather than the real widget, because the real
   * one is a third party script and this suite has no network. It is the size
   * Chatling's actually is, 60px with 20px of margin, so the rectangle being
   * asked about is the real rectangle.
   */
  {
    const FOOTED = ['index.html', 'billing.html', 'help.html', 'privacy.html',
                    'terms.html', 'login.html', 'delete.html', '404.html'];
    const SIZES = [[1440, 900], [1280, 900], [1024, 820], [820, 1000]];
    const covered = [];
    for (const f of FOOTED) {
      const u = build(f);
      for (const [w, h] of SIZES) {
        const p = await browser.newPage();
        await p.setViewportSize({ width: w, height: h });
        await p.goto(u);
        await p.waitForTimeout(250);
        const hits = await p.evaluate(async () => {
          const el = document.createElement('div');
          el.id = '__launcher';
          el.style.cssText = 'position:fixed;right:20px;bottom:20px;width:60px;'
            + 'height:60px;z-index:2147483000;pointer-events:none';
          document.body.appendChild(el);
          const found = new Set();
          const look = () => {
            const l = el.getBoundingClientRect();
            document.querySelectorAll('footer a[href],footer button').forEach(n => {
              if (n.hidden || n.closest('[hidden]')) return;
              const cs = getComputedStyle(n);
              if (cs.display === 'none' || cs.visibility === 'hidden') return;
              const r = n.getBoundingClientRect();
              if (!r.width || !r.height) return;
              if (r.right > l.left && r.bottom > l.top
                  && r.left < l.right && r.top < l.bottom)
                found.add((n.textContent || n.tagName).trim().slice(0, 30));
            });
          };
          /* EVERY POSITION THE FOOTER IS ON SCREEN AT, not just the bottom.
             The launcher is pinned to the window, so the footer slides under
             it on the way past and the last scroll position is the one place
             it is NOT the links in the corner. That is exactly the position a
             single measurement would have picked. */
          const max = Math.max(0, document.body.scrollHeight - innerHeight);
          for (let y = Math.max(0, max - innerHeight); y <= max; y += 24) {
            window.scrollTo(0, y);
            await new Promise(r => requestAnimationFrame(r));
            look();
          }
          window.scrollTo(0, max);
          await new Promise(r => requestAnimationFrame(r));
          look();
          el.remove();
          return [...found];
        });
        if (hits.length) covered.push(f + ' at ' + w + 'px: ' + hits.join(', '));
        await p.close();
      }
    }
    check('no page rests a link under the support chat bubble',
      covered.length === 0, covered.join('\n          '));
  }

    /* The sitemap is a list of addresses somebody should be able to land on.
       A signed-in page in it is an invitation to a locked door. */
    const map = fs.readFileSync(path.resolve('../public/sitemap.xml'), 'utf8');
    const locs = (map.match(/<loc>([^<]+)<\/loc>/g) || [])
      .map(l => l.replace(/<\/?loc>/g, ''));
    check('the sitemap lists the public pages', locs.length === 5, JSON.stringify(locs));
    check('and points at the real domain rather than the beta',
      locs.every(l => l.startsWith('https://beatfall.app')), JSON.stringify(locs));
    check('and offers nothing that needs a sign-in',
      !locs.some(l => /\/(app|settings|admin|login|delete)\b/.test(l)), JSON.stringify(locs));
    check('robots.txt points at that same sitemap',
      /Sitemap: https:\/\/beatfall\.app\/sitemap\.xml/
        .test(fs.readFileSync(path.resolve('../public/robots.txt'), 'utf8')), '');
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
