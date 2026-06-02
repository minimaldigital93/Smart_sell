
-- ============================================
-- database/migrations/0001_extensions_and_enums.sql
-- ============================================

-- 0001_extensions_and_enums.sql
-- Postgres extensions + custom enum types used across the schema.

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive text (emails, slugs)

do $$ begin
  create type public.user_role as enum ('admin', 'staff', 'customer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_category as enum (
    'skincare', 'makeup', 'perfume', 'haircare', 'bodycare'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending',
    'payment_confirmed',
    'preparing',
    'shipping',
    'delivered',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('khqr', 'aba', 'acleda', 'wing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.movement_type as enum ('in', 'out', 'adjustment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'order', 'inventory', 'promo', 'system'
  );
exception when duplicate_object then null; end $$;

-- ============================================
-- database/migrations/0002_profiles.sql
-- ============================================

-- 0002_profiles.sql
-- public.profiles mirrors auth.users (one row per signed-in user) and stores
-- role + display info. New auth.users rows auto-create a profile via trigger.

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'customer',
  name        text,
  email       citext,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create unique index if not exists profiles_email_unique on public.profiles(email) where email is not null;

-- updated_at maintenance
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on auth.users insert
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- database/migrations/0003_products_and_inventory.sql
-- ============================================

-- 0003_products_and_inventory.sql
-- products: catalog rows. product_inventory: per-product stock tracking
-- (1:1 with products; current_stock is the canonical value, products.stock is
-- a denormalized cache kept in sync by trigger in 0007).

create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null,
  description     text,
  price           numeric(10,2) not null check (price >= 0),
  discount_price  numeric(10,2) check (discount_price is null or discount_price >= 0),
  stock           integer not null default 0 check (stock >= 0),
  category        public.product_category not null,
  images          text[] not null default '{}',
  barcode         text,
  sku             text,
  featured        boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint products_discount_lt_price
    check (discount_price is null or discount_price < price)
);

create unique index if not exists products_slug_unique on public.products(slug);
create unique index if not exists products_sku_unique on public.products(sku) where sku is not null;
create unique index if not exists products_barcode_unique on public.products(barcode) where barcode is not null;
create index if not exists products_category_idx on public.products(category) where is_active;
create index if not exists products_featured_idx on public.products(featured) where featured and is_active;
create index if not exists products_created_at_idx on public.products(created_at desc);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.product_inventory (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null unique references public.products(id) on delete cascade,
  current_stock   integer not null default 0 check (current_stock >= 0),
  minimum_stock   integer not null default 5 check (minimum_stock >= 0),
  barcode         text,
  sku             text,
  updated_at      timestamptz not null default now()
);

create index if not exists product_inventory_low_stock_idx
  on public.product_inventory(current_stock)
  where current_stock <= minimum_stock;

create unique index if not exists product_inventory_barcode_unique
  on public.product_inventory(barcode) where barcode is not null;

drop trigger if exists product_inventory_set_updated_at on public.product_inventory;
create trigger product_inventory_set_updated_at
  before update on public.product_inventory
  for each row execute function public.set_updated_at();

-- Auto-create product_inventory row for every new product
create or replace function public.handle_new_product() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.product_inventory (product_id, current_stock, barcode, sku)
  values (new.id, new.stock, new.barcode, new.sku)
  on conflict (product_id) do nothing;
  return new;
end $$;

drop trigger if exists on_product_created on public.products;
create trigger on_product_created
  after insert on public.products
  for each row execute function public.handle_new_product();

-- ============================================
-- database/migrations/0004_orders.sql
-- ============================================

-- 0004_orders.sql
-- orders + order_items. user_id is nullable to support guest checkout.

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  customer_name   text not null,
  phone           text not null,
  address         text not null,
  note            text,
  subtotal        numeric(10,2) not null check (subtotal >= 0),
  shipping_fee    numeric(10,2) not null default 0 check (shipping_fee >= 0),
  total           numeric(10,2) not null check (total >= 0),
  payment_method  public.payment_method not null,
  payment_image   text,
  status          public.order_status not null default 'pending',
  inventory_applied boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint orders_total_matches
    check (total = subtotal + shipping_fee)
);

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  quantity    integer not null check (quantity > 0),
  price       numeric(10,2) not null check (price >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);

-- ============================================
-- database/migrations/0005_inventory_movements.sql
-- ============================================

-- 0005_inventory_movements.sql
-- Append-only ledger of every stock change. Written by apply_inventory_movement()
-- in 0007 — do not insert directly except through that function.

create table if not exists public.inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete restrict,
  barcode         text,
  movement_type   public.movement_type not null,
  quantity        integer not null check (quantity > 0),
  resulting_stock integer not null check (resulting_stock >= 0),
  order_id        uuid references public.orders(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists inventory_movements_product_id_idx
  on public.inventory_movements(product_id, created_at desc);
create index if not exists inventory_movements_created_at_idx
  on public.inventory_movements(created_at desc);
create index if not exists inventory_movements_order_id_idx
  on public.inventory_movements(order_id) where order_id is not null;

-- ============================================
-- database/migrations/0006_notifications.sql
-- ============================================

-- 0006_notifications.sql
-- Notifications: per-user or broadcast (user_id null). Read tracking is per-user.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  message     text not null,
  type        public.notification_type not null default 'system',
  metadata    jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_id_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_broadcast_idx
  on public.notifications(created_at desc) where user_id is null;
create index if not exists notifications_unread_idx
  on public.notifications(user_id) where read_at is null;

-- ============================================
-- database/migrations/0007_functions_and_triggers.sql
-- ============================================

-- 0007_functions_and_triggers.sql
-- Core domain functions:
--   * apply_inventory_movement(...)         -- atomic, idempotent stock change
--   * apply_order_inventory(order_id)       -- decrement stock for every item in an order
--   * Trigger: orders.status -> payment_confirmed runs apply_order_inventory
--   * Trigger: product_inventory.current_stock -> products.stock cache sync

-- ----------------------------------------------------------------------------
-- apply_inventory_movement
--
-- Transaction-safe: takes a row lock on product_inventory, validates that an
-- 'out' movement cannot drive stock below zero, inserts a row in
-- inventory_movements, and updates product_inventory.current_stock.
--
-- Returns the new resulting_stock.
-- ----------------------------------------------------------------------------
create or replace function public.apply_inventory_movement(
  p_product_id   uuid,
  p_movement     public.movement_type,
  p_quantity     integer,
  p_notes        text default null,
  p_order_id     uuid default null,
  p_created_by   uuid default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory   public.product_inventory%rowtype;
  v_delta       integer;
  v_new_stock   integer;
  v_barcode     text;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive (got %)', p_quantity
      using errcode = '22023';
  end if;

  -- Lock the inventory row for this product to serialize concurrent updates
  select * into v_inventory
  from public.product_inventory
  where product_id = p_product_id
  for update;

  if not found then
    raise exception 'no inventory row for product %', p_product_id
      using errcode = 'P0002';
  end if;

  -- Resolve delta from movement type
  if p_movement = 'in' then
    v_delta := p_quantity;
  elsif p_movement = 'out' then
    v_delta := -p_quantity;
  elsif p_movement = 'adjustment' then
    -- For adjustments, p_quantity is the *absolute target stock* (re-purposed).
    -- Compute delta to reach that target.
    v_delta := p_quantity - v_inventory.current_stock;
  end if;

  v_new_stock := v_inventory.current_stock + v_delta;

  if v_new_stock < 0 then
    raise exception 'insufficient stock: have %, requested %',
      v_inventory.current_stock, p_quantity
      using errcode = '23514';
  end if;

  v_barcode := v_inventory.barcode;

  -- Skip the ledger write when an adjustment results in no change.
  if v_delta = 0 then
    return v_new_stock;
  end if;

  insert into public.inventory_movements (
    product_id, barcode, movement_type, quantity, resulting_stock,
    order_id, created_by, notes
  ) values (
    p_product_id,
    v_barcode,
    p_movement,
    abs(v_delta),
    v_new_stock,
    p_order_id,
    p_created_by,
    p_notes
  );

  update public.product_inventory
     set current_stock = v_new_stock,
         updated_at    = now()
   where product_id   = p_product_id;

  return v_new_stock;
end $$;

revoke all on function public.apply_inventory_movement(uuid, public.movement_type, integer, text, uuid, uuid) from public;
grant execute on function public.apply_inventory_movement(uuid, public.movement_type, integer, text, uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- apply_order_inventory: decrement stock for every line item in an order.
-- Idempotent via orders.inventory_applied flag.
-- ----------------------------------------------------------------------------
create or replace function public.apply_order_inventory(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_already_applied boolean;
  v_user_id         uuid;
  v_item            record;
begin
  select inventory_applied, user_id
    into v_already_applied, v_user_id
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'order % not found', p_order_id using errcode = 'P0002';
  end if;

  if v_already_applied then
    return;
  end if;

  for v_item in
    select product_id, quantity
      from public.order_items
     where order_id = p_order_id
  loop
    perform public.apply_inventory_movement(
      v_item.product_id,
      'out'::public.movement_type,
      v_item.quantity,
      'order ' || p_order_id::text,
      p_order_id,
      v_user_id
    );
  end loop;

  update public.orders
     set inventory_applied = true
   where id = p_order_id;
end $$;

revoke all on function public.apply_order_inventory(uuid) from public;
grant execute on function public.apply_order_inventory(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: when an order transitions to payment_confirmed, deduct inventory.
-- ----------------------------------------------------------------------------
create or replace function public.on_order_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'payment_confirmed'
     and (old.status is distinct from 'payment_confirmed')
     and not new.inventory_applied
  then
    perform public.apply_order_inventory(new.id);
  end if;
  return new;
end $$;

drop trigger if exists orders_inventory_on_paid on public.orders;
create trigger orders_inventory_on_paid
  after update of status on public.orders
  for each row execute function public.on_order_status_change();

-- ----------------------------------------------------------------------------
-- Trigger: keep products.stock in sync with product_inventory.current_stock.
-- ----------------------------------------------------------------------------
create or replace function public.sync_product_stock_cache() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.products
     set stock = new.current_stock
   where id = new.product_id
     and stock is distinct from new.current_stock;
  return new;
end $$;

drop trigger if exists product_inventory_sync_cache on public.product_inventory;
create trigger product_inventory_sync_cache
  after insert or update of current_stock on public.product_inventory
  for each row execute function public.sync_product_stock_cache();

-- ============================================
-- database/migrations/0008_rls_policies.sql
-- ============================================

-- 0008_rls_policies.sql
-- Row-Level Security policies for every public table.
--
-- Helper functions live in public.is_admin() / public.is_staff() to keep
-- policies readable. Both are SECURITY DEFINER and stable, so they cache per
-- statement and avoid recursive RLS checks on profiles.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and role = 'admin'
  );
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and role in ('admin', 'staff')
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- ============================================================================
-- profiles
-- ============================================================================
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff on public.profiles
  for select
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- Customers can update their own name/phone but not role.
    and (role = (select role from public.profiles where id = auth.uid()))
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- profile rows are inserted by the on_auth_user_created trigger (SECURITY DEFINER);
-- no INSERT policy needed for users.

-- ============================================================================
-- products
-- ============================================================================
alter table public.products enable row level security;

drop policy if exists products_select_public on public.products;
create policy products_select_public on public.products
  for select
  using (is_active or public.is_staff());

drop policy if exists products_modify_staff on public.products;
create policy products_modify_staff on public.products
  for all
  using (public.is_staff())
  with check (public.is_staff());

-- ============================================================================
-- product_inventory
-- ============================================================================
alter table public.product_inventory enable row level security;

drop policy if exists inventory_select_public on public.product_inventory;
create policy inventory_select_public on public.product_inventory
  for select
  using (true);

drop policy if exists inventory_modify_staff on public.product_inventory;
create policy inventory_modify_staff on public.product_inventory
  for all
  using (public.is_staff())
  with check (public.is_staff());

-- ============================================================================
-- orders
-- ============================================================================
alter table public.orders enable row level security;

drop policy if exists orders_select_owner_or_staff on public.orders;
create policy orders_select_owner_or_staff on public.orders
  for select
  using (
    public.is_staff()
    or (user_id is not null and user_id = auth.uid())
  );

-- Customer can create their own order (user_id = auth.uid()) or anonymous (null).
drop policy if exists orders_insert_self on public.orders;
create policy orders_insert_self on public.orders
  for insert
  with check (
    user_id is null
    or user_id = auth.uid()
    or public.is_staff()
  );

drop policy if exists orders_update_staff on public.orders;
create policy orders_update_staff on public.orders
  for update
  using (public.is_staff())
  with check (public.is_staff());

-- ============================================================================
-- order_items
-- ============================================================================
alter table public.order_items enable row level security;

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select
  using (
    public.is_staff()
    or exists (
      select 1 from public.orders o
       where o.id = order_items.order_id
         and o.user_id = auth.uid()
    )
  );

drop policy if exists order_items_insert_with_order on public.order_items;
create policy order_items_insert_with_order on public.order_items
  for insert
  with check (
    public.is_staff()
    or exists (
      select 1 from public.orders o
       where o.id = order_items.order_id
         and (o.user_id is null or o.user_id = auth.uid())
    )
  );

drop policy if exists order_items_modify_staff on public.order_items;
create policy order_items_modify_staff on public.order_items
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists order_items_delete_staff on public.order_items;
create policy order_items_delete_staff on public.order_items
  for delete using (public.is_staff());

-- ============================================================================
-- inventory_movements (staff/admin only)
-- ============================================================================
alter table public.inventory_movements enable row level security;

drop policy if exists movements_select_staff on public.inventory_movements;
create policy movements_select_staff on public.inventory_movements
  for select using (public.is_staff());

-- Inserts happen only through apply_inventory_movement (SECURITY DEFINER).
-- We still allow staff to insert directly for manual adjustments if needed.
drop policy if exists movements_insert_staff on public.inventory_movements;
create policy movements_insert_staff on public.inventory_movements
  for insert with check (public.is_staff());

-- ============================================================================
-- notifications
-- ============================================================================
alter table public.notifications enable row level security;

drop policy if exists notifications_select_visible on public.notifications;
create policy notifications_select_visible on public.notifications
  for select
  using (
    user_id is null            -- broadcast: everyone
    or user_id = auth.uid()    -- targeted at me
    or public.is_staff()       -- staff sees all
  );

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_modify_staff on public.notifications;
create policy notifications_modify_staff on public.notifications
  for all
  using (public.is_staff())
  with check (public.is_staff());

-- ============================================
-- database/migrations/0009_realtime_publications.sql
-- ============================================

-- 0009_realtime_publications.sql
-- Add tables to Supabase Realtime so clients can subscribe to changes.
-- These are the tables where live updates matter most: orders (admin
-- dashboard), product_inventory (stock changes), notifications (toast feed).

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Idempotent: ALTER PUBLICATION ... ADD TABLE has no IF NOT EXISTS, so we
-- check pg_publication_tables before each add. Safe to re-run.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'orders',
    'product_inventory',
    'inventory_movements',
    'notifications'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = v_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    end if;
  end loop;
end $$;

-- ============================================
-- database/migrations/0010_product_ingredients.sql
-- ============================================

-- 0010_product_ingredients.sql
-- Additive: ingredients field for cosmetic products (spec PDP requirement).

alter table public.products
  add column if not exists ingredients text;

-- ============================================
-- database/migrations/0011_payment_proofs_storage.sql
-- ============================================

-- 0011_payment_proofs_storage.sql
-- Storage bucket for KHQR / bank-transfer payment screenshots.
--
-- Public read with UUID-prefixed paths. If you need stricter privacy, flip
-- `public` to false and switch the SELECT policy to: bucket_id = 'payment-proofs'
-- AND public.is_staff() — then have the client fetch images through a
-- server route that issues signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Allow anyone to upload to this bucket (anon + authenticated). Required for
-- guest checkout. The DB still validates everything else server-side.
drop policy if exists "payment_proofs_insert_anyone" on storage.objects;
create policy "payment_proofs_insert_anyone"
  on storage.objects for insert
  with check (bucket_id = 'payment-proofs');

-- Everyone can read (bucket is public).
drop policy if exists "payment_proofs_select_public" on storage.objects;
create policy "payment_proofs_select_public"
  on storage.objects for select
  using (bucket_id = 'payment-proofs');

-- Staff can delete/replace (for moderation).
drop policy if exists "payment_proofs_modify_staff" on storage.objects;
create policy "payment_proofs_modify_staff"
  on storage.objects for all
  using (bucket_id = 'payment-proofs' and public.is_staff())
  with check (bucket_id = 'payment-proofs' and public.is_staff());

-- ============================================
-- database/migrations/0012_admin_views.sql
-- ============================================

-- 0012_admin_views.sql
-- Read-side views powering the admin dashboard. All views are
-- `security_invoker = true` so they inherit the caller's RLS — only staff or
-- admin (via the policies from 0008) can read the underlying tables.

-- ----------------------------------------------------------------------------
-- v_admin_dashboard: single-row summary of headline KPIs.
-- ----------------------------------------------------------------------------
create or replace view public.v_admin_dashboard
  with (security_invoker = true) as
select
  (select count(*) from public.orders where status <> 'cancelled')                 as total_orders,
  (select count(*) from public.orders where status = 'pending')                    as pending_orders,
  (select count(*) from public.orders
     where status = 'payment_confirmed' or status = 'preparing' or status = 'shipping')
                                                                                   as active_orders,
  (select coalesce(sum(total), 0) from public.orders
     where status not in ('cancelled', 'pending'))                                 as total_revenue,
  (select count(*) from public.product_inventory
     where current_stock <= minimum_stock)                                         as low_stock_count,
  (select count(*) from public.product_inventory where current_stock = 0)          as out_of_stock_count,
  (select count(*) from public.products where is_active)                           as active_products;

grant select on public.v_admin_dashboard to authenticated;

-- ----------------------------------------------------------------------------
-- v_sales_by_day: revenue and order count per day for the last 30 days.
-- Includes zero-revenue days via generate_series so charts don't have gaps.
-- ----------------------------------------------------------------------------
create or replace view public.v_sales_by_day
  with (security_invoker = true) as
with days as (
  select generate_series(
    (current_date - interval '29 days')::date,
    current_date,
    interval '1 day'
  )::date as day
),
agg as (
  select
    date_trunc('day', created_at at time zone 'UTC')::date as day,
    count(*)::integer as orders,
    coalesce(sum(total), 0)::numeric(12,2) as revenue
  from public.orders
  where status not in ('cancelled')
    and created_at >= (current_date - interval '29 days')
  group by 1
)
select
  d.day,
  coalesce(a.orders, 0) as orders,
  coalesce(a.revenue, 0)::numeric(12,2) as revenue
from days d
left join agg a on a.day = d.day
order by d.day asc;

grant select on public.v_sales_by_day to authenticated;

-- ----------------------------------------------------------------------------
-- v_best_sellers: top products by units sold on confirmed orders.
-- ----------------------------------------------------------------------------
create or replace view public.v_best_sellers
  with (security_invoker = true) as
select
  p.id as product_id,
  p.name,
  p.slug,
  p.images,
  p.category,
  sum(oi.quantity)::integer            as total_sold,
  sum(oi.quantity * oi.price)::numeric(12,2) as total_revenue
from public.order_items oi
join public.orders o   on o.id = oi.order_id
join public.products p on p.id = oi.product_id
where o.status not in ('cancelled', 'pending')
group by p.id, p.name, p.slug, p.images, p.category
order by total_sold desc, total_revenue desc;

grant select on public.v_best_sellers to authenticated;

-- ----------------------------------------------------------------------------
-- v_low_stock_products: low-stock + out-of-stock items, sorted by criticality.
-- ----------------------------------------------------------------------------
create or replace view public.v_low_stock_products
  with (security_invoker = true) as
select
  p.id as product_id,
  p.name,
  p.slug,
  p.category,
  pi.current_stock,
  pi.minimum_stock,
  (pi.current_stock = 0) as is_out_of_stock
from public.product_inventory pi
join public.products p on p.id = pi.product_id
where pi.current_stock <= pi.minimum_stock
  and p.is_active
order by pi.current_stock asc, pi.minimum_stock - pi.current_stock desc;

grant select on public.v_low_stock_products to authenticated;

-- ============================================
-- database/migrations/0013_product_images_storage.sql
-- ============================================

-- 0013_product_images_storage.sql
-- Storage bucket for product catalog images. Public read, staff write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  8388608, -- 8 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_images_select_public" on storage.objects;
create policy "product_images_select_public"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product_images_insert_staff" on storage.objects;
create policy "product_images_insert_staff"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_staff());

drop policy if exists "product_images_modify_staff" on storage.objects;
create policy "product_images_modify_staff"
  on storage.objects for all
  using (bucket_id = 'product-images' and public.is_staff())
  with check (bucket_id = 'product-images' and public.is_staff());

-- ============================================
-- database/migrations/0014_notifications_audience.sql
-- ============================================

-- 0014_notifications_audience.sql
-- Adds `audience` so we can distinguish broadcast-to-all vs staff-only.
-- Existing rows default to 'all' (matches previous broadcast semantics).

do $$ begin
  create type public.notification_audience as enum ('all', 'staff');
exception when duplicate_object then null; end $$;

alter table public.notifications
  add column if not exists audience public.notification_audience not null default 'all';

create index if not exists notifications_audience_idx
  on public.notifications(audience, created_at desc)
  where user_id is null;

-- Update RLS: a user can see a notification if it targets them, or it's a
-- broadcast to 'all', or it's a staff-only broadcast and they're staff.

drop policy if exists notifications_select_visible on public.notifications;
create policy notifications_select_visible on public.notifications
  for select
  using (
    user_id = auth.uid()
    or (user_id is null and audience = 'all')
    or (user_id is null and audience = 'staff' and public.is_staff())
    or public.is_staff()
  );

-- ============================================
-- database/migrations/0015_notifications_triggers.sql
-- ============================================

-- 0015_notifications_triggers.sql
-- Auto-create notifications on key events:
--   * orders INSERT          → staff-broadcast "New order"
--   * orders status UPDATE   → user-targeted (if user_id set) order update
--   * product_inventory.current_stock crosses min → staff-broadcast low stock

create or replace function public.notify_new_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, audience, title, message, type, metadata)
  values (
    null,
    'staff',
    'New order',
    format(
      'From %s · $%s · %s',
      new.customer_name,
      to_char(new.total, 'FM999990.00'),
      new.payment_method
    ),
    'order',
    jsonb_build_object('order_id', new.id, 'status', new.status::text)
  );
  return new;
end $$;

drop trigger if exists notify_new_order_trg on public.orders;
create trigger notify_new_order_trg
  after insert on public.orders
  for each row execute function public.notify_new_order();

-- ---------------------------------------------------------------------------
create or replace function public.notify_order_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_message text;
begin
  if new.status is distinct from old.status then
    if new.user_id is not null then
      v_message := case new.status
        when 'payment_confirmed' then 'Your payment was confirmed.'
        when 'preparing'         then 'We''re preparing your order.'
        when 'shipping'          then 'Your order is on the way.'
        when 'delivered'         then 'Your order was delivered. Thank you!'
        when 'cancelled'         then 'Your order was cancelled.'
        else format('Order status: %s', replace(new.status::text, '_', ' '))
      end;

      insert into public.notifications (user_id, audience, title, message, type, metadata)
      values (
        new.user_id,
        'all',
        'Order update',
        v_message,
        'order',
        jsonb_build_object('order_id', new.id, 'status', new.status::text)
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists notify_order_status_trg on public.orders;
create trigger notify_order_status_trg
  after update of status on public.orders
  for each row execute function public.notify_order_status_change();

-- ---------------------------------------------------------------------------
-- Fire only on the *transition* from healthy → low/out, to avoid spam.
create or replace function public.notify_low_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_was_healthy boolean;
  v_now_low     boolean;
  v_name        text;
begin
  v_was_healthy := old.current_stock > old.minimum_stock;
  v_now_low     := new.current_stock <= new.minimum_stock;

  if v_was_healthy and v_now_low then
    select name into v_name from public.products where id = new.product_id;
    insert into public.notifications (user_id, audience, title, message, type, metadata)
    values (
      null,
      'staff',
      case when new.current_stock = 0 then 'Out of stock' else 'Low stock' end,
      format('%s · %s on hand · min %s',
        coalesce(v_name, 'Product'),
        new.current_stock,
        new.minimum_stock
      ),
      'inventory',
      jsonb_build_object(
        'product_id', new.product_id,
        'current_stock', new.current_stock,
        'minimum_stock', new.minimum_stock
      )
    );
  end if;
  return new;
end $$;

drop trigger if exists notify_low_stock_trg on public.product_inventory;
create trigger notify_low_stock_trg
  after update of current_stock, minimum_stock on public.product_inventory
  for each row execute function public.notify_low_stock();

-- ============================================
-- database/migrations/0016_coupons.sql
-- ============================================

-- 0016_coupons.sql
-- Coupons / discount codes.
--
-- Design notes:
--   - `code` is stored uppercase and unique. The validate path normalizes
--     user input to upper before lookup.
--   - `discount_type = percent` ⇒ value in [1..100]. `fixed` ⇒ flat USD off.
--   - `max_redemptions` null = unlimited. Atomic increment guarded by
--     `redeemed_count < max_redemptions` so a single SQL UPDATE rejects
--     overshoot under race.
--   - orders gain `coupon_id`, `coupon_code`, `discount`. The total-matches
--     CHECK is replaced to include discount.

do $$ begin
  create type public.coupon_discount_type as enum ('percent', 'fixed');
exception when duplicate_object then null;
end $$;

create table if not exists public.coupons (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  discount_type    public.coupon_discount_type not null,
  discount_value   numeric(10,2) not null check (discount_value > 0),
  min_subtotal     numeric(10,2) not null default 0 check (min_subtotal >= 0),
  max_redemptions  integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count   integer not null default 0 check (redeemed_count >= 0),
  starts_at        timestamptz,
  expires_at       timestamptz,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint coupons_code_uppercase
    check (code = upper(code) and length(code) between 3 and 32),
  constraint coupons_percent_bounds
    check (
      discount_type <> 'percent'
      or (discount_value > 0 and discount_value <= 100)
    ),
  constraint coupons_redeem_count_le_max
    check (max_redemptions is null or redeemed_count <= max_redemptions),
  constraint coupons_window_valid
    check (starts_at is null or expires_at is null or starts_at < expires_at)
);

create index if not exists coupons_active_idx
  on public.coupons(is_active, expires_at);

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- orders.discount + coupon link
-- ----------------------------------------------------------------------------
alter table public.orders
  add column if not exists coupon_id   uuid references public.coupons(id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists discount    numeric(10,2) not null default 0 check (discount >= 0);

-- Drop the old check that excluded discount.
alter table public.orders drop constraint if exists orders_total_matches;
alter table public.orders
  add constraint orders_total_matches
  check (total = subtotal + shipping_fee - discount and total >= 0);

create index if not exists orders_coupon_id_idx on public.orders(coupon_id);

-- ----------------------------------------------------------------------------
-- Atomic redemption: only succeeds if coupon is currently usable.
-- Returns the resulting row, or zero rows if the redemption was rejected.
-- ----------------------------------------------------------------------------
create or replace function public.redeem_coupon(p_code text)
returns table (id uuid, code text, redeemed_count int, max_redemptions int)
language sql security definer set search_path = public as $$
  update public.coupons c
     set redeemed_count = c.redeemed_count + 1
   where c.code = upper(p_code)
     and c.is_active
     and (c.starts_at is null or c.starts_at <= now())
     and (c.expires_at is null or c.expires_at > now())
     and (c.max_redemptions is null or c.redeemed_count < c.max_redemptions)
  returning c.id, c.code, c.redeemed_count, c.max_redemptions;
$$;

grant execute on function public.redeem_coupon(text) to authenticated, anon;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.coupons enable row level security;

drop policy if exists coupons_select_active_or_staff on public.coupons;
create policy coupons_select_active_or_staff on public.coupons
  for select
  using (
    public.is_staff()
    or (
      is_active
      and (starts_at is null or starts_at <= now())
      and (expires_at is null or expires_at > now())
    )
  );

drop policy if exists coupons_modify_staff on public.coupons;
create policy coupons_modify_staff on public.coupons
  for all
  using (public.is_staff())
  with check (public.is_staff());

-- ============================================
-- database/migrations/0017_movement_barcode_proofs.sql
-- ============================================

-- 0017_movement_barcode_proofs.sql
-- Audit-trail photo for each scan-driven inventory movement.
-- Adds inventory_movements.barcode_image_url, extends apply_inventory_movement
-- to persist it, and creates a staff-only 'movement-proofs' storage bucket.

alter table public.inventory_movements
  add column if not exists barcode_image_url text;

-- ----------------------------------------------------------------------------
-- Re-create apply_inventory_movement with an additional p_barcode_image_url
-- parameter. Defaulted to NULL so existing callers (manual quantity-adjustment
-- forms, the order-paid trigger) keep working without modification.
-- ----------------------------------------------------------------------------
create or replace function public.apply_inventory_movement(
  p_product_id         uuid,
  p_movement           public.movement_type,
  p_quantity           integer,
  p_notes              text default null,
  p_order_id           uuid default null,
  p_created_by         uuid default null,
  p_barcode_image_url  text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory   public.product_inventory%rowtype;
  v_delta       integer;
  v_new_stock   integer;
  v_barcode     text;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive (got %)', p_quantity
      using errcode = '22023';
  end if;

  select * into v_inventory
  from public.product_inventory
  where product_id = p_product_id
  for update;

  if not found then
    raise exception 'no inventory row for product %', p_product_id
      using errcode = 'P0002';
  end if;

  if p_movement = 'in' then
    v_delta := p_quantity;
  elsif p_movement = 'out' then
    v_delta := -p_quantity;
  elsif p_movement = 'adjustment' then
    v_delta := p_quantity - v_inventory.current_stock;
  end if;

  v_new_stock := v_inventory.current_stock + v_delta;

  if v_new_stock < 0 then
    raise exception 'insufficient stock: have %, requested %',
      v_inventory.current_stock, p_quantity
      using errcode = '23514';
  end if;

  v_barcode := v_inventory.barcode;

  if v_delta = 0 then
    return v_new_stock;
  end if;

  insert into public.inventory_movements (
    product_id, barcode, movement_type, quantity, resulting_stock,
    order_id, created_by, notes, barcode_image_url
  ) values (
    p_product_id,
    v_barcode,
    p_movement,
    abs(v_delta),
    v_new_stock,
    p_order_id,
    p_created_by,
    p_notes,
    p_barcode_image_url
  );

  update public.product_inventory
     set current_stock = v_new_stock,
         updated_at    = now()
   where product_id   = p_product_id;

  return v_new_stock;
end $$;

revoke all on function public.apply_inventory_movement(uuid, public.movement_type, integer, text, uuid, uuid, text) from public;
grant execute on function public.apply_inventory_movement(uuid, public.movement_type, integer, text, uuid, uuid, text) to authenticated;

-- ============================================
-- database/migrations/0018_movement_proofs_storage.sql
-- ============================================

-- 0018_movement_proofs_storage.sql
-- Storage bucket for scan-flow barcode-proof photos. Staff-only — these are
-- internal audit records, not customer-facing assets.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'movement-proofs',
  'movement-proofs',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "movement_proofs_select_public" on storage.objects;
create policy "movement_proofs_select_public"
  on storage.objects for select
  using (bucket_id = 'movement-proofs');

drop policy if exists "movement_proofs_insert_staff" on storage.objects;
create policy "movement_proofs_insert_staff"
  on storage.objects for insert
  with check (bucket_id = 'movement-proofs' and public.is_staff());

drop policy if exists "movement_proofs_modify_staff" on storage.objects;
create policy "movement_proofs_modify_staff"
  on storage.objects for all
  using (bucket_id = 'movement-proofs' and public.is_staff())
  with check (bucket_id = 'movement-proofs' and public.is_staff());

-- 0019_payment_method_cash.sql
-- Add 'cash' to the payment_method enum so staff can record in-store
-- counter sales (POS) where money is taken at the till.

do $$ begin
  alter type public.payment_method add value if not exists 'cash';
exception when duplicate_object then null; end $$;
-- 0020_loyalty_points.sql
-- Loyalty points system.
--
-- Design:
--   - 1 point earned per $1 of order total (rounded down), credited when
--     order status reaches 'delivered'.
--   - 100 points = $1 discount at checkout (POINTS_PER_DOLLAR_CREDIT = 100).
--   - Max redemption: 50 % of order subtotal (enforced in app layer).
--   - Points balance lives on profiles.loyalty_points for fast reads.
--   - loyalty_transactions is the audit log (earn / redeem / expire / manual).
--   - orders.points_redeemed records how many points were spent (informational).
--     The monetary value is folded into the existing orders.discount column.

-- ----------------------------------------------------------------------------
-- profiles: add loyalty_points balance
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists loyalty_points integer not null default 0
    check (loyalty_points >= 0);

-- ----------------------------------------------------------------------------
-- loyalty_transactions: audit log
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.loyalty_transaction_type
    as enum ('earn', 'redeem', 'expire', 'manual');
exception when duplicate_object then null;
end $$;

create table if not exists public.loyalty_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  type        public.loyalty_transaction_type not null,
  points      integer not null,        -- positive = earned/added, negative = spent
  balance_after integer not null,      -- snapshot of balance after this txn
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists loyalty_txn_user_idx
  on public.loyalty_transactions(user_id, created_at desc);

create index if not exists loyalty_txn_order_idx
  on public.loyalty_transactions(order_id);

-- ----------------------------------------------------------------------------
-- orders: track points spent per order
-- ----------------------------------------------------------------------------
alter table public.orders
  add column if not exists points_redeemed integer not null default 0
    check (points_redeemed >= 0);

-- ----------------------------------------------------------------------------
-- Function: earn_loyalty_points
-- Called after order reaches 'delivered'. Idempotent (skips if txn exists).
-- ----------------------------------------------------------------------------
create or replace function public.earn_loyalty_points(
  p_user_id  uuid,
  p_order_id uuid,
  p_total    numeric
) returns integer          -- returns points earned (0 if already awarded)
language plpgsql security definer set search_path = public as $$
declare
  v_points   integer := floor(p_total)::integer;   -- 1 pt per $1
  v_balance  integer;
begin
  if v_points <= 0 then
    return 0;
  end if;

  -- Idempotent: bail if we already awarded points for this order.
  if exists (
    select 1 from public.loyalty_transactions
     where order_id = p_order_id and type = 'earn'
  ) then
    return 0;
  end if;

  -- Increment balance.
  update public.profiles
     set loyalty_points = loyalty_points + v_points
   where id = p_user_id
  returning loyalty_points into v_balance;

  if not found then
    return 0;
  end if;

  -- Write audit row.
  insert into public.loyalty_transactions
    (user_id, order_id, type, points, balance_after)
  values
    (p_user_id, p_order_id, 'earn', v_points, v_balance);

  return v_points;
end;
$$;

grant execute on function public.earn_loyalty_points(uuid, uuid, numeric)
  to authenticated;

-- ----------------------------------------------------------------------------
-- Function: redeem_loyalty_points
-- Atomic deduction. Returns new balance, or -1 if insufficient points.
-- ----------------------------------------------------------------------------
create or replace function public.redeem_loyalty_points(
  p_user_id  uuid,
  p_order_id uuid,
  p_points   integer
) returns integer           -- new balance, or -1 on failure
language plpgsql security definer set search_path = public as $$
declare
  v_balance integer;
begin
  if p_points <= 0 then
    return -1;
  end if;

  update public.profiles
     set loyalty_points = loyalty_points - p_points
   where id = p_user_id
     and loyalty_points >= p_points
  returning loyalty_points into v_balance;

  if not found then
    return -1;
  end if;

  insert into public.loyalty_transactions
    (user_id, order_id, type, points, balance_after)
  values
    (p_user_id, p_order_id, 'redeem', -p_points, v_balance);

  return v_balance;
end;
$$;

grant execute on function public.redeem_loyalty_points(uuid, uuid, integer)
  to authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.loyalty_transactions enable row level security;

drop policy if exists loyalty_txn_select_own on public.loyalty_transactions;
create policy loyalty_txn_select_own on public.loyalty_transactions
  for select
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists loyalty_txn_modify_staff on public.loyalty_transactions;
create policy loyalty_txn_modify_staff on public.loyalty_transactions
  for all
  using (public.is_staff())
  with check (public.is_staff());
-- 0021_drop_old_apply_inventory_movement.sql
-- Migration 0017 added a 7-arg overload of apply_inventory_movement (with
-- p_barcode_image_url). Because `create or replace function` only replaces a
-- function when the argument signature matches exactly, the original 6-arg
-- version from migration 0007 was left in place as a second overload.
--
-- Both overloads default all trailing args to NULL, so a 6-arg call (e.g. from
-- apply_order_inventory → on_order_status_change) is ambiguous and Postgres
-- raises:
--   function public.apply_inventory_movement(uuid, movement_type, integer,
--     text, uuid, uuid) is not unique
-- which blocks the admin from advancing an order to "payment_confirmed".
--
-- Drop the stale 6-arg overload so the 7-arg version from 0017 is the only one.

drop function if exists public.apply_inventory_movement(
  uuid,
  public.movement_type,
  integer,
  text,
  uuid,
  uuid
);

-- 0022_allow_adjustment_to_zero.sql
-- The function body in 0017 rejected p_quantity <= 0, which made it impossible
-- to use 'adjustment' to set a product's on-hand count to 0 (a legitimate
-- inventory correction — e.g. discarding spoiled stock). For 'adjustment',
-- p_quantity is the absolute target stock, so 0 must be allowed; for 'in' and
-- 'out' we still require a positive quantity since 0 is a no-op.

create or replace function public.apply_inventory_movement(
  p_product_id         uuid,
  p_movement           public.movement_type,
  p_quantity           integer,
  p_notes              text default null,
  p_order_id           uuid default null,
  p_created_by         uuid default null,
  p_barcode_image_url  text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory   public.product_inventory%rowtype;
  v_delta       integer;
  v_new_stock   integer;
  v_barcode     text;
begin
  if p_quantity is null then
    raise exception 'quantity is required'
      using errcode = '22023';
  end if;

  if p_movement in ('in', 'out') and p_quantity <= 0 then
    raise exception 'quantity must be positive for % movements (got %)',
      p_movement, p_quantity
      using errcode = '22023';
  end if;

  if p_movement = 'adjustment' and p_quantity < 0 then
    raise exception 'adjustment target stock cannot be negative (got %)',
      p_quantity
      using errcode = '22023';
  end if;

  select * into v_inventory
  from public.product_inventory
  where product_id = p_product_id
  for update;

  if not found then
    raise exception 'no inventory row for product %', p_product_id
      using errcode = 'P0002';
  end if;

  if p_movement = 'in' then
    v_delta := p_quantity;
  elsif p_movement = 'out' then
    v_delta := -p_quantity;
  elsif p_movement = 'adjustment' then
    v_delta := p_quantity - v_inventory.current_stock;
  end if;

  v_new_stock := v_inventory.current_stock + v_delta;

  if v_new_stock < 0 then
    raise exception 'insufficient stock: have %, requested %',
      v_inventory.current_stock, p_quantity
      using errcode = '23514';
  end if;

  v_barcode := v_inventory.barcode;

  if v_delta = 0 then
    return v_new_stock;
  end if;

  insert into public.inventory_movements (
    product_id, barcode, movement_type, quantity, resulting_stock,
    order_id, created_by, notes, barcode_image_url
  ) values (
    p_product_id,
    v_barcode,
    p_movement,
    abs(v_delta),
    v_new_stock,
    p_order_id,
    p_created_by,
    p_notes,
    p_barcode_image_url
  );

  update public.product_inventory
     set current_stock = v_new_stock,
         updated_at    = now()
   where product_id   = p_product_id;

  return v_new_stock;
end $$;

-- 0023_align_sales_view_and_restock_on_cancel.sql
--
-- Two related fixes for the order lifecycle:
--
-- 1) v_sales_by_day previously included 'pending' orders, but
--    v_admin_dashboard.total_revenue excluded them. The chart and the headline
--    KPI disagreed for any unconfirmed order. Treat "revenue" consistently as
--    paid orders only (exclude 'cancelled' AND 'pending').
--
-- 2) Cancelling an order that already deducted inventory left the stock
--    permanently low — the trigger from 0007 only handles the forward path
--    (pending -> payment_confirmed). Extend on_order_status_change so a
--    transition to 'cancelled' with inventory_applied = true generates
--    offsetting 'in' movements (one per line item) and flips
--    inventory_applied back to false, so the put-back is itself idempotent.

-- ----------------------------------------------------------------------------
-- (1) Align v_sales_by_day with v_admin_dashboard.total_revenue
-- ----------------------------------------------------------------------------
create or replace view public.v_sales_by_day
  with (security_invoker = true) as
with days as (
  select generate_series(
    (current_date - interval '29 days')::date,
    current_date,
    interval '1 day'
  )::date as day
),
agg as (
  select
    date_trunc('day', created_at at time zone 'UTC')::date as day,
    count(*)::integer as orders,
    coalesce(sum(total), 0)::numeric(12,2) as revenue
  from public.orders
  where status not in ('cancelled', 'pending')
    and created_at >= (current_date - interval '29 days')
  group by 1
)
select
  d.day,
  coalesce(a.orders, 0) as orders,
  coalesce(a.revenue, 0)::numeric(12,2) as revenue
from days d
left join agg a on a.day = d.day
order by d.day asc;

grant select on public.v_sales_by_day to authenticated;

-- ----------------------------------------------------------------------------
-- (2) Restore inventory when a confirmed order is cancelled
-- ----------------------------------------------------------------------------
create or replace function public.restock_cancelled_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_applied boolean;
  v_user    uuid;
  v_item    record;
begin
  select inventory_applied, user_id
    into v_applied, v_user
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'order % not found', p_order_id using errcode = 'P0002';
  end if;

  -- Nothing to restore if stock was never deducted.
  if not v_applied then
    return;
  end if;

  for v_item in
    select product_id, quantity
      from public.order_items
     where order_id = p_order_id
  loop
    perform public.apply_inventory_movement(
      v_item.product_id,
      'in'::public.movement_type,
      v_item.quantity,
      'cancel ' || p_order_id::text,
      p_order_id,
      v_user
    );
  end loop;

  update public.orders
     set inventory_applied = false
   where id = p_order_id;
end $$;

revoke all on function public.restock_cancelled_order(uuid) from public;
grant execute on function public.restock_cancelled_order(uuid) to authenticated;

-- Replace on_order_status_change to fan out forward and backward transitions.
create or replace function public.on_order_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'payment_confirmed'
     and (old.status is distinct from 'payment_confirmed')
     and not new.inventory_applied
  then
    perform public.apply_order_inventory(new.id);
  end if;

  if new.status = 'cancelled'
     and (old.status is distinct from 'cancelled')
     and new.inventory_applied
  then
    perform public.restock_cancelled_order(new.id);
  end if;

  return new;
end $$;

-- Trigger definition from 0007 already binds to this function; no need to
-- re-create the trigger itself.
