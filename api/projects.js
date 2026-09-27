// ============================================================================
// Projects: load everything on sign-in, save one project at a time.
//
// The board is stored as JSON on a single row per project. The client already
// holds it that way, so this stays one code path instead of a table per card.
// ============================================================================
import { requireUser, entitlement, send, readBody, markWorkDay } from './_lib/core.js';

const MAX_PROJECTS = 60;
const MAX_BYTES    = 400_000;   // a very large board is ~40kb; this is generous

/* RESTORE POINTS. Five per project, oldest dropped on each write.
   Five is enough to get back past a bad run of decisions in one sitting and
   small enough that the table cannot become the biggest thing in the
   database. The reasons are a closed list because they are read back as
   words on a screen, and an open one would let a bad client write anything
   into a sentence a writer reads. */
const KEEP_POINTS = 5;
const REASONS = ['import', 'structure', 'empty', 'delete', 'restore'];

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
    /* The restore list for one board. Deliberately without the snapshots:
       the list is five rows of "what happened and when", and sending five
       whole boards to draw it would be the heaviest read in the product. */
    let wantPoints = null;
    try {
      wantPoints = new URL(req.url, 'http://x').searchParams.get('points');
    } catch (e) {}
    if (wantPoints) {
      const { data, error } = await db.from('restore_points')
        .select('id,project_id,reason,label,name,created_at')
        .eq('user_id', user.id).eq('project_id', wantPoints)
        /* BY ID, NOT BY DATE. The key is a bigserial and strictly increases;
           created_at does not, because five points written inside the same
           second carry the same timestamp and the order of a tie is whatever
           the planner felt like. Newest first either way, but only one of the
           two is actually deterministic. */
        .order('id', { ascending: false }).limit(KEEP_POINTS);
      if (error) return send(res, 500, { error: 'read_failed' });
      return send(res, 200, { points: data || [] });
    }

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

    /* ------------------------------------------------- a restore point --
       Written by the client immediately BEFORE one of the four operations
       that can eat work. It is the board as it stood, plus one sentence
       saying what was about to happen to it. */
    if (body.action === 'checkpoint') {
      const pid  = String(body.project_id || '');
      const snap = body.snapshot;
      if (!pid || !snap || typeof snap !== 'object')
        return send(res, 400, { error: 'bad_request' });
      if (!REASONS.includes(body.reason))
        return send(res, 400, { error: 'bad_reason' });
      if (JSON.stringify(snap).length > MAX_BYTES)
        return send(res, 413, { error: 'too_big' });

      const { error } = await db.from('restore_points').insert({
        user_id: user.id,
        project_id: pid,
        reason: body.reason,
        label: String(body.label || '').slice(0, 160),
        name:  String(body.name  || '').slice(0, 200),
        snapshot: snap
      });
      if (error) return send(res, 500, { error: 'checkpoint_failed' });

      /* Trim to the last five for this board, oldest first out. Read the ids
         and delete by id rather than comparing dates: an exact match against a
         timestamptz is the fragile thing this endpoint already learned not to
         rely on once, and two points written in the same second tie. */
      const { data: all } = await db.from('restore_points')
        .select('id').eq('user_id', user.id).eq('project_id', pid)
        .order('id', { ascending: false });
      const spare = (all || []).slice(KEEP_POINTS).map(r => r.id);
      if (spare.length) await db.from('restore_points').delete().in('id', spare);

      return send(res, 200, { ok: true });
    }

    /* ---------------------------------------------------- put one back --
       The project may or may not still exist: deleting a board is one of the
       things a point is taken before, so restoring one has to be able to
       bring the row back rather than only overwrite it. */
    if (body.action === 'restore') {
      const { data: pt, error: readErr } = await db.from('restore_points')
        .select('*').eq('user_id', user.id).eq('id', body.point_id).single();
      if (readErr || !pt) return send(res, 404, { error: 'no_point' });

      const snap = pt.snapshot || {};
      const back = {
        user_id:    user.id,
        name:       String(snap.name || pt.name || 'Untitled').slice(0, 200),
        structure:  String(snap.structure || 'stc').slice(0, 40),
        brief:      snap.brief   && typeof snap.brief   === 'object' ? snap.brief   : {},
        cards:      Array.isArray(snap.cards) ? snap.cards : [],
        outline:    snap.outline && typeof snap.outline === 'object' ? snap.outline : {},
        characters: Array.isArray(snap.characters) ? snap.characters : [],
        sort_order: Number.isFinite(snap.sort_order) ? snap.sort_order : 0,
        is_sample:  !!snap.is_sample,
        created_from: ['import', 'new_project', 'sample', 'other'].includes(snap.created_from)
          ? snap.created_from : null
      };

      const { data: still } = await db.from('projects')
        .select('id').eq('id', pt.project_id).eq('user_id', user.id).maybeSingle();

      if (still) {
        const { data, error } = await db.from('projects')
          .update(back).eq('id', pt.project_id).eq('user_id', user.id).select();
        if (error) return send(res, 500, { error: 'restore_failed' });
        return send(res, 200, { project: (data || [])[0] });
      }

      /* The board was deleted. Bring it back under its own id, so every
         restore point still pointing at it keeps pointing at it. */
      const { data, error } = await db.from('projects')
        .insert(Object.assign({ id: pt.project_id }, back)).select().single();
      if (error) return send(res, 500, { error: 'restore_failed' });
      return send(res, 200, { project: data, recreated: true });
    }

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
