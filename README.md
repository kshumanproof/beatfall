# Beatfall

Notes fall into structure.

You write notes. Beatfall works out which of them are story beats, puts them
where they belong in the structure you're writing to, and shows you the holes
between them. It asks before it guesses, and it never writes your script.

**Start here: [SETUP.md](SETUP.md)** — everything needed to get it live, in order.

## Running it

Static pages in `public/`, serverless functions in `api/`, Postgres and auth on
Supabase, hosted on Vercel. No build step and no framework: open the files and
they are what runs.

```
vercel dev        # local, once the environment variables are set
```

## Layout

```
public/     the board, sign-in, settings, admin, terms, privacy
api/        the metered Claude proxy, projects, account, billing, webhook
supabase/   schema.sql — idempotent; re-run in the SQL editor whenever it changes
```
