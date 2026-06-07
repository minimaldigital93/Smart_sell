-- 0035_store_settings_per_store.sql
-- Turn the singleton store_settings (id = 1) into one row per store.
--
-- Transition-safe: the legacy `id` column is kept (the default store's row stays
-- id = 1) so the current getStoreSettings() query (.eq("id", 1)) keeps working
-- until S7 switches it to store_id. The real key becomes store_id. A trigger
-- auto-creates a settings row whenever a new store is inserted.

-- 1) Add the tenant key and backfill the existing singleton ------------------
alter table public.store_settings
  add column if not exists store_id uuid references public.stores(id) on delete cascade;

update public.store_settings
   set store_id = (select id from public.stores where slug = 'default')
 where store_id is null;

-- 2) Move the primary key from id -> store_id; relax the legacy id column -----
do $$ begin
  alter table public.store_settings drop constraint if exists store_settings_pkey;
  alter table public.store_settings drop constraint if exists store_settings_id_check;
exception when others then null; end $$;

alter table public.store_settings alter column id drop default;
alter table public.store_settings alter column id drop not null;
alter table public.store_settings alter column store_id set not null;

create unique index if not exists store_settings_store_unique
  on public.store_settings(store_id);

do $$ begin
  alter table public.store_settings add constraint store_settings_pkey primary key (store_id);
exception when others then null; end $$;

-- 3) Auto-create a settings row for every new store -------------------------
create or replace function public.handle_new_store() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.store_settings (store_id, business_name, tagline)
  values (new.id, new.name, 'Cosmetic Store Management')
  on conflict (store_id) do nothing;
  return new;
end $$;

drop trigger if exists on_store_created on public.stores;
create trigger on_store_created
  after insert on public.stores
  for each row execute function public.handle_new_store();
