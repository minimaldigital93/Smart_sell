-- 0011_payment_proofs_storage.sql
-- Storage bucket for KHQR / bank-transfer payment screenshots.
--
-- Public read with UUID-prefixed paths. If you need stricter privacy, flip
-- `public` to false and switch the SELECT policy to: bucket_id = 'payment-proofs'
-- AND public.is_staff() — then have the client fetch images through a
-- server route that issues signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Allow anyone to upload to this bucket (anon + authenticated). Required for
-- guest checkout. The DB still validates everything else server-side.
drop policy if exists "payment_proofs_insert_anyone" on storage.objects;
create policy "payment_proofs_insert_anyone"
  on storage.objects for insert
  with check (bucket_id = 'payment-proofs');

-- Everyone can read (bucket is public).
drop policy if exists "payment_proofs_select_public" on storage.objects;
create policy "payment_proofs_select_public"
  on storage.objects for select
  using (bucket_id = 'payment-proofs');

-- Staff can delete/replace (for moderation).
drop policy if exists "payment_proofs_modify_staff" on storage.objects;
create policy "payment_proofs_modify_staff"
  on storage.objects for all
  using (bucket_id = 'payment-proofs' and public.is_staff())
  with check (bucket_id = 'payment-proofs' and public.is_staff());
