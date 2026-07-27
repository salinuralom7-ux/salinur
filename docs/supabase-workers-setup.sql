-- ============================================================
-- NEARSE — Supabase setup (runs in the same project as Budget Cars)
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

-- ============================================================
-- Budget Cars: owner PIN moved to a bcrypt hash (never stored in
-- plain text, never committed to the repo). check_pin now verifies
-- against the hash.
-- ============================================================
alter table public.owner_settings add column if not exists pin_hash text;
-- Seed a hash only if there is none. This used to assign the hash
-- unconditionally, and because CI re-runs this whole file on every push, any
-- PIN the owner set by hand was silently reset to the committed one on the
-- next deploy. Migration 10 disables the committed hash outright.
update public.owner_settings
  set pin_hash = '$2a$06$9/jo6EBz7wlyObFoxBaZ8u8ljNrHKEON08C7uRxBzHc8xmPSvyOea',
      pin = ''
  where id = 1 and coalesce(pin_hash, '') = '';

create or replace function public.check_pin(p_pin text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from owner_settings
    where id = 1 and pin_hash is not null and pin_hash = crypt(p_pin, pin_hash)
  );
$$;

-- ============================================================
-- Nearse: profile verification
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
-- sends a code FROM their own WhatsApp to the Nearse business number. The
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
-- should have arrived on the Nearse WhatsApp from that worker's number.
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
-- Workers set their own rate, which is the point of Nearse, but an
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
  ($q$Building Caretaker$q$,6000,30000)
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
--   update nearse_admin  set pin_hash = crypt('your new pin', gen_salt('bf', 12)) where id = 1;
--   update owner_settings set pin_hash = crypt('your new pin', gen_salt('bf', 12)) where id = 1;
create or replace function public.pin_is_published(p_hash text)
returns boolean
language sql immutable set search_path = public as $$
  select p_hash in (
    '$2a$06$wH.KLvESA51YLnv9I1O9UekJwfBnkw3xTNdh1MvfFFRq56oyGoPkG',  -- Nearse admin
    '$2a$06$9/jo6EBz7wlyObFoxBaZ8u8ljNrHKEON08C7uRxBzHc8xmPSvyOea'   -- Budget Cars owner
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

create or replace function public.check_pin(p_pin text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select pin_hash into h from owner_settings where id = 1;
  if h is null or public.pin_is_published(h) then
    return false;
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
create or replace function public.purge_expired_data()
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
