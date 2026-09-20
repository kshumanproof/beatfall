// ============================================================================
// Captures: what the phone caught, on its way to a desk.
//
// A capture is not a card, not a note on a board, and not a project. It is a
// sentence somebody said outside a restaurant, and this endpoint's whole job
// is to hold it safely until they sit down. Nothing here writes to a board.
// The desk does that, deliberately and with the writer watching.
//
// Three rules shape everything below.
//
//   The id comes from the phone. It is made before the note is saved, so
//   re-sending a batch is harmless: the second copy lands on the same row.
//   A sync that cannot be retried safely is a sync that loses notes.
//
//   No plan is required to CAPTURE. A lapsed subscription closes the boards,
//   it does not confiscate a thought somebody had on a Tuesday. Sorting is a
//   board action and the board rules already cover it.
//
//   The one-active-browser lock does not apply. It exists so two browsers
//   cannot fight over the same board. A phone posting a note is not editing a
//   board, and if it took part in that lock then opening the app at dinner
//   would sign the writer out of the computer they left at home.
// ============================================================================
import { requireUser, send, readBody, markWorkDay, workDays, localDay } from './_lib/core.js';

const MAX_BATCH = 200;
const MAX_BODY  = 4000;     // a spoken note; a pasted novel belongs at the desk
const MAX_OPEN  = 500;      // how many unsorted the desk will be handed at once

const clean = (v, n) => String(v == null ? '' : v).slice(0, n);

/* A PICTURE ON A CAPTURE IS A PATH, NOT BYTES.
 *
 * The bytes went to /api/images first and came back as a path, which is the
 * only reason a photograph can be quota-checked, stripped of its location and
 * refused from a closed account: all of that happened before this endpoint
 * heard about it.
 *
 * Every path that endpoint ever hands out starts with the owner's id, so a
 * path that does not is not this writer's and is dropped. Dropped, not
 * refused: the note travels with the words it has, and a bad path must never
 * be able to hold a sentence hostage. */
const ownPath = (p, userId) => {
  const s = clean(p, 400);
  return s && s.indexOf(userId + '/') === 0 ? s : null;
};

export default async function handler(req, res) {
  const auth = await requireUser(req, { webDevice: false });
  if (auth.error) return send(res, auth.status, { error: auth.error });
  const { db, user } = auth;

  // ------------------------------------------------------------- arrive --
  if (req.method === 'POST') {
    const body = await readBody(req);
    const batch = Array.isArray(body.captures) ? body.captures : null;
    if (!batch) return send(res, 400, { error: 'bad_request' });
    if (batch.length > MAX_BATCH) return send(res, 413, { error: 'too_many' });
    if (!batch.length) return send(res, 200, { accepted: [] });

    /* Which boards are actually this writer's. A capture carries a project id
       chosen on a phone from a cached list, and that list can be out of date:
       the board may have been deleted since. It could also, in principle, be
       any id at all. Neither may end up filed against somebody else's work, so
       an id that is not on this list is dropped and the note arrives unfiled,
       which is a state the desk already knows how to handle. */
    const { data: mine } = await db.from('projects').select('id').eq('user_id', user.id);
    const ok = new Set((mine || []).map(r => String(r.id)));

    const now = new Date().toISOString();
    const rows = [];
    for (const c of batch) {
      const id = clean(c && c.id, 120);
      const text = clean(c && c.body, MAX_BODY).trim();
      /* A PHOTOGRAPH WITH NO CAPTION IS STILL A NOTE.
         Words used to be the only thing that made a capture real, and a
         picture taken in a hurry very often has nothing typed under it. */
      const img = ownPath(c && c.image_path, user.id);
      if (!id || (!text && !img && !(c && c.deleted))) continue;
      const pid = ok.has(String(c.project_id)) ? String(c.project_id) : null;
      rows.push({
        id,
        user_id: user.id,
        // '(empty)' is a placeholder for a note that was meant to have words
        // and lost them. A picture was never meant to have any.
        body: text || (img ? '' : '(empty)'),
        image_path: img,
        project_id: pid,
        project_name: pid ? clean(c.project_name, 200) || null : null,
        // Almost always the phone. The desk posts here too, when a writer
        // unticks a pasted note: unticking means "not now", and the pile is
        // where a note waits, whatever it came in on.
        source: c && c.source === 'desk' ? 'desk' : 'phone',
        created_at: new Date(Number(c.created_at) || Date.now()).toISOString(),
        updated_at: now,
        // A note thrown away on the phone travels as a tombstone rather than
        // vanishing, otherwise the server keeps handing the desk something the
        // writer already binned.
        deleted_at: c && c.deleted ? now : null,
      });
    }
    if (!rows.length) return send(res, 200, { accepted: [] });

    /* THE SAME NOTE TWICE IS ONE NOTE.
     *
     * A phone running an old build, a thumb pressing Keep again because the
     * screen did not seem to react, a batch re-sent on a bad connection with
     * fresh ids: all of them end with the identical sentence sitting on a
     * writer's board three times. The phone guards this too, and the phone
     * cannot be trusted to, because the phone is the thing that might be out
     * of date.
     *
     * Narrow on purpose. Same words, same script, within two minutes, and a
     * DIFFERENT id, because re-sending the same id is the idempotency this
     * whole design rests on and must always be allowed. A writer who really
     * does catch the same line twice an hour apart keeps both. */
    const since = new Date(Date.now() - 120000).toISOString();
    const { data: recent } = await db.from('captures')
      .select('id,body,project_id,image_path')
      .eq('user_id', user.id).gt('created_at', since);
    /* Same words, not same string. Capitals, stray spaces and curly quotes
       are typing, not meaning, and a twin that differs only by those is still
       a twin. Matches what the desk calls the same note. */
    const same = (t) => String(t == null ? '' : t)
      .replace(/[\u2018\u2019\u201B]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/[.,]+$/, '');
    /* A PICTURE IS NEVER A TWIN, AND NEVER MAKES ONE.
     *
     * The test above is a test of words, and two photographs with nothing
     * typed under them are two empty strings. Left in, the second picture of
     * an evening would be thrown away as a repeat of the first, and the writer
     * would never be told. Four shots of the same doorway are four shots of the
     * same doorway; that is what photographing something looks like.
     *
     * Both directions: a photo row is not tested, and a photo row does not go
     * into the map for a typed note to be tested against. */
    const seen = new Map();
    (recent || []).forEach(r => {
      if (r.image_path) return;
      seen.set((r.project_id || '') + '\u0000' + same(r.body), r.id);
    });
    const fresh = rows.filter(r => {
      if (r.image_path) return true;
      const key = (r.project_id || '') + '\u0000' + same(r.body);
      const holder = seen.get(key);
      if (holder && holder !== r.id) return false;
      seen.set(key, r.id);
      return true;
    });
    // The dropped ones are still ACCEPTED: the phone must forget them, or it
    // will offer to send the same twin again for ever.
    const dropped = rows.filter(r => !fresh.includes(r)).map(r => r.id);
    if (!fresh.length) return send(res, 200, { accepted: dropped });

    /* AN ID FROM A CLIENT MAY ONLY EVER LAND ON THIS ACCOUNT'S OWN ROW.
     *
     * The id is made on the phone, and that is the whole reason re-sending a
     * batch is harmless. It is also why this check has to exist: the upsert
     * keys on the id alone, so a client sending an id that belongs to somebody
     * else would overwrite that person's note and carry `user_id` across with
     * it, taking the row with it. Vanishingly unlikely by accident, since the
     * ids are random, and trivial on purpose.
     *
     * Checked here rather than in the schema deliberately. This endpoint holds
     * the service key and bypasses row-level security, so the schema was never
     * the thing standing in the way.
     *
     * A refused row is NOT reported as accepted. The sender keeps offering one
     * note it can never land, which costs nothing and stays visible in the log,
     * and the rest of its batch goes through untouched. */
    const { data: already } = await db.from('captures')
      .select('id,user_id').in('id', fresh.map(r => r.id));
    const theirs = new Set((already || [])
      .filter(r => String(r.user_id) !== String(user.id))
      .map(r => String(r.id)));
    const ours = theirs.size ? fresh.filter(r => !theirs.has(String(r.id))) : fresh;
    if (theirs.size) {
      console.error('captures: refused', theirs.size,
        'id(s) belonging to another account, sent by', user.id);
    }
    if (!ours.length) return send(res, 200, { accepted: dropped });

    const { error } = await db.from('captures')
      .upsert(ours, { onConflict: 'id' });
    if (error) return send(res, 500, { error: 'write_failed' });

    // Catching a note is working on the script. The phone sends its own local
    // date because only the phone knows what day it is where the writer stands.
    if (ours.some(r => !r.deleted_at)) markWorkDay(db, user.id, body.day);

    return send(res, 200, { accepted: ours.map(r => r.id).concat(dropped) });
  }

  // ------------------------------------------------- what is still waiting --
  if (req.method === 'GET') {
    const { data, error } = await db.from('captures')
      .select('id,body,project_id,project_name,image_path,created_at')
      .eq('user_id', user.id)
      .is('sorted_at', null).is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(MAX_OPEN);
    if (error) return send(res, 500, { error: 'read_failed' });
    return send(res, 200, { captures: data || [], days: await workDays(db, user.id) });
  }

  // --------------------------------------------------------- done with it --
  if (req.method === 'PATCH') {
    const body = await readBody(req);
    const sorted  = Array.isArray(body.sorted)  ? body.sorted.map(String).slice(0, MAX_BATCH)  : [];
    const dropped = Array.isArray(body.dropped) ? body.dropped.map(String).slice(0, MAX_BATCH) : [];
    const now = new Date().toISOString();

    /* Both filters are here on purpose. `eq('user_id')` is the one that
       matters, and the row ids came from the client. */
    if (sorted.length) {
      const { error } = await db.from('captures')
        .update({ sorted_at: now, updated_at: now })
        .eq('user_id', user.id).in('id', sorted);
      if (error) return send(res, 500, { error: 'write_failed' });
    }
    if (dropped.length) {
      const { error } = await db.from('captures')
        .update({ deleted_at: now, updated_at: now })
        .eq('user_id', user.id).in('id', dropped);
      if (error) return send(res, 500, { error: 'write_failed' });
    }
    // Sorting notes onto a board is work, and it is the desk's local date.
    if (sorted.length) markWorkDay(db, user.id, body.day);
    return send(res, 200, { ok: true });
  }

  return send(res, 405, { error: 'method_not_allowed' });
}
