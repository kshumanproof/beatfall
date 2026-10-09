// ============================================================================
// The operator's records: the credit ledger, the revenue ledger, issues,
// alerts, budget holds and the audit history.
//
// This file is only the WRITING side. Nothing here reads for the dashboard,
// and nothing here decides anything: a budget is enforced in one place, in
// api/claude.js, where the work it would stop actually happens.
//
// THREE RULES, AND THEY ARE WHY THIS IS A SEPARATE FILE.
//
// 1. NO WRITER'S WORK GETS IN HERE. No card, note, outline, title, filename,
//    prompt or provider response, and no raw error text, because an error can
//    quote the sentence that caused it. `signature()` and `safeCode()` below
//    are the two places that enforce it, and every write goes through them.
//
// 2. A FAILED WRITE IS LOUD. These records exist so money can be accounted
//    for. A dropped row in `events` costs nothing; a dropped row here is a
//    charge nobody can explain. Every failure raises a reconciliation alert
//    rather than being swallowed, and the dashboard shows the queue.
//
// 3. NOTHING HERE MAY BREAK THE WORK IT IS RECORDING. A writer pressing a
//    button must not be refused because an audit row would not insert. So a
//    failure is recorded and reported and never thrown: the operator finds out,
//    and the writer's sentence still gets placed.
// ============================================================================

/* An error code safe to store. Codes are ours and are short and known; a
   message is the provider's and can carry anything. Anything that is not a
   plain code becomes the fact that there was one, which is all a grouping
   needs. */
export function safeCode(x) {
  const s = String(x == null ? '' : x);
  return /^[a-z0-9_.:-]{1,48}$/i.test(s) ? s : (s ? 'unclassified' : '');
}

/* What makes two failures THE SAME failure. Feature, stage and code only.
   Never the message, and never anything the writer typed. */
export function signature(feature, stage, code) {
  return [safeCode(feature) || 'unknown',
          safeCode(stage)   || '-',
          safeCode(code)    || '-'].join('|');
}

/* A plain-language title for an issue, built from the same three parts. An
   operator should not have to read a signature to know what broke. */
const FEATURE_WORDS = {
  import: 'Reading notes', conversation: 'Beat conversations', ideas: 'Ideas',
  logline: 'The logline coach', character: 'Character interviews',
  place: 'Placing a note', route: 'Sorting a note', images: 'Pictures',
  projects: 'Saving a board', captures: 'Phone capture', billing: 'Checkout',
  webhook: 'Payment updates', page: 'The app in the browser'
};
const CODE_WORDS = {
  out_of_credits: 'refused, out of credits', no_plan: 'refused, no plan',
  network: 'could not reach the provider', timeout: 'timed out',
  rate_limited: 'rate limited by the provider', bad_json: 'unreadable answer',
  refund_failed: 'credits were not returned', cancelled: 'stopped by the writer',
  unclassified: 'an error with no code'
};
export function issueTitle(feature, stage, code) {
  const what = FEATURE_WORDS[feature] || (safeCode(feature) || 'Something');
  const why  = CODE_WORDS[code] || (code ? 'failing with ' + safeCode(code) : 'failing');
  return what + ': ' + why + (stage && stage !== '-' ? ' at the ' + safeCode(stage) + ' step' : '');
}

/* The deployment this ran on, so a failure can be tied to a release. Vercel
   sets this; locally it is simply absent and the column stays null rather than
   carrying a word that looks like a version and is not one. */
export function deployTag() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? String(sha).slice(0, 7) : null;
}

/* ---------------------------------------------------------------------------
   THE RECONCILIATION QUEUE IS JUST AN ALERT NOBODY HAS ANSWERED.

   Rather than a table of its own: an alert already carries who, what, when and
   whether it was delivered, and a missing financial record is exactly the kind
   of thing that should be in the same list as an account spending too much.
   --------------------------------------------------------------------------- */
export async function raiseAlert(db, a) {
  try {
    const row = {
      kind:  safeCode(a.kind) || 'system',
      level: safeCode(a.level) || 'warn',
      subject_user: a.userId || null,
      subject_tag:  a.tag || null,
      // The level is IN the key on purpose. A situation getting worse has to
      // escalate; only an unchanged repeat is suppressed.
      dedupe_key: a.dedupe ? (a.dedupe + '|' + (a.level || 'warn')) : null,
      summary: String(a.summary || '').slice(0, 300),
      detail:  a.detail && typeof a.detail === 'object' ? a.detail : {}
    };
    const { error } = await db.from('alerts').insert(row);
    // A duplicate key is the dedupe working, not a failure.
    if (error && error.code !== '23505') return false;
    return true;
  } catch (e) { return false; }
}

/* Used wherever a record that MUST exist did not land. It is deliberately not
   recursive: if the alert itself cannot be written there is nothing left to
   try, and the server log is the last resort. */
async function recordMissed(db, what, detail) {
  const ok = await raiseAlert(db, {
    kind: 'system', level: 'urgent',
    dedupe: 'missed|' + what,
    summary: 'A record that should always be written did not land: ' + what,
    detail: detail || {}
  });
  if (!ok) console.error('[operator] lost record', what, detail);
}

/* ---------------------------------------------------------------------------
   THE CREDIT LEDGER.

   One row per movement, signed, carrying the balance it produced. `idem` is
   what makes a retry safe. A duplicate key means this exact movement is
   already recorded, which is a success and not an error.
   --------------------------------------------------------------------------- */
export async function ledger(db, m) {
  if (!m || !m.credits) return true;
  try {
    const { error } = await db.from('credit_ledger').insert({
      user_id: m.userId || null,
      account_tag: m.tag || null,
      kind: safeCode(m.kind) || 'charge',
      credits: Math.round(m.credits),
      bucket: safeCode(m.bucket) || null,
      reason: String(m.reason || '').slice(0, 200),
      ref: m.ref ? String(m.ref).slice(0, 120) : null,
      idem_key: m.idem ? String(m.idem).slice(0, 160) : null,
      monthly_after: Number.isFinite(m.monthlyAfter) ? m.monthlyAfter : null,
      banked_after:  Number.isFinite(m.bankedAfter)  ? m.bankedAfter  : null,
      actor: safeCode(m.actor) || 'system'
    });
    if (error && error.code === '23505') return true;     // already recorded
    if (error) { await recordMissed(db, 'credit_ledger', { kind: m.kind, ref: m.ref }); return false; }
    return true;
  } catch (e) {
    await recordMissed(db, 'credit_ledger', { kind: m.kind });
    return false;
  }
}

/* ---------------------------------------------------------------------------
   MONEY IN AND MONEY BACK OUT. Idempotent on the Stripe event id, because
   Stripe retries and a retry that posts a second payment is a figure that can
   never be trusted again.
   --------------------------------------------------------------------------- */
export async function logPayment(db, p) {
  try {
    const { error } = await db.from('payments').insert({
      user_id: p.userId || null,
      account_tag: p.tag || null,
      stripe_event_id: p.eventId ? String(p.eventId).slice(0, 120) : null,
      kind: safeCode(p.kind) || 'subscription',
      bill_interval: safeCode(p.interval) || null,
      amount_cents: Math.round(Number(p.amountCents) || 0),
      currency: safeCode(p.currency) || 'usd',
      status: safeCode(p.status) || '',
      period_start: p.periodStart || null,
      period_end: p.periodEnd || null,
      livemode: !!p.livemode
    });
    if (error && error.code === '23505') return true;     // the same event twice
    if (error) { await recordMissed(db, 'payments', { kind: p.kind, event: p.eventId }); return false; }
    return true;
  } catch (e) {
    await recordMissed(db, 'payments', { kind: p.kind });
    return false;
  }
}

/* ---------------------------------------------------------------------------
   ISSUES.

   One row per distinct failure, counters bumped on every occurrence. Read then
   write rather than a database function, because the counters are for a human
   reading a list and being out by one under heavy concurrency changes nothing
   anybody would act on. The COST figures are the ones that have to be exact,
   and those are read back from `usage` by the dashboard rather than summed
   here.
   --------------------------------------------------------------------------- */
export async function noteIssue(db, f) {
  try {
    const sig = signature(f.feature, f.stage, f.code);
    const now = new Date().toISOString();
    const { data: found } = await db.from('admin_issues')
      .select('id, occurrences, status, first_seen_at')
      .eq('signature', sig).maybeSingle();

    if (found) {
      const patch = {
        last_seen_at: now,
        occurrences: (found.occurrences || 0) + 1,
        updated_at: now
      };
      /* A resolved issue that happens again is NOT resolved. It reopens as
         something being watched rather than as new, so the history of what was
         tried is still attached to it. */
      if (found.status === 'resolved') { patch.status = 'monitoring'; patch.resolved_at = null; }
      await db.from('admin_issues').update(patch).eq('id', found.id);
      return found.id;
    }

    const { data, error } = await db.from('admin_issues').insert({
      signature: sig,
      title: issueTitle(f.feature, f.stage, f.code),
      feature: safeCode(f.feature) || null,
      stage: safeCode(f.stage) || null,
      error_code: safeCode(f.code) || null,
      severity: f.severity === 'high' ? 'high' : f.severity === 'low' ? 'low' : 'normal',
      first_seen_at: now, last_seen_at: now, occurrences: 1,
      deploy: deployTag(), provider: safeCode(f.provider) || null,
      model: safeCode(f.model) || null
    }).select('id').single();
    // Two requests failed at once and both tried to create it. Theirs won.
    if (error && error.code === '23505') {
      const { data: again } = await db.from('admin_issues')
        .select('id').eq('signature', sig).maybeSingle();
      return again ? again.id : null;
    }
    if (error) return null;
    return data ? data.id : null;
  } catch (e) { return null; }
}

/* ---------------------------------------------------------------------------
   BUDGET HOLDS.

   take() reserves BEFORE the expensive work so that two requests arriving
   together both count, which is the whole reason a reservation exists rather
   than a check against what has already been spent.

   settle() writes what it actually cost. abandon() is for work that provably
   did not run. unknown() is for work that MIGHT have run: a browser that went
   away mid-call is not evidence the provider stopped, and releasing the money
   on that assumption is how a spending limit quietly stops limiting.
   --------------------------------------------------------------------------- */
export async function takeHold(db, h) {
  try {
    const { data, error } = await db.from('budget_holds').insert({
      user_id: h.userId,
      session_id: h.session ? String(h.session).slice(0, 80) : null,
      request_id: h.requestId ? String(h.requestId).slice(0, 80) : null,
      feature: safeCode(h.feature) || null,
      estimate_micros: Math.max(0, Math.round(Number(h.estimate) || 0)),
      /* Stated rather than left to the column default. A reservation is the
         one row here whose STATE is the whole meaning of it, and a reader
         should not have to go and look up what a missing value means. */
      state: 'held'
    }).select('id').single();
    if (error && error.code === '23505') return null;     // this attempt is already held
    if (error) return null;
    return data ? data.id : null;
  } catch (e) { return null; }
}

export async function settleHold(db, id, actualMicros) {
  if (!id) return;
  try {
    await db.from('budget_holds').update({
      actual_micros: Math.max(0, Math.round(Number(actualMicros) || 0)),
      state: 'settled', settled_at: new Date().toISOString()
    }).eq('id', id).eq('state', 'held');
  } catch (e) {}
}

export async function closeHold(db, id, state) {
  if (!id) return;
  try {
    await db.from('budget_holds').update({
      state: state === 'abandoned' ? 'abandoned' : 'unknown',
      settled_at: new Date().toISOString()
    }).eq('id', id).eq('state', 'held');
  } catch (e) {}
}

/* What is currently reserved and not yet settled, which is the figure a
   ceiling has to include or two simultaneous requests walk straight through
   it. */
export async function heldMicros(db, userId) {
  try {
    const { data } = await db.from('budget_holds')
      .select('estimate_micros').eq('user_id', userId).eq('state', 'held');
    return (data || []).reduce((n, r) => n + Number(r.estimate_micros || 0), 0);
  } catch (e) { return 0; }
}

/* ---------------------------------------------------------------------------
   THE AUDIT HISTORY. Every consequential thing an operator does, whether it
   worked or not. A refused action is as worth recording as one that went
   through: "I tried and it would not let me" is a real thing to be able to
   read later.
   --------------------------------------------------------------------------- */
export async function adminAction(db, a) {
  try {
    const { error } = await db.from('admin_actions').insert({
      admin_id: a.adminId || null,
      admin_email: a.adminEmail || null,
      action: safeCode(a.action) || 'unknown',
      subject_user: a.subjectUser || null,
      subject_tag: a.subjectTag || null,
      detail: a.detail && typeof a.detail === 'object' ? a.detail : {},
      idem_key: a.idem ? String(a.idem).slice(0, 160) : null,
      result: a.result === 'refused' ? 'refused' : a.result === 'failed' ? 'failed' : 'ok'
    });
    if (error && error.code === '23505') return 'duplicate';
    if (error) { await recordMissed(db, 'admin_actions', { action: a.action }); return 'failed'; }
    return 'ok';
  } catch (e) {
    await recordMissed(db, 'admin_actions', { action: a.action });
    return 'failed';
  }
}

/* The opaque id that lets a financial record outlive the account it belonged
   to. Written once, never changed: a tag that moves cannot join a deleted
   account's rows back together. */
export async function accountTag(db, profile) {
  if (!profile) return null;
  if (profile.account_tag) return profile.account_tag;
  const tag = 'acct_' + (globalThis.crypto && globalThis.crypto.randomUUID
    ? globalThis.crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).slice(2) + Date.now().toString(36));
  try {
    await db.from('profiles').update({ account_tag: tag })
      .eq('id', profile.id).is('account_tag', null);
    profile.account_tag = tag;
  } catch (e) {}
  return tag;
}

/* ===========================================================================
   WATCHING WHAT AN ACCOUNT COSTS.

   Kris's figures, approved on 9 October 2026 and recorded as his in the
   budgets table: warn at $8 of provider cost inside one account's credit
   allowance period, urgent at $10. ALERTS, NOT CUTOFFS. Nothing here stops
   anything; `enforced` is false and there is no stop figure.

   THE PERIOD IS THE WRITER'S OWN, NOT THE CALENDAR'S AND NOT STRIPE'S.
   `period_start` is anchored to the day they signed up, which is also the day
   their credits reset. Stripe's billing date can be a different day entirely,
   and comparing a cost against the wrong window is how a figure ends up
   describing six weeks and being read as a month.

   INTERNAL ACCOUNTS ARE WATCHED AND KEPT APART. Kris's own testing is real
   money and a runaway test should still reach him, but it is never a customer
   signal, so the alert says which it is and the dashboard never mixes them.
   =========================================================================== */

/* What this account has cost since its allowance period began, and which
   features account for most of it. Two questions in one pass, because the
   alert is useless without the second: "$9" is a number and "$9, almost all
   of it imports" is something to act on. */
export async function periodCost(db, userId, periodStart) {
  try {
    const { data } = await db.from('usage')
      .select('kind, cost_micros, created_at')
      .eq('user_id', userId)
      .gte('created_at', periodStart);
    const rows = data || [];
    let total = 0;
    const byKind = {};
    rows.forEach(r => {
      const c = Number(r.cost_micros || 0);
      total += c;
      byKind[r.kind] = (byKind[r.kind] || 0) + c;
    });
    const top = Object.keys(byKind).sort((a, b) => byKind[b] - byKind[a]).slice(0, 3);
    return { total, byKind, top, calls: rows.length };
  } catch (e) { return null; }
}

/* The approved figures for one account's situation. Null when nobody has set
   them, which is the honest state for the trial scope today: Kris has asked
   for a trial threshold to be PROPOSED, and until he approves one there is
   nothing to compare against and nothing is pretended. */
export async function budgetFor(db, scope) {
  try {
    const { data } = await db.from('budgets').select('*').eq('scope', scope).maybeSingle();
    return data || null;
  } catch (e) { return null; }
}

/* Called after a call has been priced, by the request that made it. Returns
   what it did so the caller can record it; never throws, and never refuses
   anything. */
export async function watchSpend(db, ctx) {
  const profile = ctx && ctx.profile;
  if (!profile || !profile.period_start) return null;

  const trialing = profile.subscription_status === 'trialing'
    || profile.plan === 'trial';
  const scope = trialing ? 'trial_account' : 'paid_period';
  const budget = await budgetFor(db, scope);
  // Not set is not zero. With no approved figure there is nothing to cross.
  if (!budget) return { watched: false, why: 'no approved budget for ' + scope };

  const seen = await periodCost(db, profile.id, profile.period_start);
  if (!seen) return { watched: false, why: 'could not read the costs' };

  const level = (budget.stop_micros && seen.total >= budget.stop_micros) ? 'stop'
    : (budget.urgent_micros && seen.total >= budget.urgent_micros) ? 'urgent'
    : (budget.warn_micros && seen.total >= budget.warn_micros) ? 'warn'
    : null;
  if (!level) return { watched: true, level: null, spent: seen.total };

  const internal = !!(profile.is_internal || profile.is_admin || profile.is_unlimited);
  const threshold = level === 'stop' ? budget.stop_micros
    : level === 'urgent' ? budget.urgent_micros : budget.warn_micros;
  const money = m => '$' + (Number(m || 0) / 1e6).toFixed(2);

  const raised = await raiseAlert(db, {
    kind: 'spend', level,
    userId: profile.id, tag: profile.account_tag || null,
    /* One per account PER PERIOD per level. The period is in the key so the
       same account crossing the same line next month is news again, and the
       level is in it so a warning becoming urgent escalates rather than being
       suppressed as a repeat. */
    dedupe: 'spend|' + profile.id + '|' + String(profile.period_start).slice(0, 10),
    summary: (internal ? 'Internal account ' : 'Account ')
      + (profile.email || profile.account_tag || 'unknown')
      + ' has cost ' + money(seen.total) + ' this allowance period',
    detail: {
      email: profile.email || null,
      internal,
      spent_micros: seen.total, spent_usd: money(seen.total),
      threshold_micros: threshold, threshold_usd: money(threshold),
      period_start: String(profile.period_start).slice(0, 10),
      calls: seen.calls,
      // What the money went on, which is the half that makes it actionable.
      top: seen.top.map(k => k + ' ' + money(seen.byKind[k])).join(', '),
      scope,
      enforced: !!budget.enforced,
      link: (process.env.SITE_URL || '') + '/admin.html#account=' + profile.id
    }
  });
  return { watched: true, level, spent: seen.total, raised, internal };
}

/* ---------------------------------------------------------------------------
   ONE ACTION, NOT ONE ACCOUNT.

   An import is up to a hundred and fifty calls on one session id, and the
   thing a cutoff actually prevents is one of those looping. That is a
   different question from "has this writer cost too much this month", so it
   gets its own scope and its own figure.

   OBSERVING ONLY. `single_action` ships with `enforced = false`, so this
   records what WOULD have been stopped and stops nothing. Kris asked to see
   the measured cost of the largest permitted actions before approving a
   cutoff, and this is the arithmetic that produces that evidence: the same
   sum, against the same figure, with the enforcement left off.

   WHAT A REAL CUTOFF WOULD HAVE TO DO, written down here because the figure
   is approved before the behaviour is and the two must not drift apart:
     - count the calls already in flight, which is what budget_holds is for,
       rather than only what has settled;
     - return the credits for the action exactly once, which is what the
       refunded flag in api/claude.js guarantees;
     - leave every note, card and board already written alone. Stopping the
       REST of a read is not undoing the part that worked. */
export async function sessionCost(db, userId, session) {
  if (!session) return null;
  try {
    const { data } = await db.from('usage')
      .select('kind, cost_micros')
      .eq('user_id', userId).eq('session_id', session);
    const rows = data || [];
    return {
      total: rows.reduce((n, r) => n + Number(r.cost_micros || 0), 0),
      calls: rows.length,
      kind: rows.length ? rows[0].kind : null
    };
  } catch (e) { return null; }
}

/* Would this one action have been stopped? Answers, records, and never acts.
   Returned so the caller can put it on the usage row and the dashboard can
   count how often it would have happened. */
export async function watchAction(db, ctx) {
  const budget = await budgetFor(db, 'single_action');
  if (!budget || !budget.stop_micros) return { watched: false, why: 'no approved figure' };
  const seen = await sessionCost(db, ctx.userId, ctx.session);
  if (!seen) return { watched: false, why: 'could not read the costs' };

  const over = seen.total >= budget.stop_micros;
  if (!over) return { watched: true, over: false, spent: seen.total };

  const money = m => '$' + (Number(m || 0) / 1e6).toFixed(2);
  await raiseAlert(db, {
    kind: 'spend', level: budget.enforced ? 'stop' : 'warn',
    userId: ctx.userId, tag: ctx.tag || null,
    // One per action, not one per call. A runaway import would otherwise
    // raise a hundred and fifty of these.
    dedupe: 'action|' + ctx.session,
    summary: 'One ' + (seen.kind || 'action') + ' has cost ' + money(seen.total)
      + (budget.enforced ? ' and was stopped' : ', past the proposed cutoff of '
         + money(budget.stop_micros)),
    detail: {
      email: ctx.email || null,
      spent_micros: seen.total, spent_usd: money(seen.total),
      threshold_micros: budget.stop_micros, threshold_usd: money(budget.stop_micros),
      calls: seen.calls, scope: 'single_action', session: ctx.session,
      enforced: !!budget.enforced,
      /* Said in the alert itself, because the figure is approved and the
         behaviour is not, and somebody reading this at midnight should not
         have to remember which. */
      note: budget.enforced ? 'The remaining calls were stopped.'
        : 'Nothing was stopped. This figure is being observed, not enforced.'
    }
  });
  return { watched: true, over: true, spent: seen.total, enforced: !!budget.enforced };
}

/* HAS THIS EXACT MOVEMENT ALREADY BEEN POSTED.

   The ledger's unique key refuses a duplicate ROW, which is not the same as
   refusing a duplicate MOVEMENT: by the time the insert is attempted the
   balance has already been changed. So anything that must happen exactly once
   asks first, and only then touches the money.

   This was wrong in the first version and a test found it. The key was built
   from the balance the movement produced, which is different the second time
   precisely because the first one worked, so it never matched and a refund
   called twice paid out twice. A key has to identify the MOVEMENT: what, for
   whom, from which bucket, how much, against which reference. */
export async function alreadyPosted(db, idem) {
  if (!idem) return false;
  try {
    const { data } = await db.from('credit_ledger')
      .select('id').eq('idem_key', idem).maybeSingle();
    return !!data;
  } catch (e) {
    /* Unknown is not "no". Answering no here would let a refund through on a
       database wobble, which is the exact failure this function exists to
       prevent, so it answers yes and the movement is skipped. A credit not
       returned is visible and fixable; one returned twice is neither. */
    return true;
  }
}

/* The key for one movement. Built from what it IS, never from what it leaves
   behind. */
export function movementKey(ref, kind, bucket, credits) {
  if (!ref) return null;
  return [String(ref).slice(0, 100), kind, bucket, Math.abs(credits)].join(':');
}

/* THE OUTCOME OF AN ACTION, WRITTEN ONTO THE ROW THAT RECORDED IT.

   The audit row goes down BEFORE the work, so a press that never finishes is
   still visible. That leaves the result to be filled in afterwards, and it
   has to go on the SAME row: a second insert would make one press look like
   two in a list whose whole job is saying what happened once. */
export async function finishAction(db, idem, result, detail) {
  if (!idem) return;
  try {
    const patch = { result: result === 'refused' ? 'refused'
                          : result === 'failed' ? 'failed' : 'ok' };
    if (detail && typeof detail === 'object') patch.detail = detail;
    await db.from('admin_actions').update(patch).eq('idem_key', idem);
  } catch (e) {}
}
