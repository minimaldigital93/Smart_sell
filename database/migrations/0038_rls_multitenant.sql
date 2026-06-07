-- 0038_rls_multitenant.sql
-- Rewrite RLS on every tenant-owned table so a store's staff/admin see and
-- modify ONLY their own store's rows, while the platform superadmin bypasses
-- tenant scoping everywhere. Public catalog reads (active products, inventory,
-- active coupons, store branding) stay readable so anonymous storefront
-- visitors work; the app filters those by the resolved store_id.
--
-- Pattern:
--   reads  : is_superadmin() OR (is_staff() AND store_id = current_store_id())
--            [+ owner/customer/public clauses where they already existed]
--   writes : is_superadmin() OR (is_staff() AND store_id = current_store_id())
--
-- Customer + guest checkout still flows through create_customer_order (SECURITY
-- DEFINER), which bypasses these policies.

-- ============================================================================
-- profiles
-- ============================================================================
drop policy if exists profiles_select_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff on public.profiles
  for select
  using (
    id = auth.uid()
    or public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

-- profiles_update_own (unchanged intent) stays from 0008.

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update
  using (
    public.is_superadmin()
    or (public.is_admin() and store_id = public.current_store_id())
  )
  with check (
    public.is_superadmin()
    or (public.is_admin() and store_id = public.current_store_id())
  );

-- ============================================================================
-- products
-- ============================================================================
drop policy if exists products_select_public on public.products;
create policy products_select_public on public.products
  for select
  using (
    is_active
    or public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

drop policy if exists products_modify_staff on public.products;
create policy products_modify_staff on public.products
  for all
  using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  )
  with check (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

-- ============================================================================
-- product_inventory (stock is non-sensitive: public read kept)
-- ============================================================================
drop policy if exists inventory_modify_staff on public.product_inventory;
create policy inventory_modify_staff on public.product_inventory
  for all
  using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  )
  with check (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

-- ============================================================================
-- orders
-- ============================================================================
drop policy if exists orders_select_owner_or_staff on public.orders;
create policy orders_select_owner_or_staff on public.orders
  for select
  using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
    or (user_id is not null and user_id = auth.uid())
  );

drop policy if exists orders_insert_staff_only on public.orders;
create policy orders_insert_staff_only on public.orders
  for insert
  with check (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

drop policy if exists orders_update_staff on public.orders;
create policy orders_update_staff on public.orders
  for update
  using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  )
  with check (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

-- ============================================================================
-- order_items
-- ============================================================================
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select
  using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
    or exists (
      select 1 from public.orders o
       where o.id = order_items.order_id
         and o.user_id = auth.uid()
    )
  );

drop policy if exists order_items_insert_staff_only on public.order_items;
create policy order_items_insert_staff_only on public.order_items
  for insert
  with check (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

drop policy if exists order_items_modify_staff on public.order_items;
create policy order_items_modify_staff on public.order_items
  for update
  using (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()))
  with check (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

drop policy if exists order_items_delete_staff on public.order_items;
create policy order_items_delete_staff on public.order_items
  for delete
  using (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

-- ============================================================================
-- inventory_movements (staff/admin of the store only)
-- ============================================================================
drop policy if exists movements_select_staff on public.inventory_movements;
create policy movements_select_staff on public.inventory_movements
  for select
  using (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

drop policy if exists movements_insert_staff on public.inventory_movements;
create policy movements_insert_staff on public.inventory_movements
  for insert
  with check (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

-- ============================================================================
-- notifications (store-scoped broadcasts; NULL store_id = platform-wide)
-- ============================================================================
drop policy if exists notifications_select_visible on public.notifications;
create policy notifications_select_visible on public.notifications
  for select
  using (
    user_id = auth.uid()
    or public.is_superadmin()
    or (store_id is null and user_id is null and audience = 'all')
    or (store_id = public.current_store_id() and user_id is null and audience = 'all')
    or (store_id = public.current_store_id() and user_id is null and audience = 'staff' and public.is_staff())
    or (public.is_staff() and store_id = public.current_store_id())
  );

-- notifications_update_own (user_id = auth.uid()) stays from 0008.

drop policy if exists notifications_modify_staff on public.notifications;
create policy notifications_modify_staff on public.notifications
  for all
  using (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()))
  with check (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

-- ============================================================================
-- coupons (active coupons publicly readable; writes store-scoped)
-- ============================================================================
drop policy if exists coupons_select_active_or_staff on public.coupons;
create policy coupons_select_active_or_staff on public.coupons
  for select
  using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
    or (
      is_active
      and (starts_at is null or starts_at <= now())
      and (expires_at is null or expires_at > now())
    )
  );

drop policy if exists coupons_modify_staff on public.coupons;
create policy coupons_modify_staff on public.coupons
  for all
  using (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()))
  with check (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

-- ============================================================================
-- loyalty_transactions
-- ============================================================================
drop policy if exists loyalty_txn_select_own on public.loyalty_transactions;
create policy loyalty_txn_select_own on public.loyalty_transactions
  for select
  using (
    user_id = auth.uid()
    or public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

drop policy if exists loyalty_txn_modify_staff on public.loyalty_transactions;
create policy loyalty_txn_modify_staff on public.loyalty_transactions
  for all
  using (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()))
  with check (public.is_superadmin() or (public.is_staff() and store_id = public.current_store_id()));

-- ============================================================================
-- store_settings (per-store; branding publicly readable, admin-of-store writes)
-- ============================================================================
drop policy if exists store_settings_update_admin on public.store_settings;
create policy store_settings_update_admin on public.store_settings
  for update
  using (public.is_superadmin() or (public.is_admin() and store_id = public.current_store_id()))
  with check (public.is_superadmin() or (public.is_admin() and store_id = public.current_store_id()));

-- New stores get a settings row from the on_store_created trigger (0035), but
-- allow admin/superadmin INSERT too for completeness.
drop policy if exists store_settings_insert_admin on public.store_settings;
create policy store_settings_insert_admin on public.store_settings
  for insert
  with check (public.is_superadmin() or (public.is_admin() and store_id = public.current_store_id()));

-- ============================================================================
-- stores (replace the interim 0033 policies with full set)
-- ============================================================================
drop policy if exists stores_owner_read on public.stores;
create policy stores_owner_read on public.stores
  for select
  using (public.is_superadmin() or id = public.current_store_id());

drop policy if exists stores_owner_update on public.stores;
create policy stores_owner_update on public.stores
  for update
  using (public.is_superadmin() or (public.is_admin() and id = public.current_store_id()))
  with check (public.is_superadmin() or (public.is_admin() and id = public.current_store_id()));
