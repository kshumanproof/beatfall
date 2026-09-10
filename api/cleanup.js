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

  /* Two columns had to join this query. An owner account has no subscription
     and a trial date long in the past, so nothing here protected it: your own
     account, and any QA account, was six quiet months from being deleted along
     with everything in it.

     The order also matters now. Without it a backlog past the batch size can
     hand back the same arbitrary rows every run, so the accounts at the far end
     are never reached. Oldest first, so the queue actually drains. */
  /* The two exclusions that never age out are in the QUERY, and that is not a
     tidiness point. Filtering after the limit means the skipped rows are the
     oldest ones, so they hold the same batch slots on every run: an owner or a
     QA account is idle forever by nature, and enough of them at the head means
     the batch never reaches an account that needs warning.

     A live subscription is still checked below rather than in the query. It
     would need a `not.in` inside an `or`, and that is syntax this has no way to
     exercise before it runs: a cron that silently errors every night is worse
     than a theoretical backlog, and a subscriber idle for five months is not a
     row that sits at the head forever the way an owner does.

     The ordering matters either way. Oldest first, so the queue drains. */
  const { data: stale, error } = await db.from('profiles')
    .select('id, email, last_seen_at, subscription_status, trial_ends_at, is_admin, is_internal')
    .lt('last_seen_at', new Date(now - WARN_AFTER).toISOString())
    .eq('is_admin', false).eq('is_internal', false)
    .order('last_seen_at', { ascending: true })
    .limit(BATCH);
  if (error) return send(res, 500, { error: 'read_failed' });

  const warned = [], deleted = [], skipped = [], unwarnable = [];

  for (const p of stale || []) {
    if (p.is_admin || p.is_internal) { skipped.push(p.id); continue; }
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

    /* `warned.push` used to sit outside this branch. With no mail key set,
       warn() returns false without sending anything, no deletion_warned event
       is ever written, and the job reported every one of them as warned - then
       deleted them thirty days later, having told nobody. An account that could
       not be warned is counted separately and is NOT counted as warned. */
    if (dry) { warned.push(p.id); continue; }
    if (await warn(db, p)) {
      await db.from('events').insert({ user_id: p.id, name: 'deletion_warned' });
      warned.push(p.id);
    } else {
      unwarnable.push(p.id);
    }
  }

  if (unwarnable.length) {
    console.error('cleanup could not warn', unwarnable.length,
                  'accounts. Check RESEND_API_KEY and MAIL_FROM.');
  }

  return send(res, 200, {
    ok: true, dry,
    could_not_warn: unwarnable.length,
    scanned: (stale || []).length,
    warned: warned.length, deleted: deleted.length, skipped: skipped.length
  });
}
