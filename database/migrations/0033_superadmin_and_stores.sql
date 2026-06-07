-- 0033_superadmin_and_stores.sql
-- Tenancy foundation: introduce the platform `superadmin` role and the `stores`
-- table (tenant root). Every shop owner ("admin") owns exactly one store; staff
-- and customers belong to a store via profiles.store_id. The superadmin sits
-- above all stores (store_id is NULL) and bypasses tenant scoping.
--
-- IMPORTANT: the new enum value 'superadmin' is added here but NEVER referenced
-- as an enum literal in this same migration (Postgres forbids using a freshly
-- added enum value in the transaction that added it). Helper functions compare
-- against role::text instead. Seeding a superadmin account happens in 0036,
-- which runs as its own statement/transaction.

-- 1) Role -------------------------------------------------------------------
alter type public.user_role add value if not exists 'superadmin';

-- 2) Stores (tenant root) ---------------------------------------------------
create table if not exists public.stores (
  id                 uuid primary key default gen_random_uuid(),
  slug               citext not null unique,
  name               text not null,
  owner_id           uuid references public.profiles(id) on delete set null,
  custom_domain      citext unique,
  domain_verified    boolean not null default false,
  -- Persisted lifecycle state. The *effective* status (incl. grace/lock) is
  -- derived from dates by store_access_status(); this column only records the
  -- coarse state a human/superadmin set (e.g. cancelled, locked).
  status             text not null default 'trial'
                       check (status in ('trial','active','grace','locked','cancelled')),
  plan_id            uuid,            -- FK added in 0037 (billing) to avoid a cycle
  trial_ends_at      timestamptz,
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists stores_owner_idx on public.stores(owner_id);
create index if not exists stores_custom_domain_idx
  on public.stores(custom_domain) where custom_domain is not null;

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

-- 3) Profiles belong to a store --------------------------------------------
alter table public.profiles
  add column if not exists store_id uuid references public.stores(id) on delete set null;

create index if not exists profiles_store_idx on public.profiles(store_id);

-- 4) Tenancy helper functions ----------------------------------------------
-- All SECURITY DEFINER + stable so they cache per statement and don't recurse
-- through RLS on profiles.

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and role::text = 'superadmin'
  );
$$;

create or replace function public.current_store_id() returns uuid
language sql stable security definer set search_path = public as $$
  select store_id from public.profiles where id = auth.uid();
$$;

-- Transition helper used as the column DEFAULT for store_id on tenant tables
-- (set in 0034). It resolves to the writer's own store, falling back to the
-- "default" store for anonymous storefront writes. Once every service stamps
-- store_id explicitly (S7), these column defaults can be dropped.
create or replace function public.default_store_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select store_id from public.profiles where id = auth.uid()),
    (select id from public.stores where slug = 'default')
  );
$$;

-- Effective access state for a store, derived from its dates. Order matters:
-- explicit cancelled/locked win; then active paid period; then trial; then a
-- 3-day grace window after the latest of (trial end, paid period end); else
-- locked.
create or replace function public.store_access_status(p_store uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when s.status in ('cancelled','locked') then s.status
    when s.current_period_end is not null and now() < s.current_period_end then 'active'
    when s.trial_ends_at is not null and now() < s.trial_ends_at then 'trial'
    when now() < greatest(
           coalesce(s.current_period_end, 'epoch'::timestamptz),
           coalesce(s.trial_ends_at,     'epoch'::timestamptz)
         ) + interval '3 days' then 'grace'
    else 'locked'
  end
  from public.stores s
  where s.id = p_store;
$$;

-- Tenant resolution for middleware: map an incoming Host or /s/{slug} to a
-- store WITHOUT exposing the stores table to anon (stores RLS stays locked).
-- Host (custom_domain) wins over slug. Returns the effective access status too.
create or replace function public.resolve_store(p_host text, p_slug text)
returns table (id uuid, slug citext, status text)
language sql stable security definer set search_path = public as $$
  select s.id, s.slug, public.store_access_status(s.id)
    from public.stores s
   where (nullif(p_host, '') is not null and s.custom_domain = p_host)
      or (nullif(p_slug, '') is not null and s.slug = p_slug)
   order by (p_host is not null and s.custom_domain = p_host) desc
   limit 1;
$$;

grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.current_store_id() to authenticated;
grant execute on function public.default_store_id() to anon, authenticated;
grant execute on function public.store_access_status(uuid) to anon, authenticated;
grant execute on function public.resolve_store(text, text) to anon, authenticated;

-- 5) Default store + backfill ----------------------------------------------
-- The existing single store becomes "Default Store", owned by the seed admin
-- from 0030. It is set to a far-future active period so the current shop keeps
-- working unchanged after this migration. Every existing profile joins it.
do $$
declare
  v_owner uuid;
  v_store uuid;
begin
  select id into v_owner
    from public.profiles
   where role::text = 'admin'
   order by created_at
   limit 1;

  insert into public.stores (slug, name, owner_id, status, current_period_end, trial_ends_at)
  values ('default', 'Default Store', v_owner, 'active',
          now() + interval '3650 days', now() + interval '3650 days')
  on conflict (slug) do nothing;

  select id into v_store from public.stores where slug = 'default';

  update public.profiles
     set store_id = v_store
   where store_id is null
     and role::text in ('admin','staff','customer');
end $$;

-- Enable RLS on stores now; full policies land in 0038. Until then, restrict to
-- a safe default: superadmin all, owners read their own store.
alter table public.stores enable row level security;

drop policy if exists stores_superadmin_all on public.stores;
create policy stores_superadmin_all on public.stores
  for all using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists stores_owner_read on public.stores;
create policy stores_owner_read on public.stores
  for select using (id = public.current_store_id());
