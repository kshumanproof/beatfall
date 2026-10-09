/* HOW MANY STORIES ONE READ BUILDS, AND WHAT HAPPENS TO THE REST.

   One file can hold a slate. Three get boards and everything past the third is
   dropped, which is Kris's call: the case is rare and every other answer costs
   the writer a decision on a screen they are already reading carefully.

   The thing this suite exists for is the leak that was under it. A note the
   read routed to a fourth or fifth story fell into story ZERO, which is the
   board the writer is standing in, so another film's notes landed on their
   script. It also covers the screen that now stands in front of the charge,
   because every path through here goes past it. */
const { chromium } = require('playwright');
const path = require('path');
const PAGE = 'file://' + path.resolve('stub.html');

const results = [];
function check(name, ok, detail){
  results.push({name, ok});
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || !detail ? '' : '\n          ' + detail));
}

function board(name, filled, structure = 'stc'){
  const slots = ['open','theme','setup','cat','debate','br2','bstory','fun','mid','bad','lost','dark','br3','fin','last'];
  return {
    id: 'p-' + name.toLowerCase().replace(/\W/g,''), name, structure, brief: {}, outline: {},
    characters: [], is_sample: false, created_from: 'new_project',
    updated_at: '2026-09-01T00:00:00Z',
    cards: slots.slice(0, filled).map((s, i) => ({id: i+1, text: 'card for ' + s, slot: s, pinned: true}))
  };
}


/* EVERY LINE A DIFFERENT SUBJECT, AND NONE OF THEM SHORT.

   The first version of this fixture repeated one sentence with a number on the
   end, and foldNotes correctly folded the lot into a single note, because a
   short sentence whose subject is already above it finishes the moment above
   rather than starting a new one. The suite then measured one note and every
   story but the first came back empty. The fold is right; the fixture was
   wrong. */
const SUBJECTS = ['Mara', 'Rusk', 'the broker', 'Dale', 'the sheriff',
  'Lacey', 'the night clerk', 'Earl', 'Joyce', 'the fire marshal',
  'Ben', 'the developer', 'Sam', 'Carol', 'the shuttle driver',
  'Yvette', 'Marcus', 'the volunteer', 'Haskins', 'the commissioner'];
const DEEDS = ['walks the burned hallway before anybody else arrives',
  'refuses to sign the report and says so out loud in the car park',
  'drives to the creek and photographs the water line for an hour',
  'opens the desk and finds the carbon copies still in their sleeve',
  'calls the county office and is told to put it in writing',
  'burns the letter in the sink and watches it go',
  'waits outside the funeral home until the last car leaves',
  'counts the cash in the envelope twice and puts it back',
  'leaves the keys on the counter without saying anything',
  'reads the water report aloud to an empty kitchen'];
function spread(n){
  const out = [];
  for (let i = 0; i < n; i++)
    out.push(SUBJECTS[i % SUBJECTS.length] + ' ' + DEEDS[i % DEEDS.length]
      + ', and nobody in the building says a word about it afterwards.');
  return out;
}

const inDays = n => new Date(Date.now() + n * 86400000).toISOString();
const PAID = {email:'w@example.com', display_name:'Writer', plan:'beatfall',
  unlimited:false, trialing:false, credits_left:75, credits_allowance:75,
  credits_banked:0, current_period_end:inDays(19), has_history:true,
  plans:{beatfall:{credits:75,price:15}}, price_month:15, price_year:149};

async function open(browser, projects){
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/ERR_TUNNEL|ERR_FILE_NOT_FOUND|ERR_NAME_NOT_RESOLVED|favicon/.test(t))
      errors.push('console: ' + t);
  });
  await page.addInitScript(([a, p]) => {
    window.__ACCOUNT__ = a; window.__PROJECTS__ = p;
    window.__CLOSED__ = false; window.__REASON__ = null; window.__DAYS__ = [];
  }, [PAID, projects]);
  await page.goto(PAGE);
  await page.waitForTimeout(700);
  return {page, errors};
}

/* Stand in for the reader. Pass one answers a list of stories; every batch
   after it routes each note to the story this test wants it in; the casting
   call answers nothing, because where a note is PLACED is not what is being
   measured here. */
async function stubReader(page, storyNames, route){
  await page.evaluate(([names, routeSrc]) => {
    const where = eval('(' + routeSrc + ')');
    window.__CALLSEEN__ = [];
    let first = true;
    const reply = (prompt) => {
      window.__CALLSEEN__.push(String(prompt).slice(0, 60));
      if (first){
        first = false;
        return {brief: {}, people: [],
                stories: names.map(n => ({name: n, about: 'one line about ' + n}))};
      }
      // Which notes is this batch being shown? They arrive numbered.
      const nums = [...String(prompt).matchAll(/^(\d+)\.\s/gm)].map(m => Number(m[1]));
      if (!nums.length) return {};
      return {notes: nums.map(n => ({b: null, c: 0, d: false, k: 'beat',
                                     e: null, n: n, s: where(n)}))};
    };
    ai_sample = async function (p) { return {text: JSON.stringify(reply(p))}; };
    ai_sample.json = async function (p) { return reply(p); };
    ai_sample.limits = async () => ({images: false});
  }, [storyNames, route.toString()]);
}

async function runImport(page, lines){
  return page.evaluate(async (text) => {
    openImport(true);
    const box = document.getElementById('dumptext');
    box.value = text;
    box.dispatchEvent(new Event('input'));
    const fmt = document.getElementById('dumpformat');
    if (!document.getElementById('dumpformatfield').hidden){
      fmt.value = 'stc';
      fmt.dispatchEvent(new Event('change'));
    }
    /* Sort my notes no longer reads anything. It opens the screen that asks
       whether this file holds one story, and the SECOND press is the one that
       spends. Every check below goes through both, because a writer does. */
    document.getElementById('dumpgo').click();
    if (document.getElementById('sheetahead').hidden)
      throw new Error('the pre-charge screen did not open');
    document.getElementById('aheadgo').click();
    for (let i = 0; i < 80 && document.getElementById('sheetreview').hidden; i++)
      await new Promise(r => setTimeout(r, 50));
    return {
      stories: (plan || []).map(st => ({name: st.name, notes: st.notes.length})),
      over: JSON.parse(JSON.stringify(importOver)),
      said: (document.getElementById('revover') || {}).textContent || '',
      saidHidden: !!(document.getElementById('revover') || {}).hidden
    };
  }, lines.join('\n'));
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  /* ---- 1. Five stories in one file. Three build, two park. ---- */
  {
    const {page, errors} = await open(browser, [board('Night Haul', 6)]);
    const cap = await page.evaluate(() => MAX_IMPORT_STORIES);
    check('there is a cap and it is three', cap === 3, String(cap));

    await stubReader(page,
      ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'],
      // Note n belongs to story n % 5, so every story gets some.
      "function(n){ return n % 5; }");

    const got = await runImport(page, spread(20));

    check('only three stories come through', got.stories.length === 3,
      JSON.stringify(got.stories.map(g => g.name)));
    check('and they are the first three',
      got.stories.map(g => g.name).join(',') === 'ONE,TWO,THREE',
      JSON.stringify(got.stories.map(g => g.name)));
    check('every one of them has notes',
      got.stories.every(g => g.notes > 0),
      JSON.stringify(got.stories.map(g => g.notes)));
    check('the two it left out are counted', got.over.stories === 2,
      JSON.stringify(got.over));
    check('no page errors reading a five story file', errors.length === 0,
      errors.join(' | '));

    /* IT HAS TO SAY SO. A note count quietly smaller than the file is the one
       thing this app must never do, so a story left out is said out loud with
       the way to get it in. */
    check('the sheet says a story was left out',
      got.saidHidden === false && /2 more stories/.test(got.said)
      && /one sort covers three/.test(got.said), got.said.slice(0, 200));
    check('and says how to sort them',
      /on their own/.test(got.said), got.said.slice(0, 200));
    check('and that the writer\'s own file is untouched',
      /Nothing in your own file has changed/.test(got.said),
      got.said.slice(0, 200));
    await page.close();
  }

  /* ---- 2. THE LEAK. A note routed past the list must not land on the
     writer's own board. This is the whole reason the suite exists. ---- */
  {
    const {page, errors} = await open(browser, [board('Night Haul', 6)]);
    await stubReader(page,
      ['ONE', 'TWO', 'THREE', 'FOUR'],
      // Every note claims to belong to story 11, which is not on the list.
      "function(n){ return 11; }");
    const got = await runImport(page, spread(8));
    const home = got.stories[0] || {};
    check('nothing out of range reaches the board the writer is on',
      (home.notes || 0) === 0,
      home.notes + ' notes landed on ' + home.name);
    check('nothing out of range reaches any other board',
      got.stories.every(g => g.notes === 0),
      JSON.stringify(got.stories));
    check('and the dropped notes are counted', got.over.notes === 8,
      JSON.stringify(got.over));
    check('no page errors on an out of range story', errors.length === 0,
      errors.join(' | '));
    await page.close();
  }

  /* ---- 3. MINUS ONE IS AN ANSWER, NOT AN ERROR. An errand belongs on the
     writer's own shelf, where they typed it, and must not be swept into the
     parked pile with another film's notes. ---- */
  {
    const {page, errors} = await open(browser, [board('Night Haul', 6)]);
    await stubReader(page,
      ['ONE', 'TWO', 'THREE', 'FOUR'],
      "function(n){ return -1; }");
    const got = await runImport(page, spread(6));
    const home = got.stories[0] || {};
    check('an errand stays with the writer rather than being dropped',
      home.notes === 6, JSON.stringify(got.stories));
    /* The stub named four stories, so one IS over the cap and is reported.
       What must be zero is the NOTES dropped: an errand is not a story past
       the cap, it is a line on the writer's own shelf. */
    check('and no note is reported as dropped', got.over.notes === 0,
      JSON.stringify(got.over));
    check('no page errors on an errand', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  /* ---- 4. The ordinary file is untouched. Two stories, both buildable. ---- */
  {
    const {page, errors} = await open(browser, [board('Night Haul', 6)]);
    await stubReader(page, ['ONE', 'TWO'], "function(n){ return n % 2; }");
    const got = await runImport(page, spread(10));
    check('a two story file loses nothing',
      got.stories.length === 2 && got.over.stories === 0 && got.over.notes === 0,
      JSON.stringify(got));
    check('and says nothing about stories left out', got.saidHidden === true,
      got.said);
    check('no page errors on an ordinary file', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  /* ---- 5. THE SCREEN IN FRONT OF THE CHARGE.
     The one thing that matters here is that nothing is spent until the second
     press. ai_sample is the single door to the metered proxy, so counting
     presses on it is the honest measure of "was a credit spent": far better
     than watching the network, which under file:// goes nowhere and would
     make a spend look like a refusal. ---- */
  {
    const {page, errors} = await open(browser, [board('Night Haul', 6)]);
    await page.evaluate(() => {
      window.__ASKED__ = 0;
      ai_sample = async function () { window.__ASKED__++; return {text: '{}'}; };
      ai_sample.json = async function () { window.__ASKED__++; return {}; };
      ai_sample.limits = async () => ({images: false});
    });

    const first = await page.evaluate(async () => {
      openImport(true);
      const box = document.getElementById('dumptext');
      box.value = 'Mara walks the burned hallway before anybody else arrives, '
        + 'and nobody in the building says a word about it afterwards.';
      box.dispatchEvent(new Event('input'));
      const fmt = document.getElementById('dumpformat');
      if (!document.getElementById('dumpformatfield').hidden){
        fmt.value = 'stc';
        fmt.dispatchEvent(new Event('change'));
      }
      document.getElementById('dumpgo').click();
      await new Promise(r => setTimeout(r, 120));
      return {ahead: !document.getElementById('sheetahead').hidden,
              paste: !document.getElementById('sheetpaste').hidden,
              asked: window.__ASKED__,
              says: document.getElementById('sheetahead').textContent};
    });
    check('the first press opens the question, not the read',
      first.ahead === true && first.paste === false, JSON.stringify(first));
    check('AND NOTHING IS SPENT', first.asked === 0,
      'it sent ' + first.asked + ' calls, which is the charge');
    check('it asks the question Kris wrote',
      /more than one story/i.test(first.says), first.says.slice(0, 120));
    /* Whitespace collapsed, because the markup wraps these lines and a reader
       sees one sentence. */
    const flat = first.says.replace(/\s+/g, ' ');
    check('it names the cap in words', /up to three different stories/.test(flat),
      flat.slice(0, 200));
    check('and says the price with nothing charged yet',
      /Nothing has been charged yet/.test(flat), flat.slice(0, 300));

    /* GO BACK IS A REAL WAY OUT, not a restart. Everything typed is still
       there, so the writer can split the file and try again. */
    const back = await page.evaluate(async () => {
      document.getElementById('aheadback').click();
      await new Promise(r => setTimeout(r, 60));
      return {paste: !document.getElementById('sheetpaste').hidden,
              ahead: !document.getElementById('sheetahead').hidden,
              kept: document.getElementById('dumptext').value.length,
              asked: window.__ASKED__};
    });
    check('Go back returns to the notes', back.paste === true && back.ahead === false,
      JSON.stringify(back));
    check('with every word still in the box', back.kept > 40, String(back.kept));
    check('and still nothing spent', back.asked === 0, String(back.asked));

    /* A stray click outside must not throw the paste away either. */
    const stray = await page.evaluate(async () => {
      document.getElementById('dumpgo').click();
      await new Promise(r => setTimeout(r, 60));
      document.getElementById('scrim').click();
      await new Promise(r => setTimeout(r, 60));
      return {ahead: !document.getElementById('sheetahead').hidden,
              kept: document.getElementById('dumptext').value.length};
    });
    check('a click outside it changes nothing', stray.ahead === true,
      JSON.stringify(stray));
    check('and the notes are still there', stray.kept > 40, String(stray.kept));

    // And Escape steps back rather than out of the whole box.
    const esc = await page.evaluate(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      await new Promise(r => setTimeout(r, 60));
      return {paste: !document.getElementById('sheetpaste').hidden,
              kept: document.getElementById('dumptext').value.length};
    });
    check('Escape is Go back, not a way out of the box',
      esc.paste === true && esc.kept > 40, JSON.stringify(esc));

    // The second press is the one that reads.
    const go = await page.evaluate(async () => {
      document.getElementById('dumpgo').click();
      await new Promise(r => setTimeout(r, 60));
      document.getElementById('aheadgo').click();
      await new Promise(r => setTimeout(r, 300));
      return {asked: window.__ASKED__,
              ahead: !document.getElementById('sheetahead').hidden};
    });
    check('the second press is the one that reads', go.asked > 0,
      'it sent ' + go.asked + ' calls');
    check('and the question is out of the way', go.ahead === false);
    check('no page errors around the question', errors.length === 0,
      errors.join(' | '));
    await page.close();
  }

  await browser.close();
  const bad = results.filter(r => !r.ok).length;
  console.log('\n' + (results.length - bad) + '/' + results.length + ' passed');
  process.exit(bad ? 1 : 0);
})();
