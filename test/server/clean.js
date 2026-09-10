import handler from './api/cleanup.real.js';
import { makeDb } from './fakedb.js';
const out=[]; const check=(n,ok,d)=>{out.push({n,ok});console.log((ok?'  PASS  ':'  FAIL  ')+n+(ok||!d?'':'\n          '+d));};
function res(){const r={code:0,body:null,setHeader(){},status(c){r.code=c;return r;},send(b){try{r.body=JSON.parse(b);}catch(e){r.body=b;}return r;}};return r;}
const old = d => new Date(Date.now() - d*86400000).toISOString();

// the query filters is_admin/is_internal, so the fake must honour them
const people = [
  {id:'owner',    email:'k@x', last_seen_at: old(400), is_admin:true,  is_internal:false, subscription_status:null, trial_ends_at:old(300)},
  {id:'qa',       email:'q@x', last_seen_at: old(400), is_admin:false, is_internal:true,  subscription_status:null, trial_ends_at:old(300)},
  {id:'paying',   email:'p@x', last_seen_at: old(400), is_admin:false, is_internal:false, subscription_status:'active', trial_ends_at:old(300)},
  {id:'gone',     email:'g@x', last_seen_at: old(400), is_admin:false, is_internal:false, subscription_status:null, trial_ends_at:old(300)}
];
process.env.CRON_SECRET = 'sec';
globalThis.__DB__ = makeDb({id:'x'}, {profiles: people});
// deleteUser lives on the auth admin surface
globalThis.__DB__.auth = { admin: { deleteUser: async id => { (globalThis.__DELETED__ ||= []).push(id); return {error:null}; } } };
globalThis.__DELETED__ = [];
const r = res();
await handler({ method:'GET', headers:{'x-cron-secret':'sec'}, query:{dry:'1', key:'sec'} }, r);

check('the cleanup endpoint answers', r.code === 200, r.code + ' ' + JSON.stringify(r.body).slice(0,140));
check('and nothing is deleted on a dry run', (globalThis.__DELETED__||[]).length === 0,
  JSON.stringify(globalThis.__DELETED__));
// It reports counts, not ids, so assert on the counts and on who it touched.
const b = r.body || {};
check('the owner and the QA account are never even scanned', b.scanned === 2,
  JSON.stringify(b) + '  (four accounts, two of them yours)');
check('the paying one is skipped', b.skipped === 1, JSON.stringify(b));
check('and exactly one abandoned account is acted on',
  b.deleted + b.warned === 1, JSON.stringify(b));
check('and it reports how many it could not warn', 'could_not_warn' in b, JSON.stringify(b));

const failed = out.filter(x=>!x.ok);
console.log('\n' + (out.length-failed.length) + ' of ' + out.length + ' passed');
if (failed.length) process.exit(1);
