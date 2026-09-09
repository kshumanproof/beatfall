/* Build an offline copy of the real app.html with the platform layer stubbed.
   The point is to exercise the SHIPPED code, never a copy of it: only the three
   external script tags are replaced, and everything between them is untouched. */
const fs = require('fs');

const src = fs.readFileSync('app.html', 'utf8');

const stub = `<script>
// ---- jsPDF, enough of it that exportPDF runs and records what it was asked for
window.jspdf = { jsPDF: function(){
  const calls = [];
  const api = {
    internal: {pageSize: {getWidth: () => 595, getHeight: () => 842}, getNumberOfPages: () => 1},
    setFont(){return api}, setFontSize(){return api}, setTextColor(){return api},
    setDrawColor(){return api}, setFillColor(){return api}, setLineWidth(){return api},
    text(t){calls.push(String(t)); return api}, line(){return api}, rect(){return api},
    roundedRect(){return api}, addPage(){return api}, setPage(){return api},
    setLineDashPattern(){return api}, setLineJoin(){return api}, setLineCap(){return api},
    addImage(){return api}, setProperties(){return api}, setCharSpace(){return api},
    splitTextToSize(t){return [String(t)]}, getTextWidth(){return 10},
    save(name){ window.__PDF__ = {name, text: calls.join(' | ')}; return api }
  };
  return api;
}};
// ---- the platform layer
(function(){
  const BF = {}; window.BF = BF;
  const ACCOUNT = window.__ACCOUNT__ || {};
  const PROJECTS = window.__PROJECTS__ || [];
  window.__CALLS__ = [];
  BF.ready = function(){ document.documentElement.classList.remove('booting'); };
  BF.init = async () => ({user: {id: 'u1', email: 'w@example.com'}});
  BF.requireSession = async () => ({user: {id: 'u1', email: 'w@example.com'}});
  BF.isSmallScreen = () => false;
  BF.signOut = () => { window.__CALLS__.push('signout'); };
  BF.track = (n, p) => window.__CALLS__.push('track:' + n);
  BF.sendTouch = () => {}; BF.sendAuthFunnel = () => {};
  BF.deviceId = () => 'web_stub';
  BF.loadProjects = async () => {
    BF.boardsClosed = !!window.__CLOSED__;
    BF.closedReason = window.__REASON__ || null;
    return PROJECTS;
  };
  BF.saveProject = async p => { window.__CALLS__.push('save'); return Object.assign({}, p, {id: p.id || 'srv-' + Math.random().toString(36).slice(2)}); };
  BF.deleteProject = async () => { window.__CALLS__.push('delete'); };
  BF.api = async (path, opts) => {
    const body = opts && opts.body ? JSON.parse(opts.body) : {};
    window.__CALLS__.push(path + ':' + (body.action || (opts && opts.method) || 'GET'));
    if (path === '/api/account' && (!opts || opts.method !== 'POST')) return ACCOUNT;
    if (path === '/api/billing') return {url: 'https://stripe.test/session'};
    return {};
  };
  BF.ai = async () => ({text: '{}'});
  BF.ai.json = async () => ({});
  BF.explain = e => (e && e.message) || 'Something went wrong.';
  BF.money = n => '$' + n;
  BF.when = () => 'today';
  BF.MODES = ['auto','light','dark'];
  BF.readMode = () => 'light';
  BF.applyMode = () => {};
  BF.setMode = () => {};
  BF.credits = {};
})();
</script>`;

let out = src
  .replace(/<script src="https:\/\/cdnjs[^"]*"><\/script>\n?/, '')
  .replace(/<script src="https:\/\/cdn\.jsdelivr[^"]*"><\/script>\n?/, '')
  // A function replacer, not a string. A string replacement treats $' as
  // "everything after the match", and the stub contains '$' + n, which quietly
  // pasted the whole rest of the document back in.
  .replace('<script src="/app.js"></script>', () => stub);

if (out.includes(String.fromCharCode(60)+"script src=")) throw new Error("an external script tag survived");
fs.writeFileSync('stub.html', out);
console.log('stub.html written,', out.length, 'chars');
