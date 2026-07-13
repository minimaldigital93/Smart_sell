-- 0042_checkout_honor_store_shipping_fee.sql
--
-- BUGFIX (audit C1): customer checkout was charging a hardcoded $2 shipping fee
-- regardless of the fee configured in Settings.
--
-- 0031 fixed create_customer_order to read the fee from store_settings, but the
-- 0040 rewrite (which added p_store_id for multi-tenancy) reintroduced the
-- hardcoded `c_shipping_fee constant := 2`. Because 0040 is the latest
-- definition, every real online order has since been charged $2 flat while the
-- storefront cart displays the store's configured fee (getStoreSettings ->
-- store_settings.shipping_fee), so the total the customer sees never matched the
-- total written to the order.
--
-- This recreates the function byte-for-byte from 0040 except that the shipping
-- fee is read from the resolved store's store_settings row (per-store since
-- 0035), defaulting to 2 when the row/value is missing. The function is SECURITY
-- DEFINER, so it can read store_settings regardless of the caller's RLS.

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
  p_points         integer default 0,
  p_store_id       uuid default null
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

  -- 3. Loyalty points: cap to balance + ratio, deduct atomically.
  if p_points > 0 and v_user is not null then
    select loyalty_points into v_avail
      from public.profiles where id = v_user for update;
    v_avail := coalesce(v_avail, 0);
    v_capped_pts := least(p_points, v_avail);
    if v_capped_pts > 0 then
      v_max_by_ratio := round(v_subtotal * 0.5, 2);
      v_remaining    := greatest(0, round(v_subtotal + v_shipping_fee - v_coupon_disc, 2));
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
        (store_id, user_id, order_id, type, points, balance_after, note)
      values
        (v_store, v_user, p_order_id, 'redeem', -v_pts_redeem, v_bal, 'checkout redemption');
    end if;
  end if;

  -- 4. Final money math.
  v_discount := round(v_coupon_disc + v_pts_disc, 2);
  if v_discount > round(v_subtotal + v_shipping_fee, 2) then
    v_discount := round(v_subtotal + v_shipping_fee, 2);
  end if;
  v_total := round(v_subtotal + v_shipping_fee - v_discount, 2);

  -- 5. Persist order + items, stamped with the store.
  insert into public.orders (
    id, store_id, user_id, customer_name, phone, address, note,
    subtotal, shipping_fee, discount, total,
    payment_method, payment_image, coupon_id, coupon_code, points_redeemed
  ) values (
    p_order_id, v_store, v_user, p_customer_name, p_phone, p_address,
    nullif(trim(coalesce(p_note, '')), ''),
    v_subtotal, v_shipping_fee, v_discount, v_total,
    p_payment_method, p_payment_image, v_coupon_id, v_coupon_code, v_pts_redeem
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
  uuid, text, text, text, text, public.payment_method, text, jsonb, text, integer, uuid
) from public;
grant execute on function public.create_customer_order(
  uuid, text, text, text, text, public.payment_method, text, jsonb, text, integer, uuid
) to authenticated, anon;
