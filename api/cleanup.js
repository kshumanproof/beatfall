// ============================================================================
// Six months, then it goes.
//
// An account that nobody has signed into for six months, with no live
// subscription, is deleted along with everything in it. This is not
// housekeeping: it is the reason the Privacy Policy can say we do not keep
// people's stories lying around indefinitely, and a promise like that has to be
// a job that runs rather than an intention.
//
// A warning goes out at five months so nobody is surprised. The warning is sent
// once and recorded as an event, so a second pass will not send it again.
//
// Called by a scheduled request, never by a browser. It authenticates on
// CRON_SECRET, so without that set it refuses to do anything at all.
// ============================================================================
import { admin } from './_lib/core.js';

const MONTH = 30 * 24 * 60 * 60 * 1000;
const WARN_AFTER   = 5 * MONTH;
const DELETE_AFTER = 6 * MONTH;
const BATCH = 200;              // a slow scheduled job is fine; a timeout is not

// Never touch an account that is still paying, or still inside its trial.
const LIVE = ['active', 'trialing', 'past_due'];

function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).send(JSON.stringify(body));
}

async function warn(db, profile) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from || !profile.email) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({
        from,
        to: profile.email,
        subject: 'Your Beatfall account will be deleted in about a month',
        text:
`You haven't signed in to Beatfall for five months.

After six months of no sign-in and no subscription we delete the account and
everything in it: every board, every note, every outline. That's a promise we
make in the Privacy Policy, so this is us keeping it rather than a nudge to
come back.

If you want to keep the work, either sign in once, which resets the clock, or
sign in and download everything from Settings, Your data.

If you'd rather it all went, do nothing.

Beatfall`
      })
    });
    return r.ok;
  } catch (e) {
    console.error('cleanup warn failed', e);
    return false;
  }
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return send(res, 503, { error: 'not_configured' });

  const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
             || req.query?.key || '';
  if (given !== secret) return send(res, 401, { error: 'unauthorized' });

  const db = admin();
  const now = Date.now();
  const dry = req.query?.dry === '1';

  const { data: stale, error } = await db.from('profiles')
    .select('id, email, last_seen_at, subscription_status, trial_ends_at')
    .lt('last_seen_at', new Date(now - WARN_AFTER).toISOString())
    .limit(BATCH);
  if (error) return send(res, 500, { error: 'read_failed' });

  const warned = [], deleted = [], skipped = [];

  for (const p of stale || []) {
    if (LIVE.includes(p.subscription_status || '')) { skipped.push(p.id); continue; }
    if (p.trial_ends_at && new Date(p.trial_ends_at) > new Date()) { skipped.push(p.id); continue; }

    const idle = now - new Date(p.last_seen_at).getTime();

    if (idle >= DELETE_AFTER) {
      if (!dry) {
        // Deleting the auth user cascades to profile, projects, usage and events.
        const { error: delErr } = await db.auth.admin.deleteUser(p.id);
        if (delErr) { console.error('cleanup delete failed', p.id, delErr); continue; }
      }
      deleted.push(p.id);
      continue;
    }

    // Five months: warn once, and only once.
    const { data: already } = await db.from('events')
      .select('id').eq('user_id', p.id).eq('name', 'deletion_warned').limit(1);
    if (already && already.length) { skipped.push(p.id); continue; }

    if (!dry && await warn(db, p)) {
      await db.from('events').insert({ user_id: p.id, name: 'deletion_warned' });
    }
    warned.push(p.id);
  }

  return send(res, 200, {
    ok: true, dry,
    scanned: (stale || []).length,
    warned: warned.length, deleted: deleted.length, skipped: skipped.length
  });
}
