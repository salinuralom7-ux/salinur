\set ON_ERROR_STOP on
\pset pager off
-- ---------- 1. the published admin PIN is refused ----------
-- put the committed hash back first: an earlier run of this file rotates it,
-- and the seed now leaves an existing PIN alone
update nearse_admin set pin_hash = '$2a$06$wH.KLvESA51YLnv9I1O9UekJwfBnkw3xTNdh1MvfFFRq56oyGoPkG' where id = 1;
delete from workers where phone in ('9435012345','9435012346');
do $$ begin
  begin
    perform public.admin_check('Repto@20');
    raise exception 'FAIL: published admin PIN still accepted';
  exception when others then
    if sqlerrm like '%published in the public repository%' then
      raise notice 'PASS  published admin PIN refused';
    else raise; end if;
  end;
end $$;

-- ---------- 2. after rotation the admin PIN works ----------
update nearse_admin set pin_hash = crypt('a-real-secret-pin', gen_salt('bf', 12)) where id = 1;
select public.admin_check('a-real-secret-pin') as rotated_ok,
       public.admin_check('wrong')             as wrong_rejected;

-- ---------- seed two workers ----------
select id from public.register_worker('9435012345','1234',
  jsonb_build_object('name','Test Approved','city','Guwahati','area','Jalukbari',
    'selfie','https://x.supabase.co/storage/v1/object/public/selfies/a.webp',
    'thumb','https://x.supabase.co/storage/v1/object/public/selfies/a-t.webp',
    'skills', jsonb_build_array(jsonb_build_object('skill','Carpenter','price',900,'unit','per day')),
    'email','test.approved@example.com',
    'age_confirmed', true, 'terms_version','2026-07-27')) \gset w1_
-- an address is required to register since Migration 52; it is how somebody
-- who forgets their PIN gets back in, so there is no such thing as a profile
-- without one
select id from public.register_worker('9435012346','1234',
  jsonb_build_object('name','Test Pending','city','Guwahati','area','Beltola',
    'email','test.pending@example.com',
    'skills', jsonb_build_array(jsonb_build_object('skill','Plumber','price',400,'unit','per visit')))) \gset w2_
update workers set status='approved', verified=true where phone='9435012345';

select consent_at is not null as consent_recorded, age_confirmed, terms_version
  from workers where phone='9435012345';

-- ---------- 3. anon sees approved only, and cannot read phone ----------
set role anon;
select count(*) as anon_visible_rows from public.workers;              -- expect 1
do $$ begin
  begin
    perform phone from public.workers;
    raise exception 'FAIL: anon can still read the phone column';
  exception when insufficient_privilege then
    raise notice 'PASS  anon cannot read workers.phone';
  end;
end $$;
do $$ begin
  begin
    perform * from public.worker_reports;
    raise exception 'FAIL: anon can read reports';
  exception when insufficient_privilege or others then
    raise notice 'PASS  anon cannot read worker_reports';
  end;
end $$;
reset role;

-- ---------- 4. search no longer leaks the number ----------
select count(*) as search_rows from public.search_workers(null,null,null,null,null,'Guwahati',20,0);
select count(*) filter (where attname='phone') as phone_in_search_output
  from pg_attribute where attrelid = 'public.search_workers'::regproc::oid;

-- ---------- 5. contact is handed out one at a time and recorded ----------
select public.request_worker_contact(:'w1_id', 'device-a') as number_returned;
select count(*) as contact_rows from public.contact_requests;
do $$ begin
  begin
    perform public.request_worker_contact((select id from workers where phone='9435012346'), 'device-a');
    raise exception 'FAIL: pending worker''s number handed out';
  exception when others then
    if sqlerrm like '%no longer available%' then raise notice 'PASS  pending worker''s number withheld';
    else raise; end if;
  end;
end $$;

-- ---------- 6. the anonymous rating door is closed ----------
-- This section used to call rate_worker(id, stars, rater). Migration 16.5
-- dropped that function — a caller-supplied token could be reissued per
-- request, so the "one rating per device" limit it enforced was worth
-- nothing — and reviews now come only from a job that finished, through
-- review_thread. The call left behind aborted this file on line 79 under
-- ON_ERROR_STOP, so sections 7 to 10 below were silently never running.
select count(*) as rate_worker_still_exists
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'rate_worker';     -- expect 0

-- ---------- 6b. public writes go through gated functions ----------
set role anon;
do $$ begin
  begin
    insert into public.bookings (worker_name, customer_name) values ('x','y');
    raise exception 'FAIL: anon can insert bookings directly';
  exception when insufficient_privilege then
    raise notice 'PASS  anon cannot insert bookings directly';
  end;
end $$;
do $$ begin
  begin
    insert into public.worker_reports (reason) values ('x');
    raise exception 'FAIL: anon can insert reports directly';
  exception when insufficient_privilege then
    raise notice 'PASS  anon cannot insert reports directly';
  end;
end $$;
reset role;

-- the front door works, and cannot be used to fill the table
select public.report_worker(:'w1_id', 'Fake or duplicate profile', 'raised by the schema test');
select count(*) as reports_recorded from public.worker_reports where worker_id = :'w1_id';
do $$
declare i int; wid uuid;
begin
  -- looked up rather than interpolated: psql does not substitute :vars inside
  -- a dollar-quoted body
  select id into wid from workers where phone = '9435012345';
  for i in 1..40 loop
    begin
      perform public.report_worker(wid, 'Fake or duplicate profile');
    exception when others then
      if sqlerrm like '%already been reported%' then
        raise notice 'PASS  report flooding capped after % attempts', i;
        return;
      end if;
      raise;
    end;
  end loop;
  raise exception 'FAIL: report flooding was never capped';
end $$;

-- ---------- 7. changing the photo sends you back for review ----------
select status from public.update_worker('9435012345','1234',
  jsonb_build_object('available', false)) ;                              -- expect approved
update workers set status='approved' where phone='9435012345';
select status from public.update_worker('9435012345','1234',
  jsonb_build_object('selfie','https://x.supabase.co/storage/v1/object/public/selfies/b.webp'));  -- expect pending

-- ---------- 8. rate bands still enforced ----------
do $$ begin
  begin
    perform public.update_worker('9435012345','1234',
      jsonb_build_object('skills', jsonb_build_array(
        jsonb_build_object('skill','Carpenter','price',99999,'unit','per day'))));
    raise exception 'FAIL: out-of-band rate accepted';
  exception when others then
    if sqlerrm like '%too high%' then raise notice 'PASS  out-of-band rate refused';
    else raise; end if;
  end;
end $$;

-- ---------- 9. deleting removes the profile and its photos ----------
insert into public.worker_reports (worker_id, reason) values (:'w1_id', 'test');
select public.delete_worker('9435012345','1234');
select count(*) as worker_rows_left from workers where phone='9435012345';
select count(*) as rating_rows_left from worker_ratings where worker_id = :'w1_id';
select count(*) as report_rows_left from worker_reports where worker_id = :'w1_id';

-- ---------- 10. retention purge runs ----------
select * from public.purge_expired_data();
