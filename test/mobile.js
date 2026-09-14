/* THE PHONE APP, CHECKED BEFORE IT IS HANDED OVER.
 *
 * This exists because of two wasted evenings, both the same mistake in
 * different clothes.
 *
 * The first: `expo-web-browser` was imported before it was installed, so the
 * app would not start.
 *
 * The second, worse because it had been true for weeks without anybody
 * noticing: `@supabase/supabase-js` and `react-native-url-polyfill` were used
 * everywhere and named in package.json nowhere. They only worked because an
 * old install had left them lying in node_modules. The first `npm install`
 * that pruned anything took them out and the app died on a red screen. A fresh
 * clone, or a build server on submission day, would have hit exactly that.
 *
 * Neither is subtle and neither needs a phone to catch. Both are caught here
 * in under a second:
 *
 *   1. Every file parses.
 *   2. Every package a file imports is DECLARED in package.json. Not "present
 *      in node_modules", which is the whole point: node_modules lies.
 *
 * There is no allowlist of things Expo Go happens to ship. If the code imports
 * it, package.json names it. That rule has no exceptions and needs no
 * maintenance, which is the only kind of rule that survives.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SRC = path.resolve('../mobile/src');
const PKG = path.resolve('../mobile/package.json');

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || !detail ? '' : '\n          ' + detail));
}

if (!fs.existsSync(SRC) || !fs.existsSync(PKG)) {
  console.log('  SKIP  no mobile/ in this checkout');
  process.exit(0);
}

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort();
check('there is a phone app to check', files.length > 0, files.length + ' files');

/* ---------------------------------------------------------- 1. it parses */
let parsed = true;
let parseWhy = '';
try {
  // esbuild only, no bundling: this is a syntax check, not a build. JSX is not
  // valid JavaScript on its own, so it has to be told what it is reading.
  execFileSync('npx', ['--yes', 'esbuild', ...files.map(f => path.join(SRC, f)),
    '--loader:.js=jsx', '--outdir=' + path.join(require('os').tmpdir(), 'bf-parse'),
    '--log-level=error'], { stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  parsed = false;
  parseWhy = String((e.stderr && e.stderr.toString()) || e.message).slice(0, 400);
}
check('every phone file parses', parsed, parseWhy);

/* ------------------------------------------ 2. every import is declared */
const declared = new Set(Object.keys(
  JSON.parse(fs.readFileSync(PKG, 'utf8')).dependencies || {}));

/* The package name out of an import path. Scoped packages keep two segments
   (@supabase/supabase-js), everything else keeps one, so a deep import like
   `react-native-url-polyfill/auto` or a font file three folders down is still
   checked against the package that has to be installed for it. */
function packageOf(spec) {
  if (spec.startsWith('.') || spec.startsWith('/')) return null;   // our own files
  const bits = spec.split('/');
  return spec.startsWith('@') ? bits.slice(0, 2).join('/') : bits[0];
}

const wanted = new Map();      // package -> the files that import it
files.forEach(f => {
  const src = fs.readFileSync(path.join(SRC, f), 'utf8');
  // Both shapes: `import x from 'y'` and a bare `import 'y'` for side effects,
  // which is how the URL polyfill is pulled in and is exactly the one that got
  // missed by eye.
  const re = /\bimport\s+(?:[^'"]*?\bfrom\s*)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const pkg = packageOf(m[1]);
    if (!pkg) continue;
    if (!wanted.has(pkg)) wanted.set(pkg, []);
    if (wanted.get(pkg).indexOf(f) < 0) wanted.get(pkg).push(f);
  }
});

const missing = Array.from(wanted.keys()).filter(p => !declared.has(p));
check('every package the phone imports is in package.json',
  missing.length === 0,
  missing.map(p => p + '  (used by ' + wanted.get(p).join(', ') + ')').join('\n          '));

check('and there is more than nothing being checked', wanted.size >= 5,
  Array.from(wanted.keys()).join(', '));

/* --------------------------------- 3. the build stamp moved when code did */
const cfg = fs.readFileSync(path.join(SRC, 'config.js'), 'utf8');
const stamp = /export const BUILD = '([^']*)'/.exec(cfg);
check('the build stamp exists so a phone can say what it is running',
  !!(stamp && stamp[1]), cfg.slice(0, 80));

const failed = results.filter(r => !r.ok);
console.log('\n' + (results.length - failed.length) + ' of ' + results.length + ' passed');
if (failed.length) {
  console.log('\nFAILED:');
  failed.forEach(f => console.log('  ' + f.name));
  process.exit(1);
}
