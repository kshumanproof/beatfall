# The server suite

Runs the real endpoint files against a stand-in database, so the credit paths,
the project gate, the Stripe webhook and the cleanup job can be exercised
without Supabase, Stripe or Anthropic.

    cd test/server
    npm init -y && npm pkg set type=module
    npm install @supabase/supabase-js@^2.45.0 stripe@^16.8.0
    node setup.js        # copies the endpoints and swaps two boundaries
    node money.js        # charge() and refund()
    node proxy.js        # api/claude.js end to end
    node gate.js         # api/projects.js and the export
    node hook.js         # api/stripe-webhook.js
    node clean.js        # api/cleanup.js on a dry run
    node captures.js     # api/captures.js, the phone's notes

## How it works, and the one rule

`fakedb.js` imitates the Supabase client: the chained builder, `{data, error}`
rather than throwing, and `maybeSingle()` returning a null row rather than an
error when nothing matched. That last one is what the compare-and-set credit
debit depends on.

Each suite copies the real endpoint and replaces exactly two things: the import
of `_lib/core.js` becomes a shim that overrides `requireUser` (it needs a live
Supabase and a token), and `admin()` becomes the fake handle. Everything else in
those files, including all of the branching being tested, is the shipped code.

**Never re-implement the logic here to observe it.** That is how a fold rule
once went four rounds without the shipped number moving.

## What it does not prove

It is not Postgres. Row-level security, the database defaults, foreign keys and
PostgREST's own query grammar are all outside it: a filter that this suite
accepts can still be rejected by the real server. That is why `cleanup.js` uses
only `.eq()` and `.order()`, and why the six-month job should be run once
against production with `?dry=1` after any change to its query.

It is also not Stripe or Anthropic. Both are stubbed at the boundary, so what is
tested is how these files behave given an answer, not whether the answer is the
one those services would really give.
