-- Migration 4/5: knowledge layer
-- Polymorphic notes and attachments (ADR-004): one table each, pointing at
-- any entity via entity_type + entity_id. Integrity is enforced in-database:
--   1. a CHECK constraint limits entity_type to real entity tables
--   2. a delete trigger on every entity table removes its notes/attachments
-- Also creates the private 'attachments' storage bucket and its policies.

-- ---------------------------------------------------------------------------
-- notes: free-text memory on any entity.
-- ---------------------------------------------------------------------------
create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null
               check (entity_type in ('households', 'people', 'homes', 'rooms', 'assets',
                                      'maintenance_schedules', 'maintenance_logs',
                                      'recurring_expenses', 'expenses')),
  entity_id    uuid not null,
  body         text not null,
  created_by   uuid references public.people (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index notes_entity_idx on public.notes (entity_type, entity_id);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- attachments: the searchable index of files (receipts, manuals, photos…).
-- The file itself lives in Supabase Storage; this row records what it is and
-- what it's attached to. Deleting a row does NOT delete the storage object —
-- the application must do that (known gap, ADR-004).
-- ---------------------------------------------------------------------------
create table public.attachments (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null
                check (entity_type in ('households', 'people', 'homes', 'rooms', 'assets',
                                       'maintenance_schedules', 'maintenance_logs',
                                       'recurring_expenses', 'expenses')),
  entity_id     uuid not null,
  bucket        text not null default 'attachments',
  storage_path  text not null,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint check (size_bytes >= 0),
  title         text,
  kind          text not null default 'other'
                check (kind in ('receipt', 'manual', 'photo', 'warranty', 'contract', 'other')),
  uploaded_by   uuid references public.people (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (bucket, storage_path)
);

create index attachments_entity_idx on public.attachments (entity_type, entity_id);
create index attachments_kind_idx on public.attachments (kind);

create trigger attachments_set_updated_at
  before update on public.attachments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orphan prevention: when any entity row is deleted, delete its notes and
-- attachment rows. tg_table_name matches the entity_type values above, so one
-- generic function serves every entity table.
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_entity_children()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notes where entity_type = tg_table_name and entity_id = old.id;
  delete from public.attachments where entity_type = tg_table_name and entity_id = old.id;
  return old;
end;
$$;

create trigger households_cleanup_children
  after delete on public.households
  for each row execute function public.cleanup_entity_children();
create trigger people_cleanup_children
  after delete on public.people
  for each row execute function public.cleanup_entity_children();
create trigger homes_cleanup_children
  after delete on public.homes
  for each row execute function public.cleanup_entity_children();
create trigger rooms_cleanup_children
  after delete on public.rooms
  for each row execute function public.cleanup_entity_children();
create trigger assets_cleanup_children
  after delete on public.assets
  for each row execute function public.cleanup_entity_children();
create trigger maintenance_schedules_cleanup_children
  after delete on public.maintenance_schedules
  for each row execute function public.cleanup_entity_children();
create trigger maintenance_logs_cleanup_children
  after delete on public.maintenance_logs
  for each row execute function public.cleanup_entity_children();
create trigger recurring_expenses_cleanup_children
  after delete on public.recurring_expenses
  for each row execute function public.cleanup_entity_children();
create trigger expenses_cleanup_children
  after delete on public.expenses
  for each row execute function public.cleanup_entity_children();

-- ---------------------------------------------------------------------------
-- Storage: private 'attachments' bucket, authenticated-only access.
-- Guarded so the migration also runs on a plain Postgres without Supabase's
-- storage schema (e.g. local validation).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('attachments', 'attachments', false)
    on conflict (id) do nothing;

    execute $pol$
      create policy "authenticated read attachments"
        on storage.objects for select to authenticated
        using (bucket_id = 'attachments')
    $pol$;
    execute $pol$
      create policy "authenticated insert attachments"
        on storage.objects for insert to authenticated
        with check (bucket_id = 'attachments')
    $pol$;
    execute $pol$
      create policy "authenticated update attachments"
        on storage.objects for update to authenticated
        using (bucket_id = 'attachments')
        with check (bucket_id = 'attachments')
    $pol$;
    execute $pol$
      create policy "authenticated delete attachments"
        on storage.objects for delete to authenticated
        using (bucket_id = 'attachments')
    $pol$;
  end if;
end;
$$;
