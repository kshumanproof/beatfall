/* THE OPERATOR'S WRITE ENDPOINT.
 *
 * GET /api/admin reads; POST delegates to the action handler. This is the only file in
 * the product where an operator action touches the database, so the whole
 * question "what can that page do to somebody's account" is answered by the
 * list in it, and every item on that list is checked here.
 *
 * WHAT THESE CHECKS ARE ACTUALLY FOR. An admin tool goes wrong in six
 * recognisable ways and the endpoint names all six at the top of itself:
 * an unnamed write, a role that can be changed from a screen, an action that
 * is not recorded, a double press that applies twice, a cost control that
 * reaches somebody's writing, and enforcement switched on before anybody
 * approved it. Each has checks below, and the refusals are checked as
 * carefully as the successes, because "I tried and it would not let me" is a
 * thing that has to be readable afterwards.
 *
 * It runs the SHIPPED endpoint against the stand-in database. There is no
 * second copy of any rule in here.
 */
import handler from './api/admin.real.js';
import actionHandler from './api/_admin-do.js';
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
  credits_extra: 0, period_start: '2026-10-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z', account_tag: 'acct_k' };

const ago = n => new Date(Date.now() - n * 86400000).toISOString();

function person(id, extra) {
  return Object.assign({
    id, email: id + '@example.com', is_admin: false, is_internal: false,
    is_unlimited: false, plan: 'beatfall', subscription_status: 'active',
    credits_used: 10, credits_extra: 0, period_start: ago(5),
    created_at: ago(40), last_seen_at: ago(1), display_name: null,
    account_tag: 'acct_' + id, help_paused_at: null, help_pause_reason: null,
    marketing_opt_in: false
  }, extra || {});
}

/* One press. `who` is the admin making it, so the permission checks can send
   somebody who is not one. */
async function press(db, body, who) {
  globalThis.__DB__ = db;
  globalThis.__AUTH__ = { db, user: { id: (who || ADMIN).id },
    profile: who || ADMIN };
  const r = res();
  await handler({ method: 'POST', body, headers: {} }, r);
  return r;
}

const seed = extra => makeDb(ADMIN, Object.assign({
  profiles: [ADMIN, person('u1'), person('u2')],
  admin_actions: [], credit_ledger: [], alerts: [], budgets: [],
  admin_issues: [], admin_issue_notes: [], support_cases: [],
  consent_log: [], budget_holds: []
}, extra || {}));

const audits = db => db.state.admin_actions || [];
const lastAudit = db => audits(db)[audits(db).length - 1] || {};

// ========================================================== permissions ====
{
  const db = seed();
  const r = await press(db, { action: 'help_resume', user_id: 'u1' },
    Object.assign({}, ADMIN, { id: 'u9', is_admin: false }));
  check('a writer who is not an admin is refused', r.code === 403, String(r.code));
  check('a refused writer leaves no audit row at all', audits(db).length === 0,
    JSON.stringify(audits(db)));
}
/* AN UNLIMITED OWNER IS NOT AN ADMIN. Two switches on purpose: one buys
   boards that never close, the other opens everybody's numbers. */
{
  const db = seed();
  const r = await press(db, { action: 'help_resume', user_id: 'u1' },
    Object.assign({}, ADMIN, { id: 'u8', is_admin: false, is_unlimited: true }));
  check('an unlimited owner who is not an admin is also refused', r.code === 403);
}
{
  const db = seed();
  globalThis.__DB__ = db;
  globalThis.__AUTH__ = { db, user: { id: 'k1' }, profile: ADMIN };
  const r = res();
  await actionHandler({ method: 'GET', query: {}, headers: {} }, r);
  check('a GET cannot perform an action', r.code === 405, String(r.code));
}

// ======================================================= unnamed writes ====
/* RULE 1. There is no generic "update this profile" and no raw column write.
   An action that cannot be named cannot be performed, which is what stops
   anybody discovering a way to set a role through a control built for
   credits. */
{
  const db = seed();
  const r = await press(db, { action: 'profile_update', user_id: 'u1',
    patch: { is_admin: true } });
  check('an action the page does not name is refused', r.code === 400, String(r.code));
  check('the refusal says it is a refusal rather than a failure',
    r.body.error === 'refused', JSON.stringify(r.body));
  check('an unnamed action is recorded as refused',
    lastAudit(db).result === 'refused', JSON.stringify(lastAudit(db)));
  check('nothing on the account moved',
    db.state.profiles[1].is_admin === false);
}
/* RULE 2. is_admin and is_unlimited are deliberately absent from the list.
   Sending them alongside an action that IS named must not smuggle them in. */
{
  const db = seed();
  await press(db, { action: 'help_resume', user_id: 'u1',
    is_admin: true, is_unlimited: true });
  const u1 = db.state.profiles[1];
  check('a role sent alongside a named action is ignored',
    u1.is_admin === false && u1.is_unlimited === false, JSON.stringify(u1));
}

// =========================================================== idempotency ===
/* RULE 4. A double press, a retried request and a flaky connection must not
   correct the same credits twice. There are two guards and they catch
   different things: the audit key stops the same PRESS, and the ledger stops
   the same MOVEMENT whatever press it arrives on. Money gets both. */
{
  const db = seed();
  const body = { action: 'credit_correction', user_id: 'u1', credits: 25,
    reason: 'read failed and charged', idem: 'press-1' };
  const a = await press(db, body);
  const b = await press(db, body);
  check('the first correction applies', a.code === 200 && a.body.ok === true);
  check('the same press a second time says it was already done',
    b.body.already === true, JSON.stringify(b.body));
  check('the credits moved exactly once',
    db.state.profiles[1].credits_extra === 25,
    String(db.state.profiles[1].credits_extra));
  check('one ledger row, not two', db.state.credit_ledger.length === 1,
    JSON.stringify(db.state.credit_ledger));
  check('one audit row, not two',
    audits(db).filter(a2 => a2.action === 'credit_correction').length === 1);
}
/* A press with no key of its own is treated as a NEW press, which is the
   honest reading of a caller that did not claim otherwise. It still gets an
   audit row to write the outcome onto. */
{
  const db = seed();
  await press(db, { action: 'credit_correction', user_id: 'u1', credits: 5,
    reason: 'one' });
  await press(db, { action: 'credit_correction', user_id: 'u1', credits: 5,
    reason: 'two' });
  check('two presses that claim nothing are two actions',
    db.state.profiles[1].credits_extra === 10,
    String(db.state.profiles[1].credits_extra));
  check('and both are recorded', audits(db).length === 2);
}

// =============================================== credits: the boundaries ===
{
  const db = seed();
  const r = await press(db, { action: 'credit_correction', user_id: 'u1',
    credits: 501, reason: 'fat finger' });
  check('a correction larger than a single one may move is refused',
    r.code === 400, String(r.code));
  check('the refusal names the ceiling rather than just saying no',
    /500/.test(r.body.message || ''), r.body.message);
  check('nothing moved', db.state.profiles[1].credits_extra === 0);
  check('the attempt is on the record', lastAudit(db).result === 'refused');
}
{
  const db = seed();
  const r = await press(db, { action: 'credit_correction', user_id: 'u1',
    credits: 25 });
  check('a correction with no reason is refused', r.code === 400);
  check('no ledger row for a refused correction',
    db.state.credit_ledger.length === 0);
}
{
  const db = seed();
  const r = await press(db, { action: 'credit_correction', user_id: 'u1',
    credits: 0, reason: 'nothing' });
  check('a correction of zero is refused rather than recorded', r.code === 400);
}
{
  const db = seed();
  const r = await press(db, { action: 'credit_correction', credits: 5,
    reason: 'who' });
  check('a correction with no account is refused', r.code === 400);
}
{
  const db = seed();
  const r = await press(db, { action: 'credit_correction', user_id: 'nobody',
    credits: 5, reason: 'who' });
  check('a correction against an account that does not exist is refused',
    r.code === 400, String(r.code));
}
/* CORRECTIONS GO TO THE BOUGHT BUCKET, ALWAYS. A credit granted into the
   monthly one expires on the writer's own reset day, which turns an apology
   into a smaller apology nobody mentioned. */
{
  const db = seed();
  await press(db, { action: 'credit_correction', user_id: 'u1', credits: 30,
    reason: 'read failed' });
  const u1 = db.state.profiles[1];
  check('a correction lands in the bought bucket', u1.credits_extra === 30);
  check('and leaves the monthly count alone', u1.credits_used === 10,
    String(u1.credits_used));
  const row = db.state.credit_ledger[0];
  check('the ledger row says which bucket', row.bucket === 'banked');
  check('the ledger row says why', row.reason === 'read failed');
  check('the ledger row says an operator did it', row.actor === 'admin');
  check('the ledger row carries the balance it produced', row.banked_after === 30);
}
/* A NEGATIVE CORRECTION IS A REAL CASE and must not take a balance below
   zero, because a negative bought bucket is a number nothing in the product
   knows how to spend. */
{
  const db = seed({ profiles: [ADMIN, person('u1', { credits_extra: 10 }), person('u2')] });
  await press(db, { action: 'credit_correction', user_id: 'u1', credits: -40,
    reason: 'bought twice by mistake' });
  check('taking more credits away than there are stops at zero',
    db.state.profiles[1].credits_extra === 0,
    String(db.state.profiles[1].credits_extra));
  check('and the movement is still recorded in full',
    db.state.credit_ledger[0].credits === -40,
    String(db.state.credit_ledger[0].credits));
}

// ================================================= enforcement is refused ==
/* RULE 6. Kris asked for every spending figure to be watched before anything
   acts on it. That is a decision the code holds rather than a note in a
   file: the figure can be set here and enforcement cannot be turned on from
   this page at all. */
{
  const db = seed();
  const r = await press(db, { action: 'budget_set', scope: 'paid_period',
    warn_usd: 8, urgent_usd: 10, enforced: true });
  check('a request to switch enforcement on is refused', r.code === 400,
    String(r.code));
  check('the refusal says why in words an operator can read',
    /observed/.test(r.body.message || ''), r.body.message);
  check('the attempt to enforce is on the record',
    lastAudit(db).result === 'refused', JSON.stringify(lastAudit(db)));
  check('and no figure was written either', (db.state.budgets || []).length === 0);
}
{
  const db = seed();
  const r = await press(db, { action: 'budget_set', scope: 'paid_period',
    warn_usd: 8, urgent_usd: 10, note: 'approved 9 Oct' });
  const b = (db.state.budgets || [])[0];
  check('a figure with no enforcement is accepted', r.code === 200);
  check('dollars are stored as micros', b.warn_micros === 8000000,
    String(b.warn_micros));
  check('the urgent figure too', b.urgent_micros === 10000000);
  check('enforcement is written as off, not merely left out',
    b.enforced === false, String(b.enforced));
  check('who approved it is recorded', b.approved_by === ADMIN.email);
  check('and the note survives', b.note === 'approved 9 Oct');
}
/* THREE SCOPES, THREE ROWS. A stand-in that keyed them together would have
   hidden this: setting the trial figure would silently replace the
   subscriber one and the page would show one limit where there are three. */
{
  const db = seed();
  await press(db, { action: 'budget_set', scope: 'paid_period', warn_usd: 8 });
  await press(db, { action: 'budget_set', scope: 'trial_account', warn_usd: 2 });
  await press(db, { action: 'budget_set', scope: 'single_action', stop_usd: 1.5 });
  check('each scope is its own figure', (db.state.budgets || []).length === 3,
    JSON.stringify(db.state.budgets));
  const single = db.state.budgets.find(b => b.scope === 'single_action');
  check('a part of a dollar survives the conversion',
    single.stop_micros === 1500000, String(single.stop_micros));
  check('a figure nobody set stays null rather than becoming zero',
    single.warn_micros === null, String(single.warn_micros));
}
{
  const db = seed();
  const r = await press(db, { action: 'budget_set', warn_usd: 8 });
  check('a figure with no scope is refused', r.code === 400);
}

// ============================================ pausing the paid help only ===
/* RULE 5. Nothing here touches a writer's work. Pausing the paid help leaves
   every board, note, outline and download exactly where it was, because
   withholding somebody's own writing is not a cost control. */
{
  const db = seed({ projects: [{ id: 'p1', user_id: 'u1', name: 'NIGHT HAUL',
    cards: [{ id: 'c1' }], card_count: 1 }] });
  const before = JSON.stringify(db.state.projects);
  const r = await press(db, { action: 'help_pause', user_id: 'u1',
    reason: 'one action cost nine dollars' });
  const u1 = db.state.profiles[1];
  check('the pause is accepted', r.code === 200);
  check('the account is marked paused', !!u1.help_paused_at);
  check('the reason is kept with it',
    u1.help_pause_reason === 'one action cost nine dollars');
  check('NOT ONE CARD MOVED', JSON.stringify(db.state.projects) === before,
    'the writer\'s work changed while the help was paused');
  check('nothing was deleted either',
    (db.state.deletedUsers || []).length === 0);
}
{
  const db = seed();
  const r = await press(db, { action: 'help_pause', user_id: 'u1' });
  check('a pause with no reason is refused', r.code === 400);
  check('and the account is untouched', !db.state.profiles[1].help_paused_at);
}
{
  const db = seed();
  const r = await press(db, { action: 'help_pause', reason: 'why' });
  check('a pause with no account is refused', r.code === 400);
}
{
  const db = seed({ profiles: [ADMIN,
    person('u1', { help_paused_at: ago(1), help_pause_reason: 'looking at it' }),
    person('u2')] });
  const r = await press(db, { action: 'help_resume', user_id: 'u1' });
  const u1 = db.state.profiles[1];
  check('the pause can be taken off', r.code === 200 && u1.help_paused_at === null);
  check('and the reason goes with it', u1.help_pause_reason === null);
}
{
  const db = seed();
  const r = await press(db, { action: 'help_resume' });
  check('letting the help work again needs an account named', r.code === 400);
}

// ==================================================== issues =============
const ISSUE = { id: 1, signature: 'sig1', title: 'A read came back empty',
  feature: 'import', stage: 'group', error_code: 'empty_reply',
  severity: 'high', status: 'new', occurrences: 4, accounts: 2,
  credits_charged: 10, credits_refunded: 0, cost_micros: 90000,
  first_seen_at: ago(3), last_seen_at: ago(1) };

{
  const db = seed({ admin_issues: [{ ...ISSUE }] });
  const r = await press(db, { action: 'issue_status', id: 1, status: 'resolved' });
  check('resolving an issue with no reason is refused', r.code === 400,
    String(r.code));
  check('the refusal asks for the reason',
    /why/.test(r.body.message || ''), r.body.message);
  check('the issue is still open', db.state.admin_issues[0].status === 'new');
}
{
  const db = seed({ admin_issues: [{ ...ISSUE }] });
  const r = await press(db, { action: 'issue_status', id: 1, status: 'resolved',
    reason: 'the provider was returning an empty body on a timeout' });
  const i = db.state.admin_issues[0];
  check('resolving an issue with a reason works', r.code === 200);
  check('the state is written', i.status === 'resolved');
  check('the time it was resolved is written', !!i.resolved_at);
  check('and the reason is kept where the next person will read it',
    /empty body/.test(i.resolved_reason || ''), i.resolved_reason);
}
/* REOPENING CLEARS THE RESOLUTION. A row that says resolved and also says it
   is being looked at is a row nobody can read. */
{
  const db = seed({ admin_issues: [{ ...ISSUE, status: 'resolved',
    resolved_at: ago(1), resolved_reason: 'thought it was fixed' }] });
  await press(db, { action: 'issue_status', id: 1, status: 'investigating' });
  const i = db.state.admin_issues[0];
  check('reopening an issue clears the resolution time', i.resolved_at === null);
  check('and the old reason with it', i.resolved_reason === null);
}
{
  const db = seed({ admin_issues: [{ ...ISSUE }] });
  const r = await press(db, { action: 'issue_status', id: 1, status: 'nonsense' });
  check('a state an issue cannot be in is refused', r.code === 400);
  check('and recorded as refused', lastAudit(db).result === 'refused');
}
{
  const db = seed({ admin_issues: [{ ...ISSUE }] });
  await press(db, { action: 'issue_assign', id: 1, assignee: 'kris' });
  check('an issue can be assigned', db.state.admin_issues[0].assignee === 'kris');
  await press(db, { action: 'issue_assign', id: 1, assignee: '' });
  check('and unassigned, which is a null rather than an empty string',
    db.state.admin_issues[0].assignee === null,
    JSON.stringify(db.state.admin_issues[0].assignee));
}
{
  const db = seed({ admin_issues: [{ ...ISSUE }] });
  const r = await press(db, { action: 'issue_note', id: 1,
    body: 'Ruled out the prompt. It is the 60 second timeout.' });
  check('a note can be written', r.code === 200);
  const n = db.state.admin_issue_notes[0];
  check('the note is attached to the issue', n.issue_id === 1);
  check('it says who wrote it', n.author === ADMIN.email);
  check('and keeps the words', /60 second/.test(n.body));
}
{
  const db = seed({ admin_issues: [{ ...ISSUE }] });
  const r = await press(db, { action: 'issue_note', id: 1, body: '   ' });
  check('a note with nothing in it is refused', r.code === 400);
  check('and no empty row is written',
    (db.state.admin_issue_notes || []).length === 0);
}

// ===================================================== alerts ==============
{
  const db = seed({ alerts: [{ id: 7, kind: 'spend', level: 'warn',
    summary: 'Account u1 has cost $8.10 this allowance period',
    created_at: ago(1), acknowledged_at: null, delivered_at: ago(1) }] });
  const r = await press(db, { action: 'alert_ack', id: 7 });
  check('an alert can be marked as seen', r.code === 200);
  check('the time it was seen is written', !!db.state.alerts[0].acknowledged_at);
  check('the alert itself stays in the record',
    db.state.alerts.length === 1);
}
/* MARKING ONE TWICE MUST NOT MOVE THE DATE. When it was first read is the
   useful fact; the second press is not news. */
{
  const first = ago(2);
  const db = seed({ alerts: [{ id: 7, acknowledged_at: first }] });
  await press(db, { action: 'alert_ack', id: 7 });
  check('an alert already seen keeps the time it was first seen',
    db.state.alerts[0].acknowledged_at === first,
    db.state.alerts[0].acknowledged_at);
}
{
  const db = seed({ alerts: [] });
  const r = await press(db, { action: 'alert_ack' });
  check('marking nothing as seen is refused', r.code === 400);
}

// ===================================================== support cases =======
{
  const db = seed({ admin_issues: [{ ...ISSUE }] });
  const r = await press(db, { action: 'case_open', user_id: 'u1',
    subject: 'Charged for a read that failed', issue_id: 1 });
  check('a case can be opened', r.code === 200);
  const c = db.state.support_cases[0];
  check('it is attached to the account', c.user_id === 'u1');
  check('and to the issue it came from', c.issue_id === 1);
  check('it opens open', c.status === 'open');
  check('the id comes back so the page can point at it', !!r.body.id);
}
{
  const db = seed();
  const r = await press(db, { action: 'case_open', subject: 'no account' });
  check('a case with no account is refused', r.code === 400);
}
{
  const db = seed({ support_cases: [{ id: 3, user_id: 'u1', status: 'open' }] });
  await press(db, { action: 'case_status', id: 3, status: 'closed' });
  const c = db.state.support_cases[0];
  check('a case can be closed', c.status === 'closed');
  check('and records when', !!c.closed_at);
  await press(db, { action: 'case_status', id: 3, status: 'open' });
  check('reopening it clears the closing date',
    db.state.support_cases[0].closed_at === null);
  const r = await press(db, { action: 'case_status', id: 3, status: 'maybe' });
  check('a state a case cannot be in is refused', r.code === 400);
}

// =================================================== marketing consent =====
/* THE PERMISSION IS THE WRITER'S and an operator may only ever record what
   they were told. Turning it on needs a source. Turning it off needs
   nothing, because somebody asking to be left alone is never refused. */
{
  const db = seed();
  const r = await press(db, { action: 'marketing_set', user_id: 'u1',
    opted_in: true });
  check('recording a permission with no source is refused', r.code === 400,
    String(r.code));
  check('and nothing is written on the account',
    db.state.profiles[1].marketing_opt_in === false);
  check('and nothing is written in the consent record',
    (db.state.consent_log || []).length === 0);
}
{
  const db = seed();
  await press(db, { action: 'marketing_set', user_id: 'u1', opted_in: true,
    source: 'said so in the tester survey' });
  check('a permission with a source is recorded',
    db.state.profiles[1].marketing_opt_in === true);
  const c = db.state.consent_log[0];
  check('the consent record says where it came from',
    /tester survey/.test(c.source || ''), c.source);
  check('and which way round it was', c.opted_in === true);
}
{
  const db = seed({ profiles: [ADMIN, person('u1', { marketing_opt_in: true }),
    person('u2')] });
  const r = await press(db, { action: 'marketing_set', user_id: 'u1',
    opted_in: false });
  check('asking to be left alone needs no source at all', r.code === 200);
  check('and is applied', db.state.profiles[1].marketing_opt_in === false);
  check('with its own consent row', db.state.consent_log[0].opted_in === false);
}

// ================================================ stuck reservations =======
/* A HOLD OPEN FOR HOURS IS NOT WORK IN PROGRESS. It is a request that went
   away without settling, and it counts against every ceiling until somebody
   clears it. Closed as UNKNOWN rather than as finished, because nobody can
   say whether the provider did the work. */
{
  const db = seed({ budget_holds: [{ id: 4, user_id: 'u1', state: 'held',
    created_at: ago(1) }] });
  const r = await press(db, { action: 'hold_clear', id: 4 });
  check('a stuck reservation can be cleared', r.code === 200);
  check('it is closed as unknown, never as settled',
    db.state.budget_holds[0].state === 'unknown',
    db.state.budget_holds[0].state);
  check('and when it was closed is recorded',
    !!db.state.budget_holds[0].settled_at);
}
{
  const db = seed({ budget_holds: [{ id: 4, user_id: 'u1', state: 'settled',
    cost_micros: 900, settled_at: ago(1) }] });
  await press(db, { action: 'hold_clear', id: 4 });
  check('a reservation that already settled is left exactly as it was',
    db.state.budget_holds[0].state === 'settled',
    db.state.budget_holds[0].state);
}
{
  const db = seed();
  const r = await press(db, { action: 'hold_clear' });
  check('clearing nothing is refused', r.code === 400);
}

// ================================================== the audit trail ========
/* RULE 3. EVERY ACTION IS AUDITED, INCLUDING THE REFUSED ONES. Each row says
   who, what, to whom and how it came out. */
{
  const db = seed();
  await press(db, { action: 'help_pause', user_id: 'u1', reason: 'cost' });
  const a = lastAudit(db);
  check('the audit row says who did it', a.admin_id === 'k1');
  check('it says which admin by email', a.admin_email === ADMIN.email);
  check('it says what was done', a.action === 'help_pause');
  check('it says whose account', a.subject_user === 'u1');
  check('it says how it came out', a.result === 'ok', a.result);
  check('and it carries the key that makes a retry safe', !!a.idem_key);
}
{
  const db = seed();
  await press(db, { action: 'help_pause', user_id: 'u1' });
  const a = lastAudit(db);
  check('a refusal is audited too, with the reason', a.result === 'refused'
    && /why/.test(JSON.stringify(a.detail || {})), JSON.stringify(a));
}
/* NO ACTION IS PERFORMED WITHOUT ITS RECORD. A write that lands with nothing
   saying who did it is the one thing an operator page must never produce. */
{
  const db = seed();
  const actions = [
    { action: 'help_resume', user_id: 'u1' },
    { action: 'issue_assign', id: 1, assignee: 'kris' },
    { action: 'marketing_set', user_id: 'u1', opted_in: false },
    { action: 'budget_set', scope: 'paid_period', warn_usd: 8 }
  ];
  for (const a of actions) await press(db, a);
  check('every action taken left an audit row',
    audits(db).length === actions.length, String(audits(db).length));
  check('and every one of them names the admin',
    audits(db).every(a => a.admin_id === 'k1'));
}

const bad = out.filter(r => !r.ok).length;
console.log('\n' + (out.length - bad) + ' of ' + out.length + ' passed');
if (bad) { console.log('\nFAILED:'); out.filter(r => !r.ok).forEach(r => console.log('  ' + r.n)); }
process.exit(bad ? 1 : 0);
