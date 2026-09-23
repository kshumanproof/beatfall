// ============================================================================
// The help desk.
//
// Two jobs. GET hands the help page everything Beatfall knows about itself so
// the page can draw it. POST takes a question in a writer's own words and
// answers it from that same material.
//
// FOUR RULES SHAPE IT.
//
//   NO ACCOUNT IS NEEDED. This is the only endpoint in Beatfall that answers
//   somebody who is not signed in, and it has to be: the single most likely
//   reason a person writes to support is that they cannot get in, and a help
//   desk you have to sign in to reach is no use to them. A lapsed plan is the
//   same case from the other side. Somebody whose boards just closed is
//   exactly the person asking why.
//
//   IT ANSWERS ONLY FROM WHAT IS WRITTEN DOWN. Everything it may say lives in
//   _help/content.js and nowhere else. A support answer that invents a feature
//   is worse than no answer at all: the writer goes looking for a button that
//   does not exist, fails, and writes to support anyway with a grievance.
//
//   THE WHOLE DOCUMENT GOES EVERY TIME. There is no search step and no picking
//   of relevant entries, because that step is where these things usually go
//   wrong: the search finds the wrong page and the answer is then confidently
//   built on it. At about seven thousand tokens the entire help fits in one
//   request for well under a penny, so the question never has to be matched
//   against anything. It is simply read.
//
//   NOT KNOWING IS A CORRECT ANSWER. When the material does not cover it, this
//   says so and hands over the support address. That is the desk working, not
//   failing, and the questions it cannot answer are the most useful thing it
//   produces: they say what to write next.
// ============================================================================
import { send, readBody, admin, track, MODEL } from './_lib/core.js';
import { HELP, SECTIONS } from './_help/content.js';

const SUPPORT = 'support@beatfall.app';

const MAX_QUESTION = 400;    // a support question, not an essay
const MAX_TOKENS   = 400;    // a support answer, not an essay either

/* THE CONVERSATION HAS TO REMEMBER ITSELF.
 *
 * Kris asked how to make a project, read the answer, and then typed "so that's
 * it? that's all i have to do?" It came back saying it did not have enough
 * context and handed him the support address, because every question used to
 * be sent on its own with nothing before it. That is not a help desk, it is a
 * vending machine, and the follow-up is the most natural thing a person types.
 *
 * So the turns before it go with each question. Eight entries is four
 * exchanges, which covers the follow-ups that actually happen ("so that's
 * it?", "and then?", "where is that button") without carrying a whole
 * afternoon into every request. Old turns fall off the front.
 *
 * The thread lives in the browser and nowhere else. Nothing here is written to
 * the database and nothing is remembered between visits: closing the panel and
 * coming back tomorrow starts clean. */
const MAX_TURNS = 8;
const MAX_TURN_CHARS = 700;

/* A BOUNDED FREE THING, the same shape as the free board actions.
 *
 * Free was never the problem and is not in question: charging somebody a
 * credit to ask how the app works would send them straight back to email,
 * which is the thing this exists to prevent. Unbounded is the problem. With no
 * account behind the request there is nothing else standing in the way.
 *
 * Counted against the browser's own id, which a determined person could
 * obviously forge. That is accepted: this stops a runaway loop and casual
 * misuse, the question and the answer are both capped, and the real ceiling is
 * that one question costs under a penny. */
const ASKS_PER_HOUR = 30;

/* WHEN NOT KNOWING IS THE ANSWER, IT SAYS THIS FIRST.
 *
 * A marker on its own line rather than JSON, because the reply is prose being
 * read by a person and asking for structure around it is a second thing to go
 * wrong. The server takes the line off and raises the hand-off; the writer
 * never sees it. */
const NO_ANSWER = 'NO_ANSWER';

function brief() {
  return HELP.map(h => 'Q: ' + h.q + '\nA: ' + h.a).join('\n\n---\n\n');
}

/* WHAT ARRIVES HERE IS WHATEVER THE BROWSER SENT, so it is rebuilt rather than
 * trusted. The conversation must alternate, must begin with the person and
 * must end with an answer before the new question goes on the end, or the
 * request is refused upstream and the writer gets a failure instead of a
 * reply. Anything that does not fit that shape is simply dropped: a turn
 * missing from the history is a worse answer, a malformed request is no answer
 * at all. */
function past(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  let want = 'user';
  raw.slice(-MAX_TURNS).forEach(m => {
    if (!m || m.role !== want) return;
    const text = String(m.content == null ? '' : m.content).trim().slice(0, MAX_TURN_CHARS);
    if (!text) return;
    out.push({ role: want, content: text });
    want = want === 'user' ? 'assistant' : 'user';
  });
  // A trailing question with no answer under it would sit next to the new one.
  if (out.length && out[out.length - 1].role === 'user') out.pop();
  return out;
}

const SYSTEM = () => `You answer questions about Beatfall, a beat board for
screenwriters, for people using it. You are its help desk.

Below is everything Beatfall has written down about itself. ANSWER ONLY FROM
IT. Never describe a button, a screen or a behaviour that is not in this
material, even if it would be a reasonable guess about software of this kind.
Inventing a control sends somebody looking for something that is not there.

You are in the middle of a conversation, so read what has already been said
before you answer. A short follow-up ("so that's it?", "and then?", "where is
that?", "what about the other one") is about the answer you just gave. Answer
it from there. Never say you lack context for a question the turns above
already explain, and never make somebody repeat what they just told you.

If the material does not answer the question, reply with the single word
${NO_ANSWER} on the first line and then one short sentence saying you do not
have that one. Do not apologise at length and do not guess.

If you could answer it but one detail is missing, ask for that detail instead.
Ask the question on its own, with no ${NO_ANSWER} in front of it: that word
hands the person to an inbox, and somebody who is mid conversation should be
asked rather than sent away. Use it only when the material genuinely does not
cover what they want.

If the question is about signing in, a sign-in code not arriving, or being
locked out, answer from the material AND then say plainly that if that does
not sort it they should write to ${SUPPORT}, because those are the ones a
person has to fix.

HOW TO WRITE:
Plain language, short. One idea per sentence. Two or three sentences is
usually right and six is too many. Speak as Beatfall, not about it. Never say
"AI", "the model" or "Claude": the paid feature is called "the writing help".
No em dashes. No headings, no bullet lists, no bold. Just say the thing.
Do not open by restating the question or with a greeting.

Their words will not match the wording here, and that is expected. Writers say
"script" where this says "project" and "beat sheet" where it says "board".
Answer the question they meant.

THE MATERIAL:

${brief()}`;

export default async function handler(req, res) {
  // ------------------------------------------------------- the material --
  /* The page draws itself from this rather than carrying its own copy of the
     answers, so the page and the chat can never come to disagree about how
     Beatfall works. Cached, because it changes when the product does and not
     when somebody opens the page. */
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    return send(res, 200, { sections: SECTIONS, topics: HELP, support: SUPPORT });
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'method' });

  const body = await readBody(req);
  const question = String((body && body.question) || '').trim().slice(0, MAX_QUESTION);
  if (!question) return send(res, 400, { error: 'bad_request' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return send(res, 200, {
      answer: 'The help chat is not available just now. Write to ' + SUPPORT
            + ' and somebody will answer.',
      handoff: true
    });
  }

  const db = admin();

  /* Who is asking, as far as anything here can tell. `who` is the browser's
     own id, which every Beatfall page already has, and it is used for the
     hourly count and nothing else. A signed-in writer's id is passed through
     when the page has one, purely so the count follows the person rather than
     the browser they happen to be on. */
  const who = String((body && body.anon) || '').slice(0, 64) || null;
  const user = String((body && body.user) || '').slice(0, 64) || null;

  if (who) {
    const since = new Date(Date.now() - 3600000).toISOString();
    const { count } = await db.from('events')
      .select('id', { count: 'exact', head: true })
      .eq('anon_id', who).eq('name', 'help_asked').gte('created_at', since);
    if ((count || 0) >= ASKS_PER_HOUR) {
      return send(res, 429, {
        answer: 'That is a lot of questions in one hour. Give it a little while, '
              + 'or write to ' + SUPPORT + ' and somebody will answer properly.',
        handoff: true
      });
    }
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
        max_tokens: MAX_TOKENS,
        system: SYSTEM(),
        messages: past(body && body.history).concat([{ role: 'user', content: question }])
      })
    });
    if (!r.ok) {
      console.error('help upstream', r.status, (await r.text()).slice(0, 300));
      throw new Error('upstream');
    }
    reply = await r.json();
  } catch (e) {
    /* Never a dead end. Something upstream being busy is not the writer's
       problem to solve, and the address is the answer either way. */
    return send(res, 200, {
      answer: "Couldn't get an answer just now. Try again in a moment, or write to "
            + SUPPORT + ' and somebody will read it.',
      handoff: true
    });
  }

  let text = (reply.content || []).filter(c => c.type === 'text')
    .map(c => c.text).join('').trim();

  const handoff = text.indexOf(NO_ANSWER) === 0;
  if (handoff) text = text.slice(NO_ANSWER.length).trim();
  if (!text) {
    text = 'I do not have an answer to that one written down.';
  }

  /* WHAT IT COULD NOT ANSWER IS THE POINT OF MEASURING THIS.
   *
   * The count says how often the desk works. It carries no question text and
   * never will: the events table holds counts, enums and booleans, and a free
   * text field on it would be a promise in the Privacy Policy quietly becoming
   * untrue. To read the questions themselves rather than the tally, they need
   * somewhere of their own to live.
   *
   * The unanswered ones also go to the server log, which is the cheapest place
   * they can be read today. */
  track(db, user, 'help_asked', { answered: !handoff },
        who ? { anon_id: who } : {});
  if (handoff) console.log('help had no answer for:', question.slice(0, 200));

  return send(res, 200, { answer: text, handoff, support: SUPPORT });
}
