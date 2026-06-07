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
