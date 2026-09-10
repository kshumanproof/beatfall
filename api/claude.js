// ============================================================================
// The metered Claude proxy.
//
// This is the only place the Anthropic key exists. The browser never sees it.
// Every call: verify the person, check their remaining credits, call Claude,
// then record exactly what it cost against their account.
// ============================================================================
import { requireUser, entitlement, charge, refund, send, readBody, COST, MODEL, PRICE_IN, PRICE_OUT, costMicros, TOPUP_CREDITS, TOPUP_PRICE, track } from './_lib/core.js';

// A hard ceiling per call, so one runaway request can't cost a fortune.
const MAX_INPUT_CHARS = 60000;
// And a ceiling on how MANY turns, because the one above is a total and a
// thousand empty-ish messages is still a thousand messages to serialise.
const MAX_INPUT_TURNS = 40;
const MAX_OUTPUT_TOKENS = 1400;
// Reading a notes folder returns a classification per note. 1400 tokens
// truncated those replies into unparseable JSON, which the board then papered
// over by guessing. Give that one job room.
const OUTPUT_CAP = { import: 6000 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });

  const auth = await requireUser(req);
  if (auth.error) return send(res, auth.status, { error: auth.error });
  const { db, user, profile } = auth;

  const body = await readBody(req);
  const kind = String(body.kind || 'conversation');
  const session = typeof body.session === 'string' ? body.session.slice(0, 60) : null;
  // COST is an object literal, so COST['toString'] is a function rather than
  // undefined and `?? 1` never fires. An unknown kind is a bug or an attempt,
  // and either way it is not something to guess a price for.
  const known = Object.prototype.hasOwnProperty.call(COST, kind);
  if (!known) return send(res, 400, { error: 'bad_request', message: 'Unknown action.' });
  let credits = COST[kind];

  /* A multi-turn feature sends the same session id on every call. The first one
     pays; the rest of the conversation is free.

     That used to be the whole rule, and the browser chooses the id, so it was a
     permanent free tier: send the same word every time and only the very first
     action ever cost anything. Worse, a usage row was written with the id even
     for the free actions, so placing one note - free by design - planted the
     row that made every import afterwards free too.

     Three things bound it now. The earlier call must have been the SAME KIND,
     so a conversation cannot pay for an import. It must be RECENT, because no
     real conversation spans a day. And there is a CEILING on how many turns one
     payment covers: the interview asks at most ten questions and writes once,
     so twenty is generous and unlimited is not a number. */
  const SESSION_HOURS = 8;
  /* The ceiling is per kind, because the kinds are not the same size. A
     conversation is capped at ASK_LIMIT questions and a character interview at
     ten and a write-up, so a couple of dozen is already far beyond either.

     An import is a different animal: it reads the file in batches of forty,
     runs a top-level pass, and reads the board three times over. A thousand
     notes is twenty-six calls before anything goes wrong, and a first cut at
     twenty here would have charged a big file twice. The number below is not a
     rate limit, it is a bound on how long one payment can be reused, and it
     needs to be comfortably past the largest honest run. */
  const SESSION_MAX_TURNS = kind === 'import' ? 150 : 24;
  if (credits > 0 && session) {
    const since = new Date(Date.now() - SESSION_HOURS * 3600 * 1000).toISOString();
    /* Two questions, and the first one is the one that matters. Has this
       session ever been PAID for? A free call must never be the row that makes
       a later paid call free, which is how placing one note bought every import
       afterwards. Requiring credits > 0 on the earlier row is what closes it,
       and it means the free rows can carry the session id again - which the
       count below needs, and which an earlier attempt at this took away and
       thereby made its own ceiling unreachable. */
    const { data: paid } = await db.from('usage')
      .select('id').eq('user_id', user.id).eq('session_id', session)
      .eq('kind', kind).gt('credits', 0).gte('created_at', since).limit(1);
    if (paid && paid.length) {
      // And then: how much has already ridden on that one payment.
      const { count } = await db.from('usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('session_id', session)
        .eq('kind', kind).gte('created_at', since);
      if ((count || 0) <= SESSION_MAX_TURNS) credits = 0;
    }
  }

  const ent = entitlement(profile);

  if (ent.key === 'none') {
    return send(res, 402, {
      error: 'no_plan',
      message: 'Your trial has ended. Pick a plan to keep going. Your boards and '
             + 'notes are untouched.'
    });
  }
  if (credits > 0 && ent.left < credits) {
    // Running out is a product event, not just an error. Whether writers hit
    // this at all, and on which feature, decides whether 150 is the right
    // number.
    track(db, user.id, 'credits_exhausted', { credit_bucket: 'all', kind: body.kind });
    return send(res, 402, {
      error: 'out_of_credits',
      message: `That's all ${ent.monthly} of this month's credits. They come back on the 1st, `
             + `or ${TOPUP_CREDITS} more is $${TOPUP_PRICE} and those never expire. `
             + `Everything except the writing help keeps working.`,
      used: ent.used, allowance: ent.monthly, banked: ent.banked
    });
  }

  // ---- build the request -------------------------------------------------
  /* The ceiling is on the whole call, not on each message. It used to be per
     message with no limit on how many, so two hundred of them was about three
     dollars of spend for one credit, and the comment above claiming a runaway
     request could not cost a fortune was not true.

     The last turns are the ones that matter in a conversation, so the budget is
     spent from the end backwards and the oldest turns fall off first. */
  let messages;
  if (Array.isArray(body.input)) {
    const clean = body.input
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_INPUT_TURNS);
    let budget = MAX_INPUT_CHARS;
    const kept = [];
    for (let i = clean.length - 1; i >= 0 && budget > 0; i--) {
      const content = clean[i].content.slice(0, budget);
      // An empty message is nothing to send, not a reason to throw away every
      // older turn behind it.
      if (!content) { if (!clean[i].content) continue; break; }
      budget -= content.length;
      kept.unshift({ role: clean[i].role, content });
    }
    // Anthropic refuses a conversation that opens on the assistant, and
    // filling from the newest backwards can stop anywhere. Trimming the front
    // is right: those are the oldest turns, which is what the budget was
    // dropping anyway.
    while (kept.length && kept[0].role !== 'user') kept.shift();
    messages = kept;
  } else {
    messages = [{ role: 'user', content: String(body.input || '').slice(0, MAX_INPUT_CHARS) }];
  }
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return send(res, 400, { error: 'bad_request', message: 'Nothing to send.' });
  }

  /* The charge happens HERE, before the upstream call, and this is the whole
     point of it.

     A check at the start and a debit at the end is not metering. Twenty
     parallel requests with one credit left all passed the check, all called
     Anthropic, and all wrote the same ending balance: one credit's income
     against twenty calls' cost. Making the debit conditional fixed the number
     and not the spending, because by then the work was already done.

     Taking it first means a request that cannot pay never reaches Anthropic.
     The duty that comes with it is below: if the work then fails, the credits
     go straight back. */
  let charged = null;
  if (credits > 0) {
    charged = await charge(db, user.id, profile, ent, credits);
    if (!charged.ok) {
      if (charged.reason === 'insufficient') {
        track(db, user.id, 'credits_exhausted', { credit_bucket: 'all', kind: body.kind });
        return send(res, 402, {
          error: 'out_of_credits',
          message: `That's all ${ent.monthly} of this month's credits. They come back on the 1st, `
                 + `or ${TOPUP_CREDITS} more is $${TOPUP_PRICE} and those never expire. `
                 + `Everything except the writing help keeps working.`,
          used: ent.used, allowance: ent.monthly, banked: ent.banked
        });
      }
      console.error('could not charge, refusing the call', user.id, kind, charged.reason);
      return send(res, 503, {
        error: 'busy',
        message: "Couldn't start that just now. Nothing has been charged. Try again in a moment."
      });
    }
  }

  const giveBack = async () => {
    if (!charged || !charged.ok) return;
    const back = await refund(db, user.id, charged.took);
    if (!back.ok) {
      console.error('REFUND FAILED', user.id, kind, credits);
      track(db, user.id, 'refund_failed', { kind, credit_amount: credits });
    }
  };

  let reply;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: (cap => Math.min(cap, body.maxTokens || cap))(OUTPUT_CAP[kind] || MAX_OUTPUT_TOKENS),
        messages
      })
    });
    if (!r.ok) {
      const detail = await r.text();
      console.error('anthropic error', r.status, detail.slice(0, 400));
      track(db, user.id, 'ai_request_failed', { operation: body.kind, status: r.status,
                                                error_code: 'upstream' });
      await giveBack();
      return send(res, 502, {
        error: 'upstream',
        message: r.status === 429
          ? 'Busy just now. Try that again in a moment.'
          : "Couldn't get an answer just now."
      });
    }
    reply = await r.json();
  } catch (e) {
    console.error('anthropic fetch failed', e);
    track(db, user.id, 'ai_request_failed', { operation: body.kind, error_code: 'network' });
    await giveBack();
    return send(res, 502, { error: 'upstream', message: "Couldn't get an answer just now." });
  }

  const text = (reply.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  const tin  = reply.usage?.input_tokens  || 0;
  const tout = reply.usage?.output_tokens || 0;

  // ---- record what it cost ----------------------------------------------
  await db.from('usage').insert({
    // Every row carries the session id, free or not, because the ceiling above
    // counts them. What stops a free row buying anything is the `credits > 0`
    // condition on the lookup, not the absence of an id here.
    user_id: user.id, kind, credits, model: MODEL, session_id: session,
    tokens_in: tin, tokens_out: tout, cost_micros: costMicros(tin, tout)
  });
  /* Already paid for, before any of this ran. So the balance to report is the
     one the charge actually produced, not a subtraction from the figure this
     request happened to read on the way in - which is wrong the moment anything
     else moved it, and was wrong outright whenever the charge did not apply. */
  const after = (charged && charged.ok && charged.profile)
    ? entitlement(charged.profile) : ent;
  const monthlyLeft = after.monthlyLeft;
  const banked      = after.banked;
  return send(res, 200, {
    text,
    credits_left: monthlyLeft + banked,
    monthly_left: monthlyLeft,
    banked,
    allowance: ent.monthly
  });
}
