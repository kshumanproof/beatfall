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

async function page(browser, url, before) {
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
  if (before) await p.addInitScript(before);
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

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + ' of ' + results.length + ' passed');
  if (failed.length) {
    console.log('\nFAILED:');
    failed.forEach(f => console.log('  ' + f.name));
    process.exit(1);
  }
})();
