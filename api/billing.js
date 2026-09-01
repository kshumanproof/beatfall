// ============================================================================
// Billing — checkout, the customer portal, and credit top-ups.
//
// Runs against whichever Stripe key is in the environment, so test mode and
// live mode are the same code. Nothing here trusts the browser about what
// somebody is paying for: the plan is looked up server-side by price id.
// ============================================================================
import Stripe from 'stripe';
import { requireUser, send, readBody, PLANS } from './_lib/core.js';

const stripe = () => new Stripe(process.env.STRIPE_SECRET_KEY);

// Price ids come from the environment so the same code runs in test and live.
const PRICE = () => ({
  writer:  process.env.STRIPE_PRICE_WRITER,
  working: process.env.STRIPE_PRICE_WORKING,
  volume:  process.env.STRIPE_PRICE_VOLUME,
  topup:   process.env.STRIPE_PRICE_TOPUP        // 100 credits, one-off
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });

  const auth = await requireUser(req);
  if (auth.error) return send(res, auth.status, { error: auth.error });
  const { db, user, profile } = auth;

  const body = await readBody(req);
  const site = process.env.SITE_URL || `https://${req.headers.host}`;
  const s = stripe();

  // Everyone gets a Stripe customer the first time they need one.
  let customerId = profile.stripe_customer_id;
  if (!customerId) {
    const customer = await s.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id }
    });
    customerId = customer.id;
    await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  // ------------------------------------------------------------ subscribe --
  if (body.action === 'checkout') {
    const plan = String(body.plan || 'writer');
    const price = PRICE()[plan];
    if (!price || !PLANS[plan]) return send(res, 400, { error: 'unknown_plan' });

    // Only give a fresh trial to somebody who has never subscribed.
    const neverSubscribed = !profile.stripe_subscription_id;

    const session = await s.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: neverSubscribed ? { trial_period_days: 14 } : undefined,
      success_url: `${site}/settings.html?checkout=done`,
      cancel_url:  `${site}/settings.html?checkout=cancelled`,
      metadata: { supabase_user_id: user.id, plan }
    });
    return send(res, 200, { url: session.url });
  }

  // ------------------------------------------------------------- top up ---
  if (body.action === 'topup') {
    const price = PRICE().topup;
    if (!price) return send(res, 400, { error: 'topup_unavailable' });
    const session = await s.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${site}/settings.html?topup=done`,
      cancel_url:  `${site}/settings.html`,
      metadata: { supabase_user_id: user.id, topup: '100' }
    });
    return send(res, 200, { url: session.url });
  }

  // -------------------------------------------------------------- manage --
  // Cancelling, changing card, switching tier — all Stripe's own screens, so
  // none of it has to be built or maintained here.
  if (body.action === 'portal') {
    const session = await s.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${site}/settings.html`
    });
    return send(res, 200, { url: session.url });
  }

  return send(res, 400, { error: 'bad_request' });
}
