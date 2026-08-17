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

-- Supabase keeps pgcrypto in a schema called `extensions`, not in `public`,
-- and puts that schema on the search path. A plain Postgres has neither, so
-- `create extension if not exists pgcrypto` at the top of the schema file
-- lands the functions in `public` instead — bare crypt() then resolves and
-- everything looks fine, while `extensions.crypt(...)` fails with "schema
-- extensions does not exist". That difference is invisible until a self-check
-- happens to qualify the call, which is a miserable way to find out that the
-- test database was never shaped like the real one. Shape it here.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
alter role postgres set search_path = public, extensions;

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

grant usage on schema public, extensions to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
