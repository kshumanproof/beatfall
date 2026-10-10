/* RUNNING OUT OF CREDITS, ON THE SCREEN WHERE IT COSTS THE MOST.
 *
 * Kris pasted a notes file with an empty balance and the app told him
 * "Couldn't read that file. Try again, or split it into two files." He had
 * credits on his mind and the app had sent him to go and cut up his file.
 *
 * Three separate faults were stacked under that one sentence, and each of
 * them is a different kind of mistake worth keeping a check on.
 *
 *   1. THE WARNING THAT SHOULD HAVE COME FIRST WAS READING A STALE NUMBER.
 *      This sheet has a line that says "you need 5 credits, your balance is
 *      0" with Add credits beside it. It reads the account object, which is
 *      fetched once when the page opens. The writing help has always painted
 *      the new balance onto the pill in the corner and never written it back,
 *      so the moment a balance moved with the tab open, that warning was
 *      quoting the figure from when the tab was opened and stayed hidden.
 *
 *   2. A REFUSAL WAS BEING SWALLOWED AND GUESSED AT. Both passes of the read
 *      caught everything except a cancel, which is right for one flaky batch
 *      and wrong for a closed door: out of credits got swallowed on every
 *      batch, the read finished with nothing, and the code threw a generic
 *      "unreadable" that draws as the file message. The handler has had a
 *      proper out of credits branch the whole time and never saw it.
 *
 *   3. THE MESSAGE HAD NO WAY OUT. It said "add credits" and left somebody to
 *      go and find where.
 *
 * Everything below runs the shipped app.html. The reader is replaced at
 * `ai_sample`, which is the single door to the metered proxy, so a refusal
 * here arrives exactly the way the server's would.
 */
const { chromium } = require('playwright');
const path = require('path');
const PAGE = 'file://' + path.resolve('stub.html');

const results = [];
function check(name, ok, detail){
  results.push({name, ok});
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || !detail ? '' : '\n          ' + detail));
}

const inDays = n => new Date(Date.now() + n * 86400000).toISOString();
const PAID = {email:'w@example.com', display_name:'Writer', plan:'beatfall',
  unlimited:false, trialing:false, credits_left:75, credits_allowance:75,
  credits_banked:0, current_period_end:inDays(19), has_history:true,
  plans:{beatfall:{credits:75,price:15}}, price_month:15, price_year:149};
const TRIAL = Object.assign({}, PAID, {plan:'trial', trialing:true,
  credits_left:25, credits_allowance:25, trial_ends_at:inDays(9)});

function board(name, filled, structure = 'stc'){
  const slots = ['open','theme','setup','cat','debate','br2','bstory','fun',
                 'mid','bad','lost','dark','br3','fin','last'];
  return {
    id: 'p-' + name.toLowerCase().replace(/\W/g,''), name, structure, brief: {},
    outline: {}, characters: [], is_sample: false, created_from: 'new_project',
    updated_at: '2026-09-01T00:00:00Z',
    cards: slots.slice(0, filled).map((s, i) =>
      ({id: i+1, text: 'card for ' + s, slot: s, pinned: true}))
  };
}

/* A file long enough to be read in several batches, so "it stopped at the
   first refusal" is a measurable thing rather than a figure of speech. */
const NOTES = Array.from({length: 60}, (_, i) =>
  'Note ' + i + '. ' + [
    'Mara walks the burned hallway before anybody else arrives',
    'Rusk counts the till twice and puts half of it back',
    'The broker will not say the name of the man who sent him',
    'Dale leaves the engine running outside the courthouse',
    'The sheriff writes down a number nobody asked him for'
  ][i % 5] + ' in the long cold week after the fire.').join('\n\n');

async function open(browser, account, projects){
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error'
        && !/ERR_TUNNEL|ERR_FILE_NOT_FOUND|ERR_NAME_NOT_RESOLVED|favicon/.test(t))
      errors.push('console: ' + t);
  });
  await page.addInitScript(([a, p]) => {
    window.__ACCOUNT__ = a; window.__PROJECTS__ = p;
    window.__CLOSED__ = false; window.__REASON__ = null; window.__DAYS__ = [];
  }, [account, projects || [board('Night Haul', 9)]]);
  await page.goto(PAGE);
  await page.waitForTimeout(700);
  return { page, errors };
}

/* The reader, refusing. `mode` decides how: a refusal carries a code the way
   the platform layer sets one from the server's answer, and `silent` returns
   nothing at all, which is the genuinely unreadable case the file message is
   actually for. */
async function stubReader(page, mode, code){
  await page.evaluate(([m, c]) => {
    window.__ASKED__ = 0;
    const answer = () => {
      window.__ASKED__++;
      if (m === 'refuse'){
        const e = new Error(c === 'no_plan'
          ? 'Your trial has ended. Pick a plan to keep going.'
          : "That's all 75 of this month's credits. They come back on your "
            + 'reset day, or 25 more is $6 and those never expire.');
        e.code = c; e.status = 402;
        throw e;
      }
      if (m === 'silent') return {};
      // 'flaky': the first batch after pass one throws something ordinary and
      // every other call answers. One bad batch must not lose the read.
      if (m === 'flaky' && window.__ASKED__ === 2){
        const e = new Error('Could not get a response.');
        e.code = 'bad_gateway'; e.status = 502;
        throw e;
      }
      return null;   // filled in by the caller below
    };
    window.__ANSWER__ = answer;
    ai_sample = async function (p) { return {text: JSON.stringify(real(p))}; };
    ai_sample.json = async function (p) { return real(p); };
    ai_sample.limits = async () => ({images: false});

    let first = true;
    function real(prompt){
      const forced = answer();
      if (forced !== null) return forced;
      if (first){ first = false; return {brief: {}, people: [], stories: []}; }
      const nums = [...String(prompt).matchAll(/^(\d+)\.\s/gm)].map(n => Number(n[1]));
      if (!nums.length) return {};
      return {notes: nums.map(n => ({b: null, c: 0, d: false, k: 'beat',
                                     e: null, n: n, s: 0}))};
    }
  }, [mode, code || 'out_of_credits']);
}

/* Paste, press, press again. The second press is the one that spends, which
   is why every path through here goes past the screen in between. */
async function runImport(page, text){
  return page.evaluate(async (t) => {
    openImport(false);
    const box = document.getElementById('dumptext');
    box.value = t;
    box.dispatchEvent(new Event('input'));
    const field = document.getElementById('dumpformatfield');
    if (field && !field.hidden){
      const fmt = document.getElementById('dumpformat');
      fmt.value = 'stc';
      fmt.dispatchEvent(new Event('change'));
    }
    document.getElementById('dumpgo').click();
    if (!document.getElementById('sheetahead').hidden)
      document.getElementById('aheadgo').click();
    for (let i = 0; i < 100; i++){
      await new Promise(r => setTimeout(r, 50));
      const said = document.getElementById('dumpcount').textContent || '';
      if (!document.getElementById('sheetreview').hidden) break;
      if (/Couldn|credits|plan|could not identify/i.test(said)) break;
    }
    return {
      said: document.getElementById('dumpcount').textContent,
      html: document.getElementById('dumpcount').innerHTML,
      asked: window.__ASKED__,
      stillTyped: document.getElementById('dumptext').value.length,
      review: !document.getElementById('sheetreview').hidden
    };
  }, text);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ============================== a refusal is not a failure to read ========
  {
    const { page, errors } = await open(browser, PAID);
    await stubReader(page, 'refuse', 'out_of_credits');
    const r = await runImport(page, NOTES);

    check('being out of credits does not say the file could not be read',
      !/Couldn't read that file/.test(r.said), r.said);
    check('it says what is actually wrong',
      /credits/i.test(r.said), r.said);
    check('and that nothing was charged', /Nothing was charged/.test(r.said), r.said);
    check('and that the notes are still there', /still in the box/.test(r.said), r.said);
    check('the notes really are still in the box', r.stillTyped > 100,
      String(r.stillTyped));
    check('nothing was placed on a board', r.review === false);

    /* THE READ STOPS AT THE DOOR. It used to swallow the refusal and keep
       going, which on a sixty note file is twenty more calls against a
       server that has already said no, and twenty more seconds of a writer
       watching a progress bar for an answer that was never coming. */
    check('and it stops at the first refusal rather than asking twenty times',
      r.asked === 1, 'asked ' + r.asked + ' times');
    check('no script error', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  // ============================== the way out is a control, not a sentence ==
  {
    const { page } = await open(browser, PAID);
    await stubReader(page, 'refuse', 'out_of_credits');
    await runImport(page, NOTES);
    const st = await page.evaluate(() => {
      const b = document.getElementById('dumpbuy');
      return { there: !!b, says: b ? b.textContent : '',
               pressable: b ? b.tagName : '' };
    });
    check('the message carries a way to buy more', st.there);
    check('and it is a control rather than a word', st.pressable === 'BUTTON');
    check('it says Add credits to a subscriber', st.says === 'Add credits', st.says);

    /* Pressing it asks billing for a checkout. The stub records the request
       and then refuses, because answering with a url would send the browser
       off the page and there would be nothing left to read. What is being
       measured is that the press asks for the right thing. */
    const asked = await page.evaluate(async () => {
      window.__BILLED__ = null;
      const was = BF.api;
      BF.api = async (p, o) => {
        if (p.indexOf('/api/billing') === 0){
          window.__BILLED__ = JSON.parse(o.body);
          throw new Error('Could not open checkout.');
        }
        return was(p, o);
      };
      document.getElementById('dumpbuy').click();
      await new Promise(r => setTimeout(r, 300));
      return { sent: window.__BILLED__,
               back: document.getElementById('dumpbuy').textContent,
               live: document.getElementById('dumpbuy').disabled === false };
    });
    check('and pressing it opens a top-up',
      asked.sent && asked.sent.action === 'topup', JSON.stringify(asked));
    /* A checkout that will not open leaves the button pressable again rather
       than stuck on Opening, which is the state somebody is left staring at
       when the one thing they came to do fails. */
    check('and a checkout that will not open hands the button back',
      asked.live === true && asked.back === 'Add credits', JSON.stringify(asked));
    await page.close();
  }

  /* A TRIAL THAT HAS RUN OUT IS SHOWN THE PLANS, NOT A PACK. A pack is the
     right answer for a subscriber having a heavy month. On a trial it is a
     worse deal offered at the exact moment somebody is deciding whether this
     is worth paying for at all. */
  {
    const { page } = await open(browser, TRIAL);
    await stubReader(page, 'refuse', 'no_plan');
    const r = await runImport(page, NOTES);
    const st = await page.evaluate(() => {
      const b = document.getElementById('dumpbuy');
      return { says: b ? b.textContent : '' };
    });
    check('a trial that has ended is sent to the plans',
      st.says === 'See plans', st.says + ' / ' + r.said);
    await page.close();
  }

  // ===================== the file message is still there for a real one =====
  {
    const { page } = await open(browser, PAID);
    await stubReader(page, 'silent');
    const r = await runImport(page, NOTES);
    check('a read that genuinely comes back empty still says so',
      /Couldn't read that file|could not identify/i.test(r.said), r.said);
    check('and does not offer to sell anything',
      !/Add credits/.test(r.html), r.html.slice(0, 120));
    await page.close();
  }

  /* ONE BAD BATCH IS NOT A CLOSED DOOR, and the forgiving behaviour is the
     reason those catches exist. Breaking a refusal out of them must not take
     this with it: nineteen good answers beat none. */
  {
    const { page } = await open(browser, PAID);
    await stubReader(page, 'flaky');
    const r = await runImport(page, NOTES);
    check('one batch failing does not lose the whole read',
      r.review === true, r.said);
    check('and it kept going rather than stopping at the bad one',
      r.asked > 2, 'asked ' + r.asked + ' times');
    await page.close();
  }

  // ===================== the warning that should come first =================
  /* The balance moves while the tab is open, which is the ordinary case: a
     writer spends their last credits on a conversation and then pastes a
     file. The account object in memory used to keep quoting the figure from
     when the page loaded. */
  {
    const { page, errors } = await open(browser, PAID);
    const before = await page.evaluate(() => {
      openImport(false);
      return document.getElementById('dumpshort').hidden;
    });
    check('with credits in hand the sheet says nothing about the balance',
      before === true);

    const after = await page.evaluate(() => {
      closeImport();
      // Exactly what the writing help does when it answers: the pill is
      // painted with the new figure.
      BF.onCredits({left: 0, allowance: 75, banked: 0});
      openImport(false);
      const line = document.getElementById('dumpshort');
      return { hidden: line.hidden, says: line.textContent.replace(/\s+/g, ' ').trim(),
               me: ME.credits_left };
    });
    check('spending the last credit updates the account in memory',
      after.me === 0, String(after.me));
    check('and the next paste is warned before a word is typed',
      after.hidden === false, 'the warning stayed hidden');
    check('the warning says what is needed and what is there',
      /need 5 credits/.test(after.says) && /balance is 0/.test(after.says),
      after.says);
    check('and carries the way to fix it',
      /Add credits/.test(after.says), after.says);
    check('no script error', errors.length === 0, errors.join('\n'));
    await page.close();
  }

  /* AN OWNER HAS NO BALANCE TO WARN ABOUT. The allowance is a stand in for
     infinity and the raw figure comes back through the same door, so this is
     the place it would turn into "you need 5 credits, your balance is
     999,910". */
  {
    const { page } = await open(browser,
      Object.assign({}, PAID, {unlimited: true, credits_left: 999910,
                               credits_allowance: 1000000}));
    const st = await page.evaluate(() => {
      BF.onCredits({left: 999910, allowance: 1000000, banked: 0});
      openImport(false);
      return { hidden: document.getElementById('dumpshort').hidden,
               pill: (document.getElementById('credits') || {}).textContent };
    });
    check('an owner is never warned about a balance', st.hidden === true);
    check('and the pill still shows the sign rather than the figure',
      st.pill === '∞', st.pill);
    await page.close();
  }

  // ===================== what is actually on the sheet ======================
  /* Four paragraphs of prose stood between the title and the box. A writer
     with a notes file in their clipboard reads none of it. What stays in
     front of them is what to put in the box and what it costs. */
  {
    const { page } = await open(browser, PAID);
    const st = await page.evaluate(() => {
      openImport(false);
      const sheet = document.getElementById('sheetpaste');
      const visible = [...sheet.querySelectorAll('.sheet-note')]
        .filter(p => p.offsetParent !== null)
        .map(p => p.textContent.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return { visible,
               foldShut: document.getElementById('dumpmore').hidden,
               dot: !!document.getElementById('dumpinfo') };
    });
    check('there is an information dot', st.dot);
    check('and it starts shut', st.foldShut === true);
    /* IN THE CORNER OF THE TITLE ROW, not at the end of a line of italic
       serif where it was aligned by a hand-picked offset and never quite
       landed. What it opens covers the whole sheet, so it belongs to the
       sheet rather than to the last sentence before it. Measured as a
       centre line rather than asserted as a class, because a check that
       reads the markup cannot tell you whether it looks right. */
    const dot = await page.evaluate(() => {
      const b = document.getElementById('dumpinfo');
      const t = document.querySelector('#sheetpaste .sheet-title');
      const sheet = document.getElementById('sheetpaste');
      const rb = b.getBoundingClientRect(), rt = t.getBoundingClientRect();
      const rs = sheet.getBoundingClientRect();
      return {
        inNote: !!b.closest('.sheet-note'),
        offBy: Math.abs((rb.top + rb.height / 2) - (rt.top + rt.height / 2)),
        fromRight: Math.round(rs.right - rb.right),
        pastTitle: rb.left > rt.right,
        tuned: getComputedStyle(b).verticalAlign
      };
    });
    check('the dot is not hanging off a sentence', dot.inNote === false);
    check('it sits on the title\'s own centre line',
      dot.offBy <= 1.5, 'out by ' + dot.offBy.toFixed(1) + 'px');
    check('over in the corner, clear of the words',
      dot.pastTitle === true && dot.fromRight < 40,
      JSON.stringify(dot));
    check('and nothing is nudging it into place by hand',
      dot.tuned === 'baseline', dot.tuned);
    check('at most three lines stand between the title and the box',
      st.visible.length <= 3, JSON.stringify(st.visible));
    check('the price is one of them',
      st.visible.some(t => /costs 5 credits/.test(t)), JSON.stringify(st.visible));
    check('and so is what to put in the box',
      st.visible.some(t => /Paste your notes/.test(t)), JSON.stringify(st.visible));
    check('privacy is still said where the file is handed over',
      st.visible.some(t => /stay private/.test(t)), JSON.stringify(st.visible));

    const open2 = await page.evaluate(() => {
      document.getElementById('dumpinfo').click();
      const more = document.getElementById('dumpmore');
      const head = document.querySelector('#sheetpaste .sheet-head');
      return { shown: !more.hidden,
               says: more.textContent.replace(/\s+/g, ' ').trim(),
               below: Math.round(more.getBoundingClientRect().top
                                 - head.getBoundingClientRect().bottom),
               flag: document.getElementById('dumpinfo').getAttribute('aria-expanded') };
    });
    check('pressing the dot opens the rest', open2.shown === true);
    check('and it opens directly under the control that opened it',
      open2.below >= 0 && open2.below < 40, 'gap of ' + open2.below + 'px');
    check('and says so to a screen reader', open2.flag === 'true');
    check('the note limit is in there', /1,000 notes/.test(open2.says), open2.says);
    check('so is what happens to a file with more than one story in it',
      /more than one story/.test(open2.says), open2.says);
    check('and the privacy link', /never used to train a model/.test(open2.says),
      open2.says);
    /* THE PRICE IS NEVER TYPED INTO THIS PAGE OR INTO THIS TEST. Both read
       the same table, so the day the import price moves, neither goes stale
       and neither goes red for the wrong reason. */
    const live = await page.evaluate(() => CREDIT.import);
    check('every price on the sheet comes from the credit table',
      st.visible.some(t => t.includes('costs ' + live + ' credits')),
      'CREDIT.import is ' + live);
    await page.close();
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + ' of ' + results.length + ' passed');
  if (failed.length){
    console.log('\nFAILED:');
    failed.forEach(f => console.log('  ' + f.name));
    process.exit(1);
  }
})();
