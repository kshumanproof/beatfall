// ============================================================================
// Account: who am I, what plan am I on, what have I used, and the two
// destructive things a person is entitled to do: take their data out, and
// delete the lot.
// ============================================================================
import { requireUser, entitlement, send, readBody, PLANS, TOPUP_CREDITS, TOPUP_PRICE, track } from './_lib/core.js';

export default async function handler(req, res) {
  const auth = await requireUser(req);
  if (auth.error) return send(res, auth.status, { error: auth.error });
  const { db, user, profile } = auth;

  if (req.method === 'GET') {
    const ent = entitlement(profile);

    const since = new Date(profile.period_start).toISOString();
    const { data: rows } = await db.from('usage')
      .select('kind, credits, cost_micros').eq('user_id', user.id).gte('created_at', since);

    const byKind = {};
    (rows || []).forEach(r => {
      byKind[r.kind] = byKind[r.kind] || { count: 0, credits: 0 };
      byKind[r.kind].count += 1;
      byKind[r.kind].credits += r.credits;
    });

    const { count: projectCount } = await db.from('projects')
      .select('id', { count: 'exact', head: true }).eq('user_id', user.id);

    // Has this account ever done anything, ever, as opposed to this period?
    // An empty account is not the same as a new one: somebody who deleted their
    // last project on day sixty should not be welcomed to Beatfall. All-time
    // usage is the signal, because it needs no new column and no backfill for
    // the accounts that already exist. A writer who only ever typed cards by
    // hand and then deleted them reads as new, which is the old behaviour and
    // is rare enough to live with.
    const { count: everUsed } = await db.from('usage')
      .select('id', { count: 'exact', head: true }).eq('user_id', user.id);

    return send(res, 200, {
      email: user.email,
      display_name: profile.display_name,
      is_admin: !!profile.is_admin,
      unlimited: !!ent.unlimited,
      plan: ent.key,
      plan_name: ent.plan.name,
      price: ent.plan.price,
      subscription_status: profile.subscription_status,
      current_period_end: profile.current_period_end,
      cancel_at_period_end: !!profile.cancel_at_period_end,
      trialing: ent.trialing,
      trial_ends_at: ent.trialEndsAt,
      credits_used: ent.used,
      credits_allowance: ent.allowance,     // this month's ceiling, not the total
      credits_left: ent.left,               // monthly remaining plus banked
      credits_monthly_left: ent.monthlyLeft,
      credits_banked: ent.banked,           // bought, never expires, spent last
      period_start: profile.period_start,
      by_kind: byKind,
      projects: projectCount || 0,
      has_history: (everUsed || 0) > 0,
      topup_credits: TOPUP_CREDITS,
      topup_price: TOPUP_PRICE,
      plans: PLANS
    });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);

    if (body.action === 'rename' && typeof body.display_name === 'string') {
      await db.from('profiles')
        .update({ display_name: body.display_name.slice(0, 80) }).eq('id', user.id);
      return send(res, 200, { ok: true });
    }

    // Everything a person has, in one file, no questions asked.
    if (body.action === 'export') {
      const { data: projects } = await db.from('projects')
        .select('name, structure, brief, cards, outline, created_at, updated_at')
        .eq('user_id', user.id).order('sort_order');
      return send(res, 200, {
        exported_at: new Date().toISOString(),
        account: { email: user.email, plan: profile.plan },
        projects: projects || []
      });
    }

    // Deleting the auth user cascades to profile, projects, usage and events.
    if (body.action === 'delete_account' && body.confirm === user.email) {
      track(db, user.id, 'account_deleted');
      await db.auth.admin.deleteUser(user.id);
      return send(res, 200, { ok: true });
    }

    if (body.action === 'event' && typeof body.name === 'string') {
      track(db, user.id, body.name.slice(0, 60), body.props || {});
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: 'bad_request' });
  }

  return send(res, 405, { error: 'method' });
}
