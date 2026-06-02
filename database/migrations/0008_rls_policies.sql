-- 0008_rls_policies.sql
-- Row-Level Security policies for every public table.
--
-- Helper functions live in public.is_admin() / public.is_staff() to keep
-- policies readable. Both are SECURITY DEFINER and stable, so they cache per
-- statement and avoid recursive RLS checks on profiles.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and role = 'admin'
  );
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and role in ('admin', 'staff')
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- ============================================================================
-- profiles
-- ============================================================================
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff on public.profiles
  for select
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- Customers can update their own name/phone but not role.
    and (role = (select role from public.profiles where id = auth.uid()))
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- profile rows are inserted by the on_auth_user_created trigger (SECURITY DEFINER);
-- no INSERT policy needed for users.

-- ============================================================================
-- products
-- ============================================================================
alter table public.products enable row level security;

drop policy if exists products_select_public on public.products;
create policy products_select_public on public.products
  for select
  using (is_active or public.is_staff());

drop policy if exists products_modify_staff on public.products;
create policy products_modify_staff on public.products
  for all
  using (public.is_staff())
  with check (public.is_staff());

-- ============================================================================
-- product_inventory
-- ============================================================================
alter table public.product_inventory enable row level security;

drop policy if exists inventory_select_public on public.product_inventory;
create policy inventory_select_public on public.product_inventory
  for select
  using (true);

drop policy if exists inventory_modify_staff on public.product_inventory;
create policy inventory_modify_staff on public.product_inventory
  for all
  using (public.is_staff())
  with check (public.is_staff());

-- ============================================================================
-- orders
-- ============================================================================
alter table public.orders enable row level security;

drop policy if exists orders_select_owner_or_staff on public.orders;
create policy orders_select_owner_or_staff on public.orders
  for select
  using (
    public.is_staff()
    or (user_id is not null and user_id = auth.uid())
  );

-- Customer can create their own order (user_id = auth.uid()) or anonymous (null).
drop policy if exists orders_insert_self on public.orders;
create policy orders_insert_self on public.orders
  for insert
  with check (
    user_id is null
    or user_id = auth.uid()
    or public.is_staff()
  );

drop policy if exists orders_update_staff on public.orders;
create policy orders_update_staff on public.orders
  for update
  using (public.is_staff())
  with check (public.is_staff());

-- ============================================================================
-- order_items
-- ============================================================================
alter table public.order_items enable row level security;

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select
  using (
    public.is_staff()
    or exists (
      select 1 from public.orders o
       where o.id = order_items.order_id
         and o.user_id = auth.uid()
    )
  );

drop policy if exists order_items_insert_with_order on public.order_items;
create policy order_items_insert_with_order on public.order_items
  for insert
  with check (
    public.is_staff()
    or exists (
      select 1 from public.orders o
       where o.id = order_items.order_id
         and (o.user_id is null or o.user_id = auth.uid())
    )
  );

drop policy if exists order_items_modify_staff on public.order_items;
create policy order_items_modify_staff on public.order_items
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists order_items_delete_staff on public.order_items;
create policy order_items_delete_staff on public.order_items
  for delete using (public.is_staff());

-- ============================================================================
-- inventory_movements (staff/admin only)
-- ============================================================================
alter table public.inventory_movements enable row level security;

drop policy if exists movements_select_staff on public.inventory_movements;
create policy movements_select_staff on public.inventory_movements
  for select using (public.is_staff());

-- Inserts happen only through apply_inventory_movement (SECURITY DEFINER).
-- We still allow staff to insert directly for manual adjustments if needed.
drop policy if exists movements_insert_staff on public.inventory_movements;
create policy movements_insert_staff on public.inventory_movements
  for insert with check (public.is_staff());

-- ============================================================================
-- notifications
-- ============================================================================
alter table public.notifications enable row level security;

drop policy if exists notifications_select_visible on public.notifications;
create policy notifications_select_visible on public.notifications
  for select
  using (
    user_id is null            -- broadcast: everyone
    or user_id = auth.uid()    -- targeted at me
    or public.is_staff()       -- staff sees all
  );

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_modify_staff on public.notifications;
create policy notifications_modify_staff on public.notifications
  for all
  using (public.is_staff())
  with check (public.is_staff());
