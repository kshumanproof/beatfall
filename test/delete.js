/* THE DOUBLE DELETE ON THE LAST PROJECT.

   Three earlier attempts to reproduce this offline failed, and the reason they
   failed is the stub: BF.saveProject and BF.deleteProject both resolve
   instantly and neither keeps any state, so a save racing a delete cannot be
   seen and a save landing on a row that is already gone answers success.

   This driver puts a real server behind them: a map of rows, a delay on every
   request, a DELETE that removes a row, and a save against a missing row that
   answers 404 the way api/projects.js does. Then it presses Delete the way
   Kris does and counts how many times the confirm box has to be answered. */
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

const inDays = n => new Date(Date.now() + n * 86400000).toISOString();
const PAID = {email:'w@example.com', display_name:'Writer', plan:'beatfall',
  unlimited:false, trialing:false, credits_left:75, credits_allowance:75,
  credits_banked:0, current_period_end:inDays(19), has_history:true,
  plans:{beatfall:{credits:75,price:15}}, price_month:15, price_year:149};

async function open(browser, projects, lag){
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/ERR_TUNNEL|ERR_FILE_NOT_FOUND|ERR_NAME_NOT_RESOLVED|favicon/.test(t))
      errors.push('console: ' + t);
  });
  await page.addInitScript(([a, p, ms]) => {
    window.__ACCOUNT__ = a; window.__PROJECTS__ = p;
    window.__CLOSED__ = false; window.__REASON__ = null;
    window.__DAYS__ = []; window.__LAG__ = ms;
  }, [PAID, projects, lag]);
  await page.goto(PAGE);
  // Swap in a server with state, now that the stub's BF exists.
  await page.evaluate(() => {
    const lag = window.__LAG__ || 0;
    const rows = new Map();
    (window.__PROJECTS__ || []).forEach(p => rows.set(p.id, p));
    window.__ROWS__ = rows;
    window.__LOG__ = [];
    const wait = () => new Promise(r => setTimeout(r, lag));
    window.BF.saveProject = async p => {
      window.__LOG__.push('save:' + (p.id || 'new') + ':' + p.name);
      await wait();
      if (p.id){
        if (!rows.has(p.id)){
          // What api/projects.js answers when the update matches no row.
          const e = new Error('This project no longer exists.');
          e.status = 404; e.code = 'not_found';
          window.__LOG__.push('save404:' + p.id);
          throw e;
        }
        rows.set(p.id, p);
        return Object.assign({}, p, {updated_at: new Date().toISOString()});
      }
      const id = 'srv-' + rows.size;
      rows.set(id, Object.assign({}, p, {id: id}));
      return Object.assign({}, p, {id: id, updated_at: new Date().toISOString()});
    };
    window.BF.deleteProject = async id => {
      window.__LOG__.push('delete:' + id);
      await wait();
      rows.delete(id);
      return {ok: true};
    };
    window.BF.checkpoint = async () => { await wait(); return {ok: true}; };
  });
  await page.waitForTimeout(700);
  return {page, errors};
}

/* Press Delete on the named card and answer the confirm box. Counts how many
   confirms were raised, because "click delete and the ok twice" is a count. */
async function pressDelete(page, name){
  let confirms = 0;
  const handler = async d => { confirms++; await d.accept(); };
  page.on('dialog', handler);
  const hit = await page.evaluate(n => {
    const cards = [...document.querySelectorAll('#slategrid .pcard')];
    const card = cards.find(c => (c.querySelector('h3') || {}).textContent
      && c.querySelector('h3').textContent.trim().toUpperCase() === n.toUpperCase());
    if (!card) return false;
    const del = [...card.querySelectorAll('button')].find(b => b.textContent.trim() === 'Delete');
    if (!del) return false;
    del.click();
    return true;
  }, name);
  await page.waitForTimeout(80);
  page.off('dialog', handler);
  return {hit, confirms};
}

async function shelf(page){
  return page.evaluate(() => [...document.querySelectorAll('#slategrid .pcard h3')]
    .map(h => h.textContent.trim()));
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  /* ---- 1. No latency, no pending edit: the case that always passed. ---- */
  {
    const {page, errors} = await open(browser, [board('ALPHA', 5), board('BETA', 3)], 0);
    const a = await pressDelete(page, 'ALPHA');
    await page.waitForTimeout(400);
    const b = await pressDelete(page, 'BETA');
    await page.waitForTimeout(600);
    const left = await shelf(page);
    const rows = await page.evaluate(() => [...window.__ROWS__.keys()]);
    check('clean: one confirm each', a.confirms === 1 && b.confirms === 1,
      'alpha ' + a.confirms + ' beta ' + b.confirms);
    check('clean: shelf empty after both', left.length === 0, JSON.stringify(left));
    check('clean: server holds nothing', rows.length === 0, JSON.stringify(rows));
    check('clean: no page error', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  /* ---- 2. A pending edit on the LAST project, then delete it. ----
     This is the shape of what Kris does: he is working, he deletes. save() is
     on a 700ms debounce, so an edit inside that window is still queued when
     the delete goes. */
  {
    const {page, errors} = await open(browser, [board('ALPHA', 5), board('GAMMA', 3)], 120);
    await pressDelete(page, 'ALPHA');
    await page.waitForTimeout(500);
    // Touch the last project so it is dirty and a flush is pending.
    await page.evaluate(() => {
      const p = state.projects[0];
      p.characters.push({name: 'Edited Person'});
      save();
    });
    await page.waitForTimeout(40);              // inside the 700ms debounce
    const g = await pressDelete(page, 'GAMMA');
    await page.waitForTimeout(1500);
    const left = await shelf(page);
    const rows = await page.evaluate(() => [...window.__ROWS__.keys()]);
    const log = await page.evaluate(() => window.__LOG__.slice());
    const strip = await page.evaluate(() => {
      const el = document.getElementById('rescue') || document.querySelector('.strip, #strip');
      return el ? el.textContent.trim().slice(0, 120) : '';
    });
    const saved = await page.evaluate(() => {
      const el = document.getElementById('savedot') || document.querySelector('.saved, #saved');
      return el ? el.textContent.trim().slice(0, 80) : '';
    });
    check('pending edit: one confirm', g.confirms === 1, 'confirms ' + g.confirms);
    check('pending edit: shelf empty', left.length === 0, JSON.stringify(left));
    check('pending edit: server holds nothing', rows.length === 0, JSON.stringify(rows));
    check('pending edit: no retry loop', log.filter(x => x.indexOf('save404') === 0).length === 0,
      log.join(' | '));
    check('pending edit: nothing says unsaved', !/not saved|Retrying/i.test(saved + ' ' + strip),
      'saved=' + saved + ' strip=' + strip);
    check('pending edit: no page error', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  /* ---- 3. The save already IN FLIGHT when the delete goes. ----
     dirty.delete(p) cannot help here: flush() copied the queue and cleared
     dirty before the delete was pressed. */
  {
    const {page, errors} = await open(browser, [board('DELTA', 4)], 300);
    await page.evaluate(() => {
      const p = state.projects[0];
      p.characters.push({name: 'Edited Person'});
      save();
    });
    await page.waitForTimeout(800);             // flush has fired, request in flight
    const d = await pressDelete(page, 'DELTA');
    await page.waitForTimeout(2500);
    const left = await shelf(page);
    const rows = await page.evaluate(() => [...window.__ROWS__.keys()]);
    const log = await page.evaluate(() => window.__LOG__.slice());
    const saved = await page.evaluate(() => {
      const el = document.getElementById('savedot') || document.querySelector('.saved, #saved');
      return el ? el.textContent.trim().slice(0, 80) : '';
    });
    check('in flight: one confirm', d.confirms === 1, 'confirms ' + d.confirms);
    check('in flight: shelf empty', left.length === 0, JSON.stringify(left));
    check('in flight: server holds nothing', rows.length === 0, JSON.stringify(rows));
    check('in flight: no endless retry', log.filter(x => x.indexOf('save404') === 0).length === 0,
      log.join(' | '));
    check('in flight: nothing says unsaved', !/not saved|Retrying/i.test(saved),
      'saved=' + saved);
    await page.close();
  }

  /* ---- 4. Delete the last project twice over, watching the dialog. ----
     If the first press leaves the card on the shelf, this finds it. */
  {
    const {page, errors} = await open(browser, [board('OMEGA', 6)], 150);
    const before = await shelf(page);
    const o = await pressDelete(page, 'OMEGA');
    await page.waitForTimeout(100);             // what the writer sees at once
    const instant = await shelf(page);
    await page.waitForTimeout(1200);
    const after = await shelf(page);
    const again = await pressDelete(page, 'OMEGA');
    check('last: card was on the shelf', before.length === 1, JSON.stringify(before));
    check('last: gone the moment it is confirmed', instant.length === 0, JSON.stringify(instant));
    check('last: still gone once the server answers', after.length === 0, JSON.stringify(after));
    check('last: nothing left to delete a second time', again.hit === false, 'found a card again');
    await page.close();
  }

  /* ---- 5. THE CONFIRM BOX GIVES THE WINDOW ITS FOCUS BACK. ----
     app.html binds refreshOnReturn to window focus, and dismissing a native
     confirm() fires focus. The delete request sits behind a checkpoint write,
     so when that reload runs the server still has the project, and the reload
     rebuilds state.projects from the server rows. The card comes back and the
     writer presses Delete a second time. */
  {
    const {page, errors} = await open(browser, [board('ZETA', 6)], 250);
    let confirms = 0;
    page.on('dialog', async d => {
      confirms++;
      await d.accept();
      // What a real browser does the instant the dialog closes.
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    });
    await page.evaluate(() => {
      const card = document.querySelector('#slategrid .pcard');
      [...card.querySelectorAll('button')].find(b => b.textContent.trim() === 'Delete').click();
    });
    await page.waitForTimeout(900);
    const left = await shelf(page);
    await page.waitForTimeout(1200);
    const settled = await shelf(page);
    const rows = await page.evaluate(() => [...window.__ROWS__.keys()]);
    check('focus: one confirm answered', confirms === 1, 'confirms ' + confirms);
    check('focus: card does not come back', left.length === 0, 'shelf shows ' + JSON.stringify(left));
    check('focus: still gone once it all settles', settled.length === 0, JSON.stringify(settled));
    check('focus: server holds nothing', rows.length === 0, JSON.stringify(rows));
    await page.close();
  }

  await browser.close();
  const bad = results.filter(r => !r.ok).length;
  console.log('\n' + (results.length - bad) + '/' + results.length + ' passed');
  process.exit(bad ? 1 : 0);
})();
