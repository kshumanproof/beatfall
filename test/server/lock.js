/* THE ONE-BROWSER LOCK AND THE ADMIN GATE.
 *
 * Two shipped endpoints that had no suite at all. The lock is the one that
 * matters: get it wrong in the careless direction and two browsers fight over
 * one writer's boards, get it wrong in the careful direction and a writer is
 * locked out of their own account with no way back.
 *
 * This suite is also why fakedb's single() had to be fixed. api/session.js
 * claims a browser with .update(...).select().single(), and single() used to
 * skip the write entirely and hand back the row as it was before, so every
 * check here passed against a database that had not changed.
 */
import session from './api/session.real.js';
import admin from './api/admin.real.js';
import { makeDb } from './fakedb.js';
const out=[]; const F=(n,ok,d)=>{out.push({n,ok});console.log((ok?'  PASS  ':'  FAIL  ')+n+(ok||!d?'':'\n          '+String(d).slice(0,400)));};
function res(){const r={code:0,body:null,setHeader(){},status(c){r.code=c;return r;},
  send(b){try{r.body=JSON.parse(b);}catch(e){r.body=b;}return r;}};return r;}
const P=o=>({id:'u1',email:'w@x.y',plan:'beatfall',subscription_status:'active',
  credits_used:0,credits_extra:0,is_admin:false,period_start:'2026-09-01T00:00:00Z',
  trial_ends_at:null,active_web_device_id:null,...o});
const D1='browser_aaaaaaaaaaaaaaaa', D2='browser_bbbbbbbbbbbbbbbb';
async function hit(db,req,fn=session){
  globalThis.__DB__=db; globalThis.__AUTH__={db,user:{id:'u1',email:'w@x.y'},profile:db.state.profile};
  const r=res(); await fn({headers:{},query:{},...req}, r); return r;
}

/* --- claiming --- */
{
  const db=makeDb(P());
  const r=await hit(db,{method:'POST',headers:{'x-beatfall-device':D1}});
  F('a browser can claim the account', r.code===200&&r.body.active===true, r.code+' '+JSON.stringify(r.body));
  F('and the claim is written down', db.state.profile.active_web_device_id===D1, db.state.profile.active_web_device_id);
  const g=await hit(db,{method:'GET',headers:{'x-beatfall-device':D1}});
  F('that browser is told it is the active one', g.body.active===true, JSON.stringify(g.body));
  const g2=await hit(db,{method:'GET',headers:{'x-beatfall-device':D2}});
  F('and a different browser is told it is not', g2.body.active===false, JSON.stringify(g2.body));
}
/* --- takeover --- */
{
  const db=makeDb(P({active_web_device_id:D1}));
  await hit(db,{method:'POST',headers:{'x-beatfall-device':D2}});
  F('a second browser takes the account over', db.state.profile.active_web_device_id===D2,
    db.state.profile.active_web_device_id);
  const g=await hit(db,{method:'GET',headers:{'x-beatfall-device':D1}});
  F('and the first browser is now told it is not active', g.body.active===false, JSON.stringify(g.body));
}
/* --- the old browser signing out must not unseat the new one --- */
{
  const db=makeDb(P({active_web_device_id:D2}));
  await hit(db,{method:'DELETE',headers:{'x-beatfall-device':D1}});
  F('an old browser signing out never clears the new browser\'s claim',
    db.state.profile.active_web_device_id===D2, String(db.state.profile.active_web_device_id));
  await hit(db,{method:'DELETE',headers:{'x-beatfall-device':D2}});
  F('but the active browser signing out does release it',
    db.state.profile.active_web_device_id===null, String(db.state.profile.active_web_device_id));
}
/* --- a junk or missing id --- */
{
  const db=makeDb(P());
  for(const [label,val] of [['missing',undefined],['short','abc'],
      ['with a quote',"a'or'1'='1aaaaaaaaaaaaaaa"],['too long','x'.repeat(200)]]){
    const r=await hit(db,{method:'POST',headers:val===undefined?{}:{'x-beatfall-device':val}});
    F('a '+label+' browser id is refused, not stored', r.code===400&&db.state.profile.active_web_device_id===null,
      r.code+' stored='+db.state.profile.active_web_device_id);
  }
}
/* --- the phone must not take the desk's claim --- */
{
  const db=makeDb(P({active_web_device_id:D1}));
  globalThis.__AUTHOPTS__=null;
  await hit(db,{method:'GET',headers:{'x-beatfall-device':D1}});
  F('the session endpoint itself waives the lock, or nobody could ever take over',
    globalThis.__AUTHOPTS__&&globalThis.__AUTHOPTS__.webDevice===false,
    JSON.stringify(globalThis.__AUTHOPTS__));
}
/* --- admin --- */
{
  const db=makeDb(P({is_admin:false}),{usage:[],projects:[],events:[]});
  db.state.profiles=[db.state.profile];
  const r=await hit(db,{method:'GET'},admin);
  F('a writer who is not an admin is refused the admin page', r.code===403, r.code+' '+JSON.stringify(r.body));
}
{
  const db=makeDb(P({is_admin:true}),{usage:[],projects:[],events:[]});
  db.state.profiles=[db.state.profile];
  const r=await hit(db,{method:'GET'},admin);
  F('an admin gets the page', r.code===200, r.code+' '+String(JSON.stringify(r.body)).slice(0,120));
  const s=JSON.stringify(r.body||{});
  /* Counts are the point of this page; the TEXT of a stranger's cards is the
     thing the Terms promise is never read. api/admin.js selects card_count and
     never `cards`, and this is the line that keeps that true. */
  F('the admin payload carries counts and never anybody\'s card text',
    !/"text"\s*:/.test(s) && !/"slot"\s*:/.test(s) && !/"cards"\s*:\s*\[/.test(s),
    s.slice(0,240));
}
const bad=out.filter(o=>!o.ok);
console.log('\n'+(out.length-bad.length)+' of '+out.length+' passed');
