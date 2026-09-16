import { charge, refund, entitlement, spend, PLANS, PAID_PLAN } from './api/_lib/core.js';

/* The allowance a paid month carries. These tests used to type 150, so the
   day the plan moved to 100 four of them failed for the only reason a test
   must never fail: the test was the thing that was out of date. ALL says
   "a full month" and FULL_BUT_ONE says "one credit left", which is what each
   case actually means, at any allowance. */
const ALL = PLANS[PAID_PLAN].credits;
const FULL_BUT_ONE = ALL - 1;
import { makeDb } from './fakedb.js';

const out = [];
const check = (n, ok, d) => { out.push({n, ok}); console.log((ok?'  PASS  ':'  FAIL  ')+n+(ok||!d?'':'\n          '+d)); };

const paid = extra => ({ id:'u1', plan:'beatfall', subscription_status:'active',
  credits_used:0, credits_extra:0, is_admin:false, period_start:'2026-09-01T00:00:00Z',
  trial_ends_at:null, ...extra });

// ---------- an ordinary charge
{
  const db = makeDb(paid());
  const p = db.state.profile, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 1);
  check('a charge applies', r.ok === true, JSON.stringify(r).slice(0,120));
  check('and comes out of the month', db.state.profile.credits_used === 1, JSON.stringify(db.state.profile));
  check('and reports which bucket it came from',
    r.took && r.took.monthly === 1 && r.took.banked === 0, JSON.stringify(r.took));
}

// ---------- the month runs out and the bought credits carry it
{
  const db = makeDb(paid({credits_used:FULL_BUT_ONE, credits_extra:10}));
  const p = db.state.profile, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 2);
  check('a charge spanning both buckets applies', r.ok === true);
  check('the month is spent first',
    db.state.profile.credits_used === ALL && db.state.profile.credits_extra === 9,
    JSON.stringify(db.state.profile));
  check('and the split is reported honestly',
    r.took.monthly === 1 && r.took.banked === 1, JSON.stringify(r.took));
}

// ---------- nothing left
{
  const db = makeDb(paid({credits_used:ALL, credits_extra:0}));
  const p = db.state.profile, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 1);
  check('an empty account is refused', r.ok === false && r.reason === 'insufficient', JSON.stringify(r));
  check('and nothing is taken', db.state.profile.credits_used === ALL);
}

// ---------- somebody moved the balance underneath us
{
  const db = makeDb(paid({credits_used:10}), {raceOnce:true});
  const p = {...db.state.profile}, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 1);
  check('a lost race retries against the new balance', r.ok === true, JSON.stringify(r));
  check('and charges exactly once on top of the other spend',
    db.state.profile.credits_used === 12, 'used=' + db.state.profile.credits_used + ' (10 +1 other +1 ours)');
}

// ---------- the write landed but the reply did not
{
  const db = makeDb(paid(), {failEvery:1});
  const p = db.state.profile, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 1);
  check('a lost reply is not retried as a conflict',
    r.ok === false && r.reason === 'unavailable', JSON.stringify(r));
}

// ---------- twenty at once against one credit
{
  const db = makeDb(paid({credits_used:FULL_BUT_ONE}));
  const results = [];
  for (let i = 0; i < 20; i++) {
    const fresh = {...db.state.profile};
    results.push(await charge(db, 'u1', fresh, entitlement(fresh), 1));
  }
  const okCount = results.filter(r => r.ok).length;
  check('only one of twenty requests can spend the last credit', okCount === 1,
    okCount + ' succeeded; used=' + db.state.profile.credits_used);
  check('and the balance never goes past the allowance',
    db.state.profile.credits_used === ALL, 'used=' + db.state.profile.credits_used);
}

// ---------- putting it back
{
  const db = makeDb(paid({credits_used:FULL_BUT_ONE, credits_extra:10}));
  const p = db.state.profile, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 2);
  const back = await refund(db, 'u1', r.took);
  check('a refund succeeds', back.ok === true);
  check('and each credit goes back where it came from',
    db.state.profile.credits_used === FULL_BUT_ONE && db.state.profile.credits_extra === 10,
    JSON.stringify(db.state.profile) + '  (a bought credit must not return as a monthly one)');
}

// ---------- a refund of nothing
{
  const db = makeDb(paid());
  const back = await refund(db, 'u1', {monthly:0, banked:0});
  check('refunding nothing is a no-op', back.ok === true && db.state.profile.credits_used === 0);
}

// ---------- the owner
{
  const db = makeDb(paid({is_admin:true}));
  const p = db.state.profile, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 2);
  check('the owner is charged without being blocked', r.ok === true, JSON.stringify(r).slice(0,100));
  check('and is never refused for balance', entitlement(db.state.profile).left > 0);
}

// ---------- the numbers printed on the pages
/* Every price and allowance a public page prints is written into the HTML as
   a plain number, so the page is right with no JavaScript at all, and then
   painted over from /api/config once it loads. That printed number is the one
   a search engine indexes and the one somebody with a slow connection reads,
   so it has to agree with what the server actually bills. It is also the one
   nobody remembers to change. This is the check that remembers.

   Kris raised the plan on 16 September and four separate files had to move.
   One of them, the homepage, had been saying the price before last for weeks
   and nothing caught it, because nothing was looking. */
{
  const fs = await import('node:fs');
  const core = await import('./api/_lib/core.js');

  const truth = {
    plan_credits:    core.PLANS[core.PAID_PLAN].credits,
    trial_credits:   core.PLANS.trial.credits,
    price_month:     core.PRICE_MONTH,
    price_year:      core.PRICE_YEAR,
    topup_credits:   core.TOPUP_CREDITS,
    topup_price:     core.TOPUP_PRICE,
    low_mark:        core.lowMark(core.PLANS[core.PAID_PLAN].credits),
    last_mark:       core.lastMark(core.PLANS[core.PAID_PLAN].credits),
    trial_low_mark:  core.lowMark(core.PLANS.trial.credits),
    trial_last_mark: core.lastMark(core.PLANS.trial.credits),
    year_saving:     (core.PRICE_MONTH * 12) - core.PRICE_YEAR
  };

  const pages = ['index.html', 'login.html', 'billing.html', 'settings.html'];
  const wrong = [];
  let found = 0;

  for (const page of pages) {
    const html = fs.readFileSync('../../public/' + page, 'utf8');
    const tag = /data-bf="([a-z_]+)"[^>]*>([^<]*)</g;
    let m;
    while ((m = tag.exec(html))) {
      found++;
      const key = m[1], printed = m[2].trim();
      if (!(key in truth)) { wrong.push(page + ': data-bf="' + key + '" is not a thing config serves'); continue; }
      if (printed !== String(truth[key])) {
        wrong.push(page + ': data-bf="' + key + '" prints ' + printed + ', core.js says ' + truth[key]);
      }
    }
  }

  check('every page is checked for printed prices', found >= 8, 'only found ' + found + ' printed numbers');
  check('and each one agrees with core.js', wrong.length === 0, wrong.join('\n          '));

  // The homepage price sentence is the one people read before they decide.
  // If it ever goes back to being a bare number this fails loudly.
  const home = fs.readFileSync('../../public/index.html', 'utf8');
  check('the homepage price comes from the server, not from typing',
    /data-bf="price_month"/.test(home) && /data-bf="price_year"/.test(home),
    'index.html has a hand-typed price in it again');
}

const failed = out.filter(r => !r.ok);
console.log('\n' + (out.length - failed.length) + ' of ' + out.length + ' passed');
if (failed.length) process.exit(1);
