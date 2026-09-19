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

/* NOBODY IS DELETED WHO WAS NEVER TOLD.
   Six months idle is not on its own a reason to delete an account. The warning
   at five months is only a promise kept if it actually went out, and it does
   not go out when the mail key is missing or the send bounces. This is a real
   run, not a dry one, against an account well past six months with no
   deletion_warned event anywhere. */
{
  const forgotten = [
    {id:'never-told', email:'n@x', last_seen_at: old(400), is_admin:false, is_internal:false,
     subscription_status:null, trial_ends_at:old(380)}
  ];
  globalThis.__DB__ = makeDb({id:'x'}, {profiles: forgotten});
  globalThis.__DB__.auth = { admin: { deleteUser: async id => {
    (globalThis.__DELETED2__ ||= []).push(id); return {error:null}; } } };
  globalThis.__DELETED2__ = [];
  const r2 = res();
  await handler({ method:'GET', headers:{'x-cron-secret':'sec'}, query:{key:'sec'} }, r2);

  check('an account that was never warned is not deleted at six months',
    (globalThis.__DELETED2__||[]).length === 0,
    JSON.stringify(globalThis.__DELETED2__) + '  ' + JSON.stringify(r2.body));
  check('and the job says out loud that it could not warn it',
    (r2.body||{}).could_not_warn === 1, JSON.stringify(r2.body));
  check('the events table still holds no warning it did not send',
    ((globalThis.__DB__.state.events)||[]).length === 0,
    JSON.stringify(globalThis.__DB__.state.events));
}


/* THE WARNING IS AN EMAIL, AND AN EMAIL IS A THING THAT CAN BE WRONG.
   It is the only message this product sends that a writer did not ask for, so
   it has to arrive, be readable with images off, and say plainly where a reply
   goes. Checked against the shipped markup, not a copy of it. */
{
  const { DELETION_WARNING_HTML: H } = await import('./api/_email/deletion-warning.js');
  check('the warning has an HTML body at all', typeof H === 'string' && H.length > 800,
    typeof H + ' ' + (H||'').length);
  check('it says what will happen and when',
    /deleted in about a month/.test(H) && /five months/.test(H) && /six months/.test(H), '');
  check('it offers both ways to keep the work',
    /[Ss]ign in once/.test(H) && /download everything/.test(H), '');
  check('it names where a reply actually goes',
    /Nobody reads replies/.test(H) && /support@beatfall\.app/.test(H), '');
  /* This used to demand the exact string alt="Beatfall", so it went red the day
     the lockup gained its tagline and the alt text was widened to say so. The
     alt got BETTER and the check called it a failure. What it is actually for
     is that a reader with images off still learns whose mail this is, so that
     is what it asks now. */
  check('the mark carries alt text, because images are off by default',
    /<img[^>]*\balt="[^"]*Beatfall[^"]*"/.test(H), '');
  check('every colour is inline as well as in the stylesheet, which is all Outlook reads',
    (H.match(/style="[^"]*color:#/g) || []).length > 8,
    String((H.match(/style="[^"]*color:#/g)||[]).length) + ' inline colour declarations');
  check('it uses the palette from theme.css and invents nothing',
    /#2B2620/.test(H) && /#F1EEE7/.test(H) && /#7B5A13/.test(H), '');
  check('no em dash survived into the message', H.indexOf('\u2014') < 0, '');
  check('nothing is left unsubstituted', !/\$\{/.test(H) && !/\{\{/.test(H), '');
}

/* --------------------------------------------------- pictures, three sweeps --
   The photographs are the only part of a closed account that costs anything
   real, and the only part of a DELETED account that does not disappear on its
   own: rows cascade off a user row, files in a bucket do not.

   So three separate things have to be true, and all three are a promise on the
   privacy page rather than housekeeping. */
{
  const store = { files: new Map(),
    async remove(paths){ (paths||[]).forEach(p => store.files.delete(p)); return {error:null}; } };
  globalThis.__STORE__ = store;

  const now = Date.now();
  const day = d => new Date(now - d*86400000).toISOString();

  const profiles = [
    // abandoned for well over six months, already warned, and it has pictures
    {id:'gone', email:'g@x', last_seen_at: day(400), is_admin:false, is_internal:false,
     subscription_status:null, trial_ends_at: day(300), current_period_end:null},
    // wide awake, signs in weekly to read closed boards, stopped paying in June
    {id:'lapsed', email:'l@x', last_seen_at: day(2), is_admin:false, is_internal:false,
     subscription_status:'canceled', trial_ends_at: day(300), current_period_end: day(45)},
    // cancelled last week; still inside the thirty days
    {id:'fresh', email:'f@x', last_seen_at: day(1), is_admin:false, is_internal:false,
     subscription_status:'canceled', trial_ends_at: day(300), current_period_end: day(5)},
    // paying, and its pictures are none of this job's business
    {id:'paying', email:'p@x', last_seen_at: day(1), is_admin:false, is_internal:false,
     subscription_status:'active', trial_ends_at: day(300), current_period_end: day(-20)}
  ];

  const images = [
    {path:'gone/a.jpg',   user_id:'gone',   bytes: 100, created_at: day(200)},
    {path:'lapsed/a.jpg', user_id:'lapsed', bytes: 200, created_at: day(200)},
    {path:'fresh/a.jpg',  user_id:'fresh',  bytes: 300, created_at: day(200)},
    {path:'paying/a.jpg', user_id:'paying', bytes: 400, created_at: day(200)},
    // deleted from the board yesterday: no card points at it any more
    {path:'paying/orphan.jpg', user_id:'paying', bytes: 500, created_at: day(3)},
    // deleted from the board an hour ago, still inside undo's day of grace
    {path:'paying/justnow.jpg', user_id:'paying', bytes: 600, created_at: new Date(now).toISOString()}
  ];
  images.forEach(i => store.files.set(i.path, true));

  const projects = [
    {id:'p1', user_id:'paying', cards:[{id:1, img:'paying/a.jpg'}, {id:2, text:'words'}]},
    {id:'p2', user_id:'lapsed', cards:[{id:3, img:'lapsed/a.jpg'}]},
    {id:'p3', user_id:'fresh',  cards:[{id:4, img:'fresh/a.jpg'}]}
  ];

  const db = makeDb({id:'x'}, {profiles, images, projects});
  /* makeDb seeds `events` itself, so an events array handed to it is quietly
     ignored. Set it afterwards or the warning this account was already sent is
     invisible and it falls into the warn branch instead of the delete one. */
  db.state.events = [{user_id:'gone', name:'deletion_warned', created_at: day(60)}];
  db.auth = { admin: { deleteUser: async id => { (globalThis.__DELETED2__ ||= []).push(id); return {error:null}; } } };
  globalThis.__DB__ = db;
  globalThis.__DELETED2__ = [];

  const r2 = res();
  await handler({ method:'GET', headers:{'x-cron-secret':'sec'}, query:{key:'sec'} }, r2);
  check('the sweep runs with pictures in play', r2.code === 200,
    r2.code + ' ' + JSON.stringify(r2.body).slice(0,200));

  // 1. a deleted account takes its files with it
  check('a deleted account loses its pictures too',
    !store.files.has('gone/a.jpg'),
    'the bucket kept files for an account that no longer exists');
  check('and the account itself is gone',
    (globalThis.__DELETED2__ || []).indexOf('gone') >= 0,
    JSON.stringify(globalThis.__DELETED2__));
  check('and the pictures go BEFORE the account, or nothing can find them',
    !db.state.images.some(i => i.user_id === 'gone'),
    'rows for a deleted account survived, which means files did too');

  // 2. thirty days after a plan ends the pictures come off and the words stay
  check('a plan that ended over a month ago loses its pictures',
    !store.files.has('lapsed/a.jpg'), 'a lapsed account is still storing photographs');
  check('but not the words', db.state.projects.some(p => p.user_id === 'lapsed'),
    'the writing was deleted, which is the promise this job must never break');
  check('a plan that ended last week keeps them for now',
    store.files.has('fresh/a.jpg'),
    'the thirty day window was not honoured');
  check('and a paying account is left completely alone',
    store.files.has('paying/a.jpg'), 'a live subscriber lost a picture');

  // 3. pictures no card points at any more
  check('a picture nothing points at is swept',
    !store.files.has('paying/orphan.jpg'),
    'deleted photographs would fill the quota invisibly');
  check('but one deleted a moment ago is left, because undo has to work',
    store.files.has('paying/justnow.jpg'),
    'undo would bring back a grey box instead of a picture');
  check('the job says what it took', (r2.body.images_purged || 0) >= 1
    && (r2.body.images_orphaned || 0) >= 1, JSON.stringify(r2.body));
}

const failed = out.filter(x=>!x.ok);
console.log('\n' + (out.length-failed.length) + ' of ' + out.length + ' passed');
if (failed.length) process.exit(1);
