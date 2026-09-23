/* Copies the endpoints next to the suites and swaps the two boundaries a test
   cannot cross. Run after changing anything in api/. */
import fs from 'fs';
fs.mkdirSync('api/_lib', { recursive: true });
fs.copyFileSync('../../api/_lib/core.js', 'api/_lib/core.js');
/* core.js is copied whole, so anything in it that reaches a real boundary has
   to be swapped here too. dropImages lives there now because it is called from
   BOTH the nightly sweep and the delete button, and the bucket it is handed
   comes from the caller, which is where the swap below already bites. */
// The email bodies are plain modules with no boundary to swap, so they are
// copied as they are and the suite exercises the real markup.
fs.mkdirSync('api/_email', { recursive: true });
fs.readdirSync('../../api/_email').forEach(f =>
  fs.copyFileSync('../../api/_email/' + f, 'api/_email/' + f));

/* The help content, for the same reason and with the same swap of nothing at
   all: it is prose with no boundary to cross, and the suite reads the real
   words a writer will be shown rather than a copy of them. */
fs.mkdirSync('api/_help', { recursive: true });
fs.readdirSync('../../api/_help').forEach(f =>
  fs.copyFileSync('../../api/_help/' + f, 'api/_help/' + f));

fs.writeFileSync('api/shim.js',
  "export * from './_lib/core.js';\n" +
  /* The options are recorded, not just swallowed. Which endpoints waive the
     one-browser lock is a real decision with a real consequence: waive too
     much and two browsers can edit one writer's boards, waive too little and
     the phone gets a 409 doing something it is required by Apple to be able
     to do. A suite that cannot see the flag cannot check either. */
  "export const requireUser = async (req, options) => { globalThis.__AUTHOPTS__ = options || {}; return globalThis.__AUTH__; };\n" +
  "export const track = (...a) => { (globalThis.__TRACKED__ = globalThis.__TRACKED__ || []).push(a[2]); };\n");

const swap = (from, to, extra = s => s) => {
  let s = fs.readFileSync(from, 'utf8');
  s = s.replace("from './_lib/core.js';", "from './shim.js';");
  s = s.replace('const db = admin();', 'const db = globalThis.__DB__;');
  /* The bucket is the other boundary a test cannot cross. Vision puts bytes in
     Supabase Storage, and a suite has no bucket and must not need one, so every
     reach for it becomes a stand-in that records what it was handed. That is
     the only way to check the things that actually matter here: that the file
     is written before the row, that the row is torn up again if the file does
     not stick, and that the location data really did come out of the picture. */
  s = s.replace(/admin\(\)\.storage\.from\(BUCKET\)/g, 'globalThis.__STORE__');
  fs.writeFileSync(to, extra(s));
};
swap('../../api/claude.js',         'api/claude.real.js');
swap('../../api/projects.js',       'api/projects.real.js');
swap('../../api/account.js',        'api/account.real.js');
swap('../../api/captures.js',       'api/captures.real.js');
swap('../../api/cleanup.js',        'api/cleanup.real.js');
swap('../../api/images.js',         'api/images.real.js');
swap('../../api/stripe-webhook.js', 'api/hook.real.js', s =>
  s.replace("import Stripe from 'stripe';",
            "const Stripe = function(){ return { webhooks: { constructEvent: () => globalThis.__EVENT__ } }; };"));
swap('../../api/session.js',        'api/session.real.js');
swap('../../api/admin.js',          'api/admin.real.js');
console.log('endpoints copied and wired');
