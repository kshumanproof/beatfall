const { createHmac } = require('node:crypto');
const { isIP } = require('node:net');

// Independent launch list. No app accounts, sessions, credits or email sends.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const reply = (status, body) => res.status(status).json(body);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(405, { ok: false });
  }
  const origins = new Set(['https://beatfall.app', 'https://www.beatfall.app']);
  try { if (process.env.LAUNCH_SITE_URL) origins.add(new URL(process.env.LAUNCH_SITE_URL).origin); } catch {}
  if (!origins.has(req.headers.origin)) return reply(403, { ok: false });
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return reply(415, { ok: false });
  let body;
  try {
    if (Number(req.headers['content-length']) > 4096) return reply(413, { ok: false });
    if (req.body !== undefined) {
      const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? String(req.body) : JSON.stringify(req.body);
      if (Buffer.byteLength(raw) > 4096) return reply(413, { ok: false });
      body = JSON.parse(raw);
    } else {
      let raw = ''; let size = 0;
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > 4096) return reply(413, { ok: false });
        raw += chunk;
      }
      body = JSON.parse(raw);
    }
  } catch { return reply(400, { ok: false }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { ok: false });
  // Quietly discard automated submissions. Never write a bot's address.
  if (body.website) return reply(200, { ok: true });
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const parts = email.split('@');
  if (email.length > 254 || parts.length !== 2 || parts[0].length < 1 || parts[0].length > 64 ||
      !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/.test(parts[0]) || parts[0].startsWith('.') || parts[0].endsWith('.') || parts[0].includes('..') ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(parts[1])) return reply(400, { ok: false });
  if (body.consent !== true || body.consent_version !== 'launch-2026-10-09') return reply(400, { ok: false });
  const label = value => typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80) : '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let base;
  try { base = new URL(process.env.SUPABASE_URL); if (base.protocol !== 'https:') throw Error(); } catch { return reply(503, { ok: false }); }
  if (!key) return reply(503, { ok: false });
  // Vercel overwrites x-vercel-forwarded-for. Never trust client-supplied x-forwarded-for.
  const forwarded = String(req.headers['x-vercel-forwarded-for'] || '').split(',')[0].trim();
  const ip = isIP(forwarded) ? forwarded : !process.env.VERCEL && isIP(req.socket?.remoteAddress || '') ? req.socket.remoteAddress : '';
  if (!ip) return reply(503, { ok: false });
  const day = new Date().toISOString().slice(0, 10);
  const ipHash = createHmac('sha256', key).update('launch-rate:' + day + ':' + ip).digest('hex');
  try {
    const response = await fetch(new URL('/rest/v1/rpc/register_launch_lead', base), {
      method: 'POST', signal: AbortSignal.timeout(6000),
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_email: email, p_consent_version: body.consent_version,
        p_source: label(body.source) || 'unattributed', p_medium: label(body.medium),
        p_campaign: label(body.campaign), p_ip_hash: ipHash })
    });
    if (!response.ok) return reply(503, { ok: false });
    const result = await response.json();
    if (result?.status === 'limited') {
      res.setHeader('Retry-After', '600');
      return reply(429, { ok: false });
    }
    if (result?.status !== 'saved') return reply(503, { ok: false });
    // Existing and new addresses receive the same reply; no address lookup leak.
    return reply(200, { ok: true });
  } catch { return reply(503, { ok: false }); }
};
