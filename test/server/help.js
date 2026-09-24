/* The public help endpoint now serves the written Help & shortcuts page only.
 * Conversational support is supplied by Chatling in the browser, so no model,
 * question history or customer text reaches this endpoint. */
import help from './api/help.real.js';

const out = [];
const check = (n, ok, d) => {
  out.push({ n, ok });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (ok || !d ? '' : '\n          ' + d));
};

function res() {
  const r = {
    code: 0,
    body: null,
    headers: {},
    setHeader(k, v) { r.headers[k] = v; },
    status(c) { r.code = c; return r; },
    send(b) {
      try { r.body = JSON.parse(b); } catch (e) { r.body = b; }
      return r;
    }
  };
  return r;
}

{
  const r = res();
  await help({ method: 'GET', headers: {}, url: '/api/help' }, r);
  check('the help page can read every written answer',
    r.code === 200 && Array.isArray(r.body.topics) && r.body.topics.length > 40,
    String((r.body.topics || []).length));
  check('the help page receives the section order',
    Array.isArray(r.body.sections) && r.body.sections.length > 5,
    JSON.stringify((r.body.sections || []).slice(0, 3)));
  check('the support address remains available',
    r.body.support === 'support@beatfall.app', String(r.body.support));
  check('the written material is cached',
    /max-age/.test(r.headers['Cache-Control'] || ''), r.headers['Cache-Control']);
}

for (const method of ['POST', 'PUT', 'DELETE']) {
  const r = res();
  await help({ method, headers: {} }, r);
  check(method + ' is refused because the endpoint is read only',
    r.code === 405 && r.body.error === 'method', JSON.stringify(r.body));
}

const failed = out.filter(r => !r.ok);
console.log('\n' + (out.length - failed.length) + ' of ' + out.length + ' passed');
if (failed.length) process.exit(1);
