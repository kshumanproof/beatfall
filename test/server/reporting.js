/* THE REPORTING ENDPOINT, AND THE EIGHTEEN THINGS IT USED TO GET WRONG.
 *
 * Every check below is a defect that was really in the old /api/admin, not a
 * hypothetical. Several of them were invisible from the screen: a figure can
 * be confidently wrong and look exactly like a figure that is right, which is
 * the whole reason this file exists.
 *
 * It runs the SHIPPED endpoint against the stand-in database. There is no
 * second copy of the arithmetic in here.
 */
import handler from './api/admin.real.js';
import { makeDb } from './fakedb.js';

const out = [];
const check = (n, ok, d) => { out.push({n, ok});
  console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (ok || !d ? '' : '\n          ' + d)); };

function res() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = c => { r.code = c; return r; };
  r.send = b => { r.body = JSON.parse(b); return r; };
  return r;
}

const ADMIN = { id: 'k1', email: 'kris@beatfall.app', is_admin: true,
  is_unlimited: false, is_internal: true, plan: 'none', credits_used: 0,
  credits_extra: 0, period_start: '2026-10-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' };

const ago = n => new Date(Date.now() - n * 86400000).toISOString();

function person(id, extra) {
  return Object.assign({
    id, email: id + '@example.com', is_admin: false, is_internal: false,
    is_unlimited: false, plan: 'beatfall', subscription_status: 'active',
    credits_used: 0, credits_extra: 0, period_start: ago(5),
    created_at: ago(40), last_seen_at: ago(1), display_name: null
  }, extra || {});
}

async function call(db, query) {
  globalThis.__DB__ = db;
  globalThis.__AUTH__ = { db, user: { id: 'k1' }, profile: ADMIN };
  const r = res();
  await handler({ method: 'GET', query, headers: {} }, r);
  return r;
}

// --------------------------------------------------------- permissions ----
{
  const db = makeDb(ADMIN, { profiles: [ADMIN] });
  globalThis.__DB__ = db;
  globalThis.__AUTH__ = { db, user: { id: 'u9' },
    profile: Object.assign({}, ADMIN, { id: 'u9', is_admin: false }) };
  const r = res();
  await handler({ method: 'GET', query: {}, headers: {} }, r);
  check('a writer who is not an admin is refused', r.code === 403, String(r.code));
}
/* AN UNLIMITED OWNER IS NOT AN ADMIN. They are two switches on purpose: one
   buys boards that never close, the other opens the platform's numbers. */
{
  const db = makeDb(ADMIN, { profiles: [ADMIN] });
  globalThis.__DB__ = db;
  globalThis.__AUTH__ = { db, user: { id: 'u8' },
    profile: Object.assign({}, ADMIN, { id: 'u8', is_admin: false, is_unlimited: true }) };
  const r = res();
  await handler({ method: 'GET', query: {}, headers: {} }, r);
  check('an unlimited owner who is not an admin is also refused', r.code === 403, String(r.code));
}

// ------------------------------------------------- working, not metered ----
/* DEFECT 1. "Used it" counted accounts with a row in `usage`, which is only
   the metered features. A writer who spent a fortnight typing cards and
   filing notes used Beatfall every day and showed in that tile as somebody
   who had not touched it. */
{
  const db = makeDb(ADMIN, {
    profiles: [ADMIN, person('u1'), person('u2')],
    work_days: [{ user_id: 'u1', day: ago(2).slice(0, 10) },
                { user_id: 'u1', day: ago(3).slice(0, 10) }],
    usage: [{ user_id: 'u2', kind: 'import', credits: 5, cost_micros: 30000,
              created_at: ago(2), status: 'ok' }]
  });
  const r = await call(db, { view: 'overview', days: '30' });
  const w = r.body.working;
  /* u1 typed and saved and never spent a credit. u2 ran one metered call and
     saved nothing. The old tile counted u2 and missed u1, which is backwards:
     the one who used the product is the one who did not appear. */
  check('a writer who only typed counts as working', w.total.value === 1,
    JSON.stringify(w.total));
  check('and a metered call with nothing saved is not working',
    w.total.value === 1 && w.used_writing_help.value === 1,
    JSON.stringify([w.total, w.used_writing_help]));
  check('using the writing help is reported as its own figure',
    w.used_writing_help.value === 1, JSON.stringify(w.used_writing_help));
  check('each figure says which population it describes',
    w.population === 'customers', JSON.stringify(w.population));
}

// ------------------------------------------------- windows and mixing ----
/* DEFECT 2. The old tiles put a thirty-day cost beside an all-time milestone
   and a status as of right now, with nothing saying so. */
{
  const db = makeDb(ADMIN, { profiles: [ADMIN, person('u1', { first_meaningful_board_at: ago(200) })] });
  const r = await call(db, { view: 'overview', days: '30' });
  check('an all-time milestone says it is all time',
    r.body.starting.organised_ever.window === 'all time',
    JSON.stringify(r.body.starting.organised_ever));
  check('a point-in-time figure says so too',
    r.body.subscriptions.window === 'right now', r.body.subscriptions.window);
  check('and a windowed figure carries its window',
    r.body.spend.window_days === 30, String(r.body.spend.window_days));
}

// ------------------------------------------------------- the sequence ----
/* DEFECT 3 and 7. Stages were counted independently, so somebody who
   subscribed without ever starting a project appeared to have passed through
   every step before it, and the percentages between them described nothing. */
{
  const db = makeDb(ADMIN, {
    profiles: [ADMIN,
      // Went all the way.
      person('u1', { first_real_project_at: ago(30), first_meaningful_board_at: ago(29) }),
      // Subscribed and never started anything. Must NOT appear past stage one.
      person('u2', { subscription_status: 'active' }),
      // Started and stopped.
      person('u3', { first_real_project_at: ago(20), subscription_status: null })],
    work_days: [{ user_id: 'u1', day: ago(29).slice(0, 10) },
                { user_id: 'u1', day: ago(20).slice(0, 10) }]
  });
  const r = await call(db, { view: 'product', days: '30' });
  const j = r.body.journey;
  check('the journey starts with everybody', j[0].n === 3, JSON.stringify(j[0]));
  check('and only those who started their own project continue',
    j[1].n === 2, JSON.stringify(j[1]));
  check('somebody who subscribed without starting is not counted further down',
    j[4].n === 1, JSON.stringify(j.map(s => [s.label, s.n])));
  check('each stage says what it measured against', j[1].of === 3, JSON.stringify(j[1]));
  check('and what it means in words', !!j[1].means, j[1].means);
}

// --------------------------------------------------------- returning ----
/* DEFECTS 4 and 5. Return was last_seen_at minus signup, so opening a tab
   counted as coming back to work, and "returned after D7" used a six-day
   threshold. Eligibility was never stated either, so an account two days old
   counted against a thirty-day window it could not possibly have met. */
{
  const db = makeDb(ADMIN, {
    profiles: [ADMIN,
      person('u1', { created_at: ago(40), last_seen_at: ago(1) }),   // opened a tab only
      person('u2', { created_at: ago(40) }),                          // really came back
      person('u3', { created_at: ago(2) })],                          // too new to judge
    work_days: [{ user_id: 'u2', day: ago(37).slice(0, 10) }]
  });
  const r = await call(db, { view: 'product', days: '30' });
  const seven = r.body.returning.find(x => x.window_days === 7);
  check('opening a tab is not returning to work', seven.returned === 1,
    JSON.stringify(seven));
  check('an account too new for the window is not counted against it',
    seven.eligible === 2, JSON.stringify(seven));
  check('and the window says exactly what it measured',
    /day 7/.test(seven.means), seven.means);
  check('seven days means seven, not six',
    r.body.returning.some(x => x.window_days === 7), JSON.stringify(r.body.returning));
}

// ------------------------------------------------ credits and periods ----
/* DEFECT 9. Credits spent over the SELECTED window were shown against ONE
   month's allowance, so ninety days of ordinary use read as three times over
   budget. */
{
  const db = makeDb(ADMIN, {
    profiles: [ADMIN, person('u1', { credits_used: 12, period_start: ago(4) })],
    usage: [{ user_id: 'u1', kind: 'import', credits: 5, cost_micros: 30000, created_at: ago(40) },
            { user_id: 'u1', kind: 'import', credits: 5, cost_micros: 30000, created_at: ago(2) }]
  });
  const r = await call(db, { view: 'writers', days: '90' });
  const w = r.body.writers.find(x => x.id === 'u1');
  check('the allowance figure is this period, not the whole window',
    w.credits_used_this_period === 12, JSON.stringify(w.credits_used_this_period));
  check('and the window figure is named as a window figure',
    w.credits_in_window === 10, String(w.credits_in_window));
  check('with the period it belongs to beside it', !!w.period_start, String(w.period_start));
}

// --------------------------------------------- missing is not zero ----
/* DEFECT 11. A query that errored turned into a confident 0, which is the
   worst possible failure on a page whose job is telling you whether anything
   is wrong. */
{
  const db = makeDb(ADMIN, { profiles: [ADMIN, person('u1')] });
  const real = db.from;
  db.from = name => name === 'work_days'
    ? { select: () => ({ gte: () => ({ range: async () => ({ data: null, error: { message: 'table is down' } }) }) }) }
    : real(name);
  const r = await call(db, { view: 'overview', days: '30' });
  check('a failed query is reported rather than becoming zero',
    (r.body.errors || []).some(e => /table is down/.test(e)),
    JSON.stringify(r.body.errors));
  check('and the health panel says that check could not run',
    r.body.health.work.state === 'unknown', JSON.stringify(r.body.health.work));
}

/* DEFECT 12. Every failure showed "This page is for the account owner", so a
   broken query and a signed-out session looked identical. */
{
  const db = makeDb(ADMIN, { profiles: [ADMIN] });
  const real = db.from;
  db.from = () => { throw new Error('everything is down'); };
  const r = await call(db, { view: 'overview' });
  check('a view that throws says so, and is not an access message',
    r.code === 500 && r.body.error === 'view_failed', JSON.stringify(r.body));
  check('and names the section that failed', r.body.view === 'overview', r.body.view);
  db.from = real;
}

// ------------------------------------------------------- truncation ----
/* DEFECT 10. .limit(500) on profiles reported the first five hundred as
   everybody. Invisible at eleven accounts and wrong at six hundred. */
{
  const many = [ADMIN];
  for (let i = 0; i < 1200; i++) many.push(person('p' + i));
  const db = makeDb(ADMIN, { profiles: many });
  const r = await call(db, { view: 'writers', days: '30' });
  check('more than one page of accounts is read in full',
    r.body.counts.all === 1201, String(r.body.counts.all));
  check('and nothing is silently cut off', r.body.truncated === false,
    String(r.body.truncated));
}

// -------------------------------------------------- internal is apart ----
{
  const db = makeDb(ADMIN, {
    profiles: [ADMIN, person('u1'), person('u2', { is_internal: true })],
    usage: [{ user_id: 'u1', kind: 'import', credits: 5, cost_micros: 1000000, created_at: ago(1) },
            { user_id: 'u2', kind: 'import', credits: 5, cost_micros: 9000000, created_at: ago(1) }]
  });
  const r = await call(db, { view: 'overview', days: '30' });
  check('internal testing is kept out of the customer cost',
    Math.round(r.body.spend.customers_usd.value * 100) === 100,
    String(r.body.spend.customers_usd.value));
  check('and reported separately rather than hidden',
    r.body.spend.internal_usd.value >= 9, String(r.body.spend.internal_usd.value));
  const w = await call(db, { view: 'writers', who: 'customers' });
  check('the writers list can exclude them',
    w.body.writers.every(x => !x.internal) && w.body.writers.length === 1,
    JSON.stringify(w.body.writers.map(x => x.id)));
}

// ------------------------------------------------------ no story text ----
/* The privacy line, and it is the one that cannot be allowed to slip. */
{
  const db = makeDb(ADMIN, {
    profiles: [ADMIN, person('u1')],
    projects: [{ user_id: 'u1', card_count: 14, is_sample: false, updated_at: ago(1),
                 cards: [{ text: 'Mara walks the burned hallway' }],
                 name: 'AFTER THE FIRE' }]
  });
  for (const view of ['overview', 'writers', 'product', 'money', 'issues', 'system']) {
    const r = await call(db, { view });
    const body = JSON.stringify(r.body);
    check(view + ' carries no card text', !/burned hallway/.test(body), view);
  }
}

// ------------------------------------------- the evidence for a cutoff ----
/* Kris asked to see the measured cost of the largest permitted actions before
   approving enforcement. This is that figure, measured the way a cutoff would
   measure it: by session, which is what one action is. */
{
  const db = makeDb(ADMIN, {
    profiles: [ADMIN, person('u1')],
    budgets: [{ scope: 'single_action', stop_micros: 1500000, enforced: false }],
    usage: [
      { user_id: 'u1', kind: 'import', session_id: 'a', cost_micros: 30000, created_at: ago(1), status: 'ok' },
      { user_id: 'u1', kind: 'import', session_id: 'a', cost_micros: 20000, created_at: ago(1), status: 'ok' },
      { user_id: 'u1', kind: 'import', session_id: 'b', cost_micros: 1600000, created_at: ago(1), status: 'ok' },
      { user_id: 'u1', kind: 'ideas',  session_id: 'c', cost_micros: 4000, created_at: ago(1), status: 'ok' }
    ]
  });
  const r = await call(db, { view: 'money', days: '30' });
  const imp = r.body.largest_actions.find(x => x.feature === 'import');
  check('the most expensive single action is measured by action, not by call',
    imp.most_expensive_usd === 1.6, String(imp.most_expensive_usd));
  check('an ordinary action is shown beside it',
    Math.round(imp.average_usd * 1000) === 825, String(imp.average_usd));
  check('and it says how many would have been stopped by the proposed figure',
    imp.would_have_been_stopped === 1, String(imp.would_have_been_stopped));
  check('the proposed figure is reported as not enforced',
    r.body.budgets.find(b => b.scope === 'single_action').enforced === false);
}

// -------------------------------------------------------- reconciling ----
{
  const db = makeDb(ADMIN, {
    profiles: [ADMIN, person('u1')],
    usage: [
      { user_id: 'u1', kind: 'import', cost_micros: 0, status: 'unknown', created_at: ago(1) },
      { user_id: 'u1', kind: 'import', cost_micros: 0, status: 'failed', created_at: ago(1) },
      { user_id: 'u1', kind: 'import', cost_micros: 1000, status: 'ok', created_at: ago(1) }
    ]
  });
  const r = await call(db, { view: 'money', days: '30' });
  check('a call whose answer never came back is counted, not assumed',
    r.body.reconcile.unknown_outcome === 1, JSON.stringify(r.body.reconcile));
  check('and a billed failure is its own figure',
    r.body.reconcile.failed_but_recorded === 1, JSON.stringify(r.body.reconcile));
  check('revenue less cost is never called profit',
    !/profit/i.test(JSON.stringify(r.body).replace(/not profit/gi, '')),
    'the word profit appears without its disclaimer');
}

/* DEFECT 8. subscription_active repeats on every subscription update, so
   counting those events counted the same customer again and again. The
   subscriber figure is a count of ACCOUNTS in that state, not of events. */
{
  const db = makeDb(ADMIN, {
    profiles: [ADMIN, person('u1', { subscription_status: 'active' })],
    events: [
      { user_id: 'u1', name: 'subscription_active', created_at: ago(3) },
      { user_id: 'u1', name: 'subscription_active', created_at: ago(2) },
      { user_id: 'u1', name: 'subscription_active', created_at: ago(1) }
    ]
  });
  const r = await call(db, { view: 'overview', days: '30' });
  check('one customer updating three times is still one subscriber',
    r.body.subscriptions.subscribers.value === 1,
    String(r.body.subscriptions.subscribers.value));
}

// ------------------------------------------------- tracking start date ----
{
  const db = makeDb(ADMIN, { profiles: [ADMIN],
    operator_meta: [{ key: 'tracking_started_at', value: '2026-10-09T00:00:00Z' }] });
  const r = await call(db, { view: 'overview' });
  check('the page can say when the records start',
    r.body.tracking_started_at === '2026-10-09T00:00:00Z',
    String(r.body.tracking_started_at));
}

/* DEFECT 17. requireUser rolls the credit period and touches last_seen.
   Inspecting somebody's account must never be the thing that changes it. */
{
  const u = person('u1', { credits_used: 9, last_seen_at: ago(30) });
  const db = makeDb(ADMIN, { profiles: [ADMIN, u] });
  const before = JSON.stringify(db.state.profiles[1]);
  await call(db, { view: 'account', id: 'u1' });
  check('looking at an account does not change it',
    JSON.stringify(db.state.profiles[1]) === before,
    'the row moved while being read');
}

// ------------------------------------------------------- sources ----
/* Unknown attribution stays unknown. Treating a missing referrer as confirmed
   direct traffic flatters whichever channel does not tag its links. */
{
  const db = makeDb(ADMIN, {
    profiles: [ADMIN, person('u1', { first_touch: null }),
               person('u2', { first_touch: { source: 'newsletter' } })]
  });
  const r = await call(db, { view: 'product', days: '30' });
  const keys = r.body.sources.map(s => s.key);
  check('an account with no attribution is unknown, not direct',
    keys.includes('unknown') && !keys.includes('direct'), JSON.stringify(keys));
}

// ------------------------------------------------------- one issue ----
/* The list screen answers "what is broken". This answers the next three
   questions, which are the ones that take the work: who did it happen to,
   what did it cost them, and what has anybody already written down. */
{
  const db = makeDb(ADMIN, {
    profiles: [ADMIN, person('u1'), person('u2', { is_internal: true })],
    admin_issues: [{ id: 1, signature: 'sig1', title: 'A read came back empty',
      feature: 'import', severity: 'high', status: 'new', occurrences: 3,
      accounts: 2, credits_charged: 10, credits_refunded: 5, cost_micros: 90000,
      first_seen_at: ago(3), last_seen_at: ago(1) }],
    admin_issue_notes: [{ id: 1, issue_id: 1, author: 'kris@beatfall.app',
      body: 'It is the timeout', created_at: ago(1) }],
    usage: [
      { user_id: 'u1', issue_id: 1, kind: 'import', credits: 5, cost_micros: 60000,
        status: 'failed', error_code: 'empty_reply', created_at: ago(1) },
      { user_id: 'u1', issue_id: 1, kind: 'import', credits: 0, cost_micros: 20000,
        status: 'failed', created_at: ago(2) },
      { user_id: 'u2', issue_id: 1, kind: 'import', credits: 5, cost_micros: 10000,
        status: 'failed', created_at: ago(3) },
      // A row belonging to a different issue, which must not be counted here.
      { user_id: 'u1', issue_id: 2, kind: 'ideas', credits: 2, cost_micros: 5000,
        status: 'failed', created_at: ago(1) }
    ]
  });
  const r = await call(db, { view: 'issue', id: '1' });
  check('one issue can be read on its own', r.code === 200 && !!r.body.issue,
    JSON.stringify(r.body).slice(0, 160));
  check('only the rows belonging to it are counted',
    r.body.occurrences_total === 3, String(r.body.occurrences_total));
  check('the accounts it happened to are grouped, not listed per row',
    r.body.accounts.length === 2, JSON.stringify(r.body.accounts.map(a => a.id)));
  const u1 = r.body.accounts.find(a => a.id === 'u1');
  check('an account that hit it twice says twice', u1.times === 2, String(u1.times));
  check('and carries what it cost that account', u1.cost_usd === 0.08,
    String(u1.cost_usd));
  check('an email is attached so the operator can reach them',
    u1.email === 'u1@example.com', u1.email);
  check('an internal account is marked as internal rather than hidden',
    r.body.accounts.find(a => a.id === 'u2').internal === true);
  check('the notes come back newest first and in full',
    r.body.notes.length === 1 && /timeout/.test(r.body.notes[0].body));
  /* CHARGED AGAINST RETURNED, SIDE BY SIDE. An issue that charged somebody
     and never gave it back is a different problem from one that failed for
     free, and the old page could not tell you which this was. */
  check('credits charged and returned are both reported',
    r.body.money.credits_charged === 10 && r.body.money.credits_refunded === 5,
    JSON.stringify(r.body.money));
  check('and the gap between them is said out loud',
    /charged/.test(r.body.money.note), r.body.money.note);
}
/* A WINDOW WOULD NARROW THE WRONG THING. An issue is a thing rather than a
   period, and the two occurrences that explain it are often the oldest. */
{
  const db = makeDb(ADMIN, {
    profiles: [ADMIN, person('u1')],
    admin_issues: [{ id: 1, signature: 's', title: 'Old one', severity: 'normal',
      status: 'new', occurrences: 1, first_seen_at: ago(200), last_seen_at: ago(200) }],
    usage: [{ user_id: 'u1', issue_id: 1, kind: 'import', credits: 5,
      cost_micros: 1000, status: 'failed', created_at: ago(200) }]
  });
  const r = await call(db, { view: 'issue', id: '1', days: '7' });
  check('an occurrence older than the selected period is still shown',
    r.body.occurrences_total === 1, String(r.body.occurrences_total));
}
{
  const db = makeDb(ADMIN, { profiles: [ADMIN], admin_issues: [] });
  const r = await call(db, { view: 'issue', id: '99' });
  check('an issue that does not exist says so rather than drawing an empty one',
    r.body.error === 'no such issue', JSON.stringify(r.body));
  const r2 = await call(db, { view: 'issue' });
  check('and no issue named is its own answer',
    r2.body.error === 'no issue named', JSON.stringify(r2.body));
}
/* THE SAMPLE IS CAPPED AND THE CAP IS STATED. Narrowing what is SHOWN is
   fine; narrowing what is COUNTED while printing the smaller figure
   confidently is the defect this whole endpoint was rebuilt over. */
{
  const many = [];
  for (let i = 0; i < 30; i++) many.push({ user_id: 'u1', issue_id: 1,
    kind: 'import', credits: 1, cost_micros: 1000, status: 'failed',
    created_at: new Date(Date.now() - i * 60000).toISOString() });
  const db = makeDb(ADMIN, {
    profiles: [ADMIN, person('u1')],
    admin_issues: [{ id: 1, signature: 's', title: 'Noisy', severity: 'high',
      status: 'new', occurrences: 30, first_seen_at: ago(1), last_seen_at: ago(0) }],
    usage: many
  });
  const r = await call(db, { view: 'issue', id: '1' });
  check('the shown sample is capped', r.body.occurrences.length === 20,
    String(r.body.occurrences.length));
  check('the count behind it is not', r.body.occurrences_total === 30,
    String(r.body.occurrences_total));
  check('and the grouped figures use all of them',
    r.body.accounts[0].times === 30, String(r.body.accounts[0].times));
}

const bad = out.filter(r => !r.ok).length;
console.log('\n' + (out.length - bad) + ' of ' + out.length + ' passed');
if (bad) { console.log('\nFAILED:'); out.filter(r => !r.ok).forEach(r => console.log('  ' + r.n)); }
process.exit(bad ? 1 : 0);
