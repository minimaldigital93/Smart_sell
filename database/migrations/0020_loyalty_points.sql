-- 0020_loyalty_points.sql
-- Loyalty points system.
--
-- Design:
--   - 1 point earned per $1 of order total (rounded down), credited when
--     order status reaches 'delivered'.
--   - 100 points = $1 discount at checkout (POINTS_PER_DOLLAR_CREDIT = 100).
--   - Max redemption: 50 % of order subtotal (enforced in app layer).
--   - Points balance lives on profiles.loyalty_points for fast reads.
--   - loyalty_transactions is the audit log (earn / redeem / expire / manual).
--   - orders.points_redeemed records how many points were spent (informational).
--     The monetary value is folded into the existing orders.discount column.

-- ----------------------------------------------------------------------------
-- profiles: add loyalty_points balance
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists loyalty_points integer not null default 0
    check (loyalty_points >= 0);

-- ----------------------------------------------------------------------------
-- loyalty_transactions: audit log
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.loyalty_transaction_type
    as enum ('earn', 'redeem', 'expire', 'manual');
exception when duplicate_object then null;
end $$;

create table if not exists public.loyalty_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  type        public.loyalty_transaction_type not null,
  points      integer not null,        -- positive = earned/added, negative = spent
  balance_after integer not null,      -- snapshot of balance after this txn
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists loyalty_txn_user_idx
  on public.loyalty_transactions(user_id, created_at desc);

create index if not exists loyalty_txn_order_idx
  on public.loyalty_transactions(order_id);

-- ----------------------------------------------------------------------------
-- orders: track points spent per order
-- ----------------------------------------------------------------------------
alter table public.orders
  add column if not exists points_redeemed integer not null default 0
    check (points_redeemed >= 0);

-- ----------------------------------------------------------------------------
-- Function: earn_loyalty_points
-- Called after order reaches 'delivered'. Idempotent (skips if txn exists).
-- ----------------------------------------------------------------------------
create or replace function public.earn_loyalty_points(
  p_user_id  uuid,
  p_order_id uuid,
  p_total    numeric
) returns integer          -- returns points earned (0 if already awarded)
language plpgsql security definer set search_path = public as $$
declare
  v_points   integer := floor(p_total)::integer;   -- 1 pt per $1
  v_balance  integer;
begin
  if v_points <= 0 then
    return 0;
  end if;

  -- Idempotent: bail if we already awarded points for this order.
  if exists (
    select 1 from public.loyalty_transactions
     where order_id = p_order_id and type = 'earn'
  ) then
    return 0;
  end if;

  -- Increment balance.
  update public.profiles
     set loyalty_points = loyalty_points + v_points
   where id = p_user_id
  returning loyalty_points into v_balance;

  if not found then
    return 0;
  end if;

  -- Write audit row.
  insert into public.loyalty_transactions
    (user_id, order_id, type, points, balance_after)
  values
    (p_user_id, p_order_id, 'earn', v_points, v_balance);

  return v_points;
end;
$$;

grant execute on function public.earn_loyalty_points(uuid, uuid, numeric)
  to authenticated;

-- ----------------------------------------------------------------------------
-- Function: redeem_loyalty_points
-- Atomic deduction. Returns new balance, or -1 if insufficient points.
-- ----------------------------------------------------------------------------
create or replace function public.redeem_loyalty_points(
  p_user_id  uuid,
  p_order_id uuid,
  p_points   integer
) returns integer           -- new balance, or -1 on failure
language plpgsql security definer set search_path = public as $$
declare
  v_balance integer;
begin
  if p_points <= 0 then
    return -1;
  end if;

  update public.profiles
     set loyalty_points = loyalty_points - p_points
   where id = p_user_id
     and loyalty_points >= p_points
  returning loyalty_points into v_balance;

  if not found then
    return -1;
  end if;

  insert into public.loyalty_transactions
    (user_id, order_id, type, points, balance_after)
  values
    (p_user_id, p_order_id, 'redeem', -p_points, v_balance);

  return v_balance;
end;
$$;

grant execute on function public.redeem_loyalty_points(uuid, uuid, integer)
  to authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.loyalty_transactions enable row level security;

drop policy if exists loyalty_txn_select_own on public.loyalty_transactions;
create policy loyalty_txn_select_own on public.loyalty_transactions
  for select
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists loyalty_txn_modify_staff on public.loyalty_transactions;
create policy loyalty_txn_modify_staff on public.loyalty_transactions
  for all
  using (public.is_staff())
  with check (public.is_staff());
