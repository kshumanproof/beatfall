/* api/help.js, the only endpoint in Beatfall that answers somebody who is not
 * signed in.
 *
 * The questions worth asking of it are not "does it call the model". They are
 * the ones that turn into a support email if the answer is wrong:
 *
 *   Can somebody who cannot sign in reach it at all?
 *   Does it ever invent an answer, or does it hand over when it should?
 *   Is it a dead end when anything upstream breaks?
 *   Does the question somebody typed ever get written into the events table?
 *   Can one browser sit in a loop running up a bill on an open endpoint?
 */
import help from './api/help.real.js';
import { makeDb } from './fakedb.js';

const out = [];
const check = (n, ok, d) => { out.push({n, ok}); console.log((ok?'  PASS  ':'  FAIL  ')+n+(ok||!d?'':'\n          '+d)); };

function res(){ const r={code:0,body:null,headers:{},setHeader(k,v){r.headers[k]=v;},
  status(c){r.code=c;return r;},
  send(b){ try{r.body=JSON.parse(b);}catch(e){r.body=b;} return r;}}; return r; }

/* Anthropic, as far as this endpoint can tell. Records what it was asked so
   the suite can look at the instructions the model is actually given, and can
   be told to fail so the dead-end case is a thing that gets run. */
function upstream(text, opts = {}) {
  globalThis.__SENT__ = null;
  globalThis.fetch = async (url, init) => {
    globalThis.__SENT__ = JSON.parse(init.body);
    if (opts.down) throw new Error('network');
    if (opts.status) return { ok: false, status: opts.status, text: async () => 'nope' };
    return { ok: true, status: 200,
             json: async () => ({ content: [{ type: 'text', text }] }) };
  };
}

const ask = async (db, body) => {
  globalThis.__DB__ = db;
  const r = res();
  await help({ method: 'POST', headers: {}, body }, r);
  return r;
};

process.env.ANTHROPIC_API_KEY = 'sk-test-not-a-real-key';

// ---------- the material, for the page to draw
{
  globalThis.__DB__ = makeDb({}, { events: [] });
  const r = res();
  await help({ method: 'GET', headers: {}, url: '/api/help' }, r);
  check('the help page can read every answer', r.code === 200
    && Array.isArray(r.body.topics) && r.body.topics.length > 40,
    (r.body.topics || []).length + ' topics');
  check('and the order to show them in',
    Array.isArray(r.body.sections) && r.body.sections.length > 5,
    JSON.stringify((r.body.sections || []).slice(0, 3)));
  check('and it is cached, because it changes when the product does',
    /max-age/.test(r.headers['Cache-Control'] || ''), r.headers['Cache-Control']);
}

/* ---------- SOMEBODY WHO IS NOT SIGNED IN
 *
 * This is the whole reason the endpoint exists separately from every other
 * one. The likeliest reason a person writes to support is that they cannot
 * get in, and a help desk behind a sign-in is no use to them. No token, no
 * device header, no profile. */
{
  upstream('Type your email address and Beatfall sends you a six digit code.');
  const db = makeDb({}, { events: [] });
  const r = await ask(db, { question: "the code isn't arriving" });
  check('a signed out visitor gets an answer', r.code === 200 && !!r.body.answer,
    r.code + ' ' + JSON.stringify(r.body).slice(0, 120));
  check('and nothing about it needed an account',
    /six digit code/.test(r.body.answer), r.body.answer);
}

/* ---------- IT ANSWERS FROM THE WRITTEN MATERIAL AND NOWHERE ELSE */
{
  upstream('ok');
  const db = makeDb({}, { events: [] });
  await ask(db, { question: 'how do I add a new project?' });
  const sent = globalThis.__SENT__ || {};
  const sys = String(sent.system || '');
  check('the whole help document goes with every question',
    sys.length > 15000, sys.length + ' characters of instructions');
  check('and it contains the answer to the question asked',
    /How do I add a new project/.test(sys) && /press new project/i.test(sys), '');
  check('the model is told to answer only from it',
    /ANSWER ONLY FROM/i.test(sys) && /Never describe a button/i.test(sys), '');
  check('and told what to do when it cannot',
    /NO_ANSWER/.test(sys), '');
  check('sign-in questions are always pointed at a person as well',
    /signing in[\s\S]{0,200}support@beatfall\.app/i.test(sys), '');
  check('the house rules travel with it',
    /No em dashes/.test(sys) && /the writing help/.test(sys)
      && /Never say[\s\S]{0,40}AI/.test(sys), '');
  check('only the question is sent, and nothing about their work',
    (sent.messages || []).length === 1
      && sent.messages[0].content === 'how do I add a new project?',
    JSON.stringify(sent.messages));
}

/* ---------- NOT KNOWING IS A CORRECT ANSWER
 *
 * A support desk that invents a feature is worse than one that admits a gap:
 * the writer goes looking for a button that is not there, fails, and writes
 * in anyway with a grievance. */
{
  upstream('NO_ANSWER\nI do not have anything written down about co-writers.');
  const db = makeDb({}, { events: [] });
  const r = await ask(db, { question: 'can I share a board with my co-writer?' });
  check('a question nobody wrote an answer for is handed over',
    r.body.handoff === true, JSON.stringify(r.body));
  check('and the marker never reaches the person reading it',
    r.body.answer.indexOf('NO_ANSWER') < 0, r.body.answer);
  check('and the address comes with it', r.body.support === 'support@beatfall.app',
    r.body.support);
}
{
  upstream('Press New project on the dashboard.');
  const db = makeDb({}, { events: [] });
  const r = await ask(db, { question: 'how do i start a new script' });
  check('an answer it does have is not handed over', r.body.handoff === false,
    JSON.stringify(r.body));
}

/* ---------- NEVER A DEAD END
 *
 * Whatever breaks, the person is left with an address rather than a spinner
 * that stopped. Three ways to break it, one answer. */
{
  const db = makeDb({}, { events: [] });

  upstream('', { down: true });
  const a = await ask(db, { question: 'anything' });
  check('a connection that failed still answers with somewhere to go',
    a.code === 200 && a.body.handoff === true && /support@beatfall\.app/.test(a.body.answer),
    JSON.stringify(a.body));

  upstream('', { status: 529 });
  const b = await ask(db, { question: 'anything' });
  check('and so does a busy model', b.code === 200 && b.body.handoff === true,
    JSON.stringify(b.body));

  const key = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const c = await ask(db, { question: 'anything' });
  check('and so does a deployment with no key set at all',
    c.code === 200 && /support@beatfall\.app/.test(c.body.answer), JSON.stringify(c.body));
  process.env.ANTHROPIC_API_KEY = key;
}

/* ---------- WHAT SOMEBODY TYPED NEVER GOES INTO THE EVENTS TABLE
 *
 * That table holds counts, enums and booleans. A free text field on it is how
 * a promise in the Privacy Policy quietly stops being true, and a support box
 * is exactly where somebody pastes the thing that is worrying them. */
{
  upstream('NO_ANSWER\nnot written down');
  const db = makeDb({}, { events: [] });
  globalThis.__TRACKED__ = []; globalThis.__TRACKED_PROPS__ = [];
  await ask(db, { question: 'my card number is 4242 4242 4242 4242 and it failed',
                  anon: 'browser-1' });
  const props = (globalThis.__TRACKED_PROPS__ || []);
  const all = JSON.stringify(db.state.events) + JSON.stringify(globalThis.__TRACKED__)
            + JSON.stringify(props);
  check('the question itself is never written down anywhere',
    all.indexOf('4242') < 0, all.slice(0, 200));
  check('only whether it could be answered',
    props.some(p => p && p.answered === false), JSON.stringify(props));
}

/* ---------- AN OPEN ENDPOINT NEEDS A CEILING
 *
 * Free was never the problem. Unbounded is: with no account behind the
 * request there is nothing else in the way. */
{
  upstream('fine');
  const many = [];
  for (let i = 0; i < 40; i++) {
    many.push({ user_id: null, anon_id: 'loop', name: 'help_asked',
                created_at: new Date().toISOString() });
  }
  const db = makeDb({}, { events: many });
  /* makeDb seeds its own events table, so an array handed to it is quietly
     ignored. Set it afterwards or the ceiling has nothing to count. */
  db.state.events = many;
  const r = await ask(db, { question: 'again', anon: 'loop' });
  check('one browser cannot sit in a loop on it', r.code === 429, r.code);
  check('and is still told where to go', /support@beatfall\.app/.test(r.body.answer || ''),
    r.body.answer);

  const other = await ask(db, { question: 'again', anon: 'somebody-else' });
  check('while everybody else is unaffected', other.code === 200, other.code);
}

/* ---------- the shape of the request itself */
{
  upstream('fine');
  const db = makeDb({}, { events: [] });
  const empty = await ask(db, { question: '   ' });
  check('an empty question is refused rather than sent upstream', empty.code === 400,
    empty.code);

  const long = await ask(db, { question: 'x'.repeat(5000) });
  check('and a very long one is cut rather than sent whole',
    (globalThis.__SENT__.messages[0].content || '').length <= 400,
    (globalThis.__SENT__.messages[0].content || '').length + ' characters');

  const r = res();
  await help({ method: 'DELETE', headers: {} }, r);
  check('an unsupported method says so', r.code === 405, r.code);
}

const failed = out.filter(r => !r.ok);
console.log('\n' + (out.length - failed.length) + ' of ' + out.length + ' passed');
if (failed.length) process.exit(1);
