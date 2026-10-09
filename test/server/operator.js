/* THE OPERATOR'S RECORDS.
 *
 * These are the tables the admin rebuild reads, and they are the ones that
 * carry money. Everywhere else in this product a dropped row is a shame; here
 * it is a charge nobody can account for, so the contract is stricter and this
 * suite is what holds it.
 *
 * Four things are checked, and each of them was a real way to get it wrong:
 *
 *   1. A movement is recorded WITH ITS BUCKET. A bought credit that comes back
 *      as a monthly one has quietly become a credit that expires.
 *   2. A RETRY WRITES ONCE. Stripe retries webhooks, browsers retry requests,
 *      and a second row is a figure that can never be trusted again.
 *   3. NOTHING HERE CAN REFUSE THE WORK. A ledger row that will not insert
 *      must not be the reason a writer's sentence is not placed.
 *   4. NO WRITER'S WORDS GET IN. An error message can quote the sentence that
 *      caused it, so the grouping is built from codes and never from text.
 *
 * It exercises the shipped module against the stand-in database. There is no
 * second copy of the arithmetic in here: that is how a fold rule once went
 * four rounds without the shipped number moving.
 */
import { charge, refund, entitlement } from './api/_lib/core.js';
import { ledger, logPayment, noteIssue, signature, safeCode, issueTitle,
         takeHold, settleHold, closeHold, heldMicros, adminAction,
         raiseAlert, accountTag, watchSpend, periodCost, budgetFor,
         watchAction, sessionCost } from './api/_lib/operator.js';
import { sendAlert, sendDigest, retryUndelivered, usd } from './api/_lib/notify.js';
import { makeDb } from './fakedb.js';

const out = [];
const check = (n, ok, d) => { out.push({n, ok});
  console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (ok || !d ? '' : '\n          ' + d)); };

const paid = extra => ({ id: 'u1', email: 'w@example.com', plan: 'beatfall',
  subscription_status: 'active', credits_used: 0, credits_extra: 0,
  is_admin: false, period_start: '2026-09-01T00:00:00Z', trial_ends_at: null,
  account_tag: 'acct_test', ...extra });

// ---------------------------------------------------------- the ledger ----
{
  const db = makeDb(paid());
  const p = db.state.profile;
  await charge(db, 'u1', p, entitlement(p), 2, { reason: 'import', ref: 's1' });
  const L = db.state.credit_ledger || [];
  check('a charge writes a ledger row', L.length === 1, JSON.stringify(L));
  check('signed, so a charge reads as money leaving',
    L[0] && L[0].credits === -2, JSON.stringify(L[0]));
  check('and says which bucket it came out of',
    L[0] && L[0].bucket === 'monthly', JSON.stringify(L[0]));
  check('and carries the balance it produced',
    L[0] && L[0].monthly_after === 2, JSON.stringify(L[0]));
  check('and what it was for', L[0] && L[0].reason === 'import' && L[0].ref === 's1',
    JSON.stringify(L[0]));
}

/* A charge that spans both buckets is TWO movements, because they are two
   different kinds of credit and "three came back" is not an answer unless it
   says which three. */
{
  const db = makeDb(paid({ credits_used: 74, credits_extra: 10 }));
  const p = db.state.profile;
  const r = await charge(db, 'u1', p, entitlement(p), 3, { reason: 'import', ref: 's2' });
  const L = db.state.credit_ledger || [];
  check('a charge across both buckets is recorded as two movements',
    L.length === 2, JSON.stringify(L));
  check('one from the month and one from the bought credits',
    L.some(x => x.bucket === 'monthly' && x.credits === -1)
    && L.some(x => x.bucket === 'banked' && x.credits === -2), JSON.stringify(L));
  check('and the split matches what the charge reported',
    r.took.monthly === 1 && r.took.banked === 2, JSON.stringify(r.took));
}

/* And a refund goes back to the same buckets, recorded the same way. This is
   the half that was invisible: a refund moved the numbers and left no trace,
   so "why does this writer have 43 credits" had no answer. */
{
  const db = makeDb(paid({ credits_used: 74, credits_extra: 10 }));
  const p = db.state.profile;
  const r = await charge(db, 'u1', p, entitlement(p), 3, { reason: 'import', ref: 's3' });
  await refund(db, 'u1', r.took, { tag: 'acct_test', reason: 'the work did not happen', ref: 's3' });
  const L = db.state.credit_ledger || [];
  const back = L.filter(x => x.kind === 'refund');
  check('a refund is recorded too', back.length === 2, JSON.stringify(L));
  check('into the same buckets it came out of',
    back.some(x => x.bucket === 'monthly' && x.credits === 1)
    && back.some(x => x.bucket === 'banked' && x.credits === 2), JSON.stringify(back));
  check('and the account is whole again',
    db.state.profile.credits_used === 74 && db.state.profile.credits_extra === 10,
    JSON.stringify(db.state.profile));
}

// -------------------------------------------------- a retry writes once ----
{
  const db = makeDb(paid());
  const one = { userId: 'u1', kind: 'purchase', credits: 25, bucket: 'banked',
                reason: 'credit pack', ref: 'evt_1', idem: 'stripe:evt_1' };
  const a = await ledger(db, one);
  const b = await ledger(db, one);
  check('the same movement twice writes one row',
    (db.state.credit_ledger || []).length === 1,
    JSON.stringify(db.state.credit_ledger));
  check('and the second attempt is a success, not an error', a === true && b === true);
}

{
  const db = makeDb(paid());
  const pay = { userId: 'u1', eventId: 'evt_9', kind: 'topup', amountCents: 600 };
  await logPayment(db, pay);
  await logPayment(db, pay);
  check('the same Stripe event twice records one payment',
    (db.state.payments || []).length === 1, JSON.stringify(db.state.payments));
  check('and it keeps the amount in cents, not a float',
    db.state.payments[0].amount_cents === 600, JSON.stringify(db.state.payments[0]));
}

// ----------------------------------------------- nothing can refuse work ----
/* THE RULE THAT MATTERS MOST. These records exist to explain money and they
   are not allowed to stand in the way of the work they describe. A database
   that refuses every write must still leave the charge applied. */
{
  const db = makeDb(paid(), { failEvery: 1 });
  let threw = null;
  try { await ledger(db, { userId: 'u1', kind: 'charge', credits: -2 }); }
  catch (e) { threw = e; }
  check('a ledger write that fails does not throw', threw === null, String(threw));
}
{
  const db = makeDb(paid());
  const p = db.state.profile;
  // The profile write works; everything else is refused.
  const real = db.from;
  db.from = name => (name === 'profiles' ? real(name) : {
    insert: () => ({ then: (res) => res({ data: null, error: { code: 'XX000', message: 'down' } }),
                     select: () => ({ single: async () => ({ data: null, error: { code: 'XX000' } }),
                                      maybeSingle: async () => ({ data: null, error: { code: 'XX000' } }) }) }),
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }),
                                  eq: () => ({ then: r => r({ data: [], error: null }) }) }) }),
    update: () => ({ eq: () => ({ is: async () => ({}), eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) })
  });
  const r = await charge(db, 'u1', p, entitlement(p), 2, { reason: 'import', ref: 's9' });
  check('a charge still applies when its ledger row cannot be written',
    r.ok === true && db.state.profile.credits_used === 2,
    JSON.stringify({ ok: r.ok, used: db.state.profile.credits_used }));
}

// ------------------------------------------------------------- issues ------
{
  const db = makeDb(paid());
  const id1 = await noteIssue(db, { feature: 'import', stage: 'provider', code: 'rate_limited' });
  const id2 = await noteIssue(db, { feature: 'import', stage: 'provider', code: 'rate_limited' });
  const id3 = await noteIssue(db, { feature: 'logline', stage: 'provider', code: 'rate_limited' });
  const I = db.state.admin_issues || [];
  check('the same failure twice is one issue', id1 === id2 && I.length === 2,
    JSON.stringify(I.map(x => x.signature)));
  check('a different feature is a different issue', id3 !== id1);
  check('and the count goes up rather than a second row appearing',
    I.find(x => x.id === id1).occurrences === 2, JSON.stringify(I[0]));
  check('it carries a title a person can read, not a signature',
    /Reading notes/.test(I.find(x => x.id === id1).title),
    I.find(x => x.id === id1).title);
}

/* A RESOLVED ISSUE THAT HAPPENS AGAIN IS NOT RESOLVED, and it is not new
   either: it reopens as something being watched, so everything already written
   about it is still attached. */
{
  const db = makeDb(paid());
  const id = await noteIssue(db, { feature: 'import', stage: 'read', code: 'bad_json' });
  db.state.admin_issues[0].status = 'resolved';
  db.state.admin_issues[0].resolved_at = '2026-10-01T00:00:00Z';
  await noteIssue(db, { feature: 'import', stage: 'read', code: 'bad_json' });
  const row = db.state.admin_issues.find(x => x.id === id);
  check('a resolved issue that recurs reopens', row.status === 'monitoring', row.status);
  check('and stops claiming it was resolved', !row.resolved_at, String(row.resolved_at));
}

// --------------------------------------------- no writer's words get in ----
{
  const nasty = 'TypeError: cannot read "Mara walks the burned hallway" of undefined';
  check('an error message never becomes a code', safeCode(nasty) === 'unclassified',
    safeCode(nasty));
  check('a real code survives', safeCode('rate_limited') === 'rate_limited');
  const sig = signature('import', 'provider', nasty);
  check('and never reaches the signature', !/Mara|hallway/.test(sig), sig);
  check('nor the title', !/Mara|hallway/.test(issueTitle('import', 'provider', safeCode(nasty))),
    issueTitle('import', 'provider', safeCode(nasty)));
}

// ----------------------------------------------------- budget holds --------
/* TWO REQUESTS AT ONCE IS THE WHOLE REASON A RESERVATION EXISTS. A ceiling
   checked against what has already been SPENT lets both through, because
   neither has spent anything yet. */
{
  const db = makeDb(paid());
  const a = await takeHold(db, { userId: 'u1', requestId: 'r1', feature: 'import', estimate: 90000 });
  const b = await takeHold(db, { userId: 'u1', requestId: 'r2', feature: 'import', estimate: 90000 });
  check('two requests in flight are both held', !!a && !!b);
  check('and work in flight counts against the limit',
    await heldMicros(db, 'u1') === 180000, String(await heldMicros(db, 'u1')));

  await settleHold(db, a, 1234);
  check('a settled hold stops counting', await heldMicros(db, 'u1') === 90000,
    String(await heldMicros(db, 'u1')));
  check('and records what it really cost, separately from the guess',
    db.state.budget_holds.find(h => h.id === a).actual_micros === 1234
    && db.state.budget_holds.find(h => h.id === a).estimate_micros === 90000,
    JSON.stringify(db.state.budget_holds.find(h => h.id === a)));
}

/* AN ANSWER THAT NEVER CAME BACK IS NOT PROOF NOTHING WAS SPENT. The provider
   may well have finished. Releasing the money on that assumption is how a
   spending limit quietly stops limiting, so it goes to reconciliation. */
{
  const db = makeDb(paid());
  const h = await takeHold(db, { userId: 'u1', requestId: 'r3', estimate: 50000 });
  await closeHold(db, h, 'unknown');
  const row = db.state.budget_holds.find(x => x.id === h);
  check('a lost answer is unknown rather than abandoned', row.state === 'unknown', row.state);
  check('and it has no invented cost on it', row.actual_micros == null,
    String(row.actual_micros));
}

{
  const db = makeDb(paid());
  await takeHold(db, { userId: 'u1', requestId: 'same', estimate: 1000 });
  const second = await takeHold(db, { userId: 'u1', requestId: 'same', estimate: 1000 });
  check('one attempt cannot be held twice', second === null
    && (db.state.budget_holds || []).length === 1,
    JSON.stringify(db.state.budget_holds));
}

// ------------------------------------------------------ the audit trail ----
{
  const db = makeDb(paid());
  const a = await adminAction(db, { adminId: 'k1', adminEmail: 'k@x.com',
    action: 'credit_correction', subjectUser: 'u1', idem: 'act_1',
    detail: { credits: 5 } });
  const b = await adminAction(db, { adminId: 'k1', action: 'credit_correction',
    subjectUser: 'u1', idem: 'act_1' });
  check('an action is recorded', a === 'ok' && (db.state.admin_actions || []).length === 1);
  check('and the same one twice does not double up', b === 'duplicate',
    String(b));
  const refused = await adminAction(db, { adminId: 'k1', action: 'pause_help',
    subjectUser: 'u1', result: 'refused' });
  check('a refused action is recorded too, because it happened',
    refused === 'ok' && db.state.admin_actions.some(r => r.result === 'refused'),
    JSON.stringify(db.state.admin_actions.map(r => r.result)));
}

// ----------------------------------------------------------- alerts --------
{
  const db = makeDb(paid());
  await raiseAlert(db, { kind: 'spend', level: 'warn', dedupe: 'u1|day',
                         summary: 'getting expensive' });
  await raiseAlert(db, { kind: 'spend', level: 'warn', dedupe: 'u1|day',
                         summary: 'getting expensive' });
  check('the same warning twice is raised once',
    (db.state.alerts || []).length === 1, JSON.stringify(db.state.alerts));
  await raiseAlert(db, { kind: 'spend', level: 'urgent', dedupe: 'u1|day',
                         summary: 'now it is serious' });
  check('but a situation getting worse escalates rather than being suppressed',
    (db.state.alerts || []).length === 2,
    JSON.stringify((db.state.alerts || []).map(a => a.level)));
  check('an alert starts undelivered, because nothing has delivered it',
    !db.state.alerts[0].delivered_at, String(db.state.alerts[0].delivered_at));
}

// --------------------------------------------------------- account tag -----
/* The opaque id that lets a financial record outlive the account. It must not
   be derived from anything about the person, or de-identifying is a word
   rather than a fact. */
{
  const db = makeDb(paid({ account_tag: null }));
  const tag = await accountTag(db, db.state.profile);
  check('an account without a tag is given one', !!tag && /^acct_/.test(tag), String(tag));
  check('and it says nothing about who they are',
    !/example|w@|u1/.test(tag), String(tag));
  const again = await accountTag(db, db.state.profile);
  check('and it never changes once written', again === tag);
}


/* ===================================================== watching the spend ==
   KRIS'S FIGURES, approved 9 October: warn at $8 of provider cost inside an
   account's own credit allowance period, urgent at $10, alerts and never
   cutoffs. Three things have to hold or the whole thing is decoration: it
   fires at the right figure, it uses the right window, and it never stops
   anybody. */
const PERIOD = '2026-10-01T00:00:00Z';
const costing = micros => ({ user_id: 'u1', kind: 'import', cost_micros: micros,
  credits: 5, created_at: '2026-10-05T00:00:00Z' });
const budgetRows = [{ scope: 'paid_period', warn_micros: 8000000,
  urgent_micros: 10000000, stop_micros: null, enforced: false,
  approved_by: 'kris' }];

{
  const db = makeDb(paid({ period_start: PERIOD }),
    { usage: [costing(3000000)], budgets: budgetRows });
  const r = await watchSpend(db, { profile: db.state.profile });
  check('under the figure nothing is raised', r.level === null
    && !(db.state.alerts || []).length, JSON.stringify(r));
}

{
  const db = makeDb(paid({ period_start: PERIOD }),
    { usage: [costing(8200000)], budgets: budgetRows });
  const r = await watchSpend(db, { profile: db.state.profile });
  const a = (db.state.alerts || [])[0];
  check('at eight dollars it warns', r.level === 'warn' && !!a, JSON.stringify(r));
  check('and names the account', /w@example\.com/.test(a.summary), a.summary);
  check('and says what the money went on', /import/.test(a.detail.top), a.detail.top);
  check('and says the period it is measuring',
    a.detail.period_start === '2026-10-01', a.detail.period_start);
  check('and states plainly that nothing is enforced',
    a.detail.enforced === false, String(a.detail.enforced));
}

{
  const db = makeDb(paid({ period_start: PERIOD }),
    { usage: [costing(10500000)], budgets: budgetRows });
  const r = await watchSpend(db, { profile: db.state.profile });
  check('at ten dollars it is urgent', r.level === 'urgent', JSON.stringify(r));
}

/* A SITUATION GETTING WORSE MUST ESCALATE. The same account crossing eight and
   then ten is two different pieces of news, and a dedupe that only keyed on
   the account would show him the first and swallow the second. */
{
  const db = makeDb(paid({ period_start: PERIOD }),
    { usage: [costing(8200000)], budgets: budgetRows });
  await watchSpend(db, { profile: db.state.profile });
  await watchSpend(db, { profile: db.state.profile });
  check('the same warning twice is one alert',
    (db.state.alerts || []).length === 1, JSON.stringify(db.state.alerts));
  db.state.usage.push(costing(2500000));
  await watchSpend(db, { profile: db.state.profile });
  check('and crossing the next line escalates rather than being suppressed',
    (db.state.alerts || []).length === 2
    && db.state.alerts[1].level === 'urgent',
    JSON.stringify((db.state.alerts || []).map(a => a.level)));
}

/* THE WINDOW IS THE WRITER'S OWN RESET DAY, not the calendar month and not
   Stripe's billing date. Spending from before this period must not count, or
   the figure describes six weeks and is read as a month. */
{
  const db = makeDb(paid({ period_start: PERIOD }), {
    usage: [
      { user_id: 'u1', kind: 'import', cost_micros: 9000000, created_at: '2026-09-20T00:00:00Z' },
      costing(1000000)
    ],
    budgets: budgetRows
  });
  const r = await watchSpend(db, { profile: db.state.profile });
  check('spending from the previous period is not counted',
    r.level === null && r.spent === 1000000, JSON.stringify(r));
}

/* NOT SET IS NOT ZERO. Kris has approved nothing for trials yet, so a trial
   account has nothing to cross and the watcher says so rather than inventing
   a line and reporting against it. */
{
  const db = makeDb(paid({ plan: 'trial', subscription_status: 'trialing',
                           period_start: PERIOD }),
    { usage: [costing(50000000)], budgets: budgetRows });
  const r = await watchSpend(db, { profile: db.state.profile });
  check('a trial has no approved figure, so nothing is claimed',
    r.watched === false && /trial_account/.test(r.why), JSON.stringify(r));
  check('and no alert is invented', !(db.state.alerts || []).length);
}

/* INTERNAL TESTING IS WATCHED AND KEPT APART. A runaway test is still real
   money and should still reach him, but it is never a customer signal. */
{
  const db = makeDb(paid({ period_start: PERIOD, is_internal: true }),
    { usage: [costing(11000000)], budgets: budgetRows });
  const r = await watchSpend(db, { profile: db.state.profile });
  check('an internal account still raises an alert', r.level === 'urgent');
  check('and the alert says it is internal', r.internal === true
    && db.state.alerts[0].detail.internal === true
    && /^Internal account/.test(db.state.alerts[0].summary),
    db.state.alerts[0].summary);
}

/* AND IT CAN NEVER REFUSE ANYTHING. Everything above is reporting; a database
   that will not answer must leave the work alone. */
{
  const db = makeDb(paid({ period_start: PERIOD }), { failEvery: 1 });
  let threw = null;
  try { await watchSpend(db, { profile: db.state.profile }); }
  catch (e) { threw = e; }
  check('a watcher that cannot read does not throw', threw === null, String(threw));
}

/* ======================================================= getting it to him ==
   An alert the page shows as delivered and that never arrived is worse than
   no alert, so delivery is recorded with its failure attached. */
{
  const db = makeDb(paid());
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => { sent.push(JSON.parse(o.body)); return { ok: true }; };
  process.env.RESEND_API_KEY = 'test'; process.env.MAIL_FROM = 'noreply@beatfall.app';
  process.env.ALERT_TO = 'kris@example.com';
  db.state.alerts = [{ id: 1, level: 'urgent', summary: 'Account cost $11.00',
    detail: { email: 'w@example.com', spent_usd: '$11.00', threshold_usd: '$10.00',
              period_start: '2026-10-01', top: 'import $9.40', internal: false } }];
  const ok = await sendAlert(db, db.state.alerts[0]);
  check('an urgent alert is sent', ok === true && sent.length === 1);
  check('and the message carries the figures, not a writer\'s words',
    /\$11\.00/.test(sent[0].text) && /import/.test(sent[0].text), sent[0].text.slice(0, 120));
  check('and says nothing was stopped',
    /not enforced/.test(sent[0].text), sent[0].text.slice(0, 200));
  check('and the row records that it went',
    !!db.state.alerts[0].delivered_at, JSON.stringify(db.state.alerts[0]));

  globalThis.fetch = async () => ({ ok: false, status: 500 });
  db.state.alerts[0].delivered_at = null;
  const bad = await sendAlert(db, db.state.alerts[0]);
  check('a refused send is reported as a failure', bad === false);
  check('and the row says why rather than claiming it arrived',
    !db.state.alerts[0].delivered_at && /500/.test(db.state.alerts[0].delivery_error || ''),
    JSON.stringify(db.state.alerts[0]));
  globalThis.fetch = realFetch;
}

/* THE DIGEST SENDS NOTHING WHEN THERE IS NOTHING. A daily message that usually
   says all clear is a daily message nobody opens. */
{
  const db = makeDb(paid());
  db.state.alerts = [];
  const r = await sendDigest(db);
  check('an empty digest is not sent', r.sent === false
    && /nothing outstanding/.test(r.why), JSON.stringify(r));
}
{
  const db = makeDb(paid());
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => { sent.push(JSON.parse(o.body)); return { ok: true }; };
  db.state.alerts = [
    { id: 1, kind: 'spend', level: 'warn', summary: 'one', created_at: '2026-10-08T10:00:00Z', acknowledged_at: null },
    { id: 2, kind: 'spend', level: 'urgent', summary: 'two', created_at: '2026-10-08T11:00:00Z', acknowledged_at: null },
    { id: 3, kind: 'spend', level: 'warn', summary: 'dealt with', created_at: '2026-10-07T11:00:00Z', acknowledged_at: '2026-10-07T12:00:00Z' }
  ];
  const r = await sendDigest(db);
  check('a digest goes out when something is outstanding', r.sent === true && r.count === 2,
    JSON.stringify(r));
  check('and leaves out anything already dealt with',
    !/dealt with/.test(sent[0].text), sent[0].text);
  globalThis.fetch = realFetch;
}

check('money is printed in dollars and cents, never raw millionths',
  usd(8200000) === '$8.20', usd(8200000));


/* ============================================ one action, not one account ==
   Observing only. The figure is approved and the behaviour is not, so every
   check here is about recording the right thing and stopping nothing. */
const actionBudget = [{ scope: 'single_action', warn_micros: null,
  urgent_micros: null, stop_micros: 1500000, enforced: false, approved_by: 'kris' }];

{
  const db = makeDb(paid(), {
    usage: [{ user_id: 'u1', kind: 'import', session_id: 's1', cost_micros: 400000 }],
    budgets: actionBudget
  });
  const r = await watchAction(db, { userId: 'u1', session: 's1' });
  check('an ordinary action is nowhere near the cutoff',
    r.over === false, JSON.stringify(r));
  check('and raises nothing', !(db.state.alerts || []).length);
}

{
  const db = makeDb(paid(), {
    usage: [
      { user_id: 'u1', kind: 'import', session_id: 's1', cost_micros: 900000 },
      { user_id: 'u1', kind: 'import', session_id: 's1', cost_micros: 700000 },
      { user_id: 'u1', kind: 'import', session_id: 'other', cost_micros: 9000000 }
    ],
    budgets: actionBudget
  });
  const r = await watchAction(db, { userId: 'u1', session: 's1', email: 'w@example.com' });
  check('one action past the figure is noticed', r.over === true && r.spent === 1600000,
    JSON.stringify(r));
  check('and another action is not counted into it', r.spent === 1600000, String(r.spent));
  const a = db.state.alerts[0];
  check('it is recorded as a warning, not a stop, while it is only observed',
    a.level === 'warn', a.level);
  check('and says plainly that nothing was stopped',
    /Nothing was stopped/.test(a.detail.note) && a.detail.enforced === false,
    JSON.stringify(a.detail));
  check('and says the figure it is being measured against',
    a.detail.threshold_usd === '$1.50', a.detail.threshold_usd);
}

/* A RUNAWAY IMPORT IS ONE HUNDRED AND FIFTY CALLS. If each one raised an
   alert, the thing meant to warn him would bury him. */
{
  const db = makeDb(paid(), {
    usage: [{ user_id: 'u1', kind: 'import', session_id: 's1', cost_micros: 2000000 }],
    budgets: actionBudget
  });
  await watchAction(db, { userId: 'u1', session: 's1' });
  await watchAction(db, { userId: 'u1', session: 's1' });
  await watchAction(db, { userId: 'u1', session: 's1' });
  check('one action raises one alert however many calls notice',
    (db.state.alerts || []).length === 1, String((db.state.alerts || []).length));
}

/* ===================================================== delivery, honestly ==
   Three states, not two: delivered, tried and failed, or never tried because
   mail is not set up. The page must never show the first when it was one of
   the others. */
{
  const db = makeDb(paid());
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 503 }; };
  process.env.RESEND_API_KEY = 'test'; process.env.MAIL_FROM = 'n@beatfall.app';
  process.env.ALERT_TO = 'kris@example.com';
  db.state.alerts = [{ id: 1, level: 'urgent', summary: 'x', detail: {}, attempts: 0 }];
  const ok = await sendAlert(db, db.state.alerts[0]);
  check('a server that is briefly down is retried', calls === 3 && ok === false,
    'tried ' + calls + ' times');
  check('and the attempts are counted on the row',
    db.state.alerts[0].attempts === 3, String(db.state.alerts[0].attempts));
  check('and it is not marked delivered', !db.state.alerts[0].delivered_at);
  globalThis.fetch = realFetch;
}

{
  const db = makeDb(paid());
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 403 }; };
  db.state.alerts = [{ id: 1, level: 'urgent', summary: 'x', detail: {}, attempts: 0 }];
  await sendAlert(db, db.state.alerts[0]);
  check('a wrong key is not retried, because retrying cannot fix it',
    calls === 1, 'tried ' + calls + ' times');
  globalThis.fetch = realFetch;
}

{
  const db = makeDb(paid());
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return calls === 2 ? { ok: true } : { ok: false, status: 503 }; };
  db.state.alerts = [{ id: 1, level: 'warn', summary: 'x', detail: {}, attempts: 0 }];
  const ok = await sendAlert(db, db.state.alerts[0]);
  check('a second attempt that works is a success', ok === true && calls === 2);
  check('and the row says delivered, with the attempts it took',
    !!db.state.alerts[0].delivered_at && db.state.alerts[0].attempts === 2,
    JSON.stringify(db.state.alerts[0]));
  globalThis.fetch = realFetch;
}

{
  const db = makeDb(paid());
  delete process.env.ALERT_TO;
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true }; };
  db.state.alerts = [{ id: 1, level: 'urgent', summary: 'x', detail: {}, attempts: 0 }];
  await sendAlert(db, db.state.alerts[0]);
  check('with no address nothing is sent and nothing is pretended',
    calls === 0 && !db.state.alerts[0].delivered_at
    && /ALERT_TO/.test(db.state.alerts[0].delivery_error || ''),
    JSON.stringify(db.state.alerts[0]));
  process.env.ALERT_TO = 'kris@example.com';
  globalThis.fetch = realFetch;
}

/* THE NIGHTLY SWEEP. It has the patience the inline attempt does not, and it
   knows when to stop. */
{
  const db = makeDb(paid());
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true });
  const recent = new Date().toISOString();
  db.state.alerts = [
    { id: 1, level: 'warn', summary: 'retry me', detail: {}, attempts: 2,
      delivered_at: null, created_at: recent },
    { id: 2, level: 'warn', summary: 'already went', detail: {}, attempts: 1,
      delivered_at: recent, created_at: recent },
    { id: 3, level: 'warn', summary: 'bad key', detail: {}, attempts: 1,
      delivery_error: 'mail refused with 403', delivered_at: null, created_at: recent },
    { id: 4, level: 'warn', summary: 'exhausted', detail: {}, attempts: 6,
      delivered_at: null, created_at: recent }
  ];
  const r = await retryUndelivered(db);
  check('the sweep retries what is still worth retrying', r.tried === 1 && r.sent === 1,
    JSON.stringify(r));
  check('it leaves alone anything already delivered',
    db.state.alerts[1].attempts === 1, String(db.state.alerts[1].attempts));
  check('it does not keep hammering a wrong key',
    !db.state.alerts[2].delivered_at && db.state.alerts[2].attempts === 1,
    JSON.stringify(db.state.alerts[2]));
  check('and one that has run out stops pretending it is pending',
    /gave up/.test(db.state.alerts[3].delivery_error || ''),
    db.state.alerts[3].delivery_error);
  globalThis.fetch = realFetch;
}


/* CREDITS GO BACK EXACTLY ONCE, and that has to survive the same refund being
   attempted twice. The flag in api/claude.js stops a second call; this is the
   other half, the constraint that holds whatever calls it. */
{
  const db = makeDb(paid({ credits_used: 74, credits_extra: 10 }));
  const p = db.state.profile;
  const r = await charge(db, 'u1', p, entitlement(p), 3, { reason: 'import', ref: 'sx' });
  await refund(db, 'u1', r.took, { tag: 'acct_test', ref: 'sx' });
  const afterFirst = { used: db.state.profile.credits_used, extra: db.state.profile.credits_extra };
  await refund(db, 'u1', r.took, { tag: 'acct_test', ref: 'sx' });
  const back = (db.state.credit_ledger || []).filter(x => x.kind === 'refund');
  check('the same refund twice posts one pair of movements', back.length === 2,
    JSON.stringify(back.map(x => [x.bucket, x.credits])));
  check('and the ledger still agrees with the account it describes',
    back.filter(x => x.bucket === 'monthly').length === 1
    && back.filter(x => x.bucket === 'banked').length === 1,
    JSON.stringify(back.map(x => x.bucket)));
  check('the first refund restored the balance',
    afterFirst.used === 74 && afterFirst.extra === 10, JSON.stringify(afterFirst));
}

const bad = out.filter(r => !r.ok).length;
console.log('\n' + (out.length - bad) + ' of ' + out.length + ' passed');
if (bad) { console.log('\nFAILED:'); out.filter(r => !r.ok).forEach(r => console.log('  ' + r.n)); }
process.exit(bad ? 1 : 0);
