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

  /* THE THREAD IS SENT WITH EVERY QUESTION.
     Without it, "so that's it?" is a question about nothing and comes back
     saying it has no context, which is exactly what it did. Four exchanges is
     what the server keeps, so there is no point sending more. It lives here in
     the page and is gone the moment the tab is closed: nothing about this
     conversation is stored anywhere. */
  var MAX_TURNS = 8;
  var history = [];

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

    '.hc-head{flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:14px 16px;',
      'border-bottom:1px solid var(--rule-soft);background:var(--surface)}',
    '.hc-head h2{font-family:var(--serif);font-size:18px;line-height:1.15;margin:0}',
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
    '.hc-hand .hc-go{margin-top:9px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
    '.hc-hand .hc-go button{border:1px solid var(--blue);background:var(--blue);',
      'color:var(--on-blue);border-radius:var(--r-ctl);padding:8px 13px;cursor:pointer;',
      'font-family:var(--sans);font-size:12.5px;font-weight:600}',

    /* ---- the form ----
       It replaces the thread rather than opening over it, because a panel this
       size cannot hold both and the conversation is going with the message
       anyway. Back puts it straight back. */
    '.hc-form{flex:1 1 auto;overflow-y:auto;padding:16px;display:flex;',
      'flex-direction:column;gap:13px}',
    '.hc-form[hidden]{display:none}',
    '.hc-form h3{font-family:var(--serif);font-size:17px;line-height:1.2;margin:0}',
    '.hc-form .hc-why{font-size:12.5px;line-height:1.5;color:var(--ink-3);margin:0}',
    '.hc-f{display:flex;flex-direction:column;gap:5px}',
    '.hc-f label{font-family:var(--sans);font-size:10.5px;font-weight:600;',
      'letter-spacing:.08em;text-transform:uppercase;color:var(--ink-4)}',
    '.hc-f input,.hc-f select,.hc-f textarea{font-family:var(--sans);font-size:14px;',
      'line-height:1.45;color:var(--ink);background:var(--card);border:1px solid var(--rule);',
      'border-radius:var(--r-ctl);padding:9px 11px;width:100%;box-sizing:border-box}',
    '.hc-f textarea{resize:vertical;min-height:84px}',
    '.hc-f input:focus,.hc-f select:focus,.hc-f textarea:focus{outline:none;',
      'border-color:var(--blue);box-shadow:0 0 0 2px var(--blue-soft)}',
    /* Gold would say this spends a credit. It does not. */
    '.hc-bad{font-size:12.5px;line-height:1.5;color:var(--red,#A33);margin:0}',
    '.hc-note{font-size:12px;line-height:1.5;color:var(--ink-4);margin:0}',
    '.hc-done{font-size:14px;line-height:1.6;color:var(--ink-2);margin:0}',

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
    '.hc-formrow{justify-content:flex-end}',
    '.hc-formrow[hidden]{display:none}',
    '.hc-row .hc-quiet{background:none;border-color:var(--rule);color:var(--ink-2);',
      'font-weight:500;margin-right:auto}',
    '.hc-row .hc-quiet:hover{background:var(--rule-soft)}',

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
      body: JSON.stringify({
        question: question,
        history: history.slice(-MAX_TURNS),
        anon: anonId()
      })
    }).then(function (r) {
      return r.json().catch(function () { return {}; });
    });
  }

  /* ---------------------------------------------------------------- build -- */
  var bubble, panel, thread, box, send, opening, form, row, formRow, head,
      asking = false, built = false, sending = false;

  /* What the person last asked, so the form can open carrying it rather than
     asking them to type it a second time. */
  var lastAsked = '';

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
      /* No subtitle. It explained the panel to somebody who had already opened
         it, which is a caption doing no product job, and the placeholder in
         the box below says the same thing by example. */
      +   '<div><h2>Ask about Beatfall</h2></div>'
      +   '<button type="button" class="hc-x" id="hc-close" aria-label="Close">&#215;</button>'
      + '</div>'
      + '<div class="hc-thread" id="hc-thread" role="log" aria-live="polite">'
      +   '<p class="hc-open" id="hc-open">Type it however you would say it. If nobody has '
      +   'written the answer down, it will put you in touch with a person instead.</p>'
      + '</div>'

      /* ---- the form ----
         FOUR FIELDS, TWO OF WHICH ARRIVE ANSWERED. Everything else a first
         reply would have to ask for is already known and goes with the message
         without being asked for: the conversation, the page they were on,
         whether they were signed in, and the browser. */
      + '<div class="hc-form" id="hc-form" hidden>'
      +   '<h3>Send this to support</h3>'
      +   '<p class="hc-why" id="hc-why">Nobody has written that one down yet. '
      +   'This goes straight to a person, with your question attached.</p>'
      +   '<div class="hc-f"><label for="hc-kind">What kind of thing is this</label>'
      +     '<select id="hc-kind"></select></div>'
      +   '<div class="hc-f"><label for="hc-where">Where in Beatfall</label>'
      +     '<select id="hc-where"></select></div>'
      +   '<div class="hc-f"><label for="hc-detail">What you need</label>'
      +     '<textarea id="hc-detail" maxlength="4000" placeholder="What were you '
      +     'trying to do, and what happened instead?"></textarea></div>'
      +   '<div class="hc-f"><label for="hc-email">Where to reply</label>'
      +     '<input id="hc-email" type="email" autocomplete="email" '
      +     'placeholder="you@example.com"></div>'
      +   '<p class="hc-note" id="hc-attach"></p>'
      +   '<p class="hc-bad" id="hc-bad" hidden></p>'
      + '</div>'

      + '<div class="hc-row" id="hc-askrow">'
      +   '<textarea id="hc-box" rows="1" maxlength="' + MAXCHARS + '"'
      +     ' placeholder="How do I start a new script?"'
      +     ' aria-label="Your question"></textarea>'
      +   '<button type="button" id="hc-send">Ask</button>'
      + '</div>'

      /* The form has its own footer rather than borrowing the ask row. One row
         that changes what its button does depending on what is above it is how
         somebody presses Send and asks a question instead. */
      + '<div class="hc-row hc-formrow" id="hc-formrow" hidden>'
      +   '<button type="button" class="hc-quiet" id="hc-back">Back</button>'
      +   '<button type="button" id="hc-submit">Send to support</button>'
      + '</div>';

    document.body.appendChild(bubble);
    document.body.appendChild(panel);

    thread  = panel.querySelector('#hc-thread');
    box     = panel.querySelector('#hc-box');
    send    = panel.querySelector('#hc-send');
    opening = panel.querySelector('#hc-open');
    form    = panel.querySelector('#hc-form');
    row     = panel.querySelector('#hc-askrow');
    formRow = panel.querySelector('#hc-formrow');
    head    = panel.querySelector('.hc-head h2');

    bubble.addEventListener('click', function () { open(); });
    panel.querySelector('#hc-close').addEventListener('click', close);
    send.addEventListener('click', ask);
    panel.querySelector('#hc-submit').addEventListener('click', submitTicket);
    panel.querySelector('#hc-back').addEventListener('click', closeForm);

    /* The hand-off button and the one on the finished state are drawn into the
       thread and the form after the fact, so they are caught here rather than
       bound at every place that writes one. */
    panel.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.hc-ticket, .hc-backchat') : null;
      if (!t) return;
      if (t.classList.contains('hc-backchat')) { rebuildForm(); closeForm(); }
      else openForm(t.getAttribute('data-topic'));
    });
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

  /* THE DEAD END IS A BUTTON, NOT AN ADDRESS.
     A mailto opens an empty window and asks somebody who has just explained
     themselves to do it again from nothing. The button opens a form that is
     already carrying their question. Writing directly still works and is still
     offered, for anybody who would rather use their own mail. */
  function handoffBlock(question, topic) {
    return '<div class="hc-hand">Nobody has written that one down yet, so this '
      + 'one needs a person.'
      + '<div class="hc-go">'
      +   '<button type="button" class="hc-ticket" data-topic="' + esc(topic || '')
      +     '">Send this to support</button>'
      +   '<a href="mailto:' + esc(SUPPORT) + '?subject='
      +     encodeURIComponent('Beatfall: ' + question.slice(0, 80)) + '">or email '
      +     esc(SUPPORT) + '</a>'
      + '</div></div>';
  }

  /* ----------------------------------------------------------- the form --
     WHAT IT ASKS FOR IS WHAT CANNOT BE WORKED OUT. The page, the browser, the
     conversation and whether they are signed in all go with the message
     without a field, because asking for something the browser already knows is
     the form spending the only thing it has, which is patience. */
  var FIELDS = null;   // kinds and wheres, from the server

  /* One topic answers both dropdowns. Somebody who asked about a sign-in code
     should not then be asked, by a form, what their problem is about. */
  var FROM_TOPIC = {
    'signing-in': ["I can't get in", 'Signing in'],
    'billing':    ['Plan or payment', 'Settings or billing'],
    'broken':     ['Something is broken', ''],
    'lost-work':  ["I've lost work", ''],
    'how-to':     ['A question about how to do something', ''],
    'pictures':   ['A question about how to do something', 'Notes or pictures'],
    'phone':      ['A question about how to do something', 'The phone app'],
    'privacy':    ['Privacy or my data', ''],
    'suggestion': ['A suggestion', ''],
    'other':      ['', '']
  };

  function fillSelect(el, list, chosen) {
    el.innerHTML = list.map(function (v) {
      return '<option' + (v === chosen ? ' selected' : '') + '>' + esc(v) + '</option>';
    }).join('');
  }

  /* The signed-in address, when the page has one. A writer who is signed in
     should never be asked where to reply. */
  function knownEmail() {
    try {
      if (window.ME && ME.email) return ME.email;
      if (window.BF && BF.email) return BF.email;
    } catch (e) {}
    return '';
  }

  /* The two lists come from the server so there is never a second copy of them
     in this file to drift out of step with what the server will accept. They
     arrive with any answer; on the help page, where somebody can reach the form
     without asking anything first, they are fetched once on the way in. */
  function needFields() {
    if (FIELDS) return Promise.resolve();
    return fetch('/api/help').then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.kinds && d.wheres) FIELDS = {kinds: d.kinds, wheres: d.wheres};
        if (d && d.support) SUPPORT = d.support;
      })
      .catch(function () {});
  }

  function openForm(topic) {
    build();
    if (panel.hidden) open();
    if (!FIELDS) { needFields().then(function () { openForm(topic); }); return; }

    if (!FORM_HTML) FORM_HTML = form.innerHTML;
    rebuildForm();
    var guess = FROM_TOPIC[topic] || ['', ''];
    var kinds  = (FIELDS && FIELDS.kinds)  || [];
    var wheres = (FIELDS && FIELDS.wheres) || [];
    fillSelect(panel.querySelector('#hc-kind'), kinds, guess[0]);
    fillSelect(panel.querySelector('#hc-where'), wheres, guess[1]);

    var detail = panel.querySelector('#hc-detail');
    if (!detail.value) detail.value = lastAsked;
    var mail = panel.querySelector('#hc-email');
    if (!mail.value) mail.value = knownEmail();

    panel.querySelector('#hc-attach').textContent = history.length
      ? 'The questions you already asked go with this, so nobody makes you '
        + 'repeat yourself.'
      : 'The page you are on goes with this.';

    panel.querySelector('#hc-bad').hidden = true;
    head.textContent = 'Send this to support';
    thread.hidden = true;
    form.hidden = false;
    row.hidden = true;
    formRow.hidden = false;
    (mail.value ? detail : mail).focus();
  }

  /* The sent state replaces the form's markup, so going back to it needs the
     fields put back rather than a stale receipt shown a second time. */
  var FORM_HTML = '';
  function rebuildForm() { if (FORM_HTML) form.innerHTML = FORM_HTML; }

  function closeForm() {
    head.textContent = 'Ask about Beatfall';
    form.hidden = true;
    formRow.hidden = true;
    thread.hidden = false;
    row.hidden = false;
    box.focus();
  }

  function fail(words) {
    var bad = panel.querySelector('#hc-bad');
    bad.textContent = words;
    bad.hidden = false;
  }

  function submitTicket() {
    if (sending) return;
    var email  = panel.querySelector('#hc-email').value.trim();
    var detail = panel.querySelector('#hc-detail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail('That address does not look right. It is where the reply goes.');
    }
    if (!detail) return fail('Say what you need, even roughly.');

    var go = panel.querySelector('#hc-submit');
    sending = true;
    go.disabled = true;
    go.textContent = 'Sending';

    fetch('/api/help', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        action: 'ticket',
        email: email,
        detail: detail,
        kind: panel.querySelector('#hc-kind').value,
        where: panel.querySelector('#hc-where').value,
        /* Sent rather than asked for. */
        page: location.pathname + location.search,
        agent: navigator.userAgent,
        signedIn: !!knownEmail(),
        thread: history.slice(-MAX_TURNS),
        anon: anonId()
      })
    }).then(function (r) {
      return r.json().catch(function () { return {}; })
        .then(function (b) { return {ok: r.ok, body: b}; });
    }).catch(function () { return {ok: false, body: {}}; })
      .then(function (r) {
        sending = false;
        go.disabled = false;
        go.textContent = 'Send to support';
        if (r.ok && r.body && r.body.sent) {
          formRow.hidden = true;
          /* Say WHERE it went and WHAT happens next. "Thanks, submitted" is
             the message that makes somebody check back four times. */
          form.innerHTML = '<h3>It is on its way</h3>'
            + '<p class="hc-done">That has gone to ' + esc(SUPPORT) + ', with your '
            + 'question attached. A reply comes back to ' + esc(email) + '.</p>'
            + '<div class="hc-go"><button type="button" class="hc-backchat">'
            + 'Back to the questions</button></div>';
          return;
        }
        var why = (r.body && r.body.error) || '';
        if (why === 'too_many') {
          fail((r.body && r.body.message) || 'That is several messages in a short time.');
        } else {
          /* NEVER PRETEND. If the message did not go, the address is the
             answer, because it is the one that still works. */
          fail('That did not send. Email ' + SUPPORT + ' directly and it will be '
             + 'read. Nothing you typed is lost, so you can copy it out first.');
        }
      });
  }

  function ask() {
    var q = box.value.trim();
    if (!q || asking) return;
    lastAsked = q;
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
      if (r && r.kinds && r.wheres) FIELDS = {kinds: r.kinds, wheres: r.wheres};

      waiting.innerHTML = '<p class="hc-said">Beatfall</p>'
        + '<p class="hc-body">' + esc(answer) + '</p>'
        + (r && r.handoff ? handoffBlock(q, r && r.topic) : '');

      /* Both halves, or the next question arrives with a hole in the middle of
         what was said. An answer that never came is not recorded as one: a
         request that failed would otherwise put "could not get an answer just
         now" into the conversation as though Beatfall had said it. */
      if (r && r.answer) {
        history.push({role: 'user', content: q});
        history.push({role: 'assistant', content: answer});
        if (history.length > MAX_TURNS) history = history.slice(-MAX_TURNS);
      }

      asking = false;
      send.disabled = false;
      thread.scrollTop = thread.scrollHeight;
      box.focus();
    });
  }

  /* The help page opens this from its own controls, which is why the handle is
     public: its search has a button that hands over the words it could not
     match, and one implementation of asking is the whole point of this file. */
  /* `ticket` is public because the help page offers the form directly: its
     search panel has a way to reach a person that should not be a mailto
     either. One implementation of the form, two doors into it. */
  window.HelpChat = {open: open, close: close, ticket: openForm};

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
}());
