# The emails

Three messages, all built from `build.js`. Edit the copy or the palette there
and run `node build.js` in this folder; never hand-edit the HTML, or the three
will drift apart.

    cd email ; node build.js

## Where each one goes

| File | Goes | How |
|---|---|---|
| `signup.html` | Supabase, Authentication, Emails, **Confirm signup** | paste the whole file |
| `signin.html` | Supabase, Authentication, Emails, **Magic Link** | paste the whole file |
| `deletion-warning.html` | nowhere by hand | built into `api/_email/deletion-warning.js`, sent by `api/cleanup.js` |

Both Supabase templates need `{{ .Token }}` in them, which is the six digit
code. They are already there.

**Leave the subject lines alone.** Kris decided that on 15 September. Putting
the code itself in the subject was proposed and rejected; do not raise it again.

**Both templates matter.** A brand new address gets Confirm signup and a
returning one gets Magic Link, and Beatfall signs people in with a code on both
paths, on the web and on the phone. Leave the token out of either and that half
of the writers get an email with nothing usable in it.

## After a change to deletion-warning.html

    cd email ; node build.js
    cd ../test/server ; rm -rf api ; node setup.js ; node clean.js

`clean.js` checks the shipped markup: that it says what will happen and when,
offers both ways to keep the work, names where a reply goes, carries alt text,
sets its colours inline, uses the palette from `theme.css`, and has no em dash
or unsubstituted placeholder left in it.

## Why it looks the way it does

The palette is `public/theme.css`, lifted, never invented. The band structure is
the homepage's: a surface masthead over a rule, paper in the middle, a surface
footer under a rule. The uppercase label above the digits is gold at 11px and
.16em because that is exactly what `.eyebrow` is on `index.html`.

Gold appears once, on that label, and nowhere else. On the board gold means a
gap or a credit being spent, so a gold button in an email would be saying
something that is not true.

The digits are Courier, which is already the board's mono face, and a fixed
pitch is what stops 0 and O being a guess.

## Things that are easy to get wrong here

- **Images are off by default** on a first message from an address nobody has
  written to, which is exactly the sign-in email. The mark is the only thing
  riding on the picture, and the alt text carries the name. Never put a code, a
  button or a sentence in an image.
- **Outlook ignores stylesheets.** Every colour is set inline as well as in the
  `<style>` block. Setting one without the other is how half the readers get
  black on black.
- **Gmail runs its own dark inversion** and ignores the media query. The inline
  colours are what keep it legible there.
- **Web fonts do not load** in most clients. Newsreader, Instrument Sans and
  Courier Prime are named first and Georgia, the system sans and Courier New do
  the actual work.

## The plain-text part

`api/cleanup.js` sends `html` and `text` together, and the text is not a
formality: it is what a screen reader, a text-only client and every spam filter
actually read, and an HTML-only message scores worse for it. If the HTML copy
changes, change the text to match.
