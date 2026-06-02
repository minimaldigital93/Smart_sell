-- 0009_realtime_publications.sql
-- Add tables to Supabase Realtime so clients can subscribe to changes.
-- These are the tables where live updates matter most: orders (admin
-- dashboard), product_inventory (stock changes), notifications (toast feed).

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Idempotent: ALTER PUBLICATION ... ADD TABLE has no IF NOT EXISTS, so we
-- check pg_publication_tables before each add. Safe to re-run.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'orders',
    'product_inventory',
    'inventory_movements',
    'notifications'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = v_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    end if;
  end loop;
end $$;
