-- 0043_security_hardening.sql
--
-- Closes the critical authorization holes from the production-readiness audit
-- (docs/07_PRODUCTION_READINESS_AUDIT.md):
--
--   C1 — privileged SECURITY DEFINER RPCs were executable by any authenticated
--        user (some even by anon via the default PUBLIC grant): loyalty minting,
--        subscription self-activation, trial self-grants, coupon resets,
--        customer-driven inventory manipulation.
--   C2 — customers could UPDATE role/store_id on their own profiles row via
--        PostgREST (cross-tenant takeover with one API call).
--
-- Also removes the half-wired free-trial path (the platform is pay-first, see
-- docs/06_KNOWN_ISSUES.md) and forbids $0 subscription payments.
--
-- NOTE: 0043-0048 + the matching app deploy ship as ONE batch. Role checks use
-- auth.role() (the request JWT role), which is stable inside SECURITY DEFINER
-- chains: 'authenticated'/'anon' for client calls, 'service_role' for the
-- server's service-role client, NULL for direct DB sessions.

-- ============================================================================
-- (A) C1 — kill the RPC backdoors
-- ============================================================================

-- ---- A1. Loyalty RPCs: no client execution at all. -------------------------
-- 0020 never revoked the default PUBLIC execute grant, so even anon could mint
-- points (earn with p_order_id = NULL skipped the idempotency guard). The
-- app-side earn call is fire-and-forget and the whole loyalty feature is
-- removed in 0046; points simply stop accruing between the two migrations.
revoke all on function public.earn_loyalty_points(uuid, uuid, numeric)
  from public, anon, authenticated;
revoke all on function public.redeem_loyalty_points(uuid, uuid, integer)
  from public, anon, authenticated;

-- ---- A2. Dead / superseded RPCs: drop. -------------------------------------
drop function if exists public.redeem_coupon(text);           -- superseded by create_customer_order
drop function if exists public.unredeem_coupon(text);         -- superseded by refund_order_credits
drop function if exists public.start_store_trial(uuid, text); -- pay-first: no trials, ever

-- ---- A3. Trigger-only helpers: no direct client execution. -----------------
-- These are invoked from on_order_status_change() (a SECURITY DEFINER trigger
-- function), which needs no grant to call them.
revoke all on function public.apply_order_inventory(uuid)
  from public, anon, authenticated;
revoke all on function public.restock_cancelled_order(uuid)
  from public, anon, authenticated;
revoke all on function public.refund_order_credits(uuid)
  from public, anon, authenticated;

-- ---- A4. apply_inventory_movement: staff-only role guard inside the body. --
-- Same body as 0040 plus the role guard: any customer of a store could
-- previously zero out or inflate that store's inventory (the tenant guard
-- checked the store, not the role).
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
  -- Role guard: direct client calls must come from staff (or the superadmin).
  -- Definer-chain calls fired by a staff request pass is_staff(); service-role
  -- calls (payment finalize, webhooks) carry auth.role() = 'service_role'.
  if coalesce(auth.role(), '') in ('authenticated', 'anon')
     and not (public.is_staff() or public.is_superadmin()) then
    raise exception 'inventory movements require a staff account'
      using errcode = '42501';
  end if;

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
     and coalesce(auth.role(), '') in ('authenticated', 'anon')
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

revoke all on function public.apply_inventory_movement(
  uuid, public.movement_type, integer, text, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.apply_inventory_movement(
  uuid, public.movement_type, integer, text, uuid, uuid, text
) to authenticated;  -- role guard inside enforces staff

-- ---- A5. activate_subscription: superadmin/service-role only. --------------
-- A store owner could previously insert a $0 pending payment (allowed by
-- payments_insert_own) and self-activate — a free subscription forever. The
-- unguarded core moves to activate_subscription_internal (no client grants;
-- reused by the khqr.cc payment finalize in 0048), and the public wrapper is
-- gated to the superadmin. Also made idempotent: a payment extends the paid
-- period exactly once, even if approved twice.
create or replace function public.activate_subscription_internal(p_payment uuid)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_pay     record;
  v_new_end timestamptz;
begin
  select * into v_pay
    from public.subscription_payments where id = p_payment for update;
  if not found then
    raise exception 'payment % not found', p_payment;
  end if;

  -- Idempotent: never extend the period twice for the same payment.
  if v_pay.status = 'paid' then
    select current_period_end into v_new_end
      from public.stores where id = v_pay.store_id;
    return v_new_end;
  end if;

  update public.subscription_payments
     set status = 'paid', paid_at = coalesce(paid_at, now())
   where id = p_payment;

  select greatest(now(), coalesce(current_period_end, now())) + interval '30 days'
    into v_new_end
    from public.stores where id = v_pay.store_id;

  update public.stores
     set status = 'active', plan_id = coalesce(v_pay.plan_id, plan_id),
         current_period_end = v_new_end
   where id = v_pay.store_id;

  insert into public.subscriptions
    (store_id, plan_id, status, current_period_start, current_period_end)
  values (v_pay.store_id, v_pay.plan_id, 'active', now(), v_new_end)
  on conflict (store_id) do update
    set plan_id = coalesce(excluded.plan_id, public.subscriptions.plan_id),
        status = 'active',
        current_period_start = now(),
        current_period_end = excluded.current_period_end;

  return v_new_end;
end $$;

revoke all on function public.activate_subscription_internal(uuid)
  from public, anon, authenticated;

create or replace function public.activate_subscription(p_payment uuid)
returns timestamptz
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.is_superadmin() then
    raise exception 'only the platform superadmin can activate subscriptions'
      using errcode = '42501';
  end if;
  return public.activate_subscription_internal(p_payment);
end $$;

revoke all on function public.activate_subscription(uuid) from public, anon;
grant execute on function public.activate_subscription(uuid) to authenticated;

-- ============================================================================
-- (B) C2 — pin privileged profiles columns
-- ============================================================================
-- profiles_update_own only pinned `role`; store_id (added 0033) was freely
-- writable on your own row — staff of store A could move themselves into
-- store B. Guarded by trigger so it also covers the admin update policy.
-- (loyalty_points is intentionally NOT referenced here: the column is dropped
-- in 0046 and a trigger referencing it would break then.)
create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role
      or new.store_id is distinct from old.store_id)
     and coalesce(auth.role(), '') in ('authenticated', 'anon')
     and not public.is_superadmin()
  then
    raise exception 'not allowed to change role or store on a profile'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_columns();

-- ============================================================================
-- (C) Remove the free-trial path (pay-first, docs/06)
-- ============================================================================
update public.stores set status = 'locked' where status = 'trial';
alter table public.stores alter column status set default 'locked';

update public.subscriptions
   set status = case
     when current_period_end is not null and current_period_end > now()
       then 'active' else 'canceled' end
 where status = 'trialing';
alter table public.subscriptions alter column status set default 'active';
alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('active', 'past_due', 'canceled'));

-- Effective access state, without the trial branch. Mirrored by
-- effectiveStoreStatus in src/lib/tenant/status.ts — keep in sync.
create or replace function public.store_access_status(p_store uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when s.status in ('cancelled','locked') then s.status
    when s.current_period_end is not null and now() < s.current_period_end
      then 'active'
    when s.current_period_end is not null
         and now() < s.current_period_end + interval '3 days'
      then 'grace'
    else 'locked'
  end
  from public.stores s
  where s.id = p_store;
$$;

-- platform_summary: 'trial' no longer exists as an effective status — report
-- the total store count instead. Return shape changes, so drop + recreate.
drop function if exists public.platform_summary();
create function public.platform_summary()
returns table (
  mrr               numeric,
  active_stores     integer,
  total_stores      integer,
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
    (select count(*)::int from public.stores) as total_stores,
    (select count(*)::int from public.stores s where public.store_access_status(s.id) in ('grace','locked')) as overdue_stores,
    coalesce((select sum(amount_usd) from public.subscription_payments where status = 'paid'), 0) as total_revenue,
    coalesce((select sum(amount_usd) from public.platform_expenses), 0) as total_expense,
    coalesce((select sum(amount_usd) from public.subscription_payments
               where status = 'paid' and paid_at >= date_trunc('month', now())), 0) as month_revenue,
    coalesce((select sum(amount_usd) from public.platform_expenses
               where incurred_on >= date_trunc('month', now())::date), 0) as month_expense
  where public.is_superadmin();
$$;

revoke all on function public.platform_summary() from public, anon;
grant execute on function public.platform_summary() to authenticated;

-- ============================================================================
-- (D) Subscription payments must carry a real amount
-- ============================================================================
-- NOT VALID: applies to new/updated rows without failing on any legacy $0 row.
alter table public.subscription_payments
  drop constraint if exists subscription_payments_amount_usd_check;
alter table public.subscription_payments
  add constraint subscription_payments_amount_positive
  check (amount_usd > 0) not valid;
