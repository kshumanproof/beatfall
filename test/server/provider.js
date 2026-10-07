/* TWO READERS, ONE ENDPOINT.
 *
 * Beatfall runs on Claude. A second provider exists here so the same prompts
 * can be put to a different reader and the answers compared, and that
 * comparison is only worth anything if two things hold: the second reader is
 * unreachable from the live site, and both readers are handed the identical
 * question.
 *
 * So the checks below are mostly about doors rather than about models. The
 * transport is the REAL api/_lib/providers.js, with globalThis.fetch standing
 * in for the network the way every other suite here does, which means the
 * request body these assert on is the one that would go over the wire.
 */
import handler from './api/claude.real.js';
import { COST, PROVIDER_PRICES, costMicrosFor, MODEL, OPENAI_MODEL }
  from './api/_lib/core.js';
import { DEFAULT_PROVIDER } from './api/_lib/providers.js';

/* WHICH ONE IS THE DEFAULT IS NOT TYPED HERE.
 *
 * Beatfall ran on Claude, then on OpenAI, and may yet run on something else.
 * Nine checks in this file used to name Claude where what they actually meant
 * was "whichever one Beatfall runs on", and all nine went red on the day of the
 * switch for the one reason a test must never fail: the test was the thing out
 * of date. They read the constant now. Where a check really is about a
 * specific provider's wire format, it still names it. */
const OTHER = DEFAULT_PROVIDER === 'openai' ? 'claude' : 'openai';
const MODEL_OF = { claude: MODEL, openai: OPENAI_MODEL };
import { makeDb } from './fakedb.js';

const out = [];
const check = (n, ok, d) => {
  out.push({ n, ok });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (ok || !d ? '' : '\n          ' + d));
};

const TALK = COST.conversation;

const P = extra => ({ id: 'u1', plan: 'beatfall', subscription_status: 'active',
  credits_used: 0, credits_extra: 0, is_admin: false, is_unlimited: false,
  period_start: '2026-09-01T00:00:00Z', trial_ends_at: null,
  stripe_subscription_id: null, ...extra });

function res(){
  const r = { code: 0, body: null, setHeader(){},
    status(c){ r.code = c; return r; },
    send(b){ try { r.body = JSON.parse(b); } catch (e) { r.body = b; } return r; } };
  return r;
}

/* What the wire saw. Every check that matters reads this rather than guessing
   from the answer, because "which reader was asked" and "which reader the
   endpoint says it asked" are exactly the two things that must not be allowed
   to drift apart. */
let WIRE = [];

function upstream({ mode = 'ok', openai, claude } = {}){
  globalThis.fetch = async (url, opt) => {
    const to = /openai/.test(String(url)) ? 'openai' : 'claude';
    WIRE.push({ to, url: String(url), body: JSON.parse(opt.body),
                headers: opt.headers || {} });
    if (mode === 'network') throw new Error('socket hang up');
    if (mode === 'error') return { ok: false, status: 500, text: async () => 'boom' };
    if (mode === 'busy')  return { ok: false, status: 429, text: async () => 'slow down' };
    return { ok: true, status: 200, json: async () => to === 'openai'
      ? (openai || {
          status: 'completed',
          output: [{ type: 'message', role: 'assistant',
                     content: [{ type: 'output_text', text: '{"ok":true}' }] }],
          usage: { input_tokens: 100, output_tokens: 50 } })
      : (claude || {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: '{"ok":true}' }],
          usage: { input_tokens: 100, output_tokens: 50 } }) };
  };
}

async function call(db, body, opts = {}){
  globalThis.__AUTH__ = { db, user: { id: 'u1', email: 'w@x.y' }, profile: db.state.profile };
  globalThis.__TRACKED__ = [];
  WIRE = [];
  upstream(opts);
  const r = res();
  await handler({ method: 'POST', headers: {}, body }, r);
  return r;
}

const testingOn  = () => { process.env.BEATFALL_TESTING = '1'; };
const testingOff = () => { delete process.env.BEATFALL_TESTING; };
process.env.OPENAI_API_KEY = 'test-key-not-a-real-one';
process.env.ANTHROPIC_API_KEY = 'test-key-not-a-real-one';

const ASK = { kind: 'conversation', input: 'what goes in this beat' };

/* ======================================================================== */
/* THE DEFAULT, which is the only behaviour production will ever have.      */
/* ======================================================================== */
{
  testingOff();
  const db = makeDb(P());
  const r = await call(db, ASK);
  check('a call with no provider asked for goes to the one Beatfall runs on',
    WIRE.length === 1 && WIRE[0].to === DEFAULT_PROVIDER,
    JSON.stringify(WIRE.map(w => w.to)) + ' but the default is ' + DEFAULT_PROVIDER);
  check('and is answered normally', r.code === 200 && /ok/.test(r.body.text || ''),
    r.code + ' ' + JSON.stringify(r.body));
  check('the usage row names the board\'s model',
    db.state.usage[0].model === MODEL_OF[DEFAULT_PROVIDER], db.state.usage[0].model);
}

/* THE FIRST LOCK. Production has no testing flag, so a browser asking for the
   other reader is simply read as asking for nothing. Not an error: an error
   would tell whoever sent it that there was something there to find. */
{
  testingOff();
  const db = makeDb(P({ is_admin: true }));
  const r = await call(db, { ...ASK, provider: OTHER });
  check('without the testing flag, asking for the other one still gets the default',
    WIRE.length === 1 && WIRE[0].to === DEFAULT_PROVIDER,
    JSON.stringify(WIRE.map(w => w.to)));
  check('and nothing in the answer admits the other one exists',
    r.body.provider === undefined && r.body.model === undefined,
    JSON.stringify(Object.keys(r.body)));
}

/* THE SECOND LOCK. The testing deployment points at the real database, so an
   ordinary writer who found their way onto it is a real person with real
   boards and gets the real product. */
{
  testingOn();
  const db = makeDb(P({ is_admin: false }));
  await call(db, { ...ASK, provider: OTHER });
  check('on the testing site, a writer who is not an admin still gets the default',
    WIRE[0].to === DEFAULT_PROVIDER, WIRE[0].to);
}

/* Both locks open. */
{
  testingOn();
  const db = makeDb(P({ is_admin: true }));
  const r = await call(db, { ...ASK, provider: 'openai' });
  check('a testing deployment and an admin together reach OpenAI',
    WIRE.length === 1 && WIRE[0].to === 'openai', JSON.stringify(WIRE.map(w => w.to)));
  check('and the answer says which reader produced it',
    r.body.provider === 'openai' && r.body.model === OPENAI_MODEL,
    JSON.stringify(r.body));
}

/* A WORD, NOT A CONFIGURATION. The browser picks between two names this server
   already knows. It cannot name a model, a host or a key, and a word that is
   not one of the two is not an error to argue with: the safe reading of an
   unrecognised reader is the one Beatfall actually runs on. */
{
  testingOn();
  const db = makeDb(P({ is_admin: true }));
  await call(db, { ...ASK, provider: 'some-other-shop' });
  check('a provider nobody has heard of falls back to the default',
    WIRE[0].to === DEFAULT_PROVIDER, WIRE[0].to);

  const db2 = makeDb(P({ is_admin: true }));
  await call(db2, { ...ASK, provider: 'openai',
    model: 'gpt-6-astra', url: 'https://somewhere.else/v1' });
  check('and a model the browser tried to name is ignored',
    WIRE[0].body.model === OPENAI_MODEL, JSON.stringify(WIRE[0].body.model));
  check('as is a host it tried to name',
    /^https:\/\/api\.openai\.com\//.test(WIRE[0].url), WIRE[0].url);
}

/* ======================================================================== */
/* THE SAME QUESTION, OR THE COMPARISON MEASURES NOTHING.                   */
/* ======================================================================== */
{
  const turns = [
    { role: 'user', content: 'the beat is Midpoint and here is the board' },
    { role: 'assistant', content: 'what changes for him there' },
    { role: 'user', content: 'he finds out the money was never in the truck' }
  ];
  testingOn();
  const a = makeDb(P({ is_admin: true }));
  await call(a, { kind: 'conversation', input: turns, provider: 'claude' });
  const toClaude = WIRE[0].body;

  const b = makeDb(P({ is_admin: true }));
  await call(b, { kind: 'conversation', input: turns, provider: 'openai' });
  const toOpenAI = WIRE[0].body;

  check('both readers are handed the identical turns',
    JSON.stringify(toClaude.messages) === JSON.stringify(toOpenAI.input),
    JSON.stringify({ claude: toClaude.messages, openai: toOpenAI.input }));
  check('and the same ceiling on how much they may write back',
    toClaude.max_tokens === toOpenAI.max_output_tokens,
    toClaude.max_tokens + ' against ' + toOpenAI.max_output_tokens);
  check('neither is given a temperature, a tool or a schema the other lacks',
    Object.keys(toClaude).sort().join(',') === 'max_tokens,messages,model'
      && Object.keys(toOpenAI).sort().join(',') === 'input,max_output_tokens,model,store',
    JSON.stringify([Object.keys(toClaude), Object.keys(toOpenAI)]));

  /* A writer's notes are in these messages. There is no reason for a copy of
     them to sit on anybody's server for thirty days, and the privacy page does
     not say one does. */
  check('and OpenAI is told not to keep a copy', toOpenAI.store === false,
    String(toOpenAI.store));
}

/* ======================================================================== */
/* READING THE ANSWER BACK.                                                 */
/* ======================================================================== */
{
  testingOn();
  const db = makeDb(P({ is_admin: true }));
  const r = await call(db, { ...ASK, provider: 'openai' }, { openai: {
    status: 'completed',
    output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', role: 'assistant',
        content: [{ type: 'output_text', text: '{"picks":' },
                  { type: 'output_text', text: '[{"id":"mid"}]}' }] }
    ],
    usage: { input_tokens: 2200, output_tokens: 300,
             output_tokens_details: { reasoning_tokens: 180 } }
  }});
  check('the answer is pulled out from among the model\'s own thinking',
    r.body.text === '{"picks":[{"id":"mid"}]}', JSON.stringify(r.body.text));
  check('the tokens are recorded as the provider counted them',
    db.state.usage[0].tokens_in === 2200 && db.state.usage[0].tokens_out === 300,
    JSON.stringify(db.state.usage[0]));
  /* REASONING IS BILLED AS OUTPUT AND SPENT FROM THE SAME CEILING, so the same
     number in max tokens does not buy the same amount of visible writing. An
     empty answer with reasoning behind it is a finding about the cap and not
     about the reader's judgement, and the two must not read as one result. */
  check('and the thinking is counted separately so an empty answer can be explained',
    r.body.reasoning === 180, JSON.stringify(r.body.reasoning));
}

/* IT RAN OUT OF ROOM, WHICH HAS ALWAYS LOOKED LIKE HAVING NOTHING TO SAY.
   The browser reported truncated:false unconditionally from the day it was
   written, so a reply cut off mid-JSON was indistinguishable from one that
   simply did not answer, and the board fell back to guessing either way. */
{
  testingOn();
  const db = makeDb(P({ is_admin: true }));
  const cut = await call(db, { ...ASK, provider: 'openai' }, { openai: {
    status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' },
    output: [{ type: 'message', content: [{ type: 'output_text', text: '{"picks":[' }] }],
    usage: { input_tokens: 10, output_tokens: 1400,
             output_tokens_details: { reasoning_tokens: 1390 } }
  }});
  check('a reply that ran out of room says so', cut.body.truncated === true,
    JSON.stringify(cut.body.truncated));

  const db2 = makeDb(P({ is_admin: true }));
  const cut2 = await call(db2, { ...ASK, provider: 'claude' }, { claude: {
    stop_reason: 'max_tokens',
    content: [{ type: 'text', text: '{"picks":[' }],
    usage: { input_tokens: 10, output_tokens: 1400 }
  }});
  check('and so does the one it replaced, which never used to',
    cut2.body.truncated === true, JSON.stringify(cut2.body.truncated));

  const db3 = makeDb(P({ is_admin: true }));
  const whole = await call(db3, ASK);
  check('a reply that finished does not', whole.body.truncated === false,
    JSON.stringify(whole.body.truncated));
}

/* ======================================================================== */
/* THE COST COLUMN, WHICH IS HALF THE REASON FOR RUNNING ANY OF THIS.       */
/* ======================================================================== */
{
  testingOn();
  const tin = 40000, tout = 5000;
  const reply = {
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: 'x' }] }],
    usage: { input_tokens: tin, output_tokens: tout } };

  const db = makeDb(P({ is_admin: true }));
  await call(db, { ...ASK, provider: 'openai' }, { openai: reply });
  const row = db.state.usage[0];

  check('an OpenAI call is costed with OpenAI\'s own prices',
    row.cost_micros === costMicrosFor('openai', tin, tout),
    row.cost_micros + ' against ' + costMicrosFor('openai', tin, tout));
  /* THE MISTAKE THIS EXISTS TO PREVENT. The two are different numbers, so a
     row priced with the wrong table is visibly wrong rather than plausibly
     wrong, which is the only reason this check can work at all. */
  check('and NOT with Claude\'s, which would make the comparison fiction',
    row.cost_micros !== costMicrosFor('claude', tin, tout),
    'both tables give ' + row.cost_micros + ', so this check proves nothing');
  check('the row says which model produced it',
    row.model === OPENAI_MODEL, row.model);
  check('and the two tables really are different prices',
    PROVIDER_PRICES.openai.in !== PROVIDER_PRICES.claude.in,
    JSON.stringify(PROVIDER_PRICES));
}

/* ======================================================================== */
/* WHEN IT FAILS, THE CREDITS COME BACK. The charge is taken BEFORE the call, */
/* which is the only thing that makes metering real, and the duty that comes  */
/* with it is this one.                                                       */
/* ======================================================================== */
{
  testingOn();
  for (const [label, mode] of [['refuses', 'error'], ['is too busy', 'busy'],
                               ['never answers', 'network']]) {
    const db = makeDb(P({ is_admin: true }));
    const r = await call(db, { ...ASK, provider: 'openai' }, { mode });
    check('when OpenAI ' + label + ', the credits go straight back',
      db.state.profile.credits_used === 0,
      'used ' + db.state.profile.credits_used + ' of them');
    check('  and the writer is told rather than shown an empty answer',
      r.code === 502, String(r.code));
  }
}

/* A KEY THAT IS NOT THERE IS NOT A BAD KEY. Sending "Bearer undefined" comes
   back as a 401 and reads like a key that was rejected, which is an hour spent
   looking in the wrong place. */
{
  testingOn();
  const had = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const db = makeDb(P({ is_admin: true }));
  const r = await call(db, { ...ASK, provider: 'openai' });
  check('with no OpenAI key set, nothing is sent at all', WIRE.length === 0,
    JSON.stringify(WIRE.map(w => w.to)));
  check('the credits are not kept for a call that never happened',
    db.state.profile.credits_used === 0, String(db.state.profile.credits_used));
  check('and it is a 502 rather than a silent empty answer', r.code === 502,
    String(r.code));
  process.env.OPENAI_API_KEY = had;
}

/* ======================================================================== */
/* THE PRICE TO THE WRITER DOES NOT MOVE. Whoever reads the notes, a          */
/* conversation costs what the table says a conversation costs.              */
/* ======================================================================== */
{
  testingOn();
  const a = makeDb(P({ is_admin: true }));
  await call(a, ASK);
  const b = makeDb(P({ is_admin: true }));
  await call(b, { ...ASK, provider: 'openai' });
  check('a conversation costs the writer the same on either reader',
    a.state.profile.credits_used === TALK
      && b.state.profile.credits_used === TALK,
    a.state.profile.credits_used + ' and ' + b.state.profile.credits_used);
  check('and that is the figure in the table, not one typed here',
    a.state.usage[0].credits === COST.conversation, String(a.state.usage[0].credits));
}

/* Production's answer is byte for byte what it has always been. A response
   shape that grows a field depending on a deployment flag is a response shape
   nothing can rely on, so the extra reporting exists only where it is read. */
{
  testingOff();
  const db = makeDb(P({ is_admin: true }));
  const r = await call(db, ASK);
  check('on the live site the answer carries no testing fields at all',
    Object.keys(r.body).sort().join(',')
      === 'allowance,banked,credits_left,monthly_left,text',
    Object.keys(r.body).sort().join(','));
}

testingOff();
const failed = out.filter(r => !r.ok);
console.log('\n' + (out.length - failed.length) + ' of ' + out.length + ' passed');
if (failed.length) {
  console.log('\nFAILED:');
  failed.forEach(f => console.log('  ' + f.n));
  process.exit(1);
}
