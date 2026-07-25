-- ============================================================
-- KAAMSETU — Supabase setup (runs in the same project as Budget Cars)
--
-- Security model:
--   * Anyone can READ workers (that's the marketplace).
--   * Sign-up / sign-in / profile edits go through functions that
--     verify the worker's PIN on the server (bcrypt-hashed, stored
--     in a table no visitor can read).
--   * Bookings are insert-only for visitors (nobody can read them).
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
update public.owner_settings
  set pin_hash = '$2a$06$9/jo6EBz7wlyObFoxBaZ8u8ljNrHKEON08C7uRxBzHc8xmPSvyOea',
      pin = ''
  where id = 1;

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

insert into public.nearse_admin (id, pin_hash)
values (1, '$2a$06$wH.KLvESA51YLnv9I1O9UekJwfBnkw3xTNdh1MvfFFRq56oyGoPkG')
on conflict (id) do update set pin_hash = excluded.pin_hash;

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
  -- Supabase puts the verified number in the JWT as E.164 digits, e.g. 917086269537.
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
