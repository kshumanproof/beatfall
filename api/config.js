// ============================================================================
// The two public values the browser legitimately needs: the Supabase URL and
// its anon key. Both are safe in a browser by design: row-level security is
// what protects the data, not secrecy of this key.
//
// Serving them from here rather than hard-coding means the same static files
// work in every environment.
//
// The prices ride along for one reason: billing.html is a signed-out page, so
// it cannot ask /api/account what a plan costs, and the numbers were therefore
// typed into the HTML by hand. When the allowance changed, the sales page went
// on advertising the old one until somebody remembered to go and fix it. These
// are the same constants the server bills from, so the page and the charge
// cannot disagree. Nothing here is a secret.
// ============================================================================
import { PLANS, PAID_PLAN, PRICE_MONTH, PRICE_YEAR,
         TOPUP_CREDITS, TOPUP_PRICE, lowMark, lastMark } from './_lib/core.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    siteUrl: process.env.SITE_URL || '',
    pricing: {
      plan_credits:  PLANS[PAID_PLAN].credits,
      trial_credits: PLANS.trial.credits,
      price_month:   PRICE_MONTH,
      price_year:    PRICE_YEAR,
      topup_credits: TOPUP_CREDITS,
      topup_price:   TOPUP_PRICE,
      // The warning ladder, so the sales page stops naming marks the app
      // stopped using. It said 30 and 10 while the app warned at 20 and 7.
      low_mark:        lowMark(PLANS[PAID_PLAN].credits),
      last_mark:       lastMark(PLANS[PAID_PLAN].credits),
      trial_low_mark:  lowMark(PLANS.trial.credits),
      trial_last_mark: lastMark(PLANS.trial.credits)
    }
  }));
}
