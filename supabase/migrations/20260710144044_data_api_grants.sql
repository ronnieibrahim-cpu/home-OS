-- Migration 6/6: explicit Data API grants (ADR-013)
-- RLS policies (migration 5, ADR-006) control which ROWS a role can see —
-- they don't grant access to the TABLE itself. Postgres still requires a
-- GRANT before anon/authenticated can touch these tables at all. Supabase
-- platforms used to auto-grant this for every new table; recent Supabase
-- CLI/local-stack defaults stopped doing that (see the `auto_expose_new_tables`
-- note in supabase/config.toml, itself slated for removal). Make the grant
-- explicit and permanent here instead of depending on a deprecated flag.
-- Idempotent — safe to run again against an environment that already has
-- these privileges (e.g. the live project).

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
