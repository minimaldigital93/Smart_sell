-- 0025_private_media_buckets.sql
--
-- Audit findings #7 + #9: sensitive media was world-readable.
--
--   payment-proofs  — KHQR / bank-transfer receipts (financial PII). Was a
--                     public bucket relying only on unguessable UUID paths.
--   movement-proofs — internal barcode/scan audit photos that the migration
--                     itself described as "staff-only" but were public.
--
-- Both are flipped to private. Reads now require a signed URL minted under the
-- viewer's session (see src/lib/storage/signed-url.ts):
--   * payment-proofs : the order owner OR staff
--   * movement-proofs: staff only
-- Uploads are unchanged (anon may still upload payment proofs for guest
-- checkout; staff upload movement proofs).

-- ----------------------------------------------------------------------------
-- payment-proofs -> private, owner-or-staff read
-- ----------------------------------------------------------------------------
update storage.buckets set public = false where id = 'payment-proofs';

-- Read access is keyed off ORDER ownership, not storage.objects.owner: the
-- screenshot is uploaded by the service-role client (see migration 0027), so
-- `owner` is not the customer. The object path is `<order_id>/<file>`, so the
-- first path segment maps back to the owning order.
drop policy if exists "payment_proofs_select_public" on storage.objects;
drop policy if exists "payment_proofs_select_owner_or_staff" on storage.objects;
create policy "payment_proofs_select_owner_or_staff"
  on storage.objects for select
  using (
    bucket_id = 'payment-proofs'
    and (
      public.is_staff()
      or exists (
        select 1 from public.orders o
         where o.user_id = auth.uid()
           and o.id::text = split_part(name, '/', 1)
      )
    )
  );

-- ----------------------------------------------------------------------------
-- movement-proofs -> private, staff read
-- ----------------------------------------------------------------------------
update storage.buckets set public = false where id = 'movement-proofs';

drop policy if exists "movement_proofs_select_public" on storage.objects;
drop policy if exists "movement_proofs_select_staff" on storage.objects;
create policy "movement_proofs_select_staff"
  on storage.objects for select
  using (bucket_id = 'movement-proofs' and public.is_staff());
