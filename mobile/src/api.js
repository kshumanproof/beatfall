// ============================================================================
// Talking to Beatfall's server, from the phone.
//
// One rule: every call carries the signed-in writer's token, and every call
// can fail without breaking anything. A phone is offline more often than a
// laptop is, and nothing on this device may depend on the network being there.
// ============================================================================
import { API_BASE } from './config';
import { sb } from './supabase';

async function token() {
  const s = await sb();
  if (!s) return null;
  const { data } = await s.auth.getSession();
  return (data.session && data.session.access_token) || null;
}

/* A thin fetch with the token on it. Throws an Error carrying `status` so a
   caller can tell "no signal" apart from "your plan has ended", which are
   very different things to say to somebody. */
export async function call(path, opts = {}) {
  const jwt = await token();
  if (!jwt) { const e = new Error('signed_out'); e.status = 401; throw e; }
  let r;
  try {
    r = await fetch(API_BASE + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + jwt,
        ...(opts.headers || {}),
      },
    });
  } catch (netErr) {
    const e = new Error('offline'); e.status = 0; throw e;
  }
  let body = null;
  try { body = await r.json(); } catch (e) {}
  if (!r.ok) {
    const e = new Error((body && (body.message || body.error)) || 'request_failed');
    e.status = r.status;
    e.code = body && body.error;
    throw e;
  }
  return body;
}

/* The shelf: id, name and structure only. `?list=1` exists on the server so
   this does not drag every card down a cell connection to draw a list. */
export async function fetchScripts() {
  const body = await call('/api/projects?list=1');
  return Array.isArray(body && body.projects) ? body.projects : [];
}

/* What the server still has waiting. The phone uses this to clear notes the
   desk has already dealt with, so "on this phone" stays a list of things that
   have not been sorted yet rather than a growing archive. */
export async function fetchWaiting() {
  const body = await call('/api/captures');
  return Array.isArray(body && body.captures) ? body.captures.map(c => c.id) : [];
}

/* Start a script from the phone. Name only, on purpose: at dinner, choosing a
   structure is a desk decision and structures switch losslessly later. */
export async function createScript(name) {
  const body = await call('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ project: { name: String(name || '').trim().slice(0, 200) || 'Untitled',
                                      created_from: 'other' } }),
  });
  return body && body.project;
}

/* What actually went wrong, in one short line, for the writer AND for us.
   A single sentence that never names the fault is a bug report nobody can
   act on, and this runs on a device with no console attached. */
export function why(e) {
  if (!e) return 'unknown';
  if (e.status === 0)   return 'offline';
  if (e.status === 401) return 'signed out (401)';
  if (e.status === 402) return 'plan closed (402)';
  const bit = e.code || e.message || 'no detail';
  return (e.status ? e.status + ' ' : '') + String(bit).slice(0, 90);
}
