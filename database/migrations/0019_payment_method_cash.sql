-- 0019_payment_method_cash.sql
-- Add 'cash' to the payment_method enum so staff can record in-store
-- counter sales (POS) where money is taken at the till.

do $$ begin
  alter type public.payment_method add value if not exists 'cash';
exception when duplicate_object then null; end $$;
