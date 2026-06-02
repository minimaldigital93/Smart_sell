-- 0016_coupons.sql
-- Coupons / discount codes.
--
-- Design notes:
--   - `code` is stored uppercase and unique. The validate path normalizes
--     user input to upper before lookup.
--   - `discount_type = percent` ⇒ value in [1..100]. `fixed` ⇒ flat USD off.
--   - `max_redemptions` null = unlimited. Atomic increment guarded by
--     `redeemed_count < max_redemptions` so a single SQL UPDATE rejects
--     overshoot under race.
--   - orders gain `coupon_id`, `coupon_code`, `discount`. The total-matches
--     CHECK is replaced to include discount.

do $$ begin
  create type public.coupon_discount_type as enum ('percent', 'fixed');
exception when duplicate_object then null;
end $$;

create table if not exists public.coupons (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  discount_type    public.coupon_discount_type not null,
  discount_value   numeric(10,2) not null check (discount_value > 0),
  min_subtotal     numeric(10,2) not null default 0 check (min_subtotal >= 0),
  max_redemptions  integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count   integer not null default 0 check (redeemed_count >= 0),
  starts_at        timestamptz,
  expires_at       timestamptz,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint coupons_code_uppercase
    check (code = upper(code) and length(code) between 3 and 32),
  constraint coupons_percent_bounds
    check (
      discount_type <> 'percent'
      or (discount_value > 0 and discount_value <= 100)
    ),
  constraint coupons_redeem_count_le_max
    check (max_redemptions is null or redeemed_count <= max_redemptions),
  constraint coupons_window_valid
    check (starts_at is null or expires_at is null or starts_at < expires_at)
);

create index if not exists coupons_active_idx
  on public.coupons(is_active, expires_at);

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- orders.discount + coupon link
-- ----------------------------------------------------------------------------
alter table public.orders
  add column if not exists coupon_id   uuid references public.coupons(id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists discount    numeric(10,2) not null default 0 check (discount >= 0);

-- Drop the old check that excluded discount.
alter table public.orders drop constraint if exists orders_total_matches;
alter table public.orders
  add constraint orders_total_matches
  check (total = subtotal + shipping_fee - discount and total >= 0);

create index if not exists orders_coupon_id_idx on public.orders(coupon_id);

-- ----------------------------------------------------------------------------
-- Atomic redemption: only succeeds if coupon is currently usable.
-- Returns the resulting row, or zero rows if the redemption was rejected.
-- ----------------------------------------------------------------------------
create or replace function public.redeem_coupon(p_code text)
returns table (id uuid, code text, redeemed_count int, max_redemptions int)
language sql security definer set search_path = public as $$
  update public.coupons c
     set redeemed_count = c.redeemed_count + 1
   where c.code = upper(p_code)
     and c.is_active
     and (c.starts_at is null or c.starts_at <= now())
     and (c.expires_at is null or c.expires_at > now())
     and (c.max_redemptions is null or c.redeemed_count < c.max_redemptions)
  returning c.id, c.code, c.redeemed_count, c.max_redemptions;
$$;

grant execute on function public.redeem_coupon(text) to authenticated, anon;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.coupons enable row level security;

drop policy if exists coupons_select_active_or_staff on public.coupons;
create policy coupons_select_active_or_staff on public.coupons
  for select
  using (
    public.is_staff()
    or (
      is_active
      and (starts_at is null or starts_at <= now())
      and (expires_at is null or expires_at > now())
    )
  );

drop policy if exists coupons_modify_staff on public.coupons;
create policy coupons_modify_staff on public.coupons
  for all
  using (public.is_staff())
  with check (public.is_staff());
