-- ============================================================================
-- VISION: run this once in Supabase, then never again.
--
-- This is the same text that was added to the end of schema.sql. It lives in
-- its own file so there is one thing to copy rather than a 400 line file to
-- scroll through looking for the new part.
--
-- Safe to re-run. Every statement checks first.
--
-- WHERE TO PASTE IT: Supabase dashboard, SQL Editor in the left sidebar, then
-- Run. It should say "Success. No rows returned", which is what success looks
-- like for a statement that creates things rather than finding them.
-- ============================================================================

-- The ledger. A photograph itself is a note and lives in projects.cards like
-- any other; this table exists so that DELETION CAN FIND THE FILES. Rows
-- cascade off a user row and files in a storage bucket do not, so without this
-- an abandoned account would leave photographs of real people sitting in a
-- bucket forever, which is the Privacy Policy quietly becoming untrue.
create table if not exists public.images (
  path        text primary key,
  user_id     uuid not null references auth.users on delete cascade,
  project_id  uuid references public.projects on delete cascade,
  bytes       int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists images_user_idx on public.images (user_id, created_at);

-- A photo caught on the phone before it has been filed anywhere.
alter table public.captures add column if not exists image_path text;

-- Same rule as every other table here: every write goes through the server
-- with the service key and the browser gets nothing directly.
alter table public.images enable row level security;
revoke all on public.images from anon, authenticated;

-- ============================================================================
-- THE BUCKET
--
-- The SQL above makes the table. The bucket that holds the actual pictures is
-- made in the dashboard, because Supabase treats storage as its own thing.
--
--   1. Storage, in the left sidebar
--   2. New bucket
--   3. Name it exactly:  vision
--   4. Leave "Public bucket" OFF. This is the important one. A public bucket
--      is a permanent, guessable web address for every photograph anybody
--      uploads. Private means the only way to see one is a link the server
--      signs, which stops working within the hour.
--   5. Create
--
-- No storage policies are needed. Policies govern what a signed-in BROWSER may
-- do, and no browser ever touches this bucket: the server reaches it with the
-- service key, which policies do not apply to. Leaving it with no policies at
-- all is the correct, locked state.
-- ============================================================================
