// ============================================================================
// One active web browser per account.
//
// The browser id is a random first-party value stored in that browser profile.
// It is not an IP address or a hardware fingerprint. Claiming Beatfall here
// replaces the previous web browser immediately. Future mobile capture routes
// do not call this endpoint and opt out of the web-device check in requireUser.
// ============================================================================
import { requireUser, send } from './_lib/core.js';

function browserId(req) {
  const raw = req.headers['x-beatfall-device'];
  const value = Array.isArray(raw) ? raw[0] : String(raw || '').trim();
  return /^[A-Za-z0-9_-]{16,120}$/.test(value) ? value : null;
}

export default async function handler(req, res) {
  // This endpoint is the one deliberate exception to active-device
  // enforcement: it must be reachable by the browser asking to take over.
  const auth = await requireUser(req, { webDevice: false });
  if (auth.error) return send(res, auth.status, { error: auth.error });
  const { db, user, profile } = auth;
  const device = browserId(req);
  if (!device) return send(res, 400, {
    error: 'device_required',
    message: 'Beatfall could not identify this browser. Refresh and try again.'
  });

  if (req.method === 'POST') {
    const now = new Date().toISOString();
    const { data, error } = await db.from('profiles').update({
      active_web_device_id: device,
      active_web_device_claimed_at: now,
      last_seen_at: now
    }).eq('id', user.id).select('active_web_device_id,active_web_device_claimed_at').single();
    if (error || !data) return send(res, 503, {
      error: 'device_setup_failed',
      message: 'Beatfall could not open on this device. Refresh and try again.'
    });
    return send(res, 200, { active: true, claimed_at: data.active_web_device_claimed_at });
  }

  if (req.method === 'GET') {
    return send(res, 200, { active: profile.active_web_device_id === device });
  }

  if (req.method === 'DELETE') {
    // The equality condition matters: an old browser signing out after it was
    // replaced must not clear the new browser's ownership.
    await db.from('profiles').update({
      active_web_device_id: null,
      active_web_device_claimed_at: null
    }).eq('id', user.id).eq('active_web_device_id', device);
    return send(res, 200, { ok: true });
  }

  return send(res, 405, { error: 'method' });
}
