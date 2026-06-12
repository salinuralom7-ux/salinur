-- ============================================================
-- ShaadiSetu — Supabase setup
-- Paste this whole file into: Supabase Dashboard -> SQL Editor -> Run
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('customer','vendor','admin')),
  name text not null,
  created_at timestamptz not null default now()
);

-- The FIRST registered account becomes the platform admin (that's you —
-- register immediately after running this).
create or replace function public.enforce_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles) then
    new.role := 'admin';
  elsif new.role = 'admin' then
    new.role := 'customer'; -- nobody else can self-assign admin
  end if;
  return new;
end; $$;
drop trigger if exists trg_first_admin on public.profiles;
create trigger trg_first_admin before insert on public.profiles
  for each row execute function public.enforce_first_admin();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create table if not exists public.vendors (
  id uuid primary key references public.profiles (id) on delete cascade,
  business_name text not null,
  category text not null,
  city text not null,
  phone text,
  bio text default '',
  packages jsonb not null default '[]',
  photos text[] not null default '{}',
  rating numeric not null default 0,
  review_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  created_at timestamptz not null default now()
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id),
  customer_name text not null,
  vendor_id uuid not null references public.vendors (id),
  vendor_name text not null,
  category text not null,
  event_date date not null,
  city text not null,
  requirements text not null default '',
  status text not null default 'open' check (status in ('open','quoted','accepted','declined')),
  price integer check (price is null or price >= 100),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null unique references public.quotations (id),
  customer_id uuid not null,
  customer_name text not null,
  vendor_id uuid not null,
  vendor_name text not null,
  category text not null,
  event_date date not null,
  amount integer not null,
  commission_rate numeric not null,
  commission integer not null,
  vendor_payout integer not null,
  status text not null default 'advance_pending'
    check (status in ('advance_pending','confirmed','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  sender_id uuid not null,
  sender_name text not null,
  text text not null check (char_length(text) <= 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key, -- = booking id (one review per booking)
  vendor_id uuid not null references public.vendors (id),
  customer_id uuid not null,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  text text default '',
  created_at timestamptz not null default now()
);

-- ---------- RPC: accept a quote -> create the booking (server-side money math)
create or replace function public.accept_quote(p_quote_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  q public.quotations;
  b public.bookings;
  rate numeric := 0.15;
begin
  select * into q from public.quotations where id = p_quote_id for update;
  if q is null then raise exception 'Quote not found'; end if;
  if q.customer_id <> auth.uid() then raise exception 'Not your quotation'; end if;
  if q.status <> 'quoted' or q.price is null then raise exception 'Quote is not acceptable'; end if;

  update public.quotations set status = 'accepted' where id = p_quote_id;

  insert into public.bookings (
    quotation_id, customer_id, customer_name, vendor_id, vendor_name,
    category, event_date, amount, commission_rate, commission, vendor_payout, status
  ) values (
    q.id, q.customer_id, q.customer_name, q.vendor_id, q.vendor_name,
    q.category, q.event_date, q.price, rate,
    round(q.price * rate), q.price - round(q.price * rate), 'advance_pending'
  ) returning * into b;
  return b;
end; $$;

-- ---------- RPC: submit a review (requires the caller's completed booking)
create or replace function public.submit_review(p_booking_id uuid, p_rating integer, p_text text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  cname text;
begin
  if p_rating < 1 or p_rating > 5 then raise exception 'Rating must be 1-5'; end if;
  select * into b from public.bookings where id = p_booking_id;
  if b is null then raise exception 'Booking not found'; end if;
  if b.customer_id <> auth.uid() then raise exception 'Not your booking'; end if;
  if b.status <> 'completed' then raise exception 'You can review after the event is completed'; end if;
  if exists (select 1 from public.reviews where id = p_booking_id) then
    raise exception 'Already reviewed';
  end if;

  select name into cname from public.profiles where id = auth.uid();
  insert into public.reviews (id, vendor_id, customer_id, customer_name, rating, text)
  values (p_booking_id, b.vendor_id, b.customer_id, coalesce(cname, b.customer_name), p_rating, left(coalesce(p_text,''), 2000));

  update public.vendors v set
    rating = round(((v.rating * v.review_count + p_rating) / (v.review_count + 1))::numeric, 1),
    review_count = v.review_count + 1
  where v.id = b.vendor_id;
end; $$;

-- ---------- row level security
alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.quotations enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists "create own profile" on public.profiles;
create policy "create own profile" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "vendors public read" on public.vendors;
create policy "vendors public read" on public.vendors
  for select using (status = 'approved' or id = auth.uid() or public.is_admin());
drop policy if exists "vendor manages own" on public.vendors;
create policy "vendor manages own" on public.vendors
  for insert with check (id = auth.uid() and status = 'pending');
drop policy if exists "vendor updates own" on public.vendors;
create policy "vendor updates own" on public.vendors
  for update using (id = auth.uid())
  with check (
    -- trust fields cannot be self-edited
    rating = (select rating from public.vendors where id = auth.uid())
    and review_count = (select review_count from public.vendors where id = auth.uid())
    and status = (select status from public.vendors where id = auth.uid())
  );
drop policy if exists "admin manages vendors" on public.vendors;
create policy "admin manages vendors" on public.vendors
  for update using (public.is_admin());

drop policy if exists "quote participants read" on public.quotations;
create policy "quote participants read" on public.quotations
  for select using (customer_id = auth.uid() or vendor_id = auth.uid() or public.is_admin());
drop policy if exists "customer creates quote" on public.quotations;
create policy "customer creates quote" on public.quotations
  for insert with check (customer_id = auth.uid() and status = 'open');
drop policy if exists "vendor answers quote" on public.quotations;
create policy "vendor answers quote" on public.quotations
  for update using (vendor_id = auth.uid() and status = 'open')
  with check (status in ('quoted','declined') and customer_id = (select customer_id from public.quotations q2 where q2.id = id));

drop policy if exists "booking participants read" on public.bookings;
create policy "booking participants read" on public.bookings
  for select using (customer_id = auth.uid() or vendor_id = auth.uid() or public.is_admin());
-- inserts only via accept_quote() RPC (security definer); status updates by admin
drop policy if exists "admin updates bookings" on public.bookings;
create policy "admin updates bookings" on public.bookings
  for update using (public.is_admin());

drop policy if exists "message participants" on public.messages;
create policy "message participants" on public.messages
  for select using (exists (
    select 1 from public.quotations q
    where q.id = quotation_id and (q.customer_id = auth.uid() or q.vendor_id = auth.uid())
  ));
drop policy if exists "send message" on public.messages;
create policy "send message" on public.messages
  for insert with check (sender_id = auth.uid() and exists (
    select 1 from public.quotations q
    where q.id = quotation_id and (q.customer_id = auth.uid() or q.vendor_id = auth.uid())
  ));

drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews for select using (true);
-- review writes only via submit_review() RPC

-- realtime for chat
alter publication supabase_realtime add table public.messages;
