# The offline UI suite

Two files. `mkstub.js` builds `stub.html` from the real `public/app.html`,
replacing only the three external script tags with a stubbed platform layer.
Everything between those tags is the shipped code: the point is to exercise
what actually ships, never a copy of it. A suite that keeps its own copy of the
logic measures the copy, which is how a fold rule once went four rounds without
the shipped number moving.

`drive.js` loads that file in headless Chromium and asserts against the real
interface.

    cd test
    cp ../public/app.html .
    node mkstub.js
    node drive.js

Needs `playwright` and a Chromium. Set `executablePath` in `drive.js` if yours
lives somewhere else.

## What it covers

The boot hold, a brand-new account's first screen, naming a first project,
which project an import lands in, editing a card, the closed-account screen and
its per-board PDF, the trial and paid credit marks, and coming back from Stripe.

## What it does not cover

Anything server-side. `api/` is not exercised here: the platform layer is a
stub, so Supabase, Stripe and the metered proxy are all absent. The import
parse, the casting call and the PDF's actual layout are also outside it. Those
still need a real account and a real file.

## One trap, already paid for

`String.prototype.replace` with a string replacement treats `$'` as "everything
after the match". The stub contains `'$' + n`, which silently pasted the whole
rest of the document back in and produced an 883KB file that would not parse.
`mkstub.js` uses a function replacer for that reason. Do not simplify it back.
