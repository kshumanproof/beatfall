-- ============================================================================
-- Beatfall — database schema
-- Paste this whole file into the Supabase SQL editor and run it once.
-- ============================================================================

-- ---------------------------------------------------------------- profiles --
-- One row per person, created automatically the first time they sign in.
create table if not exists public.profiles (
  id                  uuid primary key references auth.users on delete cascade,
  email               text,
  display_name        text,
  plan                text not null default 'trial',          -- trial | beatfall | owner | none
  stripe_customer_id  text,
  stripe_subscription_id text,
  subscription_status text,                                    -- trialing | active | past_due | canceled
  trial_ends_at       timestamptz default (now() + interval '14 days'),
  period_start        timestamptz not null default date_trunc('month', now()),
  credits_used        int  not null default 0,                 -- reset when period_start rolls over
  credits_extra       int  not null default 0,                 -- topped-up credits, carried over
  is_admin            boolean not null default false,
  current_period_end     timestamptz,                          -- when Stripe next bills, or when access ends
  cancel_at_period_end   boolean not null default false,
  created_at          timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  -- One web-editing device at a time. The phone capture app does not use this
  -- field because it appends notes and never writes a project board.
  active_web_device_id text,
  active_web_device_claimed_at timestamptz
);

-- Existing databases get the same two fields when this file is re-run.
alter table public.profiles add column if not exists active_web_device_id text;
alter table public.profiles add column if not exists active_web_device_claimed_at timestamptz;

-- Send an ownership change to the previously active browser immediately.
-- Row-level security below limits each signed-in client to its own profile.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

-- ---------------------------------------------------------------- projects --
-- One row per script. The board is stored as JSON because the client already
-- holds it that way — this keeps one save path instead of a table per entity.
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null default 'Untitled',
  structure   text not null default 'stc',
  brief       jsonb not null default '{}'::jsonb,
  cards       jsonb not null default '[]'::jsonb,
  outline     jsonb not null default '{}'::jsonb,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects (user_id, sort_order);

-- ------------------------------------------------------------------- usage --
-- One row per AI call. This is the table that tells Kris what a user costs
-- and where the tier caps should actually sit.
create table if not exists public.usage (
  id            bigserial primary key,
  user_id       uuid not null references auth.users on delete cascade,
  kind          text not null,          -- conversation | import | ideas | logline | place
  credits       int  not null default 0,
  session_id    text,                   -- multi-turn features bill once per session

  model         text,
  tokens_in     int  not null default 0,
  tokens_out    int  not null default 0,
  cost_micros   bigint not null default 0,   -- millionths of a dollar, so no float drift
  created_at    timestamptz not null default now()
);
alter table public.profiles add column if not exists current_period_end timestamptz;
alter table public.profiles add column if not exists cancel_at_period_end boolean not null default false;
alter table public.usage add column if not exists session_id text;
create index if not exists usage_user_time_idx on public.usage (user_id, created_at desc);
create index if not exists usage_session_idx    on public.usage (user_id, session_id);
create index if not exists usage_time_idx      on public.usage (created_at desc);

-- ------------------------------------------------------------------ events --
-- Light product analytics: what people actually do, so the ten-writer test
-- produces numbers and not just impressions.
create table if not exists public.events (
  id         bigserial primary key,
  user_id    uuid references auth.users on delete set null,
  name       text not null,             -- signed_up | first_run_choice | topup | subscription_*
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_time_idx on public.events (created_at desc);

-- --------------------------------------------------------- row-level security
-- Everything is closed by default; a person can only ever touch their own rows.
-- The server-side functions use the service key and bypass these deliberately.
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.usage    enable row level security;
alter table public.events   enable row level security;

drop policy if exists "own profile"      on public.profiles;
drop policy if exists "own profile edit" on public.profiles;
create policy "own profile"      on public.profiles for select using (auth.uid() = id);
create policy "own profile edit" on public.profiles for update using (auth.uid() = id);

drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own usage" on public.usage;
create policy "own usage" on public.usage for select using (auth.uid() = user_id);

drop policy if exists "own events" on public.events;
create policy "own events" on public.events for insert with check (auth.uid() = user_id);

-- ------------------------------------------ create a profile on first sign-in
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  insert into public.events (user_id, name) values (new.id, 'signed_up');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ------------------------------------------- how many cards, without reading
-- The admin dashboard needs to know how much work a person has done. It has no
-- business knowing what that work SAYS. This column is maintained by the
-- database so the operator can count cards without ever selecting their text —
-- which is what makes the "we don't read your material" clause in the Terms a
-- fact about the system rather than a promise about behaviour.
alter table public.projects add column if not exists card_count int not null default 0;

create or replace function public.set_card_count()
returns trigger language plpgsql as $$
begin
  new.card_count = coalesce(jsonb_array_length(new.cards), 0);
  return new;
end; $$;

drop trigger if exists projects_card_count on public.projects;
create trigger projects_card_count before insert or update on public.projects
  for each row execute function public.set_card_count();

-- backfill for rows that existed before this column did
update public.projects
   set card_count = coalesce(jsonb_array_length(cards), 0)
 where card_count = 0 and jsonb_array_length(cards) > 0;

-- ------------------------------------------------------- admin: who you are
-- Run this once, with your own email, after you have signed in for the first
-- time. Without it, /admin will refuse you as well as everybody else.
--   update public.profiles set is_admin = true where email = 'you@example.com';

-- ============================================================================
-- Growth and product-learning foundation (3 Sep 2026)
--
-- Everything below is additive and safe to re-run. It exists because the one
-- thing you cannot do later is reconstruct how the first writers behaved. The
-- rule that governs all of it: these tables hold counts, states and timestamps.
-- No card text, no note text, no loglines, no titles, no filenames. If a
-- column here could ever hold a sentence a writer wrote, it is the wrong
-- column.
-- ============================================================================

-- ------------------------------------------------------- account-level state
-- Kris's own accounts and any QA account still show in People, but they must
-- not move the top-line numbers. Ten writers is a small enough sample that two
-- owner accounts would swamp it.
alter table public.profiles add column if not exists is_internal boolean not null default false;

-- Onboarding as explicit state rather than something inferred from whether the
-- dashboard happens to have a card on it.
alter table public.profiles add column if not exists onboarding_first_seen_at timestamptz;
alter table public.profiles add column if not exists onboarding_choice        text;  -- import | new_project | sample
alter table public.profiles add column if not exists onboarding_completed_at  timestamptz;

-- Activation markers. Set once, never rewound, so a cohort query is a column
-- read rather than a reconstruction.
alter table public.profiles add column if not exists first_real_project_at     timestamptz;
alter table public.profiles add column if not exists first_meaningful_board_at timestamptz;

-- Where this account came from. First touch is written once and never
-- overwritten; last touch may move. Both are small objects of source, medium,
-- campaign, referrer host and landing path. No email, no story data.
alter table public.profiles add column if not exists first_touch jsonb;
alter table public.profiles add column if not exists last_touch  jsonb;

-- Why somebody left. The code is a fixed enum; the optional note is the
-- writer's own words about the product, kept out of the events table because
-- it is support correspondence rather than analytics.
alter table public.profiles add column if not exists cancel_reason      text;
alter table public.profiles add column if not exists cancel_reason_note text;
alter table public.profiles add column if not exists cancel_reason_at   timestamptz;

-- ------------------------------------------------------------ project state
-- The sample has to be fully usable and completely invisible to any number
-- that is meant to describe real writing.
alter table public.projects add column if not exists is_sample   boolean not null default false;
alter table public.projects add column if not exists created_from text;   -- import | new_project | sample | other

-- ------------------------------------------------------------------- events
-- event_id makes a retry idempotent: the client generates it, so a dropped
-- response that the browser retries does not become two rows. anon_id ties a
-- visit to the account it later becomes; session_id groups one sitting.
alter table public.events add column if not exists event_id   text;
alter table public.events add column if not exists anon_id    text;
alter table public.events add column if not exists session_id text;
create unique index if not exists events_event_id_key on public.events (event_id)
  where event_id is not null;
create index if not exists events_name_time_idx on public.events (name, created_at desc);
create index if not exists events_user_idx      on public.events (user_id, created_at desc);
create index if not exists events_anon_idx      on public.events (anon_id, created_at desc)
  where anon_id is not null;

-- Events are written by the server with the service key and read only by
-- /api/admin, which checks is_admin first. No client ever selects from here.
alter table public.events enable row level security;

-- ---------------------------------------------------------------- the cast --
-- Characters are their own column rather than a corner of `brief`, because
-- `brief` is rebuilt wholesale from the project-details form every time it is
-- saved: anything else living in there would be silently wiped the first time
-- a writer edited their logline.
alter table public.projects add column if not exists characters jsonb not null default '[]'::jsonb;
