-- Run once BEFORE deploying the accounting update. Safe to run again.
-- Adds accounting fields only. No user data, credits, or costs are rewritten.
begin;
alter table public.usage add column if not exists cost_details jsonb;
create table if not exists public.provider_daily_costs (
  project_id text not null,
  day date not null,
  amount_usd numeric(24,12) not null,
  fetched_at timestamptz not null,
  primary key (project_id, day)
);
alter table public.provider_daily_costs enable row level security;
revoke all on public.provider_daily_costs from anon, authenticated;
grant all on public.provider_daily_costs to service_role;
comment on table public.provider_daily_costs is
  'Latest OpenAI project-wide daily reported costs. Not allocated to customers.';
commit;
