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
    BF.ready();
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

  /* A page may hold itself back until it knows what to draw, by putting
     `booting` on the root element in its head. This takes it off again, and
     every path that ends a boot calls it: the app drawing its first view, the
     project-load failure, the ended-plan screen, the device screens, the
     small-screen gate and the unconfigured notice. Harmless on a page that
     never set the class. */
  BF.ready = function () {
    try { document.documentElement.classList.remove('booting'); } catch (e) {}
  };

  // `opts.gate === false` lets one page opt out of the small-screen gate.
  // Sign-in is the only caller and the reason is in the comment below.
  BF.init = async function (opts) {
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

    /* The gate goes here and nowhere earlier. detectSessionInUrl has already
       run by this point, so a magic link tapped on a phone has been redeemed
       and the account exists before we tell anybody the screen is too small.
       Blocking first would burn a single-use link and lose the signup.

       And sign-in opts out of it entirely. Gating that page meant a writer who
       typed beatfall.app into their phone read the whole pitch, pressed Start
       14 days free, and hit a wall with no signup on it and two buttons that
       said "coming soon". The board genuinely needs a bigger screen. Creating
       an account does not, and the phone is where somebody hears about this
       and goes looking. */
    if (BF.isSmallScreen() && !(opts && opts.gate === false)) {
      BF.showSmallScreenGate(BF.session);
      return BF.session;
    }
    return BF.session;
  };

  // ------------------------------------------------------ active browser --
  // This is an installation id, not an IP address or a hardware fingerprint.
  // Tabs in the same browser profile share it, so they are one device. Another
  // browser profile or computer gets a different id and takes over when it
  // opens a protected Beatfall page.
  const DEVICE_KEY = 'beatfall.web-device';
  let deviceTimer = null, deviceChannel = null;
  let deviceChecking = false, deviceListeners = false;

  BF.deviceId = function () {
    try {
      let value = localStorage.getItem(DEVICE_KEY);
      if (!value) {
        value = 'web_' + rid();
        localStorage.setItem(DEVICE_KEY, value);
      }
      return value;
    } catch (e) {
      // localStorage can be disabled. Keep one id for this open page so the
      // person receives a useful error instead of sending an empty header.
      if (!BF._pageDeviceId) BF._pageDeviceId = 'web_' + rid();
      return BF._pageDeviceId;
    }
  };

  async function deviceRequest(method) {
    const t = await token();
    if (!t) throw Object.assign(new Error('signed out'), { status: 401 });
    const r = await fetch('/api/session', {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + t,
        'X-Beatfall-Device': BF.deviceId()
      }
    });
    let body = {};
    try { body = await r.json(); } catch (e) {}
    if (r.status === 401) { location.href = '/'; throw new Error('signed out'); }
    if (!r.ok) {
      const err = new Error(body.message || body.error || 'Something went wrong.');
      err.code = body.error; err.status = r.status; err.body = body;
      throw err;
    }
    return body;
  }

  function stopDeviceWatch() {
    clearInterval(deviceTimer);
    deviceTimer = null;
    if (deviceChannel && sb && typeof sb.removeChannel === 'function') {
      try { sb.removeChannel(deviceChannel); } catch (e) {}
    }
    deviceChannel = null;
    BF.deviceActive = false;
  }

  BF.showDeviceReplaced = function () {
    BF.ready();
    if (document.getElementById('bf-device-ended')) return;
    stopDeviceWatch();

    const el = document.createElement('div');
    el.id = 'bf-device-ended';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML =
        '<div class="bf-ended-card">'
      +   '<div class="bf-ended-brand">' + MARK
      +     '<span class="bf-ended-word">Beat<span>fall</span></span></div>'
      +   '<p class="bf-ended-tag">Where your story falls into place.</p>'
      +   '<h1>Beatfall is open on another device</h1>'
      +   '<p>This browser is no longer the active editing session. Anything it already saved is safe.</p>'
      +   '<p>To work here instead, make this browser active. Beatfall will close on the other computer.</p>'
      +   '<button type="button" id="bf-use-here">Use Beatfall here instead</button>'
      +   '<button type="button" class="bf-ended-link" id="bf-signout-here">Sign out here</button>'
      + '</div>';

    const css = document.createElement('style');
    css.id = 'bf-device-ended-style';
    css.textContent = [
      '#bf-device-ended{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;',
      'padding:24px;background:rgba(31,27,22,.72);font-family:var(--sans,Instrument Sans,system-ui,sans-serif);',
      'color:var(--ink,#2B2620);-webkit-font-smoothing:antialiased}',
      '.bf-ended-card{width:min(100%,500px);box-sizing:border-box;padding:34px 36px 30px;',
      'background:var(--card,#FDFBF6);border:1px solid var(--rule,#DED6C8);border-radius:12px;',
      'box-shadow:0 22px 70px rgba(20,16,10,.3)}',
      '.bf-ended-brand{display:flex;align-items:center;gap:3px;font-family:var(--serif,Newsreader,Georgia,serif);',
      'font-size:31px;font-weight:650;letter-spacing:-.025em;line-height:1}',
      '.bf-ended-brand svg{width:29px;height:40px;flex:0 0 auto}',
      '.bf-ended-word{color:var(--ink,#2B2620)}',
      '.bf-ended-word>span{color:var(--blue,#2C5C8F)}',
      '.bf-ended-tag{margin:5px 0 27px!important;font-family:var(--serif,Newsreader,Georgia,serif);',
      'font-size:14px!important;font-style:italic;color:var(--ink-3,#726859)!important}',
      '#bf-device-ended h1{margin:0 0 14px;font-family:var(--serif,Newsreader,Georgia,serif);',
      'font-size:29px;line-height:1.15;font-weight:600;letter-spacing:-.015em}',
      '#bf-device-ended p{font-size:15px;line-height:1.55;color:var(--ink-2,#5C5349);margin:0 0 12px}',
      '#bf-use-here{display:block;width:100%;margin:24px 0 7px;padding:12px 16px;border:0;',
      'border-radius:5px;background:var(--blue,#2C5C8F);color:#fff;font:600 14px var(--sans,system-ui,sans-serif);cursor:pointer}',
      '#bf-use-here:disabled{opacity:.58;cursor:wait}',
      '.bf-ended-link{display:block;margin:4px auto 0;padding:8px;border:0;background:none;',
      'color:var(--ink-3,#726859);font:500 13px var(--sans,system-ui,sans-serif);text-decoration:underline;',
      'text-underline-offset:3px;cursor:pointer}',
      '@media(max-width:560px){.bf-ended-card{padding:28px 23px 24px}#bf-device-ended h1{font-size:25px}}'
    ].join('\n');
    document.head.appendChild(css);
    document.body.appendChild(el);

    document.getElementById('bf-use-here').addEventListener('click', async function () {
      const button = this;
      button.disabled = true;
      button.textContent = 'Opening Beatfall here…';
      try {
        await BF.claimWebDevice();
        location.href = '/app';
      } catch (e) {
        button.disabled = false;
        button.textContent = 'Try again';
      }
    });
    document.getElementById('bf-signout-here').addEventListener('click', () => BF.signOut());
  };

  BF.showDeviceSetupFailure = function () {
    BF.ready();
    if (document.getElementById('bf-device-setup')) return;
    const el = document.createElement('div');
    el.id = 'bf-device-setup';
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#F1EEE7;color:#2B2620;font-family:system-ui,sans-serif';
    el.innerHTML = '<div style="max-width:480px;background:#FDFBF6;border:1px solid #DED6C8;border-radius:10px;padding:32px">'
      + '<h1 style="font:600 28px Georgia,serif;margin:0 0 12px">Beatfall could not open on this device</h1>'
      + '<p style="line-height:1.55;color:#5C5349;margin:0 0 22px">Your work is safe. Refresh the page and try again.</p>'
      + '<button type="button" onclick="location.reload()" style="width:100%;padding:12px;border:0;border-radius:5px;background:#2C5C8F;color:white;font-weight:600;cursor:pointer">Refresh</button></div>';
    document.body.appendChild(el);
  };

  BF.checkWebDevice = async function () {
    if (!BF.deviceActive || deviceChecking) return;
    deviceChecking = true;
    try {
      const result = await deviceRequest('GET');
      if (!result.active) BF.showDeviceReplaced();
    } catch (e) {
      // A dropped connection is not evidence of another device. Protected API
      // calls still enforce ownership while this quiet check waits for network.
      if (e.status === 401) location.href = '/';
    } finally { deviceChecking = false; }
  };

  function startDeviceWatch() {
    BF.deviceActive = true;
    clearInterval(deviceTimer);
    // Realtime carries the normal takeover notice. This slow check is only a
    // safety net for a browser or network that could not hold the live socket.
    deviceTimer = setInterval(BF.checkWebDevice, 120000);

    if (deviceChannel && sb && typeof sb.removeChannel === 'function') {
      try { sb.removeChannel(deviceChannel); } catch (e) {}
      deviceChannel = null;
    }
    const userId = BF.session && BF.session.user && BF.session.user.id;
    if (userId && sb && typeof sb.channel === 'function') {
      deviceChannel = sb.channel('bf-web-device-' + userId)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'id=eq.' + userId
        }, function (change) {
          const current = change && change.new && change.new.active_web_device_id;
          if (BF.deviceActive && current && current !== BF.deviceId()) {
            BF.showDeviceReplaced();
          }
        })
        .subscribe();
    }
    if (!deviceListeners) {
      window.addEventListener('focus', BF.checkWebDevice);
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) BF.checkWebDevice();
      });
      deviceListeners = true;
    }
  }

  BF.claimWebDevice = async function () {
    const result = await deviceRequest('POST');
    startDeviceWatch();
    return result;
  };

  BF.signOut = async function () {
    stopDeviceWatch();
    try { await deviceRequest('DELETE'); } catch (e) {}
    // Sign out only this browser. A future signed-in mobile capture app must
    // not lose its Supabase session because the writer left the web board.
    await sb.auth.signOut({ scope: 'local' });
    location.href = '/';
  };

  // Every protected page starts with this. No session, no page.
  BF.requireSession = async function () {
    const session = await BF.init();
    if (unconfigured) return null;            // never bounce into a login that can't work
    // The gate is already up and it is the whole page. Returning null stops
    // the caller from building a board underneath it. The public homepage is
    // the signed-out destination and carries the same small-screen gate.
    if (BF.isSmallScreen()) return null;
    if (!session) { location.href = '/'; return null; }
    try {
      await BF.claimWebDevice();
    } catch (e) {
      BF.showDeviceSetupFailure();
      return null;
    }
    // Both of these were written and never called, so what they collect sat in
    // this browser and never reached the server. This is the first moment a
    // page is certain it has a session, which is what they were waiting for.
    BF.sendTouch();
    BF.sendAuthFunnel();
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
        ...(t ? { 'X-Beatfall-Device': BF.deviceId() } : {}),
        ...(options.headers || {})
      }
    });
    let body = null;
    try { body = await r.json(); } catch (e) { body = {}; }
    if (r.status === 401) { location.href = '/'; throw new Error('signed out'); }
    if (r.status === 409 && (body.error === 'device_replaced' || body.error === 'device_required')) {
      BF.showDeviceReplaced();
    }
    if (!r.ok) { const err = new Error(body.message || body.error || 'Something went wrong.');
                 err.code = body.error; err.status = r.status; err.body = body; throw err; }
    return body;
  };

  /* ------------------------------------------------------------ analytics --
     Three ids, and they do different jobs.

       anon  identifies this browser from the very first visit, before there is
             an account. It is what lets a visit that arrived from a link be
             joined to the account it later became.
       sess  groups one sitting, so "came back on day 7" can mean a session
             rather than a page load. Thirty minutes idle ends it.
       event a per-call id, so a retry after a dropped response is the same row
             rather than a second one. The unique index does the work.

     None of these are cookies set for anybody else's benefit and none of them
     leave first-party storage. They carry no email and no story text; see the
     allowlist on the server, which is the thing that actually enforces it. */
  var ANON_KEY = 'beatfall.anon', SESS_KEY = 'beatfall.sess', SESS_MINS = 30;

  function rid() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
      var a = new Uint8Array(16); crypto.getRandomValues(a);
      return Array.from(a, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    } catch (e) { return String(Date.now()) + Math.random().toString(16).slice(2); }
  }

  BF.anonId = function () {
    try {
      var v = localStorage.getItem(ANON_KEY);
      if (!v) { v = rid(); localStorage.setItem(ANON_KEY, v); }
      return v;
    } catch (e) { return null; }
  };

  BF.sessionId = function () {
    try {
      var now = Date.now();
      var raw = sessionStorage.getItem(SESS_KEY);
      var s = raw ? JSON.parse(raw) : null;
      if (!s || now - s.t > SESS_MINS * 60000) s = { id: rid(), t: now };
      s.t = now;
      sessionStorage.setItem(SESS_KEY, JSON.stringify(s));
      return s.id;
    } catch (e) { return null; }
  };

  BF.track = function (name, props) {
    BF.api('/api/account', { method: 'POST', body: JSON.stringify({
      action: 'event', name: name, props: props,
      event_id: rid(), anon_id: BF.anonId(), session_id: BF.sessionId()
    })}).catch(function () {});
  };

  /* --------------------------------------------------------- attribution --
     A magic link leaves the site and comes back, and the referrer does not
     survive that trip. So whatever the first visit could see is written down
     here, in this browser, and handed over on the first authenticated call.

     What is kept is deliberately narrow: the five utm fields, a Beatfall ref
     token, the referring host (host only, never the full URL, which can carry
     somebody else's query string), and the path they landed on. Never the
     whole query string, because a stray ?email= would end up in a growth
     table, and never anything the writer typed. */
  var TOUCH_KEY = 'beatfall.touch';

  BF.captureTouch = function () {
    try {
      var q = new URLSearchParams(location.search);
      var t = {};
      ['source', 'medium', 'campaign', 'content', 'term'].forEach(function (k) {
        var v = q.get('utm_' + k); if (v) t[k] = v.slice(0, 120);
      });
      var ref = q.get('ref'); if (ref) t.ref = ref.slice(0, 120);
      if (document.referrer) {
        try {
          var h = new URL(document.referrer).host;
          if (h && h !== location.host) t.referrer = h;
        } catch (e) {}
      }
      t.landing = location.pathname.slice(0, 120);

      // Nothing but a landing path is not an acquisition context; it would
      // overwrite a real first touch with "they came back directly".
      var meaningful = t.source || t.ref || t.referrer;
      var prev = null;
      try { prev = JSON.parse(localStorage.getItem(TOUCH_KEY) || 'null'); } catch (e) {}
      if (!meaningful && prev) return prev;
      if (!meaningful && !prev) { localStorage.setItem(TOUCH_KEY, JSON.stringify(t)); return t; }
      localStorage.setItem(TOUCH_KEY, JSON.stringify(t));
      return t;
    } catch (e) { return null; }
  };

  // Sent once per browser per account, after sign-in. The server decides
  // whether it is a first touch; it will not overwrite one that exists.
  BF.sendTouch = function () {
    try {
      if (localStorage.getItem(TOUCH_KEY + '.sent')) return;
      var t = JSON.parse(localStorage.getItem(TOUCH_KEY) || 'null');
      if (!t) return;
      localStorage.setItem(TOUCH_KEY + '.sent', '1');
      BF.api('/api/account', { method: 'POST',
        body: JSON.stringify({ action: 'attribution', touch: t }) }).catch(function () {});
    } catch (e) {}
  };

  /* login.html counts the magic links this browser asked for, in first-party
     storage, because nobody is signed in yet and the event endpoint needs a
     session. This is the other half of that count, and until it existed the
     first half was written to a key nothing ever read: once there IS a
     session, hand the number over and clear it. The gap between links asked
     for and sign-ins reached is the cost of magic-link auth, and it is worth
     knowing before ten writers hit it. */
  var AUTH_ASKED = 'beatfall.auth.requested';

  BF.sendAuthFunnel = function () {
    try {
      var asked = Number(localStorage.getItem(AUTH_ASKED)) || 0;
      if (!asked) return;
      localStorage.removeItem(AUTH_ASKED);
      BF.track('magic_link_arrived', { count: asked });
    } catch (e) {}
  };

  // Runs on every page load, signed in or not, so a visit to /login.html or a
  // public page is captured before an account exists.
  BF.captureTouch();

  // ------------------------------------------------------------- projects --
  BF.loadProjects = async function () {
    const body = await BF.api('/api/projects');
    /* An account with no plan can still read its own work, so this call now
       succeeds where it used to refuse outright. `closed` is how the server
       says the boards are shut to changes: the caller draws the locked screen
       over the shelf instead of opening a board, and the projects it just
       received are what make Save as PDF possible from there. */
    BF.boardsClosed = !!body.closed;
    BF.closedReason = body.reason || null;
    return body.projects;
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
  /* The last thing standing between a failed request and a writer's screen.
     It used to hand back whatever the wire said, so a Stripe refusal with no
     body printed the words "request failed" on the page of somebody trying to
     cancel their subscription. An error code is not a sentence: anything
     arriving here without a space in it was written for a program. */
  BF.explain = function (e) {
    if (!e) return "Something went wrong.";
    if (e.code === 'out_of_credits' || e.code === 'no_plan') return e.message;
    const m = String(e.message || '');
    if (e.status === 502) return /\s/.test(m) ? m
      : "Couldn't get an answer just now. Try again in a moment.";
    if (!m || !/\s/.test(m)) return "Something went wrong. Nothing was lost. Try again.";
    return m;
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

  /* =======================================================================
     THE SMALL-SCREEN GATE

     The web app is a board. A board is a spatial thing you drag cards around
     on, and there is no honest way to do that in a 390px column. Rather than
     ship a cramped version and let a writer's first impression be a bad one,
     a phone gets the app instead.

     Which pages this covers is decided by nothing more than which pages load
     this file: index, login, settings and admin do; Privacy, Terms and How
     billing works do not, and must not. Those are documents. They are linked
     from emails and from the store listings, people open them on phones, and
     a privacy policy you cannot read on the device you are holding is worse
     than useless.

     TWO CONDITIONS, both required:

       min(width, height) < 700   Measured on the SMALLER side so a phone that
                                  gets rotated is still a phone. A pure width
                                  check lets an iPhone Pro Max through in
                                  landscape at 932px, which is exactly the
                                  cramped experience this exists to prevent.
                                  744 is an iPad Mini's short side, so every
                                  iPad passes; 600-ish Android tablets do not.

       pointer: coarse            Because a laptop with a short browser window
                                  has a small viewport and is not a phone.
                                  Without this, dragging a desktop window to
                                  half-height would throw up a download prompt,
                                  which is absurd.

     Sign-in is deliberately NOT blocked. Magic links get opened on phones
     constantly, the link is single-use, and refusing to process it would burn
     it and lose the account for good. So the session is established first and
     the gate is drawn afterwards: tap the link on the sofa, and the laptop is
     already signed in when you open it.
     ======================================================================= */
  BF.GATE_MIN = 700;

  // Set these when the listings exist. Empty means the button still shows,
  // as Kris asked, but says the app is coming rather than lying about a link.
  BF.APP_STORE = '';
  BF.PLAY_STORE = '';

  BF.isSmallScreen = function () {
    try {
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const short  = Math.min(window.innerWidth, window.innerHeight) < BF.GATE_MIN;
      return !!(coarse && short);
    } catch (e) { return false; }
  };

  const MARK = '<svg viewBox="14 8 36 50.5" width="44" height="61" aria-hidden="true">'
    + '<g stroke="#7B5A13" stroke-width="1.4" stroke-linecap="round">'
    + '<path d="M27.3 14.0v5.1"/><path d="M30.2 9.5v7.7"/><path d="M33.2 13.3v3.6"/></g>'
    + '<rect x="15" y="22.6" width="34" height="6.95" rx="1.6" fill="#7B5A13"'
    + ' transform="rotate(-12 32 26.08)"/>'
    + '<rect x="15" y="34.2" width="34" height="6.95" rx="1.6" fill="#2C5C8F"/>'
    + '<rect x="15" y="42.3" width="34" height="6.95" rx="1.6" fill="#2C5C8F"/>'
    + '<rect x="15" y="50.5" width="34" height="6.95" rx="1.6" fill="#2C5C8F"/></svg>';

  const STORE_ICON = {
    apple: '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">'
      + '<path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.9-3-.8c-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.2 1.2-2.4 1.2-2.5-.1 0-2.4-.9-2.4-3.6zM14.2 5.9c.6-.8 1-1.9.9-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-.9 2.9 1 .1 2-.5 2.7-1.3z"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">'
      + '<path d="M3.6 2.2c-.3.3-.5.8-.5 1.4v16.8c0 .6.2 1.1.5 1.4l.1.1 9.4-9.4v-.2L3.7 2.1l-.1.1zm12.6 6.3L13.7 6l-.2-.1L15.9 8.3l.3.2zm-2.5 2.6L4.3 2.5l9.4 8.6zm0 2L4.3 21.5l9.4-8.6zm2.5-1.1l2.5-1.4c.7-.4.7-1.1 0-1.5l-2.5-1.4-2.7 2.7 2.7 2.6z"/></svg>'
  };

  function storeBtn(kind, href, label, sub) {
    const inner = STORE_ICON[kind]
      + '<span><small>' + sub + '</small><b>' + label + '</b></span>';
    return href
      ? '<a class="bf-store" href="' + href + '">' + inner + '</a>'
      // No listing yet. It still looks like the control it will be, but it
      // says so rather than pretending to be a link that goes nowhere.
      : '<span class="bf-store bf-store-soon" role="note">' + inner + '</span>';
  }

  /* The store buttons live here rather than inside the gate, because they now
     appear on two screens and this project has already paid twice for one
     control being copied into a second file and then fixed in only one of
     them. Any page that loads app.js can ask for them; the styles come with
     them so the caller does not have to know they exist.

     On the day the listings are real, note that a store link IS the open-it
     link on both platforms: an iOS universal link and an Android app link open
     the installed app and fall through to the listing when it is absent. So
     "download" and "open" are the same button and need no branch. */
  let storeCssIn = false;
  function ensureStoreCss() {
    if (storeCssIn) return;
    storeCssIn = true;
    const s = document.createElement('style');
    s.textContent = [
      // Neutral spacing: the gate adds its own below, the sign-in box wants less.
      '.bf-gate-stores{display:flex;flex-direction:column;gap:10px;margin:14px 0 0}',
      '.bf-apppitch{margin:16px 0 0;font-size:13.5px;line-height:1.6}',
      '.bf-store{display:flex;align-items:center;gap:11px;text-decoration:none;',
      '  padding:11px 16px;border-radius:9px;border:1px solid var(--ink,#2B2620);',
      '  background:var(--ink,#2B2620);color:var(--card,#FDFBF6);min-height:52px}',
      '.bf-store span{display:flex;flex-direction:column;line-height:1.15;text-align:left}',
      '.bf-store small{font-size:10.5px;opacity:.72;letter-spacing:.02em}',
      '.bf-store b{font-size:16px;font-weight:600;letter-spacing:-.01em}',
      // Not a link yet, so it must not look like one you can press.
      '.bf-store-soon{background:none;color:var(--ink-3,#726859);',
      '  border-color:var(--rule,#E0D9CB);cursor:default}'
    ].join('\n');
    document.head.appendChild(s);
  }

  BF.storesLive = function () { return !!(BF.APP_STORE || BF.PLAY_STORE); };

  BF.storeButtons = function () {
    ensureStoreCss();
    const soon = !BF.storesLive();
    return '<div class="bf-gate-stores">'
      + storeBtn('apple', BF.APP_STORE, 'App Store', soon ? 'Coming to the' : 'Download on the')
      + storeBtn('play',  BF.PLAY_STORE, 'Google Play', soon ? 'Coming to' : 'Get it on')
      + '</div>';
  };

  /* One sentence and the buttons, for the moment after somebody has asked for
     a sign-in link on a phone. They are standing there waiting for an email,
     which is the only dead time this product gets, and it is the right moment
     to hand them the thing the phone is actually for.

     `trial` is which button they pressed on the homepage, not a lookup: the
     same box signs in and signs up on purpose, so nothing here knows whether
     the account is new. What it changes is one clause, and both readings are
     true either way. */
  BF.appPitch = function (o) {
    o = o || {};
    const soon = !BF.storesLive();
    return '<p class="bf-apppitch"><b>'
      + (soon ? 'The phone app is coming.' : 'Get the app while you are here.')
      + '</b> '
      + (o.trial
          ? 'Beatfall on a phone is for catching notes, not for moving cards around. '
            + 'Say the line you just thought of and it is on your board when you sit down.'
          : 'It puts a note straight onto one of your boards from wherever you are, '
            + 'and the board is waiting when you sit down.')
      + '</p>' + BF.storeButtons();
  };

  BF.showSmallScreenGate = function (session) {
    if (document.getElementById('bf-gate')) return;
    BF.ready();

    const soon = !BF.APP_STORE && !BF.PLAY_STORE;
    const storeBlock = BF.storeButtons;
    const trialBlock = function () {
      return session
        ? '<p class="bf-gate-note">You’re signed in. Your board is ready whenever you '
          + 'open Beatfall on a larger screen.</p>'
        : '<a class="bf-gate-go" href="/login.html?start=1">Start 14 days free</a>'
          + '<p class="bf-gate-note">No card required. You can sign up here and open the '
          + 'board on a computer when you are ready. The board itself needs a bigger '
          + 'screen than this one, so there isn’t a cramped version of it here.</p>';
    };
    const el = document.createElement('div');
    el.id = 'bf-gate';
    el.innerHTML =
        '<div class="bf-gate-in">'
      +   '<div class="bf-gate-mark">' + MARK + '</div>'
      +   '<div class="bf-gate-word">Beat<span>fall</span></div>'
      +   '<p class="bf-gate-tag">Where your story falls into place.</p>'

      +   '<h1>Your notes already know the story. They’re just in the wrong order.</h1>'
      +   '<p class="bf-gate-body">Beatfall reads a file of scattered notes, works out which '
      +     'ones are story beats, puts them where they belong in the structure you’re '
      +     'writing to, and shows you the holes between them. It asks before it guesses, and '
      +     'it never writes your script.</p>'

      +   '<p class="bf-gate-body"><b>On a phone, Beatfall is for catching ideas.</b> '
      +     (soon
              ? 'The app is coming, and the note you think of standing in a car park will be '
                + 'waiting on your board when you sit down.'
              : 'Get the app and the note you have standing in a car park is waiting on your '
                + 'board when you sit down.') + '</p>'

      /* Signed out, this screen used to end the visit. Every tappable thing on
         it was Privacy, Terms, billing and a mailto, so somebody who came to
         start a trial had nowhere to go. Sign-in is not gated any more, so the
         offer that brought them here is on the page they landed on.

         The order of the next two blocks is decided by whether the stores are
         live, because whichever one a person can actually use should be first.
         While the buttons are inert notices, putting them above the only live
         control on the screen buries it under two things that do nothing.
         Filling in the two constants flips the order with everything else. */
      +   (soon ? trialBlock() + storeBlock() : storeBlock() + trialBlock())

      +   '<div class="bf-gate-links">'
      +     '<a href="/">About Beatfall</a><span>&middot;</span>'
      +     '<a href="/privacy.html">Privacy</a><span>&middot;</span>'
      +     '<a href="/terms.html">Terms</a><span>&middot;</span>'
      +     '<a href="/billing.html">How billing works</a><span>&middot;</span>'
      +     '<a href="mailto:contact@beatfall.app">Send feedback</a>'
      +   '</div>'
      +   '<p class="bf-gate-legal">&copy; ' + new Date().getFullYear()
      +     ' Beatfall, LLC. Your writing remains yours.</p>'
      + '</div>';

    const css = document.createElement('style');
    css.textContent = [
      '#bf-gate{position:fixed;inset:0;z-index:9999;overflow-y:auto;',
      '  background:var(--ground,#F1EEE7);color:var(--ink,#2B2620);',
      "  font-family:var(--sans,'Instrument Sans',system-ui,sans-serif);",
      '  -webkit-font-smoothing:antialiased}',
      '.bf-gate-in{max-width:30rem;margin:0 auto;padding:44px 22px 56px}',
      '.bf-gate-mark{line-height:0;margin-bottom:10px}',
      ".bf-gate-word{font-family:var(--serif,Newsreader,Georgia,serif);font-size:34px;",
      '  font-weight:600;letter-spacing:-.02em;line-height:1}',
      '.bf-gate-word span{color:var(--blue,#2C5C8F)}',
      '.bf-gate-tag{font-family:var(--serif,Newsreader,Georgia,serif);font-style:italic;',
      '  font-size:15px;color:var(--ink-3,#726859);margin:6px 0 30px}',
      '#bf-gate h1{font-family:var(--serif,Newsreader,Georgia,serif);font-size:27px;',
      '  font-weight:600;line-height:1.22;letter-spacing:-.017em;margin:0 0 16px}',
      '.bf-gate-body{font-size:15px;line-height:1.62;color:var(--ink-2,#5C5349);margin:0 0 16px}',
      '.bf-gate-body b{color:var(--ink,#2B2620);font-weight:600}',
      // The .bf-store rules used to sit here. They moved to ensureStoreCss()
      // when the sign-in page started showing the same buttons. Only the
      // spacing this screen wants stays behind.
      '#bf-gate .bf-gate-stores{margin:26px 0 18px}',
      // The one thing on this screen that is an offer rather than an apology,
      // so it is the only filled control on it.
      '.bf-gate-go{display:block;text-align:center;text-decoration:none;',
      '  padding:14px 18px;border-radius:9px;min-height:52px;box-sizing:border-box;',
      '  background:var(--blue,#2C5C8F);color:#fff;font-size:16px;font-weight:600;',
      '  letter-spacing:-.01em;margin:0 0 12px}',
      '.bf-gate-note{font-size:13.5px;line-height:1.55;color:var(--ink-3,#726859);margin:0 0 30px}',
      '.bf-gate-links{display:flex;flex-wrap:wrap;gap:9px;align-items:baseline;',
      '  font-size:13px;padding-top:20px;border-top:1px solid var(--rule,#E0D9CB)}',
      '.bf-gate-links a{color:var(--blue,#2C5C8F);text-decoration:underline;',
      '  text-underline-offset:2px}',
      '.bf-gate-links span{color:var(--ink-4,#8A8075)}',
      '.bf-gate-legal{font-size:11.5px;color:var(--ink-4,#8A8075);margin:14px 0 0}'
    ].join('\n');

    document.head.appendChild(css);
    document.body.appendChild(el);

    /* Both of these used to be one line and a comment that overstated it.
       `overflow:hidden` on the root element does not hold a phone: the page
       behind still scrolled, measured at 387px on an iPhone profile. It is the
       body that scrolls there, and pinning it is what actually stops it. */
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    /* And the comment claimed nothing behind the gate was reachable by a stray
       tab press, which was never true: Tab walked straight into the covered
       sign-in field and its submit button. Covering something is not the same
       as removing it, and a screen reader never saw the cover at all. */
    Array.prototype.forEach.call(document.body.children, function (child) {
      if (child === el) return;
      child.inert = true;                          // ignored where unsupported
      child.setAttribute('aria-hidden', 'true');
    });
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
