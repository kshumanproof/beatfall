/* Builds the Beatfall transactional email templates.
 *
 * Email is not the web. No flexbox, no grid, no CSS variables, no reliable web
 * fonts, and images are blocked by default on a first message from an unknown
 * sender. So: tables, inline styles, literal hex, and a layout that still reads
 * correctly with every image switched off.
 *
 * The palette and the way it is USED both come from the site. Same tokens as
 * public/theme.css, and the same band structure as the homepage: a surface
 * masthead over a rule, paper in the middle, a surface footer under a rule.
 * The uppercase label above the code is gold at 11px and .16em because that is
 * exactly what `.eyebrow` is on index.html, and it is the single most
 * recognisable small detail on that page.
 */
const fs = require('fs');

// ---- the palette, lifted from public/theme.css. Never invented here. -------
const L = {
  ground:'#F1EEE7', surface:'#F6F3ED', card:'#FDFBF6',
  ink:'#2B2620', ink2:'#5C5349', ink3:'#726859', ink4:'#8A8075',
  rule:'#E0D9CB', ruleSoft:'#EDE7DA',
  blue:'#2C5C8F', gold:'#7B5A13', goldHair:'#D9C08A'
};
const D = {
  ground:'#1A1714', surface:'#211D19', card:'#292420',
  ink:'#EFE9DE', ink2:'#C2B7A8', ink3:'#9A8F82', ink4:'#8C8175',
  rule:'#3A342C', ruleSoft:'#2E2923',
  blue:'#8FB6DE', gold:'#D9BC77', goldHair:'#7E6C3E'
};

/* Newsreader, Instrument Sans and Courier Prime will not load in most mail
   clients, so each stack names the real face first and the closest thing
   already on the machine second. Georgia for the serif and Courier New for the
   code are not compromises: Courier Prime IS the mono in theme.css. */
const SERIF = "'Newsreader',Georgia,'Times New Roman',serif";
const SANS  = "'Instrument Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO  = "'Courier Prime','Courier New',Courier,monospace";

const SITE    = 'https://beatfall.app';
const REPLYTO = 'support@beatfall.app';   // where a real question goes

/* --------------------------------------------------------------- shell ----
   `body` is the letter's middle: heading, lede, code, closing lines. */
function shell({ preheader, heading, lede, eyebrow, code, after, sig }) {
  return `<!doctype html>
<html lang="en" style="color-scheme:light dark;supported-color-schemes:light dark;">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Beatfall</title>
<style>
  /* Apple Mail, iOS Mail and Outlook.com honour this. Gmail runs its own
     inversion and ignores it, which is why every colour below is ALSO set
     inline: the message is correct in light, and better in dark where the
     client allows it. */
  @media (prefers-color-scheme: dark) {
    .bf-body    { background:${D.ground} !important; }
    .bf-band    { background:${D.surface} !important; border-color:${D.rule} !important; }
    .bf-card    { background:${D.card} !important; border-color:${D.rule} !important; }
    .bf-code    { background:${D.surface} !important; border-color:${D.rule} !important; }
    .bf-ink     { color:${D.ink} !important; }
    .bf-ink2    { color:${D.ink2} !important; }
    .bf-ink3    { color:${D.ink3} !important; }
    .bf-ink4    { color:${D.ink4} !important; }
    .bf-gold    { color:${D.gold} !important; }
    .bf-lockup  { content:url("${SITE}/brand/lockup-dark.png"); }
    a           { color:${D.blue} !important; }
  }
  @media only screen and (max-width:620px) {
    .bf-wrap   { width:100% !important; }
    .bf-pad    { padding-left:22px !important; padding-right:22px !important; }
    .bf-digits { font-size:31px !important; letter-spacing:.24em !important; }
  }
  a { color:${L.blue}; }
</style>
</head>
<body class="bf-body" style="margin:0;padding:0;background:${L.ground};">

<!-- What the inbox shows beside the subject line, and nothing more. -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
  ${preheader}
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       class="bf-body" style="background:${L.ground};margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:0 0 46px 0;">

      <!-- MASTHEAD BAND. The homepage's own header: surface, rule under it. -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             class="bf-band" style="background:${L.surface};border-bottom:1px solid ${L.rule};">
        <tr>
          <td align="center" style="padding:0 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
                   class="bf-wrap" style="width:600px;max-width:600px;">
              <tr>
                <td class="bf-pad" style="padding:22px 6px;">
                  <img src="${SITE}/brand/lockup.png" alt="Beatfall" width="150" height="33"
                       style="display:block;width:150px;height:33px;border:0;outline:none;
                              text-decoration:none;-ms-interpolation-mode:bicubic;"
                       class="bf-lockup">
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- THE LETTER, on paper, on the ground. -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td align="center" style="padding:38px 12px 0 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
                   class="bf-wrap" style="width:600px;max-width:600px;">
              <tr>
                <td class="bf-card" style="background:${L.card};border:1px solid ${L.rule};
                           border-radius:4px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td class="bf-pad" style="padding:40px 44px 0 44px;">
                        <h1 class="bf-ink" style="margin:0 0 14px 0;font-family:${SERIF};
                            font-size:26px;line-height:1.24;font-weight:600;color:${L.ink};">${heading}</h1>
                        <p class="bf-ink2" style="margin:0;font-family:${SANS};font-size:15.5px;
                           line-height:1.62;color:${L.ink2};">${lede}</p>
                      </td>
                    </tr>

                    <!-- the code -->
                    <tr>
                      <td class="bf-pad" style="padding:28px 44px 0 44px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                               class="bf-code" style="background:${L.surface};
                                      border:1px solid ${L.rule};border-radius:4px;">
                          <tr>
                            <td align="center" style="padding:24px 16px 26px 16px;">
                              <div class="bf-gold" style="font-family:${SANS};font-size:11px;
                                   font-weight:600;text-transform:uppercase;letter-spacing:.16em;
                                   color:${L.gold};margin:0 0 14px 0;">${eyebrow}</div>
                              <div class="bf-ink bf-digits" style="font-family:${MONO};
                                   font-size:38px;line-height:1;font-weight:700;letter-spacing:.3em;
                                   color:${L.ink};text-indent:.3em;">${code}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr>
                      <td class="bf-pad" style="padding:22px 44px 40px 44px;">
                        <p class="bf-ink2" style="margin:0 0 14px 0;font-family:${SANS};
                           font-size:15.5px;line-height:1.62;color:${L.ink2};">${after}</p>
                        <p class="bf-ink3" style="margin:0;font-family:${SANS};font-size:13.5px;
                           line-height:1.6;color:${L.ink3};">${sig}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- FOOTER BAND. The homepage's footer: surface, rule over it. -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             class="bf-band" style="background:${L.surface};border-top:1px solid ${L.rule};
                    margin-top:40px;">
        <tr>
          <td align="center" style="padding:0 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
                   class="bf-wrap" style="width:600px;max-width:600px;">
              <tr>
                <td class="bf-pad" style="padding:26px 6px 28px 6px;">
                  <p class="bf-ink3" style="margin:0 0 10px 0;font-family:${SANS};font-size:12.5px;
                     line-height:1.6;color:${L.ink3};">
                    <a href="${SITE}/help" style="color:${L.blue};text-decoration:none;">Help</a>
                    <span class="bf-ink4" style="color:${L.ink4};">&nbsp;&middot;&nbsp;</span>
                    <a href="${SITE}/privacy" style="color:${L.blue};text-decoration:none;">Privacy</a>
                    <span class="bf-ink4" style="color:${L.ink4};">&nbsp;&middot;&nbsp;</span>
                    <a href="${SITE}/terms" style="color:${L.blue};text-decoration:none;">Terms</a>
                  </p>
                  <p class="bf-ink4" style="margin:0 0 6px 0;font-family:${SANS};font-size:12px;
                     line-height:1.6;color:${L.ink4};">
                    Sent because somebody asked to sign in to Beatfall with this address.
                    If that was not you, nothing has happened and you can ignore it.
                  </p>
                  <p class="bf-ink4" style="margin:0;font-family:${SANS};font-size:12px;
                     line-height:1.6;color:${L.ink4};">
                    <strong style="font-weight:600;">Nobody reads replies to this address.</strong>
                    For anything you need an answer to, write to
                    <a href="mailto:${REPLYTO}" style="color:${L.blue};text-decoration:none;">${REPLYTO}</a>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/* ---------------------------------------------------------------- copy ----
   House voice: one idea per sentence, plain, no em dashes, and never a word
   about how any of it works inside. */
const SIGNUP = {
  preheader: 'Your code is {{ .Token }}. It works once.',
  heading: 'Welcome to Beatfall',
  lede: 'Here is the code that opens your account. Type it into the box you just came from.',
  eyebrow: 'Your code',
  code: '{{ .Token }}',
  after: 'It works once, and expires in an hour. If it stops working, ask for another from the same box.',
  sig: 'If you did not ask for this, no account has been created and there is nothing to undo.'
};

const SIGNIN = {
  preheader: 'Your code is {{ .Token }}. It works once.',
  heading: 'Here is your code',
  lede: 'Type it into the box you just came from and your boards will be waiting.',
  eyebrow: 'Your code',
  code: '{{ .Token }}',
  after: 'It works once, and expires in an hour. If it stops working, ask for another from the same box.',
  sig: 'If you did not ask for this, you can ignore it. Nobody reaches your account without the code.'
};

fs.writeFileSync('signup.html', shell(SIGNUP));
fs.writeFileSync('signin.html', shell(SIGNIN));
console.log('built signup.html and signin.html');

/* ------------------------------------------------- the deletion warning ----
   The other email this product sends, at five months of silence. Same room as
   the two above, but no code and a different job: it has to be believed, and
   it has to be easy to act on. The existing copy was already right and is kept
   almost word for word. */
function warning() {
  const body = `
                    <tr>
                      <td class="bf-pad" style="padding:40px 44px 0 44px;">
                        <div class="bf-gold" style="font-family:${SANS};font-size:11px;
                             font-weight:600;text-transform:uppercase;letter-spacing:.16em;
                             color:${L.gold};margin:0 0 16px 0;">About your account</div>
                        <h1 class="bf-ink" style="margin:0 0 14px 0;font-family:${SERIF};
                            font-size:26px;line-height:1.24;font-weight:600;color:${L.ink};">Your Beatfall account will be deleted in about a month</h1>
                        <p class="bf-ink2" style="margin:0 0 14px 0;font-family:${SANS};
                           font-size:15.5px;line-height:1.62;color:${L.ink2};">You have not signed in to Beatfall for five months.</p>
                        <p class="bf-ink2" style="margin:0 0 14px 0;font-family:${SANS};
                           font-size:15.5px;line-height:1.62;color:${L.ink2};">After six months of no sign-in and no subscription we delete the account and
                           everything in it: every board, every note, every outline. That is a promise
                           we make in the Privacy Policy, so this is us keeping it rather than a nudge
                           to come back.</p>
                        <p class="bf-ink2" style="margin:0;font-family:${SANS};font-size:15.5px;
                           line-height:1.62;color:${L.ink2};">If you want to keep the work, you have two ways to do it.</p>
                      </td>
                    </tr>
                    <tr>
                      <td class="bf-pad" style="padding:22px 44px 0 44px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                               class="bf-code" style="background:${L.surface};border:1px solid ${L.rule};
                                      border-radius:4px;">
                          <tr>
                            <td style="padding:20px 22px;">
                              <p class="bf-ink" style="margin:0 0 6px 0;font-family:${SANS};
                                 font-size:15px;line-height:1.55;font-weight:600;color:${L.ink};">Sign in once</p>
                              <p class="bf-ink2" style="margin:0 0 16px 0;font-family:${SANS};
                                 font-size:14px;line-height:1.6;color:${L.ink2};">That is all it takes. The clock starts again.</p>
                              <p class="bf-ink" style="margin:0 0 6px 0;font-family:${SANS};
                                 font-size:15px;line-height:1.55;font-weight:600;color:${L.ink};">Or take it with you</p>
                              <p class="bf-ink2" style="margin:0;font-family:${SANS};font-size:14px;
                                 line-height:1.6;color:${L.ink2};">Sign in and download everything from Settings, under Your data.</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td class="bf-pad" style="padding:24px 44px 40px 44px;">
                        <p class="bf-ink2" style="margin:0 0 18px 0;font-family:${SANS};
                           font-size:15.5px;line-height:1.62;color:${L.ink2};">If you would rather it all went, do nothing.</p>
                        <a href="${SITE}/login" style="display:inline-block;background:${L.blue};
                           color:#FFFFFF;font-family:${SANS};font-size:15px;font-weight:600;
                           text-decoration:none;padding:13px 26px;border-radius:4px;">Sign in to Beatfall</a>
                      </td>
                    </tr>`;

  // the same shell, with the code block swapped for the body above
  let html = shell({ preheader:'Five months without a sign-in. Here is how to keep your work.',
    heading:'x', lede:'x', eyebrow:'x', code:'x', after:'x', sig:'x' });
  const start = html.indexOf('<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">\n                    <tr>\n                      <td class="bf-pad" style="padding:40px 44px 0 44px;">');
  const open  = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">';
  const a = html.indexOf(open, start);
  const b = html.indexOf('</table>\n                </td>', a);
  html = html.slice(0, a + open.length) + body + '\n                  ' + html.slice(b);
  // this email is not about signing in, so the footer line changes
  html = html.replace('Sent because somebody asked to sign in to Beatfall with this address.\n                    If that was not you, nothing has happened and you can ignore it.',
    'Sent because this address has a Beatfall account that has been quiet for five months.');
  return html;
}
fs.writeFileSync('deletion-warning.html', warning());
console.log('built deletion-warning.html');
