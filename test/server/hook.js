process.env.STRIPE_PRICE_MONTHLY = 'price_month';
import handler from './api/hook.real.js';
import { makeDb } from './fakedb.js';
import { PLANS } from './api/_lib/core.js';

const TRIAL = PLANS.trial.credits;
const live = (extra = {}) => ({ id:'evt_bank', type:'customer.subscription.created',
  data:{object:{ id:'sub_1', customer:'cus_1', status:'active',
    items:{data:[{price:{id:'price_month'}, current_period_end: 0}]},
    cancel_at_period_end:false, ...extra }} });

const out = [];
const check = (n, ok, d) => { out.push({n, ok}); console.log((ok?'  PASS  ':'  FAIL  ')+n+(ok||!d?'':'\n          '+d)); };

const P = extra => ({ id:'u1', stripe_customer_id:'cus_1', plan:'trial',
  subscription_status:null, credits_used:0, credits_extra:0, is_admin:false,
  period_start:'2026-09-01T00:00:00Z',
  trial_ends_at:new Date(Date.now()+11*86400000).toISOString(), ...extra });

function res(){ const r={code:0,body:'',status(c){r.code=c;return r;},send(b){r.body=b;return r;},setHeader(){}}; return r; }
async function fire(db, event){
  globalThis.__DB__ = db; globalThis.__EVENT__ = event;
  const r = res();
  await handler({ headers:{'stripe-signature':'x'}, on:()=>{}, [Symbol.asyncIterator]: async function*(){ yield Buffer.from('{}'); } }, r);
  return r;
}
const topup = (paid, amount, id='evt_1') => ({ id, type:'checkout.session.completed',
  data:{object:{ id:'cs_1', mode:'payment', customer:'cus_1',
    payment_status: paid ? 'paid' : 'unpaid', metadata:{topup:String(amount)} }} });

// ---------- a paid pack
{
  const db = makeDb(P());
  const r = await fire(db, topup(true, 50));
  check('a paid top-up grants the credits', db.state.profile.credits_extra === 50,
    'extra=' + db.state.profile.credits_extra);
  check('and answers Stripe with success', r.code === 200, String(r.code));
  check('and writes one receipt', db.state.events.length === 1, JSON.stringify(db.state.events));
}

// ---------- Stripe says it again
{
  const db = makeDb(P(), {duplicateEvent:true});
  db.state.profile.credits_extra = 50;
  const r = await fire(db, topup(true, 50));
  check('a redelivery grants nothing further', db.state.profile.credits_extra === 50,
    'extra=' + db.state.profile.credits_extra + ' (should stay 50)');
  check('and is accepted rather than retried forever', r.code === 200, String(r.code));
}

// ---------- not actually paid
{
  const db = makeDb(P());
  await fire(db, topup(false, 50));
  check('an unpaid session grants nothing', db.state.profile.credits_extra === 0,
    'extra=' + db.state.profile.credits_extra);
}

// ---------- nonsense amount
{
  const db = makeDb(P());
  await fire(db, topup(true, 'lots'));
  check('a nonsense amount grants nothing', db.state.profile.credits_extra === 0,
    'extra=' + db.state.profile.credits_extra);
}

// ---------- no matching account yet
{
  const db = makeDb(P({stripe_customer_id:'cus_other'}));
  const r = await fire(db, topup(true, 50));
  check('an unmatched customer is retried, not swallowed', r.code === 503,
    r.code + ' (200 here means the customer paid and got nothing)');
}

// ---------- a checkout that needs card verification
{
  const db = makeDb(P());
  const before = db.state.profile.trial_ends_at;
  await fire(db, { id:'evt_2', type:'customer.subscription.created',
    data:{object:{ id:'sub_1', customer:'cus_1', status:'incomplete',
      items:{data:[{price:{id:'price_x'}, current_period_end: 0}]}, cancel_at_period_end:false }} });
  check('an incomplete subscription does not end the trial',
    db.state.profile.plan === 'trial',
    "plan=" + db.state.profile.plan + "  <-- 'none' here loses the rest of the trial");
  check('and the trial date is untouched', db.state.profile.trial_ends_at === before);
}

/* ---------- the trial's leftovers follow the writer
   Twelve left of the free twenty five, then subscribe, and you have a hundred
   and twelve. If this ever breaks, subscribing before the trial runs out is a
   worse deal than burning it first, which is the wrong lesson for the product
   to teach and the kind of thing nobody notices for months. */
{
  const db = makeDb(P({credits_used: TRIAL - 12}));
  await fire(db, live());
  const p = db.state.profile;
  check('subscribing banks what the trial had left', p.credits_extra === 12,
    'extra=' + p.credits_extra + ' (expected 12)');
  check('and the paid month starts at nothing used', p.credits_used === 0,
    'used=' + p.credits_used + '  <-- the new month must not inherit the trial spend');
  check('and the month is re-dated so it does not roll over immediately',
    new Date(p.period_start) > new Date('2026-09-01T00:00:00Z'), p.period_start);
}

// ---------- a spent trial banks nothing, and never a negative
{
  const db = makeDb(P({credits_used: TRIAL + 4}));
  await fire(db, live());
  check('an overspent trial banks nothing rather than a negative',
    db.state.profile.credits_extra === 0, 'extra=' + db.state.profile.credits_extra);
}

// ---------- and only once, ever
{
  const db = makeDb(P({credits_used: TRIAL - 12}));
  await fire(db, live());
  await fire(db, { ...live(), type:'customer.subscription.updated' });
  await fire(db, { ...live(), type:'customer.subscription.updated' });
  check('a card change later does not hand out the leftovers again',
    db.state.profile.credits_extra === 12,
    'extra=' + db.state.profile.credits_extra
    + '  <-- updated fires on every renewal for the life of the account');
}

// ---------- somebody already paying is not re-banked
{
  const db = makeDb(P({plan:'beatfall', subscription_status:'active', credits_used: 40}));
  await fire(db, { ...live(), type:'customer.subscription.updated' });
  const p = db.state.profile;
  check('an existing subscriber is left alone', p.credits_extra === 0 && p.credits_used === 40,
    'extra=' + p.credits_extra + ' used=' + p.credits_used);
}

// ---------- a real cancellation still ends it
{
  const db = makeDb(P({plan:'beatfall', subscription_status:'active'}));
  await fire(db, { id:'evt_3', type:'customer.subscription.deleted',
    data:{object:{ id:'sub_1', customer:'cus_1', status:'canceled' }} });
  check('a genuine cancellation does end the plan', db.state.profile.plan === 'none',
    'plan=' + db.state.profile.plan);
  check('and records the status', db.state.profile.subscription_status === 'canceled');
}

const failed = out.filter(r => !r.ok);
console.log('\n' + (out.length - failed.length) + ' of ' + out.length + ' passed');
if (failed.length) { console.log('\nFAILED:'); failed.forEach(f=>console.log('  '+f.n)); process.exit(1); }
