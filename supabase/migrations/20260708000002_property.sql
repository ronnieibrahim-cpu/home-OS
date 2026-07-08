-- Migration 2/5: property
-- homes, rooms, assets. Assets are the workhorse: appliances, vehicles,
-- house systems (gutters, roof — ADR-002), furniture, electronics.

-- ---------------------------------------------------------------------------
-- homes: a physical property. Descriptive fields are nullable; they become
-- inputs to Phase 3 cost heuristics.
-- ---------------------------------------------------------------------------
create table public.homes (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete restrict,
  name                  text not null,
  address_line1         text,
  address_line2         text,
  city                  text,
  state                 text,
  postal_code           text,
  country               text,
  purchase_date         date,
  purchase_price_cents  bigint check (purchase_price_cents >= 0),
  year_built            integer check (year_built between 1600 and 2200),
  square_feet           integer check (square_feet > 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index homes_household_id_idx on public.homes (household_id);

create trigger homes_set_updated_at
  before update on public.homes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- rooms: named areas inside a home. Deleting a home deletes its rooms.
-- ---------------------------------------------------------------------------
create table public.rooms (
  id           uuid primary key default gen_random_uuid(),
  home_id      uuid not null references public.homes (id) on delete cascade,
  name         text not null,
  floor        text,
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index rooms_home_id_idx on public.rooms (home_id);

create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- assets: anything the family owns worth tracking (ADR-001). One table for
-- all kinds; type-specific facts (VIN, mileage, tonnage) live in details.
-- room_id is optional — vehicles and exterior systems have no room — and
-- deleting a room detaches assets rather than deleting them.
-- Disposed assets keep their history via status instead of deletion.
-- ---------------------------------------------------------------------------
create table public.assets (
  id                    uuid primary key default gen_random_uuid(),
  home_id               uuid not null references public.homes (id) on delete cascade,
  room_id               uuid references public.rooms (id) on delete set null,
  name                  text not null,
  category              text not null
                        check (category in ('appliance', 'vehicle', 'system', 'furniture', 'electronics', 'other')),
  manufacturer          text,
  model_number          text,
  serial_number         text,
  purchase_date         date,
  purchase_price_cents  bigint check (purchase_price_cents >= 0),
  details               jsonb,
  status                text not null default 'active'
                        check (status in ('active', 'disposed')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index assets_home_id_idx on public.assets (home_id);
create index assets_room_id_idx on public.assets (room_id);
create index assets_category_idx on public.assets (category);

create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();
