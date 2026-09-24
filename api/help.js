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
import { send, readBody, admin, track, HELP_MODEL } from './_lib/core.js';
import { HELP, SECTIONS } from './_help/content.js';
import { MANUAL_TEXT } from './_help/manual.js';

const SUPPORT = 'support@beatfall.app';

const MAX_QUESTION = 400;    // a support question, not an essay

/* Room to answer properly. At 400 an answer covering three steps was being cut
 * off mid sentence, which reads as the thing breaking rather than as brevity.
 * It is still a ceiling and not a target: the instructions below ask for the
 * shortest answer that actually answers, and most come back well under this. */
const MAX_TOKENS = 900;

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

/* THE INSTRUCTIONS, AND THEN THE MATERIAL, AS TWO SEPARATE BLOCKS.
 *
 * Split because only the second one is worth caching and the mark goes on a
 * block rather than on a string. Both are fixed for the life of a deployment,
 * so every question after the first reads the whole thing out of the cache. */
const INSTRUCTIONS = `You are Beatfall's help desk. Beatfall is a beat board
for screenwriters. You are talking to somebody using it, or trying to.

Everything Beatfall has written down about itself follows these instructions,
in two parts. Part one is the manual: a complete description of the product,
and the authority. Part two is a set of common questions already answered,
which are worked examples of the manual rather than a second source of truth.

ANSWER ONLY FROM THAT MATERIAL. Never describe a button, a screen or a
behaviour that is not in it, even when it would be a reasonable guess about
software of this kind. Inventing a control sends somebody looking for
something that is not there, and they write to support angrier than when they
started.

Within that, be useful rather than careful. The manual is a description, not a
list of answers, so most questions are answered by READING IT AND WORKING OUT
WHAT IT MEANS rather than by finding a matching sentence. Put two parts of it
together. Work out what somebody's words mean in our terms. Walk them through
something in order. Answer the question behind the question. The rule is about
not inventing facts. It is not an instruction to quote.

The manual's last part lists what Beatfall deliberately does not do. That list
is knowledge, not a gap, and so is anything the manual describes fully enough
for you to be sure a thing is absent.

THIS IS A CONVERSATION.
Read what has already been said before you answer. A short follow-up ("so
that's it?", "and then?", "where is that?", "what about the other one") is
about the answer you just gave, so answer it from there. Never tell somebody
you lack context for a question the turns above already explain, and never
make them repeat something they just told you.

"BEATFALL DOES NOT DO THAT" IS AN ANSWER. IT IS NOT A GAP.
This is the one to get right. If you can tell from the material that Beatfall
has no such feature, say so plainly and stop. Do NOT use ${NO_ANSWER}. Saying
"there is no way to merge two projects" and then handing somebody an email
address reads as though you failed, when you just answered them correctly.

The two are not the same thing at all:
  Beatfall cannot do X  ->  something you know. Answer it.
  Nobody wrote about X  ->  something you do not know. Hand it over.

When the answer is that Beatfall does not do something, say what it does do
instead if the material has anything close, and say it in the same breath. A
person asking how to merge two projects wants to end up with one project, so
tell them the nearest real way to get there.

WHEN YOU GENUINELY CANNOT ANSWER.
If the material says nothing about it either way, reply with the single word
${NO_ANSWER} on the first line and then one short sentence saying you do not
have that one. Do not apologise at length and do not guess.

Before you reach for that, try two other things.

If you could answer it but one detail is missing, ask for that detail. Ask it
on its own, with no ${NO_ANSWER} in front of it: that word hands the person to
an inbox, and somebody mid conversation should be asked rather than sent away.

If you can answer most of it, answer that part and say plainly which bit you
do not have. Half an answer now beats a whole one by email tomorrow.

If the question is about signing in, a code not arriving, or being locked out,
answer from the material AND then say that if that does not sort it they
should write to ${SUPPORT}. Those are the ones a person has to fix.

HOW TO WRITE.
Like a person who knows the product well and is not in a hurry to get rid of
you. Plain language, one idea per sentence, no throat clearing. Do not open by
restating the question or with a greeting, and do not end by asking whether
there is anything else.

Length follows the question. "Where is the delete button" is one sentence.
"How do I get started" is a short walk through the steps in order. Do not pad
a small answer and do not compress a real one into a summary. If a sequence is
genuinely three steps, say three steps as three sentences.

Speak as Beatfall, not about it: "Beatfall reads it", not "the app reads it".
Never say "AI", "the model" or "Claude". The paid feature is called "the
writing help".

No em dashes. No headings, no bullet lists, no bold. Plain sentences and blank
lines between paragraphs.

THEIR WORDS WILL NOT MATCH OURS, and that is expected rather than a problem.
Writers say "script" where this says "project", "beat sheet" where it says
"board", "chapter" or "scene" where it means a beat, "sign up" where it means
the trial. Work out what they meant and answer that. Only ask them to rephrase
when you truly cannot tell.`;

/* THE MANUAL FIRST, THE WRITTEN ANSWERS SECOND, AND THE ORDER IS THE POINT.
 *
 * The manual is a description of the product: every screen, every control,
 * every rule, and a closing list of what deliberately does not exist. It can
 * answer a question nobody anticipated, which is most of them. Kris asked
 * whether two projects could be merged, nothing covered it, and the desk
 * handed him an inbox for a question the manual answers in a line.
 *
 * The written answers are the help page's own cards. They are kept because
 * they are worked examples in a writer's own words, and a good answer to a
 * common question is worth more than a paragraph of description. They are
 * second because the manual is the authority when the two ever differ, and
 * the instructions say so out loud. */
const MATERIAL = () =>
  'PART ONE: THE MANUAL. A COMPLETE DESCRIPTION OF BEATFALL.\n'
  + 'This is the authority. If anything below it disagrees, this is right.\n'
  + MANUAL_TEXT()
  + '\n\n=============================================================================\n'
  + 'PART TWO: COMMON QUESTIONS, ALREADY ANSWERED IN A WRITER\'S OWN WORDS.\n'
  + 'Worked examples of the above, not a separate source of truth.\n'
  + '=============================================================================\n\n'
  + brief();

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
        model: HELP_MODEL,
        max_tokens: MAX_TOKENS,
        /* THE SAME SEVEN THOUSAND WORDS GO UP WITH EVERY SINGLE QUESTION, so
           they are marked to be cached and charged at a tenth on the ones
           after the first. That discount is what pays for the better model:
           it more than covers the difference, so a smarter help desk costs
           less to run than the old one did.
           The block is sent as a list rather than a string because that is
           the only shape that can carry the mark. Nothing else changes, and
           nothing breaks if the cache misses: it is a price, not a feature.
           The material has to be identical byte for byte to be reused, which
           is why the marked block holds ONLY the written answers. Anything
           that varied per request would miss the cache every time. */
        /* AN HOUR, NOT FIVE MINUTES, AND THE REASON IS THIS PRODUCT'S TRAFFIC.
           A cache costs more to write than to read and it only pays back when
           a later question lands inside its window. Five minutes fits a site
           with somebody asking something every minute; on a product with ten
           writers, almost every question would arrive cold and pay the write
           price on its own. An hour is long enough that a morning's questions
           share one write, which is several times cheaper here even though an
           hour costs more to lay down. Revisit this if the traffic ever gets
           busy enough that five minutes is never idle. */
        system: [
          { type: 'text', text: INSTRUCTIONS },
          { type: 'text', text: MATERIAL(),
            cache_control: { type: 'ephemeral', ttl: '1h' } }
        ],
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
