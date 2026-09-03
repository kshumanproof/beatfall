// ============================================================================
// Shared server-side helpers. Nothing here ever runs in the browser, which is
// the whole point: the Anthropic key and the Supabase service key live only in
// Vercel's environment.
// ============================================================================
import { createClient } from '@supabase/supabase-js';

export const admin = () => createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ------------------------------------------------------------------- plans --
// Credits are the metered unit. Placing a note is free: it costs a fifth of a
// cent and it's the core habit; making someone hesitate before capturing an
// idea would break the product. Conversations and imports are what we count.
const OWNER_ALLOWANCE = 1000000;   // effectively unlimited, without Infinity in JSON

// One paid plan. Tiers are a thing you introduce once you can see a real usage
// distribution on /admin.html, not something a buyer should have to guess at
// before they have used the product once.
export const PLANS = {
  trial:    { name: 'Trial',    credits: 25,  price: 0  },
  beatfall: { name: 'Beatfall', credits: 150, price: 12 },
  owner:    { name: 'Owner',    credits: OWNER_ALLOWANCE, price: 0 },
  none:     { name: 'No plan',  credits: 0,   price: 0  }
};

export const PAID_PLAN   = 'beatfall';
export const PRICE_MONTH = 12;
export const PRICE_YEAR  = 99;
// A top-up is priced ABOVE the subscription rate on purpose. The plan is
// 150 for $12, eight cents a credit; a pack is 50 for $6, twelve cents. Selling
// packs cheaper than the plan teaches people to skip the plan and makes the
// $12 look like the worse deal, which is what 100 for $6 was doing.
export const TOPUP_CREDITS = 50;
export const TOPUP_PRICE   = 6;

// A credit is one piece of work, not one message. A conversation costs the
// same whether it takes two questions or five. Charging per turn would teach
// writers to answer in three words to save money, which wrecks the input the
// whole feature depends on. Calls carrying a session id are billed once.
export const COST = {           // credits per action
  place: 0, route: 0,
  conversation: 1, ideas: 1, logline: 1,
  import: 2
};

// Anthropic list price for the model we use, in dollars per million tokens.
// Update these two numbers if pricing moves; everything downstream follows.
export const MODEL       = 'claude-haiku-4-5';
export const PRICE_IN    = 1;
export const PRICE_OUT   = 5;

export const costMicros = (tin, tout) =>
  Math.round((tin / 1e6) * PRICE_IN * 1e6 + (tout / 1e6) * PRICE_OUT * 1e6);

// -------------------------------------------------------------------- auth --
// Every protected route calls this. It verifies the caller's Supabase session
// token, then loads their profile, rolling the credit period over if a new
// month has started.
export async function requireUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { error: 'not signed in', status: 401 };

  const db = admin();
  const { data: got, error } = await db.auth.getUser(token);
  if (error || !got?.user) return { error: 'not signed in', status: 401 };
  const user = got.user;

  let { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) {
    const { data: made } = await db.from('profiles')
      .insert({ id: user.id, email: user.email }).select().single();
    profile = made;
  }

  // new calendar month → credits reset, topped-up credits carry over
  const startOfMonth = new Date(); startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  if (new Date(profile.period_start) < startOfMonth) {
    const { data: rolled } = await db.from('profiles')
      .update({ period_start: startOfMonth.toISOString(), credits_used: 0 })
      .eq('id', user.id).select().single();
    profile = rolled || profile;
  }

  db.from('profiles').update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id).then(() => {}, () => {});

  return { db, user, profile };
}

// What plan is this person actually on right now, and what does it allow?
export function entitlement(profile) {
  // The owner is not a customer. Without this, the person who built the thing
  // gets locked out of it fourteen days after launch by his own trial clock.
  if (profile.is_admin) {
    const used = profile.credits_used || 0;
    return {
      key: 'owner', plan: PLANS.owner, trialing: false, unlimited: true,
      monthly: OWNER_ALLOWANCE, used, monthlyLeft: OWNER_ALLOWANCE - used, banked: 0,
      allowance: OWNER_ALLOWANCE, left: OWNER_ALLOWANCE - used,
      trialEndsAt: null
    };
  }

  const trialing = profile.plan === 'trial'
    && profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date();
  const paid = ['active', 'trialing', 'past_due'].includes(profile.subscription_status || '');
  const key = paid && PLANS[profile.plan] ? profile.plan : (trialing ? 'trial' : 'none');
  const plan = PLANS[key];

  // Two buckets, and they behave differently on purpose.
  //
  // `monthly` comes with the subscription, resets on the 1st, and whatever is
  // left of it evaporates. `banked` is what they bought: it never renews and
  // it never expires, and it is only touched once the month's is gone.
  //
  // This used to be one number. `allowance` was plan.credits + credits_extra
  // and the reset only zeroed credits_used, so a single $6 top-up quietly
  // raised that account's allowance by 100 credits EVERY MONTH, forever.
  const monthly     = plan.credits;
  const used        = Math.max(0, profile.credits_used || 0);
  const monthlyLeft = Math.max(0, monthly - used);
  const banked      = Math.max(0, profile.credits_extra || 0);

  return {
    key, plan, trialing,
    monthly, used, monthlyLeft, banked,
    allowance: monthly,               // the ceiling the monthly bar fills to
    left: monthlyLeft + banked,       // everything they can actually spend
    trialEndsAt: profile.trial_ends_at
  };
}

// Spend n credits: this month's first, then the ones they paid for. Returns the
// patch to apply to the profile, or null when there isn't enough. Keeping the
// order fixed here is the whole point — spending banked credits first would
// burn what somebody paid for while their free allowance expired unused.
export function spend(profile, ent, n) {
  if (!n || n <= 0) return {};
  if (ent.unlimited) return { credits_used: (profile.credits_used || 0) + n };
  if (ent.left < n) return null;

  const fromMonthly = Math.min(n, ent.monthlyLeft);
  const fromBanked  = n - fromMonthly;
  const patch = {};
  if (fromMonthly) patch.credits_used  = (profile.credits_used  || 0) + fromMonthly;
  if (fromBanked)  patch.credits_extra = (profile.credits_extra || 0) - fromBanked;
  return patch;
}

export function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).send(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export function track(db, userId, name, props = {}) {
  db.from('events').insert({ user_id: userId, name, props }).then(() => {}, () => {});
}
