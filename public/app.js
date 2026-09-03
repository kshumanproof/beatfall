// ============================================================================
// beatfall: the platform layer.
//
// Everything the board needs from the outside world lives here: who you are,
// where your projects are saved, and how the app talks to Claude. The board
// itself (index.html) calls into this and otherwise stays exactly as it was.
// ============================================================================
(function () {
  const BF = {};
  window.BF = BF;

  // ------------------------------------------------------------ supabase --
  let sb = null, config = null, unconfigured = false;

  // A deployment with no environment variables set is a normal stage of setup,
  // not a crash. Say so on the page instead of dying silently in the console.
  function sayUnconfigured(what) {
    unconfigured = true;
    BF.unconfigured = true;
    document.body.innerHTML =
      '<div style="max-width:560px;margin:14vh auto;padding:0 24px;font-family:' +
      "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#15181D\">" +
      '<div style="font-weight:800;font-size:21px;letter-spacing:-.035em;margin-bottom:18px">' +
      'Beat<span style="color:#2C5C8F">fall</span></div>' +
      '<div style="border:1px solid #CFD5DD;border-left:3px solid #9A7716;background:#fff;' +
      'padding:20px 22px;border-radius:2px;line-height:1.6;font-size:14.5px">' +
      '<b>This deployment isn\'t connected to its database yet.</b><br><br>' +
      'The site is built and serving correctly. It just has no account system ' +
      'behind it, so there is nothing to sign in to.<br><br>' +
      '<span style="color:#7C8593;font-family:ui-monospace,monospace;font-size:12.5px">' +
      'missing: ' + what + '</span></div></div>';
    document.documentElement.style.background = '#E9ECEF';
  }

  BF.init = async function () {
    try {
      config = await fetch('/api/config').then(r => r.json());
    } catch (e) {
      config = null;
    }
    if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
      sayUnconfigured(!config ? '/api/config did not respond'
        : [!config.supabaseUrl && 'SUPABASE_URL',
           !config.supabaseAnonKey && 'SUPABASE_ANON_KEY'].filter(Boolean).join(', '));
      return null;
    }
    sb = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    BF.sb = sb;
    const { data } = await sb.auth.getSession();
    BF.session = data.session || null;
    return BF.session;
  };

  BF.signOut = async function () {
    await sb.auth.signOut();
    location.href = '/login.html';
  };

  // Every protected page starts with this. No session, no page.
  BF.requireSession = async function () {
    const session = await BF.init();
    if (unconfigured) return null;            // never bounce into a login that can't work
    if (!session) { location.href = '/login.html'; return null; }
    return session;
  };

  async function token() {
    const { data } = await sb.auth.getSession();
    return data.session ? data.session.access_token : null;
  }

  BF.api = async function (path, options = {}) {
    const t = await token();
    const r = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: 'Bearer ' + t } : {}),
        ...(options.headers || {})
      }
    });
    let body = null;
    try { body = await r.json(); } catch (e) { body = {}; }
    if (r.status === 401) { location.href = '/login.html'; throw new Error('signed out'); }
    if (!r.ok) { const err = new Error(body.message || body.error || 'request failed');
                 err.code = body.error; err.status = r.status; err.body = body; throw err; }
    return body;
  };

  BF.track = function (name, props) {
    BF.api('/api/account', { method: 'POST', body: JSON.stringify({ action: 'event', name, props }) })
      .catch(() => {});
  };

  // ------------------------------------------------------------- projects --
  BF.loadProjects = async function () {
    const { projects } = await BF.api('/api/projects');
    return projects;
  };

  BF.saveProject = async function (project) {
    const { project: saved } = await BF.api('/api/projects', {
      method: 'POST', body: JSON.stringify({ project })
    });
    return saved;
  };

  BF.deleteProject = async function (id) {
    return BF.api('/api/projects', { method: 'DELETE', body: JSON.stringify({ id }) });
  };

  // --------------------------------------------------------------- claude --
  // Deliberately shaped like the artifact runtime's sample() so the board's
  // code didn't have to change: ai(input, opts) resolves {text}, ai.json()
  // parses. onText fires once with the whole answer, because the proxy doesn't stream,
  // and the spinner covers the wait.
  function makeAI() {
    async function ask(input, opts = {}) {
      const body = {
        input,
        kind: opts.kind || 'conversation',
        // every turn of one conversation carries the same id, so it bills once
        session: opts.session || null,
        maxTokens: opts.maxTokens
      };
      const res = await BF.api('/api/claude', {
        method: 'POST', body: JSON.stringify(body), signal: opts.signal
      });
      BF.credits = { left: res.credits_left, allowance: res.allowance,
                     banked: res.banked || 0 };
      if (typeof BF.onCredits === 'function') BF.onCredits(BF.credits);
      if (typeof opts.onText === 'function') opts.onText({ text: res.text, delta: res.text });
      return { text: res.text, truncated: false };
    }
    ask.json = async function (input, opts = {}) {
      const { text } = await ask(input, opts);
      const cut = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      try { return JSON.parse(cut || text); } catch (e) { return null; }
    };
    ask.limits = async () => ({ images: false });
    return ask;
  }
  BF.ai = makeAI();

  // Turn an API error into something a writer can act on.
  BF.explain = function (e) {
    if (!e) return "Something went wrong.";
    if (e.code === 'out_of_credits' || e.code === 'no_plan') return e.message;
    if (e.status === 502) return "Couldn't reach Claude just now. Try again in a moment.";
    return e.message || "Something went wrong.";
  };

  // -------------------------------------------------------------------- mode --
  // "Auto" follows the daylight where the reader actually is, not a setting on
  // their machine. Latitude is inferred from the device's IANA region and the
  // clock does the rest, so the app never asks for a location and never makes a
  // network call to work this out.
  const MODE_KEY = 'beatfall.mode';
  const OLD_KEY  = 'beatfall.theme';
  BF.MODES = ['auto', 'light', 'dark'];

  function latitudeGuess() {
    let zone = '';
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    const known = {
      'Pacific/Honolulu': 21, 'America/Anchorage': 61, 'America/Bogota': 4.6,
      'America/Mexico_City': 19, 'America/Sao_Paulo': -23, 'Asia/Singapore': 1.3,
      'Asia/Dubai': 25, 'Asia/Kolkata': 20, 'Asia/Tokyo': 36, 'Africa/Cairo': 30,
      'Africa/Johannesburg': -26, 'Europe/Reykjavik': 64
    };
    if (known[zone] != null) return known[zone];
    const region = zone.split('/')[0];
    const byRegion = { America: 38, Europe: 50, Australia: -33, Asia: 30, Africa: 5,
                       Pacific: -18, Atlantic: 38, Indian: -20, Antarctica: -70 };
    return byRegion[region] != null ? byRegion[region] : 40;
  }

  // Low-precision solar position, accurate to a few minutes, which is far
  // finer than anyone notices a screen changing colour.
  function isNight(now) {
    now = now || new Date();
    const rad = Math.PI / 180;
    const day = Math.floor((now - Date.UTC(now.getFullYear(), 0, 0)) / 86400000);
    const decl = 23.44 * rad * Math.sin(2 * Math.PI * (day - 81) / 365);
    const x = -Math.tan(latitudeGuess() * rad) * Math.tan(decl);
    if (x <= -1) return true;    // polar night
    if (x >= 1)  return false;   // midnight sun
    const half = Math.acos(x) / rad / 15;                       // half-day, hours
    const eot = 9.87 * Math.sin(4 * Math.PI * (day - 81) / 365)
              - 7.53 * Math.cos(2 * Math.PI * (day - 81) / 365)
              - 1.5  * Math.sin(2 * Math.PI * (day - 81) / 365);
    // Local clocks run an hour ahead of the sun during daylight saving.
    const jan = new Date(now.getFullYear(), 0, 1).getTimezoneOffset();
    const jul = new Date(now.getFullYear(), 6, 1).getTimezoneOffset();
    const dst = (Math.max(jan, jul) - now.getTimezoneOffset()) / 60;
    const noon = 12 + dst - eot / 60;
    const hour = now.getHours() + now.getMinutes() / 60;
    return hour < noon - half || hour > noon + half;
  }
  BF.isNight = isNight;

  BF.resolveMode = m => (m === 'light' || m === 'dark') ? m : (isNight() ? 'dark' : 'light');

  BF.readMode = function () {
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m) return m;
      const old = localStorage.getItem(OLD_KEY);        // migrate the old setting
      if (old) return old === 'system' ? 'auto' : old;
    } catch (e) {}
    return 'auto';
  };

  let modeTimer = null;
  BF.applyMode = function (m, label) {
    document.documentElement.setAttribute('data-theme', BF.resolveMode(m));
    try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
    if (label) label.textContent = 'Mode: ' + m;
    clearInterval(modeTimer);
    // so it turns over while somebody is still sitting there writing
    if (m === 'auto') modeTimer = setInterval(() => {
      document.documentElement.setAttribute('data-theme', BF.resolveMode('auto'));
    }, 300000);
  };

  BF.cycleMode = function (label) {
    const i = BF.MODES.indexOf(BF.readMode());
    BF.applyMode(BF.MODES[(i + 1) % BF.MODES.length], label);
  };

  BF.money = n => '$' + (Math.round(n * 100) / 100).toFixed(2);
  BF.when = iso => {
    if (!iso) return '·';
    const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (d <= 0) return 'today';
    if (d === 1) return 'yesterday';
    if (d < 30) return d + ' days ago';
    return Math.round(d / 30) + ' months ago';
  };
})();
