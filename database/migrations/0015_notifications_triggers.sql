-- 0015_notifications_triggers.sql
-- Auto-create notifications on key events:
--   * orders INSERT          → staff-broadcast "New order"
--   * orders status UPDATE   → user-targeted (if user_id set) order update
--   * product_inventory.current_stock crosses min → staff-broadcast low stock

create or replace function public.notify_new_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, audience, title, message, type, metadata)
  values (
    null,
    'staff',
    'New order',
    format(
      'From %s · $%s · %s',
      new.customer_name,
      to_char(new.total, 'FM999990.00'),
      new.payment_method
    ),
    'order',
    jsonb_build_object('order_id', new.id, 'status', new.status::text)
  );
  return new;
end $$;

drop trigger if exists notify_new_order_trg on public.orders;
create trigger notify_new_order_trg
  after insert on public.orders
  for each row execute function public.notify_new_order();

-- ---------------------------------------------------------------------------
create or replace function public.notify_order_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_message text;
begin
  if new.status is distinct from old.status then
    if new.user_id is not null then
      v_message := case new.status
        when 'payment_confirmed' then 'Your payment was confirmed.'
        when 'preparing'         then 'We''re preparing your order.'
        when 'shipping'          then 'Your order is on the way.'
        when 'delivered'         then 'Your order was delivered. Thank you!'
        when 'cancelled'         then 'Your order was cancelled.'
        else format('Order status: %s', replace(new.status::text, '_', ' '))
      end;

      insert into public.notifications (user_id, audience, title, message, type, metadata)
      values (
        new.user_id,
        'all',
        'Order update',
        v_message,
        'order',
        jsonb_build_object('order_id', new.id, 'status', new.status::text)
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists notify_order_status_trg on public.orders;
create trigger notify_order_status_trg
  after update of status on public.orders
  for each row execute function public.notify_order_status_change();

-- ---------------------------------------------------------------------------
-- Fire only on the *transition* from healthy → low/out, to avoid spam.
create or replace function public.notify_low_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_was_healthy boolean;
  v_now_low     boolean;
  v_name        text;
begin
  v_was_healthy := old.current_stock > old.minimum_stock;
  v_now_low     := new.current_stock <= new.minimum_stock;

  if v_was_healthy and v_now_low then
    select name into v_name from public.products where id = new.product_id;
    insert into public.notifications (user_id, audience, title, message, type, metadata)
    values (
      null,
      'staff',
      case when new.current_stock = 0 then 'Out of stock' else 'Low stock' end,
      format('%s · %s on hand · min %s',
        coalesce(v_name, 'Product'),
        new.current_stock,
        new.minimum_stock
      ),
      'inventory',
      jsonb_build_object(
        'product_id', new.product_id,
        'current_stock', new.current_stock,
        'minimum_stock', new.minimum_stock
      )
    );
  end if;
  return new;
end $$;

drop trigger if exists notify_low_stock_trg on public.product_inventory;
create trigger notify_low_stock_trg
  after update of current_stock, minimum_stock on public.product_inventory
  for each row execute function public.notify_low_stock();
