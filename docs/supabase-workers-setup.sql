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
