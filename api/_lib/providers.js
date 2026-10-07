// ============================================================================
// TWO READERS, ONE SHAPE.
//
// Beatfall asks a model to do one job: read a writer's notes and judge where
// they belong. Which company answers that is a question about reading
// judgement, and the only honest way to settle it is to put the identical
// question to both and look at the answers.
//
// So this file is deliberately thin. It holds the two transports and nothing
// else. Everything that decides whether a call may happen at all - who the
// person is, whether they have a plan, what it costs, taking the credits
// before the work and giving them back when it fails - stays in claude.js
// where it already is and is already tested. A provider swap must not become
// a second copy of the metering, because then there are two of them and one
// will quietly be wrong.
//
// THE MESSAGES ARE NOT TOUCHED HERE. They arrive cleaned, trimmed and
// role-checked, and both transports send exactly those. The moment this file
// starts rewriting a prompt to suit one provider, the comparison stops
// measuring the thing it was built to measure.
// ============================================================================
import { PROVIDER_PRICES, costMicrosFor } from './core.js';

export const DEFAULT_PROVIDER = 'claude';

export const knownProvider = name =>
  Object.prototype.hasOwnProperty.call(PROVIDER_PRICES, String(name || ''));

/* WHICH READER ANSWERS THIS CALL. Claude, unless three things are all true.
 *
 * Two locks rather than one, and they are independent on purpose. The flag is
 * set only on the testing deployment, so production has no way to reach the
 * second provider whatever a browser sends. The admin check is because the
 * testing deployment points at the real database, so an ordinary writer who
 * found their way onto it is still a real person with real boards and must get
 * the real product.
 *
 * Note what is NOT accepted: a model name, a URL, a key, a temperature. The
 * browser chooses between two words this file already knows. Anything else it
 * sends is ignored rather than argued with, because the safe answer to an
 * unrecognised provider is the one Beatfall actually runs on. */
export function providerFor(body, profile) {
  const want = String((body && body.provider) || '');
  if (!want || want === DEFAULT_PROVIDER)       return DEFAULT_PROVIDER;
  if (process.env.BEATFALL_TESTING !== '1')     return DEFAULT_PROVIDER;
  if (!profile || !profile.is_admin)            return DEFAULT_PROVIDER;
  if (!knownProvider(want))                     return DEFAULT_PROVIDER;
  return want;
}

export const testingEnabled = () => process.env.BEATFALL_TESTING === '1';

/* ---------------------------------------------------------------- Claude --
   Unchanged from the day it was written, moved rather than rewritten. */
async function callClaude({ model, messages, maxTokens }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages })
  });
  if (!r.ok) return { ok: false, status: r.status, detail: await r.text() };
  const reply = await r.json();
  return {
    ok: true,
    text: (reply.content || []).filter(c => c.type === 'text')
            .map(c => c.text).join(''),
    tin:  reply.usage?.input_tokens  || 0,
    tout: reply.usage?.output_tokens || 0,
    reasoning: 0,
    /* It ran out of room rather than finishing. The endpoint has always
       reported truncated:false to the browser whatever happened, so a reply
       cut into unparseable JSON looked exactly like a reply that said nothing
       useful. Both providers answer this now. */
    truncated: reply.stop_reason === 'max_tokens'
  };
}

/* ---------------------------------------------------------------- OpenAI --
   The Responses API. `store: false` because these are a writer's notes and
   there is no reason for a copy of them to sit on somebody's server for thirty
   days; Beatfall's privacy page says what happens to this material and a
   retained copy is not in it. */
async function callOpenAI({ model, messages, maxTokens }) {
  if (!process.env.OPENAI_API_KEY) {
    /* Said plainly rather than sent as "Bearer undefined", which comes back as
       a 401 and reads like a bad key instead of a missing one. */
    return { ok: false, status: 503, detail: 'OPENAI_API_KEY is not set here' };
  }
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + process.env.OPENAI_API_KEY
    },
    body: JSON.stringify({
      model,
      input: messages,
      max_output_tokens: maxTokens,
      store: false
    })
  });
  if (!r.ok) return { ok: false, status: r.status, detail: await r.text() };
  const reply = await r.json();

  const tout = reply.usage?.output_tokens || 0;
  /* REASONING IS BILLED AS OUTPUT AND IS SPENT FROM THE SAME BUDGET.
     So the same number in max_output_tokens does not buy the same amount of
     visible writing on a model that thinks first, and a cap that was generous
     for one can leave the other with nothing left to say. It is recorded
     separately rather than assumed to be zero, because "the reply was empty"
     and "the reply was empty because the budget went on thinking" are
     different findings and only one of them is about reading judgement. */
  const reasoning = reply.usage?.output_tokens_details?.reasoning_tokens || 0;

  return {
    ok: true,
    text: textFrom(reply),
    tin: reply.usage?.input_tokens || 0,
    tout,
    reasoning,
    truncated: reply.status === 'incomplete'
  };
}

/* The visible answer, out of a reply that also carries the model's thinking
   and whatever else it decided to put in the list. Walked defensively: a shape
   that gains an item type should cost this a dropped field, never a throw in
   the middle of a paid call. */
function textFrom(reply) {
  if (typeof reply.output_text === 'string' && reply.output_text) {
    return reply.output_text;
  }
  const out = Array.isArray(reply.output) ? reply.output : [];
  return out
    .filter(item => item && item.type === 'message')
    .flatMap(item => Array.isArray(item.content) ? item.content : [])
    .filter(part => part && typeof part.text === 'string')
    .map(part => part.text)
    .join('');
}

/* ONE RESULT, WHOEVER ANSWERED.
 *
 * { ok, text, model, provider, tin, tout, reasoning, truncated, costMicros }
 * on success, { ok: false, status, detail } on a refusal upstream. A thrown
 * fetch is the caller's to catch, exactly as it was before this file existed,
 * because the caller is what holds the credits that have to go back. */
export async function callProvider(provider, { messages, maxTokens }) {
  const spec = PROVIDER_PRICES[provider] || PROVIDER_PRICES[DEFAULT_PROVIDER];
  const args = { model: spec.model, messages, maxTokens };
  const r = provider === 'openai' ? await callOpenAI(args) : await callClaude(args);
  if (!r.ok) return r;
  return Object.assign(r, {
    provider,
    model: spec.model,
    costMicros: costMicrosFor(provider, r.tin, r.tout)
  });
}
