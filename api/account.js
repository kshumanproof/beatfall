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
      track(db, user.id, body.name, body.props || {}, {
        event_id: body.event_id, anon_id: body.anon_id, session_id: body.session_id
      });
      return send(res, 200, { ok: true });
    }

    /* ------------------------------------------------------- attribution --
       The browser holds what it saw on the first visit and hands it over on
       the first authenticated call, because a magic link leaves the site and
       comes back and the referrer does not survive that trip.

       First touch is written once and never again: the whole point of it is to
       answer "where did this writer originally come from", and a later visit
       through a different link must not overwrite that. Last touch may move.
       Only source, medium, campaign, referrer host and landing path are kept.
       Never the email, never a query string wholesale. */
    if (body.action === 'attribution' && body.touch && typeof body.touch === 'object') {
      const t = body.touch;
      const clean = {};
      for (const k of ['source', 'medium', 'campaign', 'content', 'term', 'ref', 'referrer', 'landing']) {
        if (typeof t[k] === 'string' && t[k]) clean[k] = t[k].slice(0, 120);
      }
      if (!Object.keys(clean).length) return send(res, 200, { ok: true });
      clean.at = new Date().toISOString();

      const patch = { last_touch: clean };
      if (!profile.first_touch) patch.first_touch = clean;
      await db.from('profiles').update(patch).eq('id', user.id);
      return send(res, 200, { ok: true, first_touch: !profile.first_touch });
    }

    /* ------------------------------------------------- onboarding + stages --
       Explicit state, set once. The client says which milestone it reached and
       the server refuses to move a marker that already has a value, so a
       reload or a second tab cannot rewrite history. */
    if (body.action === 'onboarding') {
      const patch = {};
      if (body.seen && !profile.onboarding_first_seen_at)
        patch.onboarding_first_seen_at = new Date().toISOString();
      if (['import', 'new_project', 'sample'].includes(body.choice)) {
        patch.onboarding_choice = body.choice;
        patch.onboarding_completed_at = new Date().toISOString();
      }
      if (Object.keys(patch).length)
        await db.from('profiles').update(patch).eq('id', user.id);
      return send(res, 200, { ok: true });
    }

    if (body.action === 'stage' && typeof body.name === 'string') {
      const COL = { real_project: 'first_real_project_at',
                    meaningful_board: 'first_meaningful_board_at' }[body.name];
      if (!COL) return send(res, 400, { error: 'bad_request' });
      if (profile[COL]) return send(res, 200, { ok: true, already: true });
      await db.from('profiles').update({ [COL]: new Date().toISOString() }).eq('id', user.id);
      track(db, user.id, body.name === 'real_project' ? 'first_real_project' : 'meaningful_board');
      return send(res, 200, { ok: true });
    }

    /* Why somebody cancelled. Kept on the profile rather than in events: the
       optional note is the writer talking to Kris, which is support
       correspondence, and it should not sit in a table whose whole rule is
       that it holds no prose. */
    if (body.action === 'cancel_reason' && typeof body.reason === 'string') {
      await db.from('profiles').update({
        cancel_reason: body.reason.slice(0, 40),
        cancel_reason_note: (body.note || '').slice(0, 600) || null,
        cancel_reason_at: new Date().toISOString()
      }).eq('id', user.id);
      track(db, user.id, 'cancel_reason_given', { reason_code: body.reason });
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: 'bad_request' });
  }

  return send(res, 405, { error: 'method' });
}
