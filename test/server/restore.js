/* RESTORE POINTS.
 *
 * Undo is thirty steps deep, lives in the tab, and dies on a refresh. These
 * are the other half: the board written to the server just before one of the
 * four operations that can eat work, so a writer who reloads after a bad
 * import still has a way back.
 *
 * The one that matters most is the deleted project. Restore points do NOT
 * cascade off the projects row, deliberately, and the endpoint recreates a
 * board that is no longer there rather than only overwriting one that is. If
 * that ever quietly becomes a cascade, the check below is what says so.
 */
import projects from './api/projects.real.js';
import { makeDb } from './fakedb.js';

const out = [];
const check = (n, ok, d) => {
  out.push({ n, ok });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (ok || !d ? '' : '\n          ' + d));
};

const P = extra => ({ id: 'u1', plan: 'beatfall', subscription_status: 'active',
  credits_used: 0, credits_extra: 0, is_admin: false, is_unlimited: false,
  period_start: '2026-09-01T00:00:00Z',
  trial_ends_at: null, stripe_subscription_id: null, ...extra });

function res(){
  const r = { code: 0, body: null, setHeader(){}, status(c){ r.code = c; return r; },
    send(b){ try { r.body = JSON.parse(b); } catch (e) { r.body = b; } return r; } };
  return r;
}

async function hit(db, req){
  globalThis.__AUTH__ = { db, user: { id: 'u1', email: 'w@x.y' }, profile: db.state.profile };
  const r = res();
  await projects({ headers: {}, ...req }, r);
  return r;
}

const BOARD = () => ({ id: 'p1', user_id: 'u1', name: 'Night Haul', structure: 'stc',
  cards: [{ id: 'c1', text: 'The lot at two in the morning.', slot: 'open' }],
  outline: { open: ['A truck idling.'] }, characters: [{ name: 'Dale' }],
  sort_order: 0, is_sample: false });

const snapOf = p => ({ name: p.name, structure: p.structure, brief: {},
  cards: p.cards, outline: p.outline, characters: p.characters,
  sort_order: p.sort_order, is_sample: p.is_sample });

/* readBody hands back req.body when it is already an object, which is how
   every other suite here posts. A JSON string would be iterated as a stream. */
const post = body => ({ method: 'POST', body });

// ---------- a point is written, and it carries the board
{
  const db = makeDb(P(), { projects: [BOARD()] });
  const r = await hit(db, post({ action: 'checkpoint', project_id: 'p1',
    reason: 'import', label: 'Before reading in notes', name: 'Night Haul',
    snapshot: snapOf(BOARD()) }));
  const kept = db.state.restore_points || [];
  check('a checkpoint is accepted', r.code === 200, r.code + ' ' + JSON.stringify(r.body));
  check('and the board is really in it', kept.length === 1
    && kept[0].snapshot.cards.length === 1
    && /two in the morning/.test(kept[0].snapshot.cards[0].text),
    JSON.stringify(kept).slice(0, 160));
  check('with the account on it, so it cannot be read by anybody else',
    kept[0].user_id === 'u1', kept[0] && kept[0].user_id);
  check('and the words a writer will read off the screen',
    kept[0].label === 'Before reading in notes', kept[0] && kept[0].label);
}

/* THE REASON IS A CLOSED LIST. It is printed to a writer as a sentence, so a
   client that could write anything into it is a client that can write anything
   onto that screen. */
{
  const db = makeDb(P(), { projects: [BOARD()] });
  const r = await hit(db, post({ action: 'checkpoint', project_id: 'p1',
    reason: 'whatever the client felt like', snapshot: snapOf(BOARD()) }));
  check('a reason nobody wrote down is refused', r.code === 400, String(r.code));
  check('and nothing is written', !(db.state.restore_points || []).length);
}

// ---------- the same ceiling the projects row has
{
  const db = makeDb(P(), { projects: [BOARD()] });
  const huge = snapOf(BOARD());
  huge.cards = [{ id: 'c1', text: 'x'.repeat(500000), slot: 'open' }];
  const r = await hit(db, post({ action: 'checkpoint', project_id: 'p1',
    reason: 'import', snapshot: huge }));
  check('a snapshot past the size a board may be is refused', r.code === 413, String(r.code));
}

/* FIVE, AND THE OLDEST GOES. Unbounded would make this table the biggest thing
   in the database, and a writer does not need a hundred ways back. */
{
  const db = makeDb(P(), { projects: [BOARD()] });
  for (let i = 1; i <= 7; i++){
    const snap = snapOf(BOARD());
    snap.name = 'version ' + i;
    await hit(db, post({ action: 'checkpoint', project_id: 'p1',
      reason: 'empty', label: 'point ' + i, snapshot: snap }));
  }
  const kept = db.state.restore_points || [];
  check('only five points are kept per board', kept.length === 5, String(kept.length));
  check('and it is the oldest two that went',
    kept.map(p => p.label).join(',') === 'point 3,point 4,point 5,point 6,point 7',
    kept.map(p => p.label).join(','));

  // Another board's points are not touched by this one filling up.
  const db2 = makeDb(P(), { projects: [BOARD(), { ...BOARD(), id: 'p2', name: 'Sidework' }] });
  for (let i = 1; i <= 6; i++)
    await hit(db2, post({ action: 'checkpoint', project_id: 'p1',
      reason: 'empty', label: 'a' + i, snapshot: snapOf(BOARD()) }));
  await hit(db2, post({ action: 'checkpoint', project_id: 'p2',
    reason: 'empty', label: 'other board', snapshot: snapOf(BOARD()) }));
  const forP2 = (db2.state.restore_points || []).filter(p => p.project_id === 'p2');
  check('one board filling its five does not spend another board\'s',
    forP2.length === 1, JSON.stringify((db2.state.restore_points || []).map(p => p.project_id)));
}

/* THE LIST IS A LIST, NOT FIVE BOARDS. Sending the snapshots to draw five rows
   of "what happened and when" would be the heaviest read in the product. */
{
  const db = makeDb(P(), { projects: [BOARD()] });
  await hit(db, post({ action: 'checkpoint', project_id: 'p1',
    reason: 'structure', label: 'Before changing the structure', snapshot: snapOf(BOARD()) }));
  const r = await hit(db, { method: 'GET', url: '/api/projects?points=p1' });
  check('the list comes back', r.code === 200 && (r.body.points || []).length === 1,
    r.code + ' ' + JSON.stringify(r.body).slice(0, 120));
  const row = (r.body.points || [])[0] || {};
  check('and it does not carry the boards with it', row.snapshot === undefined,
    Object.keys(row).join(','));
  check('but it does carry what happened and when',
    /Before changing/.test(row.label || '') && !!row.created_at, JSON.stringify(row));
}

// ---------- putting one back
{
  const db = makeDb(P(), { projects: [BOARD()] });
  const was = snapOf(BOARD());
  await hit(db, post({ action: 'checkpoint', project_id: 'p1',
    reason: 'import', label: 'Before reading in notes', snapshot: was }));

  // The import happens: the board fills with the wrong material.
  db.state.projects[0].cards = [
    { id: 'x1', text: 'a line from another film', slot: 'mid' },
    { id: 'x2', text: 'and another', slot: 'fun' }];
  db.state.projects[0].name = 'BLACK RIVER';

  const id = db.state.restore_points[0].id;
  const r = await hit(db, post({ action: 'restore', point_id: id }));
  check('a restore is accepted', r.code === 200, r.code + ' ' + JSON.stringify(r.body).slice(0, 120));
  const now = db.state.projects[0];
  check('the board is the board again',
    now.cards.length === 1 && /two in the morning/.test(now.cards[0].text),
    JSON.stringify(now.cards).slice(0, 140));
  check('and so is its name, which an import had taken',
    now.name === 'Night Haul', now.name);
  check('the prose comes back with it',
    JSON.stringify(now.outline) === JSON.stringify(was.outline), JSON.stringify(now.outline));
  check('and the cast', (now.characters || []).length === 1, JSON.stringify(now.characters));
}

/* THE ONE THIS FEATURE EXISTS FOR. Deleting a project is the most destructive
   thing in the app and the confirm says it cannot be undone. It can now, and
   the reason is that these rows do not hang off the projects row. */
{
  const db = makeDb(P(), { projects: [BOARD()] });
  await hit(db, post({ action: 'checkpoint', project_id: 'p1',
    reason: 'delete', label: 'Before deleting this project', snapshot: snapOf(BOARD()) }));
  await hit(db, { method: 'DELETE', body: { id: 'p1' } });
  check('the board really is gone', db.state.projects.length === 0,
    JSON.stringify(db.state.projects));
  check('and its way back is still here',
    (db.state.restore_points || []).length === 1, 'the points cascaded with the row');

  const id = db.state.restore_points[0].id;
  const r = await hit(db, post({ action: 'restore', point_id: id }));
  check('restoring brings a deleted board back', r.code === 200 && !!r.body.recreated,
    r.code + ' ' + JSON.stringify(r.body).slice(0, 120));
  check('under its own id, so its other points still point at it',
    db.state.projects.length === 1 && db.state.projects[0].id === 'p1',
    JSON.stringify(db.state.projects.map(p => p.id)));
  check('with the writing in it', /two in the morning/.test(
    JSON.stringify(db.state.projects[0].cards)), JSON.stringify(db.state.projects[0].cards));
}

// ---------- somebody else's point is not yours
{
  const db = makeDb(P(), { projects: [BOARD()],
    restore_points: [{ id: 99, user_id: 'u2', project_id: 'p9', reason: 'import',
      label: 'someone else', name: 'Their Film', snapshot: snapOf(BOARD()) }] });
  const r = await hit(db, post({ action: 'restore', point_id: 99 }));
  check('another account\'s restore point cannot be read', r.code === 404, String(r.code));
  check('and nothing of theirs lands in your shelf',
    db.state.projects.length === 1 && db.state.projects[0].id === 'p1',
    JSON.stringify(db.state.projects.map(p => p.id)));
}

// ---------- a point that is not there
{
  const db = makeDb(P(), { projects: [BOARD()] });
  const r = await hit(db, post({ action: 'restore', point_id: 4242 }));
  check('restoring a point that does not exist says so rather than emptying a board',
    r.code === 404 && db.state.projects[0].cards.length === 1, String(r.code));
}

/* A CLOSED PLAN MAY READ AND MAY NOT WRITE, and that rule has to cover these
   two as well. A restore is a write to somebody's board whatever it is called,
   and a checkpoint of a board nobody may edit is a write with no purpose. */
{
  const db = makeDb(P({ plan: 'none', subscription_status: null, stripe_subscription_id: null }),
    { projects: [BOARD()] });
  const a = await hit(db, post({ action: 'checkpoint', project_id: 'p1',
    reason: 'import', snapshot: snapOf(BOARD()) }));
  const b = await hit(db, post({ action: 'restore', point_id: 1 }));
  check('a closed account cannot write a restore point', a.code === 402, String(a.code));
  check('and cannot restore one', b.code === 402, String(b.code));
  check('and nothing was written while it tried',
    !(db.state.restore_points || []).length, JSON.stringify(db.state.restore_points));
}

// ---------- a checkpoint with nothing in it
{
  const db = makeDb(P(), { projects: [BOARD()] });
  const a = await hit(db, post({ action: 'checkpoint', reason: 'import', snapshot: snapOf(BOARD()) }));
  const b = await hit(db, post({ action: 'checkpoint', project_id: 'p1', reason: 'import' }));
  check('a checkpoint with no board named is refused', a.code === 400, String(a.code));
  check('and one with no board in it', b.code === 400, String(b.code));
}

const failed = out.filter(r => !r.ok);
console.log('\n' + (out.length - failed.length) + ' of ' + out.length + ' passed');
if (failed.length) {
  console.log('\nFAILED:');
  failed.forEach(f => console.log('  ' + f.n));
  process.exit(1);
}
