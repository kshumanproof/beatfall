// ============================================================================
// Account: who am I, what plan am I on, what have I used, and the two
// destructive things a person is entitled to do: take their data out, and
// delete the lot.
// ============================================================================
import Stripe from 'stripe';
import { requireUser, entitlement, send, readBody, PLANS, TOPUP_CREDITS, TOPUP_PRICE,
         PRICE_MONTH, PRICE_YEAR, track } from './_lib/core.js';

export default async function handler(req, res) {
  const auth = await requireUser(req);
  if (auth.error) return send(res, auth.status, { error: auth.error });
  const { db, user, profile } = auth;

  if (req.method === 'GET') {
    const ent = entitlement(profile);

    const since = new Date(profile.period_start).toISOString();
    // `created_at` and `session_id` join the select so the account can show a
    // writer WHEN each credit went and stop several turns of one conversation
    // reading as several charges.
    const { data: rows } = await db.from('usage')
      .select('kind, credits, cost_micros, session_id, created_at')
      .eq('user_id', user.id).gte('created_at', since)
      .order('created_at', { ascending: false });

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
      /* What each credit was spent on, newest first.

         "119 of 150 used" is a number a writer can do nothing with. This is the
         itemised version: the free actions are left out because they cost
         nothing and would bury the ones that did, and only the turn that was
         actually charged appears, so a ten-question interview is one line at
         two credits rather than ten lines that appear to be free. */
      spend: (rows || [])
        .filter(r => (r.credits || 0) > 0)
        .slice(0, 100)
        .map(r => ({ kind: r.kind, credits: r.credits, at: r.created_at })),
      projects: projectCount || 0,
      has_history: (everUsed || 0) > 0,
      topup_credits: TOPUP_CREDITS,
      topup_price: TOPUP_PRICE,
      // Both prices, so a page showing them does not carry its own copy of the
      // number. That is how the admin plan card went on saying 100 for $6.
      price_month: PRICE_MONTH,
      price_year: PRICE_YEAR,
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
        // `characters` belongs here. It is its own column precisely so the
        // project form cannot wipe it, and leaving it out of the one file
        // called "everything a person has" lost every character sheet on the
        // path designed to prevent exactly that.
        .select('name, structure, brief, cards, outline, characters, is_sample, created_from, created_at, updated_at')
        .eq('user_id', user.id).order('sort_order');
      return send(res, 200, {
        exported_at: new Date().toISOString(),
        account: { email: user.email, plan: profile.plan },
        projects: projects || []
      });
    }

    /* Deleting the auth user cascades to the profile, the projects and the
       usage rows. Two things it did not do, and both mattered.

       It never told Stripe. A writer with a live subscription deleted their
       account and the card went on being charged every month, with no account
       left to cancel from - and because the profile row goes with them, the
       customer and subscription ids go too, so afterwards there is nothing to
       look it up by. Cancelling comes first, and a failure to cancel stops the
       deletion rather than proceeding quietly.

       And it reported success whatever happened. If the delete failed, the
       writer cleared their browser believing they were gone while every project
       stayed in the database. */
    if (body.action === 'delete_account' && body.confirm === user.email) {
      /* Ask Stripe what the subscription IS before trying to end it.
         Classifying by error code did not work: Stripe answers a cancel on an
         already-cancelled subscription with a plain 400, not resource_missing,
         so a writer who cancelled through the portal and then came here was
         refused with "cancel it first, then delete" - which they had already
         done and could not do again. They could never delete their account. */
      let cancelled = false;
      if (profile.stripe_subscription_id) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const stop = async () => {
          let status = null;
          try {
            const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
            status = sub && sub.status;
          } catch (e) {
            // Not at Stripe at all: nothing to end, carry on.
            if (e && (e.code === 'resource_missing' || e.statusCode === 404)) return true;
            console.error('could not read subscription before delete:', e && e.message);
            return false;
          }
          if (['canceled', 'incomplete_expired'].includes(status)) return true;
          try {
            await stripe.subscriptions.cancel(profile.stripe_subscription_id);
            cancelled = true;
            return true;
          } catch (e) {
            console.error('could not cancel before delete:', e && e.message);
            return false;
          }
        };
        if (!await stop()) {
          return send(res, 502, {
            error: 'cancel_failed',
            message: "Your subscription couldn't be reached just now, so nothing has been "
                   + 'deleted and nothing has changed. Try again in a moment.'
          });
        }
      }
      // Written before the row it points at disappears.
      track(db, user.id, 'account_deleted');
      const { error: delErr } = await db.auth.admin.deleteUser(user.id);
      if (delErr) {
        console.error('account delete failed:', delErr.message);
        // If the subscription was just cancelled, "nothing was removed" is not
        // true and the writer needs to know which half happened.
        return send(res, 500, {
          error: 'delete_failed',
          message: cancelled
            ? "Your subscription has been cancelled, but the account itself couldn't be "
              + 'deleted just now. Nothing you wrote has been removed. Try again in a '
              + 'moment, or write to contact@beatfall.app.'
            : "Your account couldn't be deleted just now. Nothing was removed. "
              + 'Try again in a moment, or write to contact@beatfall.app.'
        });
      }
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
