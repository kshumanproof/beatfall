// ============================================================================
// THE OPERATOR'S WRITE ENDPOINT. Separate from the reporting one on purpose.
//
// /api/admin reads and can never change anything. This file is the only place
// an operator action touches the database, which is what makes "what can this
// page do" a question with a short, readable answer rather than one that
// needs the whole codebase.
//
// SIX RULES, AND EVERY ONE OF THEM IS A WAY AN ADMIN TOOL GOES WRONG.
//
// 1. EVERY ACTION IS NAMED. There is no generic "update this profile" and no
//    raw column write. An action that cannot be named in the list below
//    cannot be performed, which means nobody can discover a way to set
//    is_admin through a control that was built for correcting credits.
//
// 2. ROLES ARE NOT ADMINISTRABLE FROM HERE. is_admin and is_unlimited are
//    deliberately absent. They are two switches that decide who can read
//    everybody's numbers and whose boards never close, and they are changed
//    in the database by a person who went looking for them.
//
// 3. EVERY ACTION IS AUDITED, INCLUDING THE REFUSED ONES. "I tried and it
//    would not let me" is a real thing to be able to read later.
//
// 4. EVERY ACTION IS IDEMPOTENT. A double press, a retried request and a
//    flaky connection must not correct the same credits twice.
//
// 5. NOTHING HERE TOUCHES A WRITER'S WORK. Pausing the paid writing help
//    leaves every board, note and download exactly where it was, because
//    withholding somebody's own writing is not a cost control.
//
// 6. NOTHING HERE ENABLES ENFORCEMENT. Budgets can be set and are recorded
//    with who approved them, and `enforced` cannot be turned on through this
//    endpoint at all. Kris asked for the figures to be observed first and
//    that is a decision the code should hold, not a note in a file.
// ============================================================================
import { requireUser, send, readBody } from './_lib/core.js';
import { adminAction, finishAction, ledger, accountTag, alreadyPosted,
         movementKey, raiseAlert } from './_lib/operator.js';

/* The most a single correction may move, in credits. Not a business rule so
   much as a blast radius: a typed figure with an extra zero on it should be
   refused rather than applied, and a genuine case larger than this is rare
   enough to be worth a second press. */
const MAX_CORRECTION = 500;

const ISSUE_STATES = ['new', 'investigating', 'monitoring', 'resolved'];
const CASE_STATES = ['open', 'waiting', 'closed'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });

  const auth = await requireUser(req);
  if (auth.error) return send(res, auth.status, { error: auth.error });
  const { db, user, profile } = auth;
  if (!profile.is_admin) return send(res, 403, { error: 'not_admin' });

  const body = await readBody(req);
  const action = String(body.action || '');
  /* THE KEY THAT MAKES A RETRY SAFE comes from the browser, because only the
     browser knows that this press is the same press as the one whose answer
     it never received. It is scoped to the admin and the action so one
     operator's key cannot collide with another's. */
  /* ALWAYS A KEY, even when the browser did not send one. A press the client
     claims is a repeat of an earlier press is deduped against it; a press
     with no claim gets a fresh key and is treated as a new one, which is the
     honest reading of a caller that did not say otherwise. Either way there
     is a handle to write the outcome back onto. */
  const idem = 'a:' + user.id + ':' + action + ':' + (body.idem
    ? String(body.idem).slice(0, 80)
    : (globalThis.crypto && globalThis.crypto.randomUUID
        ? globalThis.crypto.randomUUID() : Date.now() + ':' + Math.random()));

  /* The audit row is written FIRST and its answer decides whether the action
     runs. A duplicate key means this exact press has already been handled, so
     the work is skipped and the caller is told it was done rather than being
     told it failed. That is what makes a double press harmless. */
  const started = await adminAction(db, {
    adminId: user.id, adminEmail: profile.email, action,
    subjectUser: body.user_id || null, detail: { requested: true }, idem, result: 'ok'
  });
  if (started === 'duplicate') return send(res, 200, { ok: true, already: true });
  const audit = (result, detail) => finishAction(db, idem, result, detail);

  try {
    switch (action) {

      /* ------------------------------------------------- alerts ---------- */
      case 'alert_ack': {
        const id = Number(body.id);
        if (!id) return refuse(res, db, audit, 'no alert named');
        await db.from('alerts')
          .update({ acknowledged_at: new Date().toISOString() })
          .eq('id', id).is('acknowledged_at', null);
        return send(res, 200, { ok: true });
      }

      /* ------------------------------------------------- issues ---------- */
      case 'issue_status': {
        const id = Number(body.id);
        const status = String(body.status || '');
        if (!id || !ISSUE_STATES.includes(status))
          return refuse(res, db, audit, 'not a state an issue can be in');
        /* RESOLVING NEEDS A REASON. An issue closed with nothing written down
           teaches nobody anything the second time it appears, and the second
           time is exactly when somebody goes looking. */
        if (status === 'resolved' && !String(body.reason || '').trim())
          return refuse(res, db, audit, 'say why it is resolved');
        const patch = { status, updated_at: new Date().toISOString() };
        if (status === 'resolved') {
          patch.resolved_at = new Date().toISOString();
          patch.resolved_reason = String(body.reason).slice(0, 500);
        } else { patch.resolved_at = null; patch.resolved_reason = null; }
        await db.from('admin_issues').update(patch).eq('id', id);
        return send(res, 200, { ok: true });
      }

      case 'issue_assign': {
        const id = Number(body.id);
        if (!id) return refuse(res, db, audit, 'no issue named');
        await db.from('admin_issues').update({
          assignee: String(body.assignee || '').slice(0, 80) || null,
          updated_at: new Date().toISOString()
        }).eq('id', id);
        return send(res, 200, { ok: true });
      }

      case 'issue_note': {
        const id = Number(body.id);
        const text = String(body.body || '').trim();
        if (!id || !text) return refuse(res, db, audit, 'nothing to write down');
        await db.from('admin_issue_notes').insert({
          issue_id: id, author: profile.email || 'admin', body: text.slice(0, 4000)
        });
        return send(res, 200, { ok: true });
      }

      /* ------------------------------------------- the writing help ------ */
      /* PAUSING THE PAID HELP, AND NOTHING ELSE.
         Their boards, their notes, their outline and every download stay
         exactly where they are. The only thing that stops is the metered
         feature that costs money, which is the only thing a cost problem is
         about. Placing notes by hand is free and stays free. */
      case 'help_pause': {
        if (!body.user_id) return refuse(res, db, audit, 'no account named');
        const why = String(body.reason || '').trim();
        if (!why) return refuse(res, db, audit, 'say why it is paused');
        await db.from('profiles').update({
          help_paused_at: new Date().toISOString(),
          help_pause_reason: why.slice(0, 300)
        }).eq('id', body.user_id);
        return send(res, 200, { ok: true });
      }

      case 'help_resume': {
        if (!body.user_id) return refuse(res, db, audit, 'no account named');
        await db.from('profiles').update({
          help_paused_at: null, help_pause_reason: null
        }).eq('id', body.user_id);
        return send(res, 200, { ok: true });
      }

      /* ------------------------------------------------ credits ---------- */
      /* A CORRECTION, NOT A CREDIT EDITOR.
         It moves one bucket by a bounded amount, it says why, it writes a
         ledger row, and the ledger refuses the same movement twice. It
         cannot set a balance to an arbitrary number and it cannot touch
         anything else on the profile. */
      case 'credit_correction': {
        const n = Math.round(Number(body.credits));
        const why = String(body.reason || '').trim();
        if (!body.user_id) return refuse(res, db, audit, 'no account named');
        if (!Number.isFinite(n) || n === 0)
          return refuse(res, db, audit, 'no amount given');
        if (Math.abs(n) > MAX_CORRECTION)
          return refuse(res, db, audit, 'more than a single correction may move ('
            + MAX_CORRECTION + ')');
        if (!why) return refuse(res, db, audit, 'say why');

        const { data: p } = await db.from('profiles')
          .select('id, email, credits_used, credits_extra, account_tag')
          .eq('id', body.user_id).maybeSingle();
        if (!p) return refuse(res, db, audit, 'no such account');

        /* ASK THE LEDGER FIRST. The audit row above already stops a repeat of
           the same press, and this stops a repeat of the same MOVEMENT
           whatever press it arrives on. Money gets both. */
        const key = movementKey(idem || ('corr:' + p.id + ':' + Date.now()),
                                'correction', 'banked', n);
        if (await alreadyPosted(db, key))
          return send(res, 200, { ok: true, already: true });

        /* Corrections go to the BANKED bucket, always. A credit granted into
           the monthly one would quietly expire on the writer's reset day,
           which turns an apology into a smaller apology. */
        const banked = Math.max(0, (p.credits_extra || 0) + n);
        await db.from('profiles').update({ credits_extra: banked }).eq('id', p.id);
        await ledger(db, {
          userId: p.id, tag: await accountTag(db, p), kind: 'correction',
          credits: n, bucket: 'banked',
          reason: why.slice(0, 200), ref: idem, idem: key,
          bankedAfter: banked, actor: 'admin'
        });
        return send(res, 200, { ok: true, banked });
      }

      /* ------------------------------------------------ budgets ---------- */
      /* FIGURES CAN BE SET HERE. ENFORCEMENT CANNOT.
         See rule 6. A request that tries to turn enforcement on is refused
         and the refusal is recorded, so the attempt is visible rather than
         silently ignored. */
      case 'budget_set': {
        const scope = String(body.scope || '');
        if (!scope) return refuse(res, db, audit, 'no scope named');
        if (body.enforced === true)
          return refuse(res, db, audit,
            'enforcement is not switched on from this page while the figures '
            + 'are being observed');
        const num = v => (v === null || v === '' || v === undefined) ? null
          : Math.max(0, Math.round(Number(v) * 1e6));
        await db.from('budgets').upsert({
          scope,
          warn_micros: num(body.warn_usd),
          urgent_micros: num(body.urgent_usd),
          stop_micros: num(body.stop_usd),
          enforced: false,
          approved_by: profile.email || 'admin',
          approved_at: new Date().toISOString(),
          note: String(body.note || '').slice(0, 300),
          updated_at: new Date().toISOString()
        }, { onConflict: 'scope' });
        return send(res, 200, { ok: true });
      }

      /* ------------------------------------------------- cases ----------- */
      case 'case_open': {
        if (!body.user_id) return refuse(res, db, audit, 'no account named');
        const { data } = await db.from('support_cases').insert({
          user_id: body.user_id,
          subject: String(body.subject || '').slice(0, 200),
          issue_id: body.issue_id ? Number(body.issue_id) : null,
          opened_by: profile.email || 'admin', status: 'open'
        }).select('id').single();
        return send(res, 200, { ok: true, id: data ? data.id : null });
      }

      case 'case_status': {
        const id = Number(body.id);
        const status = String(body.status || '');
        if (!id || !CASE_STATES.includes(status))
          return refuse(res, db, audit, 'not a state a case can be in');
        await db.from('support_cases').update({
          status, updated_at: new Date().toISOString(),
          closed_at: status === 'closed' ? new Date().toISOString() : null
        }).eq('id', id);
        return send(res, 200, { ok: true });
      }

      /* -------------------------------------------- marketing ------------ */
      /* CONSENT IS THE WRITER'S, and an operator may only ever record what
         they were told. Turning it ON from here needs a source, so the row
         says where the permission came from; turning it OFF needs nothing,
         because somebody asking to be left alone is never refused. */
      case 'marketing_set': {
        if (!body.user_id) return refuse(res, db, audit, 'no account named');
        const on = body.opted_in === true;
        const source = String(body.source || '').trim();
        if (on && !source)
          return refuse(res, db, audit, 'say where the permission came from');
        await db.from('profiles').update({
          marketing_opt_in: on, marketing_changed_at: new Date().toISOString()
        }).eq('id', body.user_id);
        await db.from('consent_log').insert({
          user_id: body.user_id, channel: 'marketing', opted_in: on,
          source: (on ? source : 'admin, on request').slice(0, 120)
        });
        return send(res, 200, { ok: true });
      }

      /* --------------------------------------------- reservations -------- */
      /* A HOLD OPEN FOR HOURS IS NOT WORK IN PROGRESS. It is a request that
         went away without settling, and it counts against every ceiling
         until somebody clears it. Closed as UNKNOWN rather than abandoned,
         because nobody can say whether the provider did the work. */
      case 'hold_clear': {
        const id = Number(body.id);
        if (!id) return refuse(res, db, audit, 'no reservation named');
        await db.from('budget_holds').update({
          state: 'unknown', settled_at: new Date().toISOString()
        }).eq('id', id).eq('state', 'held');
        return send(res, 200, { ok: true });
      }

      default:
        return refuse(res, db, audit, 'not an action this page can take');
    }
  } catch (e) {
    console.error('admin action failed', action, e);
    await audit('failed', { why: 'threw' });
    /* A failure that might have half-landed is said out loud rather than
       retried here, because retrying a write whose outcome is unknown is how
       one correction becomes two. */
    await raiseAlert(db, {
      kind: 'system', level: 'warn', dedupe: 'adminfail|' + action,
      summary: 'An operator action did not complete: ' + action,
      detail: { action }
    });
    return send(res, 500, { error: 'action_failed',
      message: 'That did not complete. Check the account before trying again.' });
  }
}

async function refuse(res, db, audit, why) {
  await audit('refused', { why });
  return send(res, 400, { error: 'refused', message: why });
}
