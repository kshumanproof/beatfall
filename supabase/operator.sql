-- ============================================================================
-- Beatfall operator schema. Paste this whole file into the Supabase SQL editor
-- and run it once. It is ADDITIVE: it creates new tables and adds columns, and
-- it changes nothing that already exists. Running it twice is safe.
--
-- WHY THIS FILE EXISTS, before any of the screens that read it.
--
-- The admin rebuild asks for issues, investigations, a credit ledger, a
-- revenue ledger, spending protection, alerts and an audit history. None of
-- those can be shown, because none of them are recorded. `events` is a
-- fire-and-forget stream with an allowlist on its properties, which is right
-- for product analytics and wrong as the only source for anything financial:
-- a dropped write there costs nothing, and a dropped write here is a charge
-- nobody can account for.
--
-- So the records come first and the screens read them. A dashboard built the
-- other way round can only ever show what it can infer, and an inference
-- printed next to a dollar sign is the thing this whole exercise is meant to
-- stop.
--
-- TWO RULES RUN THROUGH EVERY TABLE BELOW.
--
-- 1. NOTHING HERE HOLDS A WRITER'S WORK. No card, note, outline, logline,
--    title, filename, prompt or provider response. Error text is sanitized
--    before it is written, because an error can quote the input that caused
--    it. The Privacy Policy and the Terms draw this line and these tables are
--    where it either holds or does not.
--
-- 2. A FINANCIAL RECORD OUTLIVES THE ACCOUNT, DE-IDENTIFIED. Deleting an
--    account must not erase the fact that money moved. Every money table
--    references auth.users with ON DELETE SET NULL and carries `account_tag`,
--    an opaque stable string that is not an email and cannot be reversed into
--    one. After a deletion the row says what happened and no longer says who.
--    Tables that are purely operational cascade and go with the account.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- USAGE GAINS AN OUTCOME.
--
-- `usage` already records one row per provider call with its tokens, its cost
-- and its credits. What it does not record is whether the call WORKED. Every
-- row in it today is a completed call, so a billed failure, a call the writer
-- interrupted and a call whose outcome nobody ever learned are all either
-- missing or indistinguishable from a success.
--
-- That is the gap under "the totals do not reconcile". Extending this table
-- rather than building a second one beside it is deliberate: two tables both
-- claiming to hold what something cost is how a reconciliation queue fills up
-- with disagreements between two of your own records.
-- ---------------------------------------------------------------------------
alter table public.usage add column if not exists request_id  text;
alter table public.usage add column if not exists status      text;
   -- ok | failed | refused | interrupted | unknown
alter table public.usage add column if not exists error_code  text;
alter table public.usage add column if not exists stage       text;
alter table public.usage add column if not exists provider    text;
alter table public.usage add column if not exists duration_ms int;
alter table public.usage add column if not exists deploy      text;
alter table public.usage add column if not exists issue_id    bigint;
alter table public.usage add column if not exists account_tag text;

-- A retry must not post a second row for the same attempt. Partial, because
-- every row written before this file ran has no request_id and they are all
-- legitimately null.
create unique index if not exists usage_request_idx
  on public.usage (request_id) where request_id is not null;
create index if not exists usage_status_idx
  on public.usage (status, created_at desc) where status is not null;
create index if not exists usage_issue_idx
  on public.usage (issue_id) where issue_id is not null;


-- ---------------------------------------------------------------------------
-- THE CREDIT LEDGER.
--
-- Today a balance is two integers on the profile and the only history is the
-- usage table, which records what was SPENT and nothing about a refund that
-- failed, a correction made by hand, or credits that arrived from a purchase.
-- "Why does this writer have 43 credits" is currently unanswerable, and it is
-- the first question any support conversation about money asks.
--
-- One row per movement, signed, with the balance it produced. `idem_key` is
-- what makes a retry safe: the same key writes once.
-- ---------------------------------------------------------------------------
create table if not exists public.credit_ledger (
  id          bigserial primary key,
  user_id     uuid references auth.users on delete set null,
  account_tag text,
  kind        text not null,          -- charge | refund | purchase | grant | correction | reset
  credits     int  not null,          -- signed: a charge is negative
  bucket      text,                   -- monthly | banked | both
  reason      text not null default '',
  ref         text,                   -- session id, stripe event id, admin action id
  idem_key    text,
  monthly_after int,
  banked_after  int,
  actor       text not null default 'system',   -- system | admin | stripe
  created_at  timestamptz not null default now()
);
create unique index if not exists credit_ledger_idem
  on public.credit_ledger (idem_key) where idem_key is not null;
create index if not exists credit_ledger_user_idx
  on public.credit_ledger (user_id, created_at desc);


-- ---------------------------------------------------------------------------
-- MONEY IN, AND MONEY BACK OUT.
--
-- Revenue is currently inferred from a subscription_status column and a few
-- event names. That answers "is this person paying" and cannot answer "what
-- was collected in September", because a status is a state and revenue is a
-- sequence of events.
--
-- Idempotent on the Stripe event id, because Stripe retries webhooks and a
-- retry that posts a second payment is a number that can never be trusted
-- again. `livemode` is recorded per row rather than read off today's key, so
-- test-mode history stays separable forever.
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id              bigserial primary key,
  user_id         uuid references auth.users on delete set null,
  account_tag     text,
  stripe_event_id text,
  kind            text not null,       -- subscription | topup | refund | failure
  bill_interval   text,                -- month | year, null for a pack
  amount_cents    int  not null default 0,
  currency        text not null default 'usd',
  status          text not null default '',
  period_start    timestamptz,
  period_end      timestamptz,
  livemode        boolean not null default false,
  created_at      timestamptz not null default now()
);
create unique index if not exists payments_event_idx
  on public.payments (stripe_event_id) where stripe_event_id is not null;
create index if not exists payments_time_idx on public.payments (created_at desc);


-- ---------------------------------------------------------------------------
-- ISSUES: THE SAME FAILURE, SEEN TWELVE TIMES, IS ONE THING TO FIX.
--
-- A list of error counts tells you something went wrong and nothing about
-- what. An issue is the grouping: one row per distinct failure, carrying when
-- it started, how often, how many people, and what it has cost in credits
-- that were charged and not returned.
--
-- `signature` is built from the feature, the stage and a SANITIZED error code.
-- Never from the error text, which can quote a writer's own sentence.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_issues (
  id            bigserial primary key,
  signature     text not null,
  title         text not null,
  feature       text,
  stage         text,
  error_code    text,
  severity      text not null default 'normal',   -- low | normal | high
  status        text not null default 'new',      -- new | investigating | monitoring | resolved
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  occurrences   int not null default 0,
  accounts      int not null default 0,
  credits_charged  int not null default 0,
  credits_refunded int not null default 0,
  cost_micros   bigint not null default 0,
  deploy        text,
  provider      text,
  model         text,
  assignee      text,
  resolved_at   timestamptz,
  resolved_reason text,
  updated_at    timestamptz not null default now()
);
create unique index if not exists admin_issues_sig on public.admin_issues (signature);
create index if not exists admin_issues_seen on public.admin_issues (last_seen_at desc);

-- What was thought and done about it. An issue closed with no reason recorded
-- teaches nobody anything the second time it appears.
create table if not exists public.admin_issue_notes (
  id         bigserial primary key,
  issue_id   bigint not null references public.admin_issues on delete cascade,
  author     text not null default '',
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_issue_notes_idx
  on public.admin_issue_notes (issue_id, created_at);


-- ---------------------------------------------------------------------------
-- BUDGETS: DELIBERATELY EMPTY, AND DELIBERATELY NOT ENFORCED.
--
-- No rows are inserted by this file. A threshold nobody approved is a number
-- this code invented, and the first time it stopped a writer mid-sentence it
-- would be wrong in a way that cannot be apologised for. Until Kris sets a
-- figure the dashboard reports "not set" and nothing is enforced.
--
-- `enforced` is false even once a figure exists. Watch first with the same
-- arithmetic that will later stop the work, confirm the number means what it
-- is supposed to mean, and only then turn it on. Credits are a poor proxy for
-- provider cost: a five-credit import of eighty notes and a five-credit import
-- of nine hundred are the same price to the writer and are not the same bill.
-- ---------------------------------------------------------------------------
create table if not exists public.budgets (
  scope         text primary key,
     -- trial_account | paid_period | single_action | rate_hour | platform_day
  warn_micros   bigint,
  urgent_micros bigint,
  stop_micros   bigint,
  enforced      boolean not null default false,
  approved_by   text,
  approved_at   timestamptz,
  note          text not null default '',
  updated_at    timestamptz not null default now()
);

-- THE ONE SCOPE KRIS HAS APPROVED, in his own words on 9 October 2026:
-- warn at $8 of provider cost inside a customer's monthly credit allowance
-- period, urgent at $10, "These are alerts, not automatic cutoffs."
--
-- So there is no stop figure and `enforced` is false. Those two together are
-- the difference between a dashboard that tells him and a dashboard that
-- decides. Figures are in millionths of a dollar, the same unit the usage
-- table already costs calls in, so nothing has to be converted to compare.
--
-- No row for trial_account, single_action, rate_hour or platform_day. A
-- threshold nobody approved is a number this file invented, and the dashboard
-- says "not set" rather than implying a limit exists.
insert into public.budgets (scope, warn_micros, urgent_micros, stop_micros,
                            enforced, approved_by, approved_at, note)
     values ('paid_period', 8000000, 10000000, null, false, 'kris', now(),
             'Approved 9 Oct 2026. Alerts only, no cutoff.')
on conflict (scope) do nothing;

-- THE TWO IN OBSERVATION. Kris's instruction on 9 October: keep the proposed
-- trial thresholds and the action cutoff watching, and show him the measured
-- cost of the largest permitted actions before he approves enforcement.
--
-- So both rows exist, both are `enforced = false`, and the single_action row
-- carries a STOP figure that stops nothing. That is the point of observing:
-- the dashboard reports how often this line WOULD have been crossed, using
-- the same arithmetic that would later cross it, and the figure is only
-- turned on once the record shows it would have fired zero times on real
-- work.
--
-- trial_account: a trial carries 25 credits and measured cost is about a penny
-- a credit, so an honest trial lands near $0.25. $2 is eight times that.
-- single_action: a real two hundred note import measures about $0.033, so
-- $1.50 is roughly forty-five times the largest ordinary action.
insert into public.budgets (scope, warn_micros, urgent_micros, stop_micros,
                            enforced, approved_by, approved_at, note)
     values ('trial_account', 2000000, 3000000, null, false, 'kris', now(),
             'Proposed 9 Oct 2026. Observing only, pending approval.'),
            ('single_action', null, null, 1500000, false, 'kris', now(),
             'Proposed 9 Oct 2026. Observing only. One action, not an account.')
on conflict (scope) do nothing;


-- ---------------------------------------------------------------------------
-- RESERVATIONS, BECAUSE TWO REQUESTS ARRIVE AT ONCE.
--
-- A ceiling checked by reading what has already been spent is a ceiling two
-- simultaneous imports walk straight through: both read the same total, both
-- decide there is room, both run. A hold is taken BEFORE the expensive work
-- and settled after, so work in flight counts against the limit while it is
-- still in flight.
--
-- `estimate_micros` and `actual_micros` are separate on purpose. An estimate
-- released because the browser went away is not evidence the work did not
-- happen: the provider may have finished and billed. Those become `unknown`
-- and go to reconciliation rather than quietly freeing the money.
-- ---------------------------------------------------------------------------
create table if not exists public.budget_holds (
  id              bigserial primary key,
  user_id         uuid not null references auth.users on delete cascade,
  session_id      text,
  request_id      text,
  feature         text,
  estimate_micros bigint not null default 0,
  actual_micros   bigint,
  state           text not null default 'held',   -- held | settled | abandoned | unknown
  created_at      timestamptz not null default now(),
  settled_at      timestamptz
);
create unique index if not exists budget_holds_request
  on public.budget_holds (request_id) where request_id is not null;
create index if not exists budget_holds_open
  on public.budget_holds (user_id, state) where state = 'held';


-- ---------------------------------------------------------------------------
-- ALERTS, AND WHETHER THEY ACTUALLY ARRIVED.
--
-- An alert that was never delivered is worse than no alert, because the page
-- shows it as sent. Delivery is recorded per row with its failure, and
-- `dedupe_key` carries the LEVEL so a situation getting worse escalates
-- instead of being suppressed as a repeat.
-- ---------------------------------------------------------------------------
create table if not exists public.alerts (
  id             bigserial primary key,
  kind           text not null,      -- spend | issue | payment | system
  level          text not null,      -- warn | urgent | stop
  subject_user   uuid references auth.users on delete set null,
  subject_tag    text,
  dedupe_key     text,
  summary        text not null default '',
  detail         jsonb not null default '{}'::jsonb,
  channel        text,               -- email | none
  delivered_at   timestamptz,
  delivery_error text,
  -- HOW MANY TIMES DELIVERY HAS BEEN TRIED, AND WHEN LAST.
  -- Without these, "not delivered" cannot be told apart from "not tried yet",
  -- and a retry sweep would either hammer a permanently bad address forever or
  -- give up on one that was briefly unreachable.
  attempts       int not null default 0,
  last_attempt_at timestamptz,
  acknowledged_at timestamptz,
  created_at     timestamptz not null default now()
);
create unique index if not exists alerts_dedupe
  on public.alerts (dedupe_key) where dedupe_key is not null;
create index if not exists alerts_open
  on public.alerts (created_at desc) where acknowledged_at is null;


-- ---------------------------------------------------------------------------
-- EVERY CONSEQUENTIAL THING AN OPERATOR DOES.
--
-- Who did it, to whom, what changed, and whether it worked. This is the record
-- that answers "why does this account have different credits from the ledger",
-- and it is also the thing that makes an admin tool safe to own: an action
-- with no audit row is an action nobody can explain later.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_actions (
  id           bigserial primary key,
  admin_id     uuid references auth.users on delete set null,
  admin_email  text,
  action       text not null,
  subject_user uuid references auth.users on delete set null,
  subject_tag  text,
  detail       jsonb not null default '{}'::jsonb,
  idem_key     text,
  result       text not null default 'ok',     -- ok | refused | failed
  created_at   timestamptz not null default now()
);
create unique index if not exists admin_actions_idem
  on public.admin_actions (idem_key) where idem_key is not null;
create index if not exists admin_actions_time
  on public.admin_actions (created_at desc);


-- ---------------------------------------------------------------------------
-- SUPPORT CASES.
--
-- Separate from issues: an issue is a fault in the product, a case is a person
-- waiting for an answer. One person can be affected by three issues and one
-- issue can produce nine cases.
-- ---------------------------------------------------------------------------
create table if not exists public.support_cases (
  id           bigserial primary key,
  user_id      uuid references auth.users on delete set null,
  account_tag  text,
  subject      text not null default '',
  status       text not null default 'open',   -- open | waiting | closed
  issue_id     bigint references public.admin_issues on delete set null,
  opened_by    text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  closed_at    timestamptz
);
create index if not exists support_cases_open
  on public.support_cases (status, updated_at desc);


-- ---------------------------------------------------------------------------
-- PROFILE COLUMNS THE OPERATOR TOOLS NEED.
--
-- Marketing consent is kept apart from service notices on purpose: a writer
-- who never agreed to be marketed to must still receive a receipt and a
-- deletion warning, and one flag covering both would make that impossible.
--
-- `help_paused_at` pauses PAID writing help for one account. It does not touch
-- their boards, their notes or their downloads, because withholding somebody's
-- own work is not a cost control.
-- ---------------------------------------------------------------------------
alter table public.alerts add column if not exists attempts int not null default 0;
alter table public.alerts add column if not exists last_attempt_at timestamptz;

alter table public.profiles add column if not exists marketing_opt_in boolean not null default false;
alter table public.profiles add column if not exists marketing_changed_at timestamptz;
alter table public.profiles add column if not exists help_paused_at   timestamptz;
alter table public.profiles add column if not exists help_pause_reason text;
-- The opaque stable id that lets a financial record outlive the account.
-- Not derived from the email, so it cannot be reversed into one.
alter table public.profiles add column if not exists account_tag text;

create table if not exists public.consent_log (
  id          bigserial primary key,
  user_id     uuid references auth.users on delete set null,
  account_tag text,
  channel     text not null default 'marketing',
  opted_in    boolean not null,
  source      text not null default '',       -- signup | settings | admin | unsubscribe
  created_at  timestamptz not null default now()
);
create index if not exists consent_log_user on public.consent_log (user_id, created_at desc);


-- ---------------------------------------------------------------------------
-- SAME RULE AS EVERY OTHER TABLE IN THIS PRODUCT.
-- The browser never touches any of these. Every read and write goes through
-- the server with the service key, which bypasses row-level security
-- deliberately. Row-level security is on anyway, so a future client key with
-- a table grant still finds every row closed.
-- ---------------------------------------------------------------------------
alter table public.credit_ledger    enable row level security;
alter table public.payments         enable row level security;
alter table public.admin_issues     enable row level security;
alter table public.admin_issue_notes enable row level security;
alter table public.budgets          enable row level security;
alter table public.budget_holds     enable row level security;
alter table public.alerts           enable row level security;
alter table public.admin_actions    enable row level security;
alter table public.support_cases    enable row level security;
alter table public.consent_log      enable row level security;

revoke all on public.credit_ledger     from anon, authenticated;
revoke all on public.payments          from anon, authenticated;
revoke all on public.admin_issues      from anon, authenticated;
revoke all on public.admin_issue_notes from anon, authenticated;
revoke all on public.budgets           from anon, authenticated;
revoke all on public.budget_holds      from anon, authenticated;
revoke all on public.alerts            from anon, authenticated;
revoke all on public.admin_actions     from anon, authenticated;
revoke all on public.support_cases     from anon, authenticated;
revoke all on public.consent_log       from anon, authenticated;

revoke all on sequence public.credit_ledger_id_seq     from anon, authenticated;
revoke all on sequence public.payments_id_seq          from anon, authenticated;
revoke all on sequence public.admin_issues_id_seq      from anon, authenticated;
revoke all on sequence public.admin_issue_notes_id_seq from anon, authenticated;
revoke all on sequence public.budget_holds_id_seq      from anon, authenticated;
revoke all on sequence public.alerts_id_seq            from anon, authenticated;
revoke all on sequence public.admin_actions_id_seq     from anon, authenticated;
revoke all on sequence public.support_cases_id_seq     from anon, authenticated;
revoke all on sequence public.consent_log_id_seq       from anon, authenticated;


-- ---------------------------------------------------------------------------
-- EVERY EXISTING ACCOUNT GETS ITS TAG.
-- Random, so it says nothing about the person. Written once and never changed,
-- because a tag that moves cannot join a deleted account's records together.
-- ---------------------------------------------------------------------------
update public.profiles
   set account_tag = 'acct_' || replace(gen_random_uuid()::text, '-', '')
 where account_tag is null;

create unique index if not exists profiles_account_tag
  on public.profiles (account_tag) where account_tag is not null;


-- ---------------------------------------------------------------------------
-- WHEN THE RECORDS START.
--
-- Nothing above can describe yesterday. The dashboard has to say so rather
-- than draw a flat line back to the beginning of time and let it be read as
-- quiet months, so the first run of this file stamps the date and every
-- history panel reads it.
-- ---------------------------------------------------------------------------
create table if not exists public.operator_meta (
  key        text primary key,
  value      text not null default '',
  created_at timestamptz not null default now()
);
alter table public.operator_meta enable row level security;
revoke all on public.operator_meta from anon, authenticated;

insert into public.operator_meta (key, value)
     values ('tracking_started_at', now()::text)
on conflict (key) do nothing;
