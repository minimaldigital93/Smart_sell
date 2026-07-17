-- 0045_storage_tenant_scope.sql
--
-- Audit C3 (storage): buckets were not tenant-scoped at all —
--   * staff of ANY store could read EVERY store's customer payment screenshots
--     (financial PII) and movement-proof photos;
--   * staff could write/delete other stores' product images;
--   * two stores could overwrite each other's logos (flat logo-<ts> paths).
--
-- Approach:
--   * READS of sensitive buckets are scoped to the owning store (resolved from
--     the path or the owning order row). Public catalog reads stay public.
--   * WRITES from client/staff sessions must use store-prefixed paths:
--     stores/{current_store_id()}/... — the app now uploads with that prefix.
--     Legacy flat paths remain readable so existing media keeps rendering.
--   * The superadmin and the service-role client (bypasses RLS) are unaffected.

-- ----------------------------------------------------------------------------
-- payment-proofs: read = order owner, the owning store's staff, or superadmin.
-- Order proofs live at <order_id>/<file>; subscription proofs at
-- subscriptions/<store_id>/<file>. Writes are service-role only (0027).
-- ----------------------------------------------------------------------------
drop policy if exists "payment_proofs_select_owner_or_staff" on storage.objects;
create policy "payment_proofs_select_owner_or_staff"
  on storage.objects for select
  using (
    bucket_id = 'payment-proofs'
    and (
      public.is_superadmin()
      or (
        public.is_staff()
        and (
          -- order proof owned by the staff member's store
          exists (
            select 1 from public.orders o
             where o.id::text = split_part(name, '/', 1)
               and o.store_id = public.current_store_id()
          )
          -- this store's own subscription proofs
          or (split_part(name, '/', 1) = 'subscriptions'
              and split_part(name, '/', 2) = public.current_store_id()::text)
        )
      )
      -- the customer who placed the order
      or exists (
        select 1 from public.orders o
         where o.user_id = auth.uid()
           and o.id::text = split_part(name, '/', 1)
      )
    )
  );

drop policy if exists "payment_proofs_modify_staff" on storage.objects;
create policy "payment_proofs_modify_staff"
  on storage.objects for delete
  using (
    bucket_id = 'payment-proofs'
    and (
      public.is_superadmin()
      or (
        public.is_staff()
        and exists (
          select 1 from public.orders o
           where o.id::text = split_part(name, '/', 1)
             and o.store_id = public.current_store_id()
        )
      )
    )
  );

-- ----------------------------------------------------------------------------
-- product-images: public read unchanged; writes require the caller's store
-- prefix (stores/{store_id}/...). Legacy flat files stay readable but can no
-- longer be overwritten/deleted by other stores' staff.
-- ----------------------------------------------------------------------------
drop policy if exists "product_images_insert_staff" on storage.objects;
create policy "product_images_insert_staff"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (
      public.is_superadmin()
      or (
        public.is_staff()
        and split_part(name, '/', 1) = 'stores'
        and split_part(name, '/', 2) = public.current_store_id()::text
      )
    )
  );

drop policy if exists "product_images_modify_staff" on storage.objects;
create policy "product_images_modify_staff"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (
      public.is_superadmin()
      or (
        public.is_staff()
        and split_part(name, '/', 1) = 'stores'
        and split_part(name, '/', 2) = public.current_store_id()::text
      )
    )
  );

-- ----------------------------------------------------------------------------
-- movement-proofs: reads scoped to the owning store. New uploads live at
-- stores/{store_id}/{product_id}/<file>; legacy paths ({product_id}/<file>)
-- are attributed through the product row.
-- ----------------------------------------------------------------------------
drop policy if exists "movement_proofs_select_staff" on storage.objects;
create policy "movement_proofs_select_staff"
  on storage.objects for select
  using (
    bucket_id = 'movement-proofs'
    and (
      public.is_superadmin()
      or (
        public.is_staff()
        and (
          (split_part(name, '/', 1) = 'stores'
           and split_part(name, '/', 2) = public.current_store_id()::text)
          or exists (
            select 1 from public.products p
             where p.id::text = split_part(name, '/', 1)
               and p.store_id = public.current_store_id()
          )
        )
      )
    )
  );

drop policy if exists "movement_proofs_insert_staff" on storage.objects;
create policy "movement_proofs_insert_staff"
  on storage.objects for insert
  with check (
    bucket_id = 'movement-proofs'
    and (
      public.is_superadmin()
      or (
        public.is_staff()
        and split_part(name, '/', 1) = 'stores'
        and split_part(name, '/', 2) = public.current_store_id()::text
      )
    )
  );

drop policy if exists "movement_proofs_modify_staff" on storage.objects;
create policy "movement_proofs_modify_staff"
  on storage.objects for delete
  using (
    bucket_id = 'movement-proofs'
    and (
      public.is_superadmin()
      or (
        public.is_staff()
        and (
          (split_part(name, '/', 1) = 'stores'
           and split_part(name, '/', 2) = public.current_store_id()::text)
          or exists (
            select 1 from public.products p
             where p.id::text = split_part(name, '/', 1)
               and p.store_id = public.current_store_id()
          )
        )
      )
    )
  );

-- ----------------------------------------------------------------------------
-- branding: public read unchanged; admin writes require the store prefix
-- (stores/{store_id}/logo-<ts>.<ext>), ending cross-store logo overwrites.
-- ----------------------------------------------------------------------------
drop policy if exists "branding_modify_admin" on storage.objects;
create policy "branding_modify_admin"
  on storage.objects for all
  using (
    bucket_id = 'branding'
    and (
      public.is_superadmin()
      or (
        public.is_admin()
        and split_part(name, '/', 1) = 'stores'
        and split_part(name, '/', 2) = public.current_store_id()::text
      )
    )
  )
  with check (
    bucket_id = 'branding'
    and (
      public.is_superadmin()
      or (
        public.is_admin()
        and split_part(name, '/', 1) = 'stores'
        and split_part(name, '/', 2) = public.current_store_id()::text
      )
    )
  );
