// ============================================================================
// Projects: load everything on sign-in, save one project at a time.
//
// The board is stored as JSON on a single row per project. The client already
// holds it that way, so this stays one code path instead of a table per card.
// ============================================================================
import { requireUser, entitlement, send, readBody, markWorkDay } from './_lib/core.js';

const MAX_PROJECTS = 60;
const MAX_BYTES    = 400_000;   // a very large board is ~40kb; this is generous

export default async function handler(req, res) {
  /* ?list=1 is the shelf: id, name, structure. Nothing else.
     It is exempt from the one-active-browser lock, and that is not a hole.
     The lock exists so two browsers cannot both edit a board and overwrite
     each other; reading a list of names cannot collide with anything. The
     phone uses this and only this, and if it took part in the lock then
     opening Beatfall on a phone would sign the writer out of the desk they
     were sitting at, which is the opposite of what a capture app is for. */
  let slim = false;
  try {
    slim = req.method === 'GET'
        && new URL(req.url, 'http://x').searchParams.get('list') === '1';
  } catch (e) {}

  /* Starting a NEW script is exempt from the lock as well, for the same
     reason. The lock exists so two browsers cannot save over each other's
     board; a create has no existing row to save over. Without this, naming a
     script on a phone came back "device_required", because the phone is not a
     browser holding the desk's editing claim and never should be.

     The body is read before auth here on purpose: whether this is a create
     decides which auth rules apply. readBody caches nothing the auth needs. */
  let body = null;
  let creating = false;
  if (req.method === 'POST') {
    body = await readBody(req);
    creating = !!(body && body.project && !body.project.id);
  }

  const auth = await requireUser(req, (slim || creating) ? { webDevice: false } : undefined);
  if (auth.error) return send(res, auth.status, { error: auth.error });
  const { db, user, profile } = auth;

  // A subscription is what buys access to the boards. When it lapses the work
  // is not deleted and it is not held hostage: /api/account export still
  // answers, so a person can always take everything with them. What stops is
  // opening and editing.
  const ent = entitlement(profile);
  const closed = ent.key === 'none';

  // Two different events close the boards and one sentence cannot be true of
  // both. Somebody who has never had a subscription did not have a plan end;
  // their trial ran out. Telling a writer on day fifteen that their plan ended
  // is the app describing a purchase they never made.
  const neverSubscribed = !profile.stripe_subscription_id && !profile.subscription_status;
  const closedReason = neverSubscribed ? 'trial_ended' : 'plan_ended';

  // A closed account may still READ. That is the whole difference between
  // closing a door and confiscating what is behind it: a writer who stops
  // paying stops adding to their boards, and takes any of them away as a PDF
  // whenever they want. Reading is what the PDF is built from, so refusing GET
  // meant the only way out was a JSON file of the entire account, which is a
  // backup and not somebody's script. Every WRITE still refuses below.
  if (closed && req.method !== 'GET') {
    return send(res, 402, {
      error: 'no_plan',
      reason: closedReason,
      message: (neverSubscribed ? 'Your free trial has ended, ' : 'Your plan has ended, ')
             + 'so the boards are closed to changes. Nothing has been '
             + 'deleted, you can download any of it, and picking a plan opens '
             + 'everything again exactly as you left it.'
    });
  }

  // ---------------------------------------------------------------- read --
  if (req.method === 'GET') {
    /* ?list=1 asks for the shelf, not the shelf's contents: id, name and
       structure, nothing else. The phone needs this to draw a script picker,
       and a writer with a dozen boards would otherwise pull every card, every
       outline and every character sheet down a cell connection to render a
       list of names. The desktop still gets everything, because it opens a
       board the moment it has one. */
    const cols = slim ? 'id,name,structure,sort_order,is_sample' : '*';
    const { data, error } = await db.from('projects')
      .select(cols).eq('user_id', user.id).order('sort_order', { ascending: true });
    if (error) return send(res, 500, { error: 'read_failed' });
    // `closed` is the client's cue to draw the locked screen over the shelf
    // rather than a board. It is only ever true with no plan at all.
    return send(res, 200, { projects: data || [],
                            closed: closed || undefined,
                            reason: closed ? closedReason : undefined });
  }

  // --------------------------------------------------------------- write --
  if (req.method === 'POST') {
    if (!body) body = await readBody(req);
    const p = body.project;
    if (!p || typeof p !== 'object') return send(res, 400, { error: 'bad_request' });

    const row = {
      user_id:    user.id,
      name:       String(p.name || 'Untitled').slice(0, 200),
      structure:  String(p.structure || 'stc').slice(0, 40),
      brief:      p.brief   && typeof p.brief   === 'object' ? p.brief   : {},
      cards:      Array.isArray(p.cards) ? p.cards : [],
      outline:    p.outline && typeof p.outline === 'object' ? p.outline : {},
      characters: Array.isArray(p.characters) ? p.characters : [],
      sort_order: Number.isFinite(p.sort_order) ? p.sort_order : 0,
      // Sample boards stay fully usable and stay out of every product number.
      // Set once by whoever created the row; a later save cannot un-sample a
      // demo board, because that is how a demo quietly becomes an activation.
      is_sample: !!p.is_sample,
      created_from: ['import', 'new_project', 'sample', 'other'].includes(p.created_from)
        ? p.created_from : null
    };

    if (JSON.stringify(row).length > MAX_BYTES) {
      return send(res, 413, {
        error: 'too_big',
        message: 'This project has grown past what a single board can hold. Split it in two.'
      });
    }

    if (p.id) {
      /* THE LAST SAVE WINS.

         This used to be an optimistic-concurrency check: the update carried the
         timestamp the browser had read and only applied if the row still had
         it. Two problems, both of which a writer met on an ordinary Tuesday.
         A project the browser had never re-read carried no timestamp, so the
         very first branch below refused it outright and every save of that
         project failed. And an exact string match on a timestamptz is fragile
         in the ways timestamps always are. Each refusal offered to keep the
         writer's work as a copy, which is how one script became three.

         A writer with one account editing their own script does not need a
         merge protocol. They need the version they just wrote. The browser
         side does the rest: a tab returning from the background reloads before
         it is allowed to save, so a stale copy cannot land on top of newer
         work. Mobile capture appends rows and never enters this path. */
      const { data, error } = await db.from('projects')
        .update(row).eq('id', p.id).eq('user_id', user.id).select();
      if (error) return send(res, 500, { error: 'save_failed' });
      // Editing a board is working on the script. The browser sends its own
      // local date; a line written at eleven at night is tonight's work.
      if (data && data.length) { markWorkDay(db, user.id, body.day);
                                 return send(res, 200, { project: data[0] }); }
      return send(res, 404, {
        error: 'not_found', message: 'This project no longer exists.'
      });
    }

    const { count } = await db.from('projects')
      .select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    if ((count || 0) >= MAX_PROJECTS) {
      return send(res, 409, {
        error: 'too_many',
        message: `You're at ${MAX_PROJECTS} projects. Close one you've finished with first.`
      });
    }

    const { data, error } = await db.from('projects').insert(row).select().single();
    if (error) return send(res, 500, { error: 'save_failed' });
    markWorkDay(db, user.id, body.day);
    return send(res, 200, { project: data });
  }

  // -------------------------------------------------------------- delete --
  if (req.method === 'DELETE') {
    const body = await readBody(req);
    if (!body.id) return send(res, 400, { error: 'bad_request' });
    await db.from('projects').delete().eq('id', body.id).eq('user_id', user.id);
    return send(res, 200, { ok: true });
  }

  return send(res, 405, { error: 'method' });
}
