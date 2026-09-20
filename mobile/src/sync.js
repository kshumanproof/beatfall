// ============================================================================
// Sending the notes home.
//
// Everything here is allowed to fail. That is the design, not a shortcoming.
// A note is already safe on this phone before sync has any opinion about it,
// so the worst outcome of a failed run is that it goes next time. Nothing in
// this file may ever delete, block or slow down a capture.
//
// It runs when there is something to send AND something to send it over: on
// launch, when the app comes back to the foreground, and after a Keep. It does
// not poll. A timer that wakes up every thirty seconds to find no signal is a
// battery cost with no upside.
// ============================================================================
import { call, realise, uploadPhoto } from './api';
import * as store from './store';
import * as photos from './photos';

let running = false;
let again   = false;      // a run asked for while one was in flight

const dayStamp = (d) => {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
       + '-' + String(d.getDate()).padStart(2, '0');
};

/* One pass: take everything unsynced, send it, mark what the server confirmed.
 *
 * The batch is sent whole and the server upserts on the phone's own id, so a
 * reply that never arrives costs one repeated send and nothing else. That is
 * the entire reason ids are made here rather than there. */
export async function runSync() {
  if (running) { again = true; return { skipped: true }; }
  running = true;
  let result = { sent: 0, ok: false };
  /* How many working titles turned into real scripts on this run. The screen
     has to know, because promoting one changes an id that the screen is still
     holding in memory. Reported on every result, including the failed ones:
     the titles can be created and the notes still not get sent. */
  let promoted = 0;
  /* Why a picture did not go, if one did not. Carried out to the screen so it
     can say the true thing: a lapsed plan is not a lost connection, and the
     writer needs to be pointed at their computer rather than told to try
     again with better signal. */
  let refused = null;
  try {
    let pending = await store.pending();
    if (!pending.length) { result = { sent: 0, ok: true }; return result; }

    /* Working titles first. A note filed under one carries a local id that
       means nothing to the server, so the script is created here and every
       note pointing at it is repointed before anything is posted. If this
       fails, nothing is posted at all: sending the notes with a local id
       would land them unfiled at the desk, which is precisely the mess the
       working title exists to prevent. */
    const titles = [];
    pending.forEach((r) => {
      if (!store.isLocal(r.project_id)) return;
      if (titles.some((t) => t.id === r.project_id)) return;
      titles.push({ id: r.project_id, name: r.project_name || 'Untitled' });
    });
    if (titles.length) {
      const made = await realise(titles);
      for (const m of made) await store.promoteProject(m.localId, m.project);
      promoted = made.length;
      pending = await store.pending();
    }

    /* A note whose title could not be created stays on the phone. Sending it
       anyway would file it nowhere at the desk, which is the exact pile the
       working title was invented to prevent. The ones whose titles did get
       made go now; this one goes next time. */
    const ready = pending.filter((r) => !store.isLocal(r.project_id));
    if (!ready.length) { result = { sent: 0, ok: false, why: 0 }; return result; }

    /* ------------------------------------------------- the pictures first --
     *
     * Bytes go ahead of the note that carries them, and a note is not sent
     * until its picture is on the account. The other order would put a note on
     * the desk with an empty frame on it and no way to ever fill it in.
     *
     * ONE REFUSAL ANSWERS FOR ALL OF THEM. If the plan has lapsed, every
     * picture in this batch will be refused for the same reason, and trying
     * twenty times means twenty round trips to be told once. The TYPED notes
     * still go, which is the rule: words yes, pictures no. */
    for (const r of ready) {
      if (!r.photo_uri || r.image_path) continue;
      if (refused) break;
      let data = null;
      try { data = await photos.bytes(r.photo_uri); } catch (e) { data = null; }
      if (!data) {
        /* The file is not there any more. Whatever words are on the note still
           go home; a note with no words and no picture is nothing at all and
           is dropped rather than carried for ever. */
        await store.photoLost(r.id);
        r.photo_uri = null;
        continue;
      }
      try {
        const path = await uploadPhoto(data, r.project_id);
        if (path) {
          await store.markUploaded(r.id, path);
          r.image_path = path;
        }
      } catch (e) {
        refused = { status: (e && e.status) || 0, code: e && e.code,
                    message: (e && e.message) || '' };
      }
    }

    /* A note still holding a picture that did not go waits here with it. Its
       words are safe on this phone either way, and this is the only way the
       writer ends up with the note and the photograph together at the desk
       rather than one of each on different days. */
    const sendable = ready.filter((r) => !r.photo_uri || r.image_path);
    if (!sendable.length) {
      result = { sent: 0, ok: false, why: refused && refused.status };
      return result;
    }

    const payload = sendable.map((r) => ({
      id: r.id,
      body: r.body,
      project_id: r.project_id || null,
      project_name: r.project_name || null,
      image_path: r.image_path || null,
      created_at: r.created_at,
      deleted: !!r.deleted,
    }));

    const reply = await call('/api/captures', {
      method: 'POST',
      body: JSON.stringify({ captures: payload, day: dayStamp() }),
    });

    const accepted = Array.isArray(reply && reply.accepted) ? reply.accepted : [];
    if (accepted.length) {
      await store.forgetSent(accepted);
      await store.addSent(accepted.length);
    }
    result = { sent: accepted.length, ok: true };
  } catch (e) {
    // Offline, signed out, server down. All the same answer here: leave the
    // rows alone and try again the next time something wakes us.
    result = { sent: 0, ok: false, why: e && e.status };
  } finally {
    running = false;
    // Every exit above returns `result`, and there are six of them. Stamping
    // it here once is the only way this cannot be forgotten on a new one.
    result.promoted = promoted;
    result.refused  = refused;
  }
  if (again) { again = false; runSync(); }
  return result;
}

/* There is no automatic wake, on purpose. See the note in Capture.js: the app
   sends when the writer presses Send and at no other time. Anything that fires
   on its own empties the phone at a moment nobody chose, and the whole point
   of the button is that the writer chose it. */
