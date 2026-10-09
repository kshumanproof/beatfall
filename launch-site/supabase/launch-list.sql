-- Beatfall launch list. Additive only; no changes to app tables or auth.
-- Run the whole file in Supabase SQL editor. Safe to run again.
begin;

create table if not exists public.launch_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and length(email) between 3 and 254),
  created_at timestamptz not null default now(),
  consent_at timestamptz not null default now(),
  consent_version text not null,
  source text not null default 'unattributed' check (length(source) <= 80),
  medium text not null default '' check (length(medium) <= 80),
  campaign text not null default '' check (length(campaign) <= 80),
  unsubscribed_at timestamptz
);
comment on table public.launch_leads is 'Launch email permission only. Not an app account. No writer content.';

create table if not exists public.launch_signup_limits (
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  bucket timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key (ip_hash, bucket)
);
create index if not exists launch_signup_limits_bucket on public.launch_signup_limits (bucket);

alter table public.launch_leads enable row level security;
alter table public.launch_signup_limits enable row level security;
revoke all on public.launch_leads, public.launch_signup_limits from public, anon, authenticated;
grant all on public.launch_leads, public.launch_signup_limits to service_role;

create or replace function public.register_launch_lead(
  p_email text, p_consent_version text, p_source text,
  p_medium text, p_campaign text, p_ip_hash text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_bucket timestamptz;
  v_attempts integer;
  v_total integer;
begin
  if p_email is null or length(p_email) > 254 or p_email <> lower(btrim(p_email))
     or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_consent_version is distinct from 'launch-2026-10-09'
     or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$'
     or p_source is null or length(p_source) > 80
     or p_medium is null or length(p_medium) > 80
     or p_campaign is null or length(p_campaign) > 80 then
    raise exception 'Invalid launch signup';
  end if;
  -- Serialize requests from the same daily hash, across all server instances.
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  v_bucket := to_timestamp(floor(extract(epoch from v_now) / 600) * 600);
  delete from public.launch_signup_limits where bucket < v_now - interval '48 hours';
  insert into public.launch_signup_limits (ip_hash, bucket, attempts)
    values (p_ip_hash, v_bucket, 1)
    on conflict (ip_hash, bucket) do update
      set attempts = launch_signup_limits.attempts + 1
    returning attempts into v_attempts;
  select sum(attempts) into v_total from public.launch_signup_limits
    where ip_hash = p_ip_hash;
  if v_attempts > 10 or v_total > 100 then
    return jsonb_build_object('status', 'limited');
  end if;
  insert into public.launch_leads (email, consent_version, source, medium, campaign)
    values (p_email, p_consent_version, p_source, p_medium, p_campaign)
    on conflict (email) do update
      set unsubscribed_at = null, consent_at = v_now,
          consent_version = excluded.consent_version
      where launch_leads.unsubscribed_at is not null;
  -- Preserve original attribution. Renew permission only for an explicit rejoin.
  return jsonb_build_object('status', 'saved');
end;
$$;

revoke all on function public.register_launch_lead(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.register_launch_lead(text,text,text,text,text,text) to service_role;
commit;
