/* LOOK AT THE ACTUAL PDF.
 *
 * The suite's jsPDF is a stand-in that records what it was ASKED to draw, which
 * proves the right words reach the page and proves nothing at all about where
 * they land. Two real defects lived happily under a green suite: every card in
 * the outline ran off the right edge of the paper, and the cover's standing line
 * printed straight through the date.
 *
 * So this runs the shipped exportPDF against the real library and writes a file
 * you can open. It is not part of the suite and nothing fails here; it exists so
 * that anybody changing the document can see what they did.
 *
 *   cd test
 *   cp ../public/app.html .   ;   node mkstub.js   ;   node render-pdf.js
 *
 * It writes test/sample.pdf. To look at it page by page without a viewer:
 *
 *   pdftoppm -png -r 80 sample.pdf pg
 *
 * The fixture below is deliberately awkward: long cards that must wrap, filed
 * notes of three different kinds, empty beats, prose in two passages, a set
 * aside pile, and loose notes. If it looks right on this, it looks right.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// The stub with its fake jsPDF swapped for the real one, and save() diverted
// into a data URI so this process can write the bytes out.
function buildPage(){
  let html = fs.readFileSync(path.resolve(__dirname, 'stub.html'), 'utf8');
  const start = html.indexOf('window.jspdf = { jsPDF: function(){');
  if (start < 0) throw new Error('stub.html has no stand-in jsPDF. Run node mkstub.js first.');
  const end = html.indexOf('}};', start) + 3;
  const real = fs.readFileSync(
    path.resolve(__dirname, 'node_modules/jspdf/dist/jspdf.umd.js'), 'utf8');
  html = html.slice(0, start) + real
    + '\nwindow.jspdf = window.jspdf || jspdf;\n'
    + '(function(){ const R = window.jspdf.jsPDF;\n'
    + '  window.jspdf = { jsPDF: function(o){ const d = new R(o);\n'
    + '    d.save = function(){ window.__OUT__ = d.output("datauristring"); return d; };\n'
    + '    return d; } };\n'
    + '})();\n'
    + html.slice(end);
  const out = path.resolve(__dirname, 'stub-realpdf.html');
  fs.writeFileSync(out, html);
  return 'file://' + out;
}

const PROJECT = {
  id: 'p-southbound', name: 'SOUTHBOUND', structure: 'stc',
  brief: {
    log: 'A bartender who has spent twenty years knowing everything about everyone '
       + 'finds out the one thing she was never told.',
    genre: 'Crime drama',
    like: 'Patient, plainspoken, mean when it has to be',
    setting: 'A two-lane town in south Georgia',
    who: 'Mara Vance, 51'
  },
  outline: {
    open: ['Dawn over the lot. The sign is still on from last night.'],
    theme: ['A man comes into Mara’s bar at four in the afternoon and asks for the '
          + 'phone. Mara has not seen a stranger ask for a phone in nine years.',
            'She gives it to him. He dials, says nothing, and hangs up.']
  },
  characters: [{
    id: 'c1', name: 'Mara Vance', role: 'Protagonist',
    want: 'To keep the bar and keep it hers.',
    need: 'To learn that knowing the truth and being able to fix it are not the same thing.',
    flaw: 'She mistakes information for control.'
  }],
  is_sample: false, created_from: 'new_project', updated_at: '2026-09-01T00:00:00Z',
  cards: [
    {id:1, slot:'open',  declared:true, text:'A man finds a duffel bag full of cash buried behind his new house. He decides to keep it, then sees a news report about the violent robbery it came from.'},
    {id:2, slot:'theme', declared:true, text:'Character note: Mara wants control more than almost anything. What she actually needs is to learn that knowing the truth and being able to fix it are not the same thing.'},
    {id:3, slot:'theme', declared:true, text:'The stranger leaves a twenty on the bar for a phone call he did not pay for.'},
    {id:4, slot:'mid',   declared:true, text:'Halfway through, she realises the money was never the point.'},
    {id:5, slot:'__shelf', kind:'structural', attachedTo:'theme', text:'I am thinking of calling this SOUTHBOUND.'},
    {id:6, slot:'__shelf', kind:'clue',       attachedTo:'theme', text:'Hostages are being held in a bank vault four counties over, and nobody in town knows yet.'},
    {id:7, slot:'__shelf', kind:'line',     text:'"You can know a thing and still be no use to anybody."'},
    {id:8, slot:'__shelf', kind:'research', text:'Check how long a rural sheriff can hold somebody without charging them in Georgia.'},
    {id:9,  slot:'__none', text:'A note that reached the board and never found a beat.'},
    {id:10, slot:'__none', text:'Another one waiting in the rail.'}
  ]
};

/* The suites pin a browser path because the sandbox they run in ships one and
   Playwright looks somewhere else. Same here, but only when that file is
   actually there, so this still runs on an ordinary machine. */
const PINNED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOpts = fs.existsSync(PINNED) ? { executablePath: PINNED } : {};

(async () => {
  const url = buildPage();
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR  ' + String(e)));
  await page.addInitScript(([account, projects]) => {
    window.__ACCOUNT__ = account; window.__PROJECTS__ = projects;
  }, [{plan: 'beatfall', subscription_status: 'active', credits_used: 0}, [PROJECT]]);
  await page.goto(url);
  await page.waitForTimeout(700);

  const uri = await page.evaluate(async () => {
    try { await exportPDF(state.projects[0]); }
    catch (e) { return 'ERROR ' + String(e); }
    return window.__OUT__ || 'nothing came back';
  });
  await browser.close();

  if (uri.indexOf('data:') !== 0){ console.log(uri); process.exit(1); }
  const out = path.resolve(__dirname, 'sample.pdf');
  fs.writeFileSync(out, Buffer.from(uri.split(',')[1], 'base64'));
  console.log('wrote ' + out);
})();
