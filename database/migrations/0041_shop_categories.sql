-- 0041_shop_categories.sql
-- Manual, per-store product categories (Settings → Shop Categories).
--
-- Replaces the fixed `product_category` enum as the source of truth: products
-- gain `category_id` → shop_categories(id). Every store is seeded with the five
-- built-in categories using the SAME slugs as the enum, so existing storefront
-- URLs (/category/{slug}) and per-slug visuals keep working. The legacy
-- products.category enum column is kept but made nullable (no longer
-- authoritative). Admin-only writes; active categories are publicly readable so
-- the storefront works for anonymous visitors (the app filters by resolved
-- store_id). Mirrors the coupons + 0034 store-scoping + 0038 RLS patterns.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- shop_categories
-- ---------------------------------------------------------------------------
create table if not exists public.shop_categories (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade
                  default public.default_store_id(),
  name          text not null,
  slug          text not null,
  description   text,
  icon          text,            -- Lucide icon name, e.g. "sparkles"
  color         text,            -- hex token, e.g. "#ec4899"
  display_order integer not null default 0,
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  updated_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz       -- soft delete
);

-- Per-store uniqueness, case-insensitive on name, excluding soft-deleted rows
-- so a name/slug can be reused after a category is deleted.
create unique index if not exists shop_categories_store_name_unique
  on public.shop_categories(store_id, lower(name)) where deleted_at is null;
create unique index if not exists shop_categories_store_slug_unique
  on public.shop_categories(store_id, slug) where deleted_at is null;
create index if not exists shop_categories_store_order_idx
  on public.shop_categories(store_id, display_order);

drop trigger if exists shop_categories_set_updated_at on public.shop_categories;
create trigger shop_categories_set_updated_at
  before update on public.shop_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- products.category_id
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists category_id uuid
    references public.shop_categories(id) on delete restrict;
create index if not exists products_store_category_id_idx
  on public.products(store_id, category_id);

-- ---------------------------------------------------------------------------
-- Seed built-in categories for every existing store + backfill products
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select id from public.stores loop
    insert into public.shop_categories
      (store_id, name, slug, icon, color, display_order)
    values
      (r.id, 'Skincare',  'skincare', 'sparkles',  '#ec4899', 0),
      (r.id, 'Makeup',    'makeup',   'palette',   '#d97706', 1),
      (r.id, 'Perfume',   'perfume',  'spray-can', '#db2777', 2),
      (r.id, 'Hair Care', 'haircare', 'scissors',  '#c2773f', 3),
      (r.id, 'Body Care', 'bodycare', 'droplets',  '#ec4899', 4)
    on conflict do nothing;
  end loop;
end $$;

update public.products p
   set category_id = sc.id
  from public.shop_categories sc
 where sc.store_id = p.store_id
   and sc.slug = p.category::text
   and p.category_id is null;

-- Every product now references a valid category; enforce it.
alter table public.products alter column category_id set not null;
-- enum column is no longer authoritative — keep it for back-compat, relax NOT NULL.
alter table public.products alter column category drop not null;

-- ---------------------------------------------------------------------------
-- Auto-seed the built-in categories for every newly created store
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_store_categories() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.shop_categories
    (store_id, name, slug, icon, color, display_order)
  values
    (new.id, 'Skincare',  'skincare', 'sparkles',  '#ec4899', 0),
    (new.id, 'Makeup',    'makeup',   'palette',   '#d97706', 1),
    (new.id, 'Perfume',   'perfume',  'spray-can', '#db2777', 2),
    (new.id, 'Hair Care', 'haircare', 'scissors',  '#c2773f', 3),
    (new.id, 'Body Care', 'bodycare', 'droplets',  '#ec4899', 4)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_store_created_categories on public.stores;
create trigger on_store_created_categories
  after insert on public.stores
  for each row execute function public.handle_new_store_categories();

-- ---------------------------------------------------------------------------
-- RLS: public reads active categories; only the store's admin (or superadmin)
-- writes. Mirrors the coupons policy in 0038, but writes are admin-only
-- (is_admin() excludes staff) per the feature spec.
-- ---------------------------------------------------------------------------
alter table public.shop_categories enable row level security;

drop policy if exists shop_categories_select on public.shop_categories;
create policy shop_categories_select on public.shop_categories
  for select
  using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
    or (is_active and deleted_at is null)
  );

drop policy if exists shop_categories_modify_admin on public.shop_categories;
create policy shop_categories_modify_admin on public.shop_categories
  for all
  using (
    public.is_superadmin()
    or (public.is_admin() and store_id = public.current_store_id())
  )
  with check (
    public.is_superadmin()
    or (public.is_admin() and store_id = public.current_store_id())
  );
