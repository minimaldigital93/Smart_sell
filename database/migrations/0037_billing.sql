-- 0037_billing.sql
-- Subscription billing for stores: plans ($9/$19/$29), one subscription per
-- store, and a payment ledger (KHQR via Bakong, or a manual screenshot proof).
-- The stores table stays the source of truth for *access* (status/period dates
-- the middleware reads); activate_subscription() keeps it in sync.

-- 1) Plans ------------------------------------------------------------------
create table if not exists public.subscription_plans (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  price_usd   numeric(10,2) not null check (price_usd >= 0),
  interval    text not null default 'month' check (interval in ('month','year')),
  features    jsonb not null default '[]'::jsonb,
  limits      jsonb not null default '{}'::jsonb,
  sort        integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists subscription_plans_set_updated_at on public.subscription_plans;
create trigger subscription_plans_set_updated_at
  before update on public.subscription_plans
  for each row execute function public.set_updated_at();

-- Seed the three tiers. Limits/features are configurable later from the
-- superadmin Plans page; -1 means "unlimited".
insert into public.subscription_plans (code, name, price_usd, sort, features, limits) values
  ('starter', 'Starter', 9,  1,
   '["Online storefront","Inventory & barcode","Order management","1 staff account"]'::jsonb,
   '{"max_products":50,"max_staff":1,"coupons":false,"loyalty":false,"pos":false,"custom_domain":false,"advanced_analytics":false}'::jsonb),
  ('growth', 'Growth', 19, 2,
   '["Everything in Starter","Up to 500 products","5 staff accounts","Coupons & loyalty"]'::jsonb,
   '{"max_products":500,"max_staff":5,"coupons":true,"loyalty":true,"pos":false,"custom_domain":false,"advanced_analytics":false}'::jsonb),
  ('pro', 'Pro', 29, 3,
   '["Everything in Growth","Unlimited products & staff","POS register","Custom domain","Advanced analytics"]'::jsonb,
   '{"max_products":-1,"max_staff":-1,"coupons":true,"loyalty":true,"pos":true,"custom_domain":true,"advanced_analytics":true}'::jsonb)
on conflict (code) do nothing;

-- Now that plans exist, point stores.plan_id at them.
do $$ begin
  alter table public.stores
    add constraint stores_plan_id_fkey
    foreign key (plan_id) references public.subscription_plans(id) on delete set null;
exception when duplicate_object then null; end $$;

-- 2) Subscriptions (one per store) ------------------------------------------
create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  store_id             uuid not null unique references public.stores(id) on delete cascade,
  plan_id              uuid references public.subscription_plans(id) on delete set null,
  status               text not null default 'trialing'
                         check (status in ('trialing','active','past_due','canceled')),
  current_period_start timestamptz,
  current_period_end   timestamptz,
  trial_ends_at        timestamptz,
  cancel_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- 3) Payment ledger ---------------------------------------------------------
create table if not exists public.subscription_payments (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  plan_id         uuid references public.subscription_plans(id) on delete set null,
  amount_usd      numeric(10,2) not null check (amount_usd >= 0),
  method          text not null default 'khqr' check (method in ('khqr','manual')),
  bill_number     text,
  bakong_md5      text,
  bakong_txn_ref  text,
  status          text not null default 'pending'
                    check (status in ('pending','paid','failed','expired')),
  proof_url       text,
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists subscription_payments_store_idx
  on public.subscription_payments(store_id, created_at desc);
create index if not exists subscription_payments_status_idx
  on public.subscription_payments(status) where status = 'pending';
create index if not exists subscription_payments_md5_idx
  on public.subscription_payments(bakong_md5) where bakong_md5 is not null;

drop trigger if exists subscription_payments_set_updated_at on public.subscription_payments;
create trigger subscription_payments_set_updated_at
  before update on public.subscription_payments
  for each row execute function public.set_updated_at();

-- 4) RPCs -------------------------------------------------------------------
-- Start a 14-day trial for a store on the given plan. Idempotent-ish: callable
-- at store creation (S7). Caller must own the store or be superadmin.
create or replace function public.start_store_trial(p_store uuid, p_plan_code text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_plan uuid;
  v_trial_end timestamptz := now() + interval '14 days';
begin
  if not (public.is_superadmin() or p_store = public.current_store_id()) then
    raise exception 'not authorized for store %', p_store;
  end if;

  select id into v_plan from public.subscription_plans where code = p_plan_code;

  update public.stores
     set plan_id = v_plan, status = 'trial', trial_ends_at = v_trial_end
   where id = p_store;

  insert into public.subscriptions (store_id, plan_id, status, trial_ends_at)
  values (p_store, v_plan, 'trialing', v_trial_end)
  on conflict (store_id) do update
    set plan_id = excluded.plan_id,
        status = 'trialing',
        trial_ends_at = excluded.trial_ends_at;
end $$;

-- Mark a payment paid and extend the store's paid period by 30 days. Returns
-- the new period end. Caller must own the payment's store or be superadmin.
create or replace function public.activate_subscription(p_payment uuid)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_store uuid;
  v_plan  uuid;
  v_new_end timestamptz;
begin
  select store_id, plan_id into v_store, v_plan
    from public.subscription_payments where id = p_payment;
  if v_store is null then
    raise exception 'payment % not found', p_payment;
  end if;
  if not (public.is_superadmin() or v_store = public.current_store_id()) then
    raise exception 'not authorized for payment %', p_payment;
  end if;

  update public.subscription_payments
     set status = 'paid', paid_at = coalesce(paid_at, now())
   where id = p_payment;

  select greatest(now(), coalesce(current_period_end, now())) + interval '30 days'
    into v_new_end
    from public.stores where id = v_store;

  update public.stores
     set status = 'active', plan_id = coalesce(v_plan, plan_id),
         current_period_end = v_new_end
   where id = v_store;

  insert into public.subscriptions (store_id, plan_id, status, current_period_start, current_period_end)
  values (v_store, v_plan, 'active', now(), v_new_end)
  on conflict (store_id) do update
    set plan_id = coalesce(excluded.plan_id, public.subscriptions.plan_id),
        status = 'active',
        current_period_start = now(),
        current_period_end = excluded.current_period_end;

  return v_new_end;
end $$;

grant execute on function public.start_store_trial(uuid, text) to authenticated;
grant execute on function public.activate_subscription(uuid) to authenticated;

-- 5) RLS --------------------------------------------------------------------
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;

-- Plans are public (pricing page); only superadmin writes.
drop policy if exists plans_read_all on public.subscription_plans;
create policy plans_read_all on public.subscription_plans
  for select using (true);
drop policy if exists plans_write_superadmin on public.subscription_plans;
create policy plans_write_superadmin on public.subscription_plans
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- A store sees its own subscription; superadmin sees all.
drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions
  for select using (public.is_superadmin() or store_id = public.current_store_id());
drop policy if exists subscriptions_write_superadmin on public.subscriptions;
create policy subscriptions_write_superadmin on public.subscriptions
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- A store reads + creates its own payments; superadmin manages all.
drop policy if exists payments_read on public.subscription_payments;
create policy payments_read on public.subscription_payments
  for select using (public.is_superadmin() or store_id = public.current_store_id());
drop policy if exists payments_insert_own on public.subscription_payments;
create policy payments_insert_own on public.subscription_payments
  for insert with check (public.is_superadmin() or store_id = public.current_store_id());
drop policy if exists payments_write_superadmin on public.subscription_payments;
create policy payments_write_superadmin on public.subscription_payments
  for all using (public.is_superadmin()) with check (public.is_superadmin());
