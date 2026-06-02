# Database — Phase 2

Postgres schema, RLS policies, transaction-safe inventory logic, and realtime
publications for CSMS_App.

## Files

| File | Purpose |
| --- | --- |
| `migrations/0001_extensions_and_enums.sql` | `pgcrypto`, `citext`, custom enums (user_role, product_category, order_status, payment_method, movement_type, notification_type) |
| `migrations/0002_profiles.sql` | `profiles` table mirroring `auth.users` + trigger that creates a profile on signup |
| `migrations/0003_products_and_inventory.sql` | `products` + `product_inventory` (1:1) and the trigger that auto-creates an inventory row per product |
| `migrations/0004_orders.sql` | `orders` + `order_items` (snapshots price at purchase) |
| `migrations/0005_inventory_movements.sql` | Append-only ledger of every stock change |
| `migrations/0006_notifications.sql` | Per-user + broadcast notifications |
| `migrations/0007_functions_and_triggers.sql` | `apply_inventory_movement` (atomic with row lock), `apply_order_inventory`, status-change trigger, stock-cache sync trigger |
| `migrations/0008_rls_policies.sql` | RLS on every table + `is_admin()` / `is_staff()` helpers |
| `migrations/0009_realtime_publications.sql` | Adds orders, inventory, notifications to `supabase_realtime` publication |
| `seed/0001_demo_data.sql` | Optional sample products + notification |
| `schema.sql` | All migrations concatenated — paste into Supabase SQL editor for one-shot apply |

## How to apply

### Option A — Supabase SQL editor (fastest)

1. Create a Supabase project at <https://supabase.com>.
2. Paste credentials into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Open the project's **SQL Editor**, paste the entire contents of `database/schema.sql`, run.
4. Optionally run `database/seed/0001_demo_data.sql` for demo products.

### Option B — Supabase CLI

```bash
brew install supabase/tap/supabase
supabase link --project-ref <ref>
cp database/migrations/*.sql supabase/migrations/
supabase db push
```

### Generate TypeScript types from the live schema

After applying the schema:

```bash
npx supabase gen types typescript \
  --project-id <your-project-ref> \
  --schema public \
  > src/types/database.ts
```

The placeholder at `src/types/database.ts` will be replaced with the real
generated types.

## Promoting a user to admin

Profiles default to `customer`. To create your first admin:

```sql
update public.profiles
   set role = 'admin'
 where email = 'you@example.com';
```

Subsequent admins can be promoted via the Phase 6 admin UI.

## Inventory invariants

- `product_inventory.current_stock` is canonical. `products.stock` is a cache
  kept in sync by trigger.
- All stock changes go through `apply_inventory_movement(product_id, type, quantity, ...)`.
  The function takes a row lock (`for update`), validates non-negative stock,
  writes a `inventory_movements` row, then updates `product_inventory`.
- When an order's status transitions to `payment_confirmed`, the
  `orders_inventory_on_paid` trigger calls `apply_order_inventory(order_id)`,
  which is idempotent via the `inventory_applied` flag.

## RLS summary

| Table | customer | staff | admin |
| --- | --- | --- | --- |
| `profiles` | read/update own | read all | read/update all incl. role |
| `products` | read active | read all + write | read all + write |
| `product_inventory` | read | read + write | read + write |
| `orders` | read own + insert | read/write all | read/write all |
| `order_items` | read/insert via own order | read/write all | read/write all |
| `inventory_movements` | — | read + insert | read + insert |
| `notifications` | read own + broadcast, mark read | read all + write | read all + write |
