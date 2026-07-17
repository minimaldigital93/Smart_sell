-- 0047_order_payments_khqrpay.sql
--
-- Customer-order payment platform, ported from the AMS khqr.cc (KHQRPay)
-- integration. Replaces the manual KHQR-screenshot flow:
--
--   * store_payment_settings — each store's khqr.cc merchant profile
--     (profile_id + secret). Service-role only; secrets never reach clients.
--   * order_payments — per-order payment ledger (khqr gateway attempts AND
--     cash/COD rows) with an explicit status state machine.
--   * payment_webhooks — audit of every inbound webhook delivery, with a
--     unique event_id for replay idempotency.
--   * RPCs — service-role-only, row-locked, transition-guarded, so the
--     webhook, the customer poll, and the reconcile cron can never
--     double-book a payment or double-deduct stock.
--
-- Payment status machine (mirrored in src/lib/khqrpay/status.ts):
--   pending → qr_generated → waiting_payment → paid → refunded
--   any open state → failed | expired | cancelled | rejected (terminal)
--
-- Order integration: finalize flips a 'pending' order to 'payment_confirmed';
-- the existing on_order_status_change trigger (0007/0024) then deducts
-- inventory idempotently. One PAID payment per order is enforced by index.

-- ============================================================================
-- (A) store_payment_settings
-- ============================================================================
create table if not exists public.store_payment_settings (
  store_id           uuid primary key references public.stores(id) on delete cascade,
  khqrpay_enabled    boolean not null default false,
  khqrpay_profile_id text,
  khqrpay_secret     text,          -- NEVER exposed: no RLS policies at all
  currency           text not null default 'USD' check (currency in ('USD','KHR')),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id) on delete set null
);

-- RLS with deliberately NO policies: anon/authenticated are fully denied and
-- only the service-role client (bypasses RLS) can read/write the secrets.
alter table public.store_payment_settings enable row level security;

-- Anon-safe capability probe for the storefront: "does this store take KHQR?"
-- without exposing the credentials row.
create or replace function public.store_khqr_configured(p_store uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.store_payment_settings
     where store_id = p_store
       and khqrpay_enabled
       and coalesce(khqrpay_profile_id, '') <> ''
       and coalesce(khqrpay_secret, '') <> ''
  );
$$;
revoke all on function public.store_khqr_configured(uuid) from public;
grant execute on function public.store_khqr_configured(uuid) to anon, authenticated;

-- ============================================================================
-- (B) order_payments ledger
-- ============================================================================
create table if not exists public.order_payments (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  order_id        uuid not null references public.orders(id) on delete cascade,
  method          public.payment_method not null,   -- 'khqr' | 'cash' for new rows
  status          text not null default 'pending'
                    check (status in ('pending','qr_generated','waiting_payment','paid',
                                      'failed','expired','cancelled','refunded','rejected')),
  amount          numeric(10,2) not null check (amount > 0),
  currency        text not null default 'USD',
  -- Provider correlation id ('ORD-…'); null for cash rows.
  transaction_id  text unique,
  -- Unguessable token for customer-facing URLs (transaction ids enumerate).
  public_token    text not null unique default encode(gen_random_bytes(24), 'hex'),
  provider        text,                             -- 'khqrpay' | 'demo' | null (cash)
  provider_ref    text,                             -- gateway md5/tran when echoed
  checkout_url    text,                             -- signed hosted-checkout URL (live khqr)
  qr_payload      text,                             -- local EMV KHQR string (demo)
  expires_at      timestamptz,
  last_checked_at timestamptz,                      -- DB-backed verify cooldown
  paid_at         timestamptz,
  -- Cashier who took the money. References profiles (not auth.users) so the
  -- admin UI can embed the name via PostgREST.
  received_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists order_payments_order_idx
  on public.order_payments(order_id, created_at desc);
create index if not exists order_payments_admin_idx
  on public.order_payments(store_id, status, created_at desc);
create index if not exists order_payments_open_idx
  on public.order_payments(status)
  where status in ('pending','qr_generated','waiting_payment');
-- Business rule: one order has exactly one SETTLED payment.
create unique index if not exists order_payments_one_paid
  on public.order_payments(order_id) where status = 'paid';

drop trigger if exists order_payments_set_updated_at on public.order_payments;
create trigger order_payments_set_updated_at
  before update on public.order_payments
  for each row execute function public.set_updated_at();

alter table public.order_payments enable row level security;

-- Staff read their own store's payments; superadmin reads all. All WRITES go
-- through the service-role RPCs below (no client write policies).
drop policy if exists order_payments_select_staff on public.order_payments;
create policy order_payments_select_staff on public.order_payments
  for select using (
    public.is_superadmin()
    or (public.is_staff() and store_id = public.current_store_id())
  );

-- ============================================================================
-- (C) payment_webhooks audit
-- ============================================================================
create table if not exists public.payment_webhooks (
  id                      uuid primary key default gen_random_uuid(),
  provider                text not null default 'khqrpay',
  event_id                text not null unique,
  transaction_id          text,
  order_payment_id        uuid references public.order_payments(id) on delete set null,
  subscription_payment_id uuid references public.subscription_payments(id) on delete set null,
  status                  text not null default 'received'
                            check (status in ('received','processed','duplicate','invalid','ignored')),
  signature_valid         boolean not null default false,
  http_status             smallint,
  payload                 jsonb not null default '{}'::jsonb,
  error                   text,
  received_at             timestamptz not null default now(),
  processed_at            timestamptz
);

create index if not exists payment_webhooks_tx_idx
  on public.payment_webhooks(transaction_id);

alter table public.payment_webhooks enable row level security;

drop policy if exists payment_webhooks_select_superadmin on public.payment_webhooks;
create policy payment_webhooks_select_superadmin on public.payment_webhooks
  for select using (public.is_superadmin());

-- ============================================================================
-- (D) Payment RPCs — service-role only, row-locked, transition-guarded
-- ============================================================================

-- Pure transition guard shared by every mutator. Mirrors
-- src/lib/khqrpay/status.ts — keep in sync.
create or replace function public.order_payment_can_transition(p_from text, p_to text)
returns boolean
language sql immutable as $$
  select case
    when p_from = 'pending'         then p_to in ('qr_generated','waiting_payment','paid','failed','expired','cancelled')
    when p_from = 'qr_generated'    then p_to in ('waiting_payment','paid','failed','expired','cancelled')
    when p_from = 'waiting_payment' then p_to in ('paid','failed','expired','cancelled')
    when p_from = 'paid'            then p_to = 'refunded'
    else false
  end;
$$;

-- Settle a payment and (for a still-pending order) confirm the order so the
-- 0007/0024 trigger deducts inventory. Idempotent under the row lock: a
-- webhook, a poll, and the cron racing each other book the money exactly once.
-- Returns the payment's status after the call.
create or replace function public.finalize_order_payment(p_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_pay    record;
  v_status public.order_status;
begin
  select * into v_pay from public.order_payments where id = p_id for update;
  if not found then
    raise exception 'payment % not found', p_id using errcode = 'P0002';
  end if;

  if v_pay.status = 'paid' then
    return 'paid';
  end if;
  if not public.order_payment_can_transition(v_pay.status, 'paid') then
    return v_pay.status;
  end if;

  update public.order_payments
     set status = 'paid', paid_at = coalesce(paid_at, now())
   where id = p_id;

  -- Confirm the parent order once. INSUFFICIENT_STOCK raised by the inventory
  -- trigger rolls this whole transaction back — the payment stays open and the
  -- caller (webhook/cron) surfaces the stuck row instead of losing the money.
  select status into v_status from public.orders where id = v_pay.order_id for update;
  if v_status = 'pending' then
    update public.orders set status = 'payment_confirmed' where id = v_pay.order_id;
  end if;

  return 'paid';
end $$;

-- First customer poll: pending/qr_generated → waiting_payment.
create or replace function public.mark_order_payment_waiting(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  select status into v_status from public.order_payments where id = p_id for update;
  if found and v_status in ('pending','qr_generated') then
    update public.order_payments set status = 'waiting_payment' where id = p_id;
  end if;
end $$;

-- Lazy expiry (poll + cron). Returns true when the row ended up expired.
create or replace function public.expire_order_payment(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_pay record;
begin
  select * into v_pay from public.order_payments where id = p_id for update;
  if not found then
    return false;
  end if;
  if v_pay.status = 'expired' then
    return true;
  end if;
  if v_pay.expires_at is null or v_pay.expires_at > now() then
    return false;
  end if;
  if public.order_payment_can_transition(v_pay.status, 'expired') then
    update public.order_payments set status = 'expired' where id = p_id;
    return true;
  end if;
  return false;
end $$;

-- Retire every still-open khqr attempt for an order before minting a new one
-- (invariant: at most one payable QR per order).
create or replace function public.retire_open_order_payments(p_order uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.order_payments
     set status = 'cancelled'
   where order_id = p_order
     and method = 'khqr'
     and status in ('pending','qr_generated','waiting_payment');
end $$;

-- Cash settlement: stamps the cashier, then settles through the same
-- finalize path (so a pending COD order confirms + deducts stock too).
create or replace function public.mark_cash_order_payment_paid(p_id uuid, p_cashier uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_method public.payment_method;
begin
  select method into v_method from public.order_payments where id = p_id for update;
  if not found then
    raise exception 'payment % not found', p_id using errcode = 'P0002';
  end if;
  if v_method <> 'cash' then
    raise exception 'payment % is not a cash payment', p_id using errcode = '22023';
  end if;

  update public.order_payments set received_by = p_cashier where id = p_id;
  return public.finalize_order_payment(p_id);
end $$;

-- Lock the RPCs down to the service role only.
revoke all on function public.order_payment_can_transition(text, text) from public;
grant execute on function public.order_payment_can_transition(text, text) to service_role;
revoke all on function public.finalize_order_payment(uuid) from public, anon, authenticated;
grant execute on function public.finalize_order_payment(uuid) to service_role;
revoke all on function public.mark_order_payment_waiting(uuid) from public, anon, authenticated;
grant execute on function public.mark_order_payment_waiting(uuid) to service_role;
revoke all on function public.expire_order_payment(uuid) from public, anon, authenticated;
grant execute on function public.expire_order_payment(uuid) to service_role;
revoke all on function public.retire_open_order_payments(uuid) from public, anon, authenticated;
grant execute on function public.retire_open_order_payments(uuid) to service_role;
revoke all on function public.mark_cash_order_payment_paid(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_cash_order_payment_paid(uuid, uuid) to service_role;

-- ============================================================================
-- (E) Cancelling an order cancels its open payment attempts
-- ============================================================================
create or replace function public.on_order_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'payment_confirmed'
     and (old.status is distinct from 'payment_confirmed')
     and not new.inventory_applied
  then
    perform public.apply_order_inventory(new.id);
  end if;

  if new.status = 'cancelled'
     and (old.status is distinct from 'cancelled')
  then
    if new.inventory_applied then
      perform public.restock_cancelled_order(new.id);
    end if;
    perform public.refund_order_credits(new.id);

    update public.order_payments
       set status = 'cancelled'
     where order_id = new.id
       and status in ('pending','qr_generated','waiting_payment');
  end if;

  return new;
end $$;
