-- wipe_app_data.sql
--
-- DESTRUCTIVE. Clears every domain table EXCEPT auth.users and public.profiles.
-- After this runs:
--   * All orders, line items, inventory movements, product inventory rows,
--     products, coupons, notifications, and loyalty_transactions are gone.
--   * profiles rows are retained as-is (name, email, phone, role) but
--     loyalty_points is reset to 0 because the transaction ledger was wiped.
--   * Files in payment-proofs, product-images, and movement-proofs storage
--     buckets are removed.
--
-- Do NOT run this against production unless you have a fresh backup AND have
-- accepted that the resulting reconciliation work is on you.

begin;

-- TRUNCATE ... CASCADE here is safe because every FK from a kept table
-- (profiles) into a wiped table uses ON DELETE SET NULL or doesn't exist —
-- cascade flows from referenced (parent) to referencing (child), so wiping
-- these tables cannot remove profile rows.
truncate table
  public.order_items,
  public.orders,
  public.inventory_movements,
  public.product_inventory,
  public.products,
  public.coupons,
  public.notifications,
  public.loyalty_transactions
restart identity cascade;

-- Loyalty audit log is empty, so the point balance must be zeroed to match.
update public.profiles
   set loyalty_points = 0
 where loyalty_points <> 0;

-- Storage: drop every object in the buckets owned by this app. The buckets
-- themselves are preserved (created by migration 0011/0013/0018).
delete from storage.objects
 where bucket_id in ('payment-proofs', 'product-images', 'movement-proofs');

commit;
