/* Copies the endpoints next to the suites and swaps the two boundaries a test
   cannot cross. Run after changing anything in api/. */
import fs from 'fs';
fs.mkdirSync('api/_lib', { recursive: true });
fs.copyFileSync('../../api/_lib/core.js', 'api/_lib/core.js');

fs.writeFileSync('api/shim.js',
  "export * from './_lib/core.js';\n" +
  "export const requireUser = async () => globalThis.__AUTH__;\n" +
  "export const track = (...a) => { (globalThis.__TRACKED__ = globalThis.__TRACKED__ || []).push(a[2]); };\n");

const swap = (from, to, extra = s => s) => {
  let s = fs.readFileSync(from, 'utf8');
  s = s.replace("from './_lib/core.js';", "from './shim.js';");
  s = s.replace('const db = admin();', 'const db = globalThis.__DB__;');
  fs.writeFileSync(to, extra(s));
};
swap('../../api/claude.js',         'api/claude.real.js');
swap('../../api/projects.js',       'api/projects.real.js');
swap('../../api/account.js',        'api/account.real.js');
swap('../../api/captures.js',       'api/captures.real.js');
swap('../../api/cleanup.js',        'api/cleanup.real.js');
swap('../../api/stripe-webhook.js', 'api/hook.real.js', s =>
  s.replace("import Stripe from 'stripe';",
            "const Stripe = function(){ return { webhooks: { constructEvent: () => globalThis.__EVENT__ } }; };"));
console.log('endpoints copied and wired');
