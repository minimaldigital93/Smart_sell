-- 0039_platform_finance.sql
-- Platform-owner finances: subscription revenue (from paid subscription_payments)
-- minus the platform's own expenses (hosting/server/other), rolled up by month
-- and year. Aggregations are SECURITY DEFINER functions guarded by is_superadmin()
-- so they return platform-wide totals regardless of the caller's store RLS.

-- 1) Expenses ---------------------------------------------------------------
create table if not exists public.platform_expenses (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'other' check (category in ('hosting','server','other')),
  label       text not null,
  amount_usd  numeric(10,2) not null check (amount_usd >= 0),
  incurred_on date not null default current_date,
  note        text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists platform_expenses_incurred_idx
  on public.platform_expenses(incurred_on desc);

alter table public.platform_expenses enable row level security;

drop policy if exists platform_expenses_superadmin on public.platform_expenses;
create policy platform_expenses_superadmin on public.platform_expenses
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- 2) Monthly P&L for a year -------------------------------------------------
create or replace function public.platform_pnl_monthly(p_year integer)
returns table (month integer, revenue numeric, expense numeric, net numeric)
language sql stable security definer set search_path = public as $$
  with rev as (
    select extract(month from paid_at)::int as m, sum(amount_usd) as amt
      from public.subscription_payments
     where status = 'paid' and paid_at is not null
       and extract(year from paid_at) = p_year
     group by 1
  ),
  exp as (
    select extract(month from incurred_on)::int as m, sum(amount_usd) as amt
      from public.platform_expenses
     where extract(year from incurred_on) = p_year
     group by 1
  ),
  months as (select generate_series(1, 12) as m)
  select
    mo.m,
    coalesce(rev.amt, 0) as revenue,
    coalesce(exp.amt, 0) as expense,
    coalesce(rev.amt, 0) - coalesce(exp.amt, 0) as net
  from months mo
  left join rev on rev.m = mo.m
  left join exp on exp.m = mo.m
  where public.is_superadmin()
  order by mo.m;
$$;

-- 3) Yearly P&L across all time --------------------------------------------
create or replace function public.platform_pnl_yearly()
returns table (year integer, revenue numeric, expense numeric, net numeric)
language sql stable security definer set search_path = public as $$
  with rev as (
    select extract(year from paid_at)::int as y, sum(amount_usd) as amt
      from public.subscription_payments
     where status = 'paid' and paid_at is not null
     group by 1
  ),
  exp as (
    select extract(year from incurred_on)::int as y, sum(amount_usd) as amt
      from public.platform_expenses
     group by 1
  ),
  years as (
    select y from (
      select y from rev union select y from exp
    ) u where y is not null
  )
  select
    yr.y,
    coalesce(rev.amt, 0) as revenue,
    coalesce(exp.amt, 0) as expense,
    coalesce(rev.amt, 0) - coalesce(exp.amt, 0) as net
  from years yr
  left join rev on rev.y = yr.y
  left join exp on exp.y = yr.y
  where public.is_superadmin()
  order by yr.y desc;
$$;

-- 4) Headline summary (KPIs) ------------------------------------------------
-- mrr        = sum of plan price for stores whose access is currently 'active'
-- this_month = revenue, expense, net for the current calendar month
create or replace function public.platform_summary()
returns table (
  mrr               numeric,
  active_stores     integer,
  trial_stores      integer,
  overdue_stores    integer,
  total_revenue     numeric,
  total_expense     numeric,
  month_revenue     numeric,
  month_expense     numeric
)
language sql stable security definer set search_path = public as $$
  select
    coalesce((
      select sum(p.price_usd)
        from public.stores s
        join public.subscription_plans p on p.id = s.plan_id
       where public.store_access_status(s.id) = 'active'
    ), 0) as mrr,
    (select count(*)::int from public.stores s where public.store_access_status(s.id) = 'active') as active_stores,
    (select count(*)::int from public.stores s where public.store_access_status(s.id) = 'trial') as trial_stores,
    (select count(*)::int from public.stores s where public.store_access_status(s.id) in ('grace','locked')) as overdue_stores,
    coalesce((select sum(amount_usd) from public.subscription_payments where status = 'paid'), 0) as total_revenue,
    coalesce((select sum(amount_usd) from public.platform_expenses), 0) as total_expense,
    coalesce((select sum(amount_usd) from public.subscription_payments
               where status = 'paid' and paid_at >= date_trunc('month', now())), 0) as month_revenue,
    coalesce((select sum(amount_usd) from public.platform_expenses
               where incurred_on >= date_trunc('month', now())::date), 0) as month_expense
  where public.is_superadmin();
$$;

grant execute on function public.platform_pnl_monthly(integer) to authenticated;
grant execute on function public.platform_pnl_yearly() to authenticated;
grant execute on function public.platform_summary() to authenticated;
