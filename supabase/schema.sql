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
  plan                text not null default 'trial',          -- trial | writer | working | volume | none
  stripe_customer_id  text,
  stripe_subscription_id text,
  subscription_status text,                                    -- trialing | active | past_due | canceled
  trial_ends_at       timestamptz default (now() + interval '14 days'),
  period_start        timestamptz not null default date_trunc('month', now()),
  credits_used        int  not null default 0,                 -- reset when period_start rolls over
  credits_extra       int  not null default 0,                 -- topped-up credits, carried over
  is_admin            boolean not null default false,
  created_at          timestamptz not null default now(),
  last_seen_at        timestamptz not null default now()
);

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
  kind          text not null,          -- place | conversation | import | ideas | logline | route
  credits       int  not null default 0,
  model         text,
  tokens_in     int  not null default 0,
  tokens_out    int  not null default 0,
  cost_micros   bigint not null default 0,   -- millionths of a dollar, so no float drift
  created_at    timestamptz not null default now()
);
create index if not exists usage_user_time_idx on public.usage (user_id, created_at desc);
create index if not exists usage_time_idx      on public.usage (created_at desc);

-- ------------------------------------------------------------------ events --
-- Light product analytics: what people actually do, so the ten-writer test
-- produces numbers and not just impressions.
create table if not exists public.events (
  id         bigserial primary key,
  user_id    uuid references auth.users on delete set null,
  name       text not null,             -- signed_up | first_run_choice | import_done | card_placed …
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

-- ------------------------------------------------------- admin: who you are
-- Run this once, with your own email, after you have signed in for the first
-- time. Without it, /admin will refuse you as well as everybody else.
--   update public.profiles set is_admin = true where email = 'you@example.com';
