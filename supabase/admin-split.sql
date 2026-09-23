-- ============================================================================
-- ADMIN AND UNLIMITED, PULLED APART. Run this once in Supabase, then never
-- again. Safe to re-run: every statement checks first.
--
-- This is the same text that was added to the end of schema.sql. It lives in
-- its own file so there is one thing to copy rather than a 400 line file to
-- scroll through looking for the new part.
--
-- WHERE TO PASTE IT: Supabase dashboard, SQL Editor in the left sidebar, then
-- Run. It should say "Success. No rows returned", which is what success looks
-- like for statements that change things rather than find them.
--
-- WHAT IT DOES. Until now one switch, is_admin, did two unrelated jobs: it
-- opened the admin portal AND it granted the Owner plan, which is boards that
-- never close and credits that never run out. That made it impossible to have
-- an address that reads the platform's numbers without also being the account
-- somebody writes scripts on. Now there are two switches.
--
--   is_admin      opens /admin. Nothing else. No boards.
--   is_unlimited  the Owner plan. No admin portal.
--
-- DO THE STEPS IN ORDER. Step 3 updates a row that does not exist until you
-- have signed up, so signing up has to come first.
-- ============================================================================

-- ---------------------------------------------------------------- 1. the column
alter table public.profiles
  add column if not exists is_unlimited boolean not null default false;

-- Every account that was an admin before today was also, necessarily, an
-- owner: there was only the one switch. Without this line, running the rest of
-- this file would close the boards of the only person using Beatfall.
update public.profiles set is_unlimited = true where is_admin = true;

-- ============================================================================
-- 2. NOW GO AND SIGN UP  kris@beatfall.app
--
-- Ordinary sign-up at the ordinary address, the same as any writer. It will
-- start a fourteen day trial and that is fine; step 3 takes it away again,
-- because an admin address is not meant to be writing anything.
--
-- Come back here when the account exists.
-- ============================================================================

-- --------------------------------------------- 3. put each switch where it goes
-- The writing account: every board, every note, every picture, and no ceiling.
-- It loses the admin portal, which is the point.
update public.profiles
   set is_unlimited = true,
       is_admin     = false
 where lower(email) = 'kris@krisshuman.com';

-- The admin account: the portal, and nothing else. No unlimited plan, no
-- trial, no boards. Opening the board app on this address sends it to /admin.
update public.profiles
   set is_admin      = true,
       is_unlimited  = false,
       plan          = 'none',
       trial_ends_at = null
 where lower(email) = 'kris@beatfall.app';

-- --------------------------------------------------------------- 4. check it
-- Two rows, and each one should have exactly one 'true' on it. If the
-- beatfall.app row is missing, step 2 has not been done yet.
select email, is_admin, is_unlimited, plan, trial_ends_at
  from public.profiles
 where lower(email) in ('kris@krisshuman.com', 'kris@beatfall.app');

-- ============================================================================
-- ADDING AN ADMIN LATER
--
-- By hand, here, one address at a time:
--
--   update public.profiles set is_admin = true where lower(email) = '...';
--
-- Deliberately NOT a rule about the beatfall.app domain. support@beatfall.app
-- is coming and noreply@beatfall.app already exists, and neither of those
-- should be able to read every writer's numbers because of what comes after
-- the @ sign.
-- ============================================================================
