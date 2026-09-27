/* THE PLATFORM LAYER, IN A REAL BROWSER.
 *
 * `public/app.js` is the layer every signed-in page loads, and until now not
 * one line of it had ever run under test. Both browser suites replace it with
 * a hand-written stub, deliberately, because the real thing wants a Supabase
 * client and a session before it will do anything. That is the right call for
 * drive.js and flows.js, which are about the board.
 *
 * It does mean the platform itself went unexercised: the error reporter, the
 * device-takeover screen, the save and restore helpers. This file is the other
 * half. It loads the REAL app.js against a fake Supabase small enough to fit
 * in twenty lines, and drives it directly.
 *
 * Start with the error reporter, because it is the part whose whole job is to
 * work on a page where something has already gone wrong.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || !detail ? '' : '\n          ' + detail));
}

/* Just enough Supabase for app.js to finish booting. It never signs anybody
   in, which is the state that matters here: a page that throws is a page
   whose own setup may not have finished. */
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>platform</title></head><body>
<script>
window.supabase = { createClient: function () { return {
  auth: { getSession: async function(){ return {data:{session:null}}; },
          onAuthStateChange: function(){}, signOut: async function(){ return {}; } },
  channel: function(){ return { on: function(){ return this; }, subscribe: function(){ return this; } }; },
  removeChannel: function(){}
}; } };
window.__SIGNED_OUT__ = true;
</script>
<script src="../public/app.js"></script></body></html>`;

(async () => {
  const file = 'stub-platform.html';
  fs.writeFileSync(file, PAGE);
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });

  async function fresh() {
    const p = await browser.newPage();
    const boot = [];
    p.on('pageerror', e => boot.push(e.message));
    await p.goto('file://' + path.resolve(file));
    await p.waitForTimeout(120);
    /* Every check below reads what the reporter TRIED to send rather than
       letting it reach the network, which under file:// goes nowhere anyway
       and would make a failure look like a pass. */
    await p.evaluate(() => {
      window.__SENT__ = [];
      BF.track = (name, props) => window.__SENT__.push({ name: name, props: props });
    });
    return { p, boot };
  }

  // ---------------------------------------------- it loads and wires itself
  {
    const { p, boot } = await fresh();
    check('the real platform layer boots with no session',
      await p.evaluate(() => typeof BF === 'object'));
    check('and puts a reporter on the window',
      await p.evaluate(() => typeof BF.reportError === 'function'));
    check('with nothing thrown on the way up', boot.length === 0, boot.join('\n'));
    await p.close();
  }

  // ---------------------------------------------------- a throw is reported
  {
    const { p } = await fresh();
    const sent = await p.evaluate(() => {
      window.dispatchEvent(new ErrorEvent('error', {
        message: "Cannot read properties of null (reading 'hidden')",
        filename: 'https://beatfall.app/app.html', lineno: 4512, colno: 19
      }));
      return window.__SENT__;
    });
    check('a script error is reported', sent.length === 1, JSON.stringify(sent));
    const pr = (sent[0] || {}).props || {};
    check('under a name somebody can search for',
      (sent[0] || {}).name === 'script_error', (sent[0] || {}).name);
    check('it carries the file and the line',
      pr.error_where === 'app.html:4512:19', pr.error_where);
    check('and the page it happened on', pr.path === '/' + file || /platform/.test(pr.path || ''),
      pr.path);
    check('and whether anybody was signed in', pr.authenticated === false,
      String(pr.authenticated));
    /* A short quoted run is an identifier and is the useful half of the
       message. It has to survive the scrub. */
    check('a quoted identifier survives, because it is the answer',
      /reading 'hidden'/.test(pr.error_message || ''), pr.error_message);
    await p.close();
  }

  /* THE RULE THIS FEATURE LIVES OR DIES BY. A parse failure quotes the text
     that broke it, and the crash cushion in localStorage parses a whole
     board. If a writer's sentence can ride out in an error message then this
     reporter is a hole in the one promise the events table makes. */
  {
    const { p } = await fresh();
    const pr = await p.evaluate(() => {
      window.dispatchEvent(new ErrorEvent('error', {
        message: 'Unexpected token: "The lot at two in the morning, and the truck that should not be there."',
        filename: '/app.js', lineno: 9, colno: 1
      }));
      return window.__SENT__[0].props;
    });
    check('a writer\'s sentence never leaves in an error message',
      !/two in the morning/.test(pr.error_message),
      'IT DID: ' + pr.error_message);
    check('and what is left still says what kind of error it was',
      /Unexpected token/.test(pr.error_message), pr.error_message);
    await p.close();
  }

  // ----------------------------------------------------- it does not flood
  {
    const { p } = await fresh();
    const counts = await p.evaluate(() => {
      const fire = (m, ln) => window.dispatchEvent(new ErrorEvent('error',
        { message: m, filename: '/app.html', lineno: ln, colno: 1 }));
      // The same error twenty times, which is what a throw inside a render
      // or a scroll handler actually looks like.
      for (let i = 0; i < 20; i++) fire('the same thing went wrong', 10);
      const same = window.__SENT__.length;
      // Then enough distinct ones to run past the ceiling.
      for (let i = 0; i < 12; i++) fire('a different thing ' + i, 20 + i);
      return { same, total: window.__SENT__.length };
    });
    check('the same error twenty times is reported once',
      counts.same === 1, String(counts.same));
    check('and a broken page cannot post a hundred rows about it',
      counts.total === 5, String(counts.total));
    await p.close();
  }

  /* A failed image or stylesheet raises the same event with no message on it.
     There is nothing to read in those and they are not script errors. */
  {
    const { p } = await fresh();
    const n = await p.evaluate(() => {
      window.dispatchEvent(new ErrorEvent('error', {}));
      window.dispatchEvent(new ErrorEvent('error', { message: '' }));
      return window.__SENT__.length;
    });
    check('a picture that would not load is not a script error', n === 0, String(n));
    await p.close();
  }

  // ------------------------------------------- a promise nobody caught
  {
    const { p } = await fresh();
    const sent = await p.evaluate(async () => {
      Promise.reject(new Error('the save never came back'));
      await new Promise(r => setTimeout(r, 60));
      return window.__SENT__;
    });
    check('an unhandled promise is reported too',
      sent.length === 1 && /never came back/.test(sent[0].props.error_message),
      JSON.stringify(sent));
    check('and says it was a promise rather than a line number',
      sent.length === 1 && sent[0].props.error_where === 'promise',
      JSON.stringify((sent[0] || {}).props));
    await p.close();
  }

  /* A reporter that throws is worse than no reporter: it turns one broken
     control into a broken page. */
  {
    const { p } = await fresh();
    const ok = await p.evaluate(() => {
      BF.track = () => { throw new Error('the reporter itself is broken'); };
      try {
        window.dispatchEvent(new ErrorEvent('error',
          { message: 'something', filename: '/x.js', lineno: 1, colno: 1 }));
        return true;
      } catch (e) { return false; }
    });
    check('a reporter that cannot report does not take the page with it', ok === true);
    await p.close();
  }

  await browser.close();
  try { fs.unlinkSync(file); } catch (e) {}

  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + ' of ' + results.length + ' passed');
  if (failed.length) {
    console.log('\nFAILED:');
    failed.forEach(f => console.log('  ' + f.name));
    process.exit(1);
  }
})();
