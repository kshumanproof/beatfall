// ============================================================================
// Stripe webhook: the only thing allowed to change what somebody is paying
// for. The browser can ask for a checkout session; only Stripe, signed, can
// tell us it succeeded.
//
// Vercel must not parse the body for us, or the signature check fails.
// ============================================================================
import Stripe from 'stripe';
import { admin, PAID_PLAN, PLANS } from './_lib/core.js';

export const config = { api: { bodyParser: false } };

const raw = async (req) => {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
};

// Work out which of our plans a subscription corresponds to, by price id.
function planFromSubscription(sub) {
  const priceId = sub?.items?.data?.[0]?.price?.id;
  const map = {
    [process.env.STRIPE_PRICE_MONTHLY]: PAID_PLAN,
    [process.env.STRIPE_PRICE_ANNUAL]:  PAID_PLAN
  };
  return map[priceId] || null;
}

export default async function handler(req, res) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = await raw(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    console.error('bad stripe signature', e.message);
    return res.status(400).send(`signature: ${e.message}`);
  }

  const db = admin();

  const byCustomer = async (customerId) => {
    const { data } = await db.from('profiles')
      .select('*').eq('stripe_customer_id', customerId).maybeSingle();
    return data;
  };

  try {
    switch (event.type) {

      // one-off credit top-up
      case 'checkout.session.completed': {
        const s = event.data.object;
        if (s.mode === 'payment' && s.metadata?.topup) {
          /* This block gave credits away three different ways.

             It never checked the money arrived: a delayed payment method
             completes the session as unpaid, and the credits went out anyway.
             It had no guard against being told twice, and Stripe deliberately
             redelivers on any error, so one pack could be credited twice. And
             when it could not find the account it answered "fine", so Stripe
             never tried again and the customer paid for nothing.

             The order below is the fix. The receipt is written FIRST, carrying
             Stripe's own event id, and the unique index on that column is what
             makes a redelivery bounce: if the insert fails we are already done,
             so the credits are not granted a second time. */
          const amount = Number(s.metadata.topup);
          if (s.payment_status !== 'paid') {
            console.warn('topup ignored, not paid:', s.id, s.payment_status);
            break;
          }
          if (!Number.isInteger(amount) || amount <= 0 || amount > 10000) {
            console.error('topup ignored, bad amount:', s.id, s.metadata.topup);
            break;
          }
          const profile = await byCustomer(s.customer);
          if (!profile) {
            // Not found is not finished. Fail loudly so Stripe retries while
            // the profile catches up, instead of charging somebody for nothing.
            console.error('topup has no matching account yet:', s.customer);
            return res.status(503).send('no matching account');
          }
          const { error: seen } = await db.from('events').insert({
            user_id: profile.id, name: 'credits_purchased', event_id: event.id,
            props: { credit_amount: amount }
          });
          if (seen) {
            /* A duplicate key means this exact Stripe event has been handled and
               the credits are already on the account: finished, say so.
               Anything else is a database that did not answer, and treating
               that as "already done" would be the original bug wearing a hat -
               the customer pays and receives nothing. Fail so Stripe retries. */
            const duplicate = seen.code === '23505'
              || /duplicate key|already exists/i.test(seen.message || '');
            if (duplicate) { console.warn('topup already applied:', event.id); break; }
            console.error('topup receipt failed, no credits granted:', seen.message);
            return res.status(503).send('receipt failed');
          }
          await db.from('profiles')
            .update({ credits_extra: (profile.credits_extra || 0) + amount })
            .eq('id', profile.id);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const profile = await byCustomer(sub.customer);
        if (!profile) break;
        const plan = planFromSubscription(sub);
        const live = ['active', 'trialing', 'past_due'].includes(sub.status);
        // Recent Stripe API versions moved the period fields onto the line item.
        const item = sub?.items?.data?.[0];
        const periodEnd = sub.current_period_end || item?.current_period_end || null;

        /* THE TRIAL CREDITS FOLLOW THE WRITER.
         *
         * Twelve credits left of the free twenty five, then you subscribe, and
         * you have a hundred and twelve. Not seventy six.
         *
         * Without this, the trial's spend was still sitting in credits_used
         * when the paid allowance arrived, so subscribing on day three
         * silently charged the new month for a fortnight of trial reading, and
         * subscribing before the trial ran out was a worse deal than burning
         * it first. Beatfall should never make "use it or lose it" the
         * rational move.
         *
         * Once only, and only on the way UP. `trial_banked_at` is the guard:
         * customer.subscription.updated fires on every card change, price
         * switch and renewal for the rest of the account's life, and every one
         * of those would otherwise hand out another month's leftovers. */
        const goingPaid = live && plan === PAID_PLAN && !profile.trial_banked_at
          && !['active', 'past_due'].includes(profile.subscription_status || '');
        const banked = goingPaid
          ? Math.max(0, (PLANS.trial.credits || 0) - (profile.credits_used || 0))
          : 0;

        await db.from('profiles').update({
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          /* A subscription that is merely not live yet is not a cancelled one.
             A card that asks for verification is created `incomplete`, and this
             used to write 'none' the moment it appeared: a writer on day three
             who started checkout and did not finish the bank's step lost the
             other eleven days of their trial that instant, permanently.

             Nothing here may lower a plan. `customer.subscription.deleted` is
             the one place a plan ends, and it has its own case below. */
          plan: live && plan ? plan
              : (sub.status === 'trialing' ? (plan || 'trial')
              : (profile.plan && profile.plan !== 'none' ? profile.plan : 'none')),
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancel_at_period_end: !!sub.cancel_at_period_end,
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString()
                                       : profile.trial_ends_at,
          ...(goingPaid ? {
            credits_extra: (profile.credits_extra || 0) + banked,
            // The paid month starts at nothing used. What the trial spent is
            // already accounted for: only the REMAINDER was banked above.
            credits_used: 0,
            period_start: new Date().toISOString(),
            trial_banked_at: new Date().toISOString()
          } : {})
        }).eq('id', profile.id);
        if (goingPaid && banked) await db.from('events').insert({
          user_id: profile.id, name: 'trial_credits_banked', props: { count: banked }
        });
        await db.from('events').insert({
          user_id: profile.id, name: 'subscription_' + sub.status, props: { plan }
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const profile = await byCustomer(sub.customer);
        if (!profile) break;
        await db.from('profiles')
          .update({ subscription_status: 'canceled', plan: 'none',
                    current_period_end: null, cancel_at_period_end: false }).eq('id', profile.id);
        await db.from('events').insert({ user_id: profile.id, name: 'subscription_canceled' });
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object;
        const profile = await byCustomer(inv.customer);
        if (profile) {
          await db.from('profiles').update({ subscription_status: 'past_due' }).eq('id', profile.id);
          // A card that stops working and a person who decides to leave look
          // identical in a churn number and are completely different problems.
          await db.from('events').insert({
            user_id: profile.id, name: 'payment_failed',
            props: { error_code: String(inv.billing_reason || 'unknown').slice(0, 64) }
          });
        }
        break;
      }
    }
  } catch (e) {
    console.error('webhook handling failed', event.type, e);
    return res.status(500).send('handler error');   // Stripe retries
  }

  res.status(200).send('ok');
}
