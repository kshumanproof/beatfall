-- Complete the operator additions missing from the live database.
-- Safe to rerun. Existing spending figures and records are preserved.
-- No account balances, payments, projects, or enforcement settings are changed.
begin;

alter table public.alerts add column if not exists attempts int not null default 0;
alter table public.alerts add column if not exists last_attempt_at timestamptz;

insert into public.budgets
  (scope, warn_micros, urgent_micros, stop_micros, enforced, approved_by, approved_at, note)
values
  ('paid_period', 8000000, 10000000, null, false, 'kris', now(),
   'Approved 9 Oct 2026. Alerts only, no cutoff.'),
  ('trial_account', 2000000, 3000000, null, false, 'kris', now(),
   'Proposed 9 Oct 2026. Observing only, pending approval.'),
  ('single_action', null, null, 1500000, false, 'kris', now(),
   'Proposed 9 Oct 2026. Observing only. One action, not an account.')
on conflict (scope) do nothing;

commit;

-- Verify the resulting settings. All three rows should have enforced = false.
select scope, warn_micros / 1000000.0 as warn_usd,
       urgent_micros / 1000000.0 as urgent_usd,
       stop_micros / 1000000.0 as observed_stop_usd, enforced
from public.budgets order by scope;
