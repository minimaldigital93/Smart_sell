-- 0007_functions_and_triggers.sql
-- Core domain functions:
--   * apply_inventory_movement(...)         -- atomic, idempotent stock change
--   * apply_order_inventory(order_id)       -- decrement stock for every item in an order
--   * Trigger: orders.status -> payment_confirmed runs apply_order_inventory
--   * Trigger: product_inventory.current_stock -> products.stock cache sync

-- ----------------------------------------------------------------------------
-- apply_inventory_movement
--
-- Transaction-safe: takes a row lock on product_inventory, validates that an
-- 'out' movement cannot drive stock below zero, inserts a row in
-- inventory_movements, and updates product_inventory.current_stock.
--
-- Returns the new resulting_stock.
-- ----------------------------------------------------------------------------
create or replace function public.apply_inventory_movement(
  p_product_id   uuid,
  p_movement     public.movement_type,
  p_quantity     integer,
  p_notes        text default null,
  p_order_id     uuid default null,
  p_created_by   uuid default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory   public.product_inventory%rowtype;
  v_delta       integer;
  v_new_stock   integer;
  v_barcode     text;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive (got %)', p_quantity
      using errcode = '22023';
  end if;

  -- Lock the inventory row for this product to serialize concurrent updates
  select * into v_inventory
  from public.product_inventory
  where product_id = p_product_id
  for update;

  if not found then
    raise exception 'no inventory row for product %', p_product_id
      using errcode = 'P0002';
  end if;

  -- Resolve delta from movement type
  if p_movement = 'in' then
    v_delta := p_quantity;
  elsif p_movement = 'out' then
    v_delta := -p_quantity;
  elsif p_movement = 'adjustment' then
    -- For adjustments, p_quantity is the *absolute target stock* (re-purposed).
    -- Compute delta to reach that target.
    v_delta := p_quantity - v_inventory.current_stock;
  end if;

  v_new_stock := v_inventory.current_stock + v_delta;

  if v_new_stock < 0 then
    raise exception 'insufficient stock: have %, requested %',
      v_inventory.current_stock, p_quantity
      using errcode = '23514';
  end if;

  v_barcode := v_inventory.barcode;

  -- Skip the ledger write when an adjustment results in no change.
  if v_delta = 0 then
    return v_new_stock;
  end if;

  insert into public.inventory_movements (
    product_id, barcode, movement_type, quantity, resulting_stock,
    order_id, created_by, notes
  ) values (
    p_product_id,
    v_barcode,
    p_movement,
    abs(v_delta),
    v_new_stock,
    p_order_id,
    p_created_by,
    p_notes
  );

  update public.product_inventory
     set current_stock = v_new_stock,
         updated_at    = now()
   where product_id   = p_product_id;

  return v_new_stock;
end $$;

revoke all on function public.apply_inventory_movement(uuid, public.movement_type, integer, text, uuid, uuid) from public;
grant execute on function public.apply_inventory_movement(uuid, public.movement_type, integer, text, uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- apply_order_inventory: decrement stock for every line item in an order.
-- Idempotent via orders.inventory_applied flag.
-- ----------------------------------------------------------------------------
create or replace function public.apply_order_inventory(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_already_applied boolean;
  v_user_id         uuid;
  v_item            record;
begin
  select inventory_applied, user_id
    into v_already_applied, v_user_id
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'order % not found', p_order_id using errcode = 'P0002';
  end if;

  if v_already_applied then
    return;
  end if;

  for v_item in
    select product_id, quantity
      from public.order_items
     where order_id = p_order_id
  loop
    perform public.apply_inventory_movement(
      v_item.product_id,
      'out'::public.movement_type,
      v_item.quantity,
      'order ' || p_order_id::text,
      p_order_id,
      v_user_id
    );
  end loop;

  update public.orders
     set inventory_applied = true
   where id = p_order_id;
end $$;

revoke all on function public.apply_order_inventory(uuid) from public;
grant execute on function public.apply_order_inventory(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: when an order transitions to payment_confirmed, deduct inventory.
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
  return new;
end $$;

drop trigger if exists orders_inventory_on_paid on public.orders;
create trigger orders_inventory_on_paid
  after update of status on public.orders
  for each row execute function public.on_order_status_change();

-- ----------------------------------------------------------------------------
-- Trigger: keep products.stock in sync with product_inventory.current_stock.
-- ----------------------------------------------------------------------------
create or replace function public.sync_product_stock_cache() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.products
     set stock = new.current_stock
   where id = new.product_id
     and stock is distinct from new.current_stock;
  return new;
end $$;

drop trigger if exists product_inventory_sync_cache on public.product_inventory;
create trigger product_inventory_sync_cache
  after insert or update of current_stock on public.product_inventory
  for each row execute function public.sync_product_stock_cache();
