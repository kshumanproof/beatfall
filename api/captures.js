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
      if (!id || (!text && !(c && c.deleted))) continue;
      const pid = ok.has(String(c.project_id)) ? String(c.project_id) : null;
      rows.push({
        id,
        user_id: user.id,
        body: text || '(empty)',
        project_id: pid,
        project_name: pid ? clean(c.project_name, 200) || null : null,
        source: 'phone',
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
      .select('id,body,project_id')
      .eq('user_id', user.id).gt('created_at', since);
    const seen = new Map();
    (recent || []).forEach(r => seen.set((r.project_id || '') + '\u0000' + r.body, r.id));
    const fresh = rows.filter(r => {
      const key = (r.project_id || '') + '\u0000' + r.body;
      const holder = seen.get(key);
      if (holder && holder !== r.id) return false;
      seen.set(key, r.id);
      return true;
    });
    // The dropped ones are still ACCEPTED: the phone must forget them, or it
    // will offer to send the same twin again for ever.
    const dropped = rows.filter(r => !fresh.includes(r)).map(r => r.id);
    if (!fresh.length) return send(res, 200, { accepted: dropped });

    const { error } = await db.from('captures')
      .upsert(fresh, { onConflict: 'id' });
    if (error) return send(res, 500, { error: 'write_failed' });

    // Catching a note is working on the script. The phone sends its own local
    // date because only the phone knows what day it is where the writer stands.
    if (fresh.some(r => !r.deleted_at)) markWorkDay(db, user.id, body.day);

    return send(res, 200, { accepted: fresh.map(r => r.id).concat(dropped) });
  }

  // ------------------------------------------------- what is still waiting --
  if (req.method === 'GET') {
    const { data, error } = await db.from('captures')
      .select('id,body,project_id,project_name,created_at')
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
