-- Proves the security rules in supabase/migrations work, by acting as each
-- kind of user and checking what they can and can't do. Runs inside one
-- transaction and rolls back, so it leaves nothing behind.
--
-- Run with: npm run test:db
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null
begin;

-- ---------- helpers ----------
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

-- Runs `stmt` and passes only if it fails with an error mentioning `needle`.
create function pg_temp.must_fail(stmt text, needle text, what text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if position(lower(needle) in lower(sqlerrm)) = 0 then
      raise exception 'FAILED: % (wrong error: %)', what, sqlerrm;
    end if;
    raise notice 'ok  %', what;
    return;
  end;
  raise exception 'FAILED: % (it was allowed)', what;
end $$;

grant execute on all functions in schema pg_temp to anon, authenticated;

-- ---------- people ----------
-- creator, business, admin, stranger
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000c', 'asha@example.com',  '{"full_name": "Asha Das"}'),
  ('00000000-0000-0000-0000-00000000000b', 'cafe@example.com',  '{}'),
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000f', 'other@example.com', '{}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

select pg_temp.check((select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'Asha Das',
  'signing up creates a profile with the name from Google');

-- ---------- the creator ----------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c"}';

insert into public.creators (user_id, handle, name, city_slug, niches, followers)
values ('00000000-0000-0000-0000-00000000000c', 'asha.eats', 'Asha Das', 'bongaigaon', '{food}', 12400);
select pg_temp.check(true, 'creator can create their own profile');

select pg_temp.must_fail($$insert into public.creators (user_id, handle, name, city_slug)
  values ('00000000-0000-0000-0000-00000000000f', 'fake.one', 'Fake', 'guwahati')$$,
  'row-level security', 'creator cannot create a profile for someone else');
select pg_temp.must_fail($$update public.creators set verified = true$$, 'permission denied', 'creator cannot give themselves the Verified badge');
select pg_temp.must_fail($$update public.creators set status = 'approved'$$, 'permission denied', 'creator cannot approve themselves');
select pg_temp.must_fail($$update public.creators set current_period_end = now() + interval '10 years'$$, 'permission denied', 'creator cannot extend their own subscription');
select pg_temp.must_fail($$update public.creators set stats_verified = true$$, 'permission denied', 'creator cannot mark their follower count verified');
select pg_temp.must_fail($$update public.profiles set role = 'admin'$$, 'permission denied', 'nobody can make themselves an admin');
select pg_temp.must_fail($$update public.creators set niches = '{food,fashion,beauty,tech}'$$, 'check constraint', 'max 3 niches');
select pg_temp.must_fail($$update public.creators set bio = repeat('x', 161)$$, 'check constraint', 'bio max 160 characters');
select pg_temp.must_fail($$update public.creators set handle = 'Bad..Handle'$$, 'check constraint', 'Instagram handle format is enforced');
select pg_temp.must_fail($$update public.creators set whatsapp = '12345'$$, 'check constraint', 'WhatsApp must be a 10-digit Indian mobile');

select pg_temp.must_fail($$select public.submit_for_review()$$, 'missing', 'an incomplete profile cannot be submitted');
update public.creators set
  bio = 'Food reels from Bongaigaon 🍜', whatsapp = '9876543210', photo_path = '00000000-0000-0000-0000-00000000000c/photo.jpg',
  sample_links = '{https://instagram.com/p/a,https://instagram.com/p/b,https://instagram.com/p/c}', rate_reel = 1500;
select pg_temp.check(public.submit_for_review() = 'pending_review', 'a complete profile goes to review');

select pg_temp.must_fail($$select public.admin_review_creator((select id from public.creators), true)$$, 'admins only', 'creator cannot use admin actions');

-- Profile photos: own folder only.
insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000c/photo.jpg');
select pg_temp.check(true, 'creator can upload into their own photo folder');
select pg_temp.must_fail($$insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000f/photo.jpg')$$,
  'row-level security', 'creator cannot upload into someone else''s folder');

reset role;

-- ---------- a stranger ----------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000f"}';
select pg_temp.check((select count(*) from public.creators) = 0, 'a stranger cannot see someone''s unpublished profile');
update public.creators set name = 'hacked';
reset role;
select pg_temp.check((select name from public.creators where handle = 'asha.eats') = 'Asha Das', 'a stranger cannot edit someone else''s profile');

-- ---------- not live until approved AND paid ----------
set local role anon;
select pg_temp.check((select count(*) from public.public_creators) = 0, 'pending profiles are not public');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select public.admin_review_creator((select id from public.creators where handle = 'asha.eats'), true);
select pg_temp.must_fail($$select public.admin_review_creator((select id from public.creators where handle = 'asha.eats'), false, '')$$,
  'reason', 'rejecting requires a reason');
reset role;

set local role anon;
select pg_temp.check((select count(*) from public.public_creators) = 0, 'approved but unpaid profiles are not public');
reset role;

-- What the Razorpay webhook does (it uses the service role).
update public.creators set subscription_status = 'active', plan = 'yearly', current_period_end = now() + interval '1 year'
where handle = 'asha.eats';

set local role anon;
select pg_temp.check((select count(*) from public.public_creators where handle = 'asha.eats') = 1, 'approved + paid creators are public');
select pg_temp.check((select whatsapp from public.public_creators where handle = 'asha.eats') = '9876543210', 'businesses can see the WhatsApp number');
select pg_temp.check((select creators_live = 1 and cities_live = 1 from public.landing_stats()), 'landing counters show the real numbers');
select pg_temp.must_fail($$select * from public.creators$$, 'permission denied', 'the public cannot read the creators table directly');
select pg_temp.must_fail($$select public.admin_set_verified((select id from public.public_creators limit 1), true, true)$$,
  'permission denied', 'the public cannot call admin actions');
select public.record_profile_view('Asha.Eats');
reset role;
select pg_temp.check((select view_count from public.creators where handle = 'asha.eats') = 1, 'profile views are counted');

-- ---------- bookings and spam limits ----------
-- Five more live creators for the business to contact.
insert into auth.users (id) select ('00000000-0000-0000-0001-00000000000' || n)::uuid from generate_series(1, 5) n;
insert into public.creators (user_id, handle, name, city_slug, status, current_period_end)
select ('00000000-0000-0000-0001-00000000000' || n)::uuid, 'creator' || n, 'Creator ' || n, 'guwahati', 'approved', now() + interval '1 month'
from generate_series(1, 5) n;
-- And one that lapsed.
insert into auth.users (id) values ('00000000-0000-0000-0002-000000000001');
insert into public.creators (user_id, handle, name, city_slug, status, current_period_end)
values ('00000000-0000-0000-0002-000000000001', 'lapsed', 'Lapsed', 'guwahati', 'approved', now() - interval '1 day');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b"}';
insert into public.booking_requests (creator_id, business_name, brief, contact_phone)
values ((select id from public.public_creators where handle = 'asha.eats'), 'Brew Café', 'Two reels for our new menu launch', '9123456780');
select pg_temp.check(true, 'a business can send a booking request');
select pg_temp.must_fail($$insert into public.booking_requests (creator_id, business_name, brief, contact_phone)
  values ((select id from public.public_creators where handle = 'asha.eats'), 'Brew Café', 'Another request same day', '9123456780')$$,
  'already sent', 'one request per creator per day');
select pg_temp.must_fail($$insert into public.booking_requests (creator_id, business_name, brief, contact_phone)
  values ((select id from public.creators where handle = 'lapsed'), 'Brew Café', 'Request to a lapsed creator', '9123456780')$$,
  'not taking requests', 'cannot book a creator whose subscription lapsed');
select pg_temp.must_fail($$insert into public.booking_requests (creator_id, business_name, brief)
  values ((select id from public.public_creators where handle = 'creator5'), 'Brew Café', 'No way to contact me back')$$,
  'check constraint', 'a booking request needs a phone or email');
insert into public.booking_requests (creator_id, business_name, brief, contact_phone)
select id, 'Brew Café', 'Menu launch reel for our café', '9123456780' from public.public_creators where handle in ('creator1', 'creator2', 'creator3', 'creator4');
select pg_temp.must_fail($$insert into public.booking_requests (creator_id, business_name, brief, contact_phone)
  values ((select id from public.public_creators where handle = 'creator5'), 'Brew Café', 'Sixth request this hour', '9123456780')$$,
  'too many requests', 'max 5 booking requests per hour');
update public.booking_requests set status = 'accepted';
reset role;
select pg_temp.check(not exists (select 1 from public.booking_requests where status = 'accepted'), 'a business cannot accept its own request');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c"}';
select pg_temp.check((select count(*) from public.booking_requests) = 1, 'a creator sees only requests sent to them');
update public.booking_requests set status = 'seen';
select pg_temp.check((select status from public.booking_requests) = 'seen', 'a creator can mark a request seen');
select pg_temp.must_fail($$update public.booking_requests set brief = 'changed the brief'$$, 'permission denied', 'a creator cannot rewrite the business''s message');
select pg_temp.must_fail($$insert into public.payments (event, raw) values ('fake', '{}')$$, 'permission denied', 'nobody but the webhook can record payments');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000f"}';
select pg_temp.check((select count(*) from public.booking_requests) = 0, 'a stranger cannot read anyone''s booking requests');

-- ---------- reports ----------
insert into public.reports (creator_id, reason, details) values ((select id from public.public_creators where handle = 'asha.eats'), 'fake_followers', 'Numbers look off');
select pg_temp.check((select count(*) from public.reports) = 0, 'reporters cannot read reports back');
insert into public.reports (creator_id, reason) select id, 'other' from public.public_creators where handle in ('creator1', 'creator2', 'creator3', 'creator4');
select pg_temp.must_fail($$insert into public.reports (creator_id, reason) values ((select id from public.public_creators where handle = 'creator5'), 'other')$$,
  'too many reports', 'max 5 reports per person per day');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select pg_temp.check((select count(*) from public.reports) = 5, 'admins can read every report');
select public.admin_remove_creator((select id from public.creators where handle = 'creator1'), 'Fake profile');
reset role;

-- ---------- removals and lapses hide profiles ----------
set local role anon;
select pg_temp.check(not exists (select 1 from public.public_creators where handle = 'creator1'), 'removed creators disappear from the site');
select pg_temp.check(not exists (select 1 from public.public_creators where handle = 'lapsed'), 'lapsed subscriptions disappear from the site');
select pg_temp.check((select creators_live from public.landing_stats()) = 5, 'counters drop when creators go offline');
reset role;

rollback;
\o
\echo 'All database security checks passed.'
