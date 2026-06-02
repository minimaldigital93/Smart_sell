-- 0001_extensions_and_enums.sql
-- Postgres extensions + custom enum types used across the schema.

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive text (emails, slugs)

do $$ begin
  create type public.user_role as enum ('admin', 'staff', 'customer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_category as enum (
    'skincare', 'makeup', 'perfume', 'haircare', 'bodycare'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending',
    'payment_confirmed',
    'preparing',
    'shipping',
    'delivered',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('khqr', 'aba', 'acleda', 'wing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.movement_type as enum ('in', 'out', 'adjustment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'order', 'inventory', 'promo', 'system'
  );
exception when duplicate_object then null; end $$;
