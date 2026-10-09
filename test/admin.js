/* THE OPERATOR'S PAGE, DRIVEN IN A BROWSER.
 *
 * admin.html has never had a suite. That is not a small gap: it is the one
 * screen in the product that is read as evidence, so a figure on it being
 * confidently wrong is worse than the same figure being absent. It is also
 * the page that went on quoting a stale top-up size for a day, and the page
 * where one unguarded field would have taken the whole thing down with a
 * script error rather than leaving a card short of a number.
 *
 * WHAT RUNS HERE IS THE SHIPPED FILE. The real public/admin.html is read,
 * its CDN script and app.js are swapped for a fake platform layer, and
 * nothing else about it is touched. The views come from the real
 * public/admin-ui.js, over http rather than file:// because a module script
 * cannot be loaded from a file URL.
 *
 * The things it is actually checking, in the order the acceptance list names
 * them: that it starts and runs without errors; that an account which is not
 * an admin is refused and no figure is drawn; that every entry point lands
 * where it says and has a way back; that the overview's rows open the record
 * behind them; that search, order, paging and refresh keep their context;
 * that empty, partial, stale, failed and denied are five different pictures;
 * that an internal account is separated and not hidden; that no part of a
 * writer's work can reach this page; that every action asks, records and says
 * what happened; and that all of it holds in both themes and at the sizes
 * this page is actually opened at.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------------ the stub
   Enough of the platform layer for this page, and no more. Every call it
   makes is recorded, because half the checks below are about what the page
   asked for rather than what it drew. */
const STUB = `<script>
(function(){
  const BF = {}; window.BF = BF;
  window.__CALLS__ = [];
  BF.readMode  = () => (window.__MODE__ || 'light');
  BF.applyMode = (m) => { if (m === 'dark') document.documentElement.setAttribute('data-theme','dark'); };
  BF.cycleMode = () => { window.__CALLS__.push('cyclemode'); };
  BF.isSmallScreen = () => !!window.__SMALL__;
  BF.deviceId = () => 'web_stub';
  BF.signOut = () => window.__CALLS__.push('signout');
  BF.track = (n) => window.__CALLS__.push('track:' + n);
  /* The real one is what puts the small-screen gate up and bounces a signed
     out browser. A page that does not call it is a page with no door on it. */
  BF.requireSession = async () => {
    window.__CALLS__.push('requireSession');
    if (window.__SIGNED_OUT__) return null;
    if (BF.isSmallScreen()) return null;
    return { user: { id: 'k1' } };
  };
  BF.api = async (p, o) => {
    const body = o && o.body ? JSON.parse(o.body) : {};
    const q = p.split('?')[1] || '';
    const view = (q.match(/view=([a-z]+)/) || [])[1] || '';
    window.__CALLS__.push(p.split('?')[0] + (view ? ':' + view : '')
      + (body.action ? ':' + body.action : ''));
    window.__QUERIES__ = window.__QUERIES__ || [];
    if (q) window.__QUERIES__.push(q);
    if (p.indexOf('/api/account') === 0) {
      return window.__ME__ || { email: 'kris@beatfall.app', is_admin: true,
        unlimited: false, plan: 'none' };
    }
    if (p.split('?')[0] === '/api/admin' && o && o.method === 'POST') {
      window.__POSTS__ = window.__POSTS__ || [];
      window.__POSTS__.push(body);
      const r = window.__DO_RESULT__;
      if (r && r.throw) {
        const e = new Error(r.message || 'refused');
        e.code = r.code || 'refused'; e.status = r.status || 400; throw e;
      }
      return r || { ok: true };
    }
    if (p.indexOf('/api/admin') === 0) {
      if (window.__DENIED__) {
        const e = new Error('not_admin'); e.code = 'not_admin'; e.status = 403; throw e;
      }
      if (window.__FAIL_VIEW__ === view) {
        const e = new Error('This section could not be built.');
        e.code = 'view_failed'; e.status = 500; throw e;
      }
      const all = window.__ADMIN__ || {};
      return all[view] || all.overview || {};
    }
    return {};
  };
})();
</script>`;

function build() {
  let s = fs.readFileSync(path.resolve('../public/admin.html'), 'utf8');
  s = s.replace(/<script src="https:\/\/[^"]*"><\/script>\n?/g, '');
  s = s.replace('<script src="/app.js"></script>', () => STUB);
  // The font stylesheet is a real network request and this suite has no
  // network. Removing it keeps the console honest about real failures.
  s = s.replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>\n?/g, '');
  fs.writeFileSync('stub-admin.html', s);
}

/* A real server, because an ES module will not load from a file URL and the
   page imports its views as one. Serves the stub as /admin.html and
   everything else out of public/, so every absolute path in the shipped file
   resolves exactly as it does on the site. */
function serve() {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript',
    '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = name === '/admin.html'
      ? path.resolve('stub-admin.html')
      : path.resolve('../public' + name);
    fs.readFile(file, (err, buf) => {
      if (err) { res.statusCode = 404; res.end('no'); return; }
      res.setHeader('Content-Type', TYPES[path.extname(file)] || 'text/plain');
      res.end(buf);
    });
  });
  return new Promise(ok => server.listen(0, '127.0.0.1',
    () => ok({ server, port: server.address().port })));
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name
    + (ok || !detail ? '' : '\n          ' + detail));
}

const ago = n => new Date(Date.now() - n * 86400000).toISOString();
const figure = (value, meta) => Object.assign({ value }, meta || {});

/* ----------------------------------------------------------- the fixtures
   One payload per view, in the shape the real endpoint answers. Deliberately
   carries a few awkward cases: a figure that is null, a query that failed, an
   internal account, and a field holding something that looks like a writer's
   work, which must never be drawn. */
function fixtures() {
  return {
    overview: {
      view: 'overview', window_days: 30, tracking_started_at: ago(60),
      health: {
        records: { state: 'ok' }, costs: { state: 'ok' },
        work: { state: 'unknown', why: 'work_days did not answer' },
        alerts: { state: 'ok' }, undelivered: 2
      },
      attention: [
        { kind: 'issue', id: 1, severity: 'high', title: 'A read came back empty',
          detail: '4 times affecting 2 accounts', first_seen_at: ago(3),
          next: 'Open this issue', link: '#issue=1' },
        { kind: 'alert', id: 7, severity: 'urgent',
          title: 'Account u1 has cost $10.40 this allowance period',
          detail: 'Sent to you', first_seen_at: ago(1),
          next: 'Open this account', link: '#account=u1' }
      ],
      working: { total: figure(3, { window: 'last 30 days', population: 'customers' }),
        trial: figure(1), paid: figure(2),
        used_writing_help: figure(2, { means: 'used a feature that spends credits' }) },
      starting: { signed_up: figure(4),
        own_project_ever: figure(3, { window: 'all time' }),
        // A query that did not answer. Must be a dash and never a zero.
        organised_ever: { value: null, unavailable: 'the work records did not answer' } },
      subscriptions: { subscribers: figure(2), trialing: figure(1),
        scheduled_to_cancel: figure(1), payment_trouble: figure(0), ended: figure(0) },
      spend: { customers_usd: figure(1.42), trials_usd: figure(0.2),
        internal_usd: figure(9.1), calls: figure(31) },
      errors: ['work_days did not answer']
    },
    issues: {
      view: 'issues',
      issues: [
        { id: 1, title: 'A read came back empty', feature: 'import', stage: 'group',
          error_code: 'empty_reply', severity: 'high', status: 'new',
          occurrences: 4, accounts_in_window: 2, credits_in_window: 10,
          cost_usd_in_window: 0.09, first_seen_at: ago(3), last_seen_at: ago(1) },
        { id: 2, title: 'Ideas timed out', feature: 'ideas', severity: 'low',
          status: 'monitoring', occurrences: 1, accounts_in_window: 1,
          credits_in_window: 2, cost_usd_in_window: 0.01,
          first_seen_at: ago(9), last_seen_at: ago(9) }
      ],
      note: 'Quiet is not the same as fixed.', errors: []
    },
    writers: { view: 'writers', truncated: false, errors: [], writers: people(4) },
    product: {
      view: 'product', tracking_started_at: ago(60),
      journey: [
        { label: 'Account created', n: 4, of: 4, from_prev: null, means: 'every customer account' },
        { label: 'Started their own project', n: 3, of: 4, from_prev: 75, means: 'not the sample' },
        { label: 'Subscribing', n: 2, of: 3, from_prev: 67, means: 'paying right now' }
      ],
      returning: [{ window_days: 7, eligible: 3, returned: 2, means: 'worked again' }],
      by_path: [{ key: 'import', label: 'Started from notes', users: 3, organised: 2,
        returned: 2, paid: 1, too_small: true }],
      sources: [{ key: 'unknown', users: 2, organised: 1, paid: 0 }],
      features: [{ key: 'import', label: 'Reading notes', started: 9, finished: 7, failed: 2 },
        { key: 'conversation', label: 'Beat conversations', started: 4, finished: null, failed: null }],
      note: 'A quiet week is not a lost account.', errors: []
    },
    money: {
      view: 'money',
      collected: { subscriptions_usd: 30, packs_usd: 6, refunds_usd: 0,
        failed_usd: 15, note: 'Money that actually arrived.' },
      recurring: { monthly_payments: 2, annual_payments: 0,
        note: 'An annual payment is cash today and twelve months of service.' },
      costs: { customers_usd: 1.42, trials_usd: 0.2, internal_usd: 9.1,
        note: 'Provider cost only.' },
      credits: { charged: 142, refunded: 5, purchased: 25 },
      reconcile: { unknown_outcome: 1, failed_but_recorded: 2,
        note: 'Counted, never assumed either way.' },
      largest_actions: [{ feature: 'import', actions: 6, most_expensive_usd: 0.41,
        calls_in_that_one: 29, average_usd: 0.12, would_have_been_stopped: 0 }],
      budgets: [
        { scope: 'paid_period', warn_micros: 8000000, urgent_micros: 10000000,
          stop_micros: null, enforced: false, note: 'Approved 9 Oct. Alerts only.' },
        { scope: 'single_action', warn_micros: null, urgent_micros: null,
          stop_micros: 1500000, enforced: false, note: 'Observing.' }
      ],
      errors: []
    },
    system: {
      view: 'system', deploy: 'a1b2c3d', tracking_started_at: ago(60),
      stripe: { configured: true, live: false, note: 'Read off the key prefix.' },
      mail: { configured: true, alerts_to_set: false, undelivered: 2, gave_up: 1 },
      open_holds: 3, stuck_holds: 1, errors: []
    },
    account: {
      view: 'account', errors: [],
      account: { id: 'u1', email: 'u1@example.com', tag: 'acct_u1', plan: 'beatfall',
        status: 'active', created_at: ago(40), allowance: 75,
        credits_used_this_period: 31, credits_banked: 25, period_start: ago(5),
        help_paused_at: null },
      ledger: [{ created_at: ago(1), kind: 'charge', credits: -5, bucket: 'monthly',
        reason: 'import' }],
      payments: [{ created_at: ago(10), kind: 'subscription', amount_cents: 1500,
        status: 'paid', livemode: false }],
      usage: [{ created_at: ago(1), kind: 'import', credits: 5, cost_micros: 33000,
        status: 'ok' }],
      cases: []
    },
    issue: {
      view: 'issue', errors: [],
      issue: { id: 1, title: 'A read came back empty', feature: 'import',
        stage: 'group', error_code: 'empty_reply', severity: 'high', status: 'new',
        occurrences: 4, first_seen_at: ago(3), last_seen_at: ago(1),
        credits_charged: 10, credits_refunded: 0, deploy: 'a1b2c3d' },
      notes: [{ id: 1, author: 'kris@beatfall.app', body: 'It is the timeout.',
        created_at: ago(1) }],
      cases: [], occurrences: [{ created_at: ago(1), kind: 'import', stage: 'group',
        credits: 5, cost_micros: 60000, status: 'failed', error_code: 'empty_reply',
        duration_ms: 61000, deploy: 'a1b2c3d' }],
      occurrences_total: 4,
      accounts: [{ id: 'u1', email: 'u1@example.com', times: 3, credits: 10,
        cost_usd: 0.08, last_at: ago(1), internal: false }],
      money: { credits_charged: 10, credits_refunded: 0, cost_usd: 0.09,
        note: 'More credits were charged against this than were returned.' }
    }
  };
}

function people(n) {
  const rows = [];
  for (let i = 1; i <= n; i++) rows.push({
    id: 'u' + i, email: 'u' + i + '@example.com', name: null, tag: 'acct_u' + i,
    internal: i === 4, plan: i === 2 ? 'trial' : 'beatfall',
    status: i === 2 ? 'trialing' : 'active',
    created_at: ago(40 - i), last_worked: ago(i).slice(0, 10),
    work_days: 10 - i, projects: i, credits_used_this_period: i * 7,
    allowance: 75, cost_usd: i * 0.5, failed_calls: i === 3 ? 2 : 0,
    cancelling: i === 3, help_paused_at: null
  });
  return rows;
}

async function open(browser, before) {
  const p = await browser.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + String(e)));
  p.on('console', m => {
    const t = m.text();
    if (m.type() === 'error'
        && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|favicon|fonts\.|404/.test(t))
      errors.push('console: ' + t);
  });
  await p.addInitScript(before || (() => {}));
  await p.goto(URL);
  await p.waitForTimeout(420);
  return { p, errors };
}

let URL = '';

(async () => {
  build();
  const { server, port } = await serve();
  URL = 'http://127.0.0.1:' + port + '/admin.html';
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  const seed = f => `window.__ADMIN__ = ${JSON.stringify(f || fixtures())};`;
  const withSeed = (extra) => new Function(
    'window.__ADMIN__ = ' + JSON.stringify(fixtures()) + ';' + (extra || ''));

  // =================================================== it starts and runs ===
  {
    const { p, errors } = await open(browser, withSeed());
    check('the page starts with no script error', errors.length === 0,
      errors.join('\n          '));
    const st = await p.evaluate(() => ({
      nav: !document.getElementById('nav').hidden,
      main: !document.getElementById('main').hidden,
      booting: document.getElementById('booting').hidden,
      denied: document.getElementById('denied').hidden,
      panels: document.querySelectorAll('#view .panel').length,
      asked: window.__CALLS__.filter(c => c.indexOf('/api/admin:') === 0)
    }));
    check('the nav and the figures are drawn', st.nav && st.main);
    check('the loading line goes away', st.booting);
    check('nothing is refused', st.denied);
    check('the overview draws its panels', st.panels >= 5, String(st.panels));
    check('and it asked for the overview, not for everything',
      st.asked.length === 1 && st.asked[0] === '/api/admin:overview',
      JSON.stringify(st.asked));
    /* THE DOOR. The real requireSession is what puts the small-screen gate up
       and bounces a signed-out browser, so a page that does not call it has
       no door on it at all. */
    check('the page asks for a session before drawing anything',
      (await p.evaluate(() => window.__CALLS__.indexOf('requireSession'))) === 0);
    await p.close();
  }

  // ----------------------------------- every view, drawn, with no errors ----
  for (const v of ['overview', 'issues', 'writers', 'product', 'money', 'system']) {
    const { p, errors } = await open(browser, withSeed('location.hash = "' + v + '";'));
    const n = await p.evaluate(() => document.querySelectorAll('#view .panel, #view table').length);
    check(v + ' draws without a script error', errors.length === 0,
      errors.join('\n          '));
    check(v + ' draws something', n > 0, String(n));
    await p.close();
  }

  // ========================================================= who may read ===
  /* AN ACCOUNT THAT IS NOT AN ADMIN IS REFUSED AND NO FIGURE IS DRAWN. The
     old page showed the same words for every failure, which is how a broken
     query and a signed-out session came to look identical. */
  {
    const { p, errors } = await open(browser, withSeed('window.__DENIED__ = true;'));
    const st = await p.evaluate(() => ({
      denied: !document.getElementById('denied').hidden,
      nav: document.getElementById('nav').hidden,
      main: document.getElementById('main').hidden,
      figures: document.querySelectorAll('#view .tile').length
    }));
    check('an account that is not an admin is told so', st.denied);
    check('and the nav is not drawn', st.nav);
    check('and not one figure is drawn', st.figures === 0, String(st.figures));
    check('refusing is not an error', errors.length === 0, errors.join('\n'));
    await p.close();
  }
  {
    const { p } = await open(browser, withSeed('window.__SIGNED_OUT__ = true;'));
    const st = await p.evaluate(() => ({
      main: document.getElementById('main').hidden,
      asked: window.__CALLS__.filter(c => c.indexOf('/api/admin') === 0).length
    }));
    check('a signed out browser draws nothing', st.main);
    check('and asks the reports for nothing', st.asked === 0, String(st.asked));
    await p.close();
  }
  /* The small-screen gate. This page loads app.js, and loading app.js is what
     puts the gate up: a phone gets the app pitch rather than a spreadsheet it
     cannot read. */
  {
    const { p } = await open(browser, withSeed('window.__SMALL__ = true;'));
    check('a small screen is gated rather than given the tables',
      await p.evaluate(() => document.getElementById('main').hidden));
    await p.close();
  }

  // ============================================ entry points and the way back
  {
    const { p, errors } = await open(browser, withSeed('location.hash = "account=u1";'));
    const st = await p.evaluate(() => ({
      asked: window.__CALLS__.filter(c => c.indexOf('/api/admin:account') === 0),
      q: (window.__QUERIES__ || []).join('|'),
      crumb: document.querySelector('.crumb button') ? document.querySelector('.crumb button').textContent : '',
      head: document.querySelector('#view h2') ? document.querySelector('#view h2').textContent : '',
      lit: document.querySelector('.nav a.on') ? document.querySelector('.nav a.on').dataset.view : ''
    }));
    check('a link to one account lands on that account', st.asked.length === 1);
    check('and sends the account it was asked for', /id=u1/.test(st.q), st.q);
    check('the account is named on the screen', /u1@example.com/.test(st.head), st.head);
    check('there is a way back to the list', /Back to writers/.test(st.crumb), st.crumb);
    check('and Writers stays lit while standing on one of them',
      st.lit === 'writers', st.lit);
    check('no script error on a deep link', errors.length === 0, errors.join('\n'));

    await p.click('.crumb button');
    await p.waitForTimeout(250);
    check('the way back goes back',
      await p.evaluate(() => location.hash === '#writers'),
      await p.evaluate(() => location.hash));
    await p.close();
  }
  {
    const { p } = await open(browser, withSeed('location.hash = "issue=1";'));
    const st = await p.evaluate(() => ({
      q: (window.__QUERIES__ || []).join('|'),
      crumb: document.querySelector('.crumb button') ? document.querySelector('.crumb button').textContent : '',
      lit: document.querySelector('.nav a.on') ? document.querySelector('.nav a.on').dataset.view : ''
    }));
    check('a link to one issue lands on that issue', /view=issue/.test(st.q), st.q);
    check('with a way back to the issues', /Back to issues/.test(st.crumb), st.crumb);
    check('and Issues stays lit', st.lit === 'issues', st.lit);
    await p.close();
  }
  /* An alert's own link points at #alerts. Delivery lives on System, and a
     link in an email that lands nowhere is worse than no link. */
  {
    const { p } = await open(browser, withSeed('location.hash = "alerts";'));
    check('an alert link lands on System rather than nowhere',
      /view=system/.test(await p.evaluate(() => (window.__QUERIES__ || []).join('|'))));
    await p.close();
  }
  {
    const { p } = await open(browser, withSeed('location.hash = "nonsense";'));
    check('an address that means nothing falls back to the overview',
      /view=overview/.test(await p.evaluate(() => (window.__QUERIES__ || []).join('|'))));
    await p.close();
  }

  // ================================= the overview opens the record behind it =
  {
    const { p } = await open(browser, withSeed());
    const st = await p.evaluate(() => ({
      rows: document.querySelectorAll('#view .row-item').length,
      go: document.querySelector('#view .ri-go').getAttribute('href'),
      ack: !!document.querySelector('#view [data-do="alert_ack"]'),
      issueAck: !!document.querySelector('#view .row-item.sev-high [data-do="alert_ack"]')
    }));
    check('the attention queue has a row per thing', st.rows === 2, String(st.rows));
    check('and each row carries the way through to the record', st.go === '#issue=1', st.go);
    /* An alert is answered by being read, so its row clears it. An issue is
       not: that needs a reason, on its own screen. */
    check('an alert row can be marked as seen from the queue', st.ack);
    check('an issue row cannot, because closing one needs a reason',
      st.issueAck === false);

    await p.click('#view .ri-go');
    await p.waitForTimeout(300);
    check('pressing it opens the issue',
      /view=issue/.test(await p.evaluate(() => (window.__QUERIES__ || []).join('|'))));
    await p.close();
  }
  {
    const { p } = await open(browser, withSeed('location.hash = "issues";'));
    await p.click('#view [data-open-issue="2"]');
    await p.waitForTimeout(300);
    check('a row in the issues table opens that issue',
      await p.evaluate(() => location.hash === '#issue=2'),
      await p.evaluate(() => location.hash));
    await p.close();
  }
  {
    const { p } = await open(browser, withSeed('location.hash = "writers";'));
    await p.click('#view [data-open-account="u2"]');
    await p.waitForTimeout(300);
    check('a row in the writers table opens that account',
      await p.evaluate(() => location.hash === '#account=u2'));
    await p.close();
  }
  // The nav says how many issues are open, read off the overview it just read.
  {
    const { p } = await open(browser, withSeed());
    const b = await p.evaluate(() => {
      const el = document.getElementById('issuecount');
      return { hidden: el.hidden, text: el.textContent };
    });
    check('the nav carries the number of open issues',
      !b.hidden && b.text === '1', JSON.stringify(b));
    await p.close();
  }

  // ============================== search, order, paging, refresh, context ====
  {
    const big = fixtures();
    big.writers.writers = people(240);
    const { p } = await open(browser, new Function(
      'window.__ADMIN__ = ' + JSON.stringify(big) + '; location.hash = "writers";'));

    let st = await p.evaluate(() => ({
      rows: document.querySelectorAll('#view tbody tr').length,
      pager: document.getElementById('pager').textContent
    }));
    check('a long list is paged rather than drawn whole',
      st.rows === 100, String(st.rows));
    check('and says how many it is showing of how many',
      /100 of 240/.test(st.pager), st.pager);

    await p.click('#more');
    await p.waitForTimeout(200);
    st = await p.evaluate(() => document.querySelectorAll('#view tbody tr').length);
    check('showing more shows more', st === 200, String(st));

    /* SEARCH AND ORDER DO NOT SPEND A QUERY PER KEYSTROKE. Both work on the
       list already in hand. */
    const before = await p.evaluate(() => window.__QUERIES__.length);
    await p.fill('#search', 'u17@');
    await p.waitForTimeout(220);
    st = await p.evaluate(() => ({
      rows: document.querySelectorAll('#view tbody tr').length,
      first: document.querySelector('#view tbody tr b').textContent,
      queries: window.__QUERIES__.length
    }));
    check('searching narrows the list', st.rows === 1, String(st.rows));
    check('to the account that matches', st.first === 'u17@example.com', st.first);
    check('and reads nothing from the server to do it',
      st.queries === before, st.queries + ' vs ' + before);

    await p.fill('#search', 'nobody-at-all');
    await p.waitForTimeout(220);
    st = await p.evaluate(() => document.getElementById('view').textContent);
    check('a search that matches nothing says what it searched',
      /Nobody matches that/.test(st) && /email, name and account reference/.test(st),
      st.slice(0, 160));

    /* CONTEXT SURVIVES LEAVING THE SCREEN. Typing a search, going to look at
       something and coming back to find the box empty is the thing that makes
       a long list unusable. */
    await p.fill('#search', 'u17@');
    await p.waitForTimeout(150);
    await p.evaluate(() => { location.hash = 'money'; });
    await p.waitForTimeout(250);
    const hidden = await p.evaluate(() => document.getElementById('searchwrap').hidden);
    check('the search box is only offered where it applies', hidden);
    await p.evaluate(() => { location.hash = 'writers'; });
    await p.waitForTimeout(250);
    st = await p.evaluate(() => ({
      box: document.getElementById('search').value,
      rows: document.querySelectorAll('#view tbody tr').length
    }));
    check('coming back keeps what was typed', st.box === 'u17@', st.box);
    check('and keeps the list it had narrowed to', st.rows === 1, String(st.rows));
    await p.close();
  }
  {
    const { p } = await open(browser, withSeed('location.hash = "writers";'));
    await p.selectOption('#sort', 'cost');
    await p.waitForTimeout(200);
    const first = await p.evaluate(() =>
      document.querySelector('#view tbody tr b').textContent);
    check('ordering by cost puts the most expensive first',
      first === 'u4@example.com', first);
    await p.selectOption('#sort', 'failed');
    await p.waitForTimeout(200);
    check('and ordering by failed calls puts those first',
      (await p.evaluate(() => document.querySelector('#view tbody tr b').textContent))
        === 'u3@example.com');
    await p.close();
  }
  {
    const { p } = await open(browser, withSeed());
    const before = await p.evaluate(() => window.__QUERIES__.length);
    await p.click('#refresh');
    await p.waitForTimeout(250);
    check('Refresh reads it again',
      (await p.evaluate(() => window.__QUERIES__.length)) === before + 1);
    await p.close();
  }
  /* THE PERIOD AND THE POPULATION APPLY TO EVERY VIEW, which is why they are
     above all six rather than inside each. */
  {
    const { p } = await open(browser, withSeed());
    await p.selectOption('#days', '7');
    await p.waitForTimeout(250);
    check('changing the period re-reads with the new one',
      /days=7/.test(await p.evaluate(() => window.__QUERIES__.join('|'))));
    await p.selectOption('#days', 'custom');
    await p.waitForTimeout(150);
    check('a number of days can be typed',
      !(await p.evaluate(() => document.getElementById('customwrap').hidden)));
    await p.fill('#customdays', '400');
    await p.dispatchEvent('#customdays', 'change');
    await p.waitForTimeout(250);
    check('and a figure past a year is brought back to a year',
      (await p.evaluate(() => document.getElementById('customdays').value)) === '365');
    await p.close();
  }
  /* A CONTROL THAT DOES NOTHING ON THIS SCREEN SAYS SO rather than sitting
     there quietly doing nothing. */
  {
    const { p } = await open(browser, withSeed('location.hash = "account=u1";'));
    const st = await p.evaluate(() => ({
      days: document.getElementById('days').disabled,
      why: document.getElementById('days').title,
      who: document.getElementById('who').disabled
    }));
    check('a period control is disabled where a period means nothing', st.days);
    check('and says why', /not read through a period/.test(st.why), st.why);
    check('the population control is disabled off the writers list', st.who);
    await p.close();
  }

  // ============================== empty, partial, stale, failed, denied ======
  {
    const f = fixtures();
    f.overview.attention = [];
    const { p } = await open(browser, new Function(
      'window.__ADMIN__ = ' + JSON.stringify(f) + ';'));
    const t = await p.evaluate(() => document.getElementById('view').textContent);
    check('nothing needing attention is a real answer, not a blank panel',
      /Nothing needs attention/.test(t) && /the checks above ran/.test(t),
      t.slice(0, 200));
    await p.close();
  }
  {
    const { p } = await open(browser, withSeed());
    const t = await p.evaluate(() => document.getElementById('view').textContent);
    check('a query that failed is reported on the screen it belongs to',
      /Some of this is missing/.test(t), t.slice(0, 200));
    check('and says a dash was drawn rather than a zero',
      /dash rather than a zero/.test(t));
    const dash = await p.evaluate(() => {
      const el = document.querySelector('#view .no');
      return el ? { text: el.textContent, why: el.getAttribute('title') } : null;
    });
    check('the missing figure really is a dash', dash && dash.text === '–',
      JSON.stringify(dash));
    check('and carries the reason it is missing',
      dash && /did not answer/.test(dash.why), JSON.stringify(dash));
    await p.close();
  }
  /* HEALTHY IS ONLY SHOWN WHEN THE CHECK RAN. The absence of failures is not
     evidence of health if the thing that records failures is what is down. */
  {
    const { p } = await open(browser, withSeed());
    const lamps = await p.evaluate(() =>
      [...document.querySelectorAll('#view .lamp')].map(l => l.textContent.trim()));
    check('a check that could not run says so rather than saying Working',
      lamps.includes('Could not check'), JSON.stringify(lamps));
    check('every lamp carries a word, never only a colour',
      lamps.length > 0 && lamps.every(w => w.length > 2), JSON.stringify(lamps));
    await p.close();
  }
  {
    const { p, errors } = await open(browser,
      withSeed('window.__FAIL_VIEW__ = "money"; location.hash = "money";'));
    const st = await p.evaluate(() => ({
      t: document.getElementById('view').textContent,
      nav: !document.getElementById('nav').hidden,
      denied: document.getElementById('denied').hidden,
      retry: !!document.getElementById('retry')
    }));
    check('a view that failed says which and leaves the others alone',
      /could not be built/.test(st.t) && st.nav, st.t.slice(0, 160));
    check('a failure is not drawn as a refusal', st.denied);
    check('and says nothing on the account changed',
      /Nothing on the account has/.test(st.t));
    check('there is a way to try again', st.retry);
    check('a failed view is not a script error', errors.length === 0, errors.join('\n'));
    await p.close();
  }
  /* A RELOAD THAT FAILED WITH GOOD FIGURES STILL IN HAND. Both facts are
     true and both are said, rather than one quietly replacing the other. */
  {
    const { p } = await open(browser, withSeed('location.hash = "money";'));
    await p.evaluate(() => { window.__FAIL_VIEW__ = 'money'; });
    await p.click('#refresh');
    await p.waitForTimeout(300);
    const t = await p.evaluate(() => document.getElementById('view').textContent);
    check('a refresh that failed says so and keeps the last good reading',
      /last refresh did not work/.test(t) && /Money collected/.test(t),
      t.slice(0, 200));
    await p.close();
  }
  {
    const f = fixtures();
    f.overview.loaded_at = ago(1);
    const { p } = await open(browser, new Function(
      'window.__ADMIN__ = ' + JSON.stringify(f) + ';'));
    // The page stamps its own read time, so a stale line comes from the page
    // rather than from the payload. What matters is that the age is stated.
    const t = await p.evaluate(() => document.getElementById('asof').textContent);
    check('the page says when it last read the figures',
      /Read/.test(t) && /ago|just now/.test(t), t);
    await p.close();
  }
  {
    const f = fixtures();
    f.writers.writers = [];
    const { p } = await open(browser, new Function(
      'window.__ADMIN__ = ' + JSON.stringify(f) + '; location.hash = "writers";'));
    check('no accounts at all is drawn as an answer',
      /No accounts yet/.test(await p.evaluate(() => document.getElementById('view').textContent)));
    await p.close();
  }
  {
    const f = fixtures();
    f.writers.truncated = true;
    const { p } = await open(browser, new Function(
      'window.__ADMIN__ = ' + JSON.stringify(f) + '; location.hash = "writers";'));
    check('a list the server could not read whole says so',
      /More accounts exist than were read/.test(
        await p.evaluate(() => document.getElementById('view').textContent)));
    await p.close();
  }

  // ============================= customers, trials and your own testing =====
  /* INTERNAL IS SEPARATED AND NOT HIDDEN. Kris's own accounts are real money
     at the provider whoever spent it, and at four writers two owner accounts
     would not skew the funnel, they would BE the funnel. */
  {
    const { p } = await open(browser, withSeed('location.hash = "writers";'));
    const st = await p.evaluate(() => ({
      marked: document.querySelectorAll('#view tr.internal').length,
      says: document.getElementById('view').textContent
    }));
    check('an internal account is marked on the list', st.marked === 1,
      String(st.marked));
    check('and says so in words as well as in a tint',
      /internal/.test(st.says));
    await p.close();
  }
  {
    const { p } = await open(browser, withSeed());
    const t = await p.evaluate(() => document.getElementById('view').textContent);
    check('your own testing is its own figure on the overview',
      /Your own testing/.test(t));
    check('and the cost figures are not called profit',
      /not what Beatfall earns and it\s*is not profit/.test(t.replace(/\s+/g, ' '))
      || /is not profit/.test(t), t.slice(0, 200));
    await p.close();
  }
  {
    const { p } = await open(browser, withSeed('location.hash = "writers";'));
    await p.selectOption('#who', 'internal');
    await p.waitForTimeout(250);
    check('counting your own accounts is a re-read with that population',
      /who=internal/.test(await p.evaluate(() => window.__QUERIES__.join('|'))));
    await p.close();
  }

  // ================================= nothing a writer wrote reaches here ====
  /* The endpoint does not send it and this page could not draw it if it
     tried. Checked anyway, because the next person to add a panel will read
     the page before they read the endpoint, and a panel that prints whatever
     arrives is how a card ends up on a cost report. */
  {
    const f = fixtures();
    f.account.account.logline = 'A tow truck driver steals the wrong car.';
    f.account.account.cards = [{ text: 'OPENING: the yard at night' }];
    f.account.projects = [{ name: 'NIGHT HAUL', outline: 'He keeps driving.' }];
    f.issue.issue.prompt = 'Sort these notes: the yard at night';
    const { p } = await open(browser, new Function(
      'window.__ADMIN__ = ' + JSON.stringify(f) + '; location.hash = "account=u1";'));
    let t = await p.evaluate(() => document.body.textContent);
    check('a logline that arrives anyway is not drawn',
      !/tow truck driver/.test(t));
    check('nor a card', !/the yard at night/.test(t));
    check('nor a project name', !/NIGHT HAUL/.test(t));
    check('nor an outline passage', !/He keeps driving/.test(t));
    await p.evaluate(() => { location.hash = 'issue=1'; });
    await p.waitForTimeout(250);
    t = await p.evaluate(() => document.body.textContent);
    check('and nothing a read was asked is drawn on an issue',
      !/Sort these notes/.test(t));
    await p.close();
  }

  // ================================================= the actions ============
  /* EVERY ACTION ASKS FIRST, except the one that has nothing to ask. */
  {
    const { p } = await open(browser, withSeed('location.hash = "account=u1";'));
    await p.click('[data-do="credit_correction"]');
    await p.waitForTimeout(150);
    const st = await p.evaluate(() => ({
      open: !!document.querySelector('.scrim'),
      title: document.querySelector('.sheet h3').textContent,
      why: document.querySelector('.sheet .why').textContent,
      fields: [...document.querySelectorAll('.sheet .fld label')].map(l => l.textContent),
      posts: (window.__POSTS__ || []).length
    }));
    check('an action opens a form rather than acting at once', st.open);
    check('the form is the named action and nothing else',
      st.title === 'Correct credits', st.title);
    check('it says which bucket the credits go to',
      /bought bucket/.test(st.why), st.why);
    check('it asks for an amount and a reason',
      st.fields.join(',') === 'Credits,Why', st.fields.join(','));
    check('and nothing is posted until it is submitted', st.posts === 0);

    await p.fill('#f_credits', '25');
    await p.fill('#f_reason', 'a read failed and charged');
    await p.click('#sheetgo');
    await p.waitForTimeout(300);
    const posted = await p.evaluate(() => window.__POSTS__[0]);
    check('submitting sends the named action',
      posted.action === 'credit_correction', JSON.stringify(posted));
    check('with the account it was opened from', posted.user_id === 'u1');
    check('the amount as a number, not a string', posted.credits === 25,
      JSON.stringify(posted.credits));
    check('the reason as typed', posted.reason === 'a read failed and charged');
    /* THE KEY THAT MAKES A RETRY SAFE comes from the browser, because only
       the browser knows that this press is the same press as the one whose
       answer it never received. */
    check('and a key so a double press cannot apply twice', !!posted.idem);
    check('the form closes when it worked',
      !(await p.evaluate(() => !!document.querySelector('.scrim'))));
    check('and the screen is read again rather than patched by hand',
      /view=account/.test((await p.evaluate(() => window.__QUERIES__.join('|')))
        .split('|').slice(-1)[0]));
    await p.close();
  }
  /* ONE KEY PER OPENING. Pressing Save twice on one form is the same press.
     A fresh opening is a fresh action. */
  {
    const { p } = await open(browser, withSeed('location.hash = "account=u1";'));
    await p.click('[data-do="credit_correction"]');
    await p.waitForTimeout(120);
    await p.fill('#f_credits', '5');
    await p.fill('#f_reason', 'one');
    await p.click('#sheetgo');
    await p.waitForTimeout(250);
    await p.click('[data-do="credit_correction"]');
    await p.waitForTimeout(120);
    await p.fill('#f_credits', '5');
    await p.fill('#f_reason', 'two');
    await p.click('#sheetgo');
    await p.waitForTimeout(250);
    const keys = await p.evaluate(() => window.__POSTS__.map(x => x.idem));
    check('two openings are two keys', keys.length === 2 && keys[0] !== keys[1],
      JSON.stringify(keys));
    await p.close();
  }
  /* A REFUSAL IS NOT A FAILURE AND IS NOT DRAWN AS ONE. The endpoint records
     both and says which; this says which too, and keeps the form filled in so
     the missing half can be typed. */
  {
    const { p } = await open(browser, withSeed(
      'window.__DO_RESULT__ = { throw: true, code: "refused", status: 400,'
      + ' message: "more than a single correction may move (500)" };'
      + 'location.hash = "account=u1";'));
    await p.click('[data-do="credit_correction"]');
    await p.waitForTimeout(120);
    await p.fill('#f_credits', '900');
    await p.fill('#f_reason', 'oops');
    await p.click('#sheetgo');
    await p.waitForTimeout(300);
    const st = await p.evaluate(() => ({
      open: !!document.querySelector('.scrim'),
      err: (document.getElementById('sheeterr') || {}).textContent || '',
      kept: (document.getElementById('f_reason') || {}).value || '',
      go: (document.getElementById('sheetgo') || {}).disabled
    }));
    check('a refusal keeps the form open', st.open);
    check('says what was refused, in the endpoint\'s own words',
      /Not done/.test(st.err) && /500/.test(st.err), st.err);
    check('keeps what was typed', st.kept === 'oops', st.kept);
    check('and lets it be tried again', st.go === false);
    await p.close();
  }
  {
    const { p } = await open(browser, withSeed(
      'window.__DO_RESULT__ = { throw: true, code: "action_failed", status: 500,'
      + ' message: "That did not complete." }; location.hash = "account=u1";'));
    await p.click('[data-do="help_pause"]');
    await p.waitForTimeout(120);
    await p.fill('#f_reason', 'cost');
    await p.click('#sheetgo');
    await p.waitForTimeout(300);
    const err = await p.evaluate(() =>
      (document.getElementById('sheeterr') || {}).textContent || '');
    check('a failure says to check the account before trying again',
      /Check the account/.test(err), err);
    await p.close();
  }
  /* MARKING AN ALERT AS SEEN HAS NOTHING TO ASK, so it does not ask. */
  {
    const { p } = await open(browser, withSeed());
    await p.click('[data-do="alert_ack"]');
    await p.waitForTimeout(300);
    const st = await p.evaluate(() => ({
      posted: window.__POSTS__[0],
      said: document.querySelector('.said') ? document.querySelector('.said').textContent : ''
    }));
    check('marking an alert as seen does not open a form',
      st.posted && st.posted.action === 'alert_ack', JSON.stringify(st.posted));
    check('and sends which alert', st.posted.id === 7, JSON.stringify(st.posted.id));
    check('and says it happened', /Marked as seen/.test(st.said), st.said);
    await p.close();
  }
  /* AN ACTION THAT WAS ALREADY DONE SAYS SO rather than claiming a second
     one. The endpoint answers already: true for a repeated press. */
  {
    const { p } = await open(browser, withSeed(
      'window.__DO_RESULT__ = { ok: true, already: true }; location.hash = "account=u1";'));
    await p.click('[data-do="help_pause"]');
    await p.waitForTimeout(120);
    await p.fill('#f_reason', 'cost');
    await p.click('#sheetgo');
    await p.waitForTimeout(300);
    check('a repeat says it was already done, not that it was done again',
      /Already done/.test(await p.evaluate(() => {
        const el = document.querySelector('.said');
        return el ? el.textContent : '';
      })));
    await p.close();
  }
  // Escape and the scrim both step out. Nothing here is typed at length.
  {
    const { p } = await open(browser, withSeed('location.hash = "account=u1";'));
    await p.click('[data-do="case_open"]');
    await p.waitForTimeout(120);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(150);
    check('Escape closes the form',
      !(await p.evaluate(() => !!document.querySelector('.scrim'))));
    await p.click('[data-do="case_open"]');
    await p.waitForTimeout(120);
    await p.click('.scrim', { position: { x: 5, y: 5 } });
    await p.waitForTimeout(150);
    check('and a press on the grey closes it too',
      !(await p.evaluate(() => !!document.querySelector('.scrim'))));
    check('and nothing was posted either way',
      (await p.evaluate(() => (window.__POSTS__ || []).length)) === 0);
    await p.close();
  }
  /* RULE 6, ON THE PAGE AS WELL AS IN THE ENDPOINT. Nothing here offers to
     switch enforcement on. Two refusals, on purpose. */
  {
    const { p } = await open(browser, withSeed('location.hash = "money";'));
    const st = await p.evaluate(() => {
      const spec = [...document.querySelectorAll('#view .panel h2')]
        .map(h => h.textContent);
      return { spec, text: document.getElementById('view').textContent };
    });
    check('the money screen shows the spending figures', st.spec.includes('Spending limits'));
    check('and says plainly that nothing is enforced',
      /Nothing here stops anything/.test(st.text));
    check('a watched figure says Watching only rather than looking approved',
      /Watching only/.test(st.text));
    check('and a figure nobody has approved says not set',
      /not set/.test(st.text));
    await p.close();
  }
  {
    // The budget form itself, reached by hand because the money screen has no
    // button for it yet. What matters is that it cannot offer enforcement.
    const { p } = await open(browser, withSeed('location.hash = "money";'));
    const fields = await p.evaluate(() => {
      const el = document.createElement('button');
      el.setAttribute('data-do', 'budget_set');
      document.body.appendChild(el);
      el.click();
      return [...document.querySelectorAll('.sheet .fld label')].map(l => l.textContent);
    });
    check('the budget form asks for figures only',
      !fields.some(f => /enforc/i.test(f)), JSON.stringify(fields));
    const why = await p.evaluate(() =>
      document.querySelector('.sheet .why').textContent);
    check('and says the figure is watched rather than applied',
      /watched/.test(why) && /refuses/.test(why), why);
    await p.close();
  }
  /* A PAUSE SAYS WHAT IT DOES NOT TOUCH. Withholding somebody's own writing
     is not a cost control, and the form is where that has to be said. */
  {
    const { p } = await open(browser, withSeed('location.hash = "account=u1";'));
    await p.click('[data-do="help_pause"]');
    await p.waitForTimeout(120);
    const why = await p.evaluate(() => document.querySelector('.sheet .why').textContent);
    check('the pause form says the boards and downloads are untouched',
      /boards/.test(why) && /untouched/.test(why), why);
    check('and that placing notes by hand still works',
      /by hand/.test(why), why);
    await p.close();
  }
  {
    const f = fixtures();
    f.account.account.help_paused_at = ago(1);
    f.account.account.help_pause_reason = 'one action cost nine dollars';
    const { p } = await open(browser, new Function(
      'window.__ADMIN__ = ' + JSON.stringify(f) + '; location.hash = "account=u1";'));
    const st = await p.evaluate(() => ({
      t: document.getElementById('view').textContent,
      resume: !!document.querySelector('[data-do="help_resume"]'),
      pause: !!document.querySelector('[data-do="help_pause"]')
    }));
    check('a paused account says so at the top of its own screen',
      /paused/.test(st.t) && /nine dollars/.test(st.t), st.t.slice(0, 220));
    check('and offers the way back rather than the way in again',
      st.resume && !st.pause);
    await p.close();
  }

  // ========================================= the naming rule and the words ==
  /* In the interface it is never Claude and never the AI. It is the writing
     help. Only Kris reads this page, which is exactly why the last breach of
     that rule survived on it for a month. */
  for (const v of ['overview', 'writers', 'money', 'issues', 'product', 'system']) {
    const { p } = await open(browser, withSeed('location.hash = "' + v + '";'));
    const t = await p.evaluate(() => document.body.textContent);
    check(v + ' never says Claude or the AI',
      !/\bClaude\b/.test(t) && !/\bAI\b/.test(t) && !/the model\b/.test(t),
      (t.match(/.{0,40}(Claude|\bAI\b|the model).{0,40}/) || [''])[0]);
    await p.close();
  }
  {
    const { p } = await open(browser, withSeed());
    const t = await p.evaluate(() => document.body.textContent);
    /* The dash is written as an escape on purpose: the rule is zero em
       dashes anywhere, and `grep -c` cannot tell a check for one from one. */
    const EM = String.fromCharCode(0x2014);
    check('there are no em dashes on the page', t.indexOf(EM) === -1,
      t.slice(Math.max(0, t.indexOf(EM) - 30), t.indexOf(EM) + 30));
    await p.close();
  }

  // ================================================= both themes ============
  for (const mode of ['light', 'dark']) {
    const { p, errors } = await open(browser,
      withSeed('window.__MODE__ = "' + mode + '";'));
    const st = await p.evaluate(() => {
      const body = getComputedStyle(document.body);
      const tile = document.querySelector('#view .tile .n');
      const lamp = document.querySelector('#view .lamp');
      return { bg: body.backgroundColor, ink: body.color,
        tile: tile ? getComputedStyle(tile).color : '',
        lamp: lamp ? getComputedStyle(lamp).backgroundColor : '' };
    });
    const clear = v => v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent';
    check(mode + ': the page paints its own ground', clear(st.bg), st.bg);
    check(mode + ': the text has a colour of its own', clear(st.ink), st.ink);
    check(mode + ': a figure is not painted in the ground colour',
      clear(st.tile) && st.tile !== st.bg, st.tile + ' on ' + st.bg);
    check(mode + ': a lamp has a fill', clear(st.lamp), st.lamp);
    check(mode + ': and nothing throws', errors.length === 0, errors.join('\n'));
    await p.close();
  }

  // ================================================= the sizes it is used at =
  /* This page is behind the small-screen gate, so a phone is not one of the
     sizes it has to work at. A laptop is, and a laptop with the window
     dragged to half the screen is the one that breaks tables. */
  for (const w of [1680, 1280, 1024, 820]) {
    const p = await browser.newPage();
    await p.setViewportSize({ width: w, height: 900 });
    await p.addInitScript(withSeed('location.hash = "writers";'));
    await p.goto(URL);
    await p.waitForTimeout(420);
    const st = await p.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      navScroll: (() => { const n = document.querySelector('.nav-in');
        return !!n; })(),
      tableInBox: (() => {
        const t = document.querySelector('#view table');
        const wrap = document.querySelector('#view .tablewrap');
        if (!t || !wrap) return true;
        return wrap.clientWidth <= document.documentElement.clientWidth;
      })()
    }));
    check(w + 'px: the page does not scroll sideways', !st.overflow);
    check(w + 'px: a wide table scrolls inside its own box', st.tableInBox);
    await p.close();
  }

  await browser.close();
  server.close();

  const bad = results.filter(r => !r.ok).length;
  console.log('\n' + (results.length - bad) + ' of ' + results.length + ' passed');
  if (bad) { console.log('\nFAILED:'); results.filter(r => !r.ok).forEach(r => console.log('  ' + r.name)); }
  process.exit(bad ? 1 : 0);
})();
