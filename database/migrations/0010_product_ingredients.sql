-- 0010_product_ingredients.sql
-- Additive: ingredients field for cosmetic products (spec PDP requirement).

alter table public.products
  add column if not exists ingredients text;
