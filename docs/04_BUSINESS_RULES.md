# 04 — Business Rules

_Rules enforced in the database (constraints/RLS/triggers) or in `src/lib` /
`src/actions`. Where a rule is duplicated in both layers, the DB is the enforcement
boundary; the app layer exists for UX (fast feedback, correct empty states)._

## Roles & access

| Role | Scope | Notes |
|---|---|---|
| `superadmin` | Platform-wide, `store_id = NULL` | Bypasses all tenant scoping in RLS and SECURITY DEFINER functions. Owns `/superadmin`. Seeded: phone `010552223` / password `12345678` — **must be changed after first login.** |
| `admin` | One store | Shop owner. Full CRUD on their store's products, inventory, orders, coupons, settings, staff. |
| `staff` | One store | Read + operate (scan, fulfill orders, adjust inventory) but not billing/settings/user management, per RLS policy shape. |
| `customer` | One store (or none, for guest checkout) | Storefront only: browse, cart, checkout, own orders, own loyalty balance, own wishlist. |

Authentication is **phone + password only** — no email, no SMS OTP provider. Each
phone number is normalized and mapped to a stable synthetic email
`<normalized-digits>@phone.csms.app` for Supabase's email/password auth
(`src/lib/auth/phone.ts`). Sign-up and sign-in must normalize identically or the
account becomes unreachable. There is no password-reset flow.

## Tenancy & store lifecycle

- Every shop owner gets exactly one `stores` row; `stores.status` drives access:
  `trial → active → grace → locked → cancelled`.
- A **locked** or **cancelled** store redirects storefront/admin traffic to
  `/store-unavailable` (middleware-enforced, mirrored client-side by
  `effectiveStoreStatus()` in `src/lib/tenant/status.ts` so the UI can show state
  without a round-trip).
- Grace period length: `GRACE_DAYS` (currently 3 days) — a lapsed store stays usable
  with a warning banner before locking.
- Store-owner onboarding (`/start`) is documented as **pay-first, no free trial**:
  create auth user → create store (service-role insert, since `stores` is
  superadmin-insert-only under RLS) on the chosen plan → promote profile to `admin` →
  store starts **locked** → owner must pay via `/admin/billing` before the store goes
  live. Note: a `TRIAL_DAYS = 14` constant and `trial` status still exist in code —
  see [06_KNOWN_ISSUES.md](06_KNOWN_ISSUES.md) for the discrepancy this creates.
- Per-store data isolation is enforced by RLS (`store_id = current_store_id()`), not
  just query filters — a bug in application code cannot leak another store's rows.
- Tenant resolution precedence: custom domain (Host header) → `/s/{slug}` path →
  fallback to the reserved default store (for the platform apex / localhost /
  `*.vercel.app`).

## Subscription billing

- 3 plans: `starter` ($9/mo), `growth` ($19/mo), `pro` ($29/mo) — codes are fixed
  (`src/lib/billing/plans.ts`); prices/features/limits live in `subscription_plans`
  and are editable by superadmin via the Plans console.
- Plan `limits` jsonb gates capabilities per store: `max_products`, `max_staff`,
  `coupons`, `loyalty`, `pos`, `custom_domain`, `advanced_analytics`. Defaults if a
  plan is missing a key: 50 products, 1 staff, all boolean gates `false`.
- Payment: **Bakong KHQR** when `BAKONG_*` env vars are configured; otherwise falls
  back to manual screenshot proof + superadmin approval (`subscription_payments`
  ledger, `status: pending → paid`).
- `activate_subscription()` is the single place that flips a store from
  locked/trial to active and sets `current_period_end` — the middleware's access
  check reads `stores.status`/`current_period_end` directly, so this function is the
  source of truth for "is this store allowed to serve traffic."

## Inventory

- `product_inventory.current_stock` is canonical; `products.stock` is a cache — never
  write to `products.stock` directly.
- Every stock change (manual stock-in/out, scan, order fulfillment, adjustment) must
  go through `apply_inventory_movement()`. It takes a row lock, rejects negative
  resulting stock, writes an immutable `inventory_movements` row, then updates the
  cache. There is no other sanctioned write path.
- Barcode formats supported: EAN-13, UPC, QR, Code128.
- Low stock = `current_stock <= minimum_stock` (per-product, default minimum 5).
- Movement types: `in` (restock), `out` (sale/manual removal), `adjustment`
  (correction, including down to zero — explicitly allowed since migration 0022).

## Orders & checkout

- `orders.total` must equal `subtotal + shipping_fee` (DB constraint) —
  shipping fee is sourced from the resolved store's `store_settings.shipping_fee` at
  checkout time, not hardcoded.
- Guest checkout is allowed (`orders.user_id` nullable).
- Status flow: `pending → payment_confirmed → preparing → shipping → delivered`, or
  `cancelled` from any pre-delivered state.
- Stock is deducted exactly once, when status transitions to `payment_confirmed`
  (idempotent via `inventory_applied` flag) — not at cart/checkout submission time.
- Cancelling an order that had already been paid **restocks inventory** and issues a
  loyalty-points credit refund if points were redeemed on it.
- Coupon redemption and loyalty-point redemption are both validated and applied
  transactionally inside `create_customer_order()`, scoped to the resolved store —
  a coupon or the customer's point balance cannot be used across stores.
- Accepted payment methods: KHQR, ABA, Acleda, Wing (online, require a payment
  screenshot upload), plus Cash (POS-only, in-person).

## Loyalty points

- Earn: 1 point per $1 of order total, only once the order reaches `delivered`
  (`calcPointsEarned`, `src/lib/loyalty/constants.ts`).
- Redeem: 100 points = $1 of credit, capped at 50% of subtotal per order
  (`MAX_POINTS_REDEMPTION_RATIO`).
- `loyalty` is itself a plan-gated capability — a store on a plan without `loyalty:
  true` should not expose earn/redeem in its storefront.

## Coupons & shop categories

- Coupon codes are unique per store (not globally) — two stores can both run code
  `SAVE10` independently.
- Shop categories (migration 0041) are the authoritative catalog taxonomy, replacing
  the old fixed 5-category enum. Every store is auto-seeded with the same 5 built-in
  categories (same slugs as the legacy enum, so existing `/category/{slug}` URLs keep
  working), but admins can add/rename/reorder/soft-delete their own. Category writes
  are **admin-only** (staff cannot create/edit categories); reads of active
  categories are public for the storefront.

## Notifications

- Two shapes: per-user (`user_id` set) and broadcast (`user_id NULL`, scoped to a
  store's users). Read state is tracked per user via `read_at`.
- Auto-generated on order status changes and low-stock/inventory events via DB
  triggers — not solely from application code, so they fire even for direct DB
  writes (e.g., seed scripts, admin SQL fixes).
- Telegram delivery is best-effort and env-gated (`TELEGRAM_*`) — its absence must
  never block the underlying action (order creation, stock change, etc.).
