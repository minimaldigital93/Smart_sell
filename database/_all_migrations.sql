-- ============================================================
-- _all_migrations.sql — generated bundle of every migration
-- in database/migrations/, concatenated in numeric order.
-- Run this whole file once against a fresh database.
-- Do not edit by hand; regenerate from the migration files.
-- ============================================================


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


-- ============================================
-- database/migrations/0019_payment_method_cash.sql
-- ============================================

-- 0019_payment_method_cash.sql
-- Add 'cash' to the payment_method enum so staff can record in-store
-- counter sales (POS) where money is taken at the till.

do $$ begin
  alter type public.payment_method add value if not exists 'cash';
exception when duplicate_object then null; end $$;


-- ============================================
-- database/migrations/0020_loyalty_points.sql
-- ============================================

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


-- ============================================
-- database/migrations/0021_drop_old_apply_inventory_movement.sql
-- ============================================

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


-- ============================================
-- database/migrations/0022_allow_adjustment_to_zero.sql
-- ============================================

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


-- ============================================
-- database/migrations/0023_align_sales_view_and_restock_on_cancel.sql
-- ============================================

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


-- ============================================
-- database/migrations/0024_order_integrity_and_credit_refunds.sql
-- ============================================

-- 0024_order_integrity_and_credit_refunds.sql
--
-- Closes a cluster of order-integrity gaps surfaced by the business-flow audit:
--
--   #1 Overselling   — orders were accepted with no stock check; the failure
--                      only surfaced at payment_confirmed, AFTER the customer
--                      had paid. The new RPC validates stock up front.
--   #2 Price forgery — orders.insert was open to customers via RLS, and nothing
--                      validated line prices / subtotal against the catalog. A
--                      direct PostgREST call with the public anon key could buy
--                      an $80 item for $0.01. We now (a) force order_items.price
--                      to the catalog value via trigger, and (b) revoke direct
--                      customer INSERT on orders/order_items so customer orders
--                      can ONLY be created through create_customer_order, which
--                      recomputes every monetary field server-side.
--   #4 Cancel refund — restock_cancelled_order put inventory back but never
--                      returned spent loyalty points or released the coupon.
--                      refund_order_credits now does both, idempotently, and is
--                      wired into the cancel branch (works even when cancelling
--                      from 'pending', where inventory was never deducted).
--   #5 Double-spend  — points/coupon were redeemed best-effort AFTER the order
--                      was persisted, so two concurrent orders could both keep
--                      the discount. create_customer_order redeems inside the
--                      same transaction as the insert, so a lost race rolls the
--                      whole order back.
--
-- NOTE: c_shipping_fee below mirrors SHIPPING_FEE_DEFAULT in
-- src/lib/constants.ts. Keep them in sync.

-- ----------------------------------------------------------------------------
-- (A) Defense-in-depth: force order_items.price + name to the catalog value.
--     Applies to ALL inserts (POS, RPC, anything), so no row can be underpriced
--     or have a spoofed name regardless of how it was inserted.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_order_item_price() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_price    numeric(10,2);
  v_discount numeric(10,2);
  v_active   boolean;
  v_name     text;
  v_unit     numeric(10,2);
begin
  select price, discount_price, is_active, name
    into v_price, v_discount, v_active, v_name
    from public.products
   where id = new.product_id;

  if not found then
    raise exception 'product % does not exist', new.product_id
      using errcode = '23503';
  end if;
  if not v_active then
    raise exception '% is not available', v_name using errcode = '23514';
  end if;

  v_unit := case
    when v_discount is not null and v_discount > 0 and v_discount < v_price
      then v_discount
    else v_price
  end;

  if v_unit is null or v_unit <= 0 then
    raise exception '% has no price set', v_name using errcode = '23514';
  end if;

  new.price        := v_unit;   -- authoritative; ignore client-supplied value
  new.product_name := v_name;
  return new;
end $$;

drop trigger if exists order_items_enforce_price on public.order_items;
create trigger order_items_enforce_price
  before insert on public.order_items
  for each row execute function public.enforce_order_item_price();

-- ----------------------------------------------------------------------------
-- (B) Lock down direct inserts. Customers must go through the RPC below; only
--     staff (POS) may insert orders/items directly. The RPC is SECURITY
--     DEFINER and runs as the table owner, so it bypasses these policies.
-- ----------------------------------------------------------------------------
drop policy if exists orders_insert_self on public.orders;
create policy orders_insert_staff_only on public.orders
  for insert
  with check (public.is_staff());

drop policy if exists order_items_insert_with_order on public.order_items;
create policy order_items_insert_staff_only on public.order_items
  for insert
  with check (public.is_staff());

-- ----------------------------------------------------------------------------
-- (C) create_customer_order: the single, server-authoritative path for
--     customer + guest checkout. Validates products, recomputes prices, checks
--     stock, validates + redeems coupon and loyalty points — all in ONE
--     transaction. Returns { order_id, total }.
--
--     Stock failures raise 'INSUFFICIENT_STOCK:<name>' so the app can show a
--     friendly per-item message.
-- ----------------------------------------------------------------------------
create or replace function public.create_customer_order(
  p_order_id       uuid,
  p_customer_name  text,
  p_phone          text,
  p_address        text,
  p_note           text,
  p_payment_method public.payment_method,
  p_payment_image  text,
  p_items          jsonb,
  p_coupon_code    text default null,
  p_points         integer default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_shipping_fee constant numeric(10,2) := 2;  -- mirrors SHIPPING_FEE_DEFAULT
  v_user          uuid := auth.uid();
  v_item          jsonb;
  v_pid           uuid;
  v_qty           integer;
  v_prod          record;
  v_unit          numeric(10,2);
  v_subtotal      numeric(10,2) := 0;
  v_coupon        record;
  v_coupon_disc   numeric(10,2) := 0;
  v_coupon_id     uuid := null;
  v_coupon_code   text := null;
  v_avail         integer;
  v_capped_pts    integer := 0;
  v_pts_disc      numeric(10,2) := 0;
  v_pts_redeem    integer := 0;
  v_max_by_ratio  numeric(10,2);
  v_remaining     numeric(10,2);
  v_discount      numeric(10,2);
  v_total         numeric(10,2);
  v_bal           integer;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'cart is empty' using errcode = '22023';
  end if;

  -- 1. Validate every line, lock its inventory row, recompute price, check stock.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid quantity' using errcode = '22023';
    end if;

    select p.name, p.price, p.discount_price, p.is_active, i.current_stock
      into v_prod
      from public.products p
      join public.product_inventory i on i.product_id = p.id
     where p.id = v_pid
     for update of i;

    if not found then
      raise exception 'a product in your cart is unavailable'
        using errcode = 'P0002';
    end if;
    if not v_prod.is_active then
      raise exception '% is no longer available', v_prod.name
        using errcode = '23514';
    end if;

    v_unit := case
      when v_prod.discount_price is not null and v_prod.discount_price > 0
           and v_prod.discount_price < v_prod.price
        then v_prod.discount_price
      else v_prod.price
    end;
    if v_unit is null or v_unit <= 0 then
      raise exception '% has no price set', v_prod.name using errcode = '23514';
    end if;
    if v_prod.current_stock < v_qty then
      raise exception 'INSUFFICIENT_STOCK:%', v_prod.name using errcode = '23514';
    end if;

    v_subtotal := v_subtotal + (v_unit * v_qty);
  end loop;

  v_subtotal := round(v_subtotal, 2);

  -- 2. Coupon: validate against the catalog rules and reserve a redemption.
  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon
      from public.coupons
     where code = upper(trim(p_coupon_code))
       and is_active
       and (starts_at is null or starts_at <= now())
       and (expires_at is null or expires_at > now())
     for update;

    if not found then
      raise exception 'COUPON_INVALID' using errcode = '23514';
    end if;
    if v_coupon.max_redemptions is not null
       and v_coupon.redeemed_count >= v_coupon.max_redemptions then
      raise exception 'COUPON_LIMIT' using errcode = '23514';
    end if;
    if v_subtotal < v_coupon.min_subtotal then
      raise exception 'COUPON_MIN:%', v_coupon.min_subtotal using errcode = '23514';
    end if;

    v_coupon_disc := least(
      case when v_coupon.discount_type = 'percent'
           then round(v_subtotal * v_coupon.discount_value / 100, 2)
           else v_coupon.discount_value end,
      v_subtotal);
    v_coupon_id   := v_coupon.id;
    v_coupon_code := v_coupon.code;

    update public.coupons
       set redeemed_count = redeemed_count + 1, updated_at = now()
     where id = v_coupon.id
       and (max_redemptions is null or redeemed_count < max_redemptions);
    if not found then
      raise exception 'COUPON_LIMIT' using errcode = '23514';
    end if;
  end if;

  -- 3. Loyalty points: cap to balance + ratio, deduct atomically.
  if p_points > 0 and v_user is not null then
    select loyalty_points into v_avail
      from public.profiles where id = v_user for update;
    v_avail := coalesce(v_avail, 0);
    v_capped_pts := least(p_points, v_avail);
    if v_capped_pts > 0 then
      v_max_by_ratio := round(v_subtotal * 0.5, 2);
      v_remaining    := greatest(0, round(v_subtotal + c_shipping_fee - v_coupon_disc, 2));
      v_pts_disc     := least(round(v_capped_pts::numeric / 100, 2),
                              v_max_by_ratio, v_remaining);
      v_pts_redeem   := ceil(v_pts_disc * 100)::integer;
    end if;

    if v_pts_redeem > 0 then
      update public.profiles
         set loyalty_points = loyalty_points - v_pts_redeem
       where id = v_user and loyalty_points >= v_pts_redeem
      returning loyalty_points into v_bal;
      if not found then
        raise exception 'POINTS_CHANGED' using errcode = '23514';
      end if;
      insert into public.loyalty_transactions
        (user_id, order_id, type, points, balance_after, note)
      values
        (v_user, p_order_id, 'redeem', -v_pts_redeem, v_bal, 'checkout redemption');
    end if;
  end if;

  -- 4. Final money math. Defense in depth against the total-matches CHECK.
  v_discount := round(v_coupon_disc + v_pts_disc, 2);
  if v_discount > round(v_subtotal + c_shipping_fee, 2) then
    v_discount := round(v_subtotal + c_shipping_fee, 2);
  end if;
  v_total := round(v_subtotal + c_shipping_fee - v_discount, 2);

  -- 5. Persist order + items. The enforce_order_item_price trigger re-asserts
  --    each line price, so these inserts cannot drift from the catalog.
  insert into public.orders (
    id, user_id, customer_name, phone, address, note,
    subtotal, shipping_fee, discount, total,
    payment_method, payment_image, coupon_id, coupon_code, points_redeemed
  ) values (
    p_order_id, v_user, p_customer_name, p_phone, p_address,
    nullif(trim(coalesce(p_note, '')), ''),
    v_subtotal, c_shipping_fee, v_discount, v_total,
    p_payment_method, p_payment_image, v_coupon_id, v_coupon_code, v_pts_redeem
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (order_id, product_id, product_name, quantity, price)
    values (
      p_order_id,
      (v_item->>'product_id')::uuid,
      'pending',                              -- overwritten by trigger
      (v_item->>'quantity')::integer,
      0                                       -- overwritten by trigger
    );
  end loop;

  return jsonb_build_object('order_id', p_order_id, 'total', v_total);
end $$;

revoke all on function public.create_customer_order(
  uuid, text, text, text, text, public.payment_method, text, jsonb, text, integer
) from public;
grant execute on function public.create_customer_order(
  uuid, text, text, text, text, public.payment_method, text, jsonb, text, integer
) to authenticated, anon;

-- ----------------------------------------------------------------------------
-- (D) Refund spent points + release coupon when an order is cancelled.
--     Idempotent via orders.credits_refunded; independent of inventory_applied
--     so it also fires when cancelling a still-'pending' order.
-- ----------------------------------------------------------------------------
alter table public.orders
  add column if not exists credits_refunded boolean not null default false;

create or replace function public.unredeem_coupon(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.coupons
     set redeemed_count = greatest(redeemed_count - 1, 0), updated_at = now()
   where code = upper(p_code);
end $$;
revoke all on function public.unredeem_coupon(text) from public;
grant execute on function public.unredeem_coupon(text) to authenticated;

create or replace function public.refund_order_credits(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pts   integer;
  v_user  uuid;
  v_cid   uuid;
  v_done  boolean;
  v_bal   integer;
begin
  -- Target the coupon by its stable id, not the code snapshot — staff may have
  -- renamed the coupon since this order redeemed it.
  select points_redeemed, user_id, coupon_id, credits_refunded
    into v_pts, v_user, v_cid, v_done
    from public.orders where id = p_order_id for update;

  if not found or v_done then
    return;
  end if;

  if v_pts > 0 and v_user is not null then
    update public.profiles
       set loyalty_points = loyalty_points + v_pts
     where id = v_user
    returning loyalty_points into v_bal;
    if found then
      insert into public.loyalty_transactions
        (user_id, order_id, type, points, balance_after, note)
      values
        (v_user, p_order_id, 'manual', v_pts, v_bal, 'refund: order cancelled');
    end if;
  end if;

  if v_cid is not null then
    update public.coupons
       set redeemed_count = greatest(redeemed_count - 1, 0), updated_at = now()
     where id = v_cid;
  end if;

  update public.orders set credits_refunded = true where id = p_order_id;
end $$;
revoke all on function public.refund_order_credits(uuid) from public;
grant execute on function public.refund_order_credits(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- (E) Wire credit refunds into the cancel branch (alongside restock).
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

  if new.status = 'cancelled'
     and (old.status is distinct from 'cancelled')
  then
    if new.inventory_applied then
      perform public.restock_cancelled_order(new.id);
    end if;
    perform public.refund_order_credits(new.id);
  end if;

  return new;
end $$;


-- ============================================
-- database/migrations/0025_private_media_buckets.sql
-- ============================================

-- 0025_private_media_buckets.sql
--
-- Audit findings #7 + #9: sensitive media was world-readable.
--
--   payment-proofs  — KHQR / bank-transfer receipts (financial PII). Was a
--                     public bucket relying only on unguessable UUID paths.
--   movement-proofs — internal barcode/scan audit photos that the migration
--                     itself described as "staff-only" but were public.
--
-- Both are flipped to private. Reads now require a signed URL minted under the
-- viewer's session (see src/lib/storage/signed-url.ts):
--   * payment-proofs : the order owner OR staff
--   * movement-proofs: staff only
-- Uploads are unchanged (anon may still upload payment proofs for guest
-- checkout; staff upload movement proofs).

-- ----------------------------------------------------------------------------
-- payment-proofs -> private, owner-or-staff read
-- ----------------------------------------------------------------------------
update storage.buckets set public = false where id = 'payment-proofs';

-- Read access is keyed off ORDER ownership, not storage.objects.owner: the
-- screenshot is uploaded by the service-role client (see migration 0027), so
-- `owner` is not the customer. The object path is `<order_id>/<file>`, so the
-- first path segment maps back to the owning order.
drop policy if exists "payment_proofs_select_public" on storage.objects;
drop policy if exists "payment_proofs_select_owner_or_staff" on storage.objects;
create policy "payment_proofs_select_owner_or_staff"
  on storage.objects for select
  using (
    bucket_id = 'payment-proofs'
    and (
      public.is_staff()
      or exists (
        select 1 from public.orders o
         where o.user_id = auth.uid()
           and o.id::text = split_part(name, '/', 1)
      )
    )
  );

-- ----------------------------------------------------------------------------
-- movement-proofs -> private, staff read
-- ----------------------------------------------------------------------------
update storage.buckets set public = false where id = 'movement-proofs';

drop policy if exists "movement_proofs_select_public" on storage.objects;
drop policy if exists "movement_proofs_select_staff" on storage.objects;
create policy "movement_proofs_select_staff"
  on storage.objects for select
  using (bucket_id = 'movement-proofs' and public.is_staff());


-- ============================================
-- database/migrations/0026_rate_limits.sql
-- ============================================

-- 0026_rate_limits.sql
--
-- Audit finding #14: the app's rate limiter was an in-process Map, so on a
-- serverless / multi-instance deploy each instance counted independently and
-- the limit never actually held (and reset on every cold start). This moves
-- the counter into Postgres so all instances share one atomic window.
--
-- The app calls check_rate_limit() and falls back to its in-memory limiter
-- only if this RPC is unreachable, so throttling degrades gracefully rather
-- than failing fully open.

create table if not exists public.rate_limits (
  key       text primary key,
  count     integer not null,
  reset_at  timestamptz not null
);

create index if not exists rate_limits_reset_idx on public.rate_limits(reset_at);

-- Only the SECURITY DEFINER function below may read/write this table.
alter table public.rate_limits enable row level security;

-- ----------------------------------------------------------------------------
-- check_rate_limit: atomic fixed-window counter.
--   * First hit in a window (or an expired window) → count = 1, fresh reset_at.
--   * Subsequent hits in-window → count + 1.
-- The whole thing is one INSERT ... ON CONFLICT statement, so concurrent
-- callers across instances serialize on the row and can't overshoot.
--
-- Returns: { allowed: bool, remaining?: int, retry_after?: int }
-- ----------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_key        text,
  p_limit      integer,
  p_window_sec integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_now   timestamptz := now();
  v_count integer;
  v_reset timestamptz;
begin
  insert into public.rate_limits as r (key, count, reset_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_sec))
  on conflict (key) do update
    set count = case
                  when r.reset_at <= v_now then 1
                  else r.count + 1
                end,
        reset_at = case
                  when r.reset_at <= v_now
                    then v_now + make_interval(secs => p_window_sec)
                  else r.reset_at
                end
  returning r.count, r.reset_at into v_count, v_reset;

  if v_count > p_limit then
    return jsonb_build_object(
      'allowed', false,
      'retry_after', greatest(1, ceil(extract(epoch from (v_reset - v_now)))::int)
    );
  end if;

  return jsonb_build_object('allowed', true, 'remaining', p_limit - v_count);
end $$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer)
  to anon, authenticated;

-- Optional housekeeping: stale rows are harmless (each key is reused via
-- upsert) but accumulate with distinct IPs over time. If you run pg_cron:
--   select cron.schedule('rate-limits-sweep', '0 * * * *',
--     $$delete from public.rate_limits where reset_at < now() - interval '1 day'$$);


-- ============================================
-- database/migrations/0027_lock_payment_proofs_upload.sql
-- ============================================

-- 0027_lock_payment_proofs_upload.sql
--
-- Audit finding #8: anyone (anon) could upload to the payment-proofs bucket via
-- a direct storage API call with the public anon key, bypassing the order
-- action's rate limit — a free way to dump 5 MB files and run up storage.
--
-- The app now writes payment screenshots through the SERVICE-ROLE client
-- (src/lib/supabase/service.ts), which bypasses RLS. So we can drop the
-- "anyone can insert" policy entirely: legitimate uploads go through the
-- service role, and no anon/authenticated client can write to this bucket.
--
-- PREREQUISITE: SUPABASE_SERVICE_ROLE_KEY must be set in the app environment
-- (already present in .env.example). Apply this AFTER deploying the app change,
-- or guest-checkout uploads will fail.

drop policy if exists "payment_proofs_insert_anyone" on storage.objects;

-- No INSERT policy for anon/authenticated remains on payment-proofs. The
-- service-role client bypasses RLS, so server-side uploads still work; staff
-- moderation (delete/replace) continues via payment_proofs_modify_staff.


-- ============================================
-- database/migrations/0028_store_settings.sql
-- ============================================

-- 0028_store_settings.sql
-- Single-row store settings: branding (name, tagline, logo), theme preset,
-- default language, currency, shipping fee, contact info. Publicly readable so
-- the storefront can render branding for anonymous visitors; admin-only writes.

create table if not exists public.store_settings (
  id             smallint primary key default 1 check (id = 1),
  business_name  text not null default 'Lumière',
  tagline        text not null default 'Cosmetic Store Management',
  logo_url       text,
  theme          text not null default 'rose',
  default_locale text not null default 'en' check (default_locale in ('en', 'km')),
  currency       text not null default 'USD',
  shipping_fee   numeric(10, 2) not null default 2 check (shipping_fee >= 0),
  contact_phone  text,
  contact_address text,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users (id) on delete set null
);

-- Singleton row so the app can always read/update id = 1.
insert into public.store_settings (id) values (1) on conflict (id) do nothing;

alter table public.store_settings enable row level security;

-- Branding is shown to everyone, including signed-out storefront visitors.
drop policy if exists store_settings_read on public.store_settings;
create policy store_settings_read on public.store_settings
  for select using (true);

-- Only admins may change settings. The singleton already exists, so an UPDATE
-- policy is sufficient; no INSERT/DELETE is exposed.
drop policy if exists store_settings_update_admin on public.store_settings;
create policy store_settings_update_admin on public.store_settings
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- Keep updated_at fresh on every write.
create or replace function public.touch_store_settings() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists store_settings_touch on public.store_settings;
create trigger store_settings_touch
  before update on public.store_settings
  for each row execute function public.touch_store_settings();

-- Storage bucket for the logo. Public read (storefront), admin-only write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding',
  'branding',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "branding_select_public" on storage.objects;
create policy "branding_select_public"
  on storage.objects for select
  using (bucket_id = 'branding');

drop policy if exists "branding_modify_admin" on storage.objects;
create policy "branding_modify_admin"
  on storage.objects for all
  using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());


-- ============================================
-- database/migrations/0029_phone_auth_profile.sql
-- ============================================

-- 0029_phone_auth_profile.sql
-- Phone-based auth: users sign up/in with a phone number + password. The phone
-- is mapped to a synthetic email (`<digits>@phone.csms.app`) for Supabase auth.
-- Update the new-user trigger to persist the real phone number on the profile
-- and avoid storing the synthetic address in profiles.email.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := new.raw_user_meta_data->>'phone';
  v_name  text := new.raw_user_meta_data->>'name';
begin
  insert into public.profiles (id, email, phone, name)
  values (
    new.id,
    -- Synthetic phone-login emails are not real addresses; keep email null.
    case when new.email ilike '%@phone.csms.app' then null else new.email end,
    coalesce(v_phone, new.phone),
    coalesce(nullif(v_name, ''), v_phone, split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;


-- ============================================
-- database/migrations/0030_reset_users_seed_admin.sql
-- ============================================

-- 0030_reset_users_seed_admin.sql
-- Reset accounts for phone-based auth.
--
-- 1) Delete ALL existing auth users so customers re-register with a phone
--    number. Order history is kept (orders.user_id and movements.created_by are
--    `on delete set null`); profiles, per-user notifications and loyalty rows
--    are removed with their users.
-- 2) Seed a single admin that signs in with phone 017552223 / password 12345678.
--    The phone normalizes to 17552223, mapped to 17552223@phone.csms.app.
--
-- IMPORTANT: the synthetic email uses a real TLD (.app) because GoTrue rejects
-- reserved TLDs like `.local`. The token columns are set to '' (NOT null) —
-- GoTrue cannot scan NULL token columns and every auth query 500s otherwise.
--
-- ⚠️  DESTRUCTIVE + one-off. Run in the Supabase SQL editor as `postgres`, on a
--     backed-up database. Re-running wipes users again and recreates the admin.

create extension if not exists pgcrypto;

-- 1) Wipe every existing account (raw DELETE bypasses GoTrue's row scan, so it
--    clears even corrupt rows that the Auth API cannot load).
delete from auth.users;

-- 2) Seed the admin (phone 017552223 / password 12345678).
do $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := '17552223@phone.csms.app';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id,
    'authenticated', 'authenticated', v_email,
    crypt('12345678', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', 'Admin', 'phone', '17552223'),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email),
    'email', now(), now(), now()
  );

  -- handle_new_user() may have created a 'customer' profile already; make sure
  -- the admin row exists and is promoted regardless.
  insert into public.profiles (id, role, name, phone, email)
  values (v_id, 'admin', 'Admin', '17552223', null)
  on conflict (id) do update
    set role  = 'admin',
        name  = 'Admin',
        phone = '17552223',
        email = null;
end $$;


-- ============================================
-- database/migrations/0031_checkout_uses_store_shipping_fee.sql
-- ============================================

-- 0031_checkout_uses_store_shipping_fee.sql
--
-- Make customer checkout honour the shipping fee configured in Settings.
--
-- Until now create_customer_order hardcoded the shipping fee at 2 (mirroring
-- SHIPPING_FEE_DEFAULT). store_settings.shipping_fee was editable in the admin
-- UI but had no effect on the money actually charged — an admin who changed it
-- saw no difference on real orders. Recreate the RPC so it reads the singleton
-- store_settings.shipping_fee, falling back to 2 when the row/value is missing
-- (e.g. before 0028 is applied). Everything else is byte-for-byte from 0024.

create or replace function public.create_customer_order(
  p_order_id       uuid,
  p_customer_name  text,
  p_phone          text,
  p_address        text,
  p_note           text,
  p_payment_method public.payment_method,
  p_payment_image  text,
  p_items          jsonb,
  p_coupon_code    text default null,
  p_points         integer default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_shipping_fee  numeric(10,2);              -- read from store_settings below
  v_user          uuid := auth.uid();
  v_item          jsonb;
  v_pid           uuid;
  v_qty           integer;
  v_prod          record;
  v_unit          numeric(10,2);
  v_subtotal      numeric(10,2) := 0;
  v_coupon        record;
  v_coupon_disc   numeric(10,2) := 0;
  v_coupon_id     uuid := null;
  v_coupon_code   text := null;
  v_avail         integer;
  v_capped_pts    integer := 0;
  v_pts_disc      numeric(10,2) := 0;
  v_pts_redeem    integer := 0;
  v_max_by_ratio  numeric(10,2);
  v_remaining     numeric(10,2);
  v_discount      numeric(10,2);
  v_total         numeric(10,2);
  v_bal           integer;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'cart is empty' using errcode = '22023';
  end if;

  -- Shipping fee is store-configurable; default to 2 if unset/absent.
  select shipping_fee into v_shipping_fee
    from public.store_settings where id = 1;
  v_shipping_fee := coalesce(v_shipping_fee, 2);

  -- 1. Validate every line, lock its inventory row, recompute price, check stock.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid quantity' using errcode = '22023';
    end if;

    select p.name, p.price, p.discount_price, p.is_active, i.current_stock
      into v_prod
      from public.products p
      join public.product_inventory i on i.product_id = p.id
     where p.id = v_pid
     for update of i;

    if not found then
      raise exception 'a product in your cart is unavailable'
        using errcode = 'P0002';
    end if;
    if not v_prod.is_active then
      raise exception '% is no longer available', v_prod.name
        using errcode = '23514';
    end if;

    v_unit := case
      when v_prod.discount_price is not null and v_prod.discount_price > 0
           and v_prod.discount_price < v_prod.price
        then v_prod.discount_price
      else v_prod.price
    end;
    if v_unit is null or v_unit <= 0 then
      raise exception '% has no price set', v_prod.name using errcode = '23514';
    end if;
    if v_prod.current_stock < v_qty then
      raise exception 'INSUFFICIENT_STOCK:%', v_prod.name using errcode = '23514';
    end if;

    v_subtotal := v_subtotal + (v_unit * v_qty);
  end loop;

  v_subtotal := round(v_subtotal, 2);

  -- 2. Coupon: validate against the catalog rules and reserve a redemption.
  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon
      from public.coupons
     where code = upper(trim(p_coupon_code))
       and is_active
       and (starts_at is null or starts_at <= now())
       and (expires_at is null or expires_at > now())
     for update;

    if not found then
      raise exception 'COUPON_INVALID' using errcode = '23514';
    end if;
    if v_coupon.max_redemptions is not null
       and v_coupon.redeemed_count >= v_coupon.max_redemptions then
      raise exception 'COUPON_LIMIT' using errcode = '23514';
    end if;
    if v_subtotal < v_coupon.min_subtotal then
      raise exception 'COUPON_MIN:%', v_coupon.min_subtotal using errcode = '23514';
    end if;

    v_coupon_disc := least(
      case when v_coupon.discount_type = 'percent'
           then round(v_subtotal * v_coupon.discount_value / 100, 2)
           else v_coupon.discount_value end,
      v_subtotal);
    v_coupon_id   := v_coupon.id;
    v_coupon_code := v_coupon.code;

    update public.coupons
       set redeemed_count = redeemed_count + 1, updated_at = now()
     where id = v_coupon.id
       and (max_redemptions is null or redeemed_count < max_redemptions);
    if not found then
      raise exception 'COUPON_LIMIT' using errcode = '23514';
    end if;
  end if;

  -- 3. Loyalty points: cap to balance + ratio, deduct atomically.
  if p_points > 0 and v_user is not null then
    select loyalty_points into v_avail
      from public.profiles where id = v_user for update;
    v_avail := coalesce(v_avail, 0);
    v_capped_pts := least(p_points, v_avail);
    if v_capped_pts > 0 then
      v_max_by_ratio := round(v_subtotal * 0.5, 2);
      v_remaining    := greatest(0, round(v_subtotal + v_shipping_fee - v_coupon_disc, 2));
      v_pts_disc     := least(round(v_capped_pts::numeric / 100, 2),
                              v_max_by_ratio, v_remaining);
      v_pts_redeem   := ceil(v_pts_disc * 100)::integer;
    end if;

    if v_pts_redeem > 0 then
      update public.profiles
         set loyalty_points = loyalty_points - v_pts_redeem
       where id = v_user and loyalty_points >= v_pts_redeem
      returning loyalty_points into v_bal;
      if not found then
        raise exception 'POINTS_CHANGED' using errcode = '23514';
      end if;
      insert into public.loyalty_transactions
        (user_id, order_id, type, points, balance_after, note)
      values
        (v_user, p_order_id, 'redeem', -v_pts_redeem, v_bal, 'checkout redemption');
    end if;
  end if;

  -- 4. Final money math. Defense in depth against the total-matches CHECK.
  v_discount := round(v_coupon_disc + v_pts_disc, 2);
  if v_discount > round(v_subtotal + v_shipping_fee, 2) then
    v_discount := round(v_subtotal + v_shipping_fee, 2);
  end if;
  v_total := round(v_subtotal + v_shipping_fee - v_discount, 2);

  -- 5. Persist order + items. The enforce_order_item_price trigger re-asserts
  --    each line price, so these inserts cannot drift from the catalog.
  insert into public.orders (
    id, user_id, customer_name, phone, address, note,
    subtotal, shipping_fee, discount, total,
    payment_method, payment_image, coupon_id, coupon_code, points_redeemed
  ) values (
    p_order_id, v_user, p_customer_name, p_phone, p_address,
    nullif(trim(coalesce(p_note, '')), ''),
    v_subtotal, v_shipping_fee, v_discount, v_total,
    p_payment_method, p_payment_image, v_coupon_id, v_coupon_code, v_pts_redeem
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (order_id, product_id, product_name, quantity, price)
    values (
      p_order_id,
      (v_item->>'product_id')::uuid,
      'pending',                              -- overwritten by trigger
      (v_item->>'quantity')::integer,
      0                                       -- overwritten by trigger
    );
  end loop;

  return jsonb_build_object('order_id', p_order_id, 'total', v_total);
end $$;

revoke all on function public.create_customer_order(
  uuid, text, text, text, text, public.payment_method, text, jsonb, text, integer
) from public;
grant execute on function public.create_customer_order(
  uuid, text, text, text, text, public.payment_method, text, jsonb, text, integer
) to authenticated, anon;


-- ============================================
-- database/migrations/0032_product_marketing_flags.sql
-- ============================================

-- 0032_product_marketing_flags.sql
--
-- Give admins explicit, per-product control over the storefront merchandising
-- statuses: Featured, On sale, and New arrivals.
--
-- `featured` already exists (0003) and drives the home "Featured picks" rail.
-- Until now "On sale" was derived from discount_price and "New arrivals" from
-- created_at recency, so admins could not curate those sections directly. Add
-- two opt-in boolean flags so a product is merchandised only when the admin
-- says so. Partial indexes mirror products_featured_idx for cheap storefront
-- reads (active + flagged).

alter table public.products
  add column if not exists on_sale     boolean not null default false,
  add column if not exists new_arrival boolean not null default false;

create index if not exists products_on_sale_idx
  on public.products(on_sale) where on_sale and is_active;

create index if not exists products_new_arrival_idx
  on public.products(new_arrival) where new_arrival and is_active;


-- ============================================
-- database/migrations/0033_superadmin_and_stores.sql
-- ============================================

-- 0033_superadmin_and_stores.sql
-- Tenancy foundation: introduce the platform `superadmin` role and the `stores`
-- table (tenant root). Every shop owner ("admin") owns exactly one store; staff
-- and customers belong to a store via profiles.store_id. The superadmin sits
-- above all stores (store_id is NULL) and bypasses tenant scoping.
--
-- IMPORTANT: the new enum value 'superadmin' is added here but NEVER referenced
-- as an enum literal in this same migration (Postgres forbids using a freshly
-- added enum value in the transaction that added it). Helper functions compare
-- against role::text instead. Seeding a superadmin account happens in 0036,
-- which runs as its own statement/transaction.

-- 1) Role -------------------------------------------------------------------
alter type public.user_role add value if not exists 'superadmin';

-- 2) Stores (tenant root) ---------------------------------------------------
create table if not exists public.stores (
  id                 uuid primary key default gen_random_uuid(),
  slug               citext not null unique,
  name               text not null,
  owner_id           uuid references public.profiles(id) on delete set null,
  custom_domain      citext unique,
  domain_verified    boolean not null default false,
  -- Persisted lifecycle state. The *effective* status (incl. grace/lock) is
  -- derived from dates by store_access_status(); this column only records the
  -- coarse state a human/superadmin set (e.g. cancelled, locked).
  status             text not null default 'trial'
                       check (status in ('trial','active','grace','locked','cancelled')),
  plan_id            uuid,            -- FK added in 0037 (billing) to avoid a cycle
  trial_ends_at      timestamptz,
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists stores_owner_idx on public.stores(owner_id);
create index if not exists stores_custom_domain_idx
  on public.stores(custom_domain) where custom_domain is not null;

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

-- 3) Profiles belong to a store --------------------------------------------
alter table public.profiles
  add column if not exists store_id uuid references public.stores(id) on delete set null;

create index if not exists profiles_store_idx on public.profiles(store_id);

-- 4) Tenancy helper functions ----------------------------------------------
-- All SECURITY DEFINER + stable so they cache per statement and don't recurse
-- through RLS on profiles.

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and role::text = 'superadmin'
  );
$$;

create or replace function public.current_store_id() returns uuid
language sql stable security definer set search_path = public as $$
  select store_id from public.profiles where id = auth.uid();
$$;

-- Transition helper used as the column DEFAULT for store_id on tenant tables
-- (set in 0034). It resolves to the writer's own store, falling back to the
-- "default" store for anonymous storefront writes. Once every service stamps
-- store_id explicitly (S7), these column defaults can be dropped.
create or replace function public.default_store_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select store_id from public.profiles where id = auth.uid()),
    (select id from public.stores where slug = 'default')
  );
$$;

-- Effective access state for a store, derived from its dates. Order matters:
-- explicit cancelled/locked win; then active paid period; then trial; then a
-- 3-day grace window after the latest of (trial end, paid period end); else
-- locked.
create or replace function public.store_access_status(p_store uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when s.status in ('cancelled','locked') then s.status
    when s.current_period_end is not null and now() < s.current_period_end then 'active'
    when s.trial_ends_at is not null and now() < s.trial_ends_at then 'trial'
    when now() < greatest(
           coalesce(s.current_period_end, 'epoch'::timestamptz),
           coalesce(s.trial_ends_at,     'epoch'::timestamptz)
         ) + interval '3 days' then 'grace'
    else 'locked'
  end
  from public.stores s
  where s.id = p_store;
$$;

-- Tenant resolution for middleware: map an incoming Host or /s/{slug} to a
-- store WITHOUT exposing the stores table to anon (stores RLS stays locked).
-- Host (custom_domain) wins over slug. Returns the effective access status too.
create or replace function public.resolve_store(p_host text, p_slug text)
returns table (id uuid, slug citext, status text)
language sql stable security definer set search_path = public as $$
  select s.id, s.slug, public.store_access_status(s.id)
    from public.stores s
   where (nullif(p_host, '') is not null and s.custom_domain = p_host)
      or (nullif(p_slug, '') is not null and s.slug = p_slug)
   order by (p_host is not null and s.custom_domain = p_host) desc
   limit 1;
$$;

grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.current_store_id() to authenticated;
grant execute on function public.default_store_id() to anon, authenticated;
grant execute on function public.store_access_status(uuid) to anon, authenticated;
grant execute on function public.resolve_store(text, text) to anon, authenticated;

-- 5) Default store + backfill ----------------------------------------------
-- The existing single store becomes "Default Store", owned by the seed admin
-- from 0030. It is set to a far-future active period so the current shop keeps
-- working unchanged after this migration. Every existing profile joins it.
do $$
declare
  v_owner uuid;
  v_store uuid;
begin
  select id into v_owner
    from public.profiles
   where role::text = 'admin'
   order by created_at
   limit 1;

  insert into public.stores (slug, name, owner_id, status, current_period_end, trial_ends_at)
  values ('default', 'Default Store', v_owner, 'active',
          now() + interval '3650 days', now() + interval '3650 days')
  on conflict (slug) do nothing;

  select id into v_store from public.stores where slug = 'default';

  update public.profiles
     set store_id = v_store
   where store_id is null
     and role::text in ('admin','staff','customer');
end $$;

-- Enable RLS on stores now; full policies land in 0038. Until then, restrict to
-- a safe default: superadmin all, owners read their own store.
alter table public.stores enable row level security;

drop policy if exists stores_superadmin_all on public.stores;
create policy stores_superadmin_all on public.stores
  for all using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists stores_owner_read on public.stores;
create policy stores_owner_read on public.stores
  for select using (id = public.current_store_id());


-- ============================================
-- database/migrations/0034_store_scoping.sql
-- ============================================

-- 0034_store_scoping.sql
-- Add store_id to every tenant-owned table, backfill existing rows to the
-- "default" store created in 0033, then enforce NOT NULL. Global unique
-- constraints (slug/sku/barcode/coupon code) become per-store unique so two
-- different shops can reuse the same slug or code.
--
-- RLS is rewritten in 0038; this migration only changes columns/indexes.

do $$
declare
  v_store uuid;
begin
  select id into v_store from public.stores where slug = 'default';

  -- ---- products ----------------------------------------------------------
  alter table public.products
    add column if not exists store_id uuid references public.stores(id) on delete cascade;
  update public.products set store_id = v_store where store_id is null;
  alter table public.products alter column store_id set not null;

  -- ---- product_inventory -------------------------------------------------
  alter table public.product_inventory
    add column if not exists store_id uuid references public.stores(id) on delete cascade;
  update public.product_inventory set store_id = v_store where store_id is null;
  alter table public.product_inventory alter column store_id set not null;

  -- ---- orders ------------------------------------------------------------
  alter table public.orders
    add column if not exists store_id uuid references public.stores(id) on delete cascade;
  update public.orders set store_id = v_store where store_id is null;
  alter table public.orders alter column store_id set not null;

  -- ---- order_items (inherit the parent order's store) --------------------
  alter table public.order_items
    add column if not exists store_id uuid references public.stores(id) on delete cascade;
  update public.order_items oi
     set store_id = o.store_id
    from public.orders o
   where o.id = oi.order_id and oi.store_id is null;
  alter table public.order_items alter column store_id set not null;

  -- ---- inventory_movements ----------------------------------------------
  alter table public.inventory_movements
    add column if not exists store_id uuid references public.stores(id) on delete cascade;
  update public.inventory_movements set store_id = v_store where store_id is null;
  alter table public.inventory_movements alter column store_id set not null;

  -- ---- coupons -----------------------------------------------------------
  alter table public.coupons
    add column if not exists store_id uuid references public.stores(id) on delete cascade;
  update public.coupons set store_id = v_store where store_id is null;
  alter table public.coupons alter column store_id set not null;

  -- ---- loyalty_transactions ---------------------------------------------
  alter table public.loyalty_transactions
    add column if not exists store_id uuid references public.stores(id) on delete cascade;
  update public.loyalty_transactions set store_id = v_store where store_id is null;
  alter table public.loyalty_transactions alter column store_id set not null;

  -- ---- notifications (nullable: NULL store_id = platform broadcast) ------
  alter table public.notifications
    add column if not exists store_id uuid references public.stores(id) on delete cascade;
  update public.notifications set store_id = v_store where store_id is null;
end $$;

-- Transition defaults: writes that omit store_id (existing services, pre-S7)
-- land in the writer's own store, or the default store for anonymous storefront
-- orders. Dropped once every service stamps store_id explicitly (S7).
alter table public.products            alter column store_id set default public.default_store_id();
alter table public.product_inventory   alter column store_id set default public.default_store_id();
alter table public.orders              alter column store_id set default public.default_store_id();
alter table public.order_items         alter column store_id set default public.default_store_id();
alter table public.inventory_movements alter column store_id set default public.default_store_id();
alter table public.coupons             alter column store_id set default public.default_store_id();
alter table public.loyalty_transactions alter column store_id set default public.default_store_id();
alter table public.notifications       alter column store_id set default public.default_store_id();

-- Per-store uniqueness -------------------------------------------------------
drop index if exists public.products_slug_unique;
drop index if exists public.products_sku_unique;
drop index if exists public.products_barcode_unique;
create unique index if not exists products_store_slug_unique
  on public.products(store_id, slug);
create unique index if not exists products_store_sku_unique
  on public.products(store_id, sku) where sku is not null;
create unique index if not exists products_store_barcode_unique
  on public.products(store_id, barcode) where barcode is not null;

drop index if exists public.product_inventory_barcode_unique;
create unique index if not exists product_inventory_store_barcode_unique
  on public.product_inventory(store_id, barcode) where barcode is not null;

alter table public.coupons drop constraint if exists coupons_code_key;
create unique index if not exists coupons_store_code_unique
  on public.coupons(store_id, code);

-- Store-leading indexes for the common "this store's rows" scans ------------
create index if not exists products_store_idx on public.products(store_id);
create index if not exists product_inventory_store_idx on public.product_inventory(store_id);
create index if not exists orders_store_status_idx on public.orders(store_id, status, created_at desc);
create index if not exists order_items_store_idx on public.order_items(store_id);
create index if not exists inventory_movements_store_idx
  on public.inventory_movements(store_id, created_at desc);
create index if not exists coupons_store_idx on public.coupons(store_id);
create index if not exists loyalty_transactions_store_idx on public.loyalty_transactions(store_id);
create index if not exists notifications_store_idx
  on public.notifications(store_id, created_at desc);


-- ============================================
-- database/migrations/0035_store_settings_per_store.sql
-- ============================================

-- 0035_store_settings_per_store.sql
-- Turn the singleton store_settings (id = 1) into one row per store.
--
-- Transition-safe: the legacy `id` column is kept (the default store's row stays
-- id = 1) so the current getStoreSettings() query (.eq("id", 1)) keeps working
-- until S7 switches it to store_id. The real key becomes store_id. A trigger
-- auto-creates a settings row whenever a new store is inserted.

-- 1) Add the tenant key and backfill the existing singleton ------------------
alter table public.store_settings
  add column if not exists store_id uuid references public.stores(id) on delete cascade;

update public.store_settings
   set store_id = (select id from public.stores where slug = 'default')
 where store_id is null;

-- 2) Move the primary key from id -> store_id; relax the legacy id column -----
do $$ begin
  alter table public.store_settings drop constraint if exists store_settings_pkey;
  alter table public.store_settings drop constraint if exists store_settings_id_check;
exception when others then null; end $$;

alter table public.store_settings alter column id drop default;
alter table public.store_settings alter column id drop not null;
alter table public.store_settings alter column store_id set not null;

create unique index if not exists store_settings_store_unique
  on public.store_settings(store_id);

do $$ begin
  alter table public.store_settings add constraint store_settings_pkey primary key (store_id);
exception when others then null; end $$;

-- 3) Auto-create a settings row for every new store -------------------------
create or replace function public.handle_new_store() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.store_settings (store_id, business_name, tagline)
  values (new.id, new.name, 'Cosmetic Store Management')
  on conflict (store_id) do nothing;
  return new;
end $$;

drop trigger if exists on_store_created on public.stores;
create trigger on_store_created
  after insert on public.stores
  for each row execute function public.handle_new_store();


-- ============================================
-- database/migrations/0036_seed_superadmin.sql
-- ============================================

-- 0036_seed_superadmin.sql
-- Seed the platform owner (superadmin). Runs as its own migration so the
-- 'superadmin' enum value added in 0033 is already committed and safe to use.
--
-- Credentials (CHANGE THESE after first login):
--   phone:    010552223   (normalizes to 10552223 -> 10552223@phone.csms.app)
--   password: 12345678
--
-- The superadmin has store_id = NULL and sits above every store.

create extension if not exists pgcrypto;

do $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := '10552223@phone.csms.app';
begin
  -- Skip if this superadmin email already exists.
  if exists (select 1 from auth.users where email = v_email) then
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id,
    'authenticated', 'authenticated', v_email,
    crypt('12345678', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', 'Super Admin', 'phone', '10552223'),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email),
    'email', now(), now(), now()
  );

  -- handle_new_user() may have created a 'customer' profile; promote it.
  insert into public.profiles (id, role, name, phone, email, store_id)
  values (v_id, 'superadmin', 'Super Admin', '10552223', null, null)
  on conflict (id) do update
    set role     = 'superadmin',
        name     = 'Super Admin',
        phone    = '10552223',
        store_id = null;
end $$;


-- ============================================
-- database/migrations/0037_billing.sql
-- ============================================

-- 0037_billing.sql
-- Subscription billing for stores: plans ($9/$19/$29), one subscription per
-- store, and a payment ledger (KHQR via Bakong, or a manual screenshot proof).
-- The stores table stays the source of truth for *access* (status/period dates
-- the middleware reads); activate_subscription() keeps it in sync.

-- 1) Plans ------------------------------------------------------------------
create table if not exists public.subscription_plans (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  price_usd   numeric(10,2) not null check (price_usd >= 0),
  interval    text not null default 'month' check (interval in ('month','year')),
  features    jsonb not null default '[]'::jsonb,
  limits      jsonb not null default '{}'::jsonb,
  sort        integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists subscription_plans_set_updated_at on public.subscription_plans;
create trigger subscription_plans_set_updated_at
  before update on public.subscription_plans
  for each row execute function public.set_updated_at();

-- Seed the three tiers. Limits/features are configurable later from the
-- superadmin Plans page; -1 means "unlimited".
insert into public.subscription_plans (code, name, price_usd, sort, features, limits) values
  ('starter', 'Starter', 9,  1,
   '["Online storefront","Inventory & barcode","Order management","1 staff account"]'::jsonb,
   '{"max_products":50,"max_staff":1,"coupons":false,"loyalty":false,"pos":false,"custom_domain":false,"advanced_analytics":false}'::jsonb),
  ('growth', 'Growth', 19, 2,
   '["Everything in Starter","Up to 500 products","5 staff accounts","Coupons & loyalty"]'::jsonb,
   '{"max_products":500,"max_staff":5,"coupons":true,"loyalty":true,"pos":false,"custom_domain":false,"advanced_analytics":false}'::jsonb),
  ('pro', 'Pro', 29, 3,
   '["Everything in Growth","Unlimited products & staff","POS register","Custom domain","Advanced analytics"]'::jsonb,
   '{"max_products":-1,"max_staff":-1,"coupons":true,"loyalty":true,"pos":true,"custom_domain":true,"advanced_analytics":true}'::jsonb)
on conflict (code) do nothing;

-- Now that plans exist, point stores.plan_id at them.
do $$ begin
  alter table public.stores
    add constraint stores_plan_id_fkey
    foreign key (plan_id) references public.subscription_plans(id) on delete set null;
exception when duplicate_object then null; end $$;

-- 2) Subscriptions (one per store) ------------------------------------------
create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  store_id             uuid not null unique references public.stores(id) on delete cascade,
  plan_id              uuid references public.subscription_plans(id) on delete set null,
  status               text not null default 'trialing'
                         check (status in ('trialing','active','past_due','canceled')),
  current_period_start timestamptz,
  current_period_end   timestamptz,
  trial_ends_at        timestamptz,
  cancel_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- 3) Payment ledger ---------------------------------------------------------
create table if not exists public.subscription_payments (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  plan_id         uuid references public.subscription_plans(id) on delete set null,
  amount_usd      numeric(10,2) not null check (amount_usd >= 0),
  method          text not null default 'khqr' check (method in ('khqr','manual')),
  bill_number     text,
  bakong_md5      text,
  bakong_txn_ref  text,
  status          text not null default 'pending'
                    check (status in ('pending','paid','failed','expired')),
  proof_url       text,
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists subscription_payments_store_idx
  on public.subscription_payments(store_id, created_at desc);
create index if not exists subscription_payments_status_idx
  on public.subscription_payments(status) where status = 'pending';
create index if not exists subscription_payments_md5_idx
  on public.subscription_payments(bakong_md5) where bakong_md5 is not null;

drop trigger if exists subscription_payments_set_updated_at on public.subscription_payments;
create trigger subscription_payments_set_updated_at
  before update on public.subscription_payments
  for each row execute function public.set_updated_at();

-- 4) RPCs -------------------------------------------------------------------
-- Start a 14-day trial for a store on the given plan. Idempotent-ish: callable
-- at store creation (S7). Caller must own the store or be superadmin.
create or replace function public.start_store_trial(p_store uuid, p_plan_code text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_plan uuid;
  v_trial_end timestamptz := now() + interval '14 days';
begin
  if not (public.is_superadmin() or p_store = public.current_store_id()) then
    raise exception 'not authorized for store %', p_store;
  end if;

  select id into v_plan from public.subscription_plans where code = p_plan_code;

  update public.stores
     set plan_id = v_plan, status = 'trial', trial_ends_at = v_trial_end
   where id = p_store;

  insert into public.subscriptions (store_id, plan_id, status, trial_ends_at)
  values (p_store, v_plan, 'trialing', v_trial_end)
  on conflict (store_id) do update
    set plan_id = excluded.plan_id,
        status = 'trialing',
        trial_ends_at = excluded.trial_ends_at;
end $$;

-- Mark a payment paid and extend the store's paid period by 30 days. Returns
-- the new period end. Caller must own the payment's store or be superadmin.
create or replace function public.activate_subscription(p_payment uuid)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_store uuid;
  v_plan  uuid;
  v_new_end timestamptz;
begin
  select store_id, plan_id into v_store, v_plan
    from public.subscription_payments where id = p_payment;
  if v_store is null then
    raise exception 'payment % not found', p_payment;
  end if;
  if not (public.is_superadmin() or v_store = public.current_store_id()) then
    raise exception 'not authorized for payment %', p_payment;
  end if;

  update public.subscription_payments
     set status = 'paid', paid_at = coalesce(paid_at, now())
   where id = p_payment;

  select greatest(now(), coalesce(current_period_end, now())) + interval '30 days'
    into v_new_end
    from public.stores where id = v_store;

  update public.stores
     set status = 'active', plan_id = coalesce(v_plan, plan_id),
         current_period_end = v_new_end
   where id = v_store;

  insert into public.subscriptions (store_id, plan_id, status, current_period_start, current_period_end)
  values (v_store, v_plan, 'active', now(), v_new_end)
  on conflict (store_id) do update
    set plan_id = coalesce(excluded.plan_id, public.subscriptions.plan_id),
        status = 'active',
        current_period_start = now(),
        current_period_end = excluded.current_period_end;

  return v_new_end;
end $$;

grant execute on function public.start_store_trial(uuid, text) to authenticated;
grant execute on function public.activate_subscription(uuid) to authenticated;

-- 5) RLS --------------------------------------------------------------------
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;

-- Plans are public (pricing page); only superadmin writes.
drop policy if exists plans_read_all on public.subscription_plans;
create policy plans_read_all on public.subscription_plans
  for select using (true);
drop policy if exists plans_write_superadmin on public.subscription_plans;
create policy plans_write_superadmin on public.subscription_plans
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- A store sees its own subscription; superadmin sees all.
drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions
  for select using (public.is_superadmin() or store_id = public.current_store_id());
drop policy if exists subscriptions_write_superadmin on public.subscriptions;
create policy subscriptions_write_superadmin on public.subscriptions
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- A store reads + creates its own payments; superadmin manages all.
drop policy if exists payments_read on public.subscription_payments;
create policy payments_read on public.subscription_payments
  for select using (public.is_superadmin() or store_id = public.current_store_id());
drop policy if exists payments_insert_own on public.subscription_payments;
create policy payments_insert_own on public.subscription_payments
  for insert with check (public.is_superadmin() or store_id = public.current_store_id());
drop policy if exists payments_write_superadmin on public.subscription_payments;
create policy payments_write_superadmin on public.subscription_payments
  for all using (public.is_superadmin()) with check (public.is_superadmin());


-- ============================================
-- database/migrations/0038_rls_multitenant.sql
-- ============================================

-- 0038_rls_multitenant.sql
-- Rewrite RLS on every tenant-owned table so a store's staff/admin see and
-- modify ONLY their own store's rows, while the platform superadmin bypasses
-- tenant scoping everywhere. Public catalog reads (active products, inventory,
-- active coupons, store branding) stay readable so anonymous storefront
-- visitors work; the app filters those by the resolved store_id.
--
-- Pattern:
--   reads  : is_superadmin() OR (is_staff() AND store_id = current_store_id())
--            [+ owner/customer/public clauses where they already existed]
--   writes : is_superadmin() OR (is_staff() AND store_id = current_store_id())
--
-- Customer + guest checkout still flows through create_customer_order (SECURITY
-- DEFINER), which bypasses these policies.

-- ============================================================================
-- profiles
-- ============================================================================
drop policy if exists profiles_select_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff on public.profiles
  for select
  using (
    id = auth.uid()
    or public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

-- profiles_update_own (unchanged intent) stays from 0008.

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update
  using (
    public.is_superadmin()
    or (public.is_admin() and store_id = public.current_store_id())
  )
  with check (
    public.is_superadmin()
    or (public.is_admin() and store_id = public.current_store_id())
  );

-- ============================================================================
-- products
-- ============================================================================
drop policy if exists products_select_public on public.products;
create policy products_select_public on public.products
  for select
  using (
    is_active
    or public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

drop policy if exists products_modify_staff on public.products;
create policy products_modify_staff on public.products
  for all
  using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  )
  with check (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

-- ============================================================================
-- product_inventory (stock is non-sensitive: public read kept)
-- ============================================================================
drop policy if exists inventory_modify_staff on public.product_inventory;
create policy inventory_modify_staff on public.product_inventory
  for all
  using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  )
  with check (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

-- ============================================================================
-- orders
-- ============================================================================
drop policy if exists orders_select_owner_or_staff on public.orders;
create policy orders_select_owner_or_staff on public.orders
  for select
  using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
    or (user_id is not null and user_id = auth.uid())
  );

drop policy if exists orders_insert_staff_only on public.orders;
create policy orders_insert_staff_only on public.orders
  for insert
  with check (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

drop policy if exists orders_update_staff on public.orders;
create policy orders_update_staff on public.orders
  for update
  using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  )
  with check (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

-- ============================================================================
-- order_items
-- ============================================================================
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select
  using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
    or exists (
      select 1 from public.orders o
       where o.id = order_items.order_id
         and o.user_id = auth.uid()
    )
  );

drop policy if exists order_items_insert_staff_only on public.order_items;
create policy order_items_insert_staff_only on public.order_items
  for insert
  with check (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

drop policy if exists order_items_modify_staff on public.order_items;
create policy order_items_modify_staff on public.order_items
  for update
  using (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()))
  with check (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

drop policy if exists order_items_delete_staff on public.order_items;
create policy order_items_delete_staff on public.order_items
  for delete
  using (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

-- ============================================================================
-- inventory_movements (staff/admin of the store only)
-- ============================================================================
drop policy if exists movements_select_staff on public.inventory_movements;
create policy movements_select_staff on public.inventory_movements
  for select
  using (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

drop policy if exists movements_insert_staff on public.inventory_movements;
create policy movements_insert_staff on public.inventory_movements
  for insert
  with check (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

-- ============================================================================
-- notifications (store-scoped broadcasts; NULL store_id = platform-wide)
-- ============================================================================
drop policy if exists notifications_select_visible on public.notifications;
create policy notifications_select_visible on public.notifications
  for select
  using (
    user_id = auth.uid()
    or public.is_superadmin()
    or (store_id is null and user_id is null and audience = 'all')
    or (store_id = public.current_store_id() and user_id is null and audience = 'all')
    or (store_id = public.current_store_id() and user_id is null and audience = 'staff' and public.is_staff())
    or (public.is_staff() and store_id = public.current_store_id())
  );

-- notifications_update_own (user_id = auth.uid()) stays from 0008.

drop policy if exists notifications_modify_staff on public.notifications;
create policy notifications_modify_staff on public.notifications
  for all
  using (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()))
  with check (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

-- ============================================================================
-- coupons (active coupons publicly readable; writes store-scoped)
-- ============================================================================
drop policy if exists coupons_select_active_or_staff on public.coupons;
create policy coupons_select_active_or_staff on public.coupons
  for select
  using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
    or (
      is_active
      and (starts_at is null or starts_at <= now())
      and (expires_at is null or expires_at > now())
    )
  );

drop policy if exists coupons_modify_staff on public.coupons;
create policy coupons_modify_staff on public.coupons
  for all
  using (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()))
  with check (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

-- ============================================================================
-- loyalty_transactions
-- ============================================================================
drop policy if exists loyalty_txn_select_own on public.loyalty_transactions;
create policy loyalty_txn_select_own on public.loyalty_transactions
  for select
  using (
    user_id = auth.uid()
    or public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

drop policy if exists loyalty_txn_modify_staff on public.loyalty_transactions;
create policy loyalty_txn_modify_staff on public.loyalty_transactions
  for all
  using (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()))
  with check (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

-- ============================================================================
-- store_settings (per-store; branding publicly readable, admin-of-store writes)
-- ============================================================================
drop policy if exists store_settings_update_admin on public.store_settings;
create policy store_settings_update_admin on public.store_settings
  for update
  using (public.is_superadmin() or (public.is_admin() and store_id = public.current_store_id()))
  with check (public.is_superadmin() or (public.is_admin() and store_id = public.current_store_id()));

-- New stores get a settings row from the on_store_created trigger (0035), but
-- allow admin/superadmin INSERT too for completeness.
drop policy if exists store_settings_insert_admin on public.store_settings;
create policy store_settings_insert_admin on public.store_settings
  for insert
  with check (public.is_superadmin() or (public.is_admin() and store_id = public.current_store_id()));

-- ============================================================================
-- stores (replace the interim 0033 policies with full set)
-- ============================================================================
drop policy if exists stores_owner_read on public.stores;
create policy stores_owner_read on public.stores
  for select
  using (public.is_superadmin() or id = public.current_store_id());

drop policy if exists stores_owner_update on public.stores;
create policy stores_owner_update on public.stores
  for update
  using (public.is_superadmin() or (public.is_admin() and id = public.current_store_id()))
  with check (public.is_superadmin() or (public.is_admin() and id = public.current_store_id()));


-- ============================================
-- database/migrations/0039_platform_finance.sql
-- ============================================

-- 0039_platform_finance.sql
-- Platform-owner finances: subscription revenue (from paid subscription_payments)
-- minus the platform's own expenses (hosting/server/other), rolled up by month
-- and year. Aggregations are SECURITY DEFINER functions guarded by is_superadmin()
-- so they return platform-wide totals regardless of the caller's store RLS.

-- 1) Expenses ---------------------------------------------------------------
create table if not exists public.platform_expenses (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'other' check (category in ('hosting','server','other')),
  label       text not null,
  amount_usd  numeric(10,2) not null check (amount_usd >= 0),
  incurred_on date not null default current_date,
  note        text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists platform_expenses_incurred_idx
  on public.platform_expenses(incurred_on desc);

alter table public.platform_expenses enable row level security;

drop policy if exists platform_expenses_superadmin on public.platform_expenses;
create policy platform_expenses_superadmin on public.platform_expenses
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- 2) Monthly P&L for a year -------------------------------------------------
create or replace function public.platform_pnl_monthly(p_year integer)
returns table (month integer, revenue numeric, expense numeric, net numeric)
language sql stable security definer set search_path = public as $$
  with rev as (
    select extract(month from paid_at)::int as m, sum(amount_usd) as amt
      from public.subscription_payments
     where status = 'paid' and paid_at is not null
       and extract(year from paid_at) = p_year
     group by 1
  ),
  exp as (
    select extract(month from incurred_on)::int as m, sum(amount_usd) as amt
      from public.platform_expenses
     where extract(year from incurred_on) = p_year
     group by 1
  ),
  months as (select generate_series(1, 12) as m)
  select
    mo.m,
    coalesce(rev.amt, 0) as revenue,
    coalesce(exp.amt, 0) as expense,
    coalesce(rev.amt, 0) - coalesce(exp.amt, 0) as net
  from months mo
  left join rev on rev.m = mo.m
  left join exp on exp.m = mo.m
  where public.is_superadmin()
  order by mo.m;
$$;

-- 3) Yearly P&L across all time --------------------------------------------
create or replace function public.platform_pnl_yearly()
returns table (year integer, revenue numeric, expense numeric, net numeric)
language sql stable security definer set search_path = public as $$
  with rev as (
    select extract(year from paid_at)::int as y, sum(amount_usd) as amt
      from public.subscription_payments
     where status = 'paid' and paid_at is not null
     group by 1
  ),
  exp as (
    select extract(year from incurred_on)::int as y, sum(amount_usd) as amt
      from public.platform_expenses
     group by 1
  ),
  years as (
    select y from (
      select y from rev union select y from exp
    ) u where y is not null
  )
  select
    yr.y,
    coalesce(rev.amt, 0) as revenue,
    coalesce(exp.amt, 0) as expense,
    coalesce(rev.amt, 0) - coalesce(exp.amt, 0) as net
  from years yr
  left join rev on rev.y = yr.y
  left join exp on exp.y = yr.y
  where public.is_superadmin()
  order by yr.y desc;
$$;

-- 4) Headline summary (KPIs) ------------------------------------------------
-- mrr        = sum of plan price for stores whose access is currently 'active'
-- this_month = revenue, expense, net for the current calendar month
create or replace function public.platform_summary()
returns table (
  mrr               numeric,
  active_stores     integer,
  trial_stores      integer,
  overdue_stores    integer,
  total_revenue     numeric,
  total_expense     numeric,
  month_revenue     numeric,
  month_expense     numeric
)
language sql stable security definer set search_path = public as $$
  select
    coalesce((
      select sum(p.price_usd)
        from public.stores s
        join public.subscription_plans p on p.id = s.plan_id
       where public.store_access_status(s.id) = 'active'
    ), 0) as mrr,
    (select count(*)::int from public.stores s where public.store_access_status(s.id) = 'active') as active_stores,
    (select count(*)::int from public.stores s where public.store_access_status(s.id) = 'trial') as trial_stores,
    (select count(*)::int from public.stores s where public.store_access_status(s.id) in ('grace','locked')) as overdue_stores,
    coalesce((select sum(amount_usd) from public.subscription_payments where status = 'paid'), 0) as total_revenue,
    coalesce((select sum(amount_usd) from public.platform_expenses), 0) as total_expense,
    coalesce((select sum(amount_usd) from public.subscription_payments
               where status = 'paid' and paid_at >= date_trunc('month', now())), 0) as month_revenue,
    coalesce((select sum(amount_usd) from public.platform_expenses
               where incurred_on >= date_trunc('month', now())::date), 0) as month_expense
  where public.is_superadmin();
$$;

grant execute on function public.platform_pnl_monthly(integer) to authenticated;
grant execute on function public.platform_pnl_yearly() to authenticated;
grant execute on function public.platform_summary() to authenticated;


-- ============================================
-- database/migrations/0040_functions_tenant_aware.sql
-- ============================================

-- 0040_functions_tenant_aware.sql
-- Make the SECURITY DEFINER helpers store-aware so multi-tenant data stays
-- isolated even though these functions bypass RLS:
--   * handle_new_user      — customer signups inherit the store they registered
--                            under (store_id passed in signup metadata).
--   * create_customer_order — stamps the order + items with the resolved store,
--                            scopes the coupon to that store, and refuses carts
--                            with products from another store.
--   * apply_inventory_movement — stamps the movement with the product's store
--                            and refuses cross-store adjustments.

-- 1) handle_new_user: persist store_id from signup metadata -----------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := new.raw_user_meta_data->>'phone';
  v_name  text := new.raw_user_meta_data->>'name';
  v_store uuid := nullif(new.raw_user_meta_data->>'store_id', '')::uuid;
begin
  insert into public.profiles (id, email, phone, name, store_id)
  values (
    new.id,
    case when new.email ilike '%@phone.csms.app' then null else new.email end,
    coalesce(v_phone, new.phone),
    coalesce(nullif(v_name, ''), v_phone, split_part(new.email, '@', 1)),
    v_store
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- 2) create_customer_order: store-scoped checkout ---------------------------
-- Replace the old 10-arg overload with one that takes p_store_id.
drop function if exists public.create_customer_order(
  uuid, text, text, text, text, public.payment_method, text, jsonb, text, integer
);

create or replace function public.create_customer_order(
  p_order_id       uuid,
  p_customer_name  text,
  p_phone          text,
  p_address        text,
  p_note           text,
  p_payment_method public.payment_method,
  p_payment_image  text,
  p_items          jsonb,
  p_coupon_code    text default null,
  p_points         integer default 0,
  p_store_id       uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_shipping_fee constant numeric(10,2) := 2;  -- mirrors SHIPPING_FEE_DEFAULT
  v_store         uuid := coalesce(p_store_id, public.default_store_id());
  v_user          uuid := auth.uid();
  v_item          jsonb;
  v_pid           uuid;
  v_qty           integer;
  v_prod          record;
  v_unit          numeric(10,2);
  v_subtotal      numeric(10,2) := 0;
  v_coupon        record;
  v_coupon_disc   numeric(10,2) := 0;
  v_coupon_id     uuid := null;
  v_coupon_code   text := null;
  v_avail         integer;
  v_capped_pts    integer := 0;
  v_pts_disc      numeric(10,2) := 0;
  v_pts_redeem    integer := 0;
  v_max_by_ratio  numeric(10,2);
  v_remaining     numeric(10,2);
  v_discount      numeric(10,2);
  v_total         numeric(10,2);
  v_bal           integer;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'cart is empty' using errcode = '22023';
  end if;

  -- 1. Validate every line (scoped to this store), lock inventory, recompute.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid quantity' using errcode = '22023';
    end if;

    select p.name, p.price, p.discount_price, p.is_active, i.current_stock
      into v_prod
      from public.products p
      join public.product_inventory i on i.product_id = p.id
     where p.id = v_pid
       and p.store_id = v_store
     for update of i;

    if not found then
      raise exception 'a product in your cart is unavailable'
        using errcode = 'P0002';
    end if;
    if not v_prod.is_active then
      raise exception '% is no longer available', v_prod.name
        using errcode = '23514';
    end if;

    v_unit := case
      when v_prod.discount_price is not null and v_prod.discount_price > 0
           and v_prod.discount_price < v_prod.price
        then v_prod.discount_price
      else v_prod.price
    end;
    if v_unit is null or v_unit <= 0 then
      raise exception '% has no price set', v_prod.name using errcode = '23514';
    end if;
    if v_prod.current_stock < v_qty then
      raise exception 'INSUFFICIENT_STOCK:%', v_prod.name using errcode = '23514';
    end if;

    v_subtotal := v_subtotal + (v_unit * v_qty);
  end loop;

  v_subtotal := round(v_subtotal, 2);

  -- 2. Coupon: scoped to this store.
  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon
      from public.coupons
     where code = upper(trim(p_coupon_code))
       and store_id = v_store
       and is_active
       and (starts_at is null or starts_at <= now())
       and (expires_at is null or expires_at > now())
     for update;

    if not found then
      raise exception 'COUPON_INVALID' using errcode = '23514';
    end if;
    if v_coupon.max_redemptions is not null
       and v_coupon.redeemed_count >= v_coupon.max_redemptions then
      raise exception 'COUPON_LIMIT' using errcode = '23514';
    end if;
    if v_subtotal < v_coupon.min_subtotal then
      raise exception 'COUPON_MIN:%', v_coupon.min_subtotal using errcode = '23514';
    end if;

    v_coupon_disc := least(
      case when v_coupon.discount_type = 'percent'
           then round(v_subtotal * v_coupon.discount_value / 100, 2)
           else v_coupon.discount_value end,
      v_subtotal);
    v_coupon_id   := v_coupon.id;
    v_coupon_code := v_coupon.code;

    update public.coupons
       set redeemed_count = redeemed_count + 1, updated_at = now()
     where id = v_coupon.id
       and (max_redemptions is null or redeemed_count < max_redemptions);
    if not found then
      raise exception 'COUPON_LIMIT' using errcode = '23514';
    end if;
  end if;

  -- 3. Loyalty points: cap to balance + ratio, deduct atomically.
  if p_points > 0 and v_user is not null then
    select loyalty_points into v_avail
      from public.profiles where id = v_user for update;
    v_avail := coalesce(v_avail, 0);
    v_capped_pts := least(p_points, v_avail);
    if v_capped_pts > 0 then
      v_max_by_ratio := round(v_subtotal * 0.5, 2);
      v_remaining    := greatest(0, round(v_subtotal + c_shipping_fee - v_coupon_disc, 2));
      v_pts_disc     := least(round(v_capped_pts::numeric / 100, 2),
                              v_max_by_ratio, v_remaining);
      v_pts_redeem   := ceil(v_pts_disc * 100)::integer;
    end if;

    if v_pts_redeem > 0 then
      update public.profiles
         set loyalty_points = loyalty_points - v_pts_redeem
       where id = v_user and loyalty_points >= v_pts_redeem
      returning loyalty_points into v_bal;
      if not found then
        raise exception 'POINTS_CHANGED' using errcode = '23514';
      end if;
      insert into public.loyalty_transactions
        (store_id, user_id, order_id, type, points, balance_after, note)
      values
        (v_store, v_user, p_order_id, 'redeem', -v_pts_redeem, v_bal, 'checkout redemption');
    end if;
  end if;

  -- 4. Final money math.
  v_discount := round(v_coupon_disc + v_pts_disc, 2);
  if v_discount > round(v_subtotal + c_shipping_fee, 2) then
    v_discount := round(v_subtotal + c_shipping_fee, 2);
  end if;
  v_total := round(v_subtotal + c_shipping_fee - v_discount, 2);

  -- 5. Persist order + items, stamped with the store.
  insert into public.orders (
    id, store_id, user_id, customer_name, phone, address, note,
    subtotal, shipping_fee, discount, total,
    payment_method, payment_image, coupon_id, coupon_code, points_redeemed
  ) values (
    p_order_id, v_store, v_user, p_customer_name, p_phone, p_address,
    nullif(trim(coalesce(p_note, '')), ''),
    v_subtotal, c_shipping_fee, v_discount, v_total,
    p_payment_method, p_payment_image, v_coupon_id, v_coupon_code, v_pts_redeem
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (store_id, order_id, product_id, product_name, quantity, price)
    values (
      v_store,
      p_order_id,
      (v_item->>'product_id')::uuid,
      'pending',                              -- overwritten by trigger
      (v_item->>'quantity')::integer,
      0                                       -- overwritten by trigger
    );
  end loop;

  return jsonb_build_object('order_id', p_order_id, 'total', v_total);
end $$;

revoke all on function public.create_customer_order(
  uuid, text, text, text, text, public.payment_method, text, jsonb, text, integer, uuid
) from public;
grant execute on function public.create_customer_order(
  uuid, text, text, text, text, public.payment_method, text, jsonb, text, integer, uuid
) to authenticated, anon;

-- 3) apply_inventory_movement: guard + stamp store --------------------------
create or replace function public.apply_inventory_movement(
  p_product_id         uuid,
  p_movement           public.movement_type,
  p_quantity           integer,
  p_notes              text default null,
  p_order_id           uuid default null,
  p_created_by         uuid default null,
  p_barcode_image_url  text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_inventory   public.product_inventory%rowtype;
  v_delta       integer;
  v_new_stock   integer;
  v_barcode     text;
begin
  if p_quantity is null then
    raise exception 'quantity is required' using errcode = '22023';
  end if;
  if p_movement in ('in', 'out') and p_quantity <= 0 then
    raise exception 'quantity must be positive for % movements (got %)',
      p_movement, p_quantity using errcode = '22023';
  end if;
  if p_movement = 'adjustment' and p_quantity < 0 then
    raise exception 'adjustment target stock cannot be negative (got %)',
      p_quantity using errcode = '22023';
  end if;

  select * into v_inventory
  from public.product_inventory
  where product_id = p_product_id
  for update;

  if not found then
    raise exception 'no inventory row for product %', p_product_id
      using errcode = 'P0002';
  end if;

  -- Tenant guard: staff may only move stock within their own store.
  if not public.is_superadmin()
     and v_inventory.store_id is distinct from public.current_store_id() then
    raise exception 'product % is not in your store', p_product_id
      using errcode = '42501';
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
      v_inventory.current_stock, p_quantity using errcode = '23514';
  end if;

  v_barcode := v_inventory.barcode;

  if v_delta = 0 then
    return v_new_stock;
  end if;

  insert into public.inventory_movements (
    store_id, product_id, barcode, movement_type, quantity, resulting_stock,
    order_id, created_by, notes, barcode_image_url
  ) values (
    v_inventory.store_id,
    p_product_id, v_barcode, p_movement, abs(v_delta), v_new_stock,
    p_order_id, p_created_by, p_notes, p_barcode_image_url
  );

  update public.product_inventory
     set current_stock = v_new_stock, updated_at = now()
   where product_id = p_product_id;

  return v_new_stock;
end $$;
