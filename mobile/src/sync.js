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
import { call } from './api';
import * as store from './store';

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
  try {
    const pending = await store.pending();
    if (!pending.length) { result = { sent: 0, ok: true }; return result; }

    const payload = pending.map((r) => ({
      id: r.id,
      body: r.body,
      project_id: r.project_id || null,
      project_name: r.project_name || null,
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
  }
  if (again) { again = false; runSync(); }
  return result;
}

/* There is no automatic wake, on purpose. See the note in Capture.js: the app
   sends when the writer presses Send and at no other time. Anything that fires
   on its own empties the phone at a moment nobody chose, and the whole point
   of the button is that the writer chose it. */
