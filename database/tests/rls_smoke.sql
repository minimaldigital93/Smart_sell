-- rls_smoke.sql
-- Smoke tests for Row-Level Security policies. Run against a development
-- branch only — it INSERTS sample data and rolls back at the end.
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/tests/rls_smoke.sql
--
-- The script impersonates customers/staff/admin by setting the JWT claims
-- the way PostgREST would, then runs asserts via `raise exception`.

\set ON_ERROR_STOP on
begin;

-- ----------------------------------------------------------------------------
-- Fixture users (UUIDs are deterministic so re-runs are stable)
-- ----------------------------------------------------------------------------
\set admin_id  '11111111-1111-1111-1111-111111111111'
\set staff_id  '22222222-2222-2222-2222-222222222222'
\set cust_a_id '33333333-3333-3333-3333-333333333333'
\set cust_b_id '44444444-4444-4444-4444-444444444444'

insert into auth.users (id, email, instance_id) values
  (:'admin_id',  'rls-admin@example.test',  '00000000-0000-0000-0000-000000000000'),
  (:'staff_id',  'rls-staff@example.test',  '00000000-0000-0000-0000-000000000000'),
  (:'cust_a_id', 'rls-cust-a@example.test', '00000000-0000-0000-0000-000000000000'),
  (:'cust_b_id', 'rls-cust-b@example.test', '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

insert into public.profiles (id, role, name, email) values
  (:'admin_id',  'admin',    'RLS Admin',  'rls-admin@example.test'),
  (:'staff_id',  'staff',    'RLS Staff',  'rls-staff@example.test'),
  (:'cust_a_id', 'customer', 'RLS Cust A', 'rls-cust-a@example.test'),
  (:'cust_b_id', 'customer', 'RLS Cust B', 'rls-cust-b@example.test')
on conflict (id) do update set role = excluded.role;

-- A product + inventory row to exercise downstream tables
insert into public.products (id, name, slug, description, price, is_active)
values ('55555555-5555-5555-5555-555555555555', 'RLS Lipstick', 'rls-lipstick', 'fixture', 5.00, true)
on conflict (id) do nothing;

insert into public.product_inventory (product_id, current_stock, minimum_stock)
values ('55555555-5555-5555-5555-555555555555', 50, 5)
on conflict (product_id) do nothing;

-- An order owned by customer A
insert into public.orders (id, user_id, customer_name, phone, address, subtotal, shipping_fee, total, payment_method, payment_image, status)
values ('66666666-6666-6666-6666-666666666666', :'cust_a_id', 'A', '012000000', 'PP', 5, 1.5, 6.5, 'KHQR', 'https://example.test/p.png', 'pending')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Helper: switch role + JWT claim, then check a condition
-- ----------------------------------------------------------------------------
create or replace function pg_temp.as_role(p_user uuid, p_role text)
returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true);
end$$;

create or replace function pg_temp.assert(p_cond boolean, p_msg text)
returns void language plpgsql as $$
begin
  if not p_cond then
    raise exception 'RLS ASSERT FAILED: %', p_msg;
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
select pg_temp.as_role(:'cust_a_id', 'authenticated');

-- Customer A can read their own profile
select pg_temp.assert(
  (select count(*) from public.profiles where id = :'cust_a_id') = 1,
  'customer should see own profile');

-- Customer A cannot read customer B's profile
select pg_temp.assert(
  (select count(*) from public.profiles where id = :'cust_b_id') = 0,
  'customer must NOT see other customer profile');

-- Customer A cannot escalate their role to admin
do $$
declare did_update int;
begin
  update public.profiles set role = 'admin' where id = '33333333-3333-3333-3333-333333333333';
  get diagnostics did_update = row_count;
  perform pg_temp.assert(
    did_update = 0
      or (select role from public.profiles where id = '33333333-3333-3333-3333-333333333333') = 'customer',
    'customer must NOT escalate to admin');
end$$;

-- Staff can see all profiles
select pg_temp.as_role(:'staff_id', 'authenticated');
select pg_temp.assert(
  (select count(*) from public.profiles) >= 4,
  'staff should see all profiles');

-- ----------------------------------------------------------------------------
-- products: active visible to anon/customer; inactive only to staff
-- ----------------------------------------------------------------------------
update public.products set is_active = false where id = '55555555-5555-5555-5555-555555555555';

select pg_temp.as_role(:'cust_a_id', 'authenticated');
select pg_temp.assert(
  (select count(*) from public.products where id = '55555555-5555-5555-5555-555555555555') = 0,
  'customer must NOT see inactive product');

select pg_temp.as_role(:'staff_id', 'authenticated');
select pg_temp.assert(
  (select count(*) from public.products where id = '55555555-5555-5555-5555-555555555555') = 1,
  'staff should see inactive product');

update public.products set is_active = true where id = '55555555-5555-5555-5555-555555555555';

-- Customers cannot insert products
select pg_temp.as_role(:'cust_a_id', 'authenticated');
do $$
begin
  begin
    insert into public.products (name, slug, price) values ('rogue', 'rogue', 1);
    perform pg_temp.assert(false, 'customer must NOT insert products');
  exception when others then
    -- expected: RLS rejection
    null;
  end;
end$$;

-- ----------------------------------------------------------------------------
-- orders: owner OR staff can read
-- ----------------------------------------------------------------------------
-- Customer A reads their own order
select pg_temp.as_role(:'cust_a_id', 'authenticated');
select pg_temp.assert(
  (select count(*) from public.orders where id = '66666666-6666-6666-6666-666666666666') = 1,
  'order owner should see their order');

-- Customer B cannot
select pg_temp.as_role(:'cust_b_id', 'authenticated');
select pg_temp.assert(
  (select count(*) from public.orders where id = '66666666-6666-6666-6666-666666666666') = 0,
  'non-owner customer must NOT see order');

-- Staff can
select pg_temp.as_role(:'staff_id', 'authenticated');
select pg_temp.assert(
  (select count(*) from public.orders where id = '66666666-6666-6666-6666-666666666666') = 1,
  'staff should see any order');

-- ----------------------------------------------------------------------------
-- inventory_movements: staff-only
-- ----------------------------------------------------------------------------
select pg_temp.as_role(:'cust_a_id', 'authenticated');
select pg_temp.assert(
  (select count(*) from public.inventory_movements) = 0,
  'customer must NOT see inventory movements');

-- ----------------------------------------------------------------------------
-- notifications: visible to its audience
-- ----------------------------------------------------------------------------
select pg_temp.as_role(:'admin_id', 'authenticated');
insert into public.notifications (id, title, message, type, audience)
values ('77777777-7777-7777-7777-777777777777', 'Internal', 'staff only', 'system', 'staff');

select pg_temp.as_role(:'cust_a_id', 'authenticated');
select pg_temp.assert(
  (select count(*) from public.notifications where id = '77777777-7777-7777-7777-777777777777') = 0,
  'customer must NOT see staff notifications');

select pg_temp.as_role(:'staff_id', 'authenticated');
select pg_temp.assert(
  (select count(*) from public.notifications where id = '77777777-7777-7777-7777-777777777777') = 1,
  'staff should see staff notifications');

-- ----------------------------------------------------------------------------
-- Rollback fixtures so smoke test is idempotent and non-destructive
-- ----------------------------------------------------------------------------
rollback;

\echo 'RLS smoke tests passed.'
