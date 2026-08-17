\set ON_ERROR_STOP on
\pset pager off
-- Instant dispatch, slots and punctuality, against a real Postgres.
-- Re-runnable: the fixtures are cleared first, because the schema file is
-- applied to a database that keeps its rows between runs.
delete from public.workers where phone like '943501000%';
delete from public.jobs where customer_phone like '98765000%';

-- three electricians at increasing distance from the customer
select public.register_worker('9435010001','1111', jsonb_build_object(
  'name','Near Online',
  'email','near.online@example.com','city','Guwahati','area','Jalukbari','lat',26.1445,'lng',91.7362,
  'skills', jsonb_build_array(jsonb_build_object('skill','Electrician','price',400,'unit','per visit')))) is not null as w1;
select public.register_worker('9435010002','1111', jsonb_build_object(
  'name','Mid Offline',
  'email','mid.offline@example.com','city','Guwahati','area','Beltola','lat',26.1600,'lng',91.7700,
  'skills', jsonb_build_array(jsonb_build_object('skill','Electrician','price',450,'unit','per visit')))) is not null as w2;
select public.register_worker('9435010003','1111', jsonb_build_object(
  'name','Far Online',
  'email','far.online@example.com','city','Guwahati','area','Narengi','lat',26.2000,'lng',91.8500,
  'skills', jsonb_build_array(jsonb_build_object('skill','Electrician','price',500,'unit','per visit')))) is not null as w3;
update workers set status='approved', verified=true where phone like '943501000%';

-- a dentist with a calendar
select (public.register_worker('9435010004','1111', jsonb_build_object(
  'name','Dr Slot',
  'email','dr.slot@example.com','city','Guwahati','area','Dispur','lat',26.1400,'lng',91.7900,
  'reg_council',1,'reg_number','ASDC/2019/4471',
  'availability', jsonb_build_object('from','10:00','to','13:00','len',30,'days',jsonb_build_array(1,2,3,4,5,6)),
  'skills', jsonb_build_array(jsonb_build_object('skill','Dentist','price',400,'unit','per session'))))).id as doc_id \gset
update workers set status='approved', verified=true where phone='9435010004';

\echo '--- 1. a new registration number is unverified until a person checks it'
select reg_number, reg_verified from workers where phone='9435010004';

\echo '--- 2. nearest ONLINE worker is asked first, not simply the nearest'
-- Far Online is online; Near Online is not. Online must win.
select public.set_online('9435010003','1111', 120) is not null as far_is_online;
select code, asked from public.create_job('Electrician','Test Customer','9876500000','Jalukbari',
       'Two fans', 26.1445, 91.7362) \gset j1_
select w.name as first_asked from job_offers o join workers w on w.id=o.worker_id
 join jobs j on j.id=o.job_id where j.code = :'j1_code' order by o.rank limit 1;

\echo '--- 3. declining moves straight to the next worker'
select public.decline_offer('9435010003','1111', :'j1_code');
select o.rank, w.name, o.status from job_offers o join workers w on w.id=o.worker_id
 join jobs j on j.id=o.job_id where j.code = :'j1_code' order by o.rank;

\echo '--- 4. an expired offer rolls on by itself'
update job_offers set expires_at = now() - interval '1 second'
 where job_id = (select id from jobs where code = :'j1_code') and status='pending';
select public.advance_jobs() as jobs_moved_on;
select count(*) as workers_asked from job_offers o join jobs j on j.id=o.job_id
 where j.code = :'j1_code';

\echo '--- 5. accepting closes the search and hands over the customer'
-- rank 1 declined and rank 2 let it expire, so the live offer is rank 3
select w.phone as live_offer_phone from job_offers o join workers w on w.id=o.worker_id
 join jobs j on j.id=o.job_id
 where j.code = :'j1_code' and o.status='pending' \gset
select customer_name, area, skill from public.accept_offer(:'live_offer_phone','1111', :'j1_code', 25);
select status, asked, worker_name, eta_minutes from public.job_state(:'j1_code');

\echo '--- 6. a second worker cannot take a job already accepted'
do $$
declare c text;
begin
  select code into c from jobs where status='accepted' order by created_at desc limit 1;
  begin
    perform public.accept_offer('9435010001','1111', c, 20);
    raise exception 'FAIL: two workers accepted the same job';
  exception when others then
    if sqlerrm like '%already gone%' then raise notice 'PASS  job cannot be accepted twice';
    else raise; end if;
  end;
end $$;

\echo '--- 7. the customer only gets the number once somebody has accepted'
select (worker_phone is not null) as number_released_after_accept from public.job_state(:'j1_code');

\echo '--- 8. when nobody can do it, the job says so rather than hanging'
select code from public.create_job('Wedding Planner','Nobody Home','9876500001','Dispur') \gset j2_
select status, asked from public.job_state(:'j2_code');

\echo '--- 9. punctuality is recorded once and shows up on the worker'
-- Migration 24.2 made the vote belong to whoever booked: it now needs the
-- customer token handed out with the job, so that a passer-by holding only
-- the job code cannot mark somebody late.
select customer_token from jobs where code = :'j1_code' \gset j1_
select public.rate_punctuality(:'j1_code', true,  :'j1_customer_token'::uuid);
select public.rate_punctuality(:'j1_code', false, :'j1_customer_token'::uuid);   -- ignored: one vote per job
do $$ begin
  begin
    perform public.rate_punctuality((select code from jobs where status='done' limit 1), false);
    raise exception 'FAIL: a job can be rated without the token it was booked with';
  exception when others then
    if sqlerrm like '%cannot be rated%' then raise notice 'PASS  the punctuality vote needs the booking token';
    else raise; end if;
  end;
end $$;
select name, on_time_yes, on_time_total from workers where phone = :'live_offer_phone';

\echo '--- 10. slots: booking one takes it out of circulation'
select public.book_slot(:'doc_id'::uuid, 'Dentist', current_date + 1, '10:30',
                        'Slot Customer','9876500002','Tooth pain') as worker_number;
select slot_time from public.taken_slots(:'doc_id'::uuid, current_date + 1);
do $$ begin
  begin
    perform public.book_slot((select id from workers where phone='9435010004'), 'Dentist',
                             current_date + 1, '10:30', 'Second Customer','9876500003',null);
    raise exception 'FAIL: the same slot was booked twice';
  exception when others then
    if sqlerrm like '%just taken%' then raise notice 'PASS  a taken slot cannot be double-booked';
    else raise; end if;
  end;
end $$;

\echo '--- 11. the worker sees their own appointments, nobody else does'
select skill, slot_time, customer_name from public.my_appointments('9435010004','1111');

\echo '--- 12. anon cannot read jobs, offers or appointments'
-- every one of these tables has rows in it by now, so "no rows" would be a
-- real answer; the privilege has to be gone outright
select (select count(*) from jobs) > 0 as jobs_have_rows,
       (select count(*) from appointments) > 0 as appointments_have_rows;
set role anon;
do $$
declare t text;
begin
  foreach t in array array['jobs','job_offers','appointments','worker_push',
                           'punctuality_votes','worker_secrets','worker_ratings'] loop
    begin
      execute format('select 1 from public.%I limit 1', t);
      raise exception 'FAIL: anon can still read %', t;
    exception
      when insufficient_privilege then raise notice 'PASS  anon has no access to %', t;
    end;
  end loop;
  -- The report form still has to work, but it goes through the RPC now.
  -- Migration 15 took the table-level INSERT away precisely so that the
  -- daily cap in report_worker cannot be walked around, and schema-verify
  -- asserts the table itself is shut; this file was still writing straight
  -- into it and calling that the form working.
  begin
    perform public.report_worker((select id from public.workers limit 1),
                                 'Rude', 'anon can still report');
    raise notice 'PASS  anon can still file a report, through the RPC';
  exception when others then raise exception 'FAIL: report form broken for anon (%)', sqlerrm;
  end;
  begin
    insert into public.worker_reports (worker_id, reason)
      values ((select id from public.workers limit 1), 'straight into the table');
    raise exception 'FAIL: anon can write worker_reports directly, so the cap means nothing';
  exception
    when insufficient_privilege then raise notice 'PASS  and cannot write the table directly';
  end;
end $$;
reset role;

\echo '--- 13. search reports online state and punctuality'
-- The search stopped returning a computed is_online and a whole availability
-- blob: it hands back online_until and the caller decides, which is one
-- column instead of two and cannot go stale between query and render. A
-- calendar is no longer any of a search result's business — taken_slots is
-- asked at the moment somebody opens the day, and section 10 covers that.
select name, (online_until > now()) as is_online, on_time_yes, on_time_total, jobs_done, tier
  from public.search_workers(26.1445, 91.7362, null, null, null, 'Guwahati', 10, 0)
 order by (online_until > now()) desc nulls last, name;
