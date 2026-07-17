-- 0048_subscription_payments_khqrpay.sql
--
-- Move subscription billing onto the same khqr.cc payment model as customer
-- orders (0047): unique transaction ids, hosted-checkout URL / demo QR
-- payload, lazy expiry, verify cooldown, and a service-role-only finalize
-- that reuses activate_subscription_internal (0043). The official-Bakong
-- columns (bakong_md5 / bakong_txn_ref / bill_number) stay for historical
-- rows; the manual screenshot-proof + superadmin-approval fallback is KEPT
-- for stores while the platform's khqr.cc profile is unconfigured.

alter table public.subscription_payments
  add column if not exists transaction_id  text,
  add column if not exists public_token    text default encode(gen_random_bytes(24), 'hex'),
  add column if not exists provider_ref    text,
  add column if not exists checkout_url    text,
  add column if not exists qr_payload      text,
  add column if not exists expires_at      timestamptz,
  add column if not exists last_checked_at timestamptz;

create unique index if not exists subscription_payments_tx_idx
  on public.subscription_payments(transaction_id) where transaction_id is not null;
create unique index if not exists subscription_payments_token_idx
  on public.subscription_payments(public_token) where public_token is not null;

comment on column public.subscription_payments.bakong_md5 is
  'LEGACY (official Bakong API, replaced by khqr.cc in 0048).';
comment on column public.subscription_payments.bakong_txn_ref is
  'LEGACY (official Bakong API, replaced by khqr.cc in 0048).';

-- Widen the status machine to match order_payments (0047).
alter table public.subscription_payments
  drop constraint if exists subscription_payments_status_check;
alter table public.subscription_payments
  add constraint subscription_payments_status_check
  check (status in ('pending','qr_generated','waiting_payment','paid',
                    'failed','expired','cancelled','refunded','rejected'));

-- ----------------------------------------------------------------------------
-- Service-role finalize: settle + extend the store's period exactly once.
-- activate_subscription_internal (0043) row-locks the payment, is idempotent
-- for already-paid rows, and syncs stores + subscriptions.
-- ----------------------------------------------------------------------------
create or replace function public.finalize_subscription_payment(p_payment uuid)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  select status into v_status
    from public.subscription_payments where id = p_payment for update;
  if not found then
    raise exception 'payment % not found', p_payment using errcode = 'P0002';
  end if;
  if v_status not in ('pending','qr_generated','waiting_payment','paid') then
    raise exception 'payment % is % — cannot settle', p_payment, v_status
      using errcode = '22023';
  end if;
  return public.activate_subscription_internal(p_payment);
end $$;

revoke all on function public.finalize_subscription_payment(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_subscription_payment(uuid) to service_role;

-- Retire any still-open khqr attempt before minting a new one for the store.
create or replace function public.retire_open_subscription_payments(p_store uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.subscription_payments
     set status = 'cancelled'
   where store_id = p_store
     and method = 'khqr'
     and status in ('pending','qr_generated','waiting_payment');
end $$;

revoke all on function public.retire_open_subscription_payments(uuid)
  from public, anon, authenticated;
grant execute on function public.retire_open_subscription_payments(uuid) to service_role;
