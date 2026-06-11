-- ============================================================
-- Budget Phone Store — Supabase setup
-- Paste this whole file into: Supabase Dashboard → SQL Editor → Run
-- It creates all tables, security rules and the image storage bucket.
-- ============================================================

-- ---------- products ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  brand text not null,
  model text not null,
  storage text,
  ram text,
  color text not null default '',
  color_hex text not null default '#334155',
  category text not null check (category in ('iphone', 'android', 'accessory')),
  grade text not null check (grade in ('A', 'B', 'C', 'D', 'E')),
  mrp integer not null check (mrp >= 0),
  price integer not null check (price >= 0),
  battery_health integer check (battery_health between 0 and 100),
  stock integer not null default 0 check (stock >= 0),
  rating numeric not null default 0,
  review_count integer not null default 0,
  accessories text[] not null default '{}',
  condition_notes text not null default '',
  repairs text,
  has_video boolean not null default false,
  specs jsonb not null default '{}',
  images text[],
  video_url text,
  imei text,
  is_active boolean not null default true
);

-- ---------- orders ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  order_code text not null unique,
  customer_name text not null,
  phone text not null,
  address jsonb not null,
  items jsonb not null,
  subtotal integer not null,
  discount integer not null default 0,
  shipping integer not null default 0,
  total integer not null,
  promo_code text,
  shipping_method text not null default 'standard',
  payment_method text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned')),
  grade_e_ack boolean not null default false
);

-- ---------- profiles (admin flags) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- The FIRST account ever registered automatically becomes the admin
-- (that will be you — register immediately after running this).
-- More admins can be enabled later from the Table Editor.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (new.id, new.email, not exists (select 1 from public.profiles));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- stock decrement used at checkout ----------
create or replace function public.decrement_stock(p_id uuid, p_qty integer)
returns void
language sql
security definer set search_path = public
as $$
  update public.products
  set stock = greatest(stock - p_qty, 0)
  where id = p_id;
$$;

-- ---------- helper: is the caller an admin? ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------- row level security ----------
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.profiles enable row level security;

-- Anyone (even not signed in) can view active products.
drop policy if exists "public read active products" on public.products;
create policy "public read active products"
  on public.products for select
  using (is_active = true or public.is_admin());

-- Only the admin can add/edit/remove products.
drop policy if exists "admin write products" on public.products;
create policy "admin write products"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- Anyone can place an order (guest checkout)...
drop policy if exists "anyone can place orders" on public.orders;
create policy "anyone can place orders"
  on public.orders for insert
  with check (true);

-- ...but only the admin can see and manage orders.
drop policy if exists "admin read orders" on public.orders;
create policy "admin read orders"
  on public.orders for select
  using (public.is_admin());

drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders"
  on public.orders for update
  using (public.is_admin());

-- Users can read their own profile; admin can read all.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- ---------- image storage bucket ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "public read product images" on storage.objects;
create policy "public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "admin upload product images" on storage.objects;
create policy "admin upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admin delete product images" on storage.objects;
create policy "admin delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());
