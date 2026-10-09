// Regressions found by inspecting the live operator dashboard.
import handler from './api/admin.real.js';
import { periodCost, sessionCost, watchSpend } from './api/_lib/operator.js';
import { makeDb } from './fakedb.js';
import { viewAccount, viewSystem, viewProduct, viewOverview } from '../../public/admin-ui.js';
import assert from 'node:assert/strict';

let passed = 0;
function check(name, condition) { assert.ok(condition, name); passed++; console.log('PASS ' + name); }
const now = new Date().toISOString();
const admin = { id: 'admin', is_admin: true, is_internal: true };
const customer = { id: 'u1', email: 'writer@example.com', plan: 'beatfall',
  subscription_status: 'active', created_at: now, period_start: '2026-01-01T00:00:00Z',
  first_meaningful_board_at: now, credits_used: 5, credits_extra: 0 };
async function read(db, query) {
  globalThis.__DB__ = db;
  globalThis.__AUTH__ = { db, user: { id: admin.id }, profile: admin };
  const res = { status(n) { this.code = n; return this; },
    setHeader() {}, send(s) { this.body = JSON.parse(s); return this; } };
  await handler({ method: 'GET', query, headers: {} }, res);
  assert.equal(res.code, 200);
  return res.body;
}
// Impose PostgREST's default 1,000 row response and its {data,error} failure shape.
function databaseBoundary(db, table, failFrom) {
  return { ...db, from(name) {
    const q = db.from(name);
    if (name !== table) return q;
    let from = 0, ranged = false;
    let proxy;
    proxy = new Proxy(q, { get(target, key) {
      if (key === 'then') return (resolve, reject) => {
        if (failFrom !== undefined && from >= failFrom)
          return Promise.resolve({ data: null, error: { message: 'simulated unavailable page' } }).then(resolve, reject);
        return target.then(result => resolve({ ...result,
          data: !ranged && Array.isArray(result.data) ? result.data.slice(0, 1000) : result.data }), reject);
      };
      if (typeof target[key] !== 'function') return target[key];
      return (...args) => {
        if (key === 'range') { from = args[0]; ranged = true; }
        const result = target[key](...args);
        return result === target ? proxy : result;
      };
    } });
    return proxy;
  } };
}

const db = makeDb(admin, { profiles: [admin, customer],
  work_days: [{ user_id: 'u1', day: '2026-10-07' }, { user_id: 'u1', day: '2026-10-08' }] });
db.state.events = [
  { user_id: 'u1', name: 'import_started', created_at: now },
  { user_id: 'u1', name: 'import_completed', created_at: now },
  { user_id: 'admin', name: 'import_completed', created_at: now }
];
const product = await read(db, { view: 'product' });
const path = product.by_path.find(p => p.key === 'none');
check('no starting choice does not erase a subscription', path.paid === 1);
check('no starting choice does not erase an organised board', path.organised === 1);
check('no starting choice does not erase return days', path.returned === 1);
check('unknown starting choice is not labelled a deliberate choice', path.label === 'No starting choice recorded');
check('feature counts exclude internal events', product.features[0].finished === 1);
check('customer feature events remain counted', product.features[0].started === 1);
check('feature wording does not imply a matched conversion rate', /not matched attempts/.test(viewProduct(product)));

const usage = Array.from({ length: 1005 }, (_, i) => ({ id: i + 1, user_id: 'u1',
  kind: 'import', session_id: 's1', cost_micros: 10000, created_at: now, status: 'ok', credits: 0 }));
const costs = makeDb(admin, { profiles: [admin, customer], usage,
  budgets: [{ scope: 'paid_period', warn_micros: 8000000, urgent_micros: 10000000, enforced: false }] });
const paged = databaseBoundary(costs, 'usage');
const total = await periodCost(paged, 'u1', customer.period_start);
check('period cost includes the second database page', total.total === 10050000 && total.calls === 1005);
check('an error on a later page cannot become an understated cost',
  await periodCost(databaseBoundary(costs, 'usage', 1000), 'u1', customer.period_start) === null);
check('an ordinary returned query error is not a zero session cost',
  await sessionCost(databaseBoundary(costs, 'usage', 0), 'u1', 's1') === null);
const alert = await watchSpend(paged, { profile: customer });
check('a threshold crossed on the second page raises the urgent alert', alert.level === 'urgent');
check('observation remains observation', costs.state.budgets[0].enforced === false);

const detail = await read(costs, { view: 'account', id: 'u1' });
check('the account endpoint returns more than one database page', detail.usage.length === 1005);
const accountHtml = viewAccount({ ...detail, usage: usage.slice(0, 31).map((u, i) =>
  ({ ...u, kind: i === 30 ? 'older_record_marker' : u.kind })) });
check('the account view no longer discards calls after the thirtieth', accountHtml.includes('older_record_marker'));
check('the history describes its cost calculation', accountHtml.includes('configured rates'));
check('a server cap is visible on account detail', viewAccount({ ...detail, truncated: true }).includes('history reached the reporting limit'));

const originalEnv = { ...process.env };
try {
  for (const k of ['RESEND_API_KEY', 'MAIL_FROM', 'ALERT_TO', 'SITE_URL']) delete process.env[k];
  let overview = await read(db, { view: 'overview' });
  check('missing alert setup cannot produce a Working lamp', overview.health.alerts.state !== 'ok');
  check('the Overview offers a route to the setup problem', viewOverview(overview).includes('Check System'));
  let system = await read(db, { view: 'system' });
  check('System identifies missing mail settings without exposing values',
    system.mail.missing.includes('RESEND_API_KEY') && system.mail.missing.includes('MAIL_FROM'));
  for (const k of ['RESEND_API_KEY', 'MAIL_FROM', 'ALERT_TO', 'SITE_URL']) process.env[k] = 'test-value';
  system = await read(databaseBoundary(db, 'alerts', 0), { view: 'system' });
  check('failed alert query returns unknown counts, not zeros',
    system.mail.undelivered === null && system.mail.gave_up === null);
  const systemHtml = viewSystem(system);
  check('unknown alert counts are visibly marked unavailable', systemHtml.includes('Alert records could not be read'));
  overview = await read(costs, { view: 'overview' });
  check('complete alert configuration can pass the readiness check', overview.health.alerts.state === 'ok');
  check('free calls are not counted as credit-spending feature use', overview.working.used_writing_help.value === 0);
} finally {
  for (const k of ['RESEND_API_KEY', 'MAIL_FROM', 'ALERT_TO', 'SITE_URL']) {
    if (originalEnv[k] === undefined) delete process.env[k]; else process.env[k] = originalEnv[k];
  }
}
console.log(`${passed} of ${passed} passed`);
