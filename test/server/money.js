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

const failed = out.filter(r => !r.ok);
console.log('\n' + (out.length - failed.length) + ' of ' + out.length + ' passed');
if (failed.length) process.exit(1);
