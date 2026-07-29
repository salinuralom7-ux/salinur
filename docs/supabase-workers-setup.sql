-- ============================================================
-- REPTO — Supabase setup
--
-- This file is applied whole on every deploy, so every statement in it has
-- to be safe to run again. Later sections deliberately replace earlier ones;
-- read it top to bottom and the last definition of anything wins.
--
-- Security model (as it stands after Migration 10):
--   * Anyone can read APPROVED profiles — that is the marketplace. Pending
--     and rejected ones are not public.
--   * The WhatsApp number is not readable in bulk. It is handed out one
--     worker at a time by request_worker_contact, which records the request.
--   * Sign-up / sign-in / profile edits go through functions that verify the
--     worker's PIN on the server (bcrypt-hashed, in a table with no policies).
--   * Bookings are insert-only for visitors, and nobody can read them back.
--   * Admin actions need a PIN checked on the server. The PIN committed to
--     this repository is refused; see Migration 10.1.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.workers (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  phone        text not null unique,
  selfie       text,
  city         text,
  area         text,
  about        text,
  lat          double precision,
  lng          double precision,
  skills       jsonb not null default '[]',   -- [{skill,price,unit,exp}] max 3
  available    boolean not null default true,
  rating_sum   int not null default 0,
  rating_count int not null default 0
);

create table if not exists public.worker_secrets (
  worker_id uuid primary key references public.workers(id) on delete cascade,
  pin_hash  text not null
);

create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  worker_id      uuid,
  worker_name    text,
  customer_name  text,
  customer_phone text,
  note           text
);

alter table public.workers        enable row level security;
alter table public.worker_secrets enable row level security;
alter table public.bookings       enable row level security;

drop policy if exists "public can view workers" on public.workers;
create policy "public can view workers"
  on public.workers for select using (true);

drop policy if exists "public can create bookings" on public.bookings;
create policy "public can create bookings"
  on public.bookings for insert with check (true);
-- (no select policy on bookings, no policies at all on worker_secrets)

-- ---------- functions (PIN verified on the server) ----------
create or replace function public.register_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_id uuid;
begin
  if exists (select 1 from workers where phone = p_phone) then
    raise exception 'This phone number is already registered — please sign in';
  end if;
  if p_pin !~ '^\d{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  insert into workers (name, phone, selfie, city, area, about, lat, lng, skills, available)
  values (
    coalesce(p_data->>'name',''),
    p_phone,
    p_data->>'selfie',
    p_data->>'city',
    p_data->>'area',
    p_data->>'about',
    (p_data->>'lat')::double precision,
    (p_data->>'lng')::double precision,
    coalesce(p_data->'skills','[]'::jsonb),
    coalesce((p_data->>'available')::boolean, true)
  ) returning id into new_id;
  insert into worker_secrets (worker_id, pin_hash) values (new_id, crypt(p_pin, gen_salt('bf')));
  return query select * from workers where id = new_id;
end;
$$;

create or replace function public.login_worker(p_phone text, p_pin text)
returns setof public.workers
language sql security definer set search_path = public, extensions as $$
  select w.* from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
$$;

create or replace function public.update_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  wid uuid;
begin
  select w.id into wid from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then
    raise exception 'Wrong phone number or PIN';
  end if;
  update workers set
    name      = coalesce(p_data->>'name', name),
    selfie    = coalesce(p_data->>'selfie', selfie),
    city      = coalesce(p_data->>'city', city),
    area      = coalesce(p_data->>'area', area),
    about     = coalesce(p_data->>'about', about),
    lat       = coalesce((p_data->>'lat')::double precision, lat),
    lng       = coalesce((p_data->>'lng')::double precision, lng),
    skills    = coalesce(p_data->'skills', skills),
    available = coalesce((p_data->>'available')::boolean, available)
  where id = wid;
  return query select * from workers where id = wid;
end;
$$;

create or replace function public.rate_worker(p_id uuid, p_stars int)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_stars < 1 or p_stars > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;
  update workers
    set rating_sum = rating_sum + p_stars,
        rating_count = rating_count + 1
  where id = p_id;
end;
$$;

-- Budget Cars was retired on 27 July 2026 and its setup moved out of this
-- file. Its tables (cars, owner_settings) and its check_pin function are
-- deliberately left in the database rather than dropped: the site can come
-- back from git history, and dropping them would destroy the inventory.
-- Nothing below maintains them any more.

-- ============================================================
-- Repto: profile verification
--   * new profiles are hidden until an admin approves them
--   * existing profiles are grandfathered in on first migration
--   * admin actions are gated by a bcrypt-hashed PIN on the server
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='workers' and column_name='verified'
  ) then
    alter table public.workers add column verified boolean not null default false;
    update public.workers set verified = true;   -- trust profiles that existed before review started
  end if;
end $$;

create table if not exists public.nearse_admin (
  id       int primary key default 1,
  pin_hash text not null
);
alter table public.nearse_admin enable row level security;

-- Same story as the owner PIN above: `do update` here meant every CI run put
-- the committed hash back, so rotating the admin PIN never stuck.
insert into public.nearse_admin (id, pin_hash)
values (1, '$2a$06$wH.KLvESA51YLnv9I1O9UekJwfBnkw3xTNdh1MvfFFRq56oyGoPkG')
on conflict (id) do nothing;

create or replace function public.admin_check(p_pin text)
returns boolean
language sql security definer set search_path = public, extensions as $$
  select exists (select 1 from nearse_admin where id = 1 and pin_hash = crypt(p_pin, pin_hash));
$$;

create or replace function public.admin_set_verified(p_pin text, p_id uuid, p_verified boolean)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.admin_check(p_pin) then
    raise exception 'Wrong admin PIN';
  end if;
  update workers set verified = p_verified where id = p_id;
end;
$$;

-- ============================================================
-- MIGRATION 3 — phone OTP + approve / reject
--   * phone_verified records that the number passed an OTP check
--   * status replaces the plain verified flag with pending/approved/rejected
--     (verified is kept in sync so nothing that reads it breaks)
--   * require_phone_otp is OFF until an SMS/WhatsApp provider is configured,
--     so registration keeps working in the meantime
-- ============================================================

alter table public.workers add column if not exists phone_verified boolean not null default false;
alter table public.workers add column if not exists status text;
alter table public.workers add column if not exists review_note text;
alter table public.workers add column if not exists reviewed_at timestamptz;

-- derive status from the old verified flag, once
update public.workers
   set status = case when verified then 'approved' else 'pending' end
 where status is null;

alter table public.workers alter column status set default 'pending';
alter table public.workers alter column status set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workers_status_chk') then
    alter table public.workers
      add constraint workers_status_chk check (status in ('pending','approved','rejected'));
  end if;
end $$;

-- keep the older `verified` column truthful for any cached client
create or replace function public.workers_sync_verified()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.verified := (new.status = 'approved');
  return new;
end;
$$;

drop trigger if exists workers_sync_verified_trg on public.workers;
create trigger workers_sync_verified_trg
  before insert or update of status on public.workers
  for each row execute function public.workers_sync_verified();

create table if not exists public.nearse_config (
  id                int primary key default 1,
  require_phone_otp boolean not null default false
);
alter table public.nearse_config enable row level security;
insert into public.nearse_config (id) values (1) on conflict (id) do nothing;

-- readable by anyone: the app needs to know whether to demand an OTP
drop policy if exists "config is public" on public.nearse_config;
create policy "config is public" on public.nearse_config for select using (true);

-- ---------- registration now checks the OTP ----------
-- When a verified Supabase auth session is present its phone claim must match
-- the number being registered, so the OTP cannot be skipped by calling the RPC
-- directly. When require_phone_otp is on, a session is mandatory.
create or replace function public.register_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_id     uuid;
  jwt_phone  text;
  need_otp   boolean;
begin
  if exists (select 1 from workers where phone = p_phone) then
    raise exception 'This phone number is already registered — please sign in';
  end if;
  if p_pin !~ '^\d{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  if p_phone !~ '^[6-9]\d{9}$' then
    raise exception 'Enter a valid 10-digit Indian mobile number';
  end if;

  select require_phone_otp into need_otp from nearse_config where id = 1;
  -- Supabase puts the verified number in the JWT as E.164 digits, e.g. 917086599367.
  -- Keep the last 10 digits so it lines up with what the form collects.
  jwt_phone := regexp_replace(
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'phone', ''),
    '\D', '', 'g');
  if length(jwt_phone) > 10 then
    jwt_phone := right(jwt_phone, 10);
  end if;

  if coalesce(need_otp, false) and jwt_phone = '' then
    raise exception 'Please verify your WhatsApp number first';
  end if;
  if jwt_phone <> '' and jwt_phone <> p_phone then
    raise exception 'Verify the same number you are registering with';
  end if;

  insert into workers (name, phone, selfie, city, area, about, lat, lng, skills, available, phone_verified)
  values (
    coalesce(p_data->>'name',''),
    p_phone,
    p_data->>'selfie',
    p_data->>'city',
    p_data->>'area',
    p_data->>'about',
    (p_data->>'lat')::double precision,
    (p_data->>'lng')::double precision,
    coalesce(p_data->'skills','[]'::jsonb),
    coalesce((p_data->>'available')::boolean, true),
    jwt_phone <> ''
  ) returning id into new_id;
  insert into worker_secrets (worker_id, pin_hash) values (new_id, crypt(p_pin, gen_salt('bf')));
  return query select * from workers where id = new_id;
end;
$$;

-- ---------- admin: approve / reject / restore ----------
create or replace function public.admin_set_status(p_pin text, p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.admin_check(p_pin) then
    raise exception 'Wrong admin PIN';
  end if;
  if p_status not in ('pending','approved','rejected') then
    raise exception 'Unknown status: %', p_status;
  end if;
  update workers
     set status      = p_status,
         review_note = nullif(btrim(coalesce(p_note,'')), ''),
         reviewed_at = now()
   where id = p_id;
end;
$$;

create or replace function public.admin_set_require_otp(p_pin text, p_require boolean)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.admin_check(p_pin) then
    raise exception 'Wrong admin PIN';
  end if;
  update nearse_config set require_phone_otp = p_require where id = 1;
end;
$$;

-- A rejected worker who fixes their profile goes back into the review queue.
-- Toggling availability alone must not do that, so only a real edit counts.
create or replace function public.update_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  wid       uuid;
  is_edit   boolean;
begin
  select w.id into wid from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then
    raise exception 'Wrong phone number or PIN';
  end if;

  is_edit := (p_data ?| array['name','selfie','area','about','skills']);

  update workers set
    name      = coalesce(p_data->>'name', name),
    selfie    = coalesce(p_data->>'selfie', selfie),
    city      = coalesce(p_data->>'city', city),
    area      = coalesce(p_data->>'area', area),
    about     = coalesce(p_data->>'about', about),
    lat       = coalesce((p_data->>'lat')::double precision, lat),
    lng       = coalesce((p_data->>'lng')::double precision, lng),
    skills    = coalesce(p_data->'skills', skills),
    available = coalesce((p_data->>'available')::boolean, available),
    status    = case when is_edit and status = 'rejected' then 'pending' else status end,
    review_note = case when is_edit and status = 'rejected' then null else review_note end
  where id = wid;
  return query select * from workers where id = wid;
end;
$$;

-- Optional email. It lives in worker_secrets, which has no RLS policy at all,
-- because unlike the WhatsApp number a customer never needs it — putting it on
-- the publicly readable workers table would just hand out a scrapable list.
alter table public.worker_secrets add column if not exists email text;

create or replace function public.register_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_id     uuid;
  jwt_phone  text;
  need_otp   boolean;
begin
  if exists (select 1 from workers where phone = p_phone) then
    raise exception 'This phone number is already registered — please sign in';
  end if;
  if p_pin !~ '^\d{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  if p_phone !~ '^[6-9]\d{9}$' then
    raise exception 'Enter a valid 10-digit Indian mobile number';
  end if;

  select require_phone_otp into need_otp from nearse_config where id = 1;
  jwt_phone := regexp_replace(
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'phone', ''),
    '\D', '', 'g');
  if length(jwt_phone) > 10 then
    jwt_phone := right(jwt_phone, 10);
  end if;

  if coalesce(need_otp, false) and jwt_phone = '' then
    raise exception 'Please verify your WhatsApp number first';
  end if;
  if jwt_phone <> '' and jwt_phone <> p_phone then
    raise exception 'Verify the same number you are registering with';
  end if;

  insert into workers (name, phone, selfie, city, area, about, lat, lng, skills, available, phone_verified)
  values (
    coalesce(p_data->>'name',''),
    p_phone,
    p_data->>'selfie',
    p_data->>'city',
    p_data->>'area',
    p_data->>'about',
    (p_data->>'lat')::double precision,
    (p_data->>'lng')::double precision,
    coalesce(p_data->'skills','[]'::jsonb),
    coalesce((p_data->>'available')::boolean, true),
    jwt_phone <> ''
  ) returning id into new_id;
  insert into worker_secrets (worker_id, pin_hash, email)
    values (new_id, crypt(p_pin, gen_salt('bf')), nullif(btrim(coalesce(p_data->>'email','')), ''));
  return query select * from workers where id = new_id;
end;
$$;

-- ============================================================
-- MIGRATION 4 — WhatsApp click-to-chat verification
--
-- Instead of paying a provider to send a code TO the worker, the worker
-- sends a code FROM their own WhatsApp to the Repto business number. The
-- message arriving from that number is the proof: it can only have come
-- through WhatsApp, and only from the account that controls it. No SMS
-- gateway, no DLT registration, no Meta Business API.
--
-- The code lives in worker_secrets (no RLS policy) so it is not readable
-- by the public; the admin reads it through a PIN-gated function.
-- ============================================================

alter table public.worker_secrets add column if not exists wa_code text;

create or replace function public.register_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_id     uuid;
  jwt_phone  text;
  need_otp   boolean;
begin
  if exists (select 1 from workers where phone = p_phone) then
    raise exception 'This phone number is already registered — please sign in';
  end if;
  if p_pin !~ '^\d{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  if p_phone !~ '^[6-9]\d{9}$' then
    raise exception 'Enter a valid 10-digit Indian mobile number';
  end if;

  select require_phone_otp into need_otp from nearse_config where id = 1;
  jwt_phone := regexp_replace(
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'phone', ''),
    '\D', '', 'g');
  if length(jwt_phone) > 10 then
    jwt_phone := right(jwt_phone, 10);
  end if;

  if coalesce(need_otp, false) and jwt_phone = '' then
    raise exception 'Please verify your WhatsApp number first';
  end if;
  if jwt_phone <> '' and jwt_phone <> p_phone then
    raise exception 'Verify the same number you are registering with';
  end if;

  insert into workers (name, phone, selfie, city, area, about, lat, lng, skills, available, phone_verified)
  values (
    coalesce(p_data->>'name',''),
    p_phone,
    p_data->>'selfie',
    p_data->>'city',
    p_data->>'area',
    p_data->>'about',
    (p_data->>'lat')::double precision,
    (p_data->>'lng')::double precision,
    coalesce(p_data->'skills','[]'::jsonb),
    coalesce((p_data->>'available')::boolean, true),
    jwt_phone <> ''
  ) returning id into new_id;
  insert into worker_secrets (worker_id, pin_hash, email, wa_code)
    values (new_id,
            crypt(p_pin, gen_salt('bf')),
            nullif(btrim(coalesce(p_data->>'email','')), ''),
            nullif(btrim(coalesce(p_data->>'wa_code','')), ''));
  return query select * from workers where id = new_id;
end;
$$;

-- The admin panel shows, next to each profile awaiting review, the code that
-- should have arrived on the Repto WhatsApp from that worker's number.
create or replace function public.admin_wa_codes(p_pin text)
returns table (worker_id uuid, wa_code text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.admin_check(p_pin) then
    raise exception 'Wrong admin PIN';
  end if;
  return query select s.worker_id, s.wa_code from worker_secrets s where s.wa_code is not null;
end;
$$;

-- Approving a profile that went through the WhatsApp check IS the verification:
-- the admin has matched the code against the sending number by hand.
create or replace function public.admin_set_status(p_pin text, p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.admin_check(p_pin) then
    raise exception 'Wrong admin PIN';
  end if;
  if p_status not in ('pending','approved','rejected') then
    raise exception 'Unknown status: %', p_status;
  end if;
  update workers w
     set status      = p_status,
         review_note = nullif(btrim(coalesce(p_note,'')), ''),
         reviewed_at = now(),
         phone_verified = case
           when p_status = 'approved'
                and exists (select 1 from worker_secrets s
                            where s.worker_id = w.id and s.wa_code is not null)
           then true else w.phone_verified end
   where w.id = p_id;
end;
$$;

-- ============================================================
-- MIGRATION 5 — deletion rights and location privacy
--
--   * delete_worker lets a worker erase their own profile with their PIN.
--     Required by the DPDP Act's right to erasure, and by the Play Store,
--     which will not list an app that creates accounts it cannot delete.
--   * Coordinates are rounded to 3 decimal places (~100 m). That is ample
--     for "nearest first" ranking, and stops a world-readable table from
--     pinpointing the house a worker lives in.
-- ============================================================

create or replace function public.delete_worker(p_phone text, p_pin text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  wid uuid;
begin
  select w.id into wid from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then
    raise exception 'Wrong phone number or PIN';
  end if;
  -- worker_secrets cascades on the foreign key
  delete from workers where id = wid;
end;
$$;

-- round anything already stored
update public.workers
   set lat = round(lat::numeric, 3)::double precision,
       lng = round(lng::numeric, 3)::double precision
 where lat is not null or lng is not null;

create or replace function public.workers_coarse_location()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.lat is not null then new.lat := round(new.lat::numeric, 3)::double precision; end if;
  if new.lng is not null then new.lng := round(new.lng::numeric, 3)::double precision; end if;
  return new;
end;
$$;

drop trigger if exists workers_coarse_location_trg on public.workers;
create trigger workers_coarse_location_trg
  before insert or update of lat, lng on public.workers
  for each row execute function public.workers_coarse_location();

-- ============================================================
-- MIGRATION 6 — photos move out of the database
--
-- Photos were stored as base64 text inside workers.selfie, and the browse
-- screen selects every column, so a customer downloaded every worker's photo
-- on every visit (~36 KB per profile — 7 MB at 200 profiles). Photos now go
-- to Storage and the column holds a URL instead.
--
-- The column type does not change: an <img src> accepts a data: URL and an
-- https: URL alike, so existing base64 rows keep working untouched and no
-- backfill is needed.
--
-- Guarded because the storage schema only exists on Supabase; this file is
-- also run against a plain Postgres for testing.
-- ============================================================
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'no storage schema (not Supabase) — skipping bucket setup';
    return;
  end if;

  -- Public read: profile photos are shown to customers, same as the rest of
  -- a published profile. Size and type are capped because uploads are
  -- unauthenticated — the app has no Supabase Auth session to attach.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('selfies', 'selfies', true, 400000, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update
    set public = true,
        file_size_limit = 400000,
        allowed_mime_types = array['image/jpeg','image/png','image/webp'];

  execute 'drop policy if exists "selfies are publicly readable" on storage.objects';
  execute $p$create policy "selfies are publicly readable"
    on storage.objects for select using (bucket_id = 'selfies')$p$;

  execute 'drop policy if exists "anyone may upload a selfie" on storage.objects';
  execute $p$create policy "anyone may upload a selfie"
    on storage.objects for insert with check (bucket_id = 'selfies')$p$;

  -- no update or delete policy: an uploaded photo cannot be overwritten or
  -- removed by a visitor, only replaced by a new upload under a new name
end $$;

-- ============================================================
-- MIGRATION 7 — paged, server-side search
--
-- The browse screen fetched every worker and filtered in the browser. At
-- 30,000 workers that is ~37 MB per visit, which no plan makes affordable and
-- no phone renders. Filtering, distance ranking and paging now happen in the
-- database, and the client receives one page at a time.
--
-- Distance is haversine in SQL. Guwahati is small enough that a planar
-- approximation would do, but haversine costs nothing here and stays correct
-- when more cities are added.
-- ============================================================

create index if not exists workers_browse_idx
  on public.workers (status, available, city);

drop function if exists public.search_workers(double precision, double precision, text, text[], text, text, int, int);

create function public.search_workers(
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_q          text             default null,
  p_cat_skills text[]           default null,
  p_area       text             default null,
  p_city       text             default 'Guwahati',
  p_limit      int              default 20,
  p_offset     int              default 0
)
returns table (
  id           uuid,
  name         text,
  phone        text,
  selfie       text,
  city         text,
  area         text,
  about        text,
  skills       jsonb,
  rating_sum   int,
  rating_count int,
  distance_km  double precision,
  total_count  bigint
)
language sql stable security definer set search_path = public, extensions as $$
  with base as (
    select w.*,
           lower(w.name || ' ' || coalesce(w.area,'') || ' ' || coalesce(w.city,'') || ' ' ||
                 coalesce(w.skills::text,'')) as hay,
           case when p_lat is null or w.lat is null then null else
             6371 * 2 * asin(sqrt(
               power(sin(radians(w.lat - p_lat) / 2), 2) +
               cos(radians(p_lat)) * cos(radians(w.lat)) *
               power(sin(radians(w.lng - p_lng) / 2), 2)))
           end as dist
      from workers w
     where w.status = 'approved'
       and w.available
       and (p_city is null or w.city = p_city)
       and (p_area is null or w.area = p_area)
       and (p_cat_skills is null or exists (
             select 1 from jsonb_array_elements(w.skills) s
              where s->>'skill' = any(p_cat_skills)))
  ),
  hit as (
    select * from base b
     where p_q is null or btrim(p_q) = '' or (
       select bool_and(b.hay like '%' || word || '%')
         from unnest(string_to_array(lower(btrim(p_q)), ' ')) word
        where word <> '')
  )
  select h.id, h.name, h.phone, h.selfie, h.city, h.area, h.about, h.skills,
         h.rating_sum, h.rating_count, h.dist,
         count(*) over () as total_count
    from hit h
   order by
     -- nearest first when we know where the customer is, then best rated
     case when h.dist is null then 1 else 0 end,
     round(coalesce(h.dist, 0)::numeric, 1),
     case when h.rating_count = 0 then 3.4
          else h.rating_sum::numeric / h.rating_count end desc,
     h.created_at desc
   limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;

-- ============================================================
-- MIGRATION 8 — small thumbnail alongside the full photo
--
-- The browse list shows a 64px avatar but was loading the full photo. A
-- separate 96px thumbnail costs ~1.9 KB and cuts what a customer downloads
-- while scrolling by about eleven times, which is what keeps the free tier
-- viable without a card on file.
-- ============================================================

alter table public.workers add column if not exists thumb text;

create or replace function public.register_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_id     uuid;
  jwt_phone  text;
  need_otp   boolean;
begin
  if exists (select 1 from workers where phone = p_phone) then
    raise exception 'This phone number is already registered — please sign in';
  end if;
  if p_pin !~ '^\d{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  if p_phone !~ '^[6-9]\d{9}$' then
    raise exception 'Enter a valid 10-digit Indian mobile number';
  end if;

  select require_phone_otp into need_otp from nearse_config where id = 1;
  jwt_phone := regexp_replace(
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'phone', ''),
    '\D', '', 'g');
  if length(jwt_phone) > 10 then
    jwt_phone := right(jwt_phone, 10);
  end if;

  if coalesce(need_otp, false) and jwt_phone = '' then
    raise exception 'Please verify your WhatsApp number first';
  end if;
  if jwt_phone <> '' and jwt_phone <> p_phone then
    raise exception 'Verify the same number you are registering with';
  end if;

  insert into workers (name, phone, selfie, thumb, city, area, about, lat, lng, skills, available, phone_verified)
  values (
    coalesce(p_data->>'name',''),
    p_phone,
    p_data->>'selfie',
    p_data->>'thumb',
    p_data->>'city',
    p_data->>'area',
    p_data->>'about',
    (p_data->>'lat')::double precision,
    (p_data->>'lng')::double precision,
    coalesce(p_data->'skills','[]'::jsonb),
    coalesce((p_data->>'available')::boolean, true),
    jwt_phone <> ''
  ) returning id into new_id;
  insert into worker_secrets (worker_id, pin_hash, email, wa_code)
    values (new_id,
            crypt(p_pin, gen_salt('bf')),
            nullif(btrim(coalesce(p_data->>'email','')), ''),
            nullif(btrim(coalesce(p_data->>'wa_code','')), ''));
  return query select * from workers where id = new_id;
end;
$$;

create or replace function public.update_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  wid     uuid;
  is_edit boolean;
begin
  select w.id into wid from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then
    raise exception 'Wrong phone number or PIN';
  end if;

  is_edit := (p_data ?| array['name','selfie','area','about','skills']);

  update workers set
    name      = coalesce(p_data->>'name', name),
    selfie    = coalesce(p_data->>'selfie', selfie),
    thumb     = coalesce(p_data->>'thumb', thumb),
    city      = coalesce(p_data->>'city', city),
    area      = coalesce(p_data->>'area', area),
    about     = coalesce(p_data->>'about', about),
    lat       = coalesce((p_data->>'lat')::double precision, lat),
    lng       = coalesce((p_data->>'lng')::double precision, lng),
    skills    = coalesce(p_data->'skills', skills),
    available = coalesce((p_data->>'available')::boolean, available),
    status    = case when is_edit and status = 'rejected' then 'pending' else status end,
    review_note = case when is_edit and status = 'rejected' then null else review_note end
  where id = wid;
  return query select * from workers where id = wid;
end;
$$;

-- the return type gains a column, so the old signature must go first
drop function if exists public.search_workers(double precision, double precision, text, text[], text, text, int, int);

create function public.search_workers(
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_q          text             default null,
  p_cat_skills text[]           default null,
  p_area       text             default null,
  p_city       text             default 'Guwahati',
  p_limit      int              default 20,
  p_offset     int              default 0
)
returns table (
  id           uuid,
  name         text,
  phone        text,
  selfie       text,
  thumb        text,
  city         text,
  area         text,
  about        text,
  skills       jsonb,
  rating_sum   int,
  rating_count int,
  distance_km  double precision,
  total_count  bigint
)
language sql stable security definer set search_path = public, extensions as $$
  with base as (
    select w.*,
           lower(w.name || ' ' || coalesce(w.area,'') || ' ' || coalesce(w.city,'') || ' ' ||
                 coalesce(w.skills::text,'')) as hay,
           case when p_lat is null or w.lat is null then null else
             6371 * 2 * asin(sqrt(
               power(sin(radians(w.lat - p_lat) / 2), 2) +
               cos(radians(p_lat)) * cos(radians(w.lat)) *
               power(sin(radians(w.lng - p_lng) / 2), 2)))
           end as dist
      from workers w
     where w.status = 'approved'
       and w.available
       and (p_city is null or w.city = p_city)
       and (p_area is null or w.area = p_area)
       and (p_cat_skills is null or exists (
             select 1 from jsonb_array_elements(w.skills) s
              where s->>'skill' = any(p_cat_skills)))
  ),
  hit as (
    select * from base b
     where p_q is null or btrim(p_q) = '' or (
       select bool_and(b.hay like '%' || word || '%')
         from unnest(string_to_array(lower(btrim(p_q)), ' ')) word
        where word <> '')
  )
  select h.id, h.name, h.phone, h.selfie, h.thumb, h.city, h.area, h.about, h.skills,
         h.rating_sum, h.rating_count, h.dist,
         count(*) over () as total_count
    from hit h
   order by
     case when h.dist is null then 1 else 0 end,
     round(coalesce(h.dist, 0)::numeric, 1),
     case when h.rating_count = 0 then 3.4
          else h.rating_sum::numeric / h.rating_count end desc,
     h.created_at desc
   limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;

-- ============================================================
-- MIGRATION 9 — sensible price bands per service
--
-- Workers set their own rate, which is the point of Repto, but an
-- unbounded number invites nonsense listings and makes the marketplace
-- untrustworthy — the same reason OLX will not let you list a phone for
-- one rupee. Each service gets a floor and a ceiling drawn from what that
-- trade actually charges in Guwahati, and the rate is checked on the
-- server so the limit cannot be bypassed by calling the API directly.
-- ============================================================

create table if not exists public.service_rates (
  skill     text primary key,
  min_price int not null,
  max_price int not null,
  check (min_price > 0 and max_price >= min_price)
);
alter table public.service_rates enable row level security;
drop policy if exists "rates are public" on public.service_rates;
create policy "rates are public" on public.service_rates for select using (true);

insert into public.service_rates (skill, min_price, max_price) values
  ($q$Housemaid (Daily)$q$,2000,12000),
  ($q$Part-time Maid$q$,1500,10000),
  ($q$Deep House Cleaning$q$,400,6000),
  ($q$Bathroom Cleaning$q$,200,4000),
  ($q$Kitchen Deep Cleaning$q$,200,4000),
  ($q$Sofa & Carpet Cleaning$q$,200,4000),
  ($q$Water Tank Cleaning$q$,200,4000),
  ($q$Window & Glass Cleaning$q$,200,4000),
  ($q$Pest Control$q$,200,4000),
  ($q$Laundry & Ironing$q$,1500,20000),
  ($q$Home Cook (Daily Meals)$q$,2500,18000),
  ($q$Party Cook$q$,300,3000),
  ($q$Assamese Cuisine Cook$q$,300,3000),
  ($q$Tiffin Service$q$,2500,30000),
  ($q$Event Catering$q$,50,2000),
  ($q$Halwai (Sweets & Snacks)$q$,300,3000),
  ($q$Home Baker (Cakes)$q$,200,25000),
  ($q$Serving Staff / Waiter$q$,300,3000),
  ($q$Babysitter$q$,4000,20000),
  ($q$Nanny (Full-time)$q$,4000,45000),
  ($q$Newborn & Mother Care$q$,4000,45000),
  ($q$Elderly Caretaker$q$,6000,30000),
  ($q$Patient Attendant$q$,400,3000),
  ($q$Home Nurse$q$,400,3000),
  ($q$Physiotherapist (Home Visit)$q$,200,4000),
  ($q$Electrician$q$,200,1500),
  ($q$Plumber$q$,200,1500),
  ($q$AC Service & Repair$q$,300,2500),
  ($q$AC Installation$q$,200,15000),
  ($q$Refrigerator Repair$q$,250,2500),
  ($q$Washing Machine Repair$q$,250,2500),
  ($q$Microwave & Oven Repair$q$,150,2500),
  ($q$Geyser Repair$q$,150,2500),
  ($q$Water Purifier Service$q$,150,2500),
  ($q$Chimney Cleaning & Repair$q$,150,2500),
  ($q$Gas Stove Repair$q$,150,2500),
  ($q$Inverter & Battery Service$q$,150,2500),
  ($q$TV Installation & Repair$q$,150,2500),
  ($q$Mobile Phone Repair$q$,200,15000),
  ($q$Laptop & Computer Repair$q$,200,15000),
  ($q$CCTV Installation$q$,200,15000),
  ($q$Wi-Fi & Network Setup$q$,150,2500),
  ($q$Water Pump Repair$q$,150,2500),
  ($q$Solar Panel Installation$q$,200,15000),
  ($q$Mason (Raj Mistri)$q$,400,2500),
  ($q$Carpenter$q$,400,2500),
  ($q$House Painter$q$,5,250),
  ($q$Tile & Marble Fitter$q$,5,250),
  ($q$Waterproofing Specialist$q$,5,250),
  ($q$POP & False Ceiling Worker$q$,5,250),
  ($q$Welder & Fabricator$q$,400,2500),
  ($q$Grill & Gate Fitting$q$,200,25000),
  ($q$Aluminium & Glass Fitter$q$,200,25000),
  ($q$Modular Kitchen Fitter$q$,200,25000),
  ($q$Furniture Assembly$q$,200,25000),
  ($q$Civil Contractor$q$,3000,300000),
  ($q$Interior Designer$q$,3000,300000),
  ($q$Daily Wage Helper$q$,400,2500),
  ($q$Personal Driver (Monthly)$q$,6000,30000),
  ($q$Driver (Per Day)$q$,300,3000),
  ($q$Outstation Driver$q$,300,3000),
  ($q$Car Mechanic (Home Visit)$q$,150,3000),
  ($q$Two-Wheeler Mechanic$q$,150,3000),
  ($q$Car AC Repair$q$,200,25000),
  ($q$Car Washing (At Home)$q$,300,4000),
  ($q$Doorstep Puncture Repair$q$,200,25000),
  ($q$Battery Jump-start & Replacement$q$,150,3000),
  ($q$Car Denting & Painting$q$,200,25000),
  ($q$Driving Instructor$q$,2000,15000),
  ($q$Beautician (At Home)$q$,300,3000),
  ($q$Bridal Makeup Artist$q$,3000,40000),
  ($q$Party Makeup Artist$q$,500,40000),
  ($q$Hair Stylist (At Home)$q$,200,5000),
  ($q$Barber (At Home)$q$,200,5000),
  ($q$Mehendi Artist$q$,500,40000),
  ($q$Nail Artist$q$,200,5000),
  ($q$Massage Therapist$q$,200,4000),
  ($q$Yoga Trainer$q$,1500,45000),
  ($q$Fitness Trainer (At Home)$q$,1500,45000),
  ($q$Dietician & Nutritionist$q$,200,4000),
  ($q$Home Tutor (Class 1–5)$q$,1000,25000),
  ($q$Home Tutor (Class 6–10)$q$,1000,25000),
  ($q$Tutor — Science (11–12)$q$,1000,25000),
  ($q$Tutor — Commerce (11–12)$q$,1000,25000),
  ($q$Tutor — Mathematics$q$,1000,25000),
  ($q$Spoken English Trainer$q$,1000,25000),
  ($q$Competitive Exam Coach$q$,1000,25000),
  ($q$Computer Basics Trainer$q$,1000,25000),
  ($q$Coding Teacher (Kids)$q$,1000,25000),
  ($q$Guitar Teacher$q$,1000,25000),
  ($q$Keyboard & Piano Teacher$q$,1000,25000),
  ($q$Vocal & Singing Teacher$q$,1000,25000),
  ($q$Tabla & Drums Teacher$q$,1000,25000),
  ($q$Classical Dance Teacher$q$,1000,25000),
  ($q$Western Dance Teacher$q$,1000,25000),
  ($q$Art & Drawing Teacher$q$,1000,25000),
  ($q$Religious Studies Teacher$q$,1000,25000),
  ($q$Cricket / Football Coach$q$,1000,25000),
  ($q$Swimming Coach$q$,1000,25000),
  ($q$Event Photographer$q$,2500,40000),
  ($q$Wedding Photographer$q$,1500,40000),
  ($q$Videographer$q$,3000,50000),
  ($q$Drone Operator$q$,1500,40000),
  ($q$DJ & Sound System$q$,1500,40000),
  ($q$Anchor / Emcee$q$,1500,40000),
  ($q$Event Decorator$q$,1000,80000),
  ($q$Birthday & Balloon Decorator$q$,1000,80000),
  ($q$Tent & Furniture Setup$q$,1000,80000),
  ($q$Wedding Planner$q$,3000,300000),
  ($q$Priest / Pandit$q$,1000,80000),
  ($q$Maulvi (Religious Ceremony)$q$,1000,80000),
  ($q$Live Singer / Band$q$,1500,40000),
  ($q$Accountant / Bookkeeper$q$,1500,45000),
  ($q$GST & Tax Consultant$q$,300,50000),
  ($q$Chartered Accountant$q$,300,50000),
  ($q$Advocate / Lawyer$q$,300,25000),
  ($q$Document & Affidavit Agent$q$,300,50000),
  ($q$Insurance Advisor$q$,200,4000),
  ($q$Property Agent$q$,300,50000),
  ($q$Architect$q$,3000,300000),
  ($q$Civil Engineer (Consultation)$q$,150,2500),
  ($q$Vastu Consultant$q$,150,2500),
  ($q$Web Developer$q$,3000,300000),
  ($q$Mobile App Developer$q$,3000,300000),
  ($q$Graphic Designer$q$,500,60000),
  ($q$Logo & Branding Designer$q$,500,60000),
  ($q$Video Editor$q$,500,60000),
  ($q$Social Media Manager$q$,1500,45000),
  ($q$Digital Marketing Specialist$q$,1500,45000),
  ($q$Content Writer$q$,500,60000),
  ($q$Data Entry Operator$q$,1500,45000),
  ($q$Gardener (Regular)$q$,1500,15000),
  ($q$Garden Setup & Landscaping$q$,3000,300000),
  ($q$Lawn Mowing$q$,200,3000),
  ($q$Tree Cutting & Pruning$q$,200,25000),
  ($q$Pet Groomer$q$,150,2500),
  ($q$Dog Trainer$q$,1500,15000),
  ($q$Pet Sitter$q$,300,3000),
  ($q$Dog Walker$q$,1500,15000),
  ($q$Veterinary Doctor (Home Visit)$q$,150,2500),
  ($q$Ladies Tailor$q$,30,3000),
  ($q$Gents Tailor$q$,30,3000),
  ($q$Blouse & Boutique Stitching$q$,30,3000),
  ($q$Embroidery Work$q$,30,3000),
  ($q$Curtain & Sofa Cover Stitching$q$,30,3000),
  ($q$Cobbler (Shoe Repair)$q$,30,3000),
  ($q$Packers & Movers$q$,1500,30000),
  ($q$Loading & Unloading Helper$q$,300,3000),
  ($q$Goods Transport (Tempo)$q$,300,8000),
  ($q$Local Courier & Delivery$q$,300,8000),
  ($q$Grocery & Errand Helper$q$,300,3000),
  ($q$Security Guard$q$,8000,25000),
  ($q$Office Assistant$q$,6000,30000),
  ($q$Office Housekeeping Staff$q$,6000,30000),
  ($q$Building Caretaker$q$,6000,30000),
  ($q$General Physician$q$,200,1500),
  ($q$Dentist$q$,200,3000),
  ($q$Child Specialist (Paediatrician)$q$,200,1500),
  ($q$Gynaecologist$q$,200,1500),
  ($q$Orthopaedic Doctor$q$,200,1500),
  ($q$Skin & Hair Specialist$q$,200,2000),
  ($q$Eye Specialist$q$,200,1500),
  ($q$ENT Specialist$q$,200,1500),
  ($q$Ayurvedic Doctor$q$,150,1200),
  ($q$Homeopathic Doctor$q$,150,1200),
  ($q$Psychologist / Counsellor$q$,300,3000),
  ($q$Lab Sample Collection (At Home)$q$,50,1000)
on conflict (skill) do update
  set min_price = excluded.min_price, max_price = excluded.max_price;

-- Raises if any skill in the payload is priced outside its band.
create or replace function public.check_rate_bands(p_skills jsonb)
returns void
language plpgsql stable set search_path = public as $fn$
declare
  s     jsonb;
  band  public.service_rates%rowtype;
  price numeric;
begin
  for s in select * from jsonb_array_elements(coalesce(p_skills,'[]'::jsonb)) loop
    select * into band from service_rates where skill = s->>'skill';
    if not found then continue;            -- a service with no band is unrestricted
    end if;
    price := nullif(s->>'price','')::numeric;
    if price is null then
      raise exception 'Set a rate for %', s->>'skill';
    end if;
    if price < band.min_price then
      raise exception '% is too low. The lowest allowed is Rs % %',
        s->>'skill', band.min_price, coalesce(s->>'unit','');
    end if;
    if price > band.max_price then
      raise exception '% is too high. The highest allowed is Rs % %',
        s->>'skill', band.max_price, coalesce(s->>'unit','');
    end if;
  end loop;
end;
$fn$;

-- register and update now enforce the bands
create or replace function public.register_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_id uuid; jwt_phone text; need_otp boolean;
begin
  if exists (select 1 from workers where phone = p_phone) then
    raise exception 'This phone number is already registered — please sign in';
  end if;
  if p_pin !~ '^\d{4}$' then raise exception 'PIN must be exactly 4 digits'; end if;
  if p_phone !~ '^[6-9]\d{9}$' then raise exception 'Enter a valid 10-digit Indian mobile number'; end if;
  perform check_rate_bands(p_data->'skills');

  select require_phone_otp into need_otp from nearse_config where id = 1;
  jwt_phone := regexp_replace(
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'phone', ''), '\D', '', 'g');
  if length(jwt_phone) > 10 then jwt_phone := right(jwt_phone, 10); end if;
  if coalesce(need_otp,false) and jwt_phone = '' then
    raise exception 'Please verify your WhatsApp number first';
  end if;
  if jwt_phone <> '' and jwt_phone <> p_phone then
    raise exception 'Verify the same number you are registering with';
  end if;

  insert into workers (name, phone, selfie, thumb, city, area, about, lat, lng, skills, available, phone_verified)
  values (coalesce(p_data->>'name',''), p_phone, p_data->>'selfie', p_data->>'thumb',
          p_data->>'city', p_data->>'area', p_data->>'about',
          (p_data->>'lat')::double precision, (p_data->>'lng')::double precision,
          coalesce(p_data->'skills','[]'::jsonb),
          coalesce((p_data->>'available')::boolean, true), jwt_phone <> '')
  returning id into new_id;
  insert into worker_secrets (worker_id, pin_hash, email, wa_code)
    values (new_id, crypt(p_pin, gen_salt('bf')),
            nullif(btrim(coalesce(p_data->>'email','')), ''),
            nullif(btrim(coalesce(p_data->>'wa_code','')), ''));
  return query select * from workers where id = new_id;
end;
$$;

create or replace function public.update_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  wid uuid; is_edit boolean;
begin
  select w.id into wid from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;
  if p_data ? 'skills' then perform check_rate_bands(p_data->'skills'); end if;

  is_edit := (p_data ?| array['name','selfie','area','about','skills']);
  update workers set
    name = coalesce(p_data->>'name', name),
    selfie = coalesce(p_data->>'selfie', selfie),
    thumb = coalesce(p_data->>'thumb', thumb),
    city = coalesce(p_data->>'city', city),
    area = coalesce(p_data->>'area', area),
    about = coalesce(p_data->>'about', about),
    lat = coalesce((p_data->>'lat')::double precision, lat),
    lng = coalesce((p_data->>'lng')::double precision, lng),
    skills = coalesce(p_data->'skills', skills),
    available = coalesce((p_data->>'available')::boolean, available),
    status = case when is_edit and status = 'rejected' then 'pending' else status end,
    review_note = case when is_edit and status = 'rejected' then null else review_note end
  where id = wid;
  return query select * from workers where id = wid;
end;
$$;

-- ============================================================
-- MIGRATION 10 — pre-launch hardening
--
-- Found while auditing the whole app for launch. In order of severity:
--
--   1. The admin PIN was public. Its bcrypt hash is committed in this file,
--      the repository is public, and the same PIN was shipped verbatim in
--      index.html as DEMO_ADMIN_PIN. Cost factor 6 means a four-character
--      guess space falls in seconds anyway. Anyone could approve profiles,
--      unpublish every worker, and read the WhatsApp verification codes.
--   2. Every profile was world-readable, including pending and rejected
--      ones, and a single request returned every worker's WhatsApp number.
--   3. Ratings were unlimited and anonymous, so one person could bury a
--      competitor from a loop.
--   4. An approved worker could swap their photo and name and stay live,
--      which defeats the point of reviewing photos at all.
--   5. Deleting a profile left the photo in Storage for good, while the
--      privacy policy promised erasure.
--   6. The retention periods in the privacy policy had nothing enforcing
--      them.
-- ============================================================

-- ---------- 10.1 the published PINs are refused ----------
-- The hashes below are the ones committed to this repository. They cannot be
-- un-published, so they are rejected outright rather than merely discouraged.
-- To set a real one, in Supabase → SQL editor:
--   update nearse_admin set pin_hash = crypt('your new pin', gen_salt('bf', 12)) where id = 1;
create or replace function public.pin_is_published(p_hash text)
returns boolean
language sql immutable set search_path = public as $$
  select p_hash in (
    '$2a$06$wH.KLvESA51YLnv9I1O9UekJwfBnkw3xTNdh1MvfFFRq56oyGoPkG',  -- Repto admin
    '$2a$06$9/jo6EBz7wlyObFoxBaZ8u8ljNrHKEON08C7uRxBzHc8xmPSvyOea'   -- retired Budget Cars owner
  );
$$;

create or replace function public.admin_check(p_pin text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select pin_hash into h from nearse_admin where id = 1;
  if h is null then
    raise exception 'No admin PIN is set.';
  end if;
  if public.pin_is_published(h) then
    raise exception 'This admin PIN is published in the public repository and has been disabled. Set a new one in Supabase, SQL editor: update nearse_admin set pin_hash = crypt(''your new pin'', gen_salt(''bf'', 12)) where id = 1;';
  end if;
  return h = crypt(p_pin, h);
end;
$$;

-- ---------- 10.2 only approved profiles are public ----------
-- `using (true)` published pending and rejected profiles too: a rejected
-- applicant's photo, locality and number stayed readable by anyone who asked
-- the REST API for them.
drop policy if exists "public can view workers" on public.workers;
drop policy if exists "public can view approved workers" on public.workers;
create policy "public can view approved workers"
  on public.workers for select using (status = 'approved');

-- ---------- 10.3 the phone column is no longer bulk-readable ----------
-- One request returned every WhatsApp number on the platform — a ready-made
-- calling list, and exactly the kind of thing the DPDP Act's "reasonable
-- security safeguards" is about. A table-level grant makes a column-level
-- revoke a no-op, so the grant is replaced with an explicit column list.
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke select on public.workers from %I', r);
      execute format(
        'grant select (id, created_at, name, selfie, thumb, city, area, about, lat, lng,
                       skills, available, rating_sum, rating_count, status, verified,
                       phone_verified) on public.workers to %I', r);
    end if;
  end loop;
end $$;

-- Sign-up needs to know whether a number is taken without being able to read
-- the column back.
create or replace function public.phone_taken(p_phone text)
returns boolean
language sql security definer set search_path = public, extensions as $$
  select exists (select 1 from workers where phone = p_phone);
$$;

-- A number is handed out one booking at a time, and the request is recorded.
-- Harvesting the platform now means placing a booking per worker, under a
-- rate limit, leaving a row behind each time.
create table if not exists public.contact_requests (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  worker_id  uuid,
  requester  text
);
create index if not exists contact_requests_recent_idx
  on public.contact_requests (requester, created_at desc);
alter table public.contact_requests enable row level security;
-- no policies: reachable only through the function below

create or replace function public.request_worker_contact(p_id uuid, p_requester text default null)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  num    text;
  recent int;
begin
  if p_requester is not null then
    select count(*) into recent from contact_requests
     where requester = p_requester and created_at > now() - interval '1 hour';
    if recent >= 40 then
      raise exception 'Too many booking requests from this device. Please try again later.';
    end if;
  end if;

  select phone into num from workers where id = p_id and status = 'approved' and available;
  if num is null then
    raise exception 'That worker is no longer available';
  end if;
  insert into contact_requests (worker_id, requester) values (p_id, p_requester);
  return num;
end;
$$;

-- ---------- 10.4 the review queue is PIN-gated ----------
-- The admin screen used to read the workers table directly, which is the only
-- reason it needed pending rows to be public.
create or replace function public.admin_queue(p_pin text, p_limit int default 200)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.admin_check(p_pin) then
    raise exception 'Wrong admin PIN';
  end if;
  return query
    select * from workers
     order by case status when 'pending' then 0 when 'rejected' then 1 else 2 end,
              created_at desc
     limit greatest(1, least(p_limit, 500));
end;
$$;

-- ---------- 10.5 one rating per person per worker ----------
-- rate_worker took an unlimited number of anonymous stars. The running totals
-- are kept (they carry ratings collected before this existed) and adjusted by
-- the difference when somebody changes their mind.
create table if not exists public.worker_ratings (
  worker_id  uuid not null references public.workers(id) on delete cascade,
  rater      text not null,
  stars      int  not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (worker_id, rater)
);
alter table public.worker_ratings enable row level security;
-- no policies: reachable only through rate_worker

create or replace function public.rate_worker(p_id uuid, p_stars int, p_rater text default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare prev int;
begin
  if p_stars < 1 or p_stars > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;
  if not exists (select 1 from workers where id = p_id and status = 'approved') then
    raise exception 'That worker is no longer available';
  end if;

  -- no rater token (an old client): fall back to the previous behaviour
  if p_rater is null or btrim(p_rater) = '' then
    update workers set rating_sum = rating_sum + p_stars, rating_count = rating_count + 1
     where id = p_id;
    return;
  end if;

  select stars into prev from worker_ratings where worker_id = p_id and rater = p_rater;
  if prev is null then
    insert into worker_ratings (worker_id, rater, stars) values (p_id, p_rater, p_stars);
    update workers set rating_sum = rating_sum + p_stars, rating_count = rating_count + 1
     where id = p_id;
  elsif prev <> p_stars then
    update worker_ratings set stars = p_stars, created_at = now()
     where worker_id = p_id and rater = p_rater;
    update workers set rating_sum = rating_sum - prev + p_stars where id = p_id;
  end if;
end;
$$;
-- the old two-argument version would otherwise still be callable, unguarded
drop function if exists public.rate_worker(uuid, int);

-- ---------- 10.6 changing your photo or name sends you back for review ----------
-- Approval means a person looked at that photo next to that name. Letting
-- either change afterwards while the profile stays live makes the review
-- decorative — and it is the obvious way to get a fake profile past it.
create or replace function public.update_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  wid       uuid;
  is_edit   boolean;
  identity_changed boolean;
begin
  select w.id into wid from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;
  if p_data ? 'skills' then perform check_rate_bands(p_data->'skills'); end if;

  is_edit := (p_data ?| array['name','selfie','area','about','skills']);

  select (p_data->>'name'   is not null and p_data->>'name'   is distinct from w.name)
      or (p_data->>'selfie' is not null and p_data->>'selfie' is distinct from w.selfie)
    into identity_changed
    from workers w where w.id = wid;

  update workers set
    name = coalesce(p_data->>'name', name),
    selfie = coalesce(p_data->>'selfie', selfie),
    thumb = coalesce(p_data->>'thumb', thumb),
    city = coalesce(p_data->>'city', city),
    area = coalesce(p_data->>'area', area),
    about = coalesce(p_data->>'about', about),
    lat = coalesce((p_data->>'lat')::double precision, lat),
    lng = coalesce((p_data->>'lng')::double precision, lng),
    skills = coalesce(p_data->'skills', skills),
    available = coalesce((p_data->>'available')::boolean, available),
    status = case
               when identity_changed then 'pending'
               when is_edit and status = 'rejected' then 'pending'
               else status
             end,
    review_note = case
               when identity_changed then null
               when is_edit and status = 'rejected' then null
               else review_note
             end
  where id = wid;
  return query select * from workers where id = wid;
end;
$$;

-- ---------- 10.7 deleting a profile deletes the photo ----------
-- "Deletion is immediate and permanent" was not true of the photo: the row
-- went, the image stayed public in Storage for ever. Removing the row in
-- storage.objects takes the object out of the API's reach.
create or replace function public.delete_worker(p_phone text, p_pin text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  wid  uuid;
  urls text[];
  u    text;
  obj  text;
begin
  select w.id, array_remove(array[w.selfie, w.thumb], null)
    into wid, urls
    from workers w
    join worker_secrets s on s.worker_id = w.id
   where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then
    raise exception 'Wrong phone number or PIN';
  end if;

  if exists (select 1 from information_schema.tables
              where table_schema = 'storage' and table_name = 'objects') then
    foreach u in array coalesce(urls, '{}'::text[]) loop
      obj := substring(u from '/object/public/selfies/(.+)$');
      if obj is not null then
        execute 'delete from storage.objects where bucket_id = ''selfies'' and name = $1'
          using obj;
      end if;
    end loop;
  end if;

  -- worker_secrets, worker_ratings and worker_reports cascade
  delete from workers where id = wid;
end;
$$;

-- ---------- 10.8 reporting a profile ----------
-- The IT Rules require a route for complaining about what is on the platform,
-- and a marketplace that sends strangers to people's homes needs one whether
-- the rules ask or not.
create table if not exists public.worker_reports (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  worker_id  uuid references public.workers(id) on delete cascade,
  reason     text not null,
  details    text,
  contact    text,
  handled    boolean not null default false
);
alter table public.worker_reports enable row level security;
drop policy if exists "anyone can report a profile" on public.worker_reports;
create policy "anyone can report a profile"
  on public.worker_reports for insert with check (true);
-- no select policy: reports are read through the PIN-gated function below

create or replace function public.admin_reports(p_pin text)
returns table (id bigint, created_at timestamptz, worker_id uuid, worker_name text,
               worker_phone text, reason text, details text, contact text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.admin_check(p_pin) then
    raise exception 'Wrong admin PIN';
  end if;
  return query
    select r.id, r.created_at, r.worker_id, w.name, w.phone, r.reason, r.details, r.contact
      from worker_reports r
      left join workers w on w.id = r.worker_id
     where not r.handled
     order by r.created_at desc
     limit 200;
end;
$$;

create or replace function public.admin_clear_report(p_pin text, p_id bigint)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.admin_check(p_pin) then
    raise exception 'Wrong admin PIN';
  end if;
  update worker_reports set handled = true where id = p_id;
end;
$$;

-- ---------- 10.9 the consent the privacy policy describes is recorded ----------
-- The DPDP Act wants consent that is specific, informed and demonstrable.
-- "Demonstrable" means it has to be written down somewhere.
alter table public.workers add column if not exists terms_version text;
alter table public.workers add column if not exists consent_at    timestamptz;
alter table public.workers add column if not exists age_confirmed boolean not null default false;

-- ---------- 10.10 the retention periods are enforced ----------
-- The privacy policy promises booking records for 12 months and rejected
-- profiles for 90 days. Until now nothing deleted either.
-- Dropped first every time: later migrations widen this function's return
-- type, and on a re-run CREATE OR REPLACE cannot change it back.
drop function if exists public.purge_expired_data();

create function public.purge_expired_data()
returns table (bookings_removed bigint, rejected_removed bigint, contacts_removed bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare b bigint; r bigint; c bigint;
begin
  delete from bookings where created_at < now() - interval '12 months';
  get diagnostics b = row_count;

  delete from workers
   where status = 'rejected'
     and coalesce(reviewed_at, created_at) < now() - interval '90 days';
  get diagnostics r = row_count;

  delete from contact_requests where created_at < now() - interval '90 days';
  get diagnostics c = row_count;

  return query select b, r, c;
end;
$$;
revoke all on function public.purge_expired_data() from public;

-- Run it nightly where pg_cron exists (it does on Supabase). Harmless
-- elsewhere: the block simply reports that it skipped.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule('nearse-retention')
        where exists (select 1 from cron.job where jobname = 'nearse-retention');
      perform cron.schedule('nearse-retention', '30 19 * * *', 'select public.purge_expired_data()');
    exception when others then
      raise notice 'pg_cron present but not schedulable here (%) — run purge_expired_data() by hand', sqlerrm;
    end;
  else
    raise notice 'no pg_cron — call purge_expired_data() from a scheduled job instead';
  end if;
end $$;

-- ---------- 10.11 search stops returning phone numbers ----------
-- The browse list never displayed the number; it was only there so the
-- WhatsApp link could be built. That now happens through
-- request_worker_contact, one worker at a time.
drop function if exists public.search_workers(double precision, double precision, text, text[], text, text, int, int);

create function public.search_workers(
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_q          text             default null,
  p_cat_skills text[]           default null,
  p_area       text             default null,
  p_city       text             default 'Guwahati',
  p_limit      int              default 20,
  p_offset     int              default 0
)
returns table (
  id           uuid,
  name         text,
  selfie       text,
  thumb        text,
  city         text,
  area         text,
  about        text,
  skills       jsonb,
  rating_sum   int,
  rating_count int,
  distance_km  double precision,
  total_count  bigint
)
language sql stable security definer set search_path = public, extensions as $$
  with base as (
    select w.*,
           lower(w.name || ' ' || coalesce(w.area,'') || ' ' || coalesce(w.city,'') || ' ' ||
                 coalesce(w.skills::text,'')) as hay,
           case when p_lat is null or w.lat is null then null else
             6371 * 2 * asin(sqrt(
               power(sin(radians(w.lat - p_lat) / 2), 2) +
               cos(radians(p_lat)) * cos(radians(w.lat)) *
               power(sin(radians(w.lng - p_lng) / 2), 2)))
           end as dist
      from workers w
     where w.status = 'approved'
       and w.available
       and (p_city is null or w.city = p_city)
       and (p_area is null or w.area = p_area)
       and (p_cat_skills is null or exists (
             select 1 from jsonb_array_elements(w.skills) s
              where s->>'skill' = any(p_cat_skills)))
  ),
  hit as (
    select * from base b
     where p_q is null or btrim(p_q) = '' or (
       select bool_and(b.hay like '%' || word || '%')
         from unnest(string_to_array(lower(btrim(p_q)), ' ')) word
        where word <> '')
  )
  select h.id, h.name, h.selfie, h.thumb, h.city, h.area, h.about, h.skills,
         h.rating_sum, h.rating_count, h.dist,
         count(*) over () as total_count
    from hit h
   order by
     case when h.dist is null then 1 else 0 end,
     round(coalesce(h.dist, 0)::numeric, 1),
     case when h.rating_count = 0 then 3.4
          else h.rating_sum::numeric / h.rating_count end desc,
     h.created_at desc
   limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;

-- ---------- 10.12 registration records consent ----------
create or replace function public.register_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_id uuid; jwt_phone text; need_otp boolean;
begin
  if exists (select 1 from workers where phone = p_phone) then
    raise exception 'This phone number is already registered — please sign in';
  end if;
  if p_pin !~ '^\d{4}$' then raise exception 'PIN must be exactly 4 digits'; end if;
  if p_phone !~ '^[6-9]\d{9}$' then raise exception 'Enter a valid 10-digit Indian mobile number'; end if;
  perform check_rate_bands(p_data->'skills');

  select require_phone_otp into need_otp from nearse_config where id = 1;
  jwt_phone := regexp_replace(
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'phone', ''), '\D', '', 'g');
  if length(jwt_phone) > 10 then jwt_phone := right(jwt_phone, 10); end if;
  if coalesce(need_otp,false) and jwt_phone = '' then
    raise exception 'Please verify your WhatsApp number first';
  end if;
  if jwt_phone <> '' and jwt_phone <> p_phone then
    raise exception 'Verify the same number you are registering with';
  end if;

  insert into workers (name, phone, selfie, thumb, city, area, about, lat, lng, skills,
                       available, phone_verified, terms_version, consent_at, age_confirmed)
  values (coalesce(p_data->>'name',''), p_phone, p_data->>'selfie', p_data->>'thumb',
          p_data->>'city', p_data->>'area', p_data->>'about',
          (p_data->>'lat')::double precision, (p_data->>'lng')::double precision,
          coalesce(p_data->'skills','[]'::jsonb),
          coalesce((p_data->>'available')::boolean, true), jwt_phone <> '',
          nullif(p_data->>'terms_version',''),
          case when coalesce((p_data->>'age_confirmed')::boolean, false) then now() end,
          coalesce((p_data->>'age_confirmed')::boolean, false))
  returning id into new_id;
  insert into worker_secrets (worker_id, pin_hash, email, wa_code)
    values (new_id, crypt(p_pin, gen_salt('bf')),
            nullif(btrim(coalesce(p_data->>'email','')), ''),
            nullif(btrim(coalesce(p_data->>'wa_code','')), ''));
  return query select * from workers where id = new_id;
end;
$$;

-- ---------- 10.13 explicit grants for the tables added above ----------
-- Supabase's default privileges usually cover a new table in `public`, but
-- "usually" is not good enough for the one path a customer uses to report an
-- unsafe profile: if the grant were missing, the report would fail with a
-- permission error and nobody would find out. Stated outright instead.
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      -- reports are insert-only; reading them needs the admin function
      execute format('grant insert on public.worker_reports to %I', r);
      execute format('grant usage, select on sequence public.worker_reports_id_seq to %I', r);
      -- everything else here is reachable only through security-definer
      -- functions, so the tables themselves stay closed
      execute format('revoke select, update, delete on public.worker_reports from %I', r);
      execute format('revoke all on public.contact_requests from %I', r);
      execute format('revoke all on public.worker_ratings   from %I', r);
      execute format('revoke all on public.worker_secrets   from %I', r);
      execute format('revoke all on public.nearse_admin     from %I', r);
      -- the functions the app calls
      execute format('grant execute on function public.phone_taken(text) to %I', r);
      execute format('grant execute on function public.request_worker_contact(uuid, text) to %I', r);
      execute format('grant execute on function public.rate_worker(uuid, int, text) to %I', r);
    end if;
  end loop;
end $$;

-- ============================================================
-- MIGRATION 11 — booking modes: instant dispatch, slots, punctuality
--
-- One booking flow never fitted 155 trades, and the mismatch was doing real
-- damage. A customer could pick "Monday 9 am" for a worker who had never
-- agreed to it, and nothing in the system ever asked the worker whether they
-- were coming. The appointment existed only in the customer's head, and when
-- nobody arrived it was the app that looked useless.
--
-- So a service now declares how it is booked:
--
--   now    offered to the nearest available worker, who has 60 seconds to
--          accept before it moves to the next one, and the next
--   slot    the worker publishes a working day and customers take a slot
--   sched   a date the customer proposes and the worker confirms
--   hire    an enquiry about ongoing work, with no arrival time at all
--
-- The important part is not the dispatch. It is that "accepted" now means a
-- worker pressed a button, and punctuality is measured and published.
-- ============================================================

-- ---------- 11.1 what a worker brings to these modes ----------
alter table public.workers add column if not exists reg_council   int;
alter table public.workers add column if not exists reg_number    text;
alter table public.workers add column if not exists reg_verified  boolean not null default false;
alter table public.workers add column if not exists availability  jsonb;
alter table public.workers add column if not exists online_until  timestamptz;
alter table public.workers add column if not exists on_time_yes   int not null default 0;
alter table public.workers add column if not exists on_time_total int not null default 0;

-- Push endpoints are contact details, so they live where nothing public can
-- reach them, same as the PIN hash.
create table if not exists public.worker_push (
  worker_id  uuid primary key references public.workers(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  updated_at timestamptz not null default now()
);
alter table public.worker_push enable row level security;
-- no policies: written through a PIN-checked function, read only by the dispatcher

create or replace function public.save_push_subscription(
  p_phone text, p_pin text, p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare wid uuid;
begin
  select w.id into wid from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;

  insert into worker_push (worker_id, endpoint, p256dh, auth)
  values (wid, p_endpoint, p_p256dh, p_auth)
  on conflict (worker_id) do update
    set endpoint = excluded.endpoint, p256dh = excluded.p256dh,
        auth = excluded.auth, updated_at = now();
end;
$$;

-- The VAPID public key is not a secret — the browser needs it to subscribe.
-- The private half never comes near this repository; CI writes it straight
-- into the Edge Function's own secrets.
alter table public.nearse_config add column if not exists vapid_public text;

-- "Available now" is deliberately short-lived. A worker who forgets to switch
-- off would otherwise sit at the top of every instant search all week and
-- decline everything, which is worse for customers than not being listed.
create or replace function public.set_online(p_phone text, p_pin text, p_minutes int default 240)
returns timestamptz
language plpgsql security definer set search_path = public, extensions as $$
declare wid uuid; until timestamptz;
begin
  select w.id into wid from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;

  until := case when coalesce(p_minutes,0) <= 0 then null
                else now() + make_interval(mins => least(p_minutes, 720)) end;
  update workers set online_until = until where id = wid;
  return until;
end;
$$;

-- ---------- 11.2 instant jobs ----------
create table if not exists public.jobs (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  code           text not null unique,
  skill          text not null,
  city           text,
  area           text,
  lat            double precision,
  lng            double precision,
  customer_name  text not null,
  customer_phone text not null,
  note           text,
  status         text not null default 'searching',   -- searching|accepted|nobody|cancelled|done
  worker_id      uuid references public.workers(id) on delete set null,
  accepted_at    timestamptz,
  eta_minutes    int,
  asked_count    int not null default 0,
  search_until   timestamptz not null
);
create index if not exists jobs_open_idx on public.jobs (status, search_until);

create table if not exists public.job_offers (
  id         bigserial primary key,
  job_id     uuid not null references public.jobs(id) on delete cascade,
  worker_id  uuid not null references public.workers(id) on delete cascade,
  rank       int  not null,
  sent_at    timestamptz not null default now(),
  expires_at timestamptz not null,
  status     text not null default 'pending',         -- pending|accepted|declined|expired
  notified   text,                                     -- push|whatsapp|none
  unique (job_id, worker_id)
);
create index if not exists job_offers_pending_idx on public.job_offers (status, expires_at);

alter table public.jobs       enable row level security;
alter table public.job_offers enable row level security;
-- no policies on either: everything goes through the functions below, so a
-- customer's name and number are never sitting in a readable table

-- Who to ask next. Online workers first — they are the ones who can actually
-- leave now — then nearest, then best rated. Anyone already asked is skipped,
-- so a search never loops back to someone who let it expire.
create or replace function public.next_job_candidate(p_job uuid)
returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select w.id
    from workers w, jobs j
   where j.id = p_job
     and w.status = 'approved'
     and w.available
     and (j.city is null or w.city = j.city)
     and exists (select 1 from jsonb_array_elements(w.skills) s
                  where s->>'skill' = j.skill)
     and not exists (select 1 from job_offers o
                      where o.job_id = j.id and o.worker_id = w.id)
   order by
     (w.online_until is not null and w.online_until > now()) desc,
     case when j.lat is null or w.lat is null then 1e6 else
       6371 * 2 * asin(sqrt(
         power(sin(radians(w.lat - j.lat) / 2), 2) +
         cos(radians(j.lat)) * cos(radians(w.lat)) *
         power(sin(radians(w.lng - j.lng) / 2), 2)))
     end,
     case when w.rating_count = 0 then 3.4
          else w.rating_sum::numeric / w.rating_count end desc,
     w.created_at
   limit 1;
$$;

-- Make the next offer, or close the job if nobody is left to ask.
create or replace function public.offer_next(p_job uuid, p_seconds int default 60)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare cand uuid; n int;
begin
  select next_job_candidate(p_job) into cand;
  if cand is null then
    update jobs set status = 'nobody' where id = p_job and status = 'searching';
    return null;
  end if;
  select count(*) into n from job_offers where job_id = p_job;
  insert into job_offers (job_id, worker_id, rank, expires_at)
    values (p_job, cand, n + 1, now() + make_interval(secs => greatest(20, least(p_seconds, 300))));
  update jobs set asked_count = n + 1 where id = p_job;
  return cand;
end;
$$;

create or replace function public.create_job(
  p_skill text, p_name text, p_phone text, p_area text, p_note text default null,
  p_lat double precision default null, p_lng double precision default null,
  p_city text default 'Guwahati', p_minutes int default 20)
returns table (code text, worker_id uuid, asked int)
language plpgsql security definer set search_path = public, extensions as $$
declare jid uuid; c text; cand uuid;
begin
  if p_phone !~ '^[6-9]\d{9}$' then
    raise exception 'Enter a valid 10-digit mobile number';
  end if;
  if btrim(coalesce(p_name,'')) = '' then
    raise exception 'Please enter your name';
  end if;

  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from jobs where jobs.code = c);
  end loop;

  insert into jobs (code, skill, city, area, lat, lng, customer_name, customer_phone, note, search_until)
  values (c, p_skill, p_city, p_area, p_lat, p_lng, btrim(p_name), p_phone, nullif(btrim(coalesce(p_note,'')),''),
          now() + make_interval(mins => greatest(2, least(p_minutes, 60))))
  returning id into jid;

  cand := offer_next(jid, 60);
  return query select c, cand, (select asked_count from jobs where id = jid);
end;
$$;

-- What the customer's screen polls. The code is the only thing that opens it,
-- which is why it is six characters of randomness and the job dies in an hour.
-- Migration 13 widens this return type, and the whole file is re-applied on
-- every deploy, so the old shape has to go before it is written back.
drop function if exists public.job_state(text);

create function public.job_state(p_code text)
returns table (status text, asked int, worker_name text, worker_phone text,
               worker_area text, eta_minutes int, seconds_left int, skill text)
language sql stable security definer set search_path = public, extensions as $$
  select j.status, j.asked_count, w.name, 
         case when j.status = 'accepted' then w.phone else null end,
         w.area, j.eta_minutes,
         greatest(0, extract(epoch from (
           coalesce((select o.expires_at from job_offers o
                      where o.job_id = j.id and o.status = 'pending'
                      order by o.rank desc limit 1), j.search_until) - now()))::int),
         j.skill
    from jobs j left join workers w on w.id = j.worker_id
   where j.code = upper(btrim(p_code));
$$;

create or replace function public.cancel_job(p_code text)
returns void
language sql security definer set search_path = public, extensions as $$
  update jobs set status = 'cancelled'
   where code = upper(btrim(p_code)) and status = 'searching';
$$;

-- The worker's side: what am I being offered right now?
create or replace function public.my_offers(p_phone text, p_pin text)
returns table (code text, skill text, area text, note text, customer_name text,
               distance_km double precision, seconds_left int, price int, unit text)
language plpgsql security definer set search_path = public, extensions as $$
declare wid uuid;
begin
  select w.id into wid from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;

  return query
    select j.code, j.skill, j.area, j.note, j.customer_name,
           case when j.lat is null or w.lat is null then null else
             6371 * 2 * asin(sqrt(
               power(sin(radians(w.lat - j.lat) / 2), 2) +
               cos(radians(j.lat)) * cos(radians(w.lat)) *
               power(sin(radians(w.lng - j.lng) / 2), 2)))
           end,
           greatest(0, extract(epoch from (o.expires_at - now()))::int),
           (sk->>'price')::int, sk->>'unit'
      from job_offers o
      join jobs j on j.id = o.job_id
      join workers w on w.id = o.worker_id
      left join lateral (
        select s from jsonb_array_elements(w.skills) s where s->>'skill' = j.skill limit 1
      ) x(sk) on true
     where o.worker_id = wid
       and o.status = 'pending'
       and o.expires_at > now()
       and j.status = 'searching'
     order by o.sent_at;
end;
$$;

-- Accepting is the whole point: it is the first moment anybody has actually
-- agreed to come. The worker commits to an arrival window at the same time.
create or replace function public.accept_offer(p_phone text, p_pin text, p_code text, p_eta int default 30)
returns table (customer_name text, customer_phone text, area text, note text, skill text)
language plpgsql security definer set search_path = public, extensions as $$
declare wid uuid; jid uuid;
begin
  select w.id into wid from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;

  select j.id into jid from jobs j where j.code = upper(btrim(p_code)) for update;
  if jid is null then raise exception 'That job no longer exists'; end if;

  if not exists (select 1 from job_offers o
                  where o.job_id = jid and o.worker_id = wid
                    and o.status = 'pending' and o.expires_at > now()) then
    raise exception 'That job has already gone to someone else';
  end if;
  if (select status from jobs where id = jid) <> 'searching' then
    raise exception 'That job has already gone to someone else';
  end if;

  update job_offers set status = 'accepted' where job_id = jid and worker_id = wid;
  update job_offers set status = 'expired'
   where job_id = jid and worker_id <> wid and status = 'pending';
  update jobs set status = 'accepted', worker_id = wid, accepted_at = now(),
                  eta_minutes = greatest(5, least(coalesce(p_eta, 30), 240))
   where id = jid;

  return query select j.customer_name, j.customer_phone, j.area, j.note, j.skill
                 from jobs j where j.id = jid;
end;
$$;

create or replace function public.decline_offer(p_phone text, p_pin text, p_code text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare wid uuid; jid uuid;
begin
  select w.id into wid from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;

  select id into jid from jobs where code = upper(btrim(p_code));
  if jid is null then return; end if;

  update job_offers set status = 'declined'
   where job_id = jid and worker_id = wid and status = 'pending';
  -- move straight on rather than making the customer wait out the 60 seconds
  if (select status from jobs where id = jid) = 'searching' then
    perform offer_next(jid, 60);
  end if;
end;
$$;

-- The clock. Runs every minute from pg_cron, and is also called by the
-- customer's own screen while it waits, so a search advances promptly even
-- if cron is a few seconds away.
create or replace function public.advance_jobs()
returns int
language plpgsql security definer set search_path = public, extensions as $$
declare j record; moved int := 0;
begin
  update job_offers set status = 'expired'
   where status = 'pending' and expires_at <= now();

  for j in select id from jobs
            where status = 'searching' and search_until > now()
              and not exists (select 1 from job_offers o
                               where o.job_id = jobs.id and o.status = 'pending')
  loop
    perform offer_next(j.id, 60);
    moved := moved + 1;
  end loop;

  update jobs set status = 'nobody'
   where status = 'searching' and search_until <= now();
  return moved;
end;
$$;

-- ---------- 11.3 appointment slots ----------
create table if not exists public.appointments (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  worker_id      uuid not null references public.workers(id) on delete cascade,
  skill          text not null,
  slot_date      date not null,
  slot_time      text not null,
  customer_name  text not null,
  customer_phone text not null,
  note           text,
  status         text not null default 'booked',       -- booked|cancelled|done
  unique (worker_id, slot_date, slot_time)
);
alter table public.appointments enable row level security;
-- no policies: booked times come back through the function below, which
-- returns times only and never who booked them

create or replace function public.taken_slots(p_worker uuid, p_date date)
returns table (slot_time text)
language sql stable security definer set search_path = public, extensions as $$
  select a.slot_time from appointments a
   where a.worker_id = p_worker and a.slot_date = p_date and a.status = 'booked';
$$;

create or replace function public.book_slot(
  p_worker uuid, p_skill text, p_date date, p_time text,
  p_name text, p_phone text, p_note text default null)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare num text;
begin
  if p_phone !~ '^[6-9]\d{9}$' then
    raise exception 'Enter a valid 10-digit mobile number';
  end if;
  if p_date < current_date then
    raise exception 'That day has already passed';
  end if;
  select phone into num from workers
   where id = p_worker and status = 'approved' and available;
  if num is null then raise exception 'That worker is not taking appointments'; end if;

  begin
    insert into appointments (worker_id, skill, slot_date, slot_time, customer_name, customer_phone, note)
    values (p_worker, p_skill, p_date, p_time, btrim(p_name), p_phone,
            nullif(btrim(coalesce(p_note,'')),''));
  exception when unique_violation then
    raise exception 'Someone has just taken that time — please choose another';
  end;
  return num;
end;
$$;

create or replace function public.my_appointments(p_phone text, p_pin text)
returns table (id uuid, skill text, slot_date date, slot_time text,
               customer_name text, customer_phone text, note text, status text)
language plpgsql security definer set search_path = public, extensions as $$
declare wid uuid;
begin
  select w.id into wid from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;

  return query
    select a.id, a.skill, a.slot_date, a.slot_time, a.customer_name,
           a.customer_phone, a.note, a.status
      from appointments a
     where a.worker_id = wid and a.slot_date >= current_date - 1
     order by a.slot_date, a.slot_time;
end;
$$;

-- ---------- 11.4 punctuality ----------
-- Kept apart from the quality stars on purpose. "Good work" and "turned up
-- when he said he would" are different promises, and in Guwahati it is the
-- second one that decides whether somebody keeps the app.
create table if not exists public.punctuality_votes (
  job_code   text primary key,
  worker_id  uuid not null references public.workers(id) on delete cascade,
  on_time    boolean not null,
  created_at timestamptz not null default now()
);
alter table public.punctuality_votes enable row level security;

create or replace function public.rate_punctuality(p_code text, p_on_time boolean)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare wid uuid; c text;
begin
  c := upper(btrim(p_code));
  select worker_id into wid from jobs where code = c and status in ('accepted','done');
  if wid is null then raise exception 'That job cannot be rated'; end if;
  if exists (select 1 from punctuality_votes where job_code = c) then return; end if;

  insert into punctuality_votes (job_code, worker_id, on_time) values (c, wid, p_on_time);
  update workers
     set on_time_total = on_time_total + 1,
         on_time_yes   = on_time_yes + case when p_on_time then 1 else 0 end,
         status = status
   where id = wid;
  update jobs set status = 'done' where code = c and status = 'accepted';
end;
$$;

-- ---------- 11.5 search carries what the new modes need ----------
drop function if exists public.search_workers(double precision, double precision, text, text[], text, text, int, int);

create function public.search_workers(
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_q          text             default null,
  p_cat_skills text[]           default null,
  p_area       text             default null,
  p_city       text             default 'Guwahati',
  p_limit      int              default 20,
  p_offset     int              default 0
)
returns table (
  id            uuid,
  name          text,
  selfie        text,
  thumb         text,
  city          text,
  area          text,
  about         text,
  skills        jsonb,
  rating_sum    int,
  rating_count  int,
  on_time_yes   int,
  on_time_total int,
  availability  jsonb,
  is_online     boolean,
  reg_number    text,
  reg_verified  boolean,
  distance_km   double precision,
  total_count   bigint
)
language sql stable security definer set search_path = public, extensions as $$
  with base as (
    select w.*,
           lower(w.name || ' ' || coalesce(w.area,'') || ' ' || coalesce(w.city,'') || ' ' ||
                 coalesce(w.skills::text,'')) as hay,
           case when p_lat is null or w.lat is null then null else
             6371 * 2 * asin(sqrt(
               power(sin(radians(w.lat - p_lat) / 2), 2) +
               cos(radians(p_lat)) * cos(radians(w.lat)) *
               power(sin(radians(w.lng - p_lng) / 2), 2)))
           end as dist
      from workers w
     where w.status = 'approved'
       and w.available
       and (p_city is null or w.city = p_city)
       and (p_area is null or w.area = p_area)
       and (p_cat_skills is null or exists (
             select 1 from jsonb_array_elements(w.skills) s
              where s->>'skill' = any(p_cat_skills)))
  ),
  hit as (
    select * from base b
     where p_q is null or btrim(p_q) = '' or (
       select bool_and(b.hay like '%' || word || '%')
         from unnest(string_to_array(lower(btrim(p_q)), ' ')) word
        where word <> '')
  )
  select h.id, h.name, h.selfie, h.thumb, h.city, h.area, h.about, h.skills,
         h.rating_sum, h.rating_count, h.on_time_yes, h.on_time_total,
         h.availability,
         (h.online_until is not null and h.online_until > now()),
         h.reg_number, h.reg_verified,
         h.dist,
         count(*) over () as total_count
    from hit h
   order by
     (h.online_until is not null and h.online_until > now()) desc,
     case when h.dist is null then 1 else 0 end,
     round(coalesce(h.dist, 0)::numeric, 1),
     case when h.rating_count = 0 then 3.4
          else h.rating_sum::numeric / h.rating_count end desc,
     h.created_at desc
   limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;

-- ---------- 11.6 registration numbers and calendars are saved ----------
create or replace function public.update_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  wid uuid; is_edit boolean; identity_changed boolean; reg_changed boolean;
begin
  select w.id into wid from workers w
  join worker_secrets s on s.worker_id = w.id
  where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;
  if p_data ? 'skills' then perform check_rate_bands(p_data->'skills'); end if;

  is_edit := (p_data ?| array['name','selfie','area','about','skills']);

  select (p_data->>'name'   is not null and p_data->>'name'   is distinct from w.name)
      or (p_data->>'selfie' is not null and p_data->>'selfie' is distinct from w.selfie),
         (p_data->>'reg_number' is not null and p_data->>'reg_number' is distinct from w.reg_number)
    into identity_changed, reg_changed
    from workers w where w.id = wid;

  update workers set
    name = coalesce(p_data->>'name', name),
    selfie = coalesce(p_data->>'selfie', selfie),
    thumb = coalesce(p_data->>'thumb', thumb),
    city = coalesce(p_data->>'city', city),
    area = coalesce(p_data->>'area', area),
    about = coalesce(p_data->>'about', about),
    lat = coalesce((p_data->>'lat')::double precision, lat),
    lng = coalesce((p_data->>'lng')::double precision, lng),
    skills = coalesce(p_data->'skills', skills),
    available = coalesce((p_data->>'available')::boolean, available),
    reg_council = case when p_data ? 'reg_council' then (p_data->>'reg_council')::int else reg_council end,
    reg_number  = case when p_data ? 'reg_number'  then nullif(btrim(p_data->>'reg_number'),'') else reg_number end,
    -- a changed registration number is unverified until a person checks it again
    reg_verified = case when reg_changed then false else reg_verified end,
    availability = case when p_data ? 'availability' then p_data->'availability' else availability end,
    status = case
               when identity_changed or reg_changed then 'pending'
               when is_edit and status = 'rejected' then 'pending'
               else status
             end,
    review_note = case
               when identity_changed or reg_changed then null
               when is_edit and status = 'rejected' then null
               else review_note
             end
  where id = wid;
  return query select * from workers where id = wid;
end;
$$;

create or replace function public.register_worker(p_phone text, p_pin text, p_data jsonb)
returns setof public.workers
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_id uuid; jwt_phone text; need_otp boolean;
begin
  if exists (select 1 from workers where phone = p_phone) then
    raise exception 'This phone number is already registered — please sign in';
  end if;
  if p_pin !~ '^\d{4}$' then raise exception 'PIN must be exactly 4 digits'; end if;
  if p_phone !~ '^[6-9]\d{9}$' then raise exception 'Enter a valid 10-digit Indian mobile number'; end if;
  perform check_rate_bands(p_data->'skills');

  select require_phone_otp into need_otp from nearse_config where id = 1;
  jwt_phone := regexp_replace(
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'phone', ''), '\D', '', 'g');
  if length(jwt_phone) > 10 then jwt_phone := right(jwt_phone, 10); end if;
  if coalesce(need_otp,false) and jwt_phone = '' then
    raise exception 'Please verify your WhatsApp number first';
  end if;
  if jwt_phone <> '' and jwt_phone <> p_phone then
    raise exception 'Verify the same number you are registering with';
  end if;

  insert into workers (name, phone, selfie, thumb, city, area, about, lat, lng, skills,
                       available, phone_verified, terms_version, consent_at, age_confirmed,
                       reg_council, reg_number, availability)
  values (coalesce(p_data->>'name',''), p_phone, p_data->>'selfie', p_data->>'thumb',
          p_data->>'city', p_data->>'area', p_data->>'about',
          (p_data->>'lat')::double precision, (p_data->>'lng')::double precision,
          coalesce(p_data->'skills','[]'::jsonb),
          coalesce((p_data->>'available')::boolean, true), jwt_phone <> '',
          nullif(p_data->>'terms_version',''),
          case when coalesce((p_data->>'age_confirmed')::boolean, false) then now() end,
          coalesce((p_data->>'age_confirmed')::boolean, false),
          (p_data->>'reg_council')::int,
          nullif(btrim(coalesce(p_data->>'reg_number','')),''),
          p_data->'availability')
  returning id into new_id;
  insert into worker_secrets (worker_id, pin_hash, email, wa_code)
    values (new_id, crypt(p_pin, gen_salt('bf')),
            nullif(btrim(coalesce(p_data->>'email','')), ''),
            nullif(btrim(coalesce(p_data->>'wa_code','')), ''));
  return query select * from workers where id = new_id;
end;
$$;

-- The admin marks a registration number as actually checked against the
-- council's register. Nothing else in the app can set this.
create or replace function public.admin_verify_registration(p_pin text, p_id uuid, p_ok boolean)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.admin_check(p_pin) then raise exception 'Wrong admin PIN'; end if;
  update workers set reg_verified = p_ok where id = p_id;
end;
$$;

-- ---------- 11.7 housekeeping ----------
-- Dropped first every time: later migrations widen this function's return
-- type, and on a re-run CREATE OR REPLACE cannot change it back.
drop function if exists public.purge_expired_data();

create function public.purge_expired_data()
returns table (bookings_removed bigint, rejected_removed bigint, contacts_removed bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare b bigint; r bigint; c bigint;
begin
  delete from bookings where created_at < now() - interval '12 months';
  get diagnostics b = row_count;

  delete from workers
   where status = 'rejected'
     and coalesce(reviewed_at, created_at) < now() - interval '90 days';
  get diagnostics r = row_count;

  delete from contact_requests where created_at < now() - interval '90 days';
  get diagnostics c = row_count;

  -- instant jobs carry a customer's name and number and are worthless after
  -- the job is over; appointments follow the same 12 months as bookings
  delete from jobs where created_at < now() - interval '12 months';
  delete from appointments where slot_date < current_date - 365;

  -- a worker who stopped using the app should not stay "available now"
  update workers set online_until = null
   where online_until is not null and online_until < now() - interval '1 day';

  return query select b, r, c;
end;
$$;
revoke all on function public.purge_expired_data() from public;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule('nearse-dispatch')
        where exists (select 1 from cron.job where jobname = 'nearse-dispatch');
      perform cron.schedule('nearse-dispatch', '* * * * *', 'select public.advance_jobs()');
    exception when others then
      raise notice 'pg_cron present but not schedulable here (%) — instant dispatch will rely on the customer''s screen to advance', sqlerrm;
    end;
  else
    raise notice 'no pg_cron — instant dispatch advances from the customer''s open screen only';
  end if;
end $$;

-- ---------- 11.8 the private tables are not merely empty to the public ----------
-- Row level security with no policy already returns nothing, but the tables
-- stay visible through the REST API, advertising their existence and column
-- names. Nothing outside the functions above needs them at all, so the
-- privilege goes too. worker_reports keeps INSERT: that is the report form.
do $$
declare r text; t text;
begin
  foreach r in array array['anon','authenticated'] loop
    if not exists (select 1 from pg_roles where rolname = r) then continue; end if;
    foreach t in array array['jobs','job_offers','appointments','worker_push',
                             'punctuality_votes','worker_ratings','contact_requests',
                             'worker_secrets','nearse_admin'] loop
      execute format('revoke all on public.%I from %I', t, r);
    end loop;
    execute format('revoke all on public.worker_reports from %I', r);
    execute format('grant insert on public.worker_reports to %I', r);
    execute format('grant usage, select on sequence public.worker_reports_id_seq to %I', r);
  end loop;
end $$;

-- ============================================================
-- MIGRATION 12 — numbers for the admin screen
--
-- The admin screen could approve profiles and nothing else, so there was no
-- way to answer "how is this going". Everything below is derived from rows
-- that already exist; nothing new is recorded about anybody.
--
-- One honest limit, stated here because the screen states it too: a booking
-- that goes out over WhatsApp leaves no completion signal. Repto sees the
-- request leave and never learns what happened. Only instant-dispatch jobs
-- and appointments carry a real "done", so the screen reports those as
-- completions and counts ratings separately as the softer evidence that a
-- job actually happened.
-- ============================================================

create index if not exists bookings_created_idx     on public.bookings (created_at desc);
create index if not exists workers_created_idx      on public.workers (created_at desc);
create index if not exists jobs_created_idx         on public.jobs (created_at desc);
create index if not exists appointments_created_idx on public.appointments (created_at desc);
create index if not exists ratings_created_idx      on public.worker_ratings (created_at desc);

create or replace function public.admin_stats(p_pin text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  -- everything is reported in Indian time; "today" means today in Guwahati,
  -- not today in UTC, which is five and a half hours out and would make the
  -- morning's numbers look like yesterday's
  d0 timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  d7 timestamptz := d0 - interval '6 days';
  d30 timestamptz := d0 - interval '29 days';
  out jsonb;
begin
  if not public.admin_check(p_pin) then
    raise exception 'Wrong admin PIN';
  end if;

  select jsonb_build_object(

    'generated_at', now(),
    'day_start', d0,

    ---------------------------------------------------------------- people
    'workers', (select jsonb_build_object(
        'total',        count(*),
        'approved',     count(*) filter (where status = 'approved'),
        'pending',      count(*) filter (where status = 'pending'),
        'rejected',     count(*) filter (where status = 'rejected'),
        'available',    count(*) filter (where status = 'approved' and available),
        'online',       count(*) filter (where status = 'approved' and online_until > now()),
        'today',        count(*) filter (where created_at >= d0),
        'last7',        count(*) filter (where created_at >= d7),
        'last30',       count(*) filter (where created_at >= d30),
        'verified',     count(*) filter (where phone_verified),
        'with_photo',   count(*) filter (where selfie is not null),
        'consented',    count(*) filter (where consent_at is not null)
      ) from workers),

    ---------------------------------------------------------------- demand
    -- a "request" is any of the three ways a customer reaches a worker
    'requests', (select jsonb_build_object(
        'today',  (select count(*) from bookings     where created_at >= d0)
                + (select count(*) from jobs         where created_at >= d0)
                + (select count(*) from appointments where created_at >= d0),
        'last7',  (select count(*) from bookings     where created_at >= d7)
                + (select count(*) from jobs         where created_at >= d7)
                + (select count(*) from appointments where created_at >= d7),
        'last30', (select count(*) from bookings     where created_at >= d30)
                + (select count(*) from jobs         where created_at >= d30)
                + (select count(*) from appointments where created_at >= d30),
        'total',  (select count(*) from bookings)
                + (select count(*) from jobs)
                + (select count(*) from appointments)
      )),

    'whatsapp_requests', (select jsonb_build_object(
        'today', count(*) filter (where created_at >= d0),
        'last7', count(*) filter (where created_at >= d7),
        'last30', count(*) filter (where created_at >= d30),
        'total', count(*)
      ) from bookings),

    'instant_jobs', (select jsonb_build_object(
        'today',     count(*) filter (where created_at >= d0),
        'last7',     count(*) filter (where created_at >= d7),
        'last30',    count(*) filter (where created_at >= d30),
        'total',     count(*),
        'searching', count(*) filter (where status = 'searching' and search_until > now()),
        'accepted',  count(*) filter (where status = 'accepted'),
        'done',      count(*) filter (where status = 'done'),
        'nobody',    count(*) filter (where status = 'nobody'),
        'cancelled', count(*) filter (where status = 'cancelled'),
        -- how long a customer waits before somebody says yes
        'avg_accept_seconds', (select round(avg(extract(epoch from (accepted_at - created_at))))
                                 from jobs
                                where accepted_at is not null
                                  and accepted_at >= created_at
                                  and created_at >= d30)
      ) from jobs),

    'appointments', (select jsonb_build_object(
        'today',     count(*) filter (where created_at >= d0),
        'last7',     count(*) filter (where created_at >= d7),
        'last30',    count(*) filter (where created_at >= d30),
        'total',     count(*),
        'booked',    count(*) filter (where status = 'booked'),
        'done',      count(*) filter (where status = 'done'),
        'cancelled', count(*) filter (where status = 'cancelled')
      ) from appointments),

    ------------------------------------------------------- jobs finished
    -- the only completions Repto can actually observe
    'completed', jsonb_build_object(
        'today',  (select count(*) from jobs where status='done' and created_at >= d0)
                + (select count(*) from appointments where status='done' and created_at >= d0),
        'last7',  (select count(*) from jobs where status='done' and created_at >= d7)
                + (select count(*) from appointments where status='done' and created_at >= d7),
        'last30', (select count(*) from jobs where status='done' and created_at >= d30)
                + (select count(*) from appointments where status='done' and created_at >= d30),
        'total',  (select count(*) from jobs where status='done')
                + (select count(*) from appointments where status='done')
      ),

    -- softer evidence: somebody only leaves a rating after being worked with
    'ratings', (select jsonb_build_object(
        'today',  count(*) filter (where created_at >= d0),
        'last7',  count(*) filter (where created_at >= d7),
        'last30', count(*) filter (where created_at >= d30),
        'total',  count(*)
      ) from worker_ratings),

    'quality', (select jsonb_build_object(
        'avg_rating',  (select round(avg(rating_sum::numeric / nullif(rating_count,0)), 2)
                          from workers where rating_count > 0),
        'rated_workers', (select count(*) from workers where rating_count > 0),
        'on_time_pct', (select case when sum(on_time_total) > 0
                          then round(100.0 * sum(on_time_yes) / sum(on_time_total)) end
                          from workers),
        'open_reports', (select count(*) from worker_reports where not handled)
      )),

    ------------------------------------------------------- supply health
    'supply', jsonb_build_object(
        -- approved workers nobody has ever reached: supply going to waste
        'never_booked', (select count(*) from workers w
                          where w.status = 'approved'
                            and not exists (select 1 from bookings b where b.worker_id = w.id)
                            and not exists (select 1 from jobs j where j.worker_id = w.id)
                            and not exists (select 1 from appointments a where a.worker_id = w.id)),
        -- customers who wanted somebody now and got nobody
        'unmet_last30', (select count(*) from jobs
                          where status = 'nobody' and created_at >= d30),
        'contact_requests_last30', (select count(*) from contact_requests where created_at >= d30)
      ),

    ------------------------------------------------------- what and where
    'top_services', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select skill, count(*) as n from (
          select split_part(note, ' | ', 1) as skill from bookings where created_at >= d30
          union all select skill from jobs         where created_at >= d30
          union all select skill from appointments where created_at >= d30
        ) x where skill is not null and btrim(skill) <> ''
        group by skill order by n desc, skill limit 8) t),

    'top_areas', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select area, count(*) as n from workers
         where status = 'approved' and area is not null
         group by area order by n desc, area limit 8) t),

    'pending_areas', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select area, count(*) as n from workers
         where status = 'pending' and area is not null
         group by area order by n desc, area limit 5) t),

    ------------------------------------------------------- last two weeks
    'daily', (select coalesce(jsonb_agg(t order by t.d), '[]'::jsonb) from (
        select (g.d at time zone 'Asia/Kolkata')::date as d,
               (select count(*) from workers  w where w.created_at >= g.d and w.created_at < g.d + interval '1 day') as signups,
               (select count(*) from bookings b where b.created_at >= g.d and b.created_at < g.d + interval '1 day')
             + (select count(*) from jobs     j where j.created_at >= g.d and j.created_at < g.d + interval '1 day')
             + (select count(*) from appointments a where a.created_at >= g.d and a.created_at < g.d + interval '1 day') as requests
          from generate_series(d0 - interval '13 days', d0, interval '1 day') g(d)) t)

  ) into out;

  return out;
end;
$$;

-- The ten most recent requests, so the admin can see actual activity rather
-- than only counts. Customer numbers are included: this is the operator's own
-- screen, behind the PIN, and following up on a complaint needs them.
create or replace function public.admin_recent(p_pin text, p_limit int default 12)
returns table (kind text, at timestamptz, worker_name text, skill text,
               customer_name text, customer_phone text, status text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.admin_check(p_pin) then
    raise exception 'Wrong admin PIN';
  end if;
  return query
    select * from (
      select 'WhatsApp'::text, b.created_at, b.worker_name,
             split_part(b.note, ' | ', 1), b.customer_name, b.customer_phone, 'sent'::text
        from bookings b
      union all
      select 'Instant'::text, j.created_at, w.name, j.skill,
             j.customer_name, j.customer_phone, j.status
        from jobs j left join workers w on w.id = j.worker_id
      union all
      select 'Appointment'::text, a.created_at, w.name, a.skill,
             a.customer_name, a.customer_phone, a.status
        from appointments a left join workers w on w.id = a.worker_id
    ) x
    order by x.at desc
    limit greatest(1, least(p_limit, 50));
end;
$$;

-- ============================================================
-- MIGRATION 13 — booking a named worker means that worker
--
-- The bug: tapping Book on a profile started an open search. The customer
-- had just looked at that person's photo, rating and rate, and the sheet
-- said "Get a plumber now" while the job went to whoever answered first.
-- The person they chose might never even have been asked.
--
-- That is a bait and switch, and it is the fastest way to lose the trust
-- the review queue exists to build. A job that starts from a profile is now
-- reserved for that profile. If they do not answer, the customer is told
-- whose answer is missing and asked whether to look wider — the platform
-- never decides that on their behalf.
-- ============================================================

alter table public.jobs add column if not exists requested_worker uuid references public.workers(id) on delete set null;
alter table public.jobs add column if not exists direct boolean not null default false;
-- statuses gain 'no_answer': the named worker did not reply, which is not
-- the same as nobody in the city being free

-- Only the requested worker is a candidate while a job is reserved.
create or replace function public.next_job_candidate(p_job uuid)
returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select w.id
    from workers w, jobs j
   where j.id = p_job
     and w.status = 'approved'
     and w.available
     and (not j.direct or w.id = j.requested_worker)
     and (j.city is null or w.city = j.city)
     and exists (select 1 from jsonb_array_elements(w.skills) s
                  where s->>'skill' = j.skill)
     and not exists (select 1 from job_offers o
                      where o.job_id = j.id and o.worker_id = w.id)
   order by
     -- the person actually chosen always goes first, even once the search
     -- has been widened: they may still be the best answer
     (w.id = j.requested_worker) desc,
     (w.online_until is not null and w.online_until > now()) desc,
     case when j.lat is null or w.lat is null then 1e6 else
       6371 * 2 * asin(sqrt(
         power(sin(radians(w.lat - j.lat) / 2), 2) +
         cos(radians(j.lat)) * cos(radians(w.lat)) *
         power(sin(radians(w.lng - j.lng) / 2), 2)))
     end,
     case when w.rating_count = 0 then 3.4
          else w.rating_sum::numeric / w.rating_count end desc,
     w.created_at
   limit 1;
$$;

-- Running out of candidates means two different things now.
create or replace function public.offer_next(p_job uuid, p_seconds int default 60)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare cand uuid; n int; is_direct boolean;
begin
  select next_job_candidate(p_job) into cand;
  if cand is null then
    select direct into is_direct from jobs where id = p_job;
    update jobs
       set status = case when coalesce(is_direct, false) then 'no_answer' else 'nobody' end
     where id = p_job and status = 'searching';
    return null;
  end if;
  select count(*) into n from job_offers where job_id = p_job;
  insert into job_offers (job_id, worker_id, rank, expires_at)
    values (p_job, cand, n + 1, now() + make_interval(secs => greatest(20, least(p_seconds, 300))));
  update jobs set asked_count = n + 1 where id = p_job;
  return cand;
end;
$$;

-- A reserved job that runs out of time is waiting on one person, not on the
-- whole city, so it stops as 'no_answer' too.
create or replace function public.advance_jobs()
returns int
language plpgsql security definer set search_path = public, extensions as $$
declare j record; moved int := 0;
begin
  update job_offers set status = 'expired'
   where status = 'pending' and expires_at <= now();

  for j in select id from jobs
            where status = 'searching' and search_until > now()
              and not exists (select 1 from job_offers o
                               where o.job_id = jobs.id and o.status = 'pending')
  loop
    perform offer_next(j.id, 60);
    moved := moved + 1;
  end loop;

  update jobs
     set status = case when direct then 'no_answer' else 'nobody' end
   where status = 'searching' and search_until <= now();
  return moved;
end;
$$;

-- the nine-argument version from Migration 11 has to go; the ten-argument
-- one below is replaced in place on every later run
drop function if exists public.create_job(text, text, text, text, text, double precision, double precision, text, int);

create or replace function public.create_job(
  p_skill text, p_name text, p_phone text, p_area text, p_note text default null,
  p_lat double precision default null, p_lng double precision default null,
  p_city text default 'Guwahati', p_minutes int default 20,
  p_worker uuid default null)
returns table (code text, worker_id uuid, asked int, direct boolean)
language plpgsql security definer set search_path = public, extensions as $$
declare jid uuid; c text; cand uuid; wanted uuid; is_direct boolean := false;
begin
  if p_phone !~ '^[6-9]\d{9}$' then
    raise exception 'Enter a valid 10-digit mobile number';
  end if;
  if btrim(coalesce(p_name,'')) = '' then
    raise exception 'Please enter your name';
  end if;

  -- A named worker only counts if they are actually bookable for this trade.
  -- Otherwise the job falls back to an open search, and the customer is told.
  if p_worker is not null then
    select w.id into wanted from workers w
     where w.id = p_worker and w.status = 'approved' and w.available
       and exists (select 1 from jsonb_array_elements(w.skills) s where s->>'skill' = p_skill);
    is_direct := wanted is not null;
  end if;

  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from jobs where jobs.code = c);
  end loop;

  insert into jobs (code, skill, city, area, lat, lng, customer_name, customer_phone, note,
                    search_until, requested_worker, direct)
  values (c, p_skill, p_city, p_area, p_lat, p_lng, btrim(p_name), p_phone,
          nullif(btrim(coalesce(p_note,'')),''),
          now() + make_interval(mins => greatest(2, least(p_minutes, 60))),
          wanted, is_direct)
  returning id into jid;

  cand := offer_next(jid, 60);
  return query select c, cand, (select asked_count from jobs where id = jid), is_direct;
end;
$$;

-- The customer, and only the customer, decides to look beyond the person
-- they picked. Nothing widens a search on its own.
create or replace function public.widen_job(p_code text, p_minutes int default 15)
returns table (status text, asked int)
language plpgsql security definer set search_path = public, extensions as $$
declare jid uuid;
begin
  -- every column is qualified: the OUT parameters are called status and asked,
  -- and an unqualified `status` here resolves to the parameter, not the column
  select j.id into jid from jobs j
   where j.code = upper(btrim(p_code)) and j.status in ('no_answer', 'searching');
  if jid is null then
    raise exception 'That search cannot be reopened';
  end if;
  update jobs j
     set direct = false,
         status = 'searching',
         search_until = greatest(j.search_until, now() + make_interval(mins => greatest(2, least(p_minutes, 60))))
   where j.id = jid;
  perform offer_next(jid, 60);
  return query select j.status, j.asked_count from jobs j where j.id = jid;
end;
$$;

-- The customer's screen has to be able to say whose answer it is waiting for.
drop function if exists public.job_state(text);

create function public.job_state(p_code text)
returns table (status text, asked int, worker_name text, worker_phone text,
               worker_area text, eta_minutes int, seconds_left int, skill text,
               direct boolean, requested_name text)
language sql stable security definer set search_path = public, extensions as $$
  select j.status, j.asked_count, w.name,
         case when j.status = 'accepted' then w.phone else null end,
         w.area, j.eta_minutes,
         greatest(0, extract(epoch from (
           coalesce((select o.expires_at from job_offers o
                      where o.job_id = j.id and o.status = 'pending'
                      order by o.rank desc limit 1), j.search_until) - now()))::int),
         j.skill,
         j.direct,
         (select rw.name from workers rw where rw.id = j.requested_worker)
    from jobs j left join workers w on w.id = j.worker_id
   where j.code = upper(btrim(p_code));
$$;

-- ============================================================
-- MIGRATION 14 — the work happens inside Repto
--
-- Until now the app found a worker, handed over a phone number and stepped
-- out of the way. Everything after that — was the job accepted, did anyone
-- turn up, was it any good — happened on WhatsApp, where Repto could not see
-- it. That made the platform a contact-number directory: no history for the
-- worker, no record for the customer, nothing to show a new customer beyond
-- a star rating with no words attached.
--
-- This migration gives a booking a life of its own:
--
--   * a THREAD per engagement, with a status that both sides move
--   * MESSAGES inside that thread, so the conversation stays in the app
--   * REVIEWS with words, tied to a thread that actually completed
--   * numbers a worker can see about their own work
--
-- The customer still has no account. They hold an opaque token, minted when
-- the thread starts and kept in their browser; the worker authenticates with
-- the phone and PIN they already have. Neither table has an RLS policy —
-- every path in and out goes through the functions below.
-- ============================================================

-- ---------- 14.1 a conversation per engagement ----------
create table if not exists public.threads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  code            text not null unique,
  customer_token  uuid not null default gen_random_uuid(),
  worker_id       uuid not null references public.workers(id) on delete cascade,
  skill           text not null,
  mode            text,
  detail          text,
  note            text,
  price           int,
  unit            text,
  customer_name   text not null,
  customer_phone  text not null,
  customer_area   text,
  job_id          uuid references public.jobs(id) on delete set null,
  status          text not null default 'requested',
  decline_reason  text,
  accepted_at     timestamptz,
  started_at      timestamptz,
  done_at         timestamptz,
  closed_at       timestamptz,
  last_message_at timestamptz not null default now(),
  worker_unread   int not null default 0,
  customer_unread int not null default 0
);
create index if not exists threads_worker_idx on public.threads (worker_id, last_message_at desc);
create index if not exists threads_open_idx   on public.threads (status, created_at desc);

create table if not exists public.messages (
  id         bigserial primary key,
  thread_id  uuid not null references public.threads(id) on delete cascade,
  sender     text not null check (sender in ('customer','worker','system')),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.messages (thread_id, id);

alter table public.threads  enable row level security;
alter table public.messages enable row level security;
-- deliberately no policies on either

do $$
declare r text;
begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.threads  from %I', r);
      execute format('revoke all on public.messages from %I', r);
      execute format('revoke all on sequence public.messages_id_seq from %I', r);
    end if;
  end loop;
end $$;

-- A review now carries words, belongs to a finished thread, and can be
-- hidden by moderation. These land here rather than with the rest of the
-- review code because thread_view reads thread_id.
alter table public.worker_ratings add column if not exists comment   text;
alter table public.worker_ratings add column if not exists thread_id uuid references public.threads(id) on delete set null;
alter table public.worker_ratings add column if not exists hidden    boolean not null default false;
alter table public.worker_ratings add column if not exists author    text;
create index if not exists worker_ratings_public_idx
  on public.worker_ratings (worker_id, hidden, created_at desc);

-- The statuses a thread can be in, and who is allowed to set them.
--   requested  → the customer has asked. Waiting on the worker.
--   accepted   → the worker has taken it on.
--   declined   → the worker said no. Reason is shown to the customer.
--   working    → the worker has started.
--   done       → the worker says it is finished. Waiting on the customer.
--   closed     → the customer confirmed. This is what counts as completed.
--   cancelled  → the customer pulled out before it finished.
create or replace function public.thread_status_ok(p_status text)
returns boolean language sql immutable set search_path = public as $$
  select p_status in ('requested','accepted','declined','working','done','closed','cancelled','expired');
$$;

-- ---------- 14.2 starting one ----------
create or replace function public.start_thread(
  p_worker uuid, p_skill text, p_name text, p_phone text,
  p_area text default null, p_detail text default null, p_note text default null,
  p_price int default null, p_unit text default null, p_mode text default null,
  p_job uuid default null)
returns table (code text, token uuid, worker_name text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  tid uuid; c text; tok uuid; wname text; recent int;
begin
  if p_phone !~ '^[6-9]\d{9}$' then
    raise exception 'Enter a valid 10-digit mobile number';
  end if;
  if btrim(coalesce(p_name,'')) = '' then
    raise exception 'Please enter your name';
  end if;

  select w.name into wname from workers w
   where w.id = p_worker and w.status = 'approved' and w.available;
  if wname is null then
    raise exception 'That worker is not available at the moment';
  end if;

  -- one person cannot paper the platform in requests
  select count(*) into recent from threads
   where customer_phone = p_phone and created_at > now() - interval '1 hour';
  if recent >= 15 then
    raise exception 'That is a lot of requests in one hour. Please try again later.';
  end if;

  loop
    c := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));
    exit when not exists (select 1 from threads where threads.code = c);
  end loop;

  insert into threads (code, worker_id, skill, mode, detail, note, price, unit,
                       customer_name, customer_phone, customer_area, job_id, worker_unread)
  values (c, p_worker, p_skill, nullif(btrim(coalesce(p_mode,'')),''),
          nullif(btrim(coalesce(p_detail,'')),''), nullif(btrim(coalesce(p_note,'')),''),
          p_price, nullif(btrim(coalesce(p_unit,'')),''),
          btrim(p_name), p_phone, nullif(btrim(coalesce(p_area,'')),''), p_job, 1)
  returning id, threads.customer_token into tid, tok;

  insert into messages (thread_id, sender, body)
  values (tid, 'system',
          format('%s asked for %s%s', btrim(p_name), p_skill,
                 case when nullif(btrim(coalesce(p_detail,'')),'') is null then ''
                      else ' — ' || btrim(p_detail) end));
  if nullif(btrim(coalesce(p_note,'')),'') is not null then
    insert into messages (thread_id, sender, body) values (tid, 'customer', btrim(p_note));
    update threads set worker_unread = 2 where id = tid;
  end if;

  return query select c, tok, wname;
end;
$$;

-- ---------- 14.3 the customer's side ----------
create or replace function public.thread_view(p_code text, p_token uuid)
returns table (
  code text, status text, skill text, mode text, detail text, price int, unit text,
  decline_reason text, created_at timestamptz, accepted_at timestamptz, done_at timestamptz,
  worker_id uuid, worker_name text, worker_area text, worker_thumb text,
  worker_phone text, rating_sum int, rating_count int, unread int, reviewed boolean)
language sql stable security definer set search_path = public, extensions as $$
  select t.code, t.status, t.skill, t.mode, t.detail, t.price, t.unit,
         t.decline_reason, t.created_at, t.accepted_at, t.done_at,
         w.id, w.name, w.area, coalesce(w.thumb, w.selfie),
         -- the number is a fallback for when the app is not to hand, and only
         -- once the worker has actually taken the job on
         case when t.status in ('accepted','working','done','closed') then w.phone end,
         w.rating_sum, w.rating_count, t.customer_unread,
         exists (select 1 from worker_ratings r where r.thread_id = t.id)
    from threads t join workers w on w.id = t.worker_id
   where t.code = upper(btrim(p_code)) and t.customer_token = p_token;
$$;

create or replace function public.thread_messages(p_code text, p_token uuid, p_after bigint default 0)
returns table (id bigint, sender text, body text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare tid uuid;
begin
  select t.id into tid from threads t
   where t.code = upper(btrim(p_code)) and t.customer_token = p_token;
  if tid is null then raise exception 'Conversation not found'; end if;
  update threads set customer_unread = 0 where threads.id = tid and threads.customer_unread > 0;
  return query
    select m.id, m.sender, m.body, m.created_at from messages m
     where m.thread_id = tid and m.id > coalesce(p_after, 0)
     order by m.id;
end;
$$;

create or replace function public.post_message(p_code text, p_token uuid, p_body text)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare tid uuid; st text; mid bigint; burst int;
begin
  select t.id, t.status into tid, st from threads t
   where t.code = upper(btrim(p_code)) and t.customer_token = p_token;
  if tid is null then raise exception 'Conversation not found'; end if;
  if st in ('declined','cancelled','closed') then
    raise exception 'This conversation is closed';
  end if;
  if btrim(coalesce(p_body,'')) = '' then raise exception 'Type a message first'; end if;
  if length(p_body) > 2000 then raise exception 'That message is too long'; end if;

  select count(*) into burst from messages
   where thread_id = tid and sender = 'customer' and created_at > now() - interval '1 minute';
  if burst >= 20 then raise exception 'Slow down a moment'; end if;

  insert into messages (thread_id, sender, body) values (tid, 'customer', btrim(p_body))
    returning id into mid;
  update threads set last_message_at = now(), worker_unread = worker_unread + 1 where id = tid;
  return mid;
end;
$$;

create or replace function public.customer_set_thread(p_code text, p_token uuid, p_status text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare tid uuid; st text;
begin
  select t.id, t.status into tid, st from threads t
   where t.code = upper(btrim(p_code)) and t.customer_token = p_token;
  if tid is null then raise exception 'Conversation not found'; end if;

  if p_status = 'cancelled' then
    if st in ('closed','cancelled') then raise exception 'This one is already finished'; end if;
    update threads set status = 'cancelled', closed_at = now(), last_message_at = now() where id = tid;
    insert into messages (thread_id, sender, body) values (tid, 'system', 'The customer cancelled this request.');
  elsif p_status = 'closed' then
    if st <> 'done' then raise exception 'The worker has not marked this finished yet'; end if;
    update threads set status = 'closed', closed_at = now(), last_message_at = now() where id = tid;
    insert into messages (thread_id, sender, body) values (tid, 'system', 'The customer confirmed the work is finished.');
  else
    raise exception 'A customer cannot set that';
  end if;
  update threads set worker_unread = worker_unread + 1 where id = tid;
  return p_status;
end;
$$;

-- ---------- 14.4 the worker's side ----------
create or replace function public.worker_threads(p_phone text, p_pin text, p_limit int default 40)
returns table (
  code text, status text, skill text, detail text, note text, price int, unit text,
  customer_name text, customer_area text, customer_phone text,
  created_at timestamptz, last_message_at timestamptz, unread int, preview text)
language plpgsql security definer set search_path = public, extensions as $$
declare wid uuid;
begin
  select w.id into wid from workers w join worker_secrets s on s.worker_id = w.id
   where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;

  return query
    select t.code, t.status, t.skill, t.detail, t.note, t.price, t.unit,
           t.customer_name, t.customer_area,
           -- the customer's number only once the worker has taken the job on
           case when t.status in ('accepted','working','done','closed') then t.customer_phone end,
           t.created_at, t.last_message_at, t.worker_unread,
           (select m.body from messages m where m.thread_id = t.id order by m.id desc limit 1)
      from threads t
     where t.worker_id = wid
     order by (t.worker_unread > 0) desc, t.last_message_at desc
     limit greatest(1, least(p_limit, 100));
end;
$$;

create or replace function public.worker_thread_messages(
  p_phone text, p_pin text, p_code text, p_after bigint default 0)
returns table (id bigint, sender text, body text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare tid uuid; wid uuid;
begin
  select w.id into wid from workers w join worker_secrets s on s.worker_id = w.id
   where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;
  select t.id into tid from threads t where t.code = upper(btrim(p_code)) and t.worker_id = wid;
  if tid is null then raise exception 'Conversation not found'; end if;
  update threads set worker_unread = 0 where threads.id = tid and threads.worker_unread > 0;
  return query
    select m.id, m.sender, m.body, m.created_at from messages m
     where m.thread_id = tid and m.id > coalesce(p_after, 0)
     order by m.id;
end;
$$;

create or replace function public.worker_post_message(
  p_phone text, p_pin text, p_code text, p_body text)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare tid uuid; wid uuid; st text; mid bigint; burst int;
begin
  select w.id into wid from workers w join worker_secrets s on s.worker_id = w.id
   where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;
  select t.id, t.status into tid, st from threads t
   where t.code = upper(btrim(p_code)) and t.worker_id = wid;
  if tid is null then raise exception 'Conversation not found'; end if;
  if st in ('declined','cancelled','closed') then raise exception 'This conversation is closed'; end if;
  if btrim(coalesce(p_body,'')) = '' then raise exception 'Type a message first'; end if;
  if length(p_body) > 2000 then raise exception 'That message is too long'; end if;

  select count(*) into burst from messages
   where thread_id = tid and sender = 'worker' and created_at > now() - interval '1 minute';
  if burst >= 20 then raise exception 'Slow down a moment'; end if;

  insert into messages (thread_id, sender, body) values (tid, 'worker', btrim(p_body))
    returning id into mid;
  update threads set last_message_at = now(), customer_unread = customer_unread + 1 where id = tid;
  return mid;
end;
$$;

create or replace function public.worker_set_thread(
  p_phone text, p_pin text, p_code text, p_status text, p_reason text default null)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare tid uuid; wid uuid; st text; wname text;
begin
  select w.id, w.name into wid, wname from workers w join worker_secrets s on s.worker_id = w.id
   where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;
  select t.id, t.status into tid, st from threads t
   where t.code = upper(btrim(p_code)) and t.worker_id = wid;
  if tid is null then raise exception 'Conversation not found'; end if;
  if st in ('cancelled','closed') then raise exception 'This one is already finished'; end if;

  if p_status = 'accepted' then
    if st <> 'requested' then raise exception 'Only a new request can be accepted'; end if;
    update threads set status = 'accepted', accepted_at = now(), last_message_at = now() where id = tid;
    insert into messages (thread_id, sender, body)
      values (tid, 'system', wname || ' accepted this job.');
  elsif p_status = 'declined' then
    if st <> 'requested' then raise exception 'Only a new request can be declined'; end if;
    update threads set status = 'declined', closed_at = now(), last_message_at = now(),
                       decline_reason = nullif(btrim(coalesce(p_reason,'')),'')
     where id = tid;
    insert into messages (thread_id, sender, body)
      values (tid, 'system', wname || ' could not take this job'
              || coalesce(' — ' || nullif(btrim(coalesce(p_reason,'')),''), '.'));
  elsif p_status = 'working' then
    if st <> 'accepted' then raise exception 'Accept the job first'; end if;
    update threads set status = 'working', started_at = now(), last_message_at = now() where id = tid;
    insert into messages (thread_id, sender, body) values (tid, 'system', wname || ' has started work.');
  elsif p_status = 'done' then
    if st not in ('accepted','working') then raise exception 'This job has not started'; end if;
    update threads set status = 'done', done_at = now(), last_message_at = now() where id = tid;
    insert into messages (thread_id, sender, body)
      values (tid, 'system', wname || ' marked the work finished. Please confirm.');
  else
    raise exception 'A worker cannot set that';
  end if;
  update threads set customer_unread = customer_unread + 1 where id = tid;
  return p_status;
end;
$$;

-- ---------- 14.5 what a worker has actually done ----------
-- A review can only be written by someone whose job actually finished, and
-- only once. That is the whole difference between a rating people trust and
-- a number anyone can move.
create or replace function public.review_thread(
  p_code text, p_token uuid, p_stars int, p_comment text default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare tid uuid; wid uuid; who text; st text; prev int;
begin
  if p_stars < 1 or p_stars > 5 then raise exception 'Rating must be between 1 and 5'; end if;
  select t.id, t.worker_id, t.status, split_part(t.customer_name, ' ', 1)
    into tid, wid, st, who
    from threads t where t.code = upper(btrim(p_code)) and t.customer_token = p_token;
  if tid is null then raise exception 'Conversation not found'; end if;
  if st not in ('done','closed') then
    raise exception 'You can review this once the work is finished';
  end if;
  if length(coalesce(p_comment,'')) > 700 then raise exception 'That review is a little long'; end if;

  select r.stars into prev from worker_ratings r where r.thread_id = tid;
  if prev is null then
    insert into worker_ratings (worker_id, rater, stars, comment, thread_id, author)
    values (wid, p_token::text, p_stars, nullif(btrim(coalesce(p_comment,'')),''), tid, who)
    on conflict (worker_id, rater) do update
      set stars = excluded.stars, comment = excluded.comment,
          thread_id = excluded.thread_id, author = excluded.author, created_at = now();
    update workers set rating_sum = rating_sum + p_stars, rating_count = rating_count + 1
     where id = wid;
  else
    update worker_ratings
       set stars = p_stars, comment = nullif(btrim(coalesce(p_comment,'')),''), created_at = now()
     where thread_id = tid;
    update workers set rating_sum = rating_sum - prev + p_stars where id = wid;
  end if;
end;
$$;

-- What a customer reads on a profile: the words, not just the average.
create or replace function public.worker_reviews(p_worker uuid, p_limit int default 20)
returns table (stars int, comment text, author text, created_at timestamptz, skill text)
language sql stable security definer set search_path = public, extensions as $$
  select r.stars, r.comment, coalesce(nullif(r.author,''), 'Customer'), r.created_at,
         (select t.skill from threads t where t.id = r.thread_id)
    from worker_ratings r
   where r.worker_id = p_worker and not r.hidden and r.comment is not null
   order by r.created_at desc
   limit greatest(1, least(p_limit, 50));
$$;

create or replace function public.worker_stats(p_phone text, p_pin text)
returns table (
  requested int, accepted int, declined int, working int, completed int, cancelled int,
  unread int, reviews int, avg_stars numeric, response_rate numeric, this_month int,
  listed_value int)
language plpgsql security definer set search_path = public, extensions as $$
declare wid uuid;
begin
  select w.id into wid from workers w join worker_secrets s on s.worker_id = w.id
   where w.phone = p_phone and s.pin_hash = crypt(p_pin, s.pin_hash);
  if wid is null then raise exception 'Wrong phone number or PIN'; end if;

  return query
  with t as (select * from threads where worker_id = wid)
  select
    (select count(*) from t)::int,
    (select count(*) from t where status in ('accepted','working','done','closed'))::int,
    (select count(*) from t where status = 'declined')::int,
    (select count(*) from t where status in ('accepted','working'))::int,
    (select count(*) from t where status = 'closed')::int,
    (select count(*) from t where status = 'cancelled')::int,
    (select coalesce(sum(worker_unread), 0) from t)::int,
    (select count(*) from worker_ratings r where r.worker_id = wid and not r.hidden)::int,
    (select round(avg(r.stars)::numeric, 1) from worker_ratings r where r.worker_id = wid and not r.hidden),
    -- how often a request gets any answer at all, which is the number that
    -- decides whether a customer waits for you or goes elsewhere
    (select case when count(*) = 0 then null
                 else round(100.0 * count(*) filter (where status <> 'requested') / count(*), 0) end
       from t),
    (select count(*) from t where created_at > date_trunc('month', now()))::int,
    -- the listed rate on finished jobs. NOT earnings: the final amount is
    -- agreed between the two of them and Repto never sees it.
    (select coalesce(sum(price), 0) from t where status = 'closed')::int;
end;
$$;

-- ---------- 14.6 moderation of what people write ----------
create or replace function public.admin_hide_review(p_pin text, p_worker uuid, p_rater text, p_hide boolean default true)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.admin_check(p_pin) then raise exception 'Wrong admin PIN'; end if;
  update worker_ratings set hidden = p_hide where worker_id = p_worker and rater = p_rater;
end;
$$;

-- Dropped first every time: later migrations widen this function's return
-- type, and on a re-run CREATE OR REPLACE cannot change it back.
drop function if exists public.purge_expired_data();

create function public.purge_expired_data()
returns table (bookings_removed bigint, rejected_removed bigint, contacts_removed bigint,
               jobs_removed bigint, threads_removed bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare b bigint; r bigint; c bigint; j bigint; t bigint;
begin
  delete from bookings where created_at < now() - interval '12 months';
  get diagnostics b = row_count;

  delete from workers
   where status = 'rejected'
     and coalesce(reviewed_at, created_at) < now() - interval '90 days';
  get diagnostics r = row_count;

  delete from contact_requests where created_at < now() - interval '90 days';
  get diagnostics c = row_count;

  delete from jobs where created_at < now() - interval '12 months';
  get diagnostics j = row_count;

  -- a finished conversation carries the customer's name and number, so it
  -- goes on the same 12-month clock as any other booking record. The review
  -- survives it: thread_id is set null rather than cascading.
  delete from threads where coalesce(closed_at, last_message_at) < now() - interval '12 months';
  get diagnostics t = row_count;

  -- a request nobody ever answered is not worth keeping for a year
  update threads set status = 'expired'
   where status = 'requested' and created_at < now() - interval '14 days';

  return query select b, r, c, j, t;
end;
$$;
revoke all on function public.purge_expired_data() from public;

-- ============================================================
-- MIGRATION 15 — the Repto Worker ID
--
-- Every worker gets a permanent identity number and a card they can show or
-- print. It exists so that a worker standing at somebody's door has a way to
-- say who they are that does not depend on the customer having the app open,
-- and so that a number written on a card can be checked against the register.
--
-- Shape of the number, and why:
--
--   * TWELVE DIGITS, shown in three groups of four, the way an Aadhaar
--     number is — because that is the format everybody here already knows
--     how to read out over a phone.
--   * RANDOM, not sequential. A sequence would tell any competitor exactly
--     how many workers are on the platform, and would tell a customer that
--     the person in front of them was the eleventh to sign up. Aadhaar is
--     random for the same reason.
--   * The first digit is never 0 or 1, again following Aadhaar, so the
--     number can never be mistaken for a phone number or lose a leading
--     zero in a spreadsheet.
--   * The LAST DIGIT IS A CHECK DIGIT (Luhn). One digit misheard or two
--     transposed fails immediately instead of quietly matching somebody
--     else. It also means a made-up number is wrong nine times in ten.
-- ============================================================

create or replace function public.repto_id_check(p_body text)
returns int
language plpgsql immutable set search_path = public as $$
declare
  total int := 0;
  i     int;
  d     int;
  dbl   boolean := true;   -- p_body excludes the check digit, so start doubled
begin
  for i in reverse length(p_body)..1 loop
    d := substr(p_body, i, 1)::int;
    if dbl then
      d := d * 2;
      if d > 9 then d := d - 9; end if;
    end if;
    total := total + d;
    dbl := not dbl;
  end loop;
  return (10 - (total % 10)) % 10;
end;
$$;

create or replace function public.repto_id_valid(p_code text)
returns boolean
language plpgsql immutable set search_path = public as $$
declare c text;
begin
  c := regexp_replace(coalesce(p_code,''), '\D', '', 'g');
  if length(c) <> 12 then return false; end if;
  if left(c, 1) in ('0','1') then return false; end if;
  return right(c, 1)::int = public.repto_id_check(left(c, 11));
end;
$$;

create or replace function public.new_worker_code()
returns text
language plpgsql set search_path = public, extensions as $$
declare body text; code text; i int;
begin
  loop
    body := (2 + floor(random() * 8))::int::text;          -- 2..9
    for i in 1..10 loop
      body := body || floor(random() * 10)::int::text;
    end loop;
    code := body || public.repto_id_check(body)::text;
    exit when not exists (select 1 from workers w where w.worker_code = code);
  end loop;
  return code;
end;
$$;

alter table public.workers add column if not exists worker_code text;
create unique index if not exists workers_code_idx on public.workers (worker_code);

-- A trigger rather than a line in register_worker: every path that ever
-- inserts a worker gets a number, including the ones written later.
create or replace function public.workers_assign_code()
returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  if new.worker_code is null then
    new.worker_code := public.new_worker_code();
  end if;
  return new;
end;
$$;
drop trigger if exists workers_assign_code_trg on public.workers;
create trigger workers_assign_code_trg
  before insert on public.workers
  for each row execute function public.workers_assign_code();

-- anyone who registered before the card existed
do $$
declare r record;
begin
  for r in select id from workers where worker_code is null loop
    update workers set worker_code = public.new_worker_code() where id = r.id;
  end loop;
end $$;

-- The number on a printed card is worth having only if it can be checked.
-- This is deliberately public and deliberately thin: it confirms that a
-- number belongs to a live worker and says what they do. No phone number,
-- no coordinates, nothing that turns the register into a contact list.
create or replace function public.verify_worker_id(p_code text)
returns table (
  worker_code text, name text, city text, area text, skills jsonb,
  thumb text, status text, member_since timestamptz,
  rating_sum int, rating_count int, jobs_done int)
language plpgsql stable security definer set search_path = public, extensions as $$
declare c text;
begin
  c := regexp_replace(coalesce(p_code,''), '\D', '', 'g');
  if not public.repto_id_valid(c) then
    return;                       -- not even a well-formed number
  end if;
  return query
    select w.worker_code, w.name, w.city, w.area, w.skills,
           coalesce(w.thumb, w.selfie), w.status, w.created_at,
           w.rating_sum, w.rating_count,
           (select count(*)::int from threads t
             where t.worker_id = w.id and t.status = 'closed')
      from workers w
     where w.worker_code = c
       and w.status = 'approved';  -- a card is only valid while the profile is
end;
$$;

-- the code travels with the profile the worker signs in to
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select (worker_code) on public.workers to %I', r);
    end if;
  end loop;
end $$;
