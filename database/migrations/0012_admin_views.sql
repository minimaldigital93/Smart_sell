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
