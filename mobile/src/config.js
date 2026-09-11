// ============================================================================
// Build switches.
//
// SYNC_ENABLED turns on every piece of sync language on the screen: the count
// of notes still waiting, the "waiting to sync" mark on a card. It was false
// while there was no server to send to, because a screen that says "3 waiting
// to sync" with nowhere to send them is a lie on the first run.
//
// It is true now. /api/captures exists, the phone posts to it, and the desk
// picks the notes up.
// ============================================================================
export const SYNC_ENABLED = true;

// Where the phone will talk to. The same deployment that serves the web app;
// the phone gets no endpoints of its own that a browser doesn't already have.
export const API_BASE = 'https://beatfall-beta.vercel.app';
