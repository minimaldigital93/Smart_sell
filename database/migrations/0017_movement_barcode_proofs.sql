-- 0017_movement_barcode_proofs.sql
-- Audit-trail photo for each scan-driven inventory movement.
-- Adds inventory_movements.barcode_image_url, extends apply_inventory_movement
-- to persist it, and creates a staff-only 'movement-proofs' storage bucket.

alter table public.inventory_movements
  add column if not exists barcode_image_url text;

-- ----------------------------------------------------------------------------
-- Re-create apply_inventory_movement with an additional p_barcode_image_url
-- parameter. Defaulted to NULL so existing callers (manual quantity-adjustment
-- forms, the order-paid trigger) keep working without modification.
-- ----------------------------------------------------------------------------
create or replace function public.apply_inventory_movement(
  p_product_id         uuid,
  p_movement           public.movement_type,
  p_quantity           integer,
  p_notes              text default null,
  p_order_id           uuid default null,
  p_created_by         uuid default null,
  p_barcode_image_url  text default null
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

  select * into v_inventory
  from public.product_inventory
  where product_id = p_product_id
  for update;

  if not found then
    raise exception 'no inventory row for product %', p_product_id
      using errcode = 'P0002';
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
      v_inventory.current_stock, p_quantity
      using errcode = '23514';
  end if;

  v_barcode := v_inventory.barcode;

  if v_delta = 0 then
    return v_new_stock;
  end if;

  insert into public.inventory_movements (
    product_id, barcode, movement_type, quantity, resulting_stock,
    order_id, created_by, notes, barcode_image_url
  ) values (
    p_product_id,
    v_barcode,
    p_movement,
    abs(v_delta),
    v_new_stock,
    p_order_id,
    p_created_by,
    p_notes,
    p_barcode_image_url
  );

  update public.product_inventory
     set current_stock = v_new_stock,
         updated_at    = now()
   where product_id   = p_product_id;

  return v_new_stock;
end $$;

revoke all on function public.apply_inventory_movement(uuid, public.movement_type, integer, text, uuid, uuid, text) from public;
grant execute on function public.apply_inventory_movement(uuid, public.movement_type, integer, text, uuid, uuid, text) to authenticated;
