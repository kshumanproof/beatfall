/* Build an offline copy of the real app.html with the platform layer stubbed.
   The point is to exercise the SHIPPED code, never a copy of it: only the three
   external script tags are replaced, and everything between them is untouched. */
const fs = require('fs');

const src = fs.readFileSync('app.html', 'utf8');

const stub = `<script>
// ---- jsPDF, enough of it that exportPDF runs and records what it was asked for
window.jspdf = { jsPDF: function(){
  const calls = [];
  let size = 10;                       // whatever setFontSize last said
  let page = 1;                        // and which sheet we are on
  const api = {
    internal: {pageSize: {getWidth: () => 595, getHeight: () => 842}, getNumberOfPages: () => 1},
    setFont(){return api}, setFontSize(n){size = n || size; return api}, setTextColor(){return api},
    setDrawColor(){return api}, setFillColor(){return api}, setLineWidth(){return api},
    /* WHERE a word landed, not just that it was asked for. A card drawn
       outside its own box is still on the page, so a suite watching only the
       words cannot see it: it took a writer opening the file to notice a card
       spilling through the bottom of its box onto the row underneath. */
    text(t, x, y){
      calls.push(String(t));
      (window.__TEXTS__ = window.__TEXTS__ || []).push({page, t: String(t), x, y});
      return api;
    },
    /* Recorded, not swallowed. A rule that runs the whole height of a page is
       the shape of a page-break bug, and it is invisible to a suite that only
       watches the words. */
    line(x1,y1,x2,y2){ (window.__LINES__ = window.__LINES__ || []).push([x1,y1,x2,y2]); return api },
    rect(x, y, w, h){
      (window.__RECTS__ = window.__RECTS__ || []).push({page, x, y, w, h});
      return api;
    },
    roundedRect(){return api}, addPage(){ page++; return api }, setPage(){return api},
    setLineDashPattern(){return api}, setLineJoin(){return api}, setLineCap(){return api},
    addImage(){return api}, setProperties(){return api}, setCharSpace(){return api},
    /* A REAL WRAP, ROUGHLY.
       This used to hand the whole string back as one line, which meant nothing
       in the document ever wrapped, nothing ever reached the foot of a page,
       and no page break was ever taken. Every check about page breaks was
       therefore passing on a document one line deep. A rule down the height of
       a page shipped straight through it.
       The measure does not have to be exact. It has to be wrong in the same
       direction as a real font, so that long text takes many lines and short
       text takes one. */
    splitTextToSize(t, w){
      const str = String(t == null ? '' : t);
      const per = Math.max(8, Math.floor((w || 400) / (size * 0.55)));
      const out = [];
      // Double-escaped on purpose: this file is a template literal, so a single
      // backslash-n would be emitted as an actual newline and the regex would
      // arrive as /<newline>/, which is a syntax error that takes the whole app
      // down before the suite has drawn anything.
      str.split(/\\n/).forEach(para => {
        let line = '';
        para.split(/\\s+/).filter(Boolean).forEach(word => {
          if (!line.length) { line = word; return; }
          if ((line + ' ' + word).length <= per) line += ' ' + word;
          else { out.push(line); line = word; }
        });
        out.push(line);
      });
      return out.length ? out : [''];
    },
    getTextWidth(t){return String(t || '').length * size * 0.55},
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

    /* The pile and the streak, which arrive in the same answer. The days list
       is the ACCOUNT's, and it is the only thing the chain is allowed to
       count, so a suite that cannot seed it cannot tell a streak from a
       browser's memory of somebody else's. __CAPFAIL__ makes the request
       throw, which is the case where the cache has to stand in. */
    if (path.indexOf('/api/captures') === 0 && (!opts || opts.method === 'GET')) {
      if (window.__CAPFAIL__) throw new Error('offline');
      return {captures: window.__CAPTURES__ || [], days: window.__DAYS__ || []};
    }

    /* Vision. The real endpoint puts bytes in a private bucket and hands back
       a path plus a signed link; this hands back the same shape so the app's
       own upload and display paths run for real. The picture is a one pixel
       PNG as a data URI, which an <img> loads offline. */
    if (path.indexOf('/api/images') === 0) {
      /* A real 480x320 JPEG rather than a one pixel placeholder, because the
         PDF measures what it is given: a square pixel stretched into a frame
         would make every layout look right and prove nothing about shape. */
      const PIX = 'data:image/jpeg;base64,'
        + '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7'
        + 'Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7'
        + 'Ozs7Ozs7Ozv/wAARCAFAAeADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUF'
        + 'BAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVW'
        + 'V1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi'
        + '4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAEC'
        + 'AxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVm'
        + 'Z2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq'
        + '8vP09fb3+Pn6/9oADAMBAAIRAxEAPwC/458c6n4Z1qGysoLSSOS3WUmZGJyWYdmHHyiub/4W3r//AD56d/37k/8Ai6X4tf8AI023'
        + '/Xin/ob1w1ZJKxbZ3H/C29f/AOfPTv8Av3J/8XR/wtvX/wDnz07/AL9yf/F1w9FPlQXZ3H/C29f/AOfPTv8Av3J/8XR/wtvX/wDn'
        + 'z07/AL9yf/F1w9FHKguzuP8Ahbev/wDPnp3/AH7k/wDi6P8Ahbev/wDPnp3/AH7k/wDi64eijlQXZ3H/AAtvX/8Anz07/v3J/wDF'
        + '0f8AC29f/wCfPTv+/cn/AMXXD0UcqC7O4/4W3r//AD56d/37k/8Ai6P+Ft6//wA+enf9+5P/AIuuHoo5UF2dx/wtvX/+fPTv+/cn'
        + '/wAXR/wtvX/+fPTv+/cn/wAXXD0UcqC7O4/4W3r/APz56d/37k/+Lo/4W3r/APz56d/37k/+Lrh6KOVBdncf8Lb1/wD589O/79yf'
        + '/F0f8Lb1/wD589O/79yf/F1w9FHKguzuP+Ft6/8A8+enf9+5P/i6P+Ft6/8A8+enf9+5P/i64eijlQXZ3H/C29f/AOfPTv8Av3J/'
        + '8XR/wtvX/wDnz07/AL9yf/F1w9FHKguzuP8Ahbev/wDPnp3/AH7k/wDi6P8Ahbev/wDPnp3/AH7k/wDi64eijlQXZ3H/AAtvX/8A'
        + 'nz07/v3J/wDF0f8AC29f/wCfPTv+/cn/AMXXD0UcqC7O4/4W3r//AD56d/37k/8Ai6P+Ft6//wA+enf9+5P/AIuuHoo5UF2dx/wt'
        + 'vX/+fPTv+/cn/wAXR/wtvX/+fPTv+/cn/wAXXD0UcqC7O4/4W3r/APz56d/37k/+Lo/4W3r/APz56d/37k/+Lrh6KOVBdncf8Lb1'
        + '/wD589O/79yf/F0f8Lb1/wD589O/79yf/F1w9FHKguzuP+Ft6/8A8+enf9+5P/i6P+Ft6/8A8+enf9+5P/i64eijlQXZ3H/C29f/'
        + 'AOfPTv8Av3J/8XR/wtvX/wDnz07/AL9yf/F1w9FHKguzuP8Ahbev/wDPnp3/AH7k/wDi6P8Ahbev/wDPnp3/AH7k/wDi64eijlQX'
        + 'Z3H/AAtvX/8Anz07/v3J/wDF0f8AC29f/wCfPTv+/cn/AMXXD0UcqC7O4/4W3r//AD56d/37k/8Ai6P+Ft6//wA+enf9+5P/AIuu'
        + 'Hoo5UF2dx/wtvX/+fPTv+/cn/wAXR/wtvX/+fPTv+/cn/wAXXD0UcqC7O4/4W3r/APz56d/37k/+Lo/4W3r/APz56d/37k/+Lrh6'
        + 'KOVBdncf8Lb1/wD589O/79yf/F0f8Lb1/wD589O/79yf/F1w9FHKguzuP+Ft6/8A8+enf9+5P/i6P+Ft6/8A8+enf9+5P/i64eij'
        + 'lQXZ3H/C29f/AOfPTv8Av3J/8XR/wtvX/wDnz07/AL9yf/F1w9FHKguzuP8Ahbev/wDPnp3/AH7k/wDi6P8Ahbev/wDPnp3/AH7k'
        + '/wDi64eijlQXZ3H/AAtvX/8Anz07/v3J/wDF0f8AC29f/wCfPTv+/cn/AMXXD0UcqC7O4/4W3r//AD56d/37k/8Ai66TwN451PxN'
        + 'rU1lewWkccdu0oMKMDkMo7sePmNeR13Pwl/5Gm5/68X/APQ0pNKwJh8Wv+Rptv8AryT/ANDeuHrufi1/yNNt/wBeSf8Aob1w9NbA'
        + 'xKKWimISilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASil'
        + 'ooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASu4+Ev/ACNNz/15P/6GlcRXcfCX/kab'
        + 'n/ryf/0NKT2Gg+LP/I023/Xkn/ob1w9dz8Wf+Rotv+vJP/Q3rh6S2GxKKWimISilooASilooASilooASilooASilooASilooASil'
        + 'ooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooAS'
        + 'ilooASilooASilooASilooASu4+E3/I03P8A15P/AOhpXEV3Hwm/5Gi5/wCvJ/8A0NKT2Gg+LH/I0W3/AF5L/wChvXEV3HxY/wCR'
        + 'otv+vJf/AEN64ihbAxKKWimISilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilo'
        + 'oASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASu3+E//I0XP/Xk'
        + '3/oaVxNdv8J/+Rouf+vJv/Q0pPYYfFf/AJGi2/68l/8AQ3riK7j4r/8AIz23/Xkv/ob1xOKS2AbRTsUYpgNop2KMUANop2KMUANo'
        + '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'
        + 'Y7f/AK81/wDQ3rjq7H4m/wDIx2//AF6L/wChvXH0AhKKWikMSilooASrun/8tPw/rVOrmn/8tPw/rUz+E6cJ/GX9dC5RRRXOe2FF'
        + 'FFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABWVN/r5P94/zrVrKm/wBfJ/vH+da09zz8d8KI6KWitTyxKKWigBKKWigBKKWigBKK'
        + 'WigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBK7H4Zf8jHcf9ebf+hpXH12Hwy/5GO4'
        + '/wCvRv8A0NKBMX4mf8jHb/8AXov/AKG9cfXYfEz/AJGK3/69F/8AQ3rkKAQlFLRQMSilooASlV2T7rFc+hxRRQCbWw7zpf8Ano//'
        + 'AH0aPOl/56P/AN9Gm0UrIrnl3HedL/z0f/vo0edL/wA9H/76NNoosg55dx3nS/8APR/++jR50v8Az0f/AL6NNoosg55dx3nS/wDP'
        + 'R/8Avo0edL/z0f8A76NNoosg55dx3nS/89H/AO+jR50v/PR/++jTaKLIOeXcd50v/PR/++jR50v/AD0f/vo02iiyDnl3HedL/wA9'
        + 'H/76NHnS/wDPR/8Avo02iiyDnl3HedL/AM9H/wC+jR50v/PR/wDvo02iiyDnl3HedL/z0f8A76NMPJyeSaWimJyb3YlFLRQISilo'
        + 'oASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASuw+Gf/Ix3H/Xo'
        + '3/oaVyFdf8M/+RiuP+vRv/Q0oExfiX/yMVv/ANei/wDob1x9dh8S/wDkYrf/AK9F/wDQ3rkKBrYSilopAJRS0UAJRS0UAJRS0UAJ'
        + 'RS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0U'
        + 'AJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJXYfDT/kYrj/r0b/0NK5Cuv8Ahp/yMVx/16N/6GlMHsL8Sv8AkYrf/r0X'
        + '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'
        + 'T3A9KaTE2rH/2Q==';
      if (opts && opts.method === 'POST') {
        if (window.__NO_ROOM__) { const e = new Error('No room.'); e.code = 'no_room'; throw e; }
        const path2 = 'u1/' + (window.__IMG_N__ = (window.__IMG_N__ || 0) + 1) + '.jpg';
        window.__UPLOADED__ = (window.__UPLOADED__ || []).concat([
          {path: path2, bytes: (body.data || '').length, type: body.type}]);
        return {path: path2, url: PIX, bytes: 1000,
                used: window.__UPLOADED__.length * 1000, quota: 40000000};
      }
      /* Recorded, not just answered. Throwing a batch of phone notes away has
         to take the photographs off the account as well, and a stand-in that
         says "ok" without saying WHAT it deleted cannot prove that. */
      if (opts && opts.method === 'DELETE') {
        window.__DELETED_PICS__ = (window.__DELETED_PICS__ || []).concat([
          decodeURIComponent((path.split('path=')[1] || ''))]);
        return {ok: true};
      }
      if (path.indexOf('usage=1') > 0) {
        return {used: window.__USED__ || 0, quota: 40000000, count: 0};
      }
      const want = decodeURIComponent((path.split('paths=')[1] || '')).split(',').filter(Boolean);
      const urls = {};
      want.forEach(p => { if (String(p).indexOf('missing') < 0) urls[p] = PIX; });
      return {urls};
    }
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
