-- Migration 3/5: operations
-- Maintenance (schedules + logs) and money (recurring commitments + actual
-- expenses, ADR-003), plus the dashboard view that normalizes recurring
-- costs to a monthly figure.

-- ---------------------------------------------------------------------------
-- maintenance_schedules: a recurring upkeep obligation on an asset (the plan).
-- next_due_on is advanced by the application when a log is recorded.
-- ---------------------------------------------------------------------------
create table public.maintenance_schedules (
  id                    uuid primary key default gen_random_uuid(),
  asset_id              uuid not null references public.assets (id) on delete cascade,
  name                  text not null,
  description           text,
  interval_value        integer not null check (interval_value > 0),
  interval_unit         text not null
                        check (interval_unit in ('day', 'week', 'month', 'year')),
  next_due_on           date,
  estimated_cost_cents  bigint check (estimated_cost_cents >= 0),
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index maintenance_schedules_asset_id_idx on public.maintenance_schedules (asset_id);
create index maintenance_schedules_next_due_on_idx on public.maintenance_schedules (next_due_on)
  where is_active;

create trigger maintenance_schedules_set_updated_at
  before update on public.maintenance_schedules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- recurring_expenses: an ongoing commitment (mortgage, power bill, insurance).
-- Optionally tied to a home or asset so later phases can answer
-- "what does this car really cost us?".
-- ---------------------------------------------------------------------------
create table public.recurring_expenses (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete restrict,
  home_id         uuid references public.homes (id) on delete set null,
  asset_id        uuid references public.assets (id) on delete set null,
  name            text not null,
  category        text not null
                  check (category in ('mortgage', 'utility', 'insurance', 'tax', 'subscription', 'service', 'other')),
  amount_cents    bigint not null check (amount_cents >= 0),
  interval_value  integer not null check (interval_value > 0),
  interval_unit   text not null
                  check (interval_unit in ('week', 'month', 'year')),
  starts_on       date not null,
  ends_on         date check (ends_on >= starts_on),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index recurring_expenses_household_id_idx on public.recurring_expenses (household_id);
create index recurring_expenses_home_id_idx on public.recurring_expenses (home_id);
create index recurring_expenses_asset_id_idx on public.recurring_expenses (asset_id);

create trigger recurring_expenses_set_updated_at
  before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- expenses: actual money spent — a real, dated transaction. May link back to
-- the recurring commitment it fulfills (optional, ADR-003).
-- ---------------------------------------------------------------------------
create table public.expenses (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete restrict,
  home_id               uuid references public.homes (id) on delete set null,
  asset_id              uuid references public.assets (id) on delete set null,
  recurring_expense_id  uuid references public.recurring_expenses (id) on delete set null,
  description           text not null,
  category              text not null
                        check (category in ('mortgage', 'utility', 'insurance', 'tax', 'subscription', 'service',
                                            'maintenance', 'repair', 'purchase', 'other')),
  amount_cents          bigint not null check (amount_cents >= 0),
  incurred_on           date not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index expenses_household_id_idx on public.expenses (household_id);
create index expenses_home_id_idx on public.expenses (home_id);
create index expenses_asset_id_idx on public.expenses (asset_id);
create index expenses_recurring_expense_id_idx on public.expenses (recurring_expense_id);
create index expenses_incurred_on_idx on public.expenses (incurred_on);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- maintenance_logs: work that actually happened — the asset's service history.
-- schedule_id empty = ad-hoc repair. If it cost money, the app records an
-- expense and links it via expense_id (money lives only in expenses; the
-- cost_cents here is a display convenience, never summed).
-- Created after expenses because it references them.
-- ---------------------------------------------------------------------------
create table public.maintenance_logs (
  id            uuid primary key default gen_random_uuid(),
  asset_id      uuid not null references public.assets (id) on delete cascade,
  schedule_id   uuid references public.maintenance_schedules (id) on delete set null,
  completed_on  date not null,
  cost_cents    bigint check (cost_cents >= 0),
  performed_by  text,
  expense_id    uuid unique references public.expenses (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index maintenance_logs_asset_id_idx on public.maintenance_logs (asset_id);
create index maintenance_logs_schedule_id_idx on public.maintenance_logs (schedule_id);
create index maintenance_logs_completed_on_idx on public.maintenance_logs (completed_on);

create trigger maintenance_logs_set_updated_at
  before update on public.maintenance_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- v_monthly_recurring_costs: each active recurring expense normalized to a
-- monthly amount. The dashboard's "your life costs $X/month" is
--   select sum(monthly_cents) from v_monthly_recurring_costs;
-- security_invoker makes the view respect the querying user's RLS.
-- ---------------------------------------------------------------------------
create view public.v_monthly_recurring_costs
with (security_invoker = true) as
select
  re.id,
  re.household_id,
  re.home_id,
  re.asset_id,
  re.name,
  re.category,
  re.amount_cents,
  re.interval_value,
  re.interval_unit,
  round(
    case re.interval_unit
      when 'week'  then re.amount_cents * 52.0 / 12.0 / re.interval_value
      when 'month' then re.amount_cents * 1.0 / re.interval_value
      when 'year'  then re.amount_cents / 12.0 / re.interval_value
    end
  )::bigint as monthly_cents
from public.recurring_expenses re
where re.starts_on <= current_date
  and (re.ends_on is null or re.ends_on >= current_date);
