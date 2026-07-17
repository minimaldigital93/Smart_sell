-- 0046_drop_loyalty_and_canonical_checkout.sql
--
-- Remove the loyalty-points feature entirely (product decision, 2026-07-16):
-- it was a platform-global wallet across independent merchants and the source
-- of two critical exploits (audit C1/C2 — unlimited self-minting). The
-- matching app release strips the checkout points field, account balance UI,
-- and earn-on-delivered call.
--
-- Also rewrites create_customer_order as the single CANONICAL v3 definition
-- (the body was previously duplicated across 0024/0031/0040/0042, which is
-- exactly how the shipping-fee regression happened — future changes edit THIS
-- definition only):
--   * no loyalty/points logic;
--   * p_payment_image moved to the end and made optional (the KHQR payment
--     flow in 0047 stops uploading screenshots);
--   * everything else byte-for-byte from 0042 (per-store shipping fee kept).
--
-- KEPT: orders.points_redeemed — historical fact backing old orders' discount
-- math; marked legacy below.

-- ============================================================================
-- (A) Drop loyalty RPCs (grants already revoked in 0043)
-- ============================================================================
drop function if exists public.earn_loyalty_points(uuid, uuid, numeric);
drop function if exists public.redeem_loyalty_points(uuid, uuid, integer);

-- ============================================================================
-- (B) refund_order_credits: coupon release only (no points to return)
-- ============================================================================
create or replace function public.refund_order_credits(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cid   uuid;
  v_done  boolean;
begin
  -- Target the coupon by its stable id, not the code snapshot — staff may have
  -- renamed the coupon since this order redeemed it.
  select coupon_id, credits_refunded
    into v_cid, v_done
    from public.orders where id = p_order_id for update;

  if not found or v_done then
    return;
  end if;

  if v_cid is not null then
    update public.coupons
       set redeemed_count = greatest(redeemed_count - 1, 0), updated_at = now()
     where id = v_cid;
  end if;

  update public.orders set credits_refunded = true where id = p_order_id;
end $$;
-- Trigger-only: no client grants (0043 posture).
revoke all on function public.refund_order_credits(uuid)
  from public, anon, authenticated;

-- ============================================================================
-- (C) CANONICAL v3 create_customer_order — the ONLY definition to edit
-- ============================================================================
drop function if exists public.create_customer_order(
  uuid, text, text, text, text, public.payment_method, text, jsonb, text, integer, uuid
);

create or replace function public.create_customer_order(
  p_order_id       uuid,
  p_customer_name  text,
  p_phone          text,
  p_address        text,
  p_note           text,
  p_payment_method public.payment_method,
  p_items          jsonb,
  p_coupon_code    text default null,
  p_store_id       uuid default null,
  p_payment_image  text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_shipping_fee  numeric(10,2);              -- read from store_settings below
  v_store         uuid := coalesce(p_store_id, public.default_store_id());
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
  v_discount      numeric(10,2);
  v_total         numeric(10,2);
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'cart is empty' using errcode = '22023';
  end if;

  -- Shipping fee is store-configurable (Settings -> shipping_fee); default to 2
  -- when the store has no settings row/value. Keeps the charged total in sync
  -- with the fee shown in the storefront cart.
  select shipping_fee into v_shipping_fee
    from public.store_settings where store_id = v_store;
  v_shipping_fee := coalesce(v_shipping_fee, 2);

  -- 1. Validate every line (scoped to this store), lock inventory, recompute.
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
       and p.store_id = v_store
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

  -- 2. Coupon: scoped to this store.
  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon
      from public.coupons
     where code = upper(trim(p_coupon_code))
       and store_id = v_store
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

  -- 3. Final money math.
  v_discount := round(v_coupon_disc, 2);
  if v_discount > round(v_subtotal + v_shipping_fee, 2) then
    v_discount := round(v_subtotal + v_shipping_fee, 2);
  end if;
  v_total := round(v_subtotal + v_shipping_fee - v_discount, 2);

  -- 4. Persist order + items, stamped with the store.
  insert into public.orders (
    id, store_id, user_id, customer_name, phone, address, note,
    subtotal, shipping_fee, discount, total,
    payment_method, payment_image, coupon_id, coupon_code
  ) values (
    p_order_id, v_store, v_user, p_customer_name, p_phone, p_address,
    nullif(trim(coalesce(p_note, '')), ''),
    v_subtotal, v_shipping_fee, v_discount, v_total,
    p_payment_method, p_payment_image, v_coupon_id, v_coupon_code
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (store_id, order_id, product_id, product_name, quantity, price)
    values (
      v_store,
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
  uuid, text, text, text, text, public.payment_method, jsonb, text, uuid, text
) from public;
grant execute on function public.create_customer_order(
  uuid, text, text, text, text, public.payment_method, jsonb, text, uuid, text
) to authenticated, anon;

-- ============================================================================
-- (D) Drop loyalty storage
-- ============================================================================
drop table if exists public.loyalty_transactions;
drop type if exists public.loyalty_transaction_type;
alter table public.profiles drop column if exists loyalty_points;

comment on column public.orders.points_redeemed is
  'LEGACY (loyalty removed in 0046): points redeemed on historical orders; '
  'still explains their discount amount. Always 0/null for new orders.';

-- ============================================================================
-- (E) Scrub loyalty from plan marketing/limits
-- ============================================================================
update public.subscription_plans
   set limits = limits - 'loyalty',
       features = (
         select coalesce(jsonb_agg(
           case when f.value = '"Coupons & loyalty"'::jsonb
                then '"Coupons"'::jsonb else f.value end), '[]'::jsonb)
           from jsonb_array_elements(features) as f(value)
       ),
       updated_at = now()
 where limits ? 'loyalty' or features @> '["Coupons & loyalty"]'::jsonb;
