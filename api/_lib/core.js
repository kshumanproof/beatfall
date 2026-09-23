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
  beatfall: { name: 'Beatfall', credits: 75,  price: 15 },
  owner:    { name: 'Owner',    credits: OWNER_ALLOWANCE, price: 0 },
  none:     { name: 'No plan',  credits: 0,   price: 0  }
};

export const PAID_PLAN   = 'beatfall';
export const PRICE_MONTH = 15;
export const PRICE_YEAR  = 149;

/* 16 September: 100 for $12 became 75 for $15, and the year went 99 to 149.
   Two reasons, and the second is the real one.

   The allowance was never binding. A script taken seriously is about 25
   credits: read the notes in, talk through fifteen empty beats, interview four
   characters. At 100 that is four whole scripts a month and nobody ever met
   the ceiling, so the credit numbers were not doing any pricing work at all.
   At 75 a busy two-script month reaches it, which is where a ceiling belongs:
   invisible to an ordinary month, felt by a heavy one.

   And the year at 149 is two months free rather than the 28 per cent 99 was.
   Annual subscribers are the least likely to leave, so they needed the
   shallowest discount, not the deepest.

   NONE OF THIS CHANGES WHAT STRIPE CHARGES. These numbers are what the site
   SAYS. Stripe bills whatever the price objects behind STRIPE_PRICE_MONTHLY
   and STRIPE_PRICE_ANNUAL say. Move one without the other and the product
   lies about its own price. */

/* A top-up is priced ABOVE the subscription rate on purpose. The plan is
   75 for $15, twenty cents a credit; a pack is 25 for $6, twenty-four cents.
   Selling packs cheaper than the plan teaches people to skip the plan and
   makes the subscription look like the worse deal, which is what 100 for $6
   was doing.

   THE SIZE IS CONSTRAINED BY ARITHMETIC NOW. At a twenty cent plan rate a $6
   pack cannot exceed 29 credits without undercutting the plan, so the old 40
   would need $9. Kris ruled that out for a better reason than price: banked
   credits never expire, so a 40 pack against a 75 allowance leaves a surplus
   that rolls up month after month until a heavy user never has to buy again.
   25 is sized to one script, which is what the overflow actually looks like. */
export const TOPUP_CREDITS = 25;
export const TOPUP_PRICE   = 6;

// The two low-credit marks, as a SHARE of whatever allowance they are applied
// to. 30 and 10 were set against the 150 a paid month used to carry, and a
// flat 30 fired the low warning on a trial that had never spent anything. So
// the marks are the fifth and the fifteenth those numbers always meant: at 100
// they are 20 and 7, at the trial's 25 they are 5 and 2.
//
// The client carries its own copy of this in app.html, deliberately, because
// the pill has to be right before /api/account answers. These live here so
// that billing.html - a signed-out page that cannot ask what a plan costs -
// can print the real marks instead of the two numbers that were typed into it
// in front of an allowance that has since moved. Keep the two in step.
export const LOW_NOTICE  = 30;
export const LAST_NOTICE = 10;
export const lowMark  = a => Math.min(LOW_NOTICE,  Math.max(1, Math.round(a * 0.20)));
export const lastMark = a => Math.min(LAST_NOTICE, Math.max(1, Math.round(a * 0.07)));

// A credit is one piece of work, not one message. A conversation costs the
// same whether it takes two questions or five. Charging per turn would teach
// writers to answer in three words to save money, which wrecks the input the
// whole feature depends on. Calls carrying a session id are billed once.
export const COST = {           // credits per action
  place: 0, route: 0,

  /* THE FLOOR IS 2. Nothing that calls the model costs less than this, because
     the cheapest thing in here is still a real call somebody pays for.

     A set of ideas sits on the floor beside a conversation even though a
     conversation runs many more turns. That is deliberate. It is one call, it
     is the fastest thing in the app, the writer may take none of the three it
     offers, and it is how somebody finds out the app is any good. It should be
     the control people press without doing arithmetic first. */
  conversation: 2, ideas: 2,

  /* A logline and a character interview both hand back a finished piece of
     work rather than a placement, so they carry a credit more. The interview is
     up to ten questions and one write-up, all on one session id, so it bills
     once at three. Typing the sheet in yourself is free and stays free: the
     charge is for the questions, not for the feature. */
  logline: 3, character: 3,

  /* Reading in a pile of notes is the heaviest thing in here by a wide margin,
     up to 150 turns against 24 for everything else, and it is the one action
     that could actually cost more upstream than it charges. At 5 it is a
     little over two conversations, and it is still far and away the cheapest
     way to fill a board from nothing. */
  import: 5
};

/* A FREE ACTION IS STILL AN ACTION SOMEBODY PAYS FOR.
 *
 * Placing a note costs 0 credits and should. But a price of zero used to
 * switch off every limit in the proxy at once, because the charge, the balance
 * check and the session ceiling all hang off `credits > 0`. Free meant
 * unmetered, and unmetered meant any signed-in account could sit in a loop on
 * /api/claude spending real money upstream with nothing in the way.
 *
 * Free stays free. It is bounded rather than unlimited now: a rolling hourly
 * count of the zero-priced kinds, per account. Placing a note is one
 * deliberate press, so this is far above a hard day's work and far below
 * anything worth pointing a script at. It is not a pricing number and does not
 * appear on any page. */
export const FREE_PER_HOUR = 200;

// Anthropic list price for the model we use, in dollars per million tokens.
// Update these two numbers if pricing moves; everything downstream follows.
export const MODEL       = 'claude-haiku-4-5';
export const PRICE_IN    = 1;
export const PRICE_OUT   = 5;

export const costMicros = (tin, tout) =>
  Math.round((tin / 1e6) * PRICE_IN * 1e6 + (tout / 1e6) * PRICE_OUT * 1e6);

// -------------------------------------------------------------------- auth --
// Every protected web route calls this. It verifies both the Supabase session
// and the browser installation that currently owns the account's web session.
// A future mobile capture endpoint must opt out with { webDevice: false }:
// mobile appends incoming notes and must never take ownership away from the
// desktop board.
export async function requireUser(req, options = {}) {
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
    /* The insert's error was discarded and there is no on-conflict here, unlike
       the database trigger. A first request that races that trigger loses the
       primary-key race, gets back null, and the very next line dereferences it:
       a brand-new writer's first ever call to Beatfall answers with a crash. */
    if (!profile) {
      const { data: raced } = await db.from('profiles').select('*').eq('id', user.id).single();
      profile = raced;
    }
    if (!profile) return { error: 'profile_unavailable', status: 503 };
    /* This is a fallback, not the normal path, and the comment here used to say
       otherwise. `handle_new_user` fires on auth.users and writes both the
       profile row and a `signed_up` event, so by the time this runs the row is
       already there and this branch is not reached. It is reached only when
       that trigger did not run, which is worth its own name rather than being
       counted as an ordinary signup. */
    track(db, user.id, 'profile_recreated');
  }

  /* The month rolls on the writer's OWN day, not on the 1st.

     It used to reset for everybody on the first of the calendar month, and
     that quietly gave away an allowance: sign up on the 28th and you had 75
     credits for three days and a fresh 75 on the 1st. A hundred and fifty in
     your first week for one month's money.

     It also matters more now that annual exists. An annual subscriber pays
     once and draws a monthly allowance, so their allowance has to come back on
     a date that means something to them rather than on a calendar boundary
     they never agreed to.

     The anchor is the day of the month they signed up, which is always present
     and never moves. It is not literally their Stripe billing day for someone
     who trialled for a fortnight first, and it does not need to be: what it
     has to guarantee is twelve refills a year on a fixed, predictable day. */
  const periodStartFor = (anchorISO, now) => {
    const day = new Date(anchorISO).getUTCDate();
    const on = (y, m) => {
      // The 31st in a 30 day month lands on the last day of it rather than
      // skidding into the next one, which is what setUTCDate(31) would do.
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      return new Date(Date.UTC(y, m, Math.min(day, last), 0, 0, 0, 0));
    };
    let start = on(now.getUTCFullYear(), now.getUTCMonth());
    if (start > now) start = on(now.getUTCFullYear(), now.getUTCMonth() - 1);
    return start;
  };
  const periodStart = periodStartFor(profile.created_at || profile.period_start, new Date());

  /* The reset is conditional in the database, not just in this `if`. Filtered
     on the id alone, two requests landing together on the rollover both saw
     last month's period_start, and the second one wrote credits_used back to
     zero after the first had already spent against it. Now only one of them
     can match, and the loser re-reads rather than keeping a stale row. */
  if (new Date(profile.period_start) < periodStart) {
    const { data: rolled } = await db.from('profiles')
      .update({ period_start: periodStart.toISOString(), credits_used: 0 })
      .eq('id', user.id).lt('period_start', periodStart.toISOString())
      .select().maybeSingle();
    if (rolled) profile = rolled;
    else {
      const { data: fresh } = await db.from('profiles').select('*').eq('id', user.id).single();
      profile = fresh || profile;
    }
  }

  if (options.webDevice !== false) {
    const rawDevice = req.headers['x-beatfall-device'];
    const device = Array.isArray(rawDevice) ? rawDevice[0] : String(rawDevice || '').trim();
    if (!/^[A-Za-z0-9_-]{16,120}$/.test(device)) {
      return { error: 'device_required', status: 409, db, user, profile };
    }
    if (!profile.active_web_device_id || profile.active_web_device_id !== device) {
      return { error: 'device_replaced', status: 409, db, user, profile };
    }
  }

  db.from('profiles').update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id).then(() => {}, () => {});

  return { db, user, profile };
}

/* What plan is this person actually on right now, and what does it allow?
 *
 * TWO SWITCHES, NOT ONE. `is_unlimited` is the Owner plan: boards that never
 * close and credits that never run out. `is_admin` is the door to the admin
 * portal. They used to be the same flag, which meant the person who can read
 * the platform's numbers was necessarily also the person writing scripts on
 * it, and there was no way to have one without the other.
 *
 * Kris wanted them apart: an address that can see the numbers and nothing
 * else, and a writing account that never touches them. Keeping it as one flag
 * made that impossible, so the flag became two. Anything asking "may this
 * person use Beatfall" asks about is_unlimited; anything asking "may this
 * person see everybody's Beatfall" asks about is_admin. */
export function entitlement(profile) {
  // The owner is not a customer. Without this, the person who built the thing
  // gets locked out of it fourteen days after launch by his own trial clock.
  if (profile.is_unlimited) {
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
  // `monthly` comes with the subscription, resets on the writer's own day of
  // the month, and whatever is left of it evaporates. `banked` is what they bought: it never renews and
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
// order fixed here is the whole point. Spending banked credits first would
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

/* Applying a spend, safely against itself.

   `spend()` composes an ABSOLUTE new balance from the profile the request read
   at the start. Two calls in flight both read the same starting figure and both
   write the same ending figure, so one credit pays for both - and twenty
   parallel calls with one credit left all ran, all passed the check, and all
   wrote the same number.

   This applies the patch only if the row still holds the values it was computed
   from, and starts again from a fresh read when it does not. No new database
   objects and no migration: the condition is the values themselves.

   Returns {ok:true, profile} once applied, or {ok:false, reason} when the
   balance genuinely will not cover it. */
export async function charge(db, userId, profile, ent, n) {
  if (!n || n <= 0) return { ok: true, profile };

  let current = profile, entitled = ent;
  for (let attempt = 0; attempt < 4; attempt++) {
    const patch = spend(current, entitled, n);
    if (!patch) return { ok: false, reason: 'insufficient' };
    if (!Object.keys(patch).length) return { ok: true, profile: current, took: {monthly: 0, banked: 0} };
    // Which bucket each credit came out of, so it can go back to the same one.
    const took = {
      monthly: Math.min(n, entitled.monthlyLeft),
      banked:  Math.max(0, n - entitled.monthlyLeft)
    };

    const { data, error } = await db.from('profiles').update(patch)
      .eq('id', userId)
      .eq('credits_used',  current.credits_used  || 0)
      .eq('credits_extra', current.credits_extra || 0)
      .select('*').maybeSingle();
    if (data) return { ok: true, profile: data, took };
    /* No row and no error means the condition did not match: somebody moved the
       balance, so read it again and work the charge out from there. An ERROR is
       a different thing entirely - the write may well have landed and the reply
       was lost - and retrying that would charge twice. */
    if (error) return { ok: false, reason: 'unavailable' };

    // Somebody else moved the balance between the read and the write. Take the
    // new one and work out the charge again from there.
    const { data: fresh } = await db.from('profiles')
      .select('*').eq('id', userId).single();
    if (!fresh) return { ok: false, reason: 'unavailable' };
    current = fresh;
    entitled = entitlement(fresh);
  }
  return { ok: false, reason: 'busy' };
}

/* Putting credits back, for work that was charged and then did not happen.

   The charge has to be applied BEFORE the upstream call, because a check at the
   start and a debit at the end lets twenty parallel requests all pass the check
   and all do the work. That trade brings its own duty: if the work then fails,
   the credits go back. Same compare-and-set as charge(), for the same reason. */
export async function refund(db, userId, took) {
  const fromMonthly = Math.max(0, (took && took.monthly) || 0);
  const fromBanked  = Math.max(0, (took && took.banked)  || 0);
  if (!fromMonthly && !fromBanked) return { ok: true };

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: row } = await db.from('profiles')
      .select('credits_used, credits_extra').eq('id', userId).single();
    if (!row) return { ok: false };

    /* Each bucket gets back exactly what came out of it. Refunding the total
       into whichever bucket had room looked equivalent and is not: a bought
       credit that comes back as a monthly one has quietly become a credit that
       expires on the reset day, and the writer paid for one that never does. */
    const patch = {
      credits_used:  Math.max(0, (row.credits_used || 0) - fromMonthly),
      credits_extra: (row.credits_extra || 0) + fromBanked
    };
    const { data } = await db.from('profiles').update(patch)
      .eq('id', userId)
      .eq('credits_used',  row.credits_used  || 0)
      .eq('credits_extra', row.credits_extra || 0)
      .select('id').maybeSingle();
    if (data) return { ok: true };
  }
  return { ok: false };
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

/* ---------------------------------------------------------------- events --
   One rule decides what may be written here, and it is not a guideline: this
   table never holds anything a writer wrote. No card text, no note text, no
   logline, no project title, no filename, no prompt, no model response. It
   holds counts, buckets, enum names, booleans and durations. If a value could
   ever be a sentence somebody wrote, it does not go in props.

   SAFE_PROPS is the whole allowed vocabulary, and anything outside it is
   dropped rather than trusted, because the call sites are spread across the
   app and a well-meaning `{title: proj.name}` somewhere is exactly how a
   promise in the Privacy Policy quietly stops being true. Numbers are kept,
   strings are capped at 64 characters and only allowed for the keys that are
   enums by nature.

   Writes are fire-and-forget on purpose. Analytics must never be able to fail
   a request a writer is waiting on. */
const SAFE_PROPS = {
  // enum-ish strings
  choice: 1, kind: 1, plan: 1, source: 1, medium: 1, campaign: 1, method: 1,
  stage: 1, operation: 1, error_code: 1, export_type: 1, source_type: 1,
  reason_code: 1, credit_bucket: 1, confidence: 1, structure_changed: 1,
  path: 1, cta: 1, format: 1, new_or_returning: 1, first_touch_source: 1,
  // numbers
  count: 1, item_count: 1, file_count: 1, duration_ms: 1, credit_amount: 1,
  items_bucket: 1, status: 1,
  // booleans
  first_time: 1, sample: 1, authenticated: 1, had_user_content: 1,
  include_title: 1, unlimited: 1
};

const ENUM_MAX = 64;

export function cleanProps(props) {
  const out = {};
  if (!props || typeof props !== 'object') return out;
  for (const [k, v] of Object.entries(props)) {
    if (!SAFE_PROPS[k] || v === null || v === undefined) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, ENUM_MAX);
  }
  return out;
}

export function track(db, userId, name, props = {}, meta = {}) {
  const row = { user_id: userId, name: String(name).slice(0, 60), props: cleanProps(props) };
  if (meta.event_id)   row.event_id   = String(meta.event_id).slice(0, 64);
  if (meta.anon_id)    row.anon_id    = String(meta.anon_id).slice(0, 64);
  if (meta.session_id) row.session_id = String(meta.session_id).slice(0, 64);
  db.from('events').insert(row).then(() => {}, () => {});
}

/* ------------------------------------------------------------- the chain --
 * A day counts when the writer CHANGED something, and it counts wherever they
 * changed it: a board edited at the desk, a note caught on a phone. It used to
 * live in one browser's local storage, so a new laptop wiped the streak and a
 * night of captures counted for nothing.
 *
 * The DAY is the writer's own local date, sent by whichever client did the
 * work, because a line written at eleven at night in Georgia is tonight's
 * work and not tomorrow's. A server that decided this from UTC would tell
 * half the country they had skipped a day.
 *
 * Never awaited by anything that matters. A streak is a nudge; it does not get
 * to fail a save.
 */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function localDay(v) {
  const s = String(v || '').trim();
  return DAY_RE.test(s) ? s : new Date().toISOString().slice(0, 10);
}

export function markWorkDay(db, userId, day) {
  try {
    db.from('work_days')
      .upsert({ user_id: userId, day: localDay(day) }, { onConflict: 'user_id,day' })
      .then(() => {}, () => {});
  } catch (e) {}
}

/* The last 90 days the writer worked, newest first, as plain YYYY-MM-DD. The
 * client turns this into a run and seven dots; the server does not need an
 * opinion about what a streak is worth. */
/* 400, not 90. At 90 a writer who showed up every day for a year was told they
   had a 90 day streak, because this is where the ceiling actually was: the run
   is counted from the days this returns, so the fetch was the cap. 400 covers
   thirteen months and is about 8KB on the wire. THE CLIENT'S OWN LIMIT HAS TO
   MATCH: see CHAIN_MAX in public/app.html. */
/* ============================================================================
   TAKING SOMEBODY'S PHOTOGRAPHS AWAY, PROPERLY.

   This lives here, and takes the bucket as an argument, because it has to be
   called from TWO places and the second one was missed.

   Rows in public.images cascade off the user row. Files in a storage bucket do
   not: they have no foreign key to cascade from. So the files must go FIRST,
   while the rows that say where they are still exist. Delete the user first
   and the rows vanish and the photographs stay in the bucket forever,
   unreferenced and unreachable by anything.

   The nightly sweep got that right. `api/account.js`, which is the button an
   actual person presses in their own settings, did not: it cancelled Stripe
   and deleted the user, and left every picture behind. Kris found it by asking
   whether deleting an account removes the photographs. The privacy page
   promises it does, and the path people actually use was the one that did not
   honour it.

   One copy, called from both. If a third way to delete an account ever exists,
   it calls this too.
   ============================================================================ */
export const IMAGE_BUCKET = 'vision';

export async function dropImages(db, store, userId) {
  const { data: rows } = await db.from('images')
    .select('path, bytes').eq('user_id', userId);
  if (!rows || !rows.length) return { files: 0, bytes: 0 };

  const paths = rows.map(r => r.path).filter(Boolean);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await store.remove(paths.slice(i, i + 100));
    /* Stop on a storage failure rather than deleting the rows anyway. A row
       with no file is untidy and self-correcting; a file with no row is
       unfindable forever, which is the one outcome this whole function exists
       to prevent. */
    if (error) { console.error('image sweep failed', userId, error); return null; }
  }
  await db.from('images').delete().eq('user_id', userId);
  return { files: rows.length, bytes: rows.reduce((n, r) => n + (r.bytes || 0), 0) };
}

export async function workDays(db, userId, limit = 400) {
  const { data } = await db.from('work_days')
    .select('day').eq('user_id', userId)
    .order('day', { ascending: false }).limit(limit);
  return (data || []).map(r => String(r.day).slice(0, 10));
}
