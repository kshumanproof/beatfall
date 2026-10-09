// ============================================================================
// Getting an alert to Kris when the admin page is not open.
//
// Two speeds, which is what he asked for: an URGENT alert goes out the moment
// the request that crossed the line finishes, and everything else waits for
// one message a day. The reason for the split is attention rather than
// plumbing. A channel that pings for every warning stops being read, and the
// one time it matters it will be the eleventh message that week.
//
// NO CRON IS NEEDED FOR THE URGENT ONE. It is sent by the request that caused
// it, inline, which is also why it cannot be late: there is no queue to drain
// and no worker to still be running. The digest rides the nightly job that
// already exists.
//
// THE ADDRESS IS AN ENVIRONMENT VARIABLE AND NOTHING ELSE. If ALERT_TO is not
// set, the alert is still recorded and the dashboard says plainly that nothing
// was delivered. An alert that was never sent while the page shows it as sent
// is worse than no alert at all, so delivery is recorded per row with its
// failure attached.
// ============================================================================

const BRAND_INK = '#2B2620';
const BRAND_MUTE = '#5C5349';
const BRAND_RULE = '#E0D9CB';
const BRAND_SURFACE = '#F6F3ED';
const BRAND_RED = '#8C2F24';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* The money figure, from micros, in the form an operator reads. Never a float
   with eleven decimal places on a line that is supposed to be scanned. */
export function usd(micros) {
  const n = Number(micros || 0) / 1e6;
  return '$' + (n < 10 ? n.toFixed(2) : n.toFixed(2));
}

function shell(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${BRAND_SURFACE}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
 style="background:${BRAND_SURFACE};padding:28px 16px">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
 style="max-width:600px;background:#FDFBF6;border:1px solid ${BRAND_RULE};border-radius:4px">
<tr><td style="padding:26px 28px">
<p style="margin:0 0 4px;font:600 11px/1 'Courier New',monospace;letter-spacing:.14em;
 text-transform:uppercase;color:${BRAND_RED}">Beatfall operations</p>
<h1 style="margin:0 0 16px;font:600 22px/1.2 Georgia,serif;color:${BRAND_INK}">${esc(title)}</h1>
${bodyHtml}
</td></tr></table>
<p style="margin:16px 0 0;font:400 11.5px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;
 color:#8A8075">Sent to the Beatfall operator address. Nobody reads replies to this
 message.</p>
</td></tr></table></body></html>`;
}

function rows(pairs) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" '
    + 'style="margin:0 0 14px">'
    + pairs.map(([k, v]) =>
        `<tr><td style="padding:4px 0;font:400 13.5px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;`
        + `color:${BRAND_MUTE};width:46%">${esc(k)}</td>`
        + `<td style="padding:4px 0;font:600 13.5px/1.5 'Courier New',monospace;`
        + `color:${BRAND_INK};text-align:right">${esc(v)}</td></tr>`).join('')
    + '</table>';
}

/* RETRY THE FAILURES THAT CAN SUCCEED, AND ONLY THOSE.
 *
 * A refused address and a dropped connection are not the same failure. One
 * will never work and retrying it three times just delays the request that
 * caused it; the other is usually gone by the second attempt. So a 4xx other
 * than 429 is permanent and returns at once, and everything else gets a
 * couple more goes with a short wait between them.
 *
 * Two attempts of backoff and no more, because this runs INSIDE a writer's
 * request. A mail server having a bad minute must not hold up somebody's
 * import. Anything still undelivered is left on the row with its reason, and
 * the nightly sweep picks it up later with the time to be patient. */
const RETRY_WAITS = [400, 1200];

function permanent(status) {
  // 429 is "slow down", which is temporary. 401 and 403 mean the key is
  // wrong, and no amount of retrying fixes a wrong key.
  return status >= 400 && status < 500 && status !== 429;
}

async function post(to, subject, html, text, tries) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  // Neither of these is a delivery failure to retry. They are configuration,
  // and the row says so in those words so the dashboard can tell Kris to set
  // ALERT_TO rather than showing him a mail server that keeps refusing.
  if (!key || !from) return { ok: false, why: 'mail is not configured', permanent: true, attempts: 0 };
  if (!to) return { ok: false, why: 'ALERT_TO is not set', permanent: true, attempts: 0 };

  const max = Math.max(1, Math.min(3, tries == null ? 3 : tries));
  let last = 'not attempted';
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
        body: JSON.stringify({ from, to, reply_to: from, subject, html, text })
      });
      if (r.ok) return { ok: true, attempts: attempt };
      last = 'mail refused with ' + r.status;
      if (permanent(r.status)) return { ok: false, why: last, permanent: true, attempts: attempt };
    } catch (e) { last = 'mail could not be reached'; }
    if (attempt < max) await new Promise(r => setTimeout(r, RETRY_WAITS[attempt - 1] || 1200));
  }
  return { ok: false, why: last, permanent: false, attempts: max };
}

/* ---------------------------------------------------------------------------
   ONE URGENT ALERT, SENT NOW.

   Everything in the body is a figure or an identifier. No story text ever
   reaches this message, and the account is named by its email because the
   person reading it is the operator who already has that in the admin page.
   --------------------------------------------------------------------------- */
export async function sendAlert(db, alertRow) {
  const to = process.env.ALERT_TO;
  const d = alertRow.detail || {};
  const title = alertRow.summary || 'Something needs attention';
  const body = rows([
    ['Account', d.email || alertRow.subject_tag || 'unknown'],
    ['Spent this period', d.spent_usd || usd(d.spent_micros)],
    ['Threshold crossed', d.threshold_usd || usd(d.threshold_micros)],
    ['Period began', d.period_start || 'unknown'],
    ['Costing the most', d.top || 'not broken down'],
    ['Internal test account', d.internal ? 'yes' : 'no']
  ]) + `<p style="margin:0 0 18px;font:400 14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;
 color:${BRAND_MUTE}">Nothing has been stopped. Spending limits are being watched and
 are not enforced.</p>`
    + (d.link ? `<a href="${esc(d.link)}" style="display:inline-block;background:#2C5C8F;
 color:#fff;font:600 14px -apple-system,Segoe UI,Roboto,sans-serif;text-decoration:none;
 padding:11px 20px;border-radius:4px">Open this account</a>` : '');

  const text = [title, '',
    'Account: ' + (d.email || alertRow.subject_tag || 'unknown'),
    'Spent this period: ' + (d.spent_usd || usd(d.spent_micros)),
    'Threshold crossed: ' + (d.threshold_usd || usd(d.threshold_micros)),
    'Period began: ' + (d.period_start || 'unknown'),
    'Costing the most: ' + (d.top || 'not broken down'),
    'Internal test account: ' + (d.internal ? 'yes' : 'no'), '',
    'Nothing has been stopped. Spending limits are being watched and are not enforced.',
    d.link || ''].join('\n');

  const sent = await post(to, 'Beatfall: ' + title, shell(title, body), text);
  /* THE ROW SAYS WHAT ACTUALLY HAPPENED, which is three states and not two:
     delivered, tried and failed, or never tried because mail is not set up.
     `delivered_at` is written ONLY on a real success, so the dashboard can
     never show a message as sent that was not. `attempts` accumulates across
     the nightly sweep as well as this call, so "failed once" and "failed six
     times over two days" are different things on the screen. */
  const now = new Date().toISOString();
  try {
    await db.from('alerts').update(sent.ok
      ? { delivered_at: now, channel: 'email', delivery_error: null,
          attempts: (alertRow.attempts || 0) + sent.attempts, last_attempt_at: now }
      : { channel: 'email', delivery_error: sent.why,
          attempts: (alertRow.attempts || 0) + sent.attempts, last_attempt_at: now }
    ).eq('id', alertRow.id);
  } catch (e) {}
  return sent.ok;
}

/* ---------------------------------------------------------------------------
   THE SWEEP, for anything the moment could not deliver.

   Runs on the nightly job beside the digest. It has the patience the inline
   attempt does not: nobody is waiting on it, so it can try the ones that
   failed for a reason that might have passed.

   It gives up at MAX_ATTEMPTS and at three days, and when it does it SAYS so
   on the row rather than retrying quietly forever. A permanent failure, a
   wrong key or an address that does not exist, is already marked and is never
   picked up here, so a bad configuration does not generate a nightly storm.
   --------------------------------------------------------------------------- */
const MAX_ATTEMPTS = 6;

export async function retryUndelivered(db) {
  let rows = [];
  try {
    const since = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data } = await db.from('alerts')
      .select('id, level, summary, detail, subject_tag, attempts, delivery_error, created_at')
      .is('delivered_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: true }).limit(40);
    rows = data || [];
  } catch (e) { return { tried: 0, sent: 0, why: 'could not read the alerts' }; }

  // Not worth another attempt: either it was never going to work, or it has
  // had its six.
  const worth = rows.filter(a => (a.attempts || 0) < MAX_ATTEMPTS
    && !/not configured|ALERT_TO is not set|refused with 4/.test(a.delivery_error || ''));

  let sent = 0;
  for (const a of worth) { if (await sendAlert(db, a)) sent++; }

  // The ones that have run out of attempts stop pretending they are pending.
  const spent = rows.filter(a => (a.attempts || 0) >= MAX_ATTEMPTS);
  for (const a of spent) {
    try {
      await db.from('alerts').update({
        delivery_error: 'gave up after ' + MAX_ATTEMPTS + ' attempts'
      }).eq('id', a.id);
    } catch (e) {}
  }
  return { tried: worth.length, sent, gave_up: spent.length };
}

/* ---------------------------------------------------------------------------
   THE DAILY DIGEST. One message, everything still unanswered.

   Deliberately not "everything that happened": an alert already acknowledged
   is finished with, and a digest that repeats it teaches you to skim. If
   nothing is outstanding, NOTHING IS SENT. A daily message that usually says
   "all clear" is a daily message nobody opens, and the one that matters looks
   exactly like the others in a list.
   --------------------------------------------------------------------------- */
export async function sendDigest(db) {
  const to = process.env.ALERT_TO;
  let open = [];
  try {
    const { data } = await db.from('alerts')
      .select('id, kind, level, summary, detail, created_at, delivered_at')
      .is('acknowledged_at', null)
      .order('created_at', { ascending: false }).limit(60);
    open = data || [];
  } catch (e) { return { sent: false, why: 'could not read the alerts' }; }

  if (!open.length) return { sent: false, why: 'nothing outstanding' };

  const byLevel = l => open.filter(a => a.level === l);
  const section = (label, list) => !list.length ? '' :
    `<p style="margin:16px 0 6px;font:600 11px/1 'Courier New',monospace;letter-spacing:.12em;
 text-transform:uppercase;color:${BRAND_MUTE}">${esc(label)}</p>`
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">'
    + list.map(a => `<tr><td style="padding:6px 0;border-top:1px solid ${BRAND_RULE};
 font:400 13.5px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:${BRAND_INK}">
 ${esc(a.summary || a.kind)}<br>
 <span style="font-size:12px;color:#8A8075">${esc(String(a.created_at).slice(0, 16).replace('T', ' '))}
 ${a.delivered_at ? '' : ' &middot; not sent at the time'}</span></td></tr>`).join('')
    + '</table>';

  const body = `<p style="margin:0 0 10px;font:400 14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;
 color:${BRAND_MUTE}">${open.length} thing${open.length === 1 ? '' : 's'} nobody has
 answered yet. Marking one as seen on the admin page takes it off this list.</p>`
    + section('Needs stopping', byLevel('stop'))
    + section('Urgent', byLevel('urgent'))
    + section('Worth a look', byLevel('warn'));

  const text = 'Beatfall: ' + open.length + ' outstanding\n\n'
    + open.map(a => '[' + a.level + '] ' + (a.summary || a.kind)
        + '  ' + String(a.created_at).slice(0, 16).replace('T', ' ')).join('\n');

  const sent = await post(to, 'Beatfall: ' + open.length + ' thing'
    + (open.length === 1 ? '' : 's') + ' outstanding',
    shell('Outstanding', body), text);
  return { sent: sent.ok, why: sent.why, count: open.length };
}
