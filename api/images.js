// ============================================================================
// Vision: the pictures.
//
// A photo is a note with a picture on it. The note itself lives where every
// other note lives, in projects.cards, and carries nothing but the path to its
// bytes. This endpoint is only ever about the bytes: put them somewhere, hand
// back a way to look at them, take them away again.
//
// Three rules shape it.
//
//   THE BUCKET IS PRIVATE AND STAYS PRIVATE. Nothing here ever returns a URL
//   that outlives the page it was drawn on. Card text is a writer's own words
//   and a leak would be bad; a photograph is very often of another person who
//   never agreed to be in anybody's database, and a public bucket URL is
//   forever and guessable. Display goes through short-lived signed links.
//
//   THE SERVER HOLDS THE ONLY KEY, the same rule as every table in schema.sql.
//   The browser does not upload to Supabase directly. It posts here, and this
//   file decides what is allowed in.
//
//   WHAT GOES IN IS WRITTEN DOWN. Every stored object gets a row in
//   public.images, so deletion can find it. Rows cascade when a user row goes
//   and files do not, and a sweep that had to hunt for paths inside a JSON
//   column would miss the first one somebody hand-edited.
// ============================================================================
import { admin, requireUser, send, readBody, track, entitlement,
         IMAGE_BUCKET } from './_lib/core.js';

const BUCKET = IMAGE_BUCKET;

/* SIZED FOR THE FREE PLAN, WHICH IS ONE GIGABYTE FOR THE WHOLE PLATFORM.
 *
 * Both clients shrink a photo to about 300KB before it ever gets here, so the
 * per-file ceiling is not a target, it is a guard against something arriving
 * unshrunk. Vercel will not accept a request body much past 4.5MB anyway, and
 * a base64 payload is a third larger than the file it carries.
 *
 * The per-writer quota is the number that matters. At 300KB a photo, 40MB is
 * about 130 pictures, which is a generous project and a long way from the
 * platform ceiling. ON A PAID SUPABASE PLAN THIS SHOULD GO UP: 100GB is
 * included there and this number is the only thing holding it down. */
const MAX_FILE_BYTES = 1_500_000;
const QUOTA_BYTES    = 40_000_000;
const SIGNED_TTL     = 3600;       // an hour is longer than anybody stares

const TYPES = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp'
};

/* STRIP THE LOCATION OUT OF THE PICTURE.
 *
 * A phone writes EXIF into every JPEG it takes, and EXIF routinely carries the
 * GPS coordinates of where the shutter went. A writer photographing a face in
 * a bar has not agreed to record the bar, and neither of our clients has any
 * use for the data, so it does not get stored.
 *
 * Both clients re-encode through a canvas before uploading, which drops EXIF
 * on its own. This is here because "the client already did it" is not a thing
 * a server should believe about anybody's location.
 *
 * JPEG only, because JPEG is the only format in TYPES that carries EXIF in
 * practice. The format is a run of segments, each one 0xFF, a marker, then a
 * two-byte length. APP1 (0xE1) is where EXIF lives. Walk the segments, copy
 * everything that is not APP1, stop at the start of the compressed image data
 * and copy the rest wholesale.
 */
function stripExif(buf) {
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return buf;   // not a JPEG
  const keep = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xFF) break;                    // not a segment boundary; bail out whole
    const marker = buf[i + 1];
    if (marker === 0xDA || marker === 0xD9) break; // image data or end of image
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) break;
    if (marker !== 0xE1) keep.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  keep.push(buf.subarray(i));
  const out = Buffer.concat(keep);
  // Never hand back something shorter than the header if the walk went wrong.
  return out.length > 4 ? out : buf;
}

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// A path is only ever built here, never accepted from a client, so a writer
// can never be talked into reading or deleting somebody else's file.
const pathFor = (userId, ext) => userId + '/' + rid() + '.' + ext;
const owns = (path, userId) => String(path || '').indexOf(userId + '/') === 0;

export default async function handler(req, res) {
  // A photo is not a board edit, so this does not take part in the
  // one-active-browser lock: a phone sending a picture must not sign the
  // writer out of the desk they left at home. Same reasoning as captures.
  const auth = await requireUser(req, { webDevice: false });
  if (auth.error) return send(res, auth.status, { error: auth.error });
  const { db, user, profile } = auth;
  const store = admin().storage.from(BUCKET);

  // ------------------------------------------------------------- arrive --
  if (req.method === 'POST') {
    /* A LAPSED ACCOUNT MAY STILL SEND WORDS. IT MAY NOT SEND PICTURES.
     *
     * Captures deliberately takes a typed note from anybody, because a
     * sentence somebody had on a Tuesday is theirs whether or not they are
     * paying this month, and a sentence costs nothing to hold.
     *
     * A photograph is not that. It is bytes on a bill that keeps arriving
     * every month after somebody stopped paying, and the writer who sent it
     * cannot open the board it was meant for anyway. So the answer is no,
     * and the answer says where to go to change it.
     *
     * Reading and deleting stay open on purpose. Somebody whose plan lapsed
     * must always be able to look at what they already sent, and must always
     * be able to take it away.
     */
    if (entitlement(profile).key === 'none') {
      return send(res, 402, {
        error: 'no_plan',
        message: 'Pictures need an active plan. Notes you type still come '
               + 'through. To send pictures again, pick a plan on Beatfall at '
               + 'your computer. Everything you have already sent is safe.'
      });
    }

    const body = await readBody(req);

    const type = String(body.type || '').toLowerCase();
    const ext = TYPES[type];
    if (!ext) {
      return send(res, 400, { error: 'bad_type',
        message: 'That file is not a JPEG, PNG or WebP.' });
    }

    const b64 = String(body.data || '');
    let buf;
    try { buf = Buffer.from(b64, 'base64'); } catch (e) { buf = null; }
    if (!buf || !buf.length) {
      return send(res, 400, { error: 'bad_request', message: 'No picture arrived.' });
    }
    if (buf.length > MAX_FILE_BYTES) {
      return send(res, 413, { error: 'too_big',
        message: 'That picture is too large. It should have been made smaller before sending.' });
    }

    if (type === 'image/jpeg') buf = stripExif(buf);

    /* The quota is checked before the write, not after. Going over and then
       apologising means the bytes are already on the platform's bill, and on
       the free plan the platform's bill is one gigabyte for everybody. */
    const { data: mine } = await db.from('images')
      .select('bytes').eq('user_id', user.id);
    const used = (mine || []).reduce((n, r) => n + (r.bytes || 0), 0);
    if (used + buf.length > QUOTA_BYTES) {
      return send(res, 507, { error: 'no_room',
        message: 'There is no room left for pictures on this account.',
        used, quota: QUOTA_BYTES });
    }

    const path = pathFor(user.id, ext);
    const { error: upErr } = await store.upload(path, buf, {
      contentType: type, upsert: false
    });
    if (upErr) {
      return send(res, 502, { error: 'store_failed',
        message: 'The picture could not be saved. Nothing was lost; try again.' });
    }

    /* The row comes after the file, so a failed upload never leaves a promise
       of bytes that are not there. The other order is the one that breaks
       deletion: a row pointing at nothing is merely untidy, a file with no row
       is a file the sweep will never find. */
    const projectId = body.projectId || null;
    const { error: rowErr } = await db.from('images').insert({
      path, user_id: user.id, project_id: projectId, bytes: buf.length
    });
    if (rowErr) {
      await store.remove([path]);           // do not leave an unfindable file
      return send(res, 502, { error: 'store_failed',
        message: 'The picture could not be saved. Nothing was lost; try again.' });
    }

    track(db, user.id, 'image_added', { source: body.source === 'phone' ? 'phone' : 'desk' });

    const { data: signed } = await store.createSignedUrl(path, SIGNED_TTL);
    return send(res, 200, {
      path,
      url: signed ? signed.signedUrl : null,
      bytes: buf.length,
      used: used + buf.length,
      quota: QUOTA_BYTES
    });
  }

  // -------------------------------------------------------------- look at --
  /* Signed links, in one call for a whole page of thumbnails rather than one
     request per picture. They expire, which is the point: a link that leaked
     out of somebody's browser history stops working the same afternoon. */
  if (req.method === 'GET') {
    let want = [];
    try {
      const q = new URL(req.url, 'http://x').searchParams;
      if (q.get('usage') === '1') {
        const { data: mine } = await db.from('images')
          .select('bytes').eq('user_id', user.id);
        const used = (mine || []).reduce((n, r) => n + (r.bytes || 0), 0);
        return send(res, 200, { used, quota: QUOTA_BYTES, count: (mine || []).length });
      }
      want = String(q.get('paths') || '').split(',').map(s => s.trim()).filter(Boolean);
    } catch (e) {}

    want = want.filter(p => owns(p, user.id)).slice(0, 200);
    if (!want.length) return send(res, 200, { urls: {} });

    const { data } = await store.createSignedUrls(want, SIGNED_TTL);
    const urls = {};
    (data || []).forEach(r => { if (r && r.path && r.signedUrl) urls[r.path] = r.signedUrl; });
    return send(res, 200, { urls });
  }

  // --------------------------------------------------------------- remove --
  /* The file goes first and the row second, the opposite order from arriving,
     and for the same reason both times: never leave a file that nothing knows
     about. If the row delete fails the file is already gone, and a row pointing
     at nothing costs a hundred bytes and tidies itself the next time the sweep
     runs. */
  if (req.method === 'DELETE') {
    let path = '';
    try { path = new URL(req.url, 'http://x').searchParams.get('path') || ''; } catch (e) {}
    if (!owns(path, user.id)) return send(res, 404, { error: 'not_found' });

    await store.remove([path]);
    await db.from('images').delete().eq('path', path).eq('user_id', user.id);
    return send(res, 200, { ok: true });
  }

  return send(res, 405, { error: 'method' });
}
