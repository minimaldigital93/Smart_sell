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
