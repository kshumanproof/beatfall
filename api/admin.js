// ============================================================================
// Admin — what Kris needs to see. Who signed up, whether they came back, what
// they actually did, and what each of them costs in API this month.
//
// That last column is the one that sets the tier caps. Everything else is
// context for it.
// ============================================================================
import { requireUser, send, PLANS, entitlement } from './_lib/core.js';

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
      db.from('projects').select('user_id, cards, updated_at'),
      db.from('events').select('user_id, name, created_at').gte('created_at', since).limit(5000)
    ]);

  const byUser = {};
  const ensure = id => (byUser[id] = byUser[id] || {
    calls: 0, credits: 0, cost_micros: 0, kinds: {}, projects: 0, cards: 0
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
    r.cards += Array.isArray(p.cards) ? p.cards.length : 0;
  });

  const rows = (people || []).map(p => {
    const u = byUser[p.id] || { calls: 0, credits: 0, cost_micros: 0, kinds: {}, projects: 0, cards: 0 };
    const ent = entitlement(p);
    return {
      id: p.id,
      email: p.email,
      name: p.display_name,
      owner: !!p.is_admin,
      plan: ent.key,
      status: p.subscription_status,
      trial_ends_at: p.trial_ends_at,
      created_at: p.created_at,
      last_seen_at: p.last_seen_at,
      projects: u.projects,
      cards: u.cards,
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
    plans: PLANS,
    users: rows
  });
}
