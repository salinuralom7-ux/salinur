-- ============================================================
-- BUDGET CARS — Supabase setup
--
-- How to use:
--   1. Go to https://supabase.com and create a free project.
--   2. In your project, open  SQL Editor → New query.
--   3. Paste this WHOLE file and click RUN.
--   4. (Optional) Change the owner PIN in the line marked below.
--   5. Copy your Project URL and anon public key from
--      Settings → API, and paste them into docs/index.html
--      (SUPABASE_URL and SUPABASE_ANON_KEY at the top of the script).
--
-- Security model:
--   * Anyone can READ the cars (that's the showroom).
--   * Nobody can add/delete directly — writes only happen through
--     the add_car / delete_car functions, which check the owner PIN
--     on the server. The PIN itself is stored in a table no visitor
--     can read.
-- ============================================================

-- ---------- cars table ----------
create table if not exists public.cars (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  brand       text not null,
  year        int  not null,
  price       bigint not null,
  km          bigint not null,
  fuel        text,
  trans       text,
  owners      text,
  color       text,
  ins         text,
  loc         text,
  description text,
  photo       text          -- base64 image, or null for auto placeholder art
);

-- ---------- owner PIN (never readable by visitors) ----------
create table if not exists public.owner_settings (
  id  int primary key default 1,
  pin text not null
);

-- ▼▼▼ CHANGE '7086' BELOW TO SET YOUR OWN OWNER PIN ▼▼▼
insert into public.owner_settings (id, pin)
values (1, '7086')
on conflict (id) do nothing;

-- ---------- lock everything down ----------
alter table public.cars           enable row level security;
alter table public.owner_settings enable row level security;

drop policy if exists "public can view cars" on public.cars;
create policy "public can view cars"
  on public.cars for select
  using (true);
-- (no insert/update/delete policies on cars, and no policies at all on
--  owner_settings → those operations are blocked for visitors)

-- ---------- owner functions (PIN checked on the server) ----------
create or replace function public.check_pin(p_pin text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from owner_settings where id = 1 and pin = p_pin);
$$;

create or replace function public.add_car(p_pin text, p_car jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.check_pin(p_pin) then
    raise exception 'Wrong owner PIN';
  end if;
  insert into cars (name, brand, year, price, km, fuel, trans, owners, color, ins, loc, description, photo)
  values (
    p_car->>'name',
    p_car->>'brand',
    (p_car->>'year')::int,
    (p_car->>'price')::bigint,
    (p_car->>'km')::bigint,
    p_car->>'fuel',
    p_car->>'trans',
    p_car->>'owners',
    p_car->>'color',
    p_car->>'ins',
    p_car->>'loc',
    p_car->>'description',
    p_car->>'photo'
  )
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.delete_car(p_pin text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_pin(p_pin) then
    raise exception 'Wrong owner PIN';
  end if;
  delete from cars where id = p_id;
end;
$$;

-- ---------- a few sample cars so the site isn't empty ----------
-- (delete them from the website in owner mode once you add real cars)
insert into public.cars (name, brand, year, price, km, fuel, trans, owners, color, ins, loc, description)
select * from (values
  ('Maruti Swift VXI',      'Maruti Suzuki', 2019, 465000::bigint, 38000::bigint, 'Petrol', 'Manual',    '1st Owner', 'Pearl White',   'Valid — Comprehensive', 'AS-01, Guwahati', 'Single owner, full service history at authorised centre. New tyres fitted recently.'),
  ('Hyundai i20 Sportz',    'Hyundai',       2018, 520000::bigint, 45000::bigint, 'Petrol', 'Manual',    '1st Owner', 'Fiery Red',     'Valid — Comprehensive', 'AS-01, Guwahati', 'Top variant with touchscreen, rear camera and alloy wheels. Well maintained family car.'),
  ('Tata Nexon XZ+',        'Tata',          2021, 780000::bigint, 24000::bigint, 'Diesel', 'Manual',    '1st Owner', 'Foliage Green', 'Valid — Comprehensive', 'AS-01, Guwahati', '5-star safety rated SUV. Under warranty, single owner, showroom condition.')
) as v(name, brand, year, price, km, fuel, trans, owners, color, ins, loc, description)
where not exists (select 1 from public.cars);
