-- 0028_store_settings.sql
-- Single-row store settings: branding (name, tagline, logo), theme preset,
-- default language, currency, shipping fee, contact info. Publicly readable so
-- the storefront can render branding for anonymous visitors; admin-only writes.

create table if not exists public.store_settings (
  id             smallint primary key default 1 check (id = 1),
  business_name  text not null default 'Lumière',
  tagline        text not null default 'Cosmetic Store Management',
  logo_url       text,
  theme          text not null default 'rose',
  default_locale text not null default 'en' check (default_locale in ('en', 'km')),
  currency       text not null default 'USD',
  shipping_fee   numeric(10, 2) not null default 2 check (shipping_fee >= 0),
  contact_phone  text,
  contact_address text,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users (id) on delete set null
);

-- Singleton row so the app can always read/update id = 1.
insert into public.store_settings (id) values (1) on conflict (id) do nothing;

alter table public.store_settings enable row level security;

-- Branding is shown to everyone, including signed-out storefront visitors.
drop policy if exists store_settings_read on public.store_settings;
create policy store_settings_read on public.store_settings
  for select using (true);

-- Only admins may change settings. The singleton already exists, so an UPDATE
-- policy is sufficient; no INSERT/DELETE is exposed.
drop policy if exists store_settings_update_admin on public.store_settings;
create policy store_settings_update_admin on public.store_settings
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- Keep updated_at fresh on every write.
create or replace function public.touch_store_settings() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists store_settings_touch on public.store_settings;
create trigger store_settings_touch
  before update on public.store_settings
  for each row execute function public.touch_store_settings();

-- Storage bucket for the logo. Public read (storefront), admin-only write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding',
  'branding',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "branding_select_public" on storage.objects;
create policy "branding_select_public"
  on storage.objects for select
  using (bucket_id = 'branding');

drop policy if exists "branding_modify_admin" on storage.objects;
create policy "branding_modify_admin"
  on storage.objects for all
  using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());
