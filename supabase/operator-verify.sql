-- Read-only reconciliation. Run after refreshing the dashboard at 30 days.
-- SQL results retain full precision; the dashboard rounds dollars to cents.
-- No credentials or story text are selected.
select p.email,
       (p.is_internal or p.is_admin or p.is_unlimited) as internal,
       count(u.id) as calls,
       coalesce(sum(u.cost_micros), 0) / 1000000.0 as recorded_cost_usd,
       p.credits_used as credits_this_period, p.credits_extra as bought_credits,
       p.period_start
from public.profiles p
left join public.usage u on u.user_id = p.id
  and u.created_at >= now() - interval '30 days'
group by p.id, p.email, p.is_internal, p.is_admin, p.is_unlimited,
         p.credits_used, p.credits_extra, p.period_start
order by recorded_cost_usd desc;

-- Recalculate all saved board costs from the recorded provider/token counts.
-- These are the configured list rates, not a reconciliation to provider invoices.
select provider, model, count(*) as calls,
       sum(tokens_in) as input_tokens, sum(tokens_out) as output_tokens,
       sum(cost_micros) / 1000000.0 as stored_cost_usd,
       sum(case when model = 'gpt-6.1-sol' then round(tokens_in * 2 + tokens_out * 10)
                when model = 'claude-haiku-4-5' then round(tokens_in + tokens_out * 5)
           end) / 1000000.0 as recalculated_cost_usd
from public.usage where created_at >= now() - interval '30 days'
group by provider, model order by provider, model;
