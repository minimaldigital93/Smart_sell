-- CSMS schema.sql — combined output of all migrations in database/migrations/ in order.
-- Generated 2026-05-16T14:20:29Z. Re-generate with: cat database/migrations/*.sql > database/schema.sql


-- ============================================================================
-- 0001_extensions_and_enums.sql
-- ============================================================================
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

-- ============================================================================
-- 0002_profiles.sql
-- ============================================================================
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

-- ============================================================================
-- 0003_products_and_inventory.sql
-- ============================================================================
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
  on_sale         boolean not null default false,
  new_arrival     boolean not null default false,
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
create index if not exists products_on_sale_idx on public.products(on_sale) where on_sale and is_active;
create index if not exists products_new_arrival_idx on public.products(new_arrival) where new_arrival and is_active;
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

-- ============================================================================
-- 0004_orders.sql
-- ============================================================================
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

-- ============================================================================
-- 0005_inventory_movements.sql
-- ============================================================================
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

-- ============================================================================
-- 0006_notifications.sql
-- ============================================================================
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

-- ============================================================================
-- 0007_functions_and_triggers.sql
-- ============================================================================
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

-- ============================================================================
-- 0008_rls_policies.sql
-- ============================================================================
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

-- ============================================================================
-- 0009_realtime_publications.sql
-- ============================================================================
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

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.product_inventory;
alter publication supabase_realtime add table public.inventory_movements;
alter publication supabase_realtime add table public.notifications;

-- ============================================================================
-- 0010_product_ingredients.sql
-- ============================================================================
-- 0010_product_ingredients.sql
-- Additive: ingredients field for cosmetic products (spec PDP requirement).

alter table public.products
  add column if not exists ingredients text;

-- ============================================================================
-- 0011_payment_proofs_storage.sql
-- ============================================================================
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

-- ============================================================================
-- 0012_admin_views.sql
-- ============================================================================
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

-- ============================================================================
-- 0013_product_images_storage.sql
-- ============================================================================
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

-- ============================================================================
-- 0014_notifications_audience.sql
-- ============================================================================
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

-- ============================================================================
-- 0015_notifications_triggers.sql
-- ============================================================================
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
