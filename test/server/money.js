import { charge, refund, entitlement, spend, PLANS, PAID_PLAN, PRICE_MONTH,
         PRICE_YEAR, COST, lowMark, lastMark, TOPUP_CREDITS, TOPUP_PRICE } from './api/_lib/core.js';

/* The allowance a paid month carries. These tests used to type 150, so the
   day the plan moved to 100 four of them failed for the only reason a test
   must never fail: the test was the thing that was out of date. ALL says
   "a full month" and FULL_BUT_ONE says "one credit left", which is what each
   case actually means, at any allowance. */
const ALL = PLANS[PAID_PLAN].credits;
const FULL_BUT_ONE = ALL - 1;
import { makeDb } from './fakedb.js';
import { MANUAL_TEXT } from './api/_help/manual.js';

const out = [];
const check = (n, ok, d) => { out.push({n, ok}); console.log((ok?'  PASS  ':'  FAIL  ')+n+(ok||!d?'':'\n          '+d)); };

const paid = extra => ({ id:'u1', plan:'beatfall', subscription_status:'active',
  credits_used:0, credits_extra:0, is_admin:false, period_start:'2026-09-01T00:00:00Z',
  trial_ends_at:null, ...extra });

// ---------- an ordinary charge
{
  const db = makeDb(paid());
  const p = db.state.profile, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 1);
  check('a charge applies', r.ok === true, JSON.stringify(r).slice(0,120));
  check('and comes out of the month', db.state.profile.credits_used === 1, JSON.stringify(db.state.profile));
  check('and reports which bucket it came from',
    r.took && r.took.monthly === 1 && r.took.banked === 0, JSON.stringify(r.took));
}

// ---------- the month runs out and the bought credits carry it
{
  const db = makeDb(paid({credits_used:FULL_BUT_ONE, credits_extra:10}));
  const p = db.state.profile, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 2);
  check('a charge spanning both buckets applies', r.ok === true);
  check('the month is spent first',
    db.state.profile.credits_used === ALL && db.state.profile.credits_extra === 9,
    JSON.stringify(db.state.profile));
  check('and the split is reported honestly',
    r.took.monthly === 1 && r.took.banked === 1, JSON.stringify(r.took));
}

// ---------- nothing left
{
  const db = makeDb(paid({credits_used:ALL, credits_extra:0}));
  const p = db.state.profile, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 1);
  check('an empty account is refused', r.ok === false && r.reason === 'insufficient', JSON.stringify(r));
  check('and nothing is taken', db.state.profile.credits_used === ALL);
}

// ---------- somebody moved the balance underneath us
{
  const db = makeDb(paid({credits_used:10}), {raceOnce:true});
  const p = {...db.state.profile}, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 1);
  check('a lost race retries against the new balance', r.ok === true, JSON.stringify(r));
  check('and charges exactly once on top of the other spend',
    db.state.profile.credits_used === 12, 'used=' + db.state.profile.credits_used + ' (10 +1 other +1 ours)');
}

// ---------- the write landed but the reply did not
{
  const db = makeDb(paid(), {failEvery:1});
  const p = db.state.profile, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 1);
  check('a lost reply is not retried as a conflict',
    r.ok === false && r.reason === 'unavailable', JSON.stringify(r));
}

// ---------- twenty at once against one credit
{
  const db = makeDb(paid({credits_used:FULL_BUT_ONE}));
  const results = [];
  for (let i = 0; i < 20; i++) {
    const fresh = {...db.state.profile};
    results.push(await charge(db, 'u1', fresh, entitlement(fresh), 1));
  }
  const okCount = results.filter(r => r.ok).length;
  check('only one of twenty requests can spend the last credit', okCount === 1,
    okCount + ' succeeded; used=' + db.state.profile.credits_used);
  check('and the balance never goes past the allowance',
    db.state.profile.credits_used === ALL, 'used=' + db.state.profile.credits_used);
}

// ---------- putting it back
{
  const db = makeDb(paid({credits_used:FULL_BUT_ONE, credits_extra:10}));
  const p = db.state.profile, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 2);
  const back = await refund(db, 'u1', r.took);
  check('a refund succeeds', back.ok === true);
  check('and each credit goes back where it came from',
    db.state.profile.credits_used === FULL_BUT_ONE && db.state.profile.credits_extra === 10,
    JSON.stringify(db.state.profile) + '  (a bought credit must not return as a monthly one)');
}

// ---------- a refund of nothing
{
  const db = makeDb(paid());
  const back = await refund(db, 'u1', {monthly:0, banked:0});
  check('refunding nothing is a no-op', back.ok === true && db.state.profile.credits_used === 0);
}

// ---------- the owner
{
  const db = makeDb(paid({is_admin:true}));
  const p = db.state.profile, e = entitlement(p);
  const r = await charge(db, 'u1', p, e, 2);
  check('the owner is charged without being blocked', r.ok === true, JSON.stringify(r).slice(0,100));
  check('and is never refused for balance', entitlement(db.state.profile).left > 0);
}

// ---------- the numbers printed on the pages
/* Every price and allowance a public page prints is written into the HTML as
   a plain number, so the page is right with no JavaScript at all, and then
   painted over from /api/config once it loads. That printed number is the one
   a search engine indexes and the one somebody with a slow connection reads,
   so it has to agree with what the server actually bills. It is also the one
   nobody remembers to change. This is the check that remembers.

   Kris raised the plan on 16 September and four separate files had to move.
   One of them, the homepage, had been saying the price before last for weeks
   and nothing caught it, because nothing was looking. */
{
  const fs = await import('node:fs');
  const core = await import('./api/_lib/core.js');

  const truth = {
    plan_credits:    core.PLANS[core.PAID_PLAN].credits,
    trial_credits:   core.PLANS.trial.credits,
    price_month:     core.PRICE_MONTH,
    price_year:      core.PRICE_YEAR,
    topup_credits:   core.TOPUP_CREDITS,
    topup_price:     core.TOPUP_PRICE,
    low_mark:        core.lowMark(core.PLANS[core.PAID_PLAN].credits),
    last_mark:       core.lastMark(core.PLANS[core.PAID_PLAN].credits),
    trial_low_mark:  core.lowMark(core.PLANS.trial.credits),
    trial_last_mark: core.lastMark(core.PLANS.trial.credits),
    year_saving:     (core.PRICE_MONTH * 12) - core.PRICE_YEAR
  };

  const pages = ['index.html', 'login.html', 'billing.html', 'settings.html'];
  const wrong = [];
  let found = 0;

  for (const page of pages) {
    const html = fs.readFileSync('../../public/' + page, 'utf8');
    const tag = /data-bf="([a-z_]+)"[^>]*>([^<]*)</g;
    let m;
    while ((m = tag.exec(html))) {
      found++;
      const key = m[1], printed = m[2].trim();
      if (!(key in truth)) { wrong.push(page + ': data-bf="' + key + '" is not a thing config serves'); continue; }
      if (printed !== String(truth[key])) {
        wrong.push(page + ': data-bf="' + key + '" prints ' + printed + ', core.js says ' + truth[key]);
      }
    }
  }

  check('every page is checked for printed prices', found >= 8, 'only found ' + found + ' printed numbers');
  check('and each one agrees with core.js', wrong.length === 0, wrong.join('\n          '));

  // The homepage price sentence is the one people read before they decide.
  // If it ever goes back to being a bare number this fails loudly.
  const home = fs.readFileSync('../../public/index.html', 'utf8');
  check('the homepage price comes from the server, not from typing',
    /data-bf="price_month"/.test(home) && /data-bf="price_year"/.test(home),
    'index.html has a hand-typed price in it again');

  /* app.html carries its own copy of the price table, deliberately. The server
     decides what is charged; that copy decides what the writer is TOLD, and it
     has to be there before /api/account has answered. A deliberate duplicate is
     fine. A duplicate that drifts is a support email, so this is the check that
     they still say the same thing. */
  const app = fs.readFileSync('../../public/app.html', 'utf8');

  const table = (src, name) => {
    const m = src.match(new RegExp('const ' + name + ' = \\{([^}]*)\\}'));
    if (!m) return null;
    const out = {};
    m[1].replace(/([a-z_]+)\s*:\s*(\d+)/g, (_, k, v) => { out[k] = Number(v); return ''; });
    return out;
  };

  const said = table(app, 'CREDIT');
  const gap = [];
  if (!said) gap.push('app.html has no CREDIT table any more');
  else {
    for (const k of Object.keys(core.COST)) {
      if (said[k] !== core.COST[k]) {
        gap.push(k + ': app.html says ' + said[k] + ', core.js charges ' + core.COST[k]);
      }
    }
    for (const k of Object.keys(said)) {
      if (!(k in core.COST)) gap.push(k + ': app.html prices it, core.js has never heard of it');
    }
  }
  check('the app quotes the same price the server charges', gap.length === 0,
    gap.join('\n          '));

  const fallback = table(app, 'PRICES');
  check('and its printed prices are the current ones',
    fallback && fallback.month === core.PRICE_MONTH && fallback.year === core.PRICE_YEAR,
    JSON.stringify(fallback) + ' against ' + core.PRICE_MONTH + '/' + core.PRICE_YEAR);

  const allowance = app.match(/const PLAN_CREDITS = (\d+)/);
  check('and its printed allowance is the current one',
    allowance && Number(allowance[1]) === core.PLANS[core.PAID_PLAN].credits,
    (allowance ? allowance[1] : 'missing') + ' against ' + core.PLANS[core.PAID_PLAN].credits);

  // The pack size is printed in four places in app.html as `|| <number>`.
  // Every one of them was stale on 16 September. This counts them instead.
  const packs = [...app.matchAll(/topup_credits\)? \|\| (\d+)/g)].map(m => Number(m[1]));
  check('and every printed pack size agrees too',
    packs.length >= 3 && packs.every(n => n === core.TOPUP_CREDITS),
    'found ' + JSON.stringify(packs) + ', core.js says ' + core.TOPUP_CREDITS);
}

/* ===================================== THE HELP TEXT QUOTES REAL NUMBERS
 *
 * Every figure in the help content is a sentence somebody will read and act
 * on, and one of them will be read aloud by the help chat to a writer asking
 * what Beatfall costs. Prose goes stale exactly the way a page does: this
 * codebase has already shipped a billing page advertising an allowance the
 * app had moved off, twice.
 *
 * So every price, allowance and credit cost written into the help is checked
 * against core.js here. If the plan moves and the help does not, this goes
 * red on the same run.
 */
{
  const { HELP, SECTIONS } = await import('./api/_help/content.js');
  const core = await import('./api/_lib/core.js');
  const all = HELP.map(h => h.q + '\n' + h.a).join('\n\n');

  check('there is help content to check', HELP.length > 40, HELP.length + ' entries');

  // ---- the numbers
  const dollars = [...all.matchAll(/\$(\d+)/g)].map(m => Number(m[1]));
  const known = [core.PRICE_MONTH, core.PRICE_YEAR, core.TOPUP_PRICE];
  check('every price in the help is a price Beatfall actually charges',
    dollars.length >= 3 && dollars.every(n => known.includes(n)),
    'found ' + JSON.stringify(dollars) + ', core.js says ' + JSON.stringify(known));
  check('and all three of them are mentioned somewhere',
    known.every(n => dollars.includes(n)),
    'missing from the help: '
      + JSON.stringify(known.filter(n => !dollars.includes(n))));

  const say = (n, what) => new RegExp('\\b' + n + ' ' + what).test(all);
  check('the monthly allowance in the help is the real one',
    say(core.PLANS[PAID_PLAN].credits, 'a month')
      || say(core.PLANS[PAID_PLAN].credits, 'credits a month'),
    'core.js says ' + core.PLANS[PAID_PLAN].credits);
  check('and so is the trial allowance',
    say(core.PLANS.trial.credits, 'credits'),
    'core.js says ' + core.PLANS.trial.credits);
  check('and so is the size of a pack',
    say(core.TOPUP_CREDITS, 'credits for \\$' + core.TOPUP_PRICE),
    'core.js says ' + core.TOPUP_CREDITS + ' for $' + core.TOPUP_PRICE);

  /* What each action costs, read off COST rather than typed here. The help
     names five of them in prose and every one has to match. */
  const priced = {
    conversation: 'A conversation about an empty beat is',
    ideas:        'A set of ideas is',
    logline:      'A logline is',
    character:    'A character interview is',
    import:       'Reading in a file of notes is'
  };
  const wrong = Object.entries(priced).filter(([kind, lead]) =>
    !all.includes(lead + ' ' + core.COST[kind]));
  check('every action price in the help matches what the server charges',
    wrong.length === 0,
    wrong.map(([k, l]) => l + ' ' + core.COST[k] + '  (not found)').join('\n          '));

  // ---- the shape of the thing
  const ids = HELP.map(h => h.id);
  check('no two entries share an id',
    new Set(ids).size === ids.length,
    JSON.stringify(ids.filter((x, i) => ids.indexOf(x) !== i)));
  check('every entry has a question and an answer',
    HELP.every(h => h.id && h.section && h.q && h.a && h.a.length > 40),
    JSON.stringify(HELP.filter(h => !(h.q && h.a && h.a.length > 40)).map(h => h.id)));
  const dangling = [];
  HELP.forEach(h => (h.also || []).forEach(a => {
    if (!ids.includes(a)) dangling.push(h.id + ' points at ' + a);
  }));
  check('nothing points at an entry that is not there',
    dangling.length === 0, dangling.join('\n          '));
  const used = [...new Set(HELP.map(h => h.section))];
  check('every section is in the running order and every one has entries',
    used.every(s => SECTIONS.includes(s)) && SECTIONS.every(s => used.includes(s)),
    'orphan sections: ' + JSON.stringify(used.filter(s => !SECTIONS.includes(s)))
      + ' empty sections: ' + JSON.stringify(SECTIONS.filter(s => !used.includes(s))));

  // ---- the house rules, which apply here more than anywhere
  /* The character itself is written as an escape so this file does not trip
     the very rule it is checking for. */
  const EMDASH = String.fromCharCode(0x2014);
  check('no em dashes anywhere in the help', all.indexOf(EMDASH) < 0,
    (all.split(EMDASH)[0] || '').slice(-60));
  check('the help never says AI, Claude or the model',
    !/\bAI\b|Claude|the model/.test(all),
    (all.match(/.{0,60}(\bAI\b|Claude|the model).{0,60}/) || [''])[0]);
  check('and it names the support address it is meant to hand off to',
    all.includes('support@beatfall.app'), '');

  /* The questions the help chat exists to answer. Kris named the first one
     himself and it was missing from the old help page, which is what started
     this. These are the everyday ones: if any of them stops being covered,
     somebody is writing to support instead. */
  const MUST_COVER = [
    /add a new project/i,
    /delete (a|my) project/i,
    /sign in/i,
    /free trial/i,
    /run out of credits/i,
    /cancel/i,
    /delete my account/i,
    /phone/i,
    /picture|photograph/i,
    /Outline/i,
    /PDF/i,
    /structure/i,
    /undo/i
  ];
  const uncovered = MUST_COVER.filter(re => !HELP.some(h => re.test(h.q)));
  check('the everyday questions all have an entry of their own',
    uncovered.length === 0,
    'nothing asks about: ' + uncovered.map(String).join(', '));
}

/* ---------- THE MANUAL
 *
 * The 75 written answers can only answer the 75 questions somebody thought of.
 * Kris asked whether two projects could be merged, nobody had written it down,
 * and the desk handed him an inbox for a question a description of the product
 * answers in a line. The manual is that description, and these checks are the
 * things that would make it quietly stop being one.
 */
{
  const M = MANUAL_TEXT();
  /* The manual is wrapped prose, so a figure can land with a line break in the
     middle of the phrase that carries it. Match against a flattened copy, or
     these checks go red for the one reason a test must never go red: the test
     was wrong. */
  const FLAT = M.replace(/\s+/g, ' ');

  check('the manual is a description of the product, not a summary of one',
    M.length > 40000, M.length + ' characters');

  /* Every surface a writer can stand on. A manual missing one of these is a
     manual that will hand somebody an email address about it. */
  const SURFACES = ['THE DASHBOARD', 'THE BOARD', 'THE OUTLINE', 'THE NOTES PAGE',
                    'CHARACTERS', 'PICTURES', 'CREDITS, PLANS AND BILLING',
                    'SETTINGS', 'THE PHONE APP', 'TAKING WORK OUT',
                    'ACCOUNTS AND SIGNING IN', 'NOTES FROM YOUR PHONE'];
  const missing = SURFACES.filter(s => M.indexOf(s) < 0);
  check('every surface of the product is described',
    missing.length === 0, 'nothing describes: ' + missing.join(', '));

  /* THE LIST THAT ANSWERS THE MERGE QUESTION. A feature that does not exist is
     knowledge, and it is only knowledge if it is written down. */
  check('and what Beatfall deliberately does not do is written down too',
    /DELIBERATELY DOES NOT DO/.test(M), '');
  ['merge', 'collaborat', 'screenplay', 'revision history', 'custom structure']
    .forEach(word => check('  the absent things include ' + word,
      new RegExp(word, 'i').test(M.slice(M.indexOf('DELIBERATELY DOES NOT DO'))), ''));

  /* All nine, by name, with their beats. A writer asking "does it do half hour
     comedy" is asking a question this has to answer without a round trip. */
  const NINE = ['Save the Cat', 'Classic Three-Act', 'Story Circle', 'Short film',
                'One episode', 'Season arc', 'Broadcast Hour', 'Streaming Hour',
                'Half-Hour Comedy'];
  const gone = NINE.filter(n => M.toLowerCase().indexOf(n.toLowerCase()) < 0);
  check('all nine structures are named', gone.length === 0, gone.join(', '));
  check('and their beats are listed, not just their names',
    /Bad Guys Close In/.test(M) && /The Paywall Turn/.test(M)
      && /Act Four Climax/.test(M), '');

  /* EVERY FIGURE IS INTERPOLATED, NEVER TYPED. This is the bug this product has
     fixed three times, and a 58KB file of prose is the easiest place yet to
     reintroduce it. */
  check('the prices in the manual are the prices in core.js',
    FLAT.indexOf('$' + PRICE_MONTH + ' a month') >= 0
      && FLAT.indexOf('$' + PRICE_YEAR + ' a year') >= 0
      && FLAT.indexOf(PLANS[PAID_PLAN].credits + ' credits a month') >= 0,
    PRICE_MONTH + '/' + PRICE_YEAR + '/' + PLANS[PAID_PLAN].credits);
  check('and the pack is too',
    FLAT.indexOf(TOPUP_CREDITS + ' credits for $' + TOPUP_PRICE) >= 0,
    TOPUP_CREDITS + ' for ' + TOPUP_PRICE);
  check('and so are the action costs',
    FLAT.indexOf('Reading in a notes file ' + COST.import + ' credits') >= 0
      && FLAT.indexOf('A conversation about a beat ' + COST.conversation + ' credits') >= 0
      && FLAT.indexOf('A character interview ' + COST.character + ' credits') >= 0,
    JSON.stringify(COST));
  check('and so are the two warning marks',
    FLAT.indexOf('At ' + lowMark(PLANS[PAID_PLAN].credits) + ' left on a plan') >= 0
      && FLAT.indexOf('At ' + lastMark(PLANS[PAID_PLAN].credits) + ' left') >= 0,
    lowMark(PLANS[PAID_PLAN].credits) + '/' + lastMark(PLANS[PAID_PLAN].credits));

  /* The house rules travel into prose more easily than into a Q and A, because
     prose is where a conversational register creeps back in. */
  check('no em dashes in the manual',
    M.indexOf(String.fromCharCode(0x2014)) < 0, '');
  check('and it never names the model',
    !/\bAI\b|Claude|the model/.test(M), '');
  check('and it calls the paid feature the writing help',
    /the writing help/.test(M), '');
}

const failed = out.filter(r => !r.ok);
console.log('\n' + (out.length - failed.length) + ' of ' + out.length + ' passed');
if (failed.length) process.exit(1);
