/* api/captures.js end to end, against the stand-in database.
   The questions worth asking of this endpoint are not "does it write a row".
   They are: can a note be lost, can a note be filed into somebody else's
   script, does re-sending a batch double it, and does a lapsed plan silence
   the one part of Beatfall that must never go quiet. */
import captures from './api/captures.real.js';
import { makeDb } from './fakedb.js';

const out = [];
const check = (n, ok, d) => { out.push({n, ok}); console.log((ok?'  PASS  ':'  FAIL  ')+n+(ok||!d?'':'\n          '+d)); };

const P = extra => ({ id:'u1', plan:'beatfall', subscription_status:'active',
  credits_used:0, credits_extra:0, is_admin:false, period_start:'2026-09-01T00:00:00Z',
  trial_ends_at:null, stripe_subscription_id:null, ...extra });

function res(){ const r={code:0,body:null,setHeader(){},status(c){r.code=c;return r;},
  send(b){ try{r.body=JSON.parse(b);}catch(e){r.body=b;} return r;}}; return r; }

async function hit(db, req){
  globalThis.__AUTH__ = { db, user:{id:'u1', email:'w@x.y'}, profile: db.state.profile };
  const r = res(); await captures({headers:{}, ...req}, r); return r;
}
const settle = () => new Promise(r => setTimeout(r, 0));   // markWorkDay is fire and forget

const mine = [{id:'p1', user_id:'u1', name:'Night Haul'}];
const note = (id, extra={}) => ({id, body:'the dog knows first', created_at: Date.now(), ...extra});

// ---------- a batch arrives
{
  const db = makeDb(P(), {projects: mine, captures: [], work_days: []});
  const r = await hit(db, {method:'POST', body:{captures:[note('c1'), note('c2', {project_id:'p1', project_name:'Night Haul'})], day:'2026-09-11'}});
  check('a batch is accepted', r.code === 200 && r.body.accepted.length === 2, r.code+' '+JSON.stringify(r.body));
  check('and both notes are stored', db.state.captures.length === 2, JSON.stringify(db.state.captures).slice(0,120));
  check('a note with no script stays unfiled rather than being guessed at',
    db.state.captures[0].project_id === null, JSON.stringify(db.state.captures[0]).slice(0,120));
  check('and one with a script keeps it', db.state.captures[1].project_id === 'p1');
  await settle();
  check('catching a note counts as a day worked',
    db.state.work_days.length === 1 && db.state.work_days[0].day === '2026-09-11',
    JSON.stringify(db.state.work_days));
}

// ---------- the same batch again, which is the normal case on a bad signal
{
  const db = makeDb(P(), {projects: mine, captures: [], work_days: []});
  await hit(db, {method:'POST', body:{captures:[note('c1')]}});
  await hit(db, {method:'POST', body:{captures:[note('c1')]}});
  check('re-sending a batch does not double it', db.state.captures.length === 1,
    db.state.captures.length + ' rows  <-- a phone with no signal re-sends constantly');
}

// ---------- a project id that is not the writer's
{
  const db = makeDb(P(), {projects: mine, captures: [], work_days: []});
  await hit(db, {method:'POST', body:{captures:[note('c1', {project_id:'SOMEBODY-ELSE', project_name:'Their Script'})]}});
  check('a note can never be filed against a script that is not yours',
    db.state.captures[0].project_id === null && db.state.captures[0].project_name === null,
    JSON.stringify(db.state.captures[0]).slice(0,140));
}

// ---------- a lapsed plan
{
  const db = makeDb(P({plan:null, subscription_status:null, trial_ends_at:'2026-01-01T00:00:00Z'}),
                    {projects: mine, captures: [], work_days: []});
  const r = await hit(db, {method:'POST', body:{captures:[note('c1')]}});
  check('capture still works with no plan at all', r.code === 200,
    r.code + '  <-- a lapsed subscription closes the boards, it does not confiscate a thought');
}

// ---------- what the desk is handed
{
  const db = makeDb(P(), {projects: mine, work_days: [{user_id:'u1', day:'2026-09-10'}], captures: [
    {id:'a', user_id:'u1', body:'one',   project_id:'p1', created_at:'2026-09-10T20:00:00Z', sorted_at:null, deleted_at:null},
    {id:'b', user_id:'u1', body:'two',   project_id:null, created_at:'2026-09-10T21:00:00Z', sorted_at:'2026-09-11T09:00:00Z', deleted_at:null},
    {id:'c', user_id:'u1', body:'three', project_id:null, created_at:'2026-09-10T22:00:00Z', sorted_at:null, deleted_at:'2026-09-10T23:00:00Z'},
  ]});
  const r = await hit(db, {method:'GET'});
  const ids = (r.body.captures || []).map(c => c.id);
  check('the desk is handed only what is still waiting', ids.join(',') === 'a',
    'got [' + ids.join(',') + ']  <-- sorted and thrown-away notes must not come back');
  check('and the days worked come with it', Array.isArray(r.body.days) && r.body.days.includes('2026-09-10'),
    JSON.stringify(r.body.days));
}

// ---------- sorting them
{
  const db = makeDb(P(), {projects: mine, work_days: [], captures: [
    {id:'a', user_id:'u1', body:'one', project_id:'p1', created_at:'2026-09-10T20:00:00Z', sorted_at:null, deleted_at:null},
    {id:'b', user_id:'u1', body:'two', project_id:'p1', created_at:'2026-09-10T21:00:00Z', sorted_at:null, deleted_at:null},
  ]});
  const r = await hit(db, {method:'PATCH', body:{sorted:['a'], day:'2026-09-11'}});
  check('sorting marks that note and no other', r.code === 200
    && db.state.captures[0].sorted_at && !db.state.captures[1].sorted_at,
    JSON.stringify(db.state.captures).slice(0,160));
  await settle();
  check('and sorting counts as a day worked too', db.state.work_days.length === 1,
    JSON.stringify(db.state.work_days));
}

// ---------- the same note twice is one note
{
  const db = makeDb(P(), {projects: mine, captures: [], work_days: []});
  await hit(db, {method:'POST', body:{captures:[note('c1', {body:'the dog knows first', project_id:'p1'})]}});
  const r = await hit(db, {method:'POST', body:{captures:[note('c2', {body:'the dog knows first', project_id:'p1'})]}});
  check('an identical note sent again moments later is not stored twice',
    db.state.captures.length === 1,
    db.state.captures.length + ' rows  <-- a hesitant thumb must not become two cards');
  check('and the phone is still told to forget it, or it offers the twin for ever',
    (r.body.accepted || []).includes('c2'), JSON.stringify(r.body));
}

// ---------- but re-sending the SAME id must always work
{
  const db = makeDb(P(), {projects: mine, captures: [], work_days: []});
  await hit(db, {method:'POST', body:{captures:[note('c1')]}});
  const r = await hit(db, {method:'POST', body:{captures:[note('c1')]}});
  check('re-sending the same id is still idempotent, not a duplicate refusal',
    db.state.captures.length === 1 && (r.body.accepted || []).includes('c1'),
    JSON.stringify(r.body) + ' rows=' + db.state.captures.length);
}

// ---------- the same words under a different script are two notes
{
  const db = makeDb(P(), {projects: [{id:'p1',user_id:'u1',name:'A'},{id:'p2',user_id:'u1',name:'B'}],
                          captures: [], work_days: []});
  await hit(db, {method:'POST', body:{captures:[note('c1', {body:'same line', project_id:'p1'})]}});
  await hit(db, {method:'POST', body:{captures:[note('c2', {body:'same line', project_id:'p2'})]}});
  check('the same line under two different scripts stays two notes',
    db.state.captures.length === 2, db.state.captures.length + ' rows');
}

// ---------- the same words, typed differently, are still one note
{
  const db = makeDb(P(), {projects: mine, captures: [], work_days: []});
  await hit(db, {method:'POST', body:{captures:[note('c1', {body:'The dog knows first.', project_id:'p1'})]}});
  await hit(db, {method:'POST', body:{captures:[note('c2', {body:'the dog  knows first', project_id:'p1'})]}});
  check('capitals, spacing and a full stop do not make a second note',
    db.state.captures.length === 1, db.state.captures.length + ' rows');
  const r = await hit(db, {method:'POST', body:{captures:[note('c3', {body:'the dog knows first?', project_id:'p1'})]}});
  check('but a question mark does', db.state.captures.length === 2,
    db.state.captures.length + ' rows');
  check('and the twin is still accepted so the phone lets go of it',
    r.code === 200, String(r.code));
}

// ---------- the desk may park a note in the pile
{
  const db = makeDb(P(), {projects: mine, captures: [], work_days: []});
  const r = await hit(db, {method:'POST', body:{captures:[
    {id:'d1', body:'not this one, not yet', project_id:'p1', source:'desk', created_at: Date.now()}]}});
  check('a note unticked at the desk goes back to the pile',
    r.code === 200 && db.state.captures.length === 1, r.code + ' ' + db.state.captures.length);
  check('and is recorded as coming from the desk',
    db.state.captures[0].source === 'desk', JSON.stringify(db.state.captures[0]).slice(0,120));
  const r2 = await hit(db, {method:'POST', body:{captures:[
    {id:'d2', body:'from a phone', project_id:'p1', source:'nonsense', created_at: Date.now()}]}});
  check('anything else is still a phone note',
    db.state.captures[1].source === 'phone', JSON.stringify(db.state.captures[1]).slice(0,120));
}

// ---------- sorted and thrown away in one breath
{
  const db = makeDb(P(), {projects: mine, captures: [
    {id:'k1', user_id:'u1', body:'keep me', sorted_at:null, deleted_at:null},
    {id:'k2', user_id:'u1', body:'bin me', sorted_at:null, deleted_at:null}],
    work_days: []});
  const r = await hit(db, {method:'PATCH', body:{sorted:['k1'], dropped:['k2'], day:'2026-09-12'}});
  check('one call can place one note and bin another', r.code === 200, String(r.code));
  const k1 = db.state.captures.find(c => c.id === 'k1');
  const k2 = db.state.captures.find(c => c.id === 'k2');
  check('the placed one is marked sorted, not deleted',
    !!k1.sorted_at && !k1.deleted_at, JSON.stringify(k1));
  check('and the binned one is marked deleted, not sorted',
    !!k2.deleted_at && !k2.sorted_at, JSON.stringify(k2));
  const g = await hit(db, {method:'GET'});
  check('neither is ever handed to the desk again',
    (g.body.captures || []).length === 0, JSON.stringify(g.body.captures));
}

// ---------- limits
{
  const db = makeDb(P(), {projects: mine, captures: [], work_days: []});
  const big = Array.from({length: 201}, (_, i) => note('c' + i));
  const r = await hit(db, {method:'POST', body:{captures: big}});
  check('an absurd batch is refused rather than swallowed', r.code === 413, String(r.code));
  const r2 = await hit(db, {method:'POST', body:{}});
  check('and a malformed body is a 400, not a crash', r2.code === 400, String(r2.code));
  const r3 = await hit(db, {method:'DELETE', body:{}});
  check('an unsupported method says so', r3.code === 405, String(r3.code));
}

console.log('\n' + out.filter(o => o.ok).length + ' of ' + out.length + ' passed');
if (out.some(o => !o.ok)) { console.log('\nFAILED:'); out.filter(o => !o.ok).forEach(o => console.log('  ' + o.n)); process.exit(1); }
