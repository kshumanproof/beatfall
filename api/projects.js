// ============================================================================
// Projects: load everything on sign-in, save one project at a time.
//
// The board is stored as JSON on a single row per project. The client already
// holds it that way, so this stays one code path instead of a table per card.
// ============================================================================
import { requireUser, send, readBody } from './_lib/core.js';

const MAX_PROJECTS = 60;
const MAX_BYTES    = 400_000;   // a very large board is ~40kb; this is generous

export default async function handler(req, res) {
  const auth = await requireUser(req);
  if (auth.error) return send(res, auth.status, { error: auth.error });
  const { db, user } = auth;

  // ---------------------------------------------------------------- read --
  if (req.method === 'GET') {
    const { data, error } = await db.from('projects')
      .select('*').eq('user_id', user.id).order('sort_order', { ascending: true });
    if (error) return send(res, 500, { error: 'read_failed' });
    return send(res, 200, { projects: data || [] });
  }

  // --------------------------------------------------------------- write --
  if (req.method === 'POST') {
    const body = await readBody(req);
    const p = body.project;
    if (!p || typeof p !== 'object') return send(res, 400, { error: 'bad_request' });

    const row = {
      user_id:    user.id,
      name:       String(p.name || 'Untitled').slice(0, 200),
      structure:  String(p.structure || 'stc').slice(0, 40),
      brief:      p.brief   && typeof p.brief   === 'object' ? p.brief   : {},
      cards:      Array.isArray(p.cards) ? p.cards : [],
      outline:    p.outline && typeof p.outline === 'object' ? p.outline : {},
      sort_order: Number.isFinite(p.sort_order) ? p.sort_order : 0
    };

    if (JSON.stringify(row).length > MAX_BYTES) {
      return send(res, 413, {
        error: 'too_big',
        message: 'This project has grown past what a single board can hold. Split it in two.'
      });
    }

    if (p.id) {
      const { data, error } = await db.from('projects')
        .update(row).eq('id', p.id).eq('user_id', user.id).select().single();
      if (error) return send(res, 500, { error: 'save_failed' });
      return send(res, 200, { project: data });
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
