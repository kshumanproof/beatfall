/* ===========================================================================
   THE HELP BUBBLE.

   One button, bottom right, on every page. Press it and a small panel opens
   where a writer can ask how Beatfall works in their own words. It answers
   from the same material the help page draws, and when nobody has written the
   answer down it hands over the support address.

   FIVE THINGS DECIDED HERE, AND THE REASONS.

   IT IS ONE FILE, NOT TWELVE. The pages carry no copy of this and no copy of
   the styles. Beatfall already has three separate copies of the account pill
   and they spent a week disagreeing with each other about what a subscriber
   was paying. One script tag per page, and the widget brings everything it
   needs with it.

   IT NEEDS NOTHING ON THE PAGE. No BF, no Supabase, no session, no theme.css.
   Half the pages this runs on do not load the platform layer at all, and the
   ones that do may be showing somebody who cannot sign in. Colours come from
   the custom properties every page already declares, so it takes the writer's
   light or dark setting for free.

   EVERY ID IS PREFIXED hc-. `asksend` is already the Send button inside the
   board's beat conversation. A widget that floats over every page in the
   product cannot take a name that something underneath it is already using.

   IT IS BLUE, NEVER GOLD. Gold means a control costs a credit. Asking how the
   app works is free and must stay free, so this is blue like everything else
   that can be pressed for nothing.

   IT IS NEVER A DEAD END. Whatever breaks, the panel ends with an address a
   person reads. The server holds the same rule from its side.
   =========================================================================== */
(function () {
  'use strict';

  if (window.HelpChat) return;          // never twice on one page

  var SUPPORT  = 'support@beatfall.app';
  var MAXCHARS = 400;                   // the server cuts at the same figure

  /* --------------------------------------------------------------- styles --
     Injected rather than written into twelve stylesheets. Everything is
     namespaced under .hc so nothing here can reach a page's own markup, and
     every colour is a token the page already defines. */
  var CSS = [
    '.hc-bubble{position:fixed;right:20px;bottom:20px;z-index:240;width:52px;height:52px;',
      'border-radius:50%;border:1px solid var(--blue);background:var(--blue);color:var(--on-blue);',
      'display:flex;align-items:center;justify-content:center;cursor:pointer;',
      'box-shadow:0 2px 4px rgba(0,0,0,.10),0 12px 24px -12px rgba(0,0,0,.45);',
      'transition:transform .12s ease,box-shadow .12s ease}',
    '.hc-bubble:hover{transform:translateY(-1px);box-shadow:0 3px 6px rgba(0,0,0,.12),0 16px 30px -12px rgba(0,0,0,.5)}',
    '.hc-bubble:focus-visible{outline:2px solid var(--blue);outline-offset:3px}',
    '.hc-bubble svg{pointer-events:none}',
    '.hc-bubble[hidden]{display:none}',

    '.hc-panel{position:fixed;right:20px;bottom:20px;z-index:241;width:378px;max-width:calc(100vw - 40px);',
      'max-height:min(560px,calc(100vh - 40px));display:flex;flex-direction:column;',
      'background:var(--card);border:1px solid var(--rule);border-radius:var(--r-panel);',
      'box-shadow:0 2px 6px rgba(0,0,0,.10),0 24px 48px -20px rgba(0,0,0,.5);overflow:hidden}',
    '.hc-panel[hidden]{display:none}',

    '.hc-head{flex:0 0 auto;display:flex;align-items:flex-start;gap:12px;padding:16px 16px 13px;',
      'border-bottom:1px solid var(--rule-soft);background:var(--surface)}',
    '.hc-head h2{font-family:var(--serif);font-size:18px;line-height:1.15;margin:0 0 3px}',
    '.hc-head p{font-size:12px;line-height:1.45;color:var(--ink-3);margin:0}',
    '.hc-x{flex:0 0 auto;margin-left:auto;width:30px;height:30px;border:0;background:none;',
      'color:var(--ink-3);cursor:pointer;border-radius:var(--r-ctl);display:flex;',
      'align-items:center;justify-content:center;font-size:19px;line-height:1}',
    '.hc-x:hover{background:var(--rule-soft);color:var(--ink)}',

    /* The thread scrolls, the box does not move. Same discipline as the
       logline coach: the place you type is in the same place at question one
       and at question five. */
    '.hc-thread{flex:1 1 auto;overflow-y:auto;padding:16px;display:flex;',
      'flex-direction:column;gap:13px}',
    '.hc-turn .hc-said{font-family:var(--sans);font-size:10.5px;font-weight:600;letter-spacing:.09em;',
      'text-transform:uppercase;color:var(--ink-4);margin:0 0 4px}',
    '.hc-turn .hc-body{font-size:14px;line-height:1.6;color:var(--ink-2);margin:0;white-space:pre-wrap}',
    '.hc-turn.hc-you .hc-body{color:var(--ink)}',
    '.hc-turn.hc-out{border-top:1px solid var(--rule-soft);padding-top:13px}',
    '.hc-thinking{color:var(--ink-4)}',
    '.hc-hand{margin-top:11px;padding:11px 13px;background:var(--surface);border:1px solid var(--rule);',
      'border-radius:var(--r-ctl);font-size:12.5px;line-height:1.5;color:var(--ink-2)}',
    '.hc-hand a{font-weight:600}',
    '.hc-open{font-size:13px;line-height:1.6;color:var(--ink-3);margin:0}',

    '.hc-row{flex:0 0 auto;display:flex;gap:9px;align-items:flex-end;padding:13px 16px 15px;',
      'border-top:1px solid var(--rule-soft);background:var(--surface)}',
    '.hc-row textarea{flex:1;min-width:0;font-family:var(--sans);font-size:14px;line-height:1.45;',
      'color:var(--ink);background:var(--card);border:1px solid var(--rule);border-radius:var(--r-ctl);',
      'padding:10px 11px;resize:none;min-height:42px;max-height:112px}',
    '.hc-row textarea:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 2px var(--blue-soft)}',
    '.hc-row button{flex:0 0 auto;min-height:42px;padding:0 15px;border-radius:var(--r-ctl);',
      'border:1px solid var(--blue);background:var(--blue);color:var(--on-blue);cursor:pointer;',
      'font-family:var(--sans);font-size:13px;font-weight:600}',
    '.hc-row button:disabled{opacity:.5;cursor:default}',

    /* A phone gives it the width of the screen rather than a card floating in
       the corner of one. */
    '@media(max-width:560px){',
      '.hc-panel{right:10px;left:10px;bottom:10px;width:auto;max-width:none;',
        'max-height:calc(100vh - 20px);max-height:calc(100dvh - 20px)}',
      '.hc-bubble{right:14px;bottom:14px}}',

    '@media(prefers-reduced-motion:reduce){.hc-bubble{transition:none}}'
  ].join('');

  /* ---------------------------------------------------------------- bits -- */
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/[&<>"]/g, function (c) {
        return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
      });
  }

  /* One browser, one id, whichever page they happen to be standing on. The
     platform layer already keeps this key; when it is not loaded, the same
     key is read and written here so the two never disagree. The server uses
     it for the hourly ceiling and nothing else, and a private window with
     storage blocked simply has none. */
  function anonId() {
    try {
      if (window.BF && BF.anonId) return BF.anonId();
      var k = 'beatfall.anon', v = localStorage.getItem(k);
      if (!v) {
        v = (crypto && crypto.randomUUID) ? crypto.randomUUID()
          : String(Date.now()) + Math.random().toString(16).slice(2);
        localStorage.setItem(k, v);
      }
      return v;
    } catch (e) { return null; }
  }

  /* PLAIN FETCH, NOT BF.api. BF.api attaches a Supabase session token and the
     client behind it only exists once BF.init() has run, which several of
     these pages never do. The help endpoint takes no account on purpose. */
  function askServer(question) {
    return fetch('/api/help', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({question: question, anon: anonId()})
    }).then(function (r) {
      return r.json().catch(function () { return {}; });
    });
  }

  /* ---------------------------------------------------------------- build -- */
  var bubble, panel, thread, box, send, opening, asking = false, built = false;

  function build() {
    if (built) return;
    built = true;

    var style = document.createElement('style');
    style.id = 'hc-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.id = 'hc-bubble';
    bubble.className = 'hc-bubble';
    bubble.setAttribute('aria-label', 'Ask about Beatfall');
    bubble.title = 'Ask about Beatfall';
    bubble.innerHTML =
      '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M21 11.6c0 4-3.9 7.2-8.7 7.2-1 0-2-.15-2.9-.42L4 20l1.5-3.5'
      + 'C4.2 15.2 3.4 13.5 3.4 11.6 3.4 7.6 7.3 4.4 12.1 4.4S21 7.6 21 11.6Z"/>'
      + '</svg>';

    panel = document.createElement('div');
    panel.id = 'hc-panel';
    panel.className = 'hc-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Ask about Beatfall');
    panel.hidden = true;
    panel.innerHTML =
      '<div class="hc-head">'
      +   '<div><h2>Ask about Beatfall</h2>'
      +   '<p>How the app works, not about your script. It costs nothing.</p></div>'
      +   '<button type="button" class="hc-x" id="hc-close" aria-label="Close">&#215;</button>'
      + '</div>'
      + '<div class="hc-thread" id="hc-thread" role="log" aria-live="polite">'
      +   '<p class="hc-open" id="hc-open">Type it however you would say it. If nobody has '
      +   'written the answer down, you will get an address for a person instead.</p>'
      + '</div>'
      + '<div class="hc-row">'
      +   '<textarea id="hc-box" rows="1" maxlength="' + MAXCHARS + '"'
      +     ' placeholder="How do I start a new script?"'
      +     ' aria-label="Your question"></textarea>'
      +   '<button type="button" id="hc-send">Ask</button>'
      + '</div>';

    document.body.appendChild(bubble);
    document.body.appendChild(panel);

    thread  = panel.querySelector('#hc-thread');
    box     = panel.querySelector('#hc-box');
    send    = panel.querySelector('#hc-send');
    opening = panel.querySelector('#hc-open');

    bubble.addEventListener('click', function () { open(); });
    panel.querySelector('#hc-close').addEventListener('click', close);
    send.addEventListener('click', ask);
    box.addEventListener('input', grow);
    box.addEventListener('keydown', function (e) {
      // Enter asks, Shift and Enter is a new line. The bargain every other box
      // in Beatfall makes.
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
    });

    /* Escape closes it. A click elsewhere deliberately does not: a stray press
       should not throw away a thread somebody is reading, and Close is right
       there saying what it does. */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); close(); }
    }, true);
  }

  function grow() {
    box.style.height = 'auto';
    box.style.height = Math.min(112, box.scrollHeight) + 'px';
  }

  function open(prefill) {
    build();
    panel.hidden = false;
    bubble.hidden = true;
    if (prefill) { box.value = String(prefill).slice(0, MAXCHARS); grow(); }
    box.focus();
  }

  function close() {
    if (!built) return;
    panel.hidden = true;
    bubble.hidden = false;
    bubble.focus();
  }

  function turn(who, cls, html) {
    var el = document.createElement('div');
    el.className = 'hc-turn ' + cls;
    el.innerHTML = '<p class="hc-said">' + esc(who) + '</p>' + html;
    thread.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
    return el;
  }

  function handoffBlock(question) {
    return '<div class="hc-hand">Nobody has written that one down yet. Email '
      + '<a href="mailto:' + esc(SUPPORT) + '?subject='
      + encodeURIComponent('Beatfall: ' + question.slice(0, 80)) + '">' + esc(SUPPORT)
      + '</a> and it will be read. Say what you were trying to do and which page '
      + 'you were on.</div>';
  }

  function ask() {
    var q = box.value.trim();
    if (!q || asking) return;
    asking = true;
    send.disabled = true;
    box.value = ''; grow();
    if (opening) { opening.remove(); opening = null; }

    turn('You', 'hc-you', '<p class="hc-body">' + esc(q) + '</p>');
    var waiting = turn('Beatfall', 'hc-out',
      '<p class="hc-body hc-thinking">Reading&#8230;</p>');

    askServer(q).catch(function () { return null; }).then(function (r) {
      /* Never a dead end. A refusal, a failure and a request that never
         arrived all leave an address on the screen rather than a spinner that
         stopped moving. */
      var answer = (r && r.answer)
        || "Couldn't get an answer just now. Try again in a moment, or write to "
           + SUPPORT + '.';
      if (r && r.support) SUPPORT = r.support;

      waiting.innerHTML = '<p class="hc-said">Beatfall</p>'
        + '<p class="hc-body">' + esc(answer) + '</p>'
        + (r && r.handoff ? handoffBlock(q) : '');

      asking = false;
      send.disabled = false;
      thread.scrollTop = thread.scrollHeight;
      box.focus();
    });
  }

  /* The help page opens this from its own controls, which is why the handle is
     public: its search has a button that hands over the words it could not
     match, and one implementation of asking is the whole point of this file. */
  window.HelpChat = {open: open, close: close};

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
}());
