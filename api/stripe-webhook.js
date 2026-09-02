// ============================================================================
// Stripe webhook — the only thing allowed to change what somebody is paying
// for. The browser can ask for a checkout session; only Stripe, signed, can
// tell us it succeeded.
//
// Vercel must not parse the body for us, or the signature check fails.
// ============================================================================
import Stripe from 'stripe';
import { admin, PAID_PLAN } from './_lib/core.js';

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
          const profile = await byCustomer(s.customer);
          if (profile) {
            await db.from('profiles')
              .update({ credits_extra: (profile.credits_extra || 0) + Number(s.metadata.topup) })
              .eq('id', profile.id);
            await db.from('events').insert({
              user_id: profile.id, name: 'topup', props: { credits: Number(s.metadata.topup) }
            });
          }
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
        await db.from('profiles').update({
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          plan: live && plan ? plan : (sub.status === 'trialing' ? (plan || 'trial') : 'none'),
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancel_at_period_end: !!sub.cancel_at_period_end,
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString()
                                       : profile.trial_ends_at
        }).eq('id', profile.id);
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
