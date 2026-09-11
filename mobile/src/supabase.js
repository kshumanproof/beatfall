// ============================================================================
// Who you are, on the phone.
//
// The same Supabase project the web app uses, reached the same way: the URL
// and the public key are fetched from /api/config rather than typed in here,
// so there is one place they live and a phone build can never drift from the
// deployment it talks to.
//
// Two differences from the browser, and both matter.
//
// `detectSessionInUrl` is false. There is no URL to detect anything in, and
// leaving it on makes Supabase reach for browser APIs that do not exist here.
//
// The session is kept in the app's own SQLite file. Not a second storage
// library: this app already carries a database whose whole job is surviving a
// force-quit, and the sign-in should survive exactly as reliably as the notes
// do. It is the same durability promise, applied to the same thing.
// ============================================================================
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

import { API_BASE } from './config';
import * as store from './store';

const CONFIG_KEY = 'config.public';

// Supabase's storage contract, backed by the kv table in store.js.
const sqliteStorage = {
  getItem: (k) => store.getItem(k),
  setItem: (k, v) => store.setItem(k, v),
  removeItem: (k) => store.removeItem(k),
};

let client = null;

/* The last config we were given, kept on disk.
 *
 * A phone that has signed in once must still open on a plane. Without a cached
 * copy the app would need the network to build the client at all, so a writer
 * with no signal would be shown a sign-in screen while their session sat
 * perfectly valid on the device. Fetch when we can, fall back when we cannot,
 * and only fail when we have never succeeded. */
async function publicConfig() {
  try {
    const r = await fetch(API_BASE + '/api/config');
    if (r.ok) {
      const fresh = await r.json();
      if (fresh && fresh.supabaseUrl && fresh.supabaseAnonKey) {
        await store.setItem(CONFIG_KEY, JSON.stringify(fresh));
        return fresh;
      }
    }
  } catch (e) {
    // No signal, or the deployment is down. The cached copy is next.
  }
  const kept = await store.getItem(CONFIG_KEY);
  if (kept) {
    try { return JSON.parse(kept); } catch (e) {}
  }
  return null;
}

export async function sb() {
  if (client) return client;
  const config = await publicConfig();
  if (!config) return null;
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: sqliteStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export async function currentSession() {
  const s = await sb();
  if (!s) return null;
  const { data } = await s.auth.getSession();
  return data.session || null;
}

/* Ask for a six digit code.
 *
 * The web app sends a link, because on a laptop a link is one click and you
 * are already where you need to be. On a phone a link has to leave the mail
 * app, find its way back into this one, and survive whichever mail client the
 * writer happens to use. A code has none of that: you read six digits and you
 * type them. The same email carries both, so neither half of Beatfall had to
 * give anything up.
 *
 * `shouldCreateUser` is true because this box signs up and signs in, exactly
 * as the web one does. Somebody who hears about Beatfall standing in a car
 * park should not be told to go and find a computer first. */
export async function requestCode(email) {
  const s = await sb();
  if (!s) throw new Error("Beatfall couldn't reach the server. Check your signal and try again.");
  const { error } = await s.auth.signInWithOtp({
    email: String(email || '').trim(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function submitCode(email, code) {
  const s = await sb();
  if (!s) throw new Error("Beatfall couldn't reach the server. Check your signal and try again.");
  const { data, error } = await s.auth.verifyOtp({
    email: String(email || '').trim(),
    token: String(code || '').replace(/\D/g, ''),
    type: 'email',
  });
  if (error) throw error;
  return data.session || null;
}

export async function signOut() {
  const s = await sb();
  if (s) await s.auth.signOut();
}

/* Fires on sign in, sign out and every silent token refresh. App.js listens so
 * the screen follows the session rather than the session being read once at
 * boot and then quietly going stale in the background. */
export async function onAuth(fn) {
  const s = await sb();
  if (!s) return () => {};
  const { data } = s.auth.onAuthStateChange((_event, session) => fn(session || null));
  return () => { try { data.subscription.unsubscribe(); } catch (e) {} };
}
