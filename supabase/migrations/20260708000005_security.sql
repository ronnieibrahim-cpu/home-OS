-- Migration 5/5: security (ADR-006)
-- RLS ON for every table so nothing is ever accidentally public.
-- Phase 1 policy: any authenticated user has full access — the only two
-- accounts are the family and they share everything. household_id columns
-- are the seam for membership-scoped policies if multi-tenancy ever happens.

do $$
declare
  t text;
begin
  foreach t in array array[
    'households', 'people', 'homes', 'rooms', 'assets',
    'maintenance_schedules', 'maintenance_logs',
    'recurring_expenses', 'expenses', 'notes', 'attachments'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "authenticated full access" on public.%I
         for all to authenticated using (true) with check (true)', t);
  end loop;
end;
$$;
