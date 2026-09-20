// ============================================================================
// The local store. This is the whole point of building a native app rather
// than a mobile website: a note typed in a parking garage with no signal has
// to still be there tomorrow.
//
// So the rule is absolute: a capture is written to disk BEFORE the screen
// says it was captured. The network is never in that path. Sync is something
// that happens to a note later; it is not how a note comes into existence.
//
// SQLite rather than AsyncStorage because AsyncStorage rewrites the entire
// blob on every change. At 400 notes on a cheap Android phone that is a
// visible stutter on a screen whose only job is to feel instant.
// ============================================================================
import * as SQLite from 'expo-sqlite';
import * as photos from './photos';

let dbp = null;

function open() {
  if (!dbp) dbp = SQLite.openDatabaseAsync('beatfall.db');
  return dbp;
}

export async function init() {
  const db = await open();
  // WAL so a write never blocks the read that repaints the list.
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS captures (
      id          TEXT PRIMARY KEY,   -- made on this phone; the sync idempotency key
      body        TEXT NOT NULL,
      created_at  INTEGER NOT NULL,   -- device clock, epoch ms
      synced_at   INTEGER,            -- NULL until the server has confirmed it
      deleted     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS captures_pending
      ON captures (synced_at, created_at);

    -- Somewhere to keep the signed-in session and the server's public
    -- settings. Deliberately the SAME SQLite file rather than a second
    -- storage library: AsyncStorage would be another native dependency to
    -- install, keep in step with the Expo SDK, and explain to anybody setting
    -- this up, and it would buy nothing this table does not already do.
    CREATE TABLE IF NOT EXISTS kv (
      k  TEXT PRIMARY KEY,
      v  TEXT
    );
  `);

  /* Which script a note belongs to, and the name of it at the time.
     Both, on purpose. The id is what the server files it under; the NAME is
     what the phone shows in the list, and it has to still be there when the
     writer is underground with no signal and the shelf cache is stale. A row
     that can only say "project 4f2a" is a row the writer cannot check.

     Added after the first build shipped, so it is an ALTER guarded by a look
     at the existing columns rather than a bump in the CREATE above: phones
     already carrying notes must not lose them to a schema change. */
  const cols = await db.getAllAsync('PRAGMA table_info(captures)');
  const has = (n) => cols.some((c) => c.name === n);
  if (!has('project_id'))   await db.execAsync('ALTER TABLE captures ADD COLUMN project_id TEXT');
  if (!has('project_name')) await db.execAsync('ALTER TABLE captures ADD COLUMN project_name TEXT');

  /* A PICTURE ON A NOTE, IN TWO PIECES, BECAUSE THEY ARE TWO DIFFERENT FACTS.
   *
   *   photo_uri   the file on THIS PHONE. Written before the screen says the
   *               note was kept, and deleted once the picture is safely on the
   *               account. This is the one the phone can show while offline.
   *
   *   image_path  where the picture lives on the ACCOUNT, handed back by the
   *               server after the upload. Named the same as the server's own
   *               column on purpose: it is the same fact, and a second name
   *               for one fact is how two halves of an app drift apart.
   *
   * Kept apart because the upload and the note are sent in two steps, and a
   * phone that lost signal between them must know which step it got to. With
   * one column it would either upload the same picture twice or send a note
   * pointing at bytes that never arrived. */
  if (!has('photo_uri'))   await db.execAsync('ALTER TABLE captures ADD COLUMN photo_uri TEXT');
  if (!has('image_path'))  await db.execAsync('ALTER TABLE captures ADD COLUMN image_path TEXT');
  return db;
}

// ------------------------------------------------------------------- kv --
// Supabase wants a storage object shaped like this, so it is shaped like this.
export async function getItem(k) {
  const db = await open();
  const row = await db.getFirstAsync('SELECT v FROM kv WHERE k = ?', k);
  return row ? row.v : null;
}

export async function setItem(k, v) {
  const db = await open();
  await db.runAsync(
    'INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v',
    k, String(v)
  );
}

export async function removeItem(k) {
  const db = await open();
  await db.runAsync('DELETE FROM kv WHERE k = ?', k);
}

/* Where the shelf and the last choice live. Both are read by the picker and
   written by the sender, so the keys belong here rather than in either one. */
export const SHELF = 'scripts.cache';
export const LAST  = 'scripts.last';

/* A title typed on the phone before it exists on the server. It behaves like
   a script everywhere on this device, and it becomes a real one at Send. */
export const LOCAL = 'local:';
export const isLocal = (id) => String(id || '').indexOf(LOCAL) === 0;

/* One note, however it was typed. The desk and the server reduce a note to
   these same words before deciding whether they have seen it, and all three
   have to agree or a twin slips through whichever one is looser. */
function same(t) {
  return String(t == null ? '' : t)
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[.,]+$/, '');
}

// A client-side id, generated before the note is saved. The server takes this
// as the primary key too, which is what makes re-sending a batch harmless:
// send the same note twice and the second one lands on the same row.
function newId() {
  const rand = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `c_${Date.now().toString(36)}_${rand()}${rand()}`;
}

/* A working title has become a real script. Everything on this phone that
   pointed at the local one now points at the real one: the notes waiting to
   go, the shelf the picker draws, and the script the writer is filing under.
   Missing any of those three leaves the phone quietly out of step with the
   desk in a way the writer would only notice much later. */
export async function promoteProject(localId, real) {
  const db = await open();
  await db.runAsync(
    'UPDATE captures SET project_id = ?, project_name = ? WHERE project_id = ?',
    real.id, real.name, localId
  );
  try {
    const raw = await getItem(SHELF);
    if (raw) {
      const list = JSON.parse(raw).map((p) => (String(p.id) === String(localId)
        ? { id: real.id, name: real.name, structure: real.structure } : p));
      await setItem(SHELF, JSON.stringify(list));
    }
  } catch (e) {}
  try {
    const raw = await getItem(LAST);
    if (raw) {
      const last = JSON.parse(raw);
      if (last && String(last.id) === String(localId)) {
        await setItem(LAST, JSON.stringify({ id: real.id, name: real.name }));
      }
    }
  } catch (e) {}
}

export async function add(body, project, photo) {
  const text = String(body || '').trim();
  const pic  = (photo && photo.uri) || null;
  // A picture with nothing typed under it is a whole note. Words with nothing
  // in them still are not.
  if (!text && !pic) return null;
  const db = await open();

  /* The same words, to the same script, in the last two minutes, is one note.
   *
   * A writer does not catch the identical sentence twice in a row on purpose.
   * They press Keep again because the screen did not appear to react, and one
   * hesitant thumb should not become three cards on a board. Two minutes is
   * short enough that a deliberate repeat later in the evening still lands.
   *
   * Same words, not same string: capitals, stray spaces, curly quotes and a
   * full stop on the end are typing, not meaning. Matched here the way the
   * desk and the server match it, so all three agree on what one note is. */
  /* A PICTURE IS NEVER A TWIN. Two photographs with nothing typed under them
     are two empty strings, and the words test would call them one note. Four
     shots of the same doorway are four shots of the same doorway. The server
     takes the same view, so neither end can quietly eat one. */
  if (!pic) {
    const recent = await db.getAllAsync(
      'SELECT * FROM captures WHERE deleted = 0 AND photo_uri IS NULL'
      + ' AND created_at > ? AND ifnull(project_id, \'\') = ifnull(?, \'\')',
      Date.now() - 120000, (project && project.id) || null
    );
    const twin = (recent || []).find((r) => same(r.body) === same(text));
    if (twin) return twin;
  }

  const row = {
    id: newId(), body: text, created_at: Date.now(), synced_at: null, deleted: 0,
    project_id:   (project && project.id)   || null,
    project_name: (project && project.name) || null,
    photo_uri: pic, image_path: null,
  };
  await db.runAsync(
    'INSERT INTO captures (id, body, created_at, synced_at, deleted, project_id,'
    + ' project_name, photo_uri) VALUES (?, ?, ?, NULL, 0, ?, ?, ?)',
    row.id, row.body, row.created_at, row.project_id, row.project_name, row.photo_uri
  );
  return row;
}

/* The picture has reached the account. Written down the moment the server
   says so and before the note is sent, so a connection that dies in between
   costs one note re-sent rather than the same photograph uploaded twice. */
export async function markUploaded(id, path) {
  const db = await open();
  await db.runAsync('UPDATE captures SET image_path = ? WHERE id = ?', path, id);
}

/* THE PICTURE IS NOT ON THIS PHONE ANY MORE AND NEVER REACHED THE ACCOUNT.
 *
 * Rare, and worth handling rather than ignoring: somebody cleared storage, or
 * the move off the camera's temporary folder failed in a way that left nothing
 * behind. The note is not held hostage to it. If there are words, they go home
 * as an ordinary note. If there are no words, there is nothing left to send
 * and carrying the row for ever would put a permanent "1 waiting" on a button
 * that can never reach zero. */
export async function photoLost(id) {
  const db = await open();
  const row = await db.getFirstAsync('SELECT body FROM captures WHERE id = ?', id);
  if (row && String(row.body || '').trim()) {
    await db.runAsync('UPDATE captures SET photo_uri = NULL WHERE id = ?', id);
    return;
  }
  await db.runAsync('DELETE FROM captures WHERE id = ?', id);
}

/* Move a note to a different script. Un-syncs it, same as an edit does: the
   server's copy is now filed in the wrong place. */
export async function refile(id, project) {
  const db = await open();
  await db.runAsync(
    'UPDATE captures SET project_id = ?, project_name = ?, synced_at = NULL WHERE id = ?',
    (project && project.id) || null, (project && project.name) || null, id
  );
}

export async function edit(id, body) {
  const text = String(body || '').trim();
  const db = await open();
  if (!text) return remove(id);
  // Editing un-syncs it: the server's copy is now stale and must be re-sent.
  await db.runAsync('UPDATE captures SET body = ?, synced_at = NULL WHERE id = ?', text, id);
}

// A soft delete, and deliberately so. A hard delete on the phone would leave
// the server holding a note the writer has already thrown away, with no way
// to know. The tombstone syncs; then the row can go.
/* Thrown away on the phone.
 *
 * A note the server has never seen is simply gone: there is no row out there
 * to tell about it, so leaving a tombstone behind only gives the sender
 * something pointless to carry. A note that HAS been sent leaves a tombstone,
 * because the desk is holding a copy and has to be told.
 *
 * The old version tombstoned everything, and that is the bug where the Send
 * button counted a note the writer had already thrown away. The list showed
 * nothing and the button said one note waiting, which is the app disagreeing
 * with itself in front of somebody who is trying to trust it with their
 * ideas. */
export async function remove(id) {
  const db = await open();
  const row = await db.getFirstAsync(
    'SELECT synced_at, photo_uri FROM captures WHERE id = ?', id);
  /* The picture goes off this phone either way. A note thrown away is thrown
     away, and leaving the photograph behind would fill somebody's storage
     with things they have already said they do not want.

     If it had already been uploaded, the copy on the account is swept up by
     the nightly orphan pass, because no board and no waiting note points at
     it any more. Nothing here has to chase it. */
  if (row && row.photo_uri) photos.drop(row.photo_uri);
  if (row && row.synced_at == null) {
    await db.runAsync('DELETE FROM captures WHERE id = ?', id);
    return;
  }
  await db.runAsync(
    'UPDATE captures SET deleted = 1, synced_at = NULL, photo_uri = NULL WHERE id = ?', id);
}

export async function undelete(id) {
  const db = await open();
  await db.runAsync('UPDATE captures SET deleted = 0, synced_at = NULL WHERE id = ?', id);
}

export async function list(limit = 200) {
  const db = await open();
  return db.getAllAsync(
    'SELECT * FROM captures WHERE deleted = 0 ORDER BY created_at DESC LIMIT ?', limit
  );
}

export async function pending() {
  const db = await open();
  return db.getAllAsync(
    'SELECT * FROM captures WHERE synced_at IS NULL ORDER BY created_at ASC LIMIT 200'
  );
}

/* Everything in this table is now, by definition, still waiting: a sent note
   is deleted rather than kept. Left as its own function because the two
   questions are different questions and one of them may stop being the other. */

export async function counts() {
  const db = await open();
  const a = await db.getFirstAsync('SELECT COUNT(*) AS n FROM captures WHERE deleted = 0');
  /* Counted the way the writer counts: notes they can see, that have not gone
     home. A tombstone is a message to the server, not a note, and it must
     never appear in a number on a button next to an empty list. The sender
     still picks tombstones up; see pending(). */
  const b = await db.getFirstAsync(
    'SELECT COUNT(*) AS n FROM captures WHERE synced_at IS NULL AND deleted = 0');
  return { total: a?.n || 0, waiting: b?.n || 0 };
}

/* Called once the server has CONFIRMED a batch, and the confirmation is the
 * whole point: only ids the server named come out of here.
 *
 * They are deleted, not marked. This phone is not an archive. Its job is that
 * nothing is lost between having a thought and getting to a desk, and the
 * moment a note is on the account that job is done. Keeping it here as well
 * turns "on this phone" into a second pile to read through, which is the
 * jumbled note file this whole product exists to end. */
export async function forgetSent(ids) {
  if (!ids || !ids.length) return;
  const db = await open();
  const holes = ids.map(() => '?').join(',');
  /* The pictures go with them, and only now. The local copy is the only copy
     until the server has confirmed the note, so deleting it any earlier than
     this is the one mistake this whole file exists to prevent. */
  const going = await db.getAllAsync(
    `SELECT photo_uri FROM captures WHERE id IN (${holes}) AND photo_uri IS NOT NULL`, ...ids);
  (going || []).forEach((r) => photos.drop(r.photo_uri));
  await db.runAsync(`DELETE FROM captures WHERE id IN (${holes})`, ...ids);
}

// How many have ever made it home from this phone. Only used to tell an empty
// list apart from a list that emptied itself, which are different sentences.
export async function sentTally() {
  const v = await getItem('sent.count');
  return Number(v) || 0;
}
export async function addSent(n) {
  if (!n) return;
  await setItem('sent.count', String((await sentTally()) + n));
  // When, as well as how many. "Nothing waiting" is only reassuring if the
  // writer can see that something did in fact go home recently.
  await setItem('sent.at', String(Date.now()));
}

export async function lastSent() {
  const v = await getItem('sent.at');
  return Number(v) || 0;
}

/* NOTHING LEFT ON THIS DEVICE.
 *
 * Only ever called after the server has confirmed the account is gone. It
 * takes the notes, the session, the cached shelf, the tallies, every key: an
 * account that has been deleted must not be recoverable by whoever picks the
 * phone up next, and half a wipe is worse than none because it looks clean.
 *
 * DELETE FROM rather than DROP TABLE, so the schema survives and the next
 * writer to sign in on this phone gets a working database rather than one
 * that has to be rebuilt on the first note they type. */
export async function wipe() {
  const db = await open();
  // The pictures first. A row is what remembers where a file is, so taking the
  // rows away before the files leaves photographs of real people on the phone
  // with nothing left that knows they are there.
  photos.dropAll();
  await db.execAsync('DELETE FROM captures; DELETE FROM kv;');
}
