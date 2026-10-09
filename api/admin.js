// ============================================================================
// THE OPERATOR'S REPORTING ENDPOINT.
//
// Rebuilt 9 October 2026. The old one answered a single enormous object and
// several of its figures were wrong in ways nobody could see from the screen.
// What follows is the same data read properly, split by view so each screen
// asks for what it shows.
//
// FIVE RULES, AND EVERY DEFECT IN THE OLD VERSION BROKE ONE OF THEM.
//
// 1. A FIGURE CARRIES ITS WINDOW AND ITS POPULATION. The old tiles mixed a
//    thirty-day cost with an all-time milestone and a status as of right now,
//    sitting side by side as though they described the same thing. Every
//    number below says which period it covers and who is counted.
//
// 2. MISSING IS NOT ZERO. Every query's error is kept and reported. A
//    database that did not answer used to become a confident 0, which is the
//    worst possible failure on a page whose whole job is telling you whether
//    something is wrong.
//
// 3. A SEQUENCE MEANS THE SAME PEOPLE, IN ORDER. The old funnel counted each
//    stage independently and printed a percentage between them, so somebody
//    who subscribed without ever starting a project still appeared to have
//    passed through every step before it.
//
// 4. NOTHING HERE READS A WRITER'S WORK. Not a card, note, outline, title or
//    filename. `card_count` is maintained by a trigger so counting never
//    needs the text, and the project select below names its columns for
//    exactly that reason.
//
// 5. NOTHING HERE CHANGES THE ACCOUNT BEING LOOKED AT. requireUser is called
//    once, for the operator. Reading somebody else's profile is a plain
//    select, because requireUser rolls credit periods and touches last_seen,
//    and inspecting an account must never be the thing that alters it.
// ============================================================================
import { requireUser, send, PLANS, entitlement,
         PRICE_MONTH, PRICE_YEAR, TOPUP_CREDITS, TOPUP_PRICE,
         COST } from './_lib/core.js';

import handleAdminAction from './_admin-do.js';

const DAY = 86400000;
const PAGE = 1000;

/* -------------------------------------------------------------------------
   READING A WHOLE TABLE WITHOUT TRUNCATING IT.

   The old version put `.limit(500)` on profiles and `.limit(5000)` on events
   and reported whatever came back as the total. At eleven accounts that is
   invisible and correct; at six hundred it is a page quietly describing the
   first five hundred and calling it everybody.

   `truncated` is returned rather than hidden, so a view can say so instead of
   printing a smaller number with confidence.
   ------------------------------------------------------------------------- */
async function readAll(db, build, cap = 20000) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    // An error is returned, never swallowed. See rule 2.
    if (error) return { rows, error: error.message || 'query failed', truncated: false };
    const got = data || [];
    rows.push(...got);
    if (got.length < PAGE) return { rows, error: null, truncated: false };
    from += PAGE;
    if (rows.length >= cap) return { rows, error: null, truncated: true };
  }
}

/* Every figure on every screen is one of these, so a view can print a number
   and the state of the number in the same breath. */
const figure = (value, meta) => Object.assign({ value }, meta || {});
const unavailable = why => ({ value: null, unavailable: why || 'not available' });

/* -------------------------------------------------------------------------
   WHO IS COUNTED.

   `internal` is Kris's own accounts and any QA account. They are excluded
   from every customer figure and reported separately rather than hidden,
   because the provider bill is real money whoever spent it.
   ------------------------------------------------------------------------- */
const isInternal = p => !!(p.is_internal || p.is_admin || p.is_unlimited);

export default async function handler(req, res) {
  // One deployed function; the action handler retains its own authorization and audit rules.
  if (req.method === 'POST') return handleAdminAction(req, res);
  if (req.method && req.method !== 'GET') return send(res, 405, { error: 'method' });
  // ONE call, for the operator. Never for the account being inspected.
  const auth = await requireUser(req);
  if (auth.error) return send(res, auth.status, { error: auth.error });
  const { db, user, profile } = auth;
  if (!profile.is_admin) return send(res, 403, { error: 'not_admin' });

  const view = String(req.query?.view || 'overview');
  const days = Math.min(365, Math.max(1, Number(req.query?.days) || 30));
  const since = new Date(Date.now() - days * DAY).toISOString();
  const population = String(req.query?.who || 'customers');  // customers | internal | all

  /* WHEN THE RECORDS START. Anything before this date is not quiet, it is
     unrecorded, and a chart that does not say so is a chart that lies by
     omission. */
  let trackingStart = null;
  try {
    const { data } = await db.from('operator_meta')
      .select('value').eq('key', 'tracking_started_at').maybeSingle();
    trackingStart = data ? data.value : null;
  } catch (e) { /* the table may not exist yet; the views say so */ }

  const base = {
    view, window_days: days, since, population,
    tracking_started_at: trackingStart,
    generated_at: new Date().toISOString()
  };

  try {
    if (view === 'overview') return send(res, 200, Object.assign(base, await overview(db, since, days)));
    if (view === 'issues')   return send(res, 200, Object.assign(base, await issues(db, since)));
    if (view === 'writers')  return send(res, 200, Object.assign(base, await writers(db, since, population)));
    if (view === 'product')  return send(res, 200, Object.assign(base, await product(db, since, days)));
    if (view === 'money')    return send(res, 200, Object.assign(base, await money(db, since)));
    if (view === 'system')   return send(res, 200, Object.assign(base, await system(db)));
    if (view === 'account')  return send(res, 200, Object.assign(base, await account(db, String(req.query?.id || ''))));
    if (view === 'issue')    return send(res, 200, Object.assign(base, await issue(db, String(req.query?.id || ''))));
    return send(res, 400, { error: 'unknown_view' });
  } catch (e) {
    /* A view that threw is reported as a view that threw. The old page showed
       "This page is for the account owner" for every failure, so a broken
       query and a signed-out session looked identical and the first was
       always read as the second. */
    console.error('admin view failed', view, e);
    return send(res, 500, { error: 'view_failed', view,
      message: 'This section could not be built. The rest of the page is unaffected.' });
  }
}

/* ===========================================================================
   OVERVIEW. What is the state of Beatfall, in about ten seconds.
   =========================================================================== */
async function overview(db, since, days) {
  const people = await readAll(db, () => db.from('profiles')
    .select('id, email, is_admin, is_internal, is_unlimited, plan, subscription_status, '
          + 'created_at, last_seen_at, trial_ends_at, current_period_end, '
          + 'cancel_at_period_end, period_start, credits_used, credits_extra, '
          + 'onboarding_choice, first_real_project_at, first_meaningful_board_at, account_tag')
    .order('created_at', { ascending: false }));

  const use = await readAll(db, () => db.from('usage')
    .select('user_id, kind, credits, cost_micros, created_at, status')
    .gte('created_at', since));

  /* WRITERS WORKING IS NOT WRITING-HELP USAGE.
     The old "used it in 30d" counted accounts with a row in `usage`, which is
     only the metered features. A writer who spent a fortnight typing cards,
     filing notes and writing an outline used Beatfall every day and appeared
     in that tile as somebody who had not touched it. `work_days` records a
     day on which they CHANGED something, which is the honest measure. */
  const work = await readAll(db, () => db.from('work_days')
    .select('user_id, day').gte('day', since.slice(0, 10)));

  const alerts = await readAll(db, () => db.from('alerts')
    .select('id, kind, level, summary, detail, created_at, delivered_at, delivery_error, acknowledged_at, attempts')
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false }), 200);

  const open = await readAll(db, () => db.from('admin_issues')
    .select('id, title, severity, status, occurrences, accounts, last_seen_at, first_seen_at')
    .neq('status', 'resolved')
    .order('last_seen_at', { ascending: false }), 200);

  const budgetRows = await readAll(db, () => db.from('budgets').select('scope, warn_micros, urgent_micros'), 50);
  const alertSetup = [
    !process.env.RESEND_API_KEY && 'RESEND_API_KEY is missing',
    !process.env.MAIL_FROM && 'MAIL_FROM is missing',
    !process.env.ALERT_TO && 'ALERT_TO is missing',
    !process.env.SITE_URL && 'SITE_URL is missing',
    !budgetRows.rows.some(b => b.scope === 'paid_period' && b.warn_micros && b.urgent_micros)
      && 'Subscriber alert figures are not set',
    alerts.error, budgetRows.error
  ].filter(Boolean);

  const rows = people.rows || [];
  const ext = rows.filter(p => !isInternal(p));
  const mine = rows.filter(isInternal);
  const idsOf = list => new Set(list.map(p => p.id));
  const extIds = idsOf(ext), mineIds = idsOf(mine);

  const costOf = ids => (use.rows || [])
    .filter(u => ids.has(u.user_id))
    .reduce((n, u) => n + Number(u.cost_micros || 0), 0);

  const workedIds = new Set((work.rows || []).map(w => w.user_id));
  const trialing = p => p.subscription_status === 'trialing' || p.plan === 'trial';
  const paying = p => ['active', 'past_due'].includes(p.subscription_status || '');

  const err = people.error || use.error || work.error;

  return {
    /* SERVICE HEALTH. Only ever says healthy when the check actually ran. The
       absence of failures is not evidence of health if the thing that records
       failures is the thing that is down. */
    health: {
      records: people.error ? { state: 'unknown', why: people.error }
             : { state: 'ok', checked_at: new Date().toISOString() },
      costs: use.error ? { state: 'unknown', why: use.error }
           : { state: 'ok', checked_at: new Date().toISOString() },
      work: work.error ? { state: 'unknown', why: work.error }
          : { state: 'ok', checked_at: new Date().toISOString() },
      alerts: alertSetup.length ? { state: 'unknown', why: alertSetup.join('. ') }
            : { state: 'ok', checked_at: new Date().toISOString() },
      // Delivery that failed is its own kind of unhealthy: the page knows
      // something and could not tell anybody.
      undelivered: (alerts.rows || []).filter(a => !a.delivered_at && a.delivery_error).length
    },

    attention: [
      ...(open.rows || []).slice(0, 8).map(i => ({
        kind: 'issue', id: i.id, severity: i.severity, title: i.title,
        detail: i.occurrences + ' time' + (i.occurrences === 1 ? '' : 's')
          + (i.accounts ? ' affecting ' + i.accounts + ' account' + (i.accounts === 1 ? '' : 's') : ''),
        first_seen_at: i.first_seen_at, last_seen_at: i.last_seen_at,
        next: 'Open this issue', link: '#issue=' + i.id
      })),
      ...(alerts.rows || []).slice(0, 8).map(a => ({
        kind: 'alert', id: a.id, severity: a.level, title: a.summary,
        detail: a.delivered_at ? 'Sent to you'
          : a.delivery_error ? 'Not delivered: ' + a.delivery_error : 'Not sent yet',
        first_seen_at: a.created_at, last_seen_at: a.created_at,
        next: 'Open this account', link: (a.detail && a.detail.link) || '#alerts'
      }))
    ],

    /* Everything below is a figure with its window and its population on it,
       so two of them sitting side by side can honestly be compared. */
    working: {
      window_days: days, population: 'customers',
      total: figure([...workedIds].filter(id => extIds.has(id)).length,
        { means: 'saved work on at least one day in this period' }),
      trial: figure(ext.filter(p => trialing(p) && workedIds.has(p.id)).length, {}),
      paid:  figure(ext.filter(p => paying(p)  && workedIds.has(p.id)).length, {}),
      // Said apart, because it is a different question: how many used the
      // metered help, rather than how many worked.
      used_writing_help: figure(
        new Set((use.rows || []).filter(u => extIds.has(u.user_id) && Number(u.credits) > 0).map(u => u.user_id)).size,
        { means: 'used a feature that spends credits' })
    },

    starting: {
      window_days: days, population: 'customers',
      signed_up: figure(ext.filter(p => p.created_at >= since).length, {}),
      // All-time milestones, labelled as such rather than printed beside a
      // thirty-day figure as though they matched.
      own_project_ever: figure(ext.filter(p => p.first_real_project_at).length,
        { window: 'all time' }),
      organised_ever: figure(ext.filter(p => p.first_meaningful_board_at).length,
        { window: 'all time',
          means: 'five or more items on a project of their own. A provisional marker, not a finished board.' })
    },

    subscriptions: {
      population: 'customers', window: 'right now',
      subscribers: figure(ext.filter(paying).length, {}),
      trialing: figure(ext.filter(trialing).length, {}),
      scheduled_to_cancel: figure(ext.filter(p => p.cancel_at_period_end).length, {}),
      ended: figure(ext.filter(p => p.subscription_status === 'canceled').length, {}),
      payment_trouble: figure(ext.filter(p => p.subscription_status === 'past_due').length, {})
    },

    spend: {
      window_days: days,
      customers_usd: figure(costOf(extIds) / 1e6, { population: 'customers' }),
      trials_usd: figure(
        (use.rows || []).filter(u => ext.some(p => p.id === u.user_id && trialing(p)))
          .reduce((n, u) => n + Number(u.cost_micros || 0), 0) / 1e6,
        { population: 'trial accounts' }),
      internal_usd: figure(costOf(mineIds) / 1e6, { population: 'your own accounts' }),
      calls: figure((use.rows || []).filter(u => extIds.has(u.user_id)).length,
        { population: 'customers' })
    },

    internal: { accounts: mine.length },
    errors: err ? [err] : [],
    truncated: !!(people.truncated || use.truncated)
  };
}

/* ===========================================================================
   ISSUES. The same failure seen twelve times is one thing to fix.
   =========================================================================== */
async function issues(db, since) {
  const list = await readAll(db, () => db.from('admin_issues')
    .select('*').order('last_seen_at', { ascending: false }), 500);

  // The cost side is read from `usage` rather than summed onto the issue row,
  // because that is the table the money reconciles against.
  const linked = await readAll(db, () => db.from('usage')
    .select('issue_id, user_id, credits, cost_micros, created_at, status')
    .not('issue_id', 'is', null).gte('created_at', since), 20000);

  const byIssue = {};
  (linked.rows || []).forEach(u => {
    const r = byIssue[u.issue_id] = byIssue[u.issue_id]
      || { accounts: new Set(), credits: 0, cost_micros: 0, occurrences: 0 };
    r.accounts.add(u.user_id);
    r.credits += Number(u.credits || 0);
    r.cost_micros += Number(u.cost_micros || 0);
    r.occurrences += 1;
  });

  return {
    issues: (list.rows || []).map(i => Object.assign({}, i, {
      accounts_in_window: byIssue[i.id] ? byIssue[i.id].accounts.size : 0,
      credits_in_window: byIssue[i.id] ? byIssue[i.id].credits : 0,
      cost_usd_in_window: byIssue[i.id] ? byIssue[i.id].cost_micros / 1e6 : 0,
      occurrences_in_window: byIssue[i.id] ? byIssue[i.id].occurrences : 0
    })),
    /* NEVER CLOSED JUST BECAUSE IT WENT QUIET. An issue with no recent
       occurrence might be fixed, or the thing that records it might be
       broken. The view says which it cannot tell. */
    note: 'An issue with no recent occurrences has not been closed automatically. '
        + 'Quiet is not the same as fixed.',
    errors: [list.error, linked.error].filter(Boolean)
  };
}

/* ===========================================================================
   ONE ISSUE, FAR ENOUGH TO ACT ON.

   The list screen answers "what is broken". This answers the next three
   questions, which are the ones that actually take work: who did it happen
   to, what did it cost them, and what has anybody already written down about
   it. A row count with no way through to those is a screen that reports a
   problem and then makes you go and find it in the database.

   NO WINDOW ON THIS ONE, deliberately. An issue is a thing rather than a
   period, and reading an issue through a thirty-day filter is how the two
   occurrences that explain it end up outside the view.
   =========================================================================== */
async function issue(db, id) {
  const n = Number(id);
  if (!n) return { error: 'no issue named' };

  const { data: row, error } = await db.from('admin_issues')
    .select('*').eq('id', n).maybeSingle();
  if (error) return { errors: [error.message] };
  if (!row) return { error: 'no such issue' };

  const [notes, hits, cases] = await Promise.all([
    readAll(db, () => db.from('admin_issue_notes').select('*')
      .eq('issue_id', n).order('created_at', { ascending: false }), 500),
    readAll(db, () => db.from('usage')
      .select('user_id, kind, stage, credits, cost_micros, created_at, status, '
            + 'error_code, duration_ms, deploy, request_id, session_id')
      .eq('issue_id', n).order('created_at', { ascending: false }), 5000),
    readAll(db, () => db.from('support_cases').select('*')
      .eq('issue_id', n).order('created_at', { ascending: false }), 100)
  ]);

  /* WHO IT HAPPENED TO, grouped, because eleven rows from one account and
     eleven from eleven accounts are the same row count and completely
     different news. The email is read here rather than on every usage row so
     one account appears once. */
  const by = {};
  (hits.rows || []).forEach(u => {
    const a = by[u.user_id] = by[u.user_id]
      || { id: u.user_id, times: 0, credits: 0, cost_micros: 0, last_at: null };
    a.times += 1;
    a.credits += Number(u.credits || 0);
    a.cost_micros += Number(u.cost_micros || 0);
    if (!a.last_at || u.created_at > a.last_at) a.last_at = u.created_at;
  });

  const ids = Object.keys(by);
  if (ids.length) {
    const { data: who } = await db.from('profiles')
      .select('id, email, account_tag, is_admin, is_internal, is_unlimited')
      .in('id', ids);
    (who || []).forEach(p => {
      if (!by[p.id]) return;
      by[p.id].email = p.email;
      by[p.id].tag = p.account_tag;
      by[p.id].internal = isInternal(p);
    });
  }

  return {
    issue: row,
    notes: notes.rows,
    cases: cases.rows,
    /* THE SAMPLE IS CAPPED AND SAYS SO. Twenty is enough to see a pattern and
       the figures above it are computed from all of them, so the cap narrows
       what is shown and never what is counted. */
    occurrences: (hits.rows || []).slice(0, 20),
    occurrences_total: (hits.rows || []).length,
    accounts: Object.values(by).map(a => Object.assign(a, {
      cost_usd: a.cost_micros / 1e6
    })).sort((x, y) => y.times - x.times),
    /* Credits charged against credits returned, side by side, because an
       issue that charged somebody and never gave it back is a different
       problem from one that failed for free. */
    money: {
      credits_charged: row.credits_charged,
      credits_refunded: row.credits_refunded,
      cost_usd: (row.cost_micros || 0) / 1e6,
      note: (row.credits_charged || 0) > (row.credits_refunded || 0)
        ? 'More credits were charged against this than were returned. That may '
        + 'be correct, because a call that half worked was still paid for, but '
        + 'it is the thing to check before closing it.'
        : 'Every credit charged against this has been returned.'
    },
    errors: [notes.error, hits.error, cases.error].filter(Boolean)
  };
}

/* ===========================================================================
   WRITERS. One row per account, and everything needed to help one of them.
   =========================================================================== */
async function writers(db, since, population) {
  const people = await readAll(db, () => db.from('profiles')
    .select('*').order('created_at', { ascending: false }));
  const use = await readAll(db, () => db.from('usage')
    .select('user_id, kind, credits, cost_micros, created_at, status')
    .gte('created_at', since));
  // Deliberately NOT 'cards'. See rule 4.
  const projects = await readAll(db, () => db.from('projects')
    .select('user_id, card_count, updated_at, is_sample'));
  const work = await readAll(db, () => db.from('work_days').select('user_id, day'));

  const byUser = {};
  const ensure = id => (byUser[id] = byUser[id] || {
    calls: 0, failed: 0, credits: 0, cost_micros: 0, kinds: {},
    projects: 0, real_projects: 0, cards: 0, real_cards: 0, work_days: 0,
    last_worked: null
  });
  (use.rows || []).forEach(u => {
    const r = ensure(u.user_id);
    r.calls += 1;
    if (u.status && u.status !== 'ok') r.failed += 1;
    r.credits += Number(u.credits || 0);
    r.cost_micros += Number(u.cost_micros || 0);
    r.kinds[u.kind] = (r.kinds[u.kind] || 0) + 1;
  });
  (projects.rows || []).forEach(p => {
    const r = ensure(p.user_id);
    r.projects += 1; r.cards += Number(p.card_count || 0);
    if (!p.is_sample) { r.real_projects += 1; r.real_cards += Number(p.card_count || 0); }
  });
  (work.rows || []).forEach(w => {
    const r = ensure(w.user_id);
    r.work_days += 1;
    if (!r.last_worked || w.day > r.last_worked) r.last_worked = w.day;
  });

  let rows = (people.rows || []).map(p => {
    const u = byUser[p.id] || ensure(p.id);
    const ent = entitlement(p);
    return {
      id: p.id, email: p.email, name: p.display_name,
      tag: p.account_tag || null,
      internal: isInternal(p), owner: !!p.is_unlimited, admin: !!p.is_admin,
      plan: ent.key, status: p.subscription_status,
      trial_ends_at: p.trial_ends_at,
      renews_at: p.current_period_end, cancelling: !!p.cancel_at_period_end,
      created_at: p.created_at, last_seen_at: p.last_seen_at,
      /* LAST SEEN IS NOT LAST WORKED, and the old page used the first to mean
         the second. Opening a tab touches last_seen_at; changing something
         writes a work day. Both are shown because they answer different
         questions. */
      last_worked: u.last_worked, work_days: u.work_days,
      onboarding_choice: p.onboarding_choice,
      first_real_project_at: p.first_real_project_at,
      first_meaningful_board_at: p.first_meaningful_board_at,
      first_touch: p.first_touch || null, last_touch: p.last_touch || null,
      cancel_reason: p.cancel_reason || null,
      marketing_opt_in: !!p.marketing_opt_in,
      help_paused_at: p.help_paused_at || null,
      /* CREDITS AGAINST THE PERIOD THEY BELONG TO. The old page showed credits
         spent over whatever window was selected next to ONE month's
         allowance, so ninety days of use read as three times over budget. */
      allowance: ent.monthly, credits_used_this_period: p.credits_used,
      credits_banked: p.credits_extra, period_start: p.period_start,
      credits_in_window: u.credits,
      projects: u.real_projects, cards: u.real_cards,
      calls: u.calls, failed_calls: u.failed,
      cost_usd: u.cost_micros / 1e6, kinds: u.kinds
    };
  });

  if (population === 'customers') rows = rows.filter(r => !r.internal);
  if (population === 'internal')  rows = rows.filter(r => r.internal);

  return {
    writers: rows,
    counts: { all: (people.rows || []).length, shown: rows.length },
    errors: [people.error, use.error, projects.error, work.error].filter(Boolean),
    truncated: !!(people.truncated || use.truncated || projects.truncated)
  };
}

/* ===========================================================================
   ONE ACCOUNT, in full. Read only, and it never touches the row it reads.
   =========================================================================== */
async function account(db, id) {
  if (!id) return { error: 'no account named' };
  // A plain select. NOT requireUser, which rolls the credit period and
  // touches last_seen: inspecting an account must not change it. See rule 5.
  const { data: p, error } = await db.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) return { errors: [error.message] };
  if (!p) return { error: 'no such account' };

  const [led, pay, use, cases] = await Promise.all([
    readAll(db, () => db.from('credit_ledger').select('*').eq('user_id', id)
      .order('created_at', { ascending: false }), 500),
    readAll(db, () => db.from('payments').select('*').eq('user_id', id)
      .order('created_at', { ascending: false }), 500),
    readAll(db, () => db.from('usage')
      .select('kind, credits, cost_micros, created_at, status, error_code, session_id, issue_id')
      .eq('user_id', id).order('created_at', { ascending: false }), 20000),
    readAll(db, () => db.from('support_cases').select('*').eq('user_id', id)
      .order('created_at', { ascending: false }), 100)
  ]);

  const ent = entitlement(p);
  return {
    account: {
      id: p.id, email: p.email, name: p.display_name, tag: p.account_tag,
      internal: isInternal(p), plan: ent.key, status: p.subscription_status,
      created_at: p.created_at, last_seen_at: p.last_seen_at,
      trial_ends_at: p.trial_ends_at, renews_at: p.current_period_end,
      cancelling: !!p.cancel_at_period_end, cancel_reason: p.cancel_reason,
      allowance: ent.monthly, credits_used_this_period: p.credits_used,
      credits_banked: p.credits_extra, period_start: p.period_start,
      marketing_opt_in: !!p.marketing_opt_in,
      help_paused_at: p.help_paused_at, help_pause_reason: p.help_pause_reason,
      first_touch: p.first_touch, last_touch: p.last_touch
    },
    ledger: led.rows, payments: pay.rows, usage: use.rows, cases: cases.rows,
    truncated: !!(led.truncated || pay.truncated || use.truncated || cases.truncated),
    errors: [led.error, pay.error, use.error, cases.error].filter(Boolean)
  };
}

/* ===========================================================================
   PRODUCT USE. The journey, return, starting options, sources, features.
   =========================================================================== */
async function product(db, since, days) {
  const people = await readAll(db, () => db.from('profiles')
    .select('id, created_at, last_seen_at, is_admin, is_internal, is_unlimited, '
          + 'onboarding_choice, first_real_project_at, first_meaningful_board_at, '
          + 'subscription_status, first_touch'));
  const work = await readAll(db, () => db.from('work_days').select('user_id, day'));
  const events = await readAll(db, () => db.from('events')
    .select('user_id, name, created_at').gte('created_at', since), 50000);

  const ext = (people.rows || []).filter(p => !isInternal(p));
  const workBy = {};
  (work.rows || []).forEach(w => (workBy[w.user_id] = workBy[w.user_id] || []).push(w.day));

  /* THE JOURNEY, AS A REAL SEQUENCE.
     Each stage counts only people who met EVERY stage before it. The old one
     counted each independently, so somebody who subscribed without ever
     starting a project was counted at the bottom of a funnel they had never
     entered, and the percentages between stages described nothing. */
  let cohort = ext;
  const journey = [];
  const stage = (label, test, means) => {
    const before = cohort.length;
    cohort = cohort.filter(test);
    journey.push({
      label, n: cohort.length, of: before,
      from_prev: before ? Math.round(cohort.length / before * 100) : null,
      means
    });
  };
  stage('Account created', () => true, 'every customer account');
  stage('Started their own project', p => !!p.first_real_project_at,
    'a project that is not the sample');
  stage('Organised their own material', p => !!p.first_meaningful_board_at,
    'five or more items on it. A provisional marker, not a finished board.');
  stage('Came back and worked again', p => (workBy[p.id] || []).length >= 2,
    'saved work on two or more separate days');
  stage('Subscribing', p => ['active', 'past_due'].includes(p.subscription_status || ''),
    'paying right now');

  /* RETURN, MEASURED IN DAYS WORKED, NOT IN last_seen_at.
     The old page subtracted signup from last_seen and called seven days
     "returned after D7", using a six-day threshold to do it. Both halves were
     wrong: opening a tab is not returning to work, and six is not seven.

     ELIGIBILITY IS EXPLICIT. An account three days old cannot have failed to
     return in fourteen, so it is not counted in that window at all. The
     denominator is on every row. */
  const windowReturn = n => {
    const eligible = ext.filter(p => Date.now() - new Date(p.created_at) >= n * DAY);
    const came = eligible.filter(p => (workBy[p.id] || []).some(d => {
      const gap = new Date(d + 'T00:00:00Z') - new Date(p.created_at);
      return gap >= DAY && gap <= n * DAY;
    }));
    return { window_days: n, eligible: eligible.length, returned: came.length,
      means: 'worked again at least once between the day after signing up and day ' + n };
  };

  /* STARTING OPTIONS. Sample sizes are on every row because four people is
     not evidence and a percentage over four people looks exactly like one
     over four hundred. */
  const PATHS = [['import', 'Started from notes'], ['new_project', 'Started an empty project'],
                 ['sample', 'Explored the sample']];
  const by_path = PATHS.map(([key, label]) => {
    const g = ext.filter(p => p.onboarding_choice === key);
    return { key, label, users: g.length,
      organised: g.filter(p => p.first_meaningful_board_at).length,
      returned: g.filter(p => (workBy[p.id] || []).length >= 2).length,
      paid: g.filter(p => ['active', 'past_due'].includes(p.subscription_status || '')).length,
      too_small: g.length < 10 };
  });
  const noChoice = ext.filter(p => !p.onboarding_choice);
  by_path.push({ key: 'none', label: 'No starting choice recorded', users: noChoice.length,
    organised: noChoice.filter(p => p.first_meaningful_board_at).length,
    returned: noChoice.filter(p => (workBy[p.id] || []).length >= 2).length,
    paid: noChoice.filter(p => ['active', 'past_due'].includes(p.subscription_status || '')).length,
    too_small: noChoice.length < 10 });

  /* SOURCES. Unknown attribution stays unknown. Treating a missing referrer
     as confirmed direct traffic is how a channel report flatters whichever
     channel happens not to tag its links. */
  const bySource = {};
  ext.forEach(p => {
    const t = p.first_touch || {};
    const key = t.source || t.ref || t.referrer || (p.first_touch ? 'direct' : 'unknown');
    const s = bySource[key] = bySource[key] || { key, users: 0, organised: 0, paid: 0 };
    s.users += 1;
    if (p.first_meaningful_board_at) s.organised += 1;
    if (['active', 'past_due'].includes(p.subscription_status || '')) s.paid += 1;
  });

  /* FEATURES. Start, finish and failure counted separately, because a feature
     that is started a hundred times and finished twice is not a popular
     feature. */
  const customerIds = new Set(ext.map(p => p.id));
  const count = name => (events.rows || []).filter(e =>
    customerIds.has(e.user_id) && e.name === name).length;
  const features = [
    { key: 'import', label: 'Reading notes',
      started: count('import_started'), finished: count('import_completed'),
      failed: count('import_failed') },
    { key: 'conversation', label: 'Beat conversations',
      started: count('ask_missing_used'), finished: null, failed: null },
    { key: 'character', label: 'Character interviews',
      started: count('character_interview_started'), finished: count('character_filled'),
      failed: null },
    { key: 'export', label: 'Downloads', started: count('export_used'),
      finished: null, failed: null },
    { key: 'phone', label: 'Phone capture', started: count('phone_notes_offered'),
      finished: count('phone_pictures_placed'), failed: null }
  ];

  return {
    journey, returning: [windowReturn(7), windowReturn(14), windowReturn(30)],
    by_path, sources: Object.values(bySource).sort((a, b) => b.users - a.users),
    features,
    note: 'Writers leave Beatfall to go and write. A quiet week is not a lost account, '
        + 'which is why return is measured in weeks rather than days.',
    errors: [people.error, work.error, events.error].filter(Boolean),
    truncated: !!(people.truncated || events.truncated)
  };
}

/* ===========================================================================
   MONEY. Cash, recurring, costs, and the things that do not reconcile.
   =========================================================================== */
async function money(db, since) {
  const pay = await readAll(db, () => db.from('payments').select('*')
    .gte('created_at', since).order('created_at', { ascending: false }), 10000);
  const led = await readAll(db, () => db.from('credit_ledger')
    .select('kind, credits, bucket, created_at').gte('created_at', since), 20000);
  const use = await readAll(db, () => db.from('usage')
    .select('user_id, kind, cost_micros, status, session_id, created_at')
    .gte('created_at', since), 50000);
  const people = await readAll(db, () => db.from('profiles')
    .select('id, is_admin, is_internal, is_unlimited, plan, subscription_status'));
  const budgets = await readAll(db, () => db.from('budgets').select('*'), 50);

  const rows = pay.rows || [];
  const cents = f => rows.filter(f).reduce((n, r) => n + Number(r.amount_cents || 0), 0);
  const ext = new Set((people.rows || []).filter(p => !isInternal(p)).map(p => p.id));
  const trials = new Set((people.rows || []).filter(p =>
    !isInternal(p) && (p.plan === 'trial' || p.subscription_status === 'trialing')).map(p => p.id));
  const mine = new Set((people.rows || []).filter(isInternal).map(p => p.id));
  const cost = ids => (use.rows || []).filter(u => ids.has(u.user_id))
    .reduce((n, u) => n + Number(u.cost_micros || 0), 0) / 1e6;

  /* KEPT APART ON PURPOSE. Cash collected, recurring revenue and an annual
     payment are three different things and the old page had none of them.
     Revenue less provider cost is NOT labelled profit anywhere: it ignores
     Stripe's fee, hosting, and every hour of work. */
  const monthly = rows.filter(r => r.kind === 'subscription' && r.bill_interval === 'month');
  const annual  = rows.filter(r => r.kind === 'subscription' && r.bill_interval === 'year');

  /* THE EVIDENCE FOR A CUTOFF, which Kris asked to see before approving one.
     The most expensive single ACTION observed, per feature, measured the same
     way a cutoff would measure it: by session, which is what an action is. */
  const bySession = {};
  (use.rows || []).forEach(u => {
    if (!u.session_id) return;
    const s = bySession[u.session_id] = bySession[u.session_id]
      || { kind: u.kind, micros: 0, calls: 0 };
    s.micros += Number(u.cost_micros || 0);
    s.calls += 1;
  });
  const perKind = {};
  Object.values(bySession).forEach(s => {
    const k = perKind[s.kind] = perKind[s.kind] || { kind: s.kind, sessions: 0, max: 0, total: 0, max_calls: 0 };
    k.sessions += 1; k.total += s.micros;
    if (s.micros > k.max) { k.max = s.micros; k.max_calls = s.calls; }
  });
  const proposedStop = (budgets.rows || []).find(b => b.scope === 'single_action');
  const largest = Object.values(perKind).map(k => ({
    feature: k.kind, actions: k.sessions,
    most_expensive_usd: k.max / 1e6, calls_in_that_one: k.max_calls,
    average_usd: k.sessions ? (k.total / k.sessions) / 1e6 : 0,
    would_have_been_stopped: proposedStop && proposedStop.stop_micros
      ? Object.values(bySession).filter(s => s.kind === k.kind
          && s.micros >= proposedStop.stop_micros).length
      : null
  })).sort((a, b) => b.most_expensive_usd - a.most_expensive_usd);

  return {
    collected: {
      window: 'selected period',
      subscriptions_usd: cents(r => r.kind === 'subscription') / 100,
      packs_usd: cents(r => r.kind === 'topup') / 100,
      refunds_usd: cents(r => r.kind === 'refund') / 100,
      failed_usd: cents(r => r.kind === 'failure') / 100,
      note: 'Money that actually arrived, from the payment records. Not a status.'
    },
    recurring: {
      monthly_payments: monthly.length,
      annual_payments: annual.length,
      note: 'An annual payment is cash today and twelve months of service. It is '
          + 'counted here as one payment and is not spread across the months, '
          + 'because nothing in this product books deferred revenue yet.'
    },
    costs: {
      customers_usd: cost(ext), trials_usd: cost(trials), internal_usd: cost(mine),
      note: 'Provider cost only. Revenue less this is not profit: it ignores card '
          + 'fees, hosting and every hour of work.'
    },
    credits: {
      charged: (led.rows || []).filter(r => r.kind === 'charge')
        .reduce((n, r) => n + Math.abs(r.credits), 0),
      refunded: (led.rows || []).filter(r => r.kind === 'refund')
        .reduce((n, r) => n + r.credits, 0),
      purchased: (led.rows || []).filter(r => r.kind === 'purchase')
        .reduce((n, r) => n + r.credits, 0)
    },
    /* RECONCILIATION. Calls whose outcome nobody ever learned, and work that
       was reserved and never settled. Both are states where the money is
       genuinely unknown, and both used to be invisible. */
    reconcile: {
      unknown_outcome: (use.rows || []).filter(u => u.status === 'unknown').length,
      failed_but_recorded: (use.rows || []).filter(u => u.status === 'failed').length,
      note: 'A call whose answer never came back may still have been billed by the '
          + 'provider. These are counted, never assumed either way.'
    },
    largest_actions: largest,
    budgets: budgets.rows || [],
    pricing: { month: PRICE_MONTH, year: PRICE_YEAR,
               topup_credits: TOPUP_CREDITS, topup_price: TOPUP_PRICE,
               per_action: COST },
    plans: PLANS,
    errors: [pay.error, led.error, use.error, people.error, budgets.error].filter(Boolean)
  };
}

/* ===========================================================================
   SYSTEM. What is configured, what is recorded, what is not.
   =========================================================================== */
async function system(db) {
  const holds = await readAll(db, () => db.from('budget_holds')
    .select('id, state, created_at').eq('state', 'held'), 500);
  const alerts = await readAll(db, () => db.from('alerts')
    .select('id, delivered_at, delivery_error, attempts, created_at')
    .order('created_at', { ascending: false }), 500);

  return {
    stripe: {
      configured: !!process.env.STRIPE_SECRET_KEY,
      live: String(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live_'),
      note: 'Read off the key prefix, never written down. No part of the key is returned.'
    },
    mail: {
      configured: !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM),
      alerts_to_set: !!process.env.ALERT_TO,
      missing: ['RESEND_API_KEY', 'MAIL_FROM', 'ALERT_TO', 'SITE_URL'].filter(k => !process.env[k]),
      undelivered: alerts.error ? null : (alerts.rows || []).filter(a => !a.delivered_at).length,
      gave_up: alerts.error ? null : (alerts.rows || []).filter(a => /gave up/.test(a.delivery_error || '')).length
    },
    deploy: process.env.VERCEL_GIT_COMMIT_SHA
      ? String(process.env.VERCEL_GIT_COMMIT_SHA).slice(0, 7) : null,
    /* A HOLD THAT HAS BEEN OPEN FOR HOURS IS NOT WORK IN PROGRESS. It is a
       request that went away without settling, and it is counted against
       every ceiling until somebody looks at it. */
    stuck_holds: (holds.rows || []).filter(h =>
      Date.now() - new Date(h.created_at) > 3600000).length,
    open_holds: (holds.rows || []).length,
    errors: [holds.error, alerts.error].filter(Boolean)
  };
}
