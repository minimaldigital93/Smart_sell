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
