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
