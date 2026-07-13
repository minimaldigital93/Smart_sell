# 02 — Database Design

_Derived from `database/migrations/0001`–`0041` (41 migrations applied). `database/schema.sql`
is **stale** — it only concatenates migrations 0001–0009 (the original Phase 2 base
schema) and predates multi-tenancy; treat the migrations folder as the source of
truth, not `schema.sql`. See [06_KNOWN_ISSUES.md](06_KNOWN_ISSUES.md)._

## Conventions

- All tables use `uuid primary key default gen_random_uuid()`.
- `timestamptz` everywhere; `updated_at` columns are kept current by a shared
  `set_updated_at()` trigger.
- Money columns are `numeric(10,2)`.
- Every tenant-owned table carries a `store_id uuid references stores(id)`, added in
  migration `0034_store_scoping.sql`, defaulting to `default_store_id()` so
  pre-multi-tenant rows attach to the reserved default store.
- Row Level Security is enabled on every table; policies generally follow the shape
  `is_superadmin() OR (is_staff()/is_admin() AND store_id = current_store_id())`,
  with public `select` carve-outs for storefront-facing data (active products,
  active coupons, active shop categories, store branding).
- Stock/points/ledger tables are **append-only** — never updated or deleted through
  the app; only inserted via SECURITY DEFINER functions.

## Enums (`0001_extensions_and_enums.sql`)

| Enum | Values |
|---|---|
| `user_role` | `superadmin`, `admin`, `staff`, `customer` |
| `product_category` | `skincare`, `makeup`, `perfume`, `haircare`, `bodycare` — legacy; superseded by `shop_categories` (0041), kept nullable for back-compat |
| `order_status` | `pending`, `payment_confirmed`, `preparing`, `shipping`, `delivered`, `cancelled` |
| `payment_method` | `khqr`, `aba`, `acleda`, `wing`, `cash` |
| `movement_type` | `in`, `out`, `adjustment` |
| `notification_type` | `order`, `inventory`, `promo`, `system` |

## Core tables

### `profiles` (0002, store-scoped in 0034)
Mirrors `auth.users` 1:1. `role` (`user_role`, default `customer`), `name`, `email`
(`citext`, unique where present), `phone`, `store_id` (null for `superadmin`).
Auto-created by `handle_new_user()` trigger on `auth.users` insert (tenant-aware since
`0040`: inherits `store_id` from signup metadata).

### `products` (0003)
`name`, `slug` (unique per store), `description`, `ingredients` (0010), `price`,
`discount_price` (must be `< price`), `stock` (denormalized cache — see
`product_inventory` below), `category` (legacy enum, nullable), `category_id` → FK to
`shop_categories` (0041, `NOT NULL`, `on delete restrict`), `images text[]`,
`barcode`/`sku` (unique per store where present), `featured`/`on_sale`/`new_arrival`
(0032 marketing flags), `is_active`.

### `product_inventory` (0003)
1:1 with `products`. `current_stock` is the **canonical** stock value;
`products.stock` is a cache kept in sync by trigger. `minimum_stock` (default 5)
drives low-stock alerts. `barcode`/`sku` duplicated here for scanner lookups.

### `inventory_movements` (0005)
Append-only ledger: `product_id`, `barcode`, `movement_type` (`in`/`out`/`adjustment`),
`quantity` (`> 0`), `resulting_stock` (snapshot, `>= 0`), `order_id` (nullable link to
the order that caused it), `created_by`, `notes`. Written exclusively through
`apply_inventory_movement()` (0007, rewritten tenant-aware in 0040; old signature
dropped in 0021). `0017`/`0018` add optional movement photo proofs + storage bucket.

### `orders` (0004)
`user_id` nullable (guest checkout), `customer_name`, `phone`, `address`, `note`,
`subtotal`, `shipping_fee`, `total` (`check total = subtotal + shipping_fee`),
`payment_method`, `payment_image`, `status` (`order_status`), `inventory_applied`
(idempotency flag for the stock-deduction trigger). `0031` sources the shipping fee
from per-store `store_settings` at checkout time. `0024` hardens order integrity and
adds credit refunds on cancel; `0023` aligns the admin sales view and restocks
inventory when an order is cancelled after being paid.

### `order_items` (0004)
Snapshot of `product_id`, `product_name`, `quantity` (`> 0`), `price` at time of
purchase — insulated from later product edits/deletes (`on delete restrict` on
`product_id`).

### `notifications` (0004, audience rules in 0014/0015)
`user_id` nullable (null = broadcast to a store's users), `title`, `message`, `type`,
`metadata jsonb`, `read_at`. Triggers (0015) auto-create order/inventory
notifications; `0014` scopes broadcast audience per store.

## Catalog & merchandising

### `shop_categories` (0041 — replaces the fixed enum as source of truth)
`store_id`, `name`, `slug` (unique per store, case-insensitive, excluding soft-deleted
rows), `description`, `icon` (Lucide name), `color` (hex), `display_order`,
`is_active`, `created_by`/`updated_by`, soft delete via `deleted_at`. Every store is
auto-seeded with the 5 built-in categories (Skincare/Makeup/Perfume/Hair Care/Body
Care) on creation, via `handle_new_store_categories()` trigger on `stores` insert.
Public `select` for active, non-deleted rows (storefront); writes are **admin-only**
(`is_admin()`, not staff).

### `coupons` (0016, store-scoped in 0034)
`code` (unique per store), `discount_value`, `min_subtotal`, `max_redemptions`,
`redeemed_count`, `starts_at`/`expires_at`, `is_active`. Redemption is validated and
counted inside `create_customer_order()` (checkout), scoped to the resolved store.

### `loyalty_transactions` (0020)
Append-only ledger: `user_id`, `order_id` (nullable), `points` (signed: positive =
earned/added, negative = spent), `balance_after` (snapshot), `note`. Points earn on
delivered orders, redeem at checkout. Constants (`src/lib/loyalty/constants.ts`):
1 point per $1 spent, 100 points = $1 credit, max 50% of subtotal offsettable by
points.

## Multi-tenant / SaaS tables

### `stores` (0033 — tenant root)
`name`, `owner_id` → `profiles`, `domain_verified`, `status` (`trial | active | grace
| locked | cancelled`), `plan_id` (FK to `subscription_plans`, added in 0037 to avoid
a migration-order cycle), `trial_ends_at`, `current_period_end`. `custom_domain` /
slug fields support `/s/{slug}` and vanity-domain routing (resolved via
`resolve_store` RPC). One reserved row is the **default store** (`slug = "default"`)
that backs the original single-tenant deployment and the platform apex domain.

### `subscription_plans` (0037)
`code` (unique: `starter | growth | pro`), `name`, `price_usd`, `interval`
(`month`/`year`), `features jsonb` (marketing bullet list), `limits jsonb`
(capability gates — see [04_BUSINESS_RULES.md](04_BUSINESS_RULES.md)), `sort`,
`is_active`.

### `subscriptions` (0037)
One row per store (`store_id unique`). `plan_id`, `status` (default `trialing`),
`current_period_start/end`, `trial_ends_at`, `cancel_at`. Kept in sync with
`stores.status`/`current_period_end` by `activate_subscription()`.

### `subscription_payments` (0037)
Billing ledger: `store_id`, `plan_id`, `amount_usd`, `method` (`khqr`/`manual`),
`bill_number`, `bakong_txn_ref`, `status` (default `pending`), `proof_url`, `paid_at`.

### `platform_expenses` (0039)
Superadmin-only P&L input: `category` (`hosting`/`server`/`other`), `label`,
`amount_usd`, `note`, `created_by`. Rolled up against `subscription_payments`
revenue by month/year via SECURITY DEFINER functions guarded by `is_superadmin()`.

## Supporting infrastructure tables

### `store_settings` (0028, converted to per-store rows in 0035)
One row per store (auto-created by trigger on store insert): `business_name`,
`tagline`, `logo_url`, `theme` (preset key), `default_locale` (`en`/`km`), `currency`,
`shipping_fee`, `contact_phone`, `contact_address`. Backs branding + checkout
defaults.

### `rate_limits` (0026)
Generic sliding-window limiter: `key text primary key`, `count`, `reset_at`. Used by
`src/lib/security` to throttle sensitive actions (auth, uploads, etc.).

## Storage buckets

| Bucket | Migration | Purpose | Access |
|---|---|---|---|
| `product-images` | 0013 | Product gallery photos | Public read |
| `payment-proofs` | 0011, locked further in 0025/0027 | Checkout KHQR screenshots | Private — owner/staff only |
| `movement-proofs` | 0018 | Inventory movement photos | Private |
| `branding` | 0028/0035 | Per-store logo assets | Public read |

## Key SECURITY DEFINER functions

| Function | Migration(s) | Purpose |
|---|---|---|
| `handle_new_user()` | 0002, tenant-aware in 0040 | Auto-create profile on signup, inherit `store_id` |
| `handle_new_product()` | 0003 | Auto-create `product_inventory` row per product |
| `handle_new_store_categories()` | 0041 | Seed 5 built-in categories on store insert |
| `apply_inventory_movement()` | 0007, dropped old sig 0021, tenant-aware 0040 | Atomic, row-locked stock change; writes ledger + updates cache |
| `apply_order_inventory()` | 0007 | Deducts stock for all items when an order is marked paid (idempotent via `inventory_applied`) |
| `create_customer_order()` | 0007, tenant-aware 0040, integrity hardening 0024 | Atomic checkout: validates cart, applies coupon, stamps `store_id`, refuses cross-store carts |
| `resolve_store()` | 0033-era tenant routing | Host/slug → store lookup for middleware |
| `activate_subscription()` | 0037 | Marks a store paid/active and syncs `subscriptions` + `stores` |
| `is_superadmin()` / `is_staff()` / `is_admin()` / `current_store_id()` | 0008, extended 0033/0038 | RLS helper predicates |

## Inventory invariants (unchanged since Phase 2, still authoritative)

- `product_inventory.current_stock` is canonical; `products.stock` is a cache.
- All stock changes go through `apply_inventory_movement()`, which takes a row lock
  (`for update`), validates non-negative stock, writes the ledger row, then updates
  the cache.
- On an order transitioning to `payment_confirmed`, `apply_order_inventory()` runs
  once (idempotent).
- Cancelling a previously-paid order restocks inventory and issues loyalty credit
  refunds (0023, 0024).

## Regenerating TypeScript types

```bash
npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts
```
