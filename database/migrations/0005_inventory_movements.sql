-- 0005_inventory_movements.sql
-- Append-only ledger of every stock change. Written by apply_inventory_movement()
-- in 0007 — do not insert directly except through that function.

create table if not exists public.inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete restrict,
  barcode         text,
  movement_type   public.movement_type not null,
  quantity        integer not null check (quantity > 0),
  resulting_stock integer not null check (resulting_stock >= 0),
  order_id        uuid references public.orders(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists inventory_movements_product_id_idx
  on public.inventory_movements(product_id, created_at desc);
create index if not exists inventory_movements_created_at_idx
  on public.inventory_movements(created_at desc);
create index if not exists inventory_movements_order_id_idx
  on public.inventory_movements(order_id) where order_id is not null;
