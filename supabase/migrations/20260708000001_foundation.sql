-- Migration 1/5: foundation
-- Shared helper functions + the identity containers: households and people.
-- See docs/ontology.md for the plain-English definition of every table.

-- Keeps updated_at accurate on every table (attached via trigger below and in later migrations).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- households: the root container. One row for this family; the seam where
-- multi-tenancy could be added later (ADR-006). Never build for it now.
-- ---------------------------------------------------------------------------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- people: household members. May be linked to a Supabase login (user_id),
-- but a person can exist without one (e.g. a child).
-- ---------------------------------------------------------------------------
create table public.people (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete restrict,
  user_id       uuid unique references auth.users (id) on delete set null,
  name          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index people_household_id_idx on public.people (household_id);

create trigger people_set_updated_at
  before update on public.people
  for each row execute function public.set_updated_at();
