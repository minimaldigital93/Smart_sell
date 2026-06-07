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
