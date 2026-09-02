// ============================================================================
// Build switches.
//
// SYNC_ENABLED is false because sync does not exist yet. That is not a
// cosmetic flag: with no server to send to, a screen that says "3 waiting to
// sync" is telling the writer their notes are stuck somewhere, which is a lie
// that would cost trust on the first run. While this is false the app says
// what is actually true — the notes are on this phone — and every piece of
// sync language stays off the screen.
//
// Turning it on is the last line of the sync step, not the first.
// ============================================================================
export const SYNC_ENABLED = false;

// Where the phone will talk to. The same deployment that serves the web app;
// the phone gets no endpoints of its own that a browser doesn't already have.
export const API_BASE = 'https://beatfall-beta.vercel.app';
