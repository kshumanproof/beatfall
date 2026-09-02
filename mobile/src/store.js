// ============================================================================
// The local store. This is the whole point of building a native app rather
// than a mobile website: a note typed in a parking garage with no signal has
// to still be there tomorrow.
//
// So the rule is absolute — a capture is written to disk BEFORE the screen
// says it was captured. The network is never in that path. Sync is something
// that happens to a note later; it is not how a note comes into existence.
//
// SQLite rather than AsyncStorage because AsyncStorage rewrites the entire
// blob on every change. At 400 notes on a cheap Android phone that is a
// visible stutter on a screen whose only job is to feel instant.
// ============================================================================
import * as SQLite from 'expo-sqlite';

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
  `);
  return db;
}

// A client-side id, generated before the note is saved. The server takes this
// as the primary key too, which is what makes re-sending a batch harmless:
// send the same note twice and the second one lands on the same row.
function newId() {
  const rand = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `c_${Date.now().toString(36)}_${rand()}${rand()}`;
}

export async function add(body) {
  const text = String(body || '').trim();
  if (!text) return null;
  const db = await open();
  const row = { id: newId(), body: text, created_at: Date.now(), synced_at: null, deleted: 0 };
  await db.runAsync(
    'INSERT INTO captures (id, body, created_at, synced_at, deleted) VALUES (?, ?, ?, NULL, 0)',
    row.id, row.body, row.created_at
  );
  return row;
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
export async function remove(id) {
  const db = await open();
  await db.runAsync('UPDATE captures SET deleted = 1, synced_at = NULL WHERE id = ?', id);
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

export async function counts() {
  const db = await open();
  const a = await db.getFirstAsync('SELECT COUNT(*) AS n FROM captures WHERE deleted = 0');
  const b = await db.getFirstAsync('SELECT COUNT(*) AS n FROM captures WHERE synced_at IS NULL');
  return { total: a?.n || 0, waiting: b?.n || 0 };
}

// Called by the sync layer once the server has confirmed a batch.
export async function markSynced(ids, when = Date.now()) {
  if (!ids || !ids.length) return;
  const db = await open();
  const holes = ids.map(() => '?').join(',');
  await db.runAsync(`UPDATE captures SET synced_at = ? WHERE id IN (${holes})`, when, ...ids);
  // Once a tombstone is on the server, the row has done its job.
  await db.runAsync('DELETE FROM captures WHERE deleted = 1 AND synced_at IS NOT NULL');
}
