/* HOW MANY STORIES ONE READ BUILDS, AND WHERE THE REST GO.

   One file can hold a slate. Three of them get boards; everything past the
   third is parked on the pile, where sorting by hand is free. The thing this
   suite exists for is the leak that was under it: a note the read routed to a
   fourth or fifth story fell into story ZERO, which is the board the writer is
   standing in, so another film's notes landed on their script. */
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
    document.getElementById('dumpgo').click();
    for (let i = 0; i < 80 && document.getElementById('sheetreview').hidden; i++)
      await new Promise(r => setTimeout(r, 50));
    return (plan || []).map(st => ({
      name: st.name, capped: !!st.capped, off: !!st.off,
      notes: st.notes.length,
      texts: st.notes.map(n => n.text)
    }));
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

    check('every story the read found is listed', got.length === 5,
      JSON.stringify(got.map(g => g.name)));
    check('the first three are buildable',
      got.slice(0, 3).every(g => !g.capped && !g.off),
      JSON.stringify(got.slice(0, 3)));
    check('the fourth and fifth are parked',
      got.slice(3).every(g => g.capped && g.off),
      JSON.stringify(got.slice(3)));
    check('and the parked ones still hold their own notes',
      got.slice(3).every(g => g.notes > 0),
      JSON.stringify(got.slice(3).map(g => g.notes)));
    check('no page errors reading a five story file', errors.length === 0,
      errors.join(' | '));

    /* The sheet has to SAY so, because a block with no controls on it and no
       explanation reads as the app having given up. */
    const said = await page.evaluate(() =>
      document.getElementById('revbody').textContent);
    check('the sheet says why they are not being built',
      /3 stories at most/.test(said) && /pile on your dashboard/.test(said),
      said.slice(0, 160));
    check('and offers no structure menu for a parked story',
      await page.evaluate(() =>
        document.querySelectorAll('#revbody .revnew select').length) === 2,
      'one menu per buildable extra story, and none for a parked one');
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
    const lines = spread(8);
    const got = await runImport(page, lines);
    const total = lines.length;
    const home = got.find(g => !g.capped) || {};
    const parked = got.filter(g => g.capped);
    check('nothing out of range reaches the board the writer is on',
      (home.notes || 0) === 0,
      home.notes + ' notes landed on ' + home.name);
    check('they land on a parked story instead',
      parked.length > 0 && parked.some(g => g.notes === total),
      JSON.stringify(got.map(g => [g.name, g.notes, g.capped])));
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
    const home = got[0] || {};
    check('an errand stays with the writer, not with the parked stories',
      !home.capped && home.notes === 6, JSON.stringify(got.map(g => [g.name, g.notes])));
    check('no page errors on an errand', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  /* ---- 4. The ordinary file is untouched. Two stories, both buildable. ---- */
  {
    const {page, errors} = await open(browser, [board('Night Haul', 6)]);
    await stubReader(page, ['ONE', 'TWO'], "function(n){ return n % 2; }");
    const got = await runImport(page, spread(10));
    check('a two story file caps nothing',
      got.length === 2 && got.every(g => !g.capped && !g.off),
      JSON.stringify(got.map(g => [g.name, g.capped])));
    check('no page errors on an ordinary file', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  const bad = results.filter(r => !r.ok).length;
  console.log('\n' + (results.length - bad) + '/' + results.length + ' passed');
  process.exit(bad ? 1 : 0);
})();
