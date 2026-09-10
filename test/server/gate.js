import projects from './api/projects.real.js';
import account from './api/account.real.js';
import { makeDb } from './fakedb.js';

const out = [];
const check = (n, ok, d) => { out.push({n, ok}); console.log((ok?'  PASS  ':'  FAIL  ')+n+(ok||!d?'':'\n          '+d)); };

const P = extra => ({ id:'u1', plan:'beatfall', subscription_status:'active',
  credits_used:0, credits_extra:0, is_admin:false, period_start:'2026-09-01T00:00:00Z',
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

// ---------- the owner
{
  const db = makeDb(P({is_admin:true, plan:'none', subscription_status:null}), {projects: rows});
  const r = await hit(projects, db, {method:'GET'});
  check('the owner is never locked out', r.code === 200 && !r.body.closed,
    r.code + ' closed=' + (r.body||{}).closed);
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

const failed = out.filter(r => !r.ok);
console.log('\n' + (out.length - failed.length) + ' of ' + out.length + ' passed');
if (failed.length) { console.log('\nFAILED:'); failed.forEach(f=>console.log('  '+f.n)); process.exit(1); }
