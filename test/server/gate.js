import projects from './api/projects.real.js';
import account from './api/account.real.js';
import { makeDb } from './fakedb.js';

const out = [];
const check = (n, ok, d) => { out.push({n, ok}); console.log((ok?'  PASS  ':'  FAIL  ')+n+(ok||!d?'':'\n          '+d)); };

const P = extra => ({ id:'u1', plan:'beatfall', subscription_status:'active',
  credits_used:0, credits_extra:0, is_admin:false, is_unlimited:false,
  period_start:'2026-09-01T00:00:00Z',
  trial_ends_at:null, stripe_subscription_id:null, ...extra });

function res(){ const r={code:0,body:null,setHeader(){},status(c){r.code=c;return r;},
  send(b){ try{r.body=JSON.parse(b);}catch(e){r.body=b;} return r;}}; return r; }

async function hit(fn, db, req){
  globalThis.__AUTH__ = { db, user:{id:'u1', email:'w@x.y'}, profile: db.state.profile };
  const r = res(); await fn({headers:{}, ...req}, r); return r;
}

const rows = [{id:'p1', user_id:'u1', name:'Night Haul', structure:'stc', cards:[], outline:{}, characters:[{name:'Dale'}]}];

// ---------- a paying writer
{
  const db = makeDb(P(), {projects: rows});
  const r = await hit(projects, db, {method:'GET'});
  check('a paid account loads its projects', r.code === 200, r.code + ' ' + JSON.stringify(r.body).slice(0,90));
  check('and is NOT told the boards are closed', !r.body.closed,
    'closed=' + r.body.closed + '  <-- this would lock out a paying writer');
}

// ---------- a writer on trial
{
  const db = makeDb(P({plan:'trial', subscription_status:null,
    trial_ends_at:new Date(Date.now()+5*86400000).toISOString()}), {projects: rows});
  const r = await hit(projects, db, {method:'GET'});
  check('a trial account loads its projects', r.code === 200, String(r.code));
  check('and is not locked either', !r.body.closed, 'closed=' + r.body.closed);
}

// ---------- past due is still paid
{
  const db = makeDb(P({subscription_status:'past_due'}), {projects: rows});
  const r = await hit(projects, db, {method:'GET'});
  check('a past-due account still opens', r.code === 200 && !r.body.closed,
    r.code + ' closed=' + (r.body||{}).closed);
}

/* ---------- the owner, and the admin, which are no longer the same account
 *
 * They used to be one flag, so the person who reads the platform's numbers was
 * necessarily also the person writing scripts on it. Two flags now, and each
 * has to work without the other or the split has bought nothing. */
{
  const db = makeDb(P({is_unlimited:true, plan:'none', subscription_status:null}), {projects: rows});
  const r = await hit(projects, db, {method:'GET'});
  check('the owner is never locked out', r.code === 200 && !r.body.closed,
    r.code + ' closed=' + (r.body||{}).closed);
}

/* An address that only reads the numbers gets no boards. This is the point of
   the split: admin is a door to the reports, not a free subscription. */
{
  const db = makeDb(P({is_admin:true, is_unlimited:false, plan:'none',
    subscription_status:null, trial_ends_at:'2026-01-01T00:00:00Z'}), {projects: rows});
  const r = await hit(projects, db, {method:'GET'});
  check('an admin address does not get a free plan with it',
    r.body.closed === true,
    'admin alone opened the boards: ' + JSON.stringify(r.body).slice(0, 120));
}

/* And the reverse. Unlimited is a plan, not a set of keys: it must not let
   somebody into the reports. */
{
  const admin = (await import('./api/admin.real.js')).default;
  const db = makeDb(P({is_unlimited:true, is_admin:false}), {usage:[], projects:[], events:[]});
  globalThis.__DB__ = db;
  const r = await hit(admin, db, {method:'GET'});
  check('an unlimited plan is not a key to the admin portal', r.code === 403, String(r.code));
}

// ---------- a lapsed plan: reads yes, writes no
{
  const db = makeDb(P({plan:'none', subscription_status:'canceled',
    stripe_subscription_id:'sub_1', trial_ends_at:'2026-01-01T00:00:00Z'}), {projects: rows});
  const r = await hit(projects, db, {method:'GET'});
  check('a lapsed account can still READ its work', r.code === 200, String(r.code));
  check('and is told the boards are closed', r.body.closed === true, JSON.stringify(r.body).slice(0,100));
  check('and told it was a plan, not a trial', r.body.reason === 'plan_ended', r.body.reason);
  check('the projects actually come back', (r.body.projects||[]).length === 1,
    'this is what makes the per-board PDF possible');

  const w = await hit(projects, db, {method:'POST', body:{project:{name:'x'}}});
  check('but a write is refused', w.code === 402, String(w.code));
  const d = await hit(projects, db, {method:'DELETE', query:{id:'p1'}});
  check('and so is a delete', d.code === 402, String(d.code));
}

// ---------- an expired trial says trial
{
  const db = makeDb(P({plan:'trial', subscription_status:null,
    trial_ends_at:'2026-01-01T00:00:00Z'}), {projects: rows});
  const r = await hit(projects, db, {method:'GET'});
  check('an expired trial is called a trial', r.body.reason === 'trial_ended', r.body.reason);
}

// ---------- the export
{
  const db = makeDb(P(), {projects: rows});
  const r = await hit(account, db, {method:'POST', body:{action:'export'}});
  check('the export answers', r.code === 200, String(r.code));
  const proj = (r.body.projects||[])[0] || {};
  check('and carries the characters', Array.isArray(proj.characters) && proj.characters.length === 1,
    JSON.stringify(Object.keys(proj)));
  check('and the outline', 'outline' in proj, JSON.stringify(Object.keys(proj)));
}

/* ---------- which doors the phone may come through
   The one-browser lock is for editing, and the phone does not edit here. It
   reads who you are, and it deletes the account, which Apple requires it to
   be able to do and requires to be no harder than on the web. Everything else
   on this endpoint stays locked to one browser. */
{
  const db = makeDb(P(), {projects: rows});

  await hit(account, db, {method:'GET'});
  check('reading the account does not need a browser lock',
    globalThis.__AUTHOPTS__ && globalThis.__AUTHOPTS__.webDevice === false,
    JSON.stringify(globalThis.__AUTHOPTS__));

  await hit(account, db, {method:'POST', body:{action:'rename', display_name:'Kris'}});
  check('renaming still does',
    !globalThis.__AUTHOPTS__ || globalThis.__AUTHOPTS__.webDevice !== false,
    JSON.stringify(globalThis.__AUTHOPTS__));

  await hit(account, db, {method:'POST', body:{action:'export'}});
  check('and so does the export',
    !globalThis.__AUTHOPTS__ || globalThis.__AUTHOPTS__.webDevice !== false,
    JSON.stringify(globalThis.__AUTHOPTS__));

  await hit(account, db, {method:'POST', body:{action:'delete_account', confirm:'w@x.y'}});
  check('deleting the account does not need a browser lock either',
    globalThis.__AUTHOPTS__ && globalThis.__AUTHOPTS__.webDevice === false,
    JSON.stringify(globalThis.__AUTHOPTS__));
  check('and the rename earlier still landed, so reading the body once was enough',
    db.state.profile.display_name === 'Kris', String(db.state.profile.display_name));
}

const failed = out.filter(r => !r.ok);
console.log('\n' + (out.length - failed.length) + ' of ' + out.length + ' passed');
if (failed.length) { console.log('\nFAILED:'); failed.forEach(f=>console.log('  '+f.n)); process.exit(1); }
