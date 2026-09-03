// ============================================================================
// The metered Claude proxy.
//
// This is the only place the Anthropic key exists. The browser never sees it.
// Every call: verify the person, check their remaining credits, call Claude,
// then record exactly what it cost against their account.
// ============================================================================
import { requireUser, entitlement, send, readBody, COST, MODEL, PRICE_IN, PRICE_OUT, costMicros } from './_lib/core.js';

// A hard ceiling per call, so one runaway request can't cost a fortune.
const MAX_INPUT_CHARS = 60000;
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
  let credits = COST[kind] ?? 1;

  // A multi-turn feature sends the same session id on every call. The first
  // one pays; the rest of the conversation is free. Checked server-side so it
  // can't be gamed from the browser.
  if (credits > 0 && session) {
    const { data: already } = await db.from('usage')
      .select('id').eq('user_id', user.id).eq('session_id', session).limit(1);
    if (already && already.length) credits = 0;
  }

  const ent = entitlement(profile);

  if (ent.key === 'none') {
    return send(res, 402, {
      error: 'no_plan',
      message: 'Your trial has ended. Pick a plan to keep using the writing help. '
             + 'your boards and notes are untouched, and everything except the AI still works.'
    });
  }
  if (credits > 0 && ent.left < credits) {
    return send(res, 402, {
      error: 'out_of_credits',
      message: `You've used all ${ent.allowance} of this month's credits. They reset on the 1st, `
             + `or you can top up. Everything except the AI keeps working in the meantime.`,
      used: ent.used, allowance: ent.allowance
    });
  }

  // ---- build the request -------------------------------------------------
  let messages;
  if (Array.isArray(body.input)) {
    messages = body.input
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_INPUT_CHARS) }));
  } else {
    messages = [{ role: 'user', content: String(body.input || '').slice(0, MAX_INPUT_CHARS) }];
  }
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return send(res, 400, { error: 'bad_request', message: 'Nothing to send.' });
  }

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
      return send(res, 502, {
        error: 'upstream',
        message: r.status === 429
          ? 'Busy just now. Try that again in a moment.'
          : "Couldn't reach Claude just now."
      });
    }
    reply = await r.json();
  } catch (e) {
    console.error('anthropic fetch failed', e);
    return send(res, 502, { error: 'upstream', message: "Couldn't reach Claude just now." });
  }

  const text = (reply.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  const tin  = reply.usage?.input_tokens  || 0;
  const tout = reply.usage?.output_tokens || 0;

  // ---- record what it cost ----------------------------------------------
  await db.from('usage').insert({
    user_id: user.id, kind, credits, model: MODEL, session_id: session,
    tokens_in: tin, tokens_out: tout, cost_micros: costMicros(tin, tout)
  });
  if (credits > 0) {
    await db.from('profiles')
      .update({ credits_used: (profile.credits_used || 0) + credits })
      .eq('id', user.id);
  }

  return send(res, 200, {
    text,
    credits_left: Math.max(0, ent.left - credits),
    allowance: ent.allowance
  });
}
