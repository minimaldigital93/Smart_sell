-- 0004_orders.sql
-- orders + order_items. user_id is nullable to support guest checkout.

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  customer_name   text not null,
  phone           text not null,
  address         text not null,
  note            text,
  subtotal        numeric(10,2) not null check (subtotal >= 0),
  shipping_fee    numeric(10,2) not null default 0 check (shipping_fee >= 0),
  total           numeric(10,2) not null check (total >= 0),
  payment_method  public.payment_method not null,
  payment_image   text,
  status          public.order_status not null default 'pending',
  inventory_applied boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint orders_total_matches
    check (total = subtotal + shipping_fee)
);

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  quantity    integer not null check (quantity > 0),
  price       numeric(10,2) not null check (price >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
