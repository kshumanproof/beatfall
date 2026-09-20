/* api/images.js end to end, against the stand-in database and a stand-in bucket.
 *
 * The questions worth asking of this endpoint are not "does it save a file".
 * They are the ones that turn into a broken promise if the answer is wrong:
 *
 *   Can one writer read or delete another writer's photographs?
 *   Does the GPS position of the room really come out of the picture?
 *   Can a file end up in the bucket with no row pointing at it, which is the
 *     one state the deletion sweep can never recover from?
 *   Does the quota get checked BEFORE the bytes are on the platform's bill?
 */
import images from './api/images.real.js';
import { makeDb } from './fakedb.js';

const out = [];
const check = (n, ok, d) => { out.push({n, ok}); console.log((ok?'  PASS  ':'  FAIL  ')+n+(ok||!d?'':'\n          '+d)); };

const P = extra => ({ id:'u1', plan:'beatfall', subscription_status:'active',
  credits_used:0, credits_extra:0, is_admin:false, period_start:'2026-09-01T00:00:00Z',
  trial_ends_at:null, ...extra });

function res(){ const r={code:0,body:null,setHeader(){},status(c){r.code=c;return r;},
  send(b){ try{r.body=JSON.parse(b);}catch(e){r.body=b;} return r;}}; return r; }

/* The bucket, as far as this endpoint can tell. Records what it was handed so
   the suite can look inside the stored bytes, and can be told to fail so the
   "a file with no row" path is a thing that actually gets run. */
function makeStore(opts = {}){
  const files = new Map();
  return {
    files,
    async upload(path, buf, meta){
      if (opts.uploadFails) return { error: { message: 'storage down' } };
      files.set(path, { buf, meta });
      return { error: null };
    },
    async remove(paths){
      (paths || []).forEach(p => files.delete(p));
      return { error: null };
    },
    async createSignedUrl(path){
      return { data: { signedUrl: 'https://signed.test/' + path } };
    },
    async createSignedUrls(paths){
      return { data: (paths || []).map(p => ({ path: p, signedUrl: 'https://signed.test/' + p })) };
    }
  };
}

async function hit(db, store, req){
  globalThis.__AUTH__  = { db, user:{id:'u1', email:'w@x.y'}, profile: db.state.profile };
  globalThis.__STORE__ = store;
  const r = res();
  await images({ headers:{}, url:'/api/images', ...req }, r);
  return r;
}

// A one pixel JPEG carrying an APP1 block with a GPS tag in it, built by hand
// so the suite is testing the parser and not a library's opinion of one.
function jpegWithExif(){
  const app1body = Buffer.concat([
    Buffer.from('Exif\0\0', 'latin1'),
    Buffer.from('SECRET-GPS-51.5074-0.1278-SECRET', 'latin1')
  ]);
  const len = Buffer.alloc(2); len.writeUInt16BE(app1body.length + 2, 0);
  return Buffer.concat([
    Buffer.from([0xFF, 0xD8]),                       // start of image
    Buffer.from([0xFF, 0xE1]), len, app1body,        // APP1, where EXIF lives
    Buffer.from([0xFF, 0xDA]),                       // start of scan
    Buffer.from('the actual picture bytes', 'latin1'),
    Buffer.from([0xFF, 0xD9])                        // end of image
  ]);
}

const post = (body) => ({ method:'POST', body });

// ---------- a picture arrives
{
  const db = makeDb(P(), { images: [] });
  const store = makeStore();
  const r = await hit(db, store, post({ data: Buffer.from('hello').toString('base64'),
                                        type: 'image/png', projectId: 'p1' }));
  check('a picture is accepted', r.code === 200, r.code + ' ' + JSON.stringify(r.body));
  check('and comes back with a path, never a URL that outlives the page',
    /^u1\//.test(r.body.path) && /^https:\/\/signed\.test\//.test(r.body.url),
    JSON.stringify(r.body));
  check('the bytes are in the bucket', store.files.size === 1);
  check('and a row points at them, so deletion can find them later',
    db.state.images.length === 1 && db.state.images[0].path === r.body.path,
    JSON.stringify(db.state.images));
  check('and the row records who it belongs to and how big it is',
    db.state.images[0].user_id === 'u1' && db.state.images[0].bytes === 5,
    JSON.stringify(db.state.images));
}

// ---------- the location comes out of the picture
{
  const db = makeDb(P(), { images: [] });
  const store = makeStore();
  const r = await hit(db, store, post({ data: jpegWithExif().toString('base64'),
                                        type: 'image/jpeg' }));
  const stored = store.files.get(r.body.path).buf.toString('latin1');
  check('a JPEG keeps its picture', /the actual picture bytes/.test(stored));
  check('and loses the room it was taken in', stored.indexOf('SECRET-GPS') < 0,
    'EXIF survived the upload: a writer just filed the coordinates of a bar');
  check('and is still a JPEG afterwards',
    stored.charCodeAt(0) === 0xFF && stored.charCodeAt(1) === 0xD8);
}

// ---------- nothing else gets in
{
  const db = makeDb(P(), { images: [] });
  const store = makeStore();
  const bad = await hit(db, store, post({ data: 'AAAA', type: 'application/pdf' }));
  check('a file that is not a picture is refused', bad.code === 400, bad.code);
  check('and nothing was stored', store.files.size === 0 && !db.state.images.length);

  const huge = await hit(db, store, post({
    data: Buffer.alloc(2_000_000).toString('base64'), type: 'image/jpeg' }));
  check('an unshrunk picture is refused rather than swallowed', huge.code === 413, huge.code);
  check('and nothing was stored for that either',
    store.files.size === 0 && !db.state.images.length);
}

// ---------- the quota is checked before the bill, not after
{
  const db = makeDb(P(), { images: [
    { path: 'u1/old.jpg', user_id: 'u1', bytes: 39_900_000 }
  ]});
  const store = makeStore();
  const r = await hit(db, store, post({ data: Buffer.alloc(200_000).toString('base64'),
                                        type: 'image/jpeg' }));
  check('a full account is refused', r.code === 507, r.code + ' ' + JSON.stringify(r.body));
  check('and the bytes never reached the platform', store.files.size === 0,
    'the quota was checked after the upload, which is an apology, not a limit');
  check('and it says how full it is', r.body.used > 0 && r.body.quota > 0,
    JSON.stringify(r.body));
}

// ---------- a file is never left with nothing pointing at it
{
  const db = makeDb(P(), { images: [] });
  db.state.failInsert = true;
  const store = makeStore();
  /* The row write fails after the file has landed. That is the one state the
     sweep can never recover from, because the sweep reads rows, so the
     endpoint has to take its own file back out again. */
  const realFrom = db.from;
  db.from = (name) => {
    const t = realFrom(name);
    if (name === 'images') {
      const realInsert = t.insert.bind(t);
      t.insert = (row) => { realInsert(row); return Promise.resolve({ error: { message: 'no' } }); };
    }
    return t;
  };
  const r = await hit(db, store, post({ data: Buffer.from('hello').toString('base64'),
                                        type: 'image/png' }));
  check('a failed row write is reported', r.code === 502, r.code);
  check('and the orphaned file is taken back out of the bucket',
    store.files.size === 0,
    'a file with no row is unfindable forever; this is the promise breaking');
}

// ---------- one writer cannot reach another writer's pictures
{
  const db = makeDb(P(), { images: [
    { path: 'u1/mine.jpg',    user_id: 'u1', bytes: 10 },
    { path: 'u2/theirs.jpg',  user_id: 'u2', bytes: 10 }
  ]});
  const store = makeStore();
  store.files.set('u2/theirs.jpg', { buf: Buffer.from('x') });

  const look = await hit(db, store, { method:'GET',
    url:'/api/images?paths=' + encodeURIComponent('u1/mine.jpg,u2/theirs.jpg') });
  const keys = Object.keys(look.body.urls || {});
  check('signing is only ever done for your own pictures',
    keys.length === 1 && keys[0] === 'u1/mine.jpg', JSON.stringify(keys));

  const gone = await hit(db, store, { method:'DELETE',
    url:'/api/images?path=' + encodeURIComponent('u2/theirs.jpg') });
  check('and somebody else’s picture cannot be deleted', gone.code === 404, gone.code);
  check('and it is still there afterwards', store.files.has('u2/theirs.jpg'));
  check('and their row is untouched',
    db.state.images.filter(r => r.user_id === 'u2').length === 1);
}

// ---------- taking one away
{
  const db = makeDb(P(), { images: [{ path: 'u1/bye.jpg', user_id: 'u1', bytes: 10 }] });
  const store = makeStore();
  store.files.set('u1/bye.jpg', { buf: Buffer.from('x') });
  const r = await hit(db, store, { method:'DELETE',
    url:'/api/images?path=' + encodeURIComponent('u1/bye.jpg') });
  check('a picture can be deleted', r.code === 200);
  check('the file goes', store.files.size === 0);
  check('and so does the row', db.state.images.length === 0);
}

// ---------- how full am I
{
  const db = makeDb(P(), { images: [
    { path: 'u1/a.jpg', user_id: 'u1', bytes: 300_000 },
    { path: 'u1/b.jpg', user_id: 'u1', bytes: 300_000 },
    { path: 'u2/c.jpg', user_id: 'u2', bytes: 900_000 }
  ]});
  const r = await hit(db, makeStore(), { method:'GET', url:'/api/images?usage=1' });
  check('usage counts this writer and nobody else', r.body.used === 600_000,
    JSON.stringify(r.body));
  check('and names the ceiling so a page can warn before it is hit',
    r.body.quota > 0, JSON.stringify(r.body));
}

// ---------- the phone must not be signed out by sending a picture
{
  const db = makeDb(P(), { images: [] });
  await hit(db, makeStore(), post({ data: Buffer.from('x').toString('base64'),
                                    type: 'image/png' }));
  check('sending a picture never takes part in the one-browser lock',
    globalThis.__AUTHOPTS__ && globalThis.__AUTHOPTS__.webDevice === false,
    JSON.stringify(globalThis.__AUTHOPTS__)
    + '  (a phone posting a photo would sign the writer out of their desk)');
}

// ---------- the button a person actually presses
/* THE OTHER DOOR INTO THE SAME ROOM.
 *
 * The nightly sweep always removed an abandoned account's photographs before
 * removing the account, in that order, because rows cascade off a user row and
 * files in a bucket do not: delete the user first and nothing is left that
 * knows where the pictures are.
 *
 * The delete button in Settings did not. It cancelled Stripe and deleted the
 * user, and every photograph stayed in the bucket forever, unreachable. That
 * is the path a real person uses, and the Privacy Policy promises an account
 * is deleted along with everything in it. Kris found it by asking.
 */
{
  const account = (await import('./api/account.real.js')).default;
  const db = makeDb(P({ stripe_subscription_id: null }), { images: [
    { path: 'u1/a.jpg', user_id: 'u1', bytes: 100 },
    { path: 'u1/b.jpg', user_id: 'u1', bytes: 200 },
    { path: 'u2/theirs.jpg', user_id: 'u2', bytes: 300 }
  ]});
  db.auth = { admin: { deleteUser: async id => {
    (globalThis.__GONE__ = globalThis.__GONE__ || []).push(id);
    /* The order is the whole point, so record what the bucket looked like at
       the moment the user row went. If the pictures had not gone by now they
       never would: this is where the rows that find them disappear. */
    globalThis.__FILES_AT_DELETE__ = [...store.files.keys()];
    return { error: null };
  } } };
  globalThis.__GONE__ = [];
  const store = makeStore();
  ['u1/a.jpg', 'u1/b.jpg', 'u2/theirs.jpg'].forEach(p => store.files.set(p, true));

  globalThis.__AUTH__  = { db, user: { id: 'u1', email: 'w@x.y' }, profile: db.state.profile };
  globalThis.__STORE__ = store;
  const r = res();
  await account({ headers: {}, method: 'POST',
    body: { action: 'delete_account', confirm: 'w@x.y' } }, r);

  check('deleting your own account succeeds', r.code === 200, r.code + ' ' + JSON.stringify(r.body));
  check('and the account is gone', (globalThis.__GONE__ || []).indexOf('u1') >= 0);
  check('your photographs go with it',
    !store.files.has('u1/a.jpg') && !store.files.has('u1/b.jpg'),
    'the bucket kept files for an account that no longer exists');
  check('and they go BEFORE the account, or nothing can find them',
    (globalThis.__FILES_AT_DELETE__ || []).every(p => p.indexOf('u1/') !== 0),
    'the user row went first, which orphans every file it pointed at: '
    + JSON.stringify(globalThis.__FILES_AT_DELETE__));
  check('and the rows go too', !db.state.images.some(i => i.user_id === 'u1'),
    JSON.stringify(db.state.images));
  check('somebody else’s pictures are untouched', store.files.has('u2/theirs.jpg'));
}

// ---------- and if the bucket refuses, nothing happens at all
{
  const account = (await import('./api/account.real.js')).default;
  const db = makeDb(P({ stripe_subscription_id: null }), { images: [
    { path: 'u1/a.jpg', user_id: 'u1', bytes: 100 }
  ]});
  globalThis.__GONE2__ = [];
  db.auth = { admin: { deleteUser: async id => {
    globalThis.__GONE2__.push(id); return { error: null };
  } } };
  const store = makeStore();
  store.files.set('u1/a.jpg', true);
  store.remove = async () => ({ error: { message: 'storage down' } });

  globalThis.__AUTH__  = { db, user: { id: 'u1', email: 'w@x.y' }, profile: db.state.profile };
  globalThis.__STORE__ = store;
  const r = res();
  await account({ headers: {}, method: 'POST',
    body: { action: 'delete_account', confirm: 'w@x.y' } }, r);

  check('a bucket that refuses stops the whole delete', r.code === 502, r.code);
  check('and the account is still there',
    globalThis.__GONE2__.length === 0,
    'the account was deleted anyway and its pictures are now unreachable');
  check('and so are the rows that can still find the files',
    db.state.images.length === 1, JSON.stringify(db.state.images));
  check('and the writer is told nothing was removed',
    /nothing has been deleted/i.test((r.body || {}).message || ''),
    JSON.stringify(r.body));
}

/* ---------- a lapsed account: words yes, pictures no
 *
 * Captures takes a typed note from anybody on purpose. This endpoint must
 * not, because a photograph is a bill that keeps arriving after somebody
 * stopped paying. The refusal has to carry a sentence the phone can put on
 * the screen, and it has to leave looking and deleting alone.
 */
{
  const lapsed = () => P({ plan: 'none', subscription_status: 'canceled',
                           trial_ends_at: '2026-01-01T00:00:00Z' });

  const db = makeDb(lapsed(), { images: [
    { path: 'u1/old.jpg', user_id: 'u1', bytes: 100 }
  ]});
  const store = makeStore();
  store.files.set('u1/old.jpg', true);

  const r = await hit(db, store, post({ data: jpegWithExif().toString('base64'),
                                        type: 'image/jpeg' }));
  check('a lapsed account cannot send a picture', r.code === 402, r.code);
  check('and nothing of theirs reached the bucket',
    store.files.size === 1, JSON.stringify([...store.files.keys()]));
  check('and no row was written',
    db.state.images.length === 1, JSON.stringify(db.state.images));
  check('and the phone is told where to go to fix it',
    /plan/i.test((r.body || {}).message || '')
      && /computer/i.test((r.body || {}).message || ''),
    JSON.stringify(r.body));

  // Looking at what they already sent stays open. So does taking it away.
  const look = await hit(db, store,
    { method: 'GET', url: '/api/images?paths=u1/old.jpg' });
  check('but they can still see the pictures they already sent',
    look.code === 200 && !!(look.body.urls || {})['u1/old.jpg'],
    JSON.stringify(look.body));

  const gone = await hit(db, store,
    { method: 'DELETE', url: '/api/images?path=u1/old.jpg' });
  check('and they can still delete them',
    gone.code === 200 && !store.files.has('u1/old.jpg'), gone.code);
}

/* ---------- a trial that has not run out is not lapsed */
{
  const db = makeDb(P({ plan: 'trial', subscription_status: null,
                        trial_ends_at: '2099-01-01T00:00:00Z' }), { images: [] });
  const store = makeStore();
  const r = await hit(db, store, post({ data: jpegWithExif().toString('base64'),
                                        type: 'image/jpeg' }));
  check('somebody still inside their trial can send pictures', r.code === 200, r.code);
}

const failed = out.filter(r => !r.ok);
console.log('\n' + (out.length - failed.length) + ' of ' + out.length + ' passed');
if (failed.length) process.exit(1);
