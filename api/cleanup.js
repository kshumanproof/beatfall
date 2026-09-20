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
import { admin, dropImages, IMAGE_BUCKET } from './_lib/core.js';
import { DELETION_WARNING_HTML } from './_email/deletion-warning.js';

const MONTH = 30 * 24 * 60 * 60 * 1000;
const WARN_AFTER   = 5 * MONTH;
const DELETE_AFTER = 6 * MONTH;
/* How long a warning has to have been standing before the account it warned
   may be deleted. It is the gap the five and six month marks already describe,
   written down as its own rule so that an account warned LATE, for whatever
   reason, still gets its month rather than being deleted the next morning. */
const WARN_GRACE   = 1 * MONTH;
const BATCH = 200;              // a slow scheduled job is fine; a timeout is not

/* PICTURES COME OFF A CLOSED ACCOUNT AFTER A MONTH. THE WRITING NEVER DOES.
 *
 * "Nothing is deleted" is promised on the billing page, in the Terms, on the
 * locked screen and twice inside the app, and it stays true of every word
 * anybody wrote. A whole board is a quarter of a megabyte of text, so keeping
 * one forever costs about nothing and buys back the writer who comes at it
 * again in two years, which in this industry is Tuesday.
 *
 * Photographs are the one thing here with real weight, and they are the one
 * thing a lapsed account should not go on costing. So the clock is on the
 * pictures alone: thirty days after a plan ends the images come off and the
 * words stay. The card keeps its caption and says its picture is gone.
 *
 * This is separate from the six month sweep above and runs on its own: an
 * account can be perfectly awake, signing in every week to read its closed
 * boards, and still not be paying for the bucket it filled. */
const IMAGES_AFTER_LAPSE = 30 * 24 * 60 * 60 * 1000;
const BUCKET = IMAGE_BUCKET;

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
        /* Nothing is read at this address. The footer of the message says so
           and points at the one that is, which is the half that stops a dead
           end reading as indifference. */
        reply_to: from,
        subject: 'Your Beatfall account will be deleted in about a month',
        html: DELETION_WARNING_HTML,
        /* Kept, and not as a formality. A plain-text part is what a screen
           reader, a text-only client and every spam filter actually read, and
           a message with only an HTML part scores worse for it. The words are
           the same words. */
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

    /* WAS THIS PERSON ACTUALLY TOLD, AND WHEN.
     *
     * Both branches below need the answer, so it is read once. The deletion
     * branch used to not ask at all: it went on idle time alone, so an account
     * whose warning never went out, because the mail key was missing or the
     * send bounced, was deleted at six months having been told nothing. The
     * five-month branch was careful about exactly this and the six-month one
     * was not.
     *
     * Only .eq() and .order() here. PostgREST's grammar is not the stand-in
     * database's, and this is the query that must not be clever. */
    const { data: told } = await db.from('events')
      .select('created_at').eq('user_id', p.id).eq('name', 'deletion_warned')
      .order('created_at', { ascending: true }).limit(1);
    const warnedAt = (told && told.length && told[0].created_at)
      ? new Date(told[0].created_at).getTime() : 0;

    /* Six months idle AND warned AND the warning has had its month to be read.
       An account that fails any of the three falls through to the warning
       branch instead, which will send one if it can. Nothing is ever deleted
       on idle time alone. */
    if (idle >= DELETE_AFTER && warnedAt && now - warnedAt >= WARN_GRACE) {
      if (!dry) {
        /* THE PICTURES GO FIRST, AND THE ORDER IS NOT A PREFERENCE.
           Deleting the auth user cascades to public.images, and the moment
           those rows are gone there is nothing left that knows where the files
           are. The bucket would keep them, unreferenced and unreachable, which
           is the Privacy Policy quietly becoming untrue about photographs of
           people who never heard of Beatfall. */
        await dropImages(db, admin().storage.from(BUCKET), p.id);
        // Deleting the auth user cascades to profile, projects, usage and events.
        const { error: delErr } = await db.auth.admin.deleteUser(p.id);
        if (delErr) { console.error('cleanup delete failed', p.id, delErr); continue; }
      }
      deleted.push(p.id);
      continue;
    }

    // Warn once, and only once.
    if (warnedAt) { skipped.push(p.id); continue; }

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

  /* ------------------------------------------ pictures off a closed account --
     A separate pass with a separate clock, because it answers a different
     question. The sweep above asks "has anybody been here lately". This asks
     "is somebody still storing photographs a month after they stopped paying",
     and the answer can be yes about a writer who signs in every week to read
     their closed boards.

     The words are never touched. See IMAGES_AFTER_LAPSE at the top of this
     file for why the two are treated differently. */
  const purged = [];
  let purgedBytes = 0;
  const lapsedBefore = new Date(now - IMAGES_AFTER_LAPSE).toISOString();

  const { data: lapsed } = await db.from('profiles')
    .select('id, subscription_status, current_period_end')
    .not('subscription_status', 'in', '(' + LIVE.join(',') + ')')
    .not('current_period_end', 'is', null)
    .lt('current_period_end', lapsedBefore)
    .limit(BATCH);

  for (const p of lapsed || []) {
    // Ask before sweeping. Most closed accounts never had a picture, and a
    // storage call for every one of them is a slow job for no reason.
    const { count } = await db.from('images')
      .select('path', { count: 'exact', head: true }).eq('user_id', p.id);
    if (!count) continue;

    if (dry) { purged.push(p.id); continue; }
    const gone = await dropImages(db, admin().storage.from(BUCKET), p.id);
    if (gone) { purged.push(p.id); purgedBytes += gone.bytes; }
  }

  /* --------------------------------------------------- pictures nobody wants --
     Deleting a photo note does NOT delete its file, and that is deliberate:
     undo has to bring back a picture rather than a grey box, so the bytes wait
     here instead. This is where they stop waiting.

     An orphan is a stored image that no card in any of that writer's projects
     points at. The day of grace is what makes undo safe, and it is generous:
     undo lives in one browser session and never survives a night.

     Without this the quota fills with pictures nobody can see, which is worse
     than a bill. It is a writer being told there is no room, looking at four
     photographs, and being right to think the app is broken. */
  const ORPHAN_GRACE = 24 * 60 * 60 * 1000;
  const orphanBefore = new Date(now - ORPHAN_GRACE).toISOString();
  let orphans = 0, orphanBytes = 0;

  const { data: old } = await db.from('images')
    .select('path, user_id, bytes')
    .lt('created_at', orphanBefore)
    .limit(2000);

  // Group by writer so each one's boards are read once, not once per picture.
  const byUser = new Map();
  (old || []).forEach(r => {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id).push(r);
  });

  for (const [userId, rows] of byUser) {
    const { data: boards } = await db.from('projects')
      .select('cards').eq('user_id', userId);
    /* Read the cards, not the images table. The cards are the truth about what
       a writer can still see, and a path that has fallen out of every one of
       them is a path nothing will ever ask for again. */
    const live = new Set();
    (boards || []).forEach(b => {
      const cards = Array.isArray(b.cards) ? b.cards : [];
      cards.forEach(c => { if (c && c.img) live.add(String(c.img)); });
    });

    const dead = rows.filter(r => !live.has(r.path));
    if (!dead.length) continue;
    if (dry) { orphans += dead.length; continue; }

    const store = admin().storage.from(BUCKET);
    const paths = dead.map(r => r.path);
    let failed = false;
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await store.remove(paths.slice(i, i + 100));
      if (error) { console.error('orphan sweep failed', userId, error); failed = true; break; }
    }
    if (failed) continue;
    await db.from('images').delete().in('path', paths);
    orphans += dead.length;
    orphanBytes += dead.reduce((n, r) => n + (r.bytes || 0), 0);
  }

  return send(res, 200, {
    ok: true, dry,
    could_not_warn: unwarnable.length,
    scanned: (stale || []).length,
    warned: warned.length, deleted: deleted.length, skipped: skipped.length,
    images_purged: purged.length, images_bytes: purgedBytes,
    images_orphaned: orphans, images_orphan_bytes: orphanBytes
  });
}
