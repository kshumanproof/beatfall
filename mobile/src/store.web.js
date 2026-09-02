// ============================================================================
// Browser stand-in for the local store.
//
// Metro picks this file over store.js for the `web` platform and ignores it
// everywhere else, so nothing here reaches an iPhone or an Android build. It
// exists so the app can be opened in a browser — for design review, and so
// getting a look at it never depends on a phone, a QR code and a firewall.
//
// It keeps notes in localStorage rather than memory, so a refresh doesn't wipe
// them and the preview behaves like the real thing. It is still NOT the real
// thing: the phone writes to SQLite, survives a force-quit and a dead battery,
// and that durability promise belongs to store.js alone.
// ============================================================================
const KEY = 'beatfall.web.captures';

function read() {
  try {
    const a = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch (e) { return []; }
}

function write(rows) {
  try { window.localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) {}
}

function newId() {
  const rand = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `c_${Date.now().toString(36)}_${rand()}${rand()}`;
}

export async function init() { read(); return true; }

export async function add(body) {
  const text = String(body || '').trim();
  if (!text) return null;
  const row = { id: newId(), body: text, created_at: Date.now(), synced_at: null, deleted: 0 };
  const rows = read(); rows.push(row); write(rows);
  return row;
}

export async function edit(id, body) {
  const text = String(body || '').trim();
  if (!text) return remove(id);
  const rows = read();
  const r = rows.find((x) => x.id === id);
  if (r) { r.body = text; r.synced_at = null; write(rows); }
}

export async function remove(id) {
  const rows = read();
  const r = rows.find((x) => x.id === id);
  if (r) { r.deleted = 1; r.synced_at = null; write(rows); }
}

export async function undelete(id) {
  const rows = read();
  const r = rows.find((x) => x.id === id);
  if (r) { r.deleted = 0; r.synced_at = null; write(rows); }
}

export async function list(limit = 200) {
  return read().filter((r) => !r.deleted)
               .sort((a, b) => b.created_at - a.created_at)
               .slice(0, limit);
}

export async function pending() {
  return read().filter((r) => r.synced_at == null)
               .sort((a, b) => a.created_at - b.created_at);
}

export async function counts() {
  const rows = read();
  return {
    total: rows.filter((r) => !r.deleted).length,
    waiting: rows.filter((r) => r.synced_at == null).length,
  };
}

export async function markSynced(ids, when = Date.now()) {
  const set = new Set(ids || []);
  let rows = read();
  rows.forEach((r) => { if (set.has(r.id)) r.synced_at = when; });
  rows = rows.filter((r) => !(r.deleted && r.synced_at != null));
  write(rows);
}
