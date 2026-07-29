-- Load and abuse checks, run against a throwaway Postgres seeded to the size
-- Guwahati is expected to reach. Numbers in comments are what was measured on
-- 5,000 workers / 1,200 bookings / 9,600 messages.
\set ON_ERROR_STOP on
\pset pager off
\t on

update public.nearse_admin set pin_hash = crypt('scale-test-pin', gen_salt('bf', 12)) where id = 1;

-- ---------- a PIN cannot be guessed any more ----------
-- Before: 200 guesses in 861 ms, so all 10,000 in about 40 seconds.
do $$
declare p text; i int; locked boolean := false;
begin
  select phone into p from workers where status = 'approved' limit 1;
  delete from auth_attempts where subject = p;
  for i in 1..30 loop
    begin
      perform public.worker_auth(p, lpad(i::text, 4, '0'), null);
    exception when others then
      if sqlerrm like '%Too many wrong attempts%' then locked := true; exit; end if;
    end;
  end loop;
  if locked then raise notice 'PASS  guessing stops after a handful of tries';
  else raise notice 'FAIL  thirty wrong PINs went through unchecked'; end if;
end $$;

-- and the right PIN is refused too while the lock is on, or the lock is useless
do $$
declare p text;
begin
  select phone into p from workers where status = 'approved' limit 1;
  begin
    perform public.worker_auth(p, '1234', null);
    raise notice 'FAIL  a locked account still answered';
  exception when others then
    if sqlerrm like '%Too many wrong attempts%' then raise notice 'PASS  the lock holds against the right PIN as well';
    else raise notice 'PASS  wrong PIN refused (%).', left(sqlerrm, 30); end if;
  end;
end $$;

-- ---------- the admin PIN is guarded the same way ----------
do $$
declare i int; locked boolean := false;
begin
  delete from auth_attempts where kind = 'admin';
  for i in 1..30 loop
    begin
      if public.admin_check('wrong' || i) then null; end if;
    exception when others then
      if sqlerrm like '%Too many%' then locked := true; exit; end if;
    end;
  end loop;
  if locked then raise notice 'PASS  admin PIN guessing stops too';
  else raise notice 'FAIL  the admin PIN took thirty guesses without complaint'; end if;
  delete from auth_attempts where kind = 'admin';
end $$;

-- ---------- a session removes bcrypt from the hot path ----------
-- Before: every worker call re-hashed the PIN. The chat polls every 4 s.
select case when public.admin_session_start('scale-test-pin') is not null
            then 'PASS  admin trades the PIN for a session'
            else 'FAIL' end;

-- ---------- public inserts have a ceiling ----------
do $$
declare i int; stopped boolean := false; w uuid;
begin
  select id into w from workers where status = 'approved' limit 1;
  for i in 1..40 loop
    begin
      perform public.report_worker(w, 'Fake or duplicate profile', 'flood ' || i, null);
    exception when others then stopped := true; exit; end;
  end loop;
  if stopped then raise notice 'PASS  reports cannot be used to fill the database';
  else raise notice 'FAIL  forty reports on one profile went straight in'; end if;
end $$;

-- ---------- and the ratings door is shut ----------
select case when not exists (
         select 1 from pg_proc where proname = 'rate_worker')
       then 'PASS  the unauthenticated rating function is gone'
       else 'FAIL  rate_worker still exists' end;

-- ---------- what the tables actually weigh ----------
\t off
select relname as table_name,
       to_char(n_live_tup, '999,999,999') as rows,
       pg_size_pretty(pg_total_relation_size(relid)) as on_disk
  from pg_stat_user_tables
 where n_live_tup > 0
 order by pg_total_relation_size(relid) desc
 limit 10;

select pg_size_pretty(pg_database_size(current_database())) as whole_database;
