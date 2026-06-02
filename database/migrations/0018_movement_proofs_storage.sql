-- 0018_movement_proofs_storage.sql
-- Storage bucket for scan-flow barcode-proof photos. Staff-only — these are
-- internal audit records, not customer-facing assets.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'movement-proofs',
  'movement-proofs',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "movement_proofs_select_public" on storage.objects;
create policy "movement_proofs_select_public"
  on storage.objects for select
  using (bucket_id = 'movement-proofs');

drop policy if exists "movement_proofs_insert_staff" on storage.objects;
create policy "movement_proofs_insert_staff"
  on storage.objects for insert
  with check (bucket_id = 'movement-proofs' and public.is_staff());

drop policy if exists "movement_proofs_modify_staff" on storage.objects;
create policy "movement_proofs_modify_staff"
  on storage.objects for all
  using (bucket_id = 'movement-proofs' and public.is_staff())
  with check (bucket_id = 'movement-proofs' and public.is_staff());
