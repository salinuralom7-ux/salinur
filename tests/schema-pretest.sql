-- Makes a plain Postgres look enough like Supabase to test the schema against.
--
-- schema-verify.sql needs the roles `anon` and `authenticated` to exist,
-- because Migration 10 revokes the table-level SELECT on workers and grants
-- back an explicit column list instead. On a database with no such roles that
-- whole block skips silently, the verification still passes, and the one
-- property it was written to prove — that the public cannot read the phone
-- column in bulk — goes untested.
--
-- Run this once, before the first application of the schema:
--
--   createdb repto_test
--   psql -d repto_test -f tests/schema-pretest.sql
--   psql -d repto_test -f docs/supabase-workers-setup.sql   # three times
--   psql -d repto_test -f tests/schema-verify.sql

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
