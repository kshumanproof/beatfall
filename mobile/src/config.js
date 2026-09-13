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

// The website, for the handful of links the phone hands off to it: the desk
// itself, the privacy policy, the terms. The same deployment as the API, so
// the two can never point at different versions of Beatfall.
export const SITE = API_BASE;

// One address, in one place, so it cannot drift from the one the server puts
// in its own error messages.
export const SUPPORT_EMAIL = 'support@beatfall.app';

/* WHICH CODE IS THIS PHONE ACTUALLY RUNNING.
   Twice now a bug has turned out to be a phone that had not reloaded, and an
   hour went into each. It is stamped under the notes list while testing, and
   on the account screen beside the version, where a writer can read it to us. */
export const BUILD = '13 Sep 17:40';
