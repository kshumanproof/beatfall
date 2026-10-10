/* ONE PARAGRAPH, MANY IDEAS.

   Writers do not always press Enter. Kris pasted all fifteen beats of a story
   as a single paragraph, opening "TITLE: THE SAFE THING Maya Hollis, 32,
   wakes...", and the sheet said it could find no story notes at all. Two
   rules threw the whole story away: a line starting TITLE: is a title line,
   and a note containing the title is a copy of the title. Both were written
   for a file with line breaks in it.

   The fixtures below are Kris's own text, 10 October 2026. */
const { chromium } = require('playwright');
const path = require('path');
const PAGE = 'file://' + path.resolve('stub.html');

const results = [];
function check(name, ok, detail){
  results.push({name, ok});
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || !detail ? '' : '\n          ' + detail));
}

const SAFE = "TITLE: THE SAFE THING Maya Hollis, 32, wakes before dawn in the apartment above her struggling neighborhood bakery and opens the shop alone while the rest of the block is still dark, moving through the same routine she has followed for years and clearly feeling stuck in it. Her teenage niece Tess, who helps before school, tells Maya that “you can keep doing the safe thing until there’s nothing left to save,” and Maya brushes it off. Maya learns that the building owner plans to sell the property, and unless she can come up with enough money to buy the bakery space within six weeks, the new buyer will likely force her out. Maya initially decides there is no realistic way she can afford it and starts looking at jobs elsewhere, telling herself that maybe losing the bakery is the push she needs to leave the neighborhood anyway. She then discovers an old recipe notebook that belonged to her late grandmother, including a handwritten note about a citywide baking competition with a large cash prize, and Maya decides to enter even though she has not competed since culinary school. Preparing for the contest forces Maya to work with Noah, 35, a local restaurant owner she used to date and still resents because he left town years earlier without explaining why. Maya begins testing elaborate versions of her grandmother’s recipes, dragging Tess and the bakery regulars into tastings, experimenting with flavors she would normally consider too risky, and slowly rediscovering how much she actually loves baking when she is creating instead of merely surviving. At the first major round of the competition, Maya shocks herself by placing first, the bakery gets a rush of new customers after local press covers her win, and for the first time buying the building starts to feel genuinely possible. As the competition gets harder, the bakery becomes overwhelmed, an expensive oven breaks, Maya and Noah begin fighting over whether she is honoring her grandmother’s recipes or hiding behind them, and a rival baker publicly suggests Maya is only getting attention because of her family story. Tess then learns that Maya has secretly been applying for bakery jobs in other cities and feels betrayed, while Noah admits he came back because his father was sick and he never told Maya because he was ashamed of how badly he handled leaving. Just before the final round, Maya’s landlord accepts an offer from another buyer, meaning that even if Maya wins the prize, she may already be too late to save the bakery. Maya closes the shop early, sits alone in the dark kitchen, and realizes that she has spent years telling herself she stayed because of her grandmother when the truth is that she was afraid to risk becoming something different. Maya decides the bakery itself is not the thing she has to preserve, and instead of recreating one of her grandmother’s signature cakes for the final, she creates a completely new dessert inspired by the old recipes but unmistakably her own. Maya does not win first place, but her final dish impresses an investor who offers to help her open a new bakery on better terms, and Maya chooses to leave the old location rather than destroy herself trying to keep it. Several months later, Maya opens the doors of a brighter new bakery across town, Tess puts up the first tray of pastries, Noah arrives carrying coffee, and Maya pauses for a moment before turning the sign from CLOSED to OPEN.";
const JOGGER = "New Day - man jogging through town. Airbuds. Everyone everywhere is locked to a screen. A tone plays. A message in seven languages with music. Man notices nothing. Returns home. Comes inside. Talks to family while making smoothie. Family are locked in on their devices. The tone has them. Just as he finishes, removes his earbuds, the tone stops. Everything/everyone immediately returns to normal\u2014as if nothing happened.\n\nWhat HAS happened is that an alien race (or perhaps a foreign country) has used MK-Ultra type tech to subconsciously implant murderous instincts into citizens. When the song/phrase is heard, the person flys into a murderous rage, displaying near superhuman/spec forces abilities.\n\nour jogger is the only normal man left on earth/in the country, and must figure out how to survive and reverse the signal.";

const inDays = n => new Date(Date.now() + n * 86400000).toISOString();
const PAID = {email:'w@example.com', display_name:'Writer', plan:'beatfall',
  unlimited:false, trialing:false, credits_left:75, credits_allowance:75,
  credits_banked:0, current_period_end:inDays(19), has_history:true,
  plans:{beatfall:{credits:75,price:15}}, price_month:15, price_year:149};

async function open(browser){
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(([a]) => {
    window.__ACCOUNT__ = a; window.__PROJECTS__ = [];
    window.__CLOSED__ = false; window.__REASON__ = null; window.__DAYS__ = [];
  }, [PAID]);
  await page.goto(PAGE);
  await page.waitForTimeout(700);
  return {page, errors};
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const {page, errors} = await open(browser);

  /* ---- step 1: a label glued to the story it introduces ---- */
  const u = await page.evaluate(() => [
    unglueHeaders("TITLE: NIGHT HAUL A trucker named Dale hauls stolen cars across three states at night and starts to wonder who he works for."),
    unglueHeaders("Title: The Long Way Down. A woman climbs down a mountain for nine days after her brother dies on it and she refuses rescue."),
    unglueHeaders("Title: Night Haul"),
    unglueHeaders("Title: a lowercase thing with no full stop that rambles on and on for well over one hundred and twenty characters total ok")
  ]);
  check('a title in capitals is cut off the story it is glued to',
    u[0].split('\n')[0] === 'TITLE: NIGHT HAUL', u[0]);
  check('and a lone A after it is handed back to the sentence it starts',
    /^A trucker/.test(u[0].split('\n')[1] || ''), u[0]);
  check('a title ending in a full stop is cut at the full stop',
    u[1].split('\n')[0] === 'Title: The Long Way Down.', u[1]);
  check('a title line on its own is left exactly as it is', u[2] === 'Title: Night Haul', u[2]);
  check('a long line with nowhere sensible to cut is not cut somewhere invented',
    !u[3].includes('\n'), u[3]);

  const safe = await page.evaluate((raw) => {
    const r = unglueHeaders(raw);
    return { name: (localBrief(r) || {}).name || '', notes: splitForImport(r).map(n => n.text.length) };
  }, SAFE);
  check('the one-paragraph story keeps its title as the title', safe.name === 'THE SAFE THING', safe.name);
  check('and the story itself is no longer thrown away',
    safe.notes.length >= 1 && safe.notes.reduce((a, b) => a + b, 0) > 3000, JSON.stringify(safe.notes));

  const kept = await page.evaluate(() => ({
    contains: splitForImport("Title: The Safe Thing\nTess says you can keep doing the safe thing until there is nothing left to save, and Maya brushes it off.").length,
    copy: splitForImport("Title: The Safe Thing\nThe Safe Thing").length
  }));
  check('a note that only MENTIONS the title is kept', kept.contains === 1, JSON.stringify(kept));
  check('a bare copy of the title is still not a note', kept.copy === 0, JSON.stringify(kept));

  const jog = await page.evaluate((raw) => splitForImport(unglueHeaders(raw)).map(n => n.text.length), JOGGER);
  check('notes with paragraph breaks come through exactly as before',
    jog.length === 3 && jog[0] > 400, JSON.stringify(jog));

  /* ---- steps 2 and 3: pressing Sort my notes, the way a writer does ----
     A fresh page each time, so one run's sheet cannot leak into the next. The
     reader is a stand-in that counts every question put to it, because the
     paid read is the only door to the metered proxy and counting knocks on it
     is the honest measure of a spend. */
  async function sortOn(text){
    const {page: pg, errors: errs} = await open(browser);
    const out = await pg.evaluate(async (text) => {
      window.__ASKED__ = 0;
      let first = true;
      const reply = (prompt) => {
        window.__ASKED__++;
        if (first){ first = false; return {brief: {}, people: [], stories: [{name: 'Main', about: ''}]}; }
        const nums = [...String(prompt).matchAll(/^(\d+)\.\s/gm)].map(m => Number(m[1]));
        return nums.length ? {notes: nums.map(n => ({b: null, c: 0, d: false, k: 'beat', e: null, n, s: 0}))} : {};
      };
      ai_sample = async (p) => ({text: JSON.stringify(reply(p))});
      ai_sample.json = async (p) => reply(p);
      ai_sample.limits = async () => ({images: false});
      openImport(true);
      const box = document.getElementById('dumptext');
      box.value = text; box.dispatchEvent(new Event('input'));
      const fmt = document.getElementById('dumpformat');
      if (!document.getElementById('dumpformatfield').hidden){ fmt.value = 'stc'; fmt.dispatchEvent(new Event('change')); }
      document.getElementById('dumpgo').click();
      document.getElementById('aheadgo').click();
      // Done when the review sheet opens, or when the paste sheet's button is back.
      for (let i = 0; i < 100; i++){
        await new Promise(r => setTimeout(r, 50));
        if (!document.getElementById('sheetreview').hidden) break;
        if (!document.getElementById('dumpgo').disabled && !/Reading/.test(document.getElementById('dumpgo').textContent)) break;
      }
      return {asked: window.__ASKED__,
              review: !document.getElementById('sheetreview').hidden,
              said: document.getElementById('dumpcount').textContent,
              name: (plan && plan[0] && plan[0].name) || '',
              notes: (plan || []).reduce((n, st) => n + st.notes.length, 0)};
    }, text);
    out.errors = errs;
    await pg.close();
    return out;
  }

  const bare = await sortOn("Title: The Safe Thing\nGenre: drama");
  check('a paste with nothing to sort never reaches the paid read', bare.asked === 0, JSON.stringify(bare));
  check('and the sheet says nothing was charged', /Nothing was charged/.test(bare.said), bare.said);
  check('and does not claim a read happened', !/read your notes/.test(bare.said), bare.said);

  const run = await sortOn(SAFE);
  check('the one-paragraph story reaches the review sheet', run.review, JSON.stringify(run));
  check('with the story on it, not an empty read', run.notes >= 1, JSON.stringify(run));
  check('and the project is named from the title, not from the whole paragraph',
    run.name === 'THE SAFE THING' || run.name === 'The Safe Thing', run.name);
  check('no page errors during either sort', !bare.errors.length && !run.errors.length,
    bare.errors.concat(run.errors).join('\n'));

  /* ---- step 4: one note that is really several ----
     The reader only points at sentence numbers and the cutting is done on the
     writer's own string, so these checks are about what the CODE does with an
     answer: a good one, a nonsense one, a failed call and no answer at all. */
  const unit = await page.evaluate(() => {
    const t = 'Maya opens the shop. Tess helps "before school." Noah arrives! Is it late? 3 days pass.';
    const st = sentenceStarts(t);
    return {
      count: st.length,
      good: cutAt(t, st, [3, 5]),
      one: cutAt(t, st, [1]),
      past: cutAt(t, st, [9]),
      order: cutAt(t, st, [4, 3]),
      dup: cutAt(t, st, [3, 3]),
      frac: cutAt(t, st, [2.5]),
      none: cutAt(t, st, []),
      junk: cutAt(t, st, 'three')
    };
  });
  check('sentences are found where they start, quotes and numbers included', unit.count === 5, JSON.stringify(unit));
  check('a sensible answer cuts the note in the writer\'s own words',
    JSON.stringify(unit.good) === JSON.stringify(['Maya opens the shop. Tess helps "before school."', 'Noah arrives! Is it late?', '3 days pass.']),
    JSON.stringify(unit.good));
  check('a cut before the first sentence is refused', unit.one === null, JSON.stringify(unit.one));
  check('a cut past the last sentence is refused', unit.past === null, JSON.stringify(unit.past));
  check('cuts out of order or repeated are refused', unit.order === null && unit.dup === null, '');
  check('anything that is not a whole sentence number is refused',
    unit.frac === null && unit.none === null && unit.junk === null, '');

  /* A reader stand-in for the whole read. `splitWith(prompt)` answers the
     splitting question; everything else is answered as stories.js does. */
  async function sortWith(text, splitSrc){
    const {page: pg, errors: errs} = await open(browser);
    const out = await pg.evaluate(async ([text, splitSrc]) => {
      const splitWith = eval('(' + splitSrc + ')');
      window.__SPLITASKED__ = []; window.__ASKED__ = 0;
      let first = true;
      const reply = (prompt) => {
        window.__ASKED__++;
        if (first){ first = false; return {brief: {}, people: [], stories: [{name: 'Main', about: ''}]}; }
        if (/Your only job is to say where/.test(prompt)){ window.__SPLITASKED__.push(prompt); return splitWith(prompt); }
        const nums = [...String(prompt).matchAll(/^(\d+)\.\s/gm)].map(m => Number(m[1]));
        return nums.length ? {notes: nums.map(n => ({b: null, c: 0, d: false, k: 'beat', e: null, n, s: 0}))} : {};
      };
      ai_sample = async (p) => ({text: JSON.stringify(reply(p))});
      ai_sample.json = async (p) => reply(p);
      ai_sample.limits = async () => ({images: false});
      openImport(true);
      const box = document.getElementById('dumptext');
      box.value = text; box.dispatchEvent(new Event('input'));
      const fmt = document.getElementById('dumpformat');
      if (!document.getElementById('dumpformatfield').hidden){ fmt.value = 'stc'; fmt.dispatchEvent(new Event('change')); }
      document.getElementById('dumpgo').click();
      document.getElementById('aheadgo').click();
      for (let i = 0; i < 100; i++){
        await new Promise(r => setTimeout(r, 50));
        if (!document.getElementById('sheetreview').hidden) break;
        if (!document.getElementById('dumpgo').disabled && !/Reading/.test(document.getElementById('dumpgo').textContent)) break;
      }
      return {review: !document.getElementById('sheetreview').hidden,
              said: document.getElementById('dumpcount').textContent,
              splitPrompts: window.__SPLITASKED__.length,
              splitPrompt: window.__SPLITASKED__[0] || '',
              texts: (plan || []).flatMap(st => st.notes.map(n => n.text))};
    }, [text, splitSrc.toString()]);
    out.errors = errs;
    await pg.close();
    return out;
  }
  const squash = t => t.replace(/\s+/g, ' ').trim();
  // Cut at every sentence the prompt numbered for the note.
  const everySentence = (prompt) => {
    const cuts = [];
    String(prompt).split(/\nNOTE /).forEach(block => {
      const n = Number((block.match(/^(?:NOTE )?(\d+):/) || [])[1]);
      const k = (block.match(/^\s+\[\d+\]/gm) || []).length;
      if (k > 1) cuts.push({n, at: Array.from({length: k - 1}, (_, j) => j + 2)});
    });
    return {cuts};
  };

  const cut = await sortWith(SAFE, everySentence);
  const sentences = await page.evaluate((t) => sentenceStarts(t).length, SAFE.replace(/^TITLE: THE SAFE THING\s*/, ''));
  check('the splitting question is asked once for the whole paste, not once per note',
    cut.splitPrompts === 1, String(cut.splitPrompts));
  check('the one-paragraph story comes apart into its separate moments',
    cut.review && cut.texts.length === sentences && sentences >= 15,
    cut.texts.length + ' pieces from ' + sentences + ' sentences');
  check('every piece is the writer\'s own words, found exactly in what they pasted',
    cut.texts.every(t => SAFE.includes(t)), cut.texts.find(t => !SAFE.includes(t)) || '');
  check('and nothing is lost or doubled: the pieces put back together are the story',
    squash(cut.texts.join(' ')) === squash(SAFE.replace(/^TITLE: THE SAFE THING\s*/, '')), '');

  const many = await sortWith(JOGGER, everySentence);
  check('several notes are offered in ONE question, not one question each',
    many.splitPrompts === 1 && (many.splitPrompt.match(/^NOTE \d+:/gm) || []).length === 2,
    many.splitPrompts + ' questions');

  const nonsense = await sortWith(SAFE, () => ({cuts: [{n: 0, at: [0, 99]}, {n: 7, at: [2]}]}));
  check('a nonsense answer keeps the note whole', nonsense.review && nonsense.texts.length === 1,
    JSON.stringify(nonsense.texts.map(t => t.length)));

  const broken = await sortWith(SAFE, () => { throw new Error('provider fell over'); });
  check('a failed splitting call keeps the note whole and the read carries on',
    broken.review && broken.texts.length === 1, JSON.stringify(broken));

  const whole = await sortWith(JOGGER, () => ({cuts: []}));
  check('a reader that cuts nothing changes nothing', whole.review && whole.texts.length === 3,
    JSON.stringify(whole.texts.map(t => t.length)));

  const declared = await sortWith("MIDPOINT:\nMaya places first. The bakery gets a rush. Buying the building feels possible.\nTess learns about the job applications. She feels betrayed.", everySentence);
  check('a note the writer declared under a heading is never offered for splitting',
    !/Maya places first/.test(declared.splitPrompt) && /Tess learns/.test(declared.splitPrompt), declared.splitPrompt);
  check('no page errors during the splitting runs',
    [cut, many, nonsense, broken, whole, declared].every(r => !r.errors.length),
    [cut, many, nonsense, broken, whole, declared].flatMap(r => r.errors).join('\n'));

  check('no page errors', errors.length === 0, errors.join('\n'));
  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log('\n' + (results.length - failed) + ' of ' + results.length + ' passed');
  process.exit(failed ? 1 : 0);
})();
