// ============================================================================
// Admin: what Kris needs to see. Who signed up, whether they came back, what
// they actually did, and what each of them costs in API this month.
//
// That last column is the one that sets the tier caps. Everything else is
// context for it.
// ============================================================================
import { requireUser, send, PLANS, entitlement,
         PRICE_MONTH, PRICE_YEAR, TOPUP_CREDITS, TOPUP_PRICE } from './_lib/core.js';

export default async function handler(req, res) {
  const auth = await requireUser(req);
  if (auth.error) return send(res, auth.status, { error: auth.error });
  const { db, profile } = auth;
  if (!profile.is_admin) return send(res, 403, { error: 'not_admin' });

  const days = Math.min(120, Math.max(1, Number(req.query?.days) || 30));
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [{ data: people }, { data: usage }, { data: projects }, { data: events }] =
    await Promise.all([
      db.from('profiles').select('*').order('created_at', { ascending: false }).limit(500),
      db.from('usage').select('user_id, kind, credits, tokens_in, tokens_out, cost_micros, created_at')
        .gte('created_at', since),
      // Deliberately NOT 'cards'. The operator has no business reading a
      // stranger's story, and the Terms say so. This is the line that makes
      // that true rather than a promise. card_count is maintained by a trigger
      // in the database, so counting never requires the text.
      db.from('projects').select('user_id, card_count, updated_at, is_sample'),
      db.from('events').select('user_id, name, created_at').gte('created_at', since).limit(5000)
    ]);

  const byUser = {};
  const ensure = id => (byUser[id] = byUser[id] || {
    calls: 0, credits: 0, cost_micros: 0, kinds: {}, projects: 0, cards: 0,
    real_projects: 0, real_cards: 0
  });

  (usage || []).forEach(u => {
    const r = ensure(u.user_id);
    r.calls += 1;
    r.credits += u.credits;
    r.cost_micros += Number(u.cost_micros || 0);
    r.kinds[u.kind] = (r.kinds[u.kind] || 0) + 1;
  });
  (projects || []).forEach(p => {
    const r = ensure(p.user_id);
    r.projects += 1;
    r.cards += Number(p.card_count || 0);
    // The sample is meant to be used. It is not meant to be counted as work.
    if (!p.is_sample) { r.real_projects += 1; r.real_cards += Number(p.card_count || 0); }
  });

  const rows = (people || []).map(p => {
    const u = byUser[p.id] || { calls: 0, credits: 0, cost_micros: 0, kinds: {},
                                projects: 0, cards: 0, real_projects: 0, real_cards: 0 };
    const ent = entitlement(p);
    return {
      id: p.id,
      email: p.email,
      name: p.display_name,
      owner: !!p.is_admin,
      // is_internal is the switch that keeps Kris's own accounts, and any QA
      // account, out of the product numbers. They stay visible in People,
      // because hiding them would be a different kind of lie.
      internal: !!p.is_internal || !!p.is_admin,
      onboarding_choice: p.onboarding_choice,
      onboarding_seen_at: p.onboarding_first_seen_at,
      first_real_project_at: p.first_real_project_at,
      first_meaningful_board_at: p.first_meaningful_board_at,
      first_touch: p.first_touch || null,
      last_touch: p.last_touch || null,
      cancel_reason: p.cancel_reason || null,
      plan: ent.key,
      status: p.subscription_status,
      trial_ends_at: p.trial_ends_at,
      created_at: p.created_at,
      last_seen_at: p.last_seen_at,
      projects: u.projects,
      cards: u.cards,
      real_projects: u.real_projects,
      real_cards: u.real_cards,
      calls: u.calls,
      credits: u.credits,
      allowance: ent.allowance,
      cost_usd: u.cost_micros / 1e6,
      kinds: u.kinds
    };
  });

  // ---- the numbers that decide the tiers ---------------------------------
  // Owner accounts are unmetered, so including them would drag the percentiles
  // that decide the customer allowance.
  const active = rows.filter(r => r.calls > 0 && !r.owner);
  const spends = active.map(r => r.cost_usd).sort((a, b) => a - b);
  const creds  = active.map(r => r.credits).sort((a, b) => a - b);
  const pct = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0;

  const eventCounts = {};
  (events || []).forEach(e => { eventCounts[e.name] = (eventCounts[e.name] || 0) + 1; });

  /* ---------------------------------------------------------------- funnel --
     Everything below counts external accounts only. Two owner accounts in a
     cohort of ten writers would not skew these numbers, they would BE these
     numbers, which is the whole reason is_internal exists.

     Each stage is a column on the profile rather than a reconstruction from
     the event stream, so the funnel is a count of facts, not an inference that
     changes meaning the next time somebody edits a query. */
  const ext = rows.filter(r => !r.internal);
  const DAY = 86400000;
  const returned = (r, from, to) => {
    if (!r.last_seen_at) return false;
    const age = new Date(r.last_seen_at) - new Date(r.created_at);
    return age >= from * DAY && (to === null || age <= to * DAY);
  };

  const funnel = [
    ['Signed up',          ext.length],
    ['Chose a path',       ext.filter(r => r.onboarding_choice).length],
    ['Real project',       ext.filter(r => r.first_real_project_at).length],
    ['Meaningful board',   ext.filter(r => r.first_meaningful_board_at).length],
    ['Returned after D1',  ext.filter(r => returned(r, 1, null)).length],
    ['Returned after D7',  ext.filter(r => returned(r, 6, null)).length],
    ['Paying',             ext.filter(r => ['active', 'past_due'].includes(r.status || '')).length]
  ].map(([label, n], i, all) => ({
    label, n,
    // Conversion from the previous stage, which is the number that tells you
    // where people fall out. A conversion from the top would just restate the
    // same slow decline at every row.
    from_prev: i === 0 ? null : (all[i - 1][1] ? Math.round(n / all[i - 1][1] * 100) : 0)
  }));

  /* Which opening path produces writers. This is the table the whole beta is
     for: "paste the whole mess" is Beatfall's bet, and this is the first
     evidence for or against it. */
  const PATHS = ['import', 'new_project', 'sample'];
  const by_path = PATHS.map(key => {
    const g = ext.filter(r => r.onboarding_choice === key);
    return {
      key, users: g.length,
      meaningful: g.filter(r => r.first_meaningful_board_at).length,
      d1:   g.filter(r => returned(r, 1, null)).length,
      d7:   g.filter(r => returned(r, 6, null)).length,
      paid: g.filter(r => ['active', 'past_due'].includes(r.status || '')).length
    };
  });
  by_path.push({
    key: 'none', users: ext.filter(r => !r.onboarding_choice).length,
    meaningful: 0, d1: 0, d7: 0, paid: 0
  });

  /* Where accounts came from. Empty until the first tagged link is used, which
     is correct: an empty table is an honest answer to "which channel works". */
  const bySource = {};
  ext.forEach(r => {
    const t = r.first_touch || {};
    const key = t.source || t.ref || t.referrer || 'direct';
    const s = bySource[key] = bySource[key] || { key, users: 0, activated: 0, paid: 0, cost_usd: 0 };
    s.users += 1;
    if (r.first_meaningful_board_at) s.activated += 1;
    if (['active', 'past_due'].includes(r.status || '')) s.paid += 1;
    s.cost_usd += r.cost_usd;
  });
  const sources = Object.values(bySource).sort((a, b) => b.users - a.users);

  // Only the failures. A rate needs a denominator that means something, and at
  // this size the raw counts are more honest than a percentage of eleven.
  const FAILURES = ['import_failed', 'ai_request_failed', 'payment_failed'];
  const failures = FAILURES.map(name => ({ name, n: eventCounts[name] || 0 }));

  const reasons = {};
  ext.forEach(r => { if (r.cancel_reason) reasons[r.cancel_reason] = (reasons[r.cancel_reason] || 0) + 1; });

  return send(res, 200, {
    window_days: days,
    totals: {
      people: rows.length,
      active_in_window: active.length,
      returned: rows.filter(r => r.last_seen_at
        && new Date(r.last_seen_at) - new Date(r.created_at) > 86400000).length,
      paying: rows.filter(r => ['active', 'past_due'].includes(r.status || '')).length,
      cost_usd: rows.reduce((n, r) => n + r.cost_usd, 0),
      calls: rows.reduce((n, r) => n + r.calls, 0)
    },
    // set the caps from these, not from guesses
    credits_per_active_user: {
      median: pct(creds, .5), p75: pct(creds, .75), p90: pct(creds, .9),
      max: creds[creds.length - 1] || 0
    },
    cost_per_active_user_usd: {
      median: pct(spends, .5), p90: pct(spends, .9), max: spends[spends.length - 1] || 0
    },
    events: eventCounts,
    // The growth layer. Every one of these counts external accounts only.
    funnel, by_path, sources, failures, cancel_reasons: reasons,
    internal_count: rows.length - ext.length,
    plans: PLANS,
    // Every number on the admin plan card comes from here. It used to hardcode
    // the top-up in the template, which is how it went on saying 100 for $6
    // for a day after the pack became 50.
    pricing: {
      month: PRICE_MONTH, year: PRICE_YEAR,
      topup_credits: TOPUP_CREDITS, topup_price: TOPUP_PRICE
    },
    users: rows
  });
}
