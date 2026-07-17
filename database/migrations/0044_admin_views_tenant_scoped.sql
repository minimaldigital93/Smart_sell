-- 0044_admin_views_tenant_scoped.sql
--
-- Audit C3 (views): the admin dashboard views counted products/inventory
-- through the intentionally-public RLS clauses, so every store's KPIs
-- (low stock, out of stock, active products) aggregated the WHOLE platform.
-- Scope every leg to the caller's store; the superadmin keeps a platform-wide
-- view. Also fixes M17 while touching v_sales_by_day: day buckets were UTC,
-- splitting Cambodian business days at 07:00 local — bucket in ICT.
--
-- v_best_sellers is dropped: no app code has ever queried it.

-- ----------------------------------------------------------------------------
-- v_admin_dashboard
-- ----------------------------------------------------------------------------
create or replace view public.v_admin_dashboard
  with (security_invoker = true) as
select
  (select count(*) from public.orders o
    where o.status <> 'cancelled'
      and (public.is_superadmin() or o.store_id = public.current_store_id()))
                                                                                   as total_orders,
  (select count(*) from public.orders o
    where o.status = 'pending'
      and (public.is_superadmin() or o.store_id = public.current_store_id()))
                                                                                   as pending_orders,
  (select count(*) from public.orders o
    where o.status in ('payment_confirmed', 'preparing', 'shipping')
      and (public.is_superadmin() or o.store_id = public.current_store_id()))
                                                                                   as active_orders,
  (select coalesce(sum(o.total), 0) from public.orders o
    where o.status not in ('cancelled', 'pending')
      and (public.is_superadmin() or o.store_id = public.current_store_id()))
                                                                                   as total_revenue,
  (select count(*) from public.product_inventory pi
    where pi.current_stock <= pi.minimum_stock
      and (public.is_superadmin() or pi.store_id = public.current_store_id()))
                                                                                   as low_stock_count,
  (select count(*) from public.product_inventory pi
    where pi.current_stock = 0
      and (public.is_superadmin() or pi.store_id = public.current_store_id()))
                                                                                   as out_of_stock_count,
  (select count(*) from public.products p
    where p.is_active
      and (public.is_superadmin() or p.store_id = public.current_store_id()))
                                                                                   as active_products,
  -- Appended column (create or replace view only allows adding at the end):
  -- lets getInventoryStats read one row instead of scanning product_inventory.
  (select coalesce(sum(pi.current_stock), 0)::bigint from public.product_inventory pi
    where (public.is_superadmin() or pi.store_id = public.current_store_id()))
                                                                                   as total_units;

grant select on public.v_admin_dashboard to authenticated;

-- ----------------------------------------------------------------------------
-- v_sales_by_day: last 30 ICT days, store-scoped, paid orders only.
-- ----------------------------------------------------------------------------
create or replace view public.v_sales_by_day
  with (security_invoker = true) as
with days as (
  select generate_series(
    ((now() at time zone 'Asia/Phnom_Penh')::date - interval '29 days')::date,
    (now() at time zone 'Asia/Phnom_Penh')::date,
    interval '1 day'
  )::date as day
),
agg as (
  select
    (o.created_at at time zone 'Asia/Phnom_Penh')::date as day,
    count(*)::integer as orders,
    coalesce(sum(o.total), 0)::numeric(12,2) as revenue
  from public.orders o
  where o.status not in ('cancelled', 'pending')
    and o.created_at >= (now() - interval '31 days')
    and (public.is_superadmin() or o.store_id = public.current_store_id())
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
-- v_low_stock_products
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
  and (public.is_superadmin() or pi.store_id = public.current_store_id())
order by pi.current_stock asc, pi.minimum_stock - pi.current_stock desc;

grant select on public.v_low_stock_products to authenticated;

-- ----------------------------------------------------------------------------
-- v_best_sellers: dead — defined in 0012, never queried by the app.
-- ----------------------------------------------------------------------------
drop view if exists public.v_best_sellers;
