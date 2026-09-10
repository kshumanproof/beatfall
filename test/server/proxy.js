import handler from './api/claude.real.js';
import { entitlement, PLANS, PAID_PLAN } from './api/_lib/core.js';
const ALL = PLANS[PAID_PLAN].credits;   // not a typed 150, see money.js
import { makeDb } from './fakedb.js';

const out = [];
const check = (n, ok, d) => { out.push({n, ok}); console.log((ok?'  PASS  ':'  FAIL  ')+n+(ok||!d?'':'\n          '+d)); };

const paid = extra => ({ id:'u1', plan:'beatfall', subscription_status:'active',
  credits_used:0, credits_extra:0, is_admin:false, period_start:'2026-09-01T00:00:00Z',
  trial_ends_at:null, ...extra });

function res() {
  const r = { code:0, body:null, headers:{},
    setHeader(k,v){ r.headers[k]=v; },
    status(c){ r.code=c; return r; },
    send(b){ try { r.body = JSON.parse(b); } catch(e){ r.body = b; } return r; } };
  return r;
}

async function call(db, body, { upstream = 'ok', reply } = {}) {
  globalThis.__AUTH__ = { db, user:{id:'u1', email:'w@x.y'}, profile: db.state.profile };
  globalThis.__TRACKED__ = [];
  globalThis.fetch = async () => {
    if (upstream === 'network') throw new Error('socket hang up');
    if (upstream === 'error') return { ok:false, status:500, text: async () => 'boom' };
    return { ok:true, status:200, json: async () => reply || {
      content:[{type:'text', text:'{"ok":true}'}], usage:{input_tokens:100, output_tokens:50} } };
  };
  const r = res();
  await handler({ method:'POST', headers:{}, body }, r);
  return r;
}

// ---------- the ordinary case
{
  const db = makeDb(paid());
  const r = await call(db, {kind:'conversation', input:'what goes in the midpoint?'});
  check('a conversation succeeds', r.code === 200, r.code + ' ' + JSON.stringify(r.body).slice(0,140));
  check('and costs one credit', db.state.profile.credits_used === 1, JSON.stringify(db.state.profile));
  check('the answer comes back', r.body && typeof r.body.text === 'string', JSON.stringify(r.body).slice(0,100));
  check('and the balance it reports is the real one',
    r.body.credits_left === ALL - 1, 'reported ' + (r.body||{}).credits_left);
  check('a usage row is written', db.state.usage.length === 1, JSON.stringify(db.state.usage));
}

// ---------- the rest of a conversation is free
{
  const db = makeDb(paid());
  await call(db, {kind:'conversation', session:'s1', input:'one'});
  const used1 = db.state.profile.credits_used;
  await call(db, {kind:'conversation', session:'s1', input:'two'});
  await call(db, {kind:'conversation', session:'s1', input:'three'});
  check('the first turn of a session pays', used1 === 1, 'used=' + used1);
  check('and the rest of it is free', db.state.profile.credits_used === 1,
    'used=' + db.state.profile.credits_used);
}

// ---------- a free action cannot buy a paid one
{
  const db = makeDb(paid());
  await call(db, {kind:'place', session:'x', input:'a note'});
  check('placing a note is free', db.state.profile.credits_used === 0);
  await call(db, {kind:'import', session:'x', input:'a whole file'});
  check('and does not pay for the import that reuses its session',
    db.state.profile.credits_used === 2, 'used=' + db.state.profile.credits_used + ' (should be 2)');
}

// ---------- one kind cannot pay for another
{
  const db = makeDb(paid());
  await call(db, {kind:'conversation', session:'y', input:'one'});
  await call(db, {kind:'import', session:'y', input:'a file'});
  check('a conversation does not pay for an import on the same session',
    db.state.profile.credits_used === 3, 'used=' + db.state.profile.credits_used + ' (1 + 2)');
}

// ---------- out of credits, before any model call
{
  const db = makeDb(paid({credits_used:ALL}));
  let reached = false;
  globalThis.fetch = async () => { reached = true; throw new Error('should never run'); };
  const r = await call(db, {kind:'conversation', input:'hello'});
  check('an empty account is refused', r.code === 402, r.code + ' ' + JSON.stringify(r.body).slice(0,90));
  check('and the model is never called', reached === false);
}

// ---------- the work fails, so the credits come back
{
  const db = makeDb(paid());
  const r = await call(db, {kind:'import', input:'a file'}, {upstream:'error'});
  check('an upstream failure is a 502', r.code === 502, String(r.code));
  check('and the credits are given back', db.state.profile.credits_used === 0,
    'used=' + db.state.profile.credits_used + ' (charged 2 then refunded)');
}
{
  const db = makeDb(paid());
  const r = await call(db, {kind:'conversation', input:'x'}, {upstream:'network'});
  check('a network failure is a 502', r.code === 502, String(r.code));
  check('and those credits come back too', db.state.profile.credits_used === 0,
    'used=' + db.state.profile.credits_used);
}

// ---------- an unknown action
{
  const db = makeDb(paid());
  const r = await call(db, {kind:'toString', input:'x'});
  check('an unknown kind is refused rather than priced at a guess',
    r.code === 400, r.code + ' ' + JSON.stringify(r.body).slice(0,80));
  check('and costs nothing', db.state.profile.credits_used === 0);
}

// ---------- a long conversation must not open on the assistant
{
  const db = makeDb(paid());
  let sent = null;
  globalThis.__AUTH__ = { db, user:{id:'u1'}, profile: db.state.profile };
  globalThis.fetch = async (u, o) => { sent = JSON.parse(o.body); return { ok:true, status:200,
    json: async () => ({content:[{type:'text',text:'hi'}], usage:{input_tokens:1,output_tokens:1}}) }; };
  const big = 'w'.repeat(30000);
  const r = res();
  await handler({ method:'POST', headers:{}, body:{kind:'conversation', input:[
    {role:'user', content:'old one'}, {role:'assistant', content:'old reply'},
    {role:'user', content:big}, {role:'assistant', content:big}, {role:'user', content:'now'}
  ]}}, r);
  check('a long thread is still accepted', r.code === 200, String(r.code));
  check('and never opens on the assistant',
    sent && sent.messages[0].role === 'user',
    sent ? sent.messages.map(m=>m.role).join(',') : 'nothing sent');
  check('and ends on the user', sent && sent.messages[sent.messages.length-1].role === 'user');
}

// ---------- an empty turn must not eat the history
{
  const db = makeDb(paid());
  let sent = null;
  globalThis.__AUTH__ = { db, user:{id:'u1'}, profile: db.state.profile };
  globalThis.fetch = async (u, o) => { sent = JSON.parse(o.body); return { ok:true, status:200,
    json: async () => ({content:[{type:'text',text:'hi'}], usage:{input_tokens:1,output_tokens:1}}) }; };
  const r = res();
  await handler({ method:'POST', headers:{}, body:{kind:'conversation', input:[
    {role:'user', content:'the first thing'}, {role:'assistant', content:''},
    {role:'user', content:'the last thing'}
  ]}}, r);
  check('an empty turn does not discard what came before it',
    sent && sent.messages.some(m => /the first thing/.test(m.content)),
    sent ? JSON.stringify(sent.messages.map(m=>m.content.slice(0,20))) : 'nothing');
}

const failed = out.filter(r => !r.ok);
console.log('\n' + (out.length - failed.length) + ' of ' + out.length + ' passed');
if (failed.length) { console.log('\nFAILED:'); failed.forEach(f=>console.log('  '+f.n)); process.exit(1); }
