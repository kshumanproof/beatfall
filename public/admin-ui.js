/* ===========================================================================
   THE OPERATOR'S PAGE.

   Six destinations over one endpoint, each asking for what it shows. Split
   out of admin.html because at this size an inline script is a file nobody
   can find their way around, and because a separate file can be read by a
   test without a browser.

   THE RULES THIS FILE FOLLOWS, ALL OF WHICH ARE ABOUT HONESTY RATHER THAN
   LAYOUT.

   1. A FIGURE SAYS ITS WINDOW AND ITS POPULATION. Two numbers side by side
      are only comparable if they describe the same period and the same
      people, and the old page put a thirty-day cost next to an all-time
      milestone with nothing between them.

   2. MISSING IS DRAWN AS MISSING. `fig()` prints a dash and the reason when a
      value is null. A zero is a real answer and must never stand in for a
      query that did not run.

   3. HEALTHY IS ONLY SHOWN WHEN THE CHECK RAN. The absence of failures is not
      evidence of health if the thing that records failures is what is down.

   4. COLOUR IS NEVER THE ONLY SIGNAL. Every state carries a word as well as a
      hue, which is the house rule from the board and matters more here, where
      red and amber are the whole point of the screen.

   5. NOTHING SHOWS A WRITER'S WORK. The endpoint does not send it; this file
      could not draw it if it tried. Said here anyway because the next person
      to add a panel will read this file before they read the endpoint.
   =========================================================================== */

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------------------------------------------------------------------
   THE STATE OF THE PAGE, in one object, because the global controls apply to
   every view and a view that kept its own copy of the period would drift the
   moment somebody changed it on another tab of the same page.
   --------------------------------------------------------------------------- */
const S = {
  view: 'overview',
  id: null,          // the account or issue being looked at, when there is one
  days: 30,
  who: 'customers',
  search: '',
  sort: 'last',
  account: null,
  data: {},        // view -> last good payload
  loadedAt: {},    // view -> when that payload arrived
  loading: false,
  failed: null
};

export function state() { return S; }

/* A figure, with everything a reader needs to judge it. `value` null means
   the number is not available, which is drawn as a dash and a reason and
   never as a zero. */
export function fig(f, opts) {
  const o = opts || {};
  if (!f || f.value === null || f.value === undefined) {
    return '<span class="no" title="' + esc((f && f.unavailable) || 'not available')
      + '">&ndash;</span>';
  }
  const n = typeof f.value === 'number'
    ? (o.money ? '$' + f.value.toFixed(2)
       : f.value % 1 ? f.value.toFixed(2) : f.value.toLocaleString())
    : f.value;
  return esc(String(n));
}

/* The small grey line under a figure saying what it covers. Written out
   rather than abbreviated, because "30d" means nothing at a glance and the
   whole point of this line is that it is read. */
export function scope(f, fallback) {
  const bits = [];
  if (f && f.window) bits.push(f.window);
  else if (f && f.window_days) bits.push('last ' + f.window_days + ' days');
  else if (fallback) bits.push(fallback);
  if (f && f.population) bits.push(f.population);
  if (f && f.means) bits.push(f.means);
  return bits.length ? '<div class="scope">' + esc(bits.join(' &middot; ')
    .replace(/&amp;middot;/g, '&middot;')) + '</div>' : '';
}

/* A health lamp. Word first, colour second. See rule 4. */
export function lamp(h) {
  if (!h) return '<span class="lamp unknown">Not checked</span>';
  if (h.state === 'ok') return '<span class="lamp ok">Working</span>';
  return '<span class="lamp unknown" title="' + esc(h.why || '') + '">Could not check</span>';
}

export function when(iso) {
  if (!iso) return 'never';
  const t = new Date(iso);
  if (isNaN(t)) return 'unknown';
  const mins = (Date.now() - t) / 60000;
  if (mins < 1) return 'just now';
  if (mins < 60) return Math.round(mins) + ' min ago';
  if (mins < 1440) { const h = Math.round(mins / 60); return h + (h === 1 ? ' hour ago' : ' hours ago'); }
  const d = Math.round(mins / 1440);
  if (d < 30) return d + (d === 1 ? ' day ago' : ' days ago');
  return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export const money = n => (typeof n === 'number' ? '$' + n.toFixed(2) : '&ndash;');

/* A share, with its denominator, always. "12 of 20" rather than "60%",
   because a percentage over four people looks exactly like one over four
   hundred and only one of them means anything. */
export function share(n, of) {
  if (!of) return '<b>' + n + '</b> <span class="of">of none</span>';
  return '<b>' + n + '</b> <span class="of">of ' + of + '</span>'
    + '<span class="pct">' + Math.round(n / of * 100) + '%</span>';
}

/* ---------------------------------------------------------------------------
   EVERY STATE A PANEL CAN BE IN, drawn properly rather than left blank.
   Empty, loading, partial, stale, denied and failed are six different things
   and the old page had one appearance for all of them.
   --------------------------------------------------------------------------- */
export function emptyState(what, why) {
  return '<div class="blank"><p class="blank-h">' + esc(what) + '</p>'
    + (why ? '<p class="blank-w">' + esc(why) + '</p>' : '') + '</div>';
}

export function partial(errors) {
  if (!errors || !errors.length) return '';
  return '<div class="note bad partial"><b>Some of this is missing.</b> '
    + esc(errors.join('. ')) + '. The figures that did load are shown; '
    + 'the rest are marked with a dash rather than a zero.</div>';
}

export function staleLine(at) {
  if (!at) return '';
  const age = (Date.now() - new Date(at)) / 60000;
  if (age < 5) return '';
  return '<div class="note stale">Read ' + esc(when(at))
    + '. Press Refresh for the current figures.</div>';
}

export function trackingLine(start) {
  if (!start) return '';
  return '<p class="muted track">Records begin ' + esc(when(start))
    + '. Nothing before then is missing, it was never recorded.</p>';
}

/* ---------------------------------------------------------------------------
   THE VIEWS.
   Each one takes the payload and returns markup. No fetching in here, so each
   can be rendered against a fixture in a test without a server.
   --------------------------------------------------------------------------- */

export function viewOverview(d) {
  const h = d.health || {};
  const w = d.working || {}, st = d.starting || {}, sub = d.subscriptions || {}, sp = d.spend || {};

  const attention = (d.attention || []);
  const queue = attention.length
    ? attention.map(a => '<div class="row-item sev-' + esc(a.severity || 'normal') + '">'
        + '<div class="ri-main"><span class="sev">' + esc(sevWord(a.severity)) + '</span>'
        + '<span class="ri-title">' + esc(a.title || '') + '</span></div>'
        + '<div class="ri-sub">' + esc(a.detail || '') + ' &middot; first seen '
        + esc(when(a.first_seen_at)) + '</div>'
        + '<div class="ri-acts">'
        /* An alert is answered by being read, so the way to clear it is on the
           row rather than three screens away. An issue is not: it is cleared by
           being resolved with a reason, which happens on its own screen. */
        + (a.kind === 'alert'
           ? '<button class="btn sm" data-do="alert_ack" data-id="' + esc(a.id)
             + '">Mark as seen</button>' : '')
        + '<a class="ri-go" href="' + esc(a.link || '#') + '">' + esc(a.next || 'Open') + '</a>'
        + '</div></div>').join('')
    : emptyState('Nothing needs attention.',
        'No unresolved issues and no unanswered alerts. This is a real answer, '
        + 'not an empty panel: the checks above ran.');

  return `
  ${partial(d.errors)}
  ${staleLine(d.loaded_at)}

  <section class="panel">
    <h2>Is it working</h2>
    <div class="lamps">
      <div><span class="lk">Account records</span>${lamp(h.records)}</div>
      <div><span class="lk">Cost records</span>${lamp(h.costs)}</div>
      <div><span class="lk">Work records</span>${lamp(h.work)}</div>
      <div><span class="lk">Alerts</span>${lamp(h.alerts)}</div>
    </div>
    ${h.undelivered ? '<p class="note bad">' + h.undelivered
      + ' alert' + (h.undelivered === 1 ? '' : 's') + ' could not be delivered. '
      + 'The page knows something and could not tell you. See System.</p>' : ''}
  </section>

  <section class="panel">
    <h2>Needs attention</h2>
    <div class="rows">${queue}</div>
  </section>

  <section class="panel">
    <h2>Writers working</h2>
    <div class="tiles">
      <div class="tile"><div class="n">${fig(w.total)}</div>
        <div class="l">Saved work</div>${scope(w.total, 'last ' + d.window_days + ' days')}</div>
      <div class="tile"><div class="n">${fig(w.trial)}</div>
        <div class="l">On a trial</div></div>
      <div class="tile"><div class="n">${fig(w.paid)}</div>
        <div class="l">Subscribing</div></div>
      <div class="tile"><div class="n">${fig(w.used_writing_help)}</div>
        <div class="l">Used the writing help</div>${scope(w.used_writing_help)}</div>
    </div>
  </section>

  <section class="panel">
    <h2>Getting started</h2>
    <div class="tiles">
      <div class="tile"><div class="n">${fig(st.signed_up)}</div>
        <div class="l">Signed up</div>${scope(null, 'last ' + d.window_days + ' days')}</div>
      <div class="tile"><div class="n">${fig(st.own_project_ever)}</div>
        <div class="l">Started their own project</div>${scope(st.own_project_ever)}</div>
      <div class="tile"><div class="n">${fig(st.organised_ever)}</div>
        <div class="l">Organised their material</div>${scope(st.organised_ever)}</div>
    </div>
  </section>

  <section class="panel">
    <h2>Subscriptions</h2>
    <div class="tiles">
      <div class="tile"><div class="n">${fig(sub.subscribers)}</div><div class="l">Subscribing</div></div>
      <div class="tile"><div class="n">${fig(sub.trialing)}</div><div class="l">On a trial</div></div>
      <div class="tile ${sub.scheduled_to_cancel && sub.scheduled_to_cancel.value ? 'warn' : ''}">
        <div class="n">${fig(sub.scheduled_to_cancel)}</div><div class="l">Leaving at period end</div></div>
      <div class="tile ${sub.payment_trouble && sub.payment_trouble.value ? 'bad' : ''}">
        <div class="n">${fig(sub.payment_trouble)}</div><div class="l">Payment trouble</div></div>
      <div class="tile"><div class="n">${fig(sub.ended)}</div><div class="l">Ended</div></div>
    </div>
    ${scope(null, 'right now &middot; customers')}
  </section>

  <section class="panel">
    <h2>What it costs</h2>
    <div class="tiles">
      <div class="tile"><div class="n">${fig(sp.customers_usd, { money: true })}</div>
        <div class="l">Customers</div>${scope(sp.customers_usd, 'last ' + d.window_days + ' days')}</div>
      <div class="tile"><div class="n">${fig(sp.trials_usd, { money: true })}</div>
        <div class="l">Trials</div>${scope(sp.trials_usd)}</div>
      <div class="tile"><div class="n">${fig(sp.internal_usd, { money: true })}</div>
        <div class="l">Your own testing</div>${scope(sp.internal_usd)}</div>
      <div class="tile"><div class="n">${fig(sp.calls)}</div>
        <div class="l">Writing help calls</div>${scope(sp.calls)}</div>
    </div>
    <p class="muted">Provider cost only. This is not what Beatfall earns and it
      is not profit: it ignores card fees, hosting and every hour of work.</p>
  </section>

  ${trackingLine(d.tracking_started_at)}`;
}

function sevWord(s) {
  return s === 'high' || s === 'stop' ? 'Serious'
    : s === 'urgent' ? 'Urgent'
    : s === 'low' ? 'Minor' : 'Worth a look';
}

export function viewIssues(d) {
  const list = d.issues || [];
  if (!list.length) return partial(d.errors) + emptyState('No issues recorded.',
    'Nothing has failed since the records began. If that seems unlikely, check '
    + 'on the System screen that the records are being written.');

  return partial(d.errors) + `
  <p class="muted">${esc(d.note || '')}</p>
  <div class="tablewrap"><table>
    <thead><tr><th>What broke</th><th>State</th><th class="num">Times</th>
      <th class="num">Accounts</th><th class="num">Credits</th>
      <th class="num">Cost</th><th>First seen</th><th>Last seen</th><th></th></tr></thead>
    <tbody>${list.map(i => `
      <tr class="sev-${esc(i.severity)}" data-issue="${esc(i.id)}">
        <td><b>${esc(i.title)}</b>
          <div class="sub">${esc([i.feature, i.stage, i.error_code].filter(Boolean).join(' &middot; '))}</div></td>
        <td><span class="pill st-${esc(i.status)}">${esc(stateWord(i.status))}</span></td>
        <td class="num">${i.occurrences}</td>
        <td class="num">${i.accounts_in_window}</td>
        <td class="num">${i.credits_in_window}</td>
        <td class="num">${money(i.cost_usd_in_window)}</td>
        <td>${esc(when(i.first_seen_at))}</td>
        <td>${esc(when(i.last_seen_at))}</td>
        <td><button class="btn sm" data-open-issue="${esc(i.id)}">Open</button></td>
      </tr>`).join('')}</tbody>
  </table></div>`;
}

function stateWord(s) {
  return s === 'new' ? 'New' : s === 'investigating' ? 'Looking at it'
    : s === 'monitoring' ? 'Watching' : s === 'resolved' ? 'Resolved' : s;
}

/* ---------------------------------------------------------------------------
   ONE ISSUE. What broke, who it happened to, what it cost them, and
   everything anybody has already written down about it.
   --------------------------------------------------------------------------- */
export function viewIssue(d) {
  const i = d.issue;
  if (!i) return emptyState('No such issue.', d.error || '');
  const m = d.money || {};

  const accounts = (d.accounts || []).map(a => `
    <tr${a.internal ? ' class="internal"' : ''}>
      <td><b>${esc(a.email || a.tag || a.id)}</b>${a.internal
        ? '<div class="sub">internal</div>' : ''}</td>
      <td class="num">${a.times}</td>
      <td class="num">${a.credits}</td>
      <td class="num">${money(a.cost_usd)}</td>
      <td>${esc(when(a.last_at))}</td>
      <td><button class="btn sm" data-open-account="${esc(a.id)}">Open</button></td>
    </tr>`).join('');

  const hits = (d.occurrences || []).map(u => `
    <tr><td>${esc(when(u.created_at))}</td>
      <td>${esc(u.kind)}${u.stage ? '<div class="sub">' + esc(u.stage) + '</div>' : ''}</td>
      <td><span class="pill ${u.status === 'ok' ? 'st-resolved' : 'st-new'}">${
        esc(u.status || 'ok')}</span>${u.error_code
        ? '<div class="sub">' + esc(u.error_code) + '</div>' : ''}</td>
      <td class="num">${u.credits}</td>
      <td class="num">${money((u.cost_micros || 0) / 1e6)}</td>
      <td class="num">${u.duration_ms === null || u.duration_ms === undefined
        ? '<span class="no">&ndash;</span>' : Math.round(u.duration_ms / 100) / 10 + 's'}</td>
      <td class="sub">${esc(u.deploy || '')}</td></tr>`).join('');

  const notes = (d.notes || []).map(n => `
    <div class="note-item"><div class="ni-head">${esc(n.author || 'admin')}
      <span class="sub">${esc(when(n.created_at))}</span></div>
      <div class="ni-body">${esc(n.body)}</div></div>`).join('');

  const cases = (d.cases || []).map(c => `
    <tr><td>${esc(c.subject || 'no subject')}</td>
      <td><span class="pill st-${esc(c.status)}">${esc(c.status)}</span></td>
      <td>${esc(when(c.created_at))}</td>
      <td>${esc(c.opened_by || '')}</td></tr>`).join('');

  return `
  ${partial(d.errors)}
  <section class="panel">
    <h2>${esc(i.title)}</h2>
    <div class="scope">${esc([i.feature, i.stage, i.error_code, i.provider, i.model]
      .filter(Boolean).join(' &middot; ')).replace(/&amp;middot;/g, '&middot;')}</div>
    <div class="tiles">
      <div class="tile"><div class="n">${esc(stateWord(i.status))}</div><div class="l">State</div>
        ${i.assignee ? '<div class="scope">' + esc(i.assignee) + '</div>' : ''}</div>
      <div class="tile"><div class="n">${i.occurrences}</div><div class="l">Times</div>
        <div class="scope">all time</div></div>
      <div class="tile"><div class="n">${(d.accounts || []).length}</div>
        <div class="l">Accounts affected</div></div>
      <div class="tile"><div class="n">${money(m.cost_usd)}</div><div class="l">Cost</div></div>
    </div>
    <p class="muted">First seen ${esc(when(i.first_seen_at))}, last seen
      ${esc(when(i.last_seen_at))}.${i.deploy ? ' Version ' + esc(i.deploy) + '.' : ''}</p>
    ${i.resolved_at ? '<div class="note"><b>Resolved ' + esc(when(i.resolved_at))
      + '.</b> ' + esc(i.resolved_reason || '') + '</div>' : ''}
    <div class="acts">
      <button class="btn" data-do="issue_status" data-id="${esc(i.id)}">Change the state</button>
      <button class="btn" data-do="issue_assign" data-id="${esc(i.id)}">Assign it</button>
      <button class="btn" data-do="issue_note" data-id="${esc(i.id)}">Write a note</button>
    </div>
  </section>

  <section class="panel">
    <h2>Credits</h2>
    <div class="tiles">
      <div class="tile"><div class="n">${m.credits_charged || 0}</div><div class="l">Charged</div></div>
      <div class="tile"><div class="n">${m.credits_refunded || 0}</div><div class="l">Returned</div></div>
    </div>
    <p class="muted">${esc(m.note || '')}</p>
  </section>

  <section class="panel">
    <h2>Who it happened to</h2>
    <p class="muted">Eleven times on one account and eleven across eleven
      accounts are the same number of occurrences and completely different
      news, so they are counted separately.</p>
    <div class="tablewrap"><table>
      <thead><tr><th>Account</th><th class="num">Times</th><th class="num">Credits</th>
        <th class="num">Cost</th><th>Last one</th><th></th></tr></thead>
      <tbody>${accounts || '<tr><td colspan="6" class="sub">No account is linked to this. '
        + 'It was recorded without one, which usually means it happened before a '
        + 'request knew whose it was.</td></tr>'}</tbody>
    </table></div>
  </section>

  <section class="panel">
    <h2>What was recorded</h2>
    <p class="muted">${d.occurrences_total > (d.occurrences || []).length
      ? 'The most recent ' + (d.occurrences || []).length + ' of '
        + d.occurrences_total + '. The figures above count all of them.'
      : 'Every occurrence recorded.'}</p>
    <div class="tablewrap"><table>
      <thead><tr><th>When</th><th>What</th><th>Outcome</th><th class="num">Credits</th>
        <th class="num">Cost</th><th class="num">Took</th><th>Version</th></tr></thead>
      <tbody>${hits || '<tr><td colspan="7" class="sub">Nothing linked.</td></tr>'}</tbody>
    </table></div>
  </section>

  <section class="panel">
    <h2>Notes</h2>
    ${notes || emptyState('Nothing written down yet.',
      'An issue closed with nothing written down teaches nobody anything the '
      + 'second time it appears.')}
  </section>

  ${cases ? `<section class="panel">
    <h2>Support cases</h2>
    <div class="tablewrap"><table>
      <thead><tr><th>Subject</th><th>State</th><th>Opened</th><th>By</th></tr></thead>
      <tbody>${cases}</tbody></table></div>
  </section>` : ''}`;
}

export function viewWriters(d, q) {
  let rows = d.writers || [];
  const needle = String(q || '').trim().toLowerCase();
  if (needle) rows = rows.filter(r =>
    (r.email || '').toLowerCase().includes(needle)
    || (r.name || '').toLowerCase().includes(needle)
    || (r.tag || '').toLowerCase().includes(needle)
    || (r.id || '').toLowerCase().includes(needle));

  if (!rows.length) return partial(d.errors)
    + emptyState(needle ? 'Nobody matches that.' : 'No accounts yet.',
        needle ? 'Searched email, name and account reference.' : '');

  return partial(d.errors) + (d.truncated
    ? '<div class="note bad">More accounts exist than were read. The figures '
      + 'below describe the ones shown.</div>' : '') + `
  <div class="tablewrap"><table>
    <thead><tr><th>Account</th><th>Plan</th><th>Joined</th><th>Last worked</th>
      <th class="num">Days worked</th><th class="num">Projects</th>
      <th class="num">Credits used</th><th class="num">Cost</th>
      <th class="num">Failed</th><th></th></tr></thead>
    <tbody>${rows.map(r => `
      <tr${r.internal ? ' class="internal"' : ''}>
        <td><b>${esc(r.email || r.tag || r.id)}</b>
          <div class="sub">${esc([r.internal ? 'internal' : '',
            r.cancelling ? 'leaving at period end' : '',
            r.help_paused_at ? 'writing help paused' : ''].filter(Boolean).join(' &middot; '))}</div></td>
        <td>${esc(r.plan)}${r.status ? '<div class="sub">' + esc(r.status) + '</div>' : ''}</td>
        <td>${esc(when(r.created_at))}</td>
        <td>${esc(r.last_worked ? when(r.last_worked + 'T00:00:00Z') : 'never')}</td>
        <td class="num">${r.work_days}</td>
        <td class="num">${r.projects}</td>
        <td class="num">${r.credits_used_this_period}<span class="of"> of ${r.allowance}</span></td>
        <td class="num">${money(r.cost_usd)}</td>
        <td class="num${r.failed_calls ? ' bad' : ''}">${r.failed_calls}</td>
        <td><button class="btn sm" data-open-account="${esc(r.id)}">Open</button></td>
      </tr>`).join('')}</tbody>
  </table></div>
  <p class="muted">Credits used is this account's own allowance period, which
    begins on the day they signed up. Cost is the selected window. The two
    deliberately do not cover the same days, so they are labelled rather than
    printed side by side as though they did.</p>`;
}

export function viewProduct(d) {
  const j = d.journey || [];
  const top = j.length ? j[0].n : 0;

  const journey = j.map(s => `
    <div class="fstage">
      <div class="flab">${esc(s.label)}<div class="sub">${esc(s.means || '')}</div></div>
      <div class="fbar"><span style="width:${top ? Math.round(s.n / top * 100) : 0}%"></span></div>
      <div class="fnum">${s.n}</div>
      <div class="fpct">${s.from_prev === null ? '' : s.from_prev + '%'}</div>
    </div>`).join('');

  const ret = (d.returning || []).map(r => `
    <tr><td>Within ${r.window_days} days</td>
      <td class="num">${share(r.returned, r.eligible)}</td>
      <td class="sub">${esc(r.means)}</td></tr>`).join('');

  const paths = (d.by_path || []).map(p => `
    <tr><td>${esc(p.label)}${p.too_small
      ? '<span class="pill small">too few to judge</span>' : ''}</td>
      <td class="num">${p.users}</td>
      <td class="num">${share(p.organised, p.users)}</td>
      <td class="num">${share(p.returned, p.users)}</td>
      <td class="num">${share(p.paid, p.users)}</td></tr>`).join('');

  const src = (d.sources || []).map(s => `
    <tr><td>${esc(s.key)}</td><td class="num">${s.users}</td>
      <td class="num">${share(s.organised, s.users)}</td>
      <td class="num">${share(s.paid, s.users)}</td></tr>`).join('');

  const feat = (d.features || []).map(f => `
    <tr><td>${esc(f.label)}</td>
      <td class="num">${f.started}</td>
      <td class="num">${f.finished === null ? '<span class="no">&ndash;</span>' : f.finished}</td>
      <td class="num${f.failed ? ' bad' : ''}">${f.failed === null ? '<span class="no">&ndash;</span>' : f.failed}</td></tr>`).join('');

  return partial(d.errors) + `
  <section class="panel">
    <h2>The new writer's journey</h2>
    <p class="muted">Each step counts only the people who met every step before
      it. Somebody who subscribed without ever starting a project does not
      appear below the first row.</p>
    ${journey || emptyState('Nobody has signed up yet.')}
  </section>

  <section class="panel">
    <h2>Coming back</h2>
    <p class="muted">Measured in days somebody actually saved work, not in days
      they opened a tab. Accounts too new to have met a window are left out of
      it rather than counted as having failed it.</p>
    <div class="tablewrap"><table>
      <thead><tr><th>Window</th><th class="num">Came back</th><th>What it means</th></tr></thead>
      <tbody>${ret}</tbody></table></div>
    <p class="muted">${esc(d.note || '')}</p>
  </section>

  <section class="panel">
    <h2>How they started</h2>
    <div class="tablewrap"><table>
      <thead><tr><th>First choice</th><th class="num">People</th>
        <th class="num">Organised their material</th><th class="num">Came back</th>
        <th class="num">Subscribing</th></tr></thead>
      <tbody>${paths}</tbody></table></div>
  </section>

  <section class="panel">
    <h2>Where they came from</h2>
    <p class="muted">An account with no attribution is shown as unknown. It is
      not counted as direct traffic, because nobody knows that it was.</p>
    <div class="tablewrap"><table>
      <thead><tr><th>Source</th><th class="num">People</th>
        <th class="num">Organised</th><th class="num">Subscribing</th></tr></thead>
      <tbody>${src || '<tr><td colspan="4" class="sub">Nothing recorded yet.</td></tr>'}</tbody>
    </table></div>
  </section>

  <section class="panel">
    <h2>Features</h2>
    <p class="muted">Started, finished and failed are counted separately. A
      feature started a hundred times and finished twice is not a popular
      feature.</p>
    <div class="tablewrap"><table>
      <thead><tr><th>Feature</th><th class="num">Started</th>
        <th class="num">Finished</th><th class="num">Failed</th></tr></thead>
      <tbody>${feat}</tbody></table></div>
  </section>

  ${trackingLine(d.tracking_started_at)}`;
}

export function viewMoney(d) {
  const c = d.collected || {}, r = d.recurring || {}, k = d.costs || {},
        cr = d.credits || {}, rec = d.reconcile || {};

  const largest = (d.largest_actions || []).map(a => `
    <tr><td>${esc(a.feature)}</td>
      <td class="num">${a.actions}</td>
      <td class="num">${money(a.most_expensive_usd)}
        <div class="sub">${a.calls_in_that_one} call${a.calls_in_that_one === 1 ? '' : 's'}</div></td>
      <td class="num">${money(a.average_usd)}</td>
      <td class="num${a.would_have_been_stopped ? ' bad' : ''}">${
        a.would_have_been_stopped === null ? '<span class="no">&ndash;</span>'
        : a.would_have_been_stopped}</td></tr>`).join('');

  const budgets = (d.budgets || []).map(b => `
    <tr><td>${esc(scopeWord(b.scope))}</td>
      <td class="num">${b.warn_micros === null ? notSet() : money(b.warn_micros / 1e6)}</td>
      <td class="num">${b.urgent_micros === null ? notSet() : money(b.urgent_micros / 1e6)}</td>
      <td class="num">${b.stop_micros === null ? notSet() : money(b.stop_micros / 1e6)}</td>
      <td><span class="pill ${b.enforced ? 'st-new' : 'small'}">${
        b.enforced ? 'Enforced' : 'Watching only'}</span></td>
      <td class="sub">${esc(b.note || '')}</td></tr>`).join('');

  return partial(d.errors) + `
  <section class="panel">
    <h2>Money collected</h2>
    <div class="tiles">
      <div class="tile"><div class="n">${money(c.subscriptions_usd)}</div>
        <div class="l">Subscriptions</div></div>
      <div class="tile"><div class="n">${money(c.packs_usd)}</div>
        <div class="l">Credit packs</div></div>
      <div class="tile"><div class="n">${money(c.refunds_usd)}</div>
        <div class="l">Refunded</div></div>
      <div class="tile ${c.failed_usd ? 'bad' : ''}"><div class="n">${money(c.failed_usd)}</div>
        <div class="l">Payments that failed</div></div>
    </div>
    <p class="muted">${esc(c.note || '')} Selected window.</p>
    <p class="muted">${esc(r.note || '')}
      ${r.monthly_payments} monthly and ${r.annual_payments} annual in this window.</p>
  </section>

  <section class="panel">
    <h2>What it cost to serve</h2>
    <div class="tiles">
      <div class="tile"><div class="n">${money(k.customers_usd)}</div><div class="l">Customers</div></div>
      <div class="tile"><div class="n">${money(k.trials_usd)}</div><div class="l">Trials</div></div>
      <div class="tile"><div class="n">${money(k.internal_usd)}</div><div class="l">Your own testing</div></div>
    </div>
    <p class="muted">${esc(k.note || '')}</p>
  </section>

  <section class="panel">
    <h2>Credits</h2>
    <div class="tiles">
      <div class="tile"><div class="n">${cr.charged || 0}</div><div class="l">Charged</div></div>
      <div class="tile"><div class="n">${cr.refunded || 0}</div><div class="l">Returned</div></div>
      <div class="tile"><div class="n">${cr.purchased || 0}</div><div class="l">Bought</div></div>
    </div>
  </section>

  <section class="panel">
    <h2>Does not reconcile</h2>
    <div class="tiles">
      <div class="tile ${rec.unknown_outcome ? 'warn' : ''}">
        <div class="n">${rec.unknown_outcome || 0}</div>
        <div class="l">Outcome never known</div></div>
      <div class="tile ${rec.failed_but_recorded ? 'warn' : ''}">
        <div class="n">${rec.failed_but_recorded || 0}</div>
        <div class="l">Failed after being charged</div></div>
    </div>
    <p class="muted">${esc(rec.note || '')}</p>
  </section>

  <section class="panel">
    <h2>The largest actions measured</h2>
    <p class="muted">One action means one session, which is what a cutoff would
      measure. This is the evidence for the proposed figure below: it is not
      switched on, and the last column says how often it would have fired.</p>
    <div class="tablewrap"><table>
      <thead><tr><th>Feature</th><th class="num">Actions</th>
        <th class="num">Most expensive one</th><th class="num">Average</th>
        <th class="num">Would have stopped</th></tr></thead>
      <tbody>${largest || '<tr><td colspan="5" class="sub">No actions recorded in this window.</td></tr>'}</tbody>
    </table></div>
  </section>

  <section class="panel">
    <h2>Spending limits</h2>
    <p class="muted">Nothing here stops anything. Every figure is being watched
      so the record can show whether it would ever have been right.</p>
    <div class="tablewrap"><table>
      <thead><tr><th>Applies to</th><th class="num">Warn</th><th class="num">Urgent</th>
        <th class="num">Stop</th><th>State</th><th>Note</th></tr></thead>
      <tbody>${budgets || '<tr><td colspan="6" class="sub">No figures set.</td></tr>'}</tbody>
    </table></div>
  </section>`;
}

function notSet() { return '<span class="no" title="nobody has approved a figure">not set</span>'; }

function scopeWord(s) {
  return { paid_period: 'A subscriber, per allowance period',
           trial_account: 'A trial account, whole trial',
           single_action: 'One action',
           rate_hour: 'One account, per hour',
           platform_day: 'Everything, per day' }[s] || s;
}

export function viewSystem(d) {
  const s = d.stripe || {}, m = d.mail || {};
  return partial(d.errors) + `
  <section class="panel">
    <h2>Payments</h2>
    <div class="lamps">
      <div><span class="lk">Stripe</span>${s.configured
        ? (s.live ? '<span class="lamp ok">Live</span>'
                  : '<span class="lamp warn">Test mode</span>')
        : '<span class="lamp unknown">Not connected</span>'}</div>
      <div><span class="lk">Cards accepted</span><span class="lamp ${s.live ? 'ok' : 'warn'}">${
        s.live ? 'Real' : 'Test only'}</span></div>
    </div>
    <p class="muted">${esc(s.note || '')}</p>
  </section>

  <section class="panel">
    <h2>Getting alerts to you</h2>
    <div class="lamps">
      <div><span class="lk">Mail</span>${m.configured
        ? '<span class="lamp ok">Configured</span>'
        : '<span class="lamp bad">Not configured</span>'}</div>
      <div><span class="lk">Address to alert</span>${m.alerts_to_set
        ? '<span class="lamp ok">Set</span>'
        : '<span class="lamp bad">Not set</span>'}</div>
    </div>
    ${!m.alerts_to_set ? '<p class="note bad">No address is set, so alerts are '
      + 'recorded and nothing is sent. Set ALERT_TO to the address you want '
      + 'them at.</p>' : ''}
    <div class="tiles">
      <div class="tile ${m.undelivered ? 'warn' : ''}"><div class="n">${m.undelivered || 0}</div>
        <div class="l">Not delivered</div></div>
      <div class="tile ${m.gave_up ? 'bad' : ''}"><div class="n">${m.gave_up || 0}</div>
        <div class="l">Given up on</div></div>
    </div>
  </section>

  <section class="panel">
    <h2>Work in progress</h2>
    <div class="tiles">
      <div class="tile"><div class="n">${d.open_holds || 0}</div>
        <div class="l">Reservations open</div></div>
      <div class="tile ${d.stuck_holds ? 'warn' : ''}"><div class="n">${d.stuck_holds || 0}</div>
        <div class="l">Open more than an hour</div></div>
    </div>
    <p class="muted">A reservation open for hours is not work in progress. It is
      a request that went away without settling, and it counts against every
      ceiling until it is cleared.</p>
  </section>

  <section class="panel">
    <h2>This deployment</h2>
    <div class="lamps">
      <div><span class="lk">Version</span><span class="lamp ${d.deploy ? 'ok' : 'unknown'}">${
        d.deploy ? esc(d.deploy) : 'not recorded'}</span></div>
      <div><span class="lk">Records began</span><span class="lamp ok">${
        esc(d.tracking_started_at ? when(d.tracking_started_at) : 'not recorded')}</span></div>
    </div>
  </section>`;
}

/* ---------------------------------------------------------------------------
   ONE ACCOUNT. Everything needed to answer a support question, and no part of
   what they wrote.
   --------------------------------------------------------------------------- */
export function viewAccount(d) {
  const a = d.account;
  if (!a) return emptyState('No such account.', d.error || '');

  const led = (d.ledger || []).slice(0, 40).map(l => `
    <tr><td>${esc(when(l.created_at))}</td>
      <td>${esc(l.kind)}</td>
      <td class="num ${l.credits < 0 ? 'bad' : 'good'}">${l.credits > 0 ? '+' : ''}${l.credits}</td>
      <td>${esc(l.bucket || '')}</td>
      <td class="sub">${esc(l.reason || '')}</td></tr>`).join('');

  const pay = (d.payments || []).slice(0, 20).map(p => `
    <tr><td>${esc(when(p.created_at))}</td><td>${esc(p.kind)}</td>
      <td class="num">${money((p.amount_cents || 0) / 100)}</td>
      <td>${esc(p.status)}</td>
      <td class="sub">${p.livemode ? 'live' : 'test mode'}</td></tr>`).join('');

  const use = (d.usage || []).slice(0, 30).map(u => `
    <tr><td>${esc(when(u.created_at))}</td><td>${esc(u.kind)}</td>
      <td class="num">${u.credits}</td>
      <td class="num">${money((u.cost_micros || 0) / 1e6)}</td>
      <td><span class="pill ${u.status === 'ok' ? 'st-resolved' : 'st-new'}">${
        esc(u.status || 'ok')}</span>${u.error_code
        ? '<div class="sub">' + esc(u.error_code) + '</div>' : ''}</td></tr>`).join('');

  return `
  ${partial(d.errors)}
  <section class="panel">
    <h2>${esc(a.email || a.tag || a.id)}</h2>
    <div class="tiles">
      <div class="tile"><div class="n">${esc(a.plan)}</div><div class="l">Plan</div>
        ${a.status ? '<div class="scope">' + esc(a.status) + '</div>' : ''}</div>
      <div class="tile"><div class="n">${a.credits_used_this_period}<span class="of"> of ${a.allowance}</span></div>
        <div class="l">Credits this period</div>
        <div class="scope">since ${esc(when(a.period_start))}</div></div>
      <div class="tile"><div class="n">${a.credits_banked}</div><div class="l">Bought credits</div>
        <div class="scope">never expire</div></div>
      <div class="tile"><div class="n">${esc(when(a.created_at))}</div><div class="l">Joined</div></div>
    </div>
    ${a.help_paused_at ? '<p class="note bad"><b>The paid writing help is paused '
      + 'on this account.</b> ' + esc(a.help_pause_reason || '')
      + ' Their boards, notes and downloads are untouched.</p>' : ''}
    <div class="acts">
      ${a.help_paused_at
        ? '<button class="btn" data-do="help_resume" data-user="' + esc(a.id) + '">Let the writing help work again</button>'
        : '<button class="btn warn" data-do="help_pause" data-user="' + esc(a.id) + '">Pause the paid writing help</button>'}
      <button class="btn" data-do="credit_correction" data-user="${esc(a.id)}">Correct credits</button>
      <button class="btn" data-do="case_open" data-user="${esc(a.id)}">Open a support case</button>
    </div>
  </section>

  <section class="panel"><h2>Credit history</h2>
    <div class="tablewrap"><table>
      <thead><tr><th>When</th><th>What</th><th class="num">Credits</th><th>Bucket</th><th>Why</th></tr></thead>
      <tbody>${led || '<tr><td colspan="5" class="sub">Nothing recorded. The ledger began on the day it was built, so older movements are not in it.</td></tr>'}</tbody>
    </table></div>
  </section>

  <section class="panel"><h2>Payments</h2>
    <div class="tablewrap"><table>
      <thead><tr><th>When</th><th>What</th><th class="num">Amount</th><th>Outcome</th><th></th></tr></thead>
      <tbody>${pay || '<tr><td colspan="5" class="sub">No payments recorded.</td></tr>'}</tbody>
    </table></div>
  </section>

  <section class="panel"><h2>Writing help</h2>
    <div class="tablewrap"><table>
      <thead><tr><th>When</th><th>What</th><th class="num">Credits</th><th class="num">Cost</th><th>Outcome</th></tr></thead>
      <tbody>${use || '<tr><td colspan="5" class="sub">Never used it.</td></tr>'}</tbody>
    </table></div>
  </section>`;
}
