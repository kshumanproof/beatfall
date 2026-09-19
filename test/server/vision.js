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

const failed = out.filter(r => !r.ok);
console.log('\n' + (out.length - failed.length) + ' of ' + out.length + ' passed');
if (failed.length) process.exit(1);
