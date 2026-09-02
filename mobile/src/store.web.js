// ============================================================================
// Web-only stand-in for the local store.
//
// Metro picks this file over store.js for the `web` platform and ignores it
// everywhere else, so nothing here reaches an iPhone or an Android build. It
// exists so the screen can be rendered in a browser for design review —
// expo-sqlite's web backend needs a WASM asset that isn't resolvable here, and
// the phone is the platform that matters.
//
// It is memory-only on purpose. Nothing in this file should ever be mistaken
// for the durability promise the real store makes.
// ============================================================================
let rows = [];

function newId() {
  const rand = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `c_${Date.now().toString(36)}_${rand()}${rand()}`;
}

export async function init() { return true; }

export async function add(body) {
  const text = String(body || '').trim();
  if (!text) return null;
  const row = { id: newId(), body: text, created_at: Date.now(), synced_at: null, deleted: 0 };
  rows.push(row);
  return row;
}

export async function edit(id, body) {
  const text = String(body || '').trim();
  if (!text) return remove(id);
  const r = rows.find((x) => x.id === id);
  if (r) { r.body = text; r.synced_at = null; }
}

export async function remove(id) {
  const r = rows.find((x) => x.id === id);
  if (r) { r.deleted = 1; r.synced_at = null; }
}

export async function undelete(id) {
  const r = rows.find((x) => x.id === id);
  if (r) { r.deleted = 0; r.synced_at = null; }
}

export async function list(limit = 200) {
  return rows.filter((r) => !r.deleted).sort((a, b) => b.created_at - a.created_at).slice(0, limit);
}

export async function pending() {
  return rows.filter((r) => r.synced_at == null).sort((a, b) => a.created_at - b.created_at);
}

export async function counts() {
  return {
    total: rows.filter((r) => !r.deleted).length,
    waiting: rows.filter((r) => r.synced_at == null).length,
  };
}

export async function markSynced(ids, when = Date.now()) {
  const set = new Set(ids || []);
  rows.forEach((r) => { if (set.has(r.id)) r.synced_at = when; });
  rows = rows.filter((r) => !(r.deleted && r.synced_at != null));
}
