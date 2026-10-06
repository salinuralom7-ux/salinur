-- =====================================================================
-- InfluJi — initial schema
--
-- Paste this whole file into Supabase → SQL Editor → Run (or use
-- `supabase db push`). It is safe to run more than once.
--
-- Security model, in one paragraph:
--   Every table has row level security on. Logged-in users can only touch
--   their own rows, and only the columns granted below — so a creator can
--   edit their bio but can never mark themselves verified, approved or
--   paid. Those fields change only through the admin_* functions (which
--   check the caller is an admin) or the service-role key used by the
--   Razorpay webhook. The public sees creators only through the
--   `public_creators` view, which lists approved, paid-up creators and
--   nothing else.
-- =====================================================================

-- ---------- Types ----------------------------------------------------
do $$ begin create type public.user_role as enum ('creator', 'business', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin create type public.creator_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'removed');
exception when duplicate_object then null; end $$;

do $$ begin create type public.subscription_status as enum ('none', 'active', 'past_due', 'cancelled', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin create type public.billing_plan as enum ('monthly', 'yearly');
exception when duplicate_object then null; end $$;

do $$ begin create type public.booking_status as enum ('new', 'seen', 'accepted', 'declined');
exception when duplicate_object then null; end $$;

do $$ begin create type public.report_status as enum ('open', 'resolved', 'dismissed');
exception when duplicate_object then null; end $$;

-- ---------- Shared helpers -------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Profiles: one per signed-in person ------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          public.user_role not null default 'business',
  full_name     text check (char_length(full_name) <= 80),
  business_name text check (char_length(business_name) <= 80),
  business_type text check (char_length(business_type) <= 40),
  created_at    timestamptz not null default now()
);

-- Create the profile row automatically when someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 80))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admins are made by hand in the SQL editor:
--   update public.profiles set role = 'admin' where id = '<your user id>';
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- Creators ---------------------------------------------------
create table if not exists public.creators (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references auth.users (id) on delete cascade,

  -- Public profile (editable by the creator)
  handle                   text not null unique
                           check (handle ~ '^[a-z0-9._]{1,30}$' and handle !~ '(^\.|\.$|\.\.)'),
  name                     text not null check (char_length(name) between 1 and 60),
  photo_path               text check (char_length(photo_path) <= 200),
  city_slug                text not null check (city_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  area                     text check (char_length(area) <= 60),
  niches                   text[] not null default '{}'
                           check (cardinality(niches) <= 3 and niches <@ array['food','fashion','beauty','fitness','tech','travel','education','comedy','lifestyle','local-business']),
  languages                text[] not null default '{}' check (cardinality(languages) <= 8),
  followers                integer not null default 0 check (followers between 0 and 1000000000),
  avg_views                integer not null default 0 check (avg_views between 0 and 1000000000),
  rate_reel                integer check (rate_reel between 0 and 10000000),
  rate_story               integer check (rate_story between 0 and 10000000),
  rate_post                integer check (rate_post between 0 and 10000000),
  open_to_barter           boolean not null default false,
  sample_links             text[] not null default '{}' check (cardinality(sample_links) <= 6),
  bio                      text check (char_length(bio) <= 160),
  whatsapp                 text check (whatsapp ~ '^[6-9][0-9]{9}$'),            -- Indian mobile, 10 digits
  contact_email            text check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  youtube                  text check (char_length(youtube) <= 100),
  facebook                 text check (char_length(facebook) <= 100),           -- as normalizeFacebook() stores it

  -- Platform-controlled (never writable by the creator)
  status                   public.creator_status not null default 'draft',
  review_note              text check (char_length(review_note) <= 300),       -- e.g. rejection reason
  verified                 boolean not null default false,                     -- "Verified" badge
  stats_verified           boolean not null default false,                     -- follower counts checked
  plan                     public.billing_plan,
  subscription_status      public.subscription_status not null default 'none',
  current_period_end       timestamptz,                                        -- live until this moment
  razorpay_subscription_id text unique,
  view_count               integer not null default 0,
  contact_click_count      integer not null default 0,

  submitted_at             timestamptz,
  approved_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists creators_city_idx on public.creators (city_slug);
create index if not exists creators_niches_idx on public.creators using gin (niches);

drop trigger if exists creators_touch on public.creators;
create trigger creators_touch before update on public.creators
  for each row execute function public.touch_updated_at();

-- A creator is live when an admin approved them AND their paid period hasn't ended.
-- Cancelling keeps you live until the period you paid for runs out.
create or replace function public.creator_is_live(c public.creators) returns boolean
language sql stable as $$
  select c.status = 'approved' and c.current_period_end is not null and c.current_period_end > now();
$$;

-- What businesses and the public see. Only live creators, only public columns.
-- (A view owned by the schema owner reads past RLS, which is the point: the
-- base table stays locked, this is the one window into it.)
create or replace view public.public_creators as
  select c.id, c.handle, c.name, c.photo_path, c.city_slug, c.area, c.niches, c.languages,
         c.followers, c.avg_views, c.stats_verified, c.verified,
         c.rate_reel, c.rate_story, c.rate_post, c.open_to_barter,
         c.sample_links, c.bio, c.whatsapp, c.contact_email, c.youtube, c.facebook,
         c.view_count, c.approved_at, c.created_at
  from public.creators c
  where public.creator_is_live(c);

-- ---------- Booking requests (business → creator) -----------------------
create table if not exists public.booking_requests (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.creators (id) on delete cascade,
  business_user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  business_name    text not null check (char_length(business_name) between 1 and 80),
  business_type    text check (char_length(business_type) <= 40),
  preferred_date   date,
  brief            text not null check (char_length(brief) between 10 and 1000),
  budget_inr       integer check (budget_inr between 0 and 10000000),
  contact_phone    text check (contact_phone ~ '^[6-9][0-9]{9}$'),
  contact_email    text check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status           public.booking_status not null default 'new',
  created_at       timestamptz not null default now(),
  check (contact_phone is not null or contact_email is not null)
);

create index if not exists booking_requests_creator_idx on public.booking_requests (creator_id, created_at desc);
create index if not exists booking_requests_business_idx on public.booking_requests (business_user_id, created_at desc);

-- Spam protection: max 5 requests per business per hour, 1 per creator per day,
-- and only to creators who are currently live.
create or replace function public.booking_requests_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.creators c where c.id = new.creator_id and public.creator_is_live(c)) then
    raise exception 'This creator is not taking requests right now.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.booking_requests
        where business_user_id = new.business_user_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many requests. Please try again in an hour.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.booking_requests
        where business_user_id = new.business_user_id and creator_id = new.creator_id
          and created_at > now() - interval '24 hours') then
    raise exception 'You already sent this creator a request today.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists booking_requests_guard on public.booking_requests;
create trigger booking_requests_guard before insert on public.booking_requests
  for each row execute function public.booking_requests_guard();

-- ---------- Shortlists (businesses saving creators) ----------------------
create table if not exists public.shortlists (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, creator_id)
);

-- ---------- Reports (anyone logged in can flag a profile) ----------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.creators (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason      text not null check (reason in ('fake_profile', 'fake_followers', 'inappropriate', 'scam', 'other')),
  details     text check (char_length(details) <= 500),
  status      public.report_status not null default 'open',
  created_at  timestamptz not null default now()
);

create or replace function public.reports_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reports
        where reporter_id = new.reporter_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Too many reports today. Our team is on it.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists reports_guard on public.reports;
create trigger reports_guard before insert on public.reports
  for each row execute function public.reports_guard();

-- ---------- Payments (written only by the Razorpay webhook) --------------
create table if not exists public.payments (
  id                       uuid primary key default gen_random_uuid(),
  creator_id               uuid references public.creators (id) on delete set null,
  razorpay_event_id        text unique,                    -- makes webhook retries harmless
  razorpay_payment_id      text,
  razorpay_subscription_id text,
  event                    text not null,
  amount_paise             integer,
  raw                      jsonb not null,
  created_at               timestamptz not null default now()
);

-- ---------- Row level security -------------------------------------------
alter table public.profiles         enable row level security;
alter table public.creators         enable row level security;
alter table public.booking_requests enable row level security;
alter table public.shortlists       enable row level security;
alter table public.reports          enable row level security;
alter table public.payments         enable row level security;

-- Start from nothing, then grant exactly what each role needs.
-- (Supabase grants everything to anon/authenticated by default.)
revoke all on public.profiles, public.creators, public.booking_requests,
              public.shortlists, public.reports, public.payments from anon, authenticated;

-- Profiles: read and edit your own; never your role.
grant select on public.profiles to authenticated;
grant update (full_name, business_name, business_type) on public.profiles to authenticated;
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Creators: only your own row, only the profile columns.
grant select on public.creators to authenticated;
grant insert (user_id, handle, name, photo_path, city_slug, area, niches, languages, followers, avg_views,
              rate_reel, rate_story, rate_post, open_to_barter, sample_links, bio, whatsapp, contact_email,
              youtube, facebook) on public.creators to authenticated;
grant update (handle, name, photo_path, city_slug, area, niches, languages, followers, avg_views,
              rate_reel, rate_story, rate_post, open_to_barter, sample_links, bio, whatsapp, contact_email,
              youtube, facebook) on public.creators to authenticated;
grant delete on public.creators to authenticated;

drop policy if exists creators_select on public.creators;
create policy creators_select on public.creators for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists creators_insert on public.creators;
create policy creators_insert on public.creators for insert with check (user_id = auth.uid());
drop policy if exists creators_update on public.creators;
create policy creators_update on public.creators for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists creators_delete on public.creators;
create policy creators_delete on public.creators for delete using (user_id = auth.uid());

-- Booking requests: businesses send and read their own; creators read theirs and set the status.
grant select on public.booking_requests to authenticated;
grant insert (creator_id, business_name, business_type, preferred_date, brief, budget_inr, contact_phone, contact_email)
  on public.booking_requests to authenticated;
grant update (status) on public.booking_requests to authenticated;

drop policy if exists booking_select on public.booking_requests;
create policy booking_select on public.booking_requests for select using (
  business_user_id = auth.uid()
  or exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
  or public.is_admin());
drop policy if exists booking_insert on public.booking_requests;
create policy booking_insert on public.booking_requests for insert with check (business_user_id = auth.uid());
drop policy if exists booking_update on public.booking_requests;
create policy booking_update on public.booking_requests for update
  using (exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid()));

-- Shortlists: entirely your own.
grant select, insert (creator_id), delete on public.shortlists to authenticated;
drop policy if exists shortlists_own on public.shortlists;
create policy shortlists_own on public.shortlists for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reports: anyone logged in can file one; only admins read them.
grant insert (creator_id, reason, details) on public.reports to authenticated;
grant select on public.reports to authenticated;
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());
drop policy if exists reports_admin on public.reports;
create policy reports_admin on public.reports for select using (public.is_admin());

-- Payments: creators can see their own receipts; admins see all. Nobody but the webhook writes.
grant select on public.payments to authenticated;
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select using (
  public.is_admin() or exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid()));

-- The public window.
grant select on public.public_creators to anon, authenticated;

-- ---------- Functions the app calls ---------------------------------------

-- Landing page counters. Real numbers only.
create or replace function public.landing_stats()
returns table (creators_live bigint, cities_live bigint)
language sql stable security definer set search_path = public as $$
  select count(*), count(distinct city_slug) from public.public_creators;
$$;

-- Simple analytics, counted only for live profiles.
create or replace function public.record_profile_view(p_handle text) returns void
language sql security definer set search_path = public as $$
  update public.creators c set view_count = view_count + 1
  where c.handle = lower(p_handle) and public.creator_is_live(c);
$$;

create or replace function public.record_contact_click(p_handle text) returns void
language sql security definer set search_path = public as $$
  update public.creators c set contact_click_count = contact_click_count + 1
  where c.handle = lower(p_handle) and public.creator_is_live(c);
$$;

-- Creator finishes onboarding: draft/rejected → pending_review, if the profile is complete.
create or replace function public.submit_for_review() returns public.creator_status
language plpgsql security definer set search_path = public as $$
declare c public.creators;
begin
  select * into c from public.creators where user_id = auth.uid();
  if not found then raise exception 'Create your profile first.' using errcode = 'P0001'; end if;
  if c.status not in ('draft', 'rejected') then return c.status; end if;
  if cardinality(c.niches) = 0 or c.whatsapp is null or c.bio is null
     or cardinality(c.sample_links) < 3 or c.photo_path is null then
    raise exception 'Your profile is missing some details.' using errcode = 'P0001';
  end if;
  update public.creators set status = 'pending_review', submitted_at = now(), review_note = null
  where id = c.id;
  return 'pending_review';
end $$;

-- Admin actions. Each one checks the caller is an admin.
create or replace function public.admin_review_creator(p_creator_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then
    raise exception 'Give the creator a reason when rejecting.' using errcode = 'P0001';
  end if;
  update public.creators
     set status = case when p_approve then 'approved'::public.creator_status else 'rejected'::public.creator_status end,
         review_note = case when p_approve then null else left(p_note, 300) end,
         approved_at = case when p_approve then coalesce(approved_at, now()) else approved_at end
   where id = p_creator_id;
end $$;

create or replace function public.admin_set_verified(p_creator_id uuid, p_verified boolean, p_stats_verified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  update public.creators set verified = p_verified, stats_verified = p_stats_verified where id = p_creator_id;
end $$;

create or replace function public.admin_remove_creator(p_creator_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  update public.creators set status = 'removed', review_note = left(p_note, 300) where id = p_creator_id;
end $$;

create or replace function public.admin_set_report_status(p_report_id uuid, p_status public.report_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  update public.reports set status = p_status where id = p_report_id;
end $$;

-- Lock down who can call what. Postgres lets everyone execute functions by default.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.landing_stats()                 to anon, authenticated;
grant execute on function public.record_profile_view(text)       to anon, authenticated;
grant execute on function public.record_contact_click(text)      to anon, authenticated;
grant execute on function public.creator_is_live(public.creators) to anon, authenticated;
grant execute on function public.is_admin()                      to authenticated;
grant execute on function public.submit_for_review()             to authenticated;
grant execute on function public.admin_review_creator(uuid, boolean, text)    to authenticated;
grant execute on function public.admin_set_verified(uuid, boolean, boolean)   to authenticated;
grant execute on function public.admin_remove_creator(uuid, text)             to authenticated;
grant execute on function public.admin_set_report_status(uuid, public.report_status) to authenticated;

-- ---------- Profile photos ------------------------------------------------
-- Public bucket (photos appear on public profiles). Each user may only write
-- inside a folder named after their own user id: avatars/<user id>/photo.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
