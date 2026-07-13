# 07 — Production Readiness Audit

_Audit date: 2026-07-13. Method: full read of all 41 migrations, every server
action and data service, middleware/tenant resolution, validation schemas, PWA
layer, and the key interactive components. Every finding cites the file(s) it
was observed in. `npx tsc --noEmit` passes clean. No automated tests exist._

**Verdict: NOT ready for commercial multi-tenant launch. Overall readiness ≈ 40%.**

The single-store core (storefront → checkout → order → inventory ledger) is
genuinely well built — `create_customer_order` and `apply_inventory_movement`
show real transaction-safety discipline, and migrations 0022–0027 prove a prior
audit was acted on. But the multi-tenant SaaS layer (Phase 14) sits on top of
RLS policies and SECURITY DEFINER grants that were never re-audited for
multi-tenancy. The result is a cluster of **critical, remotely exploitable
authorization holes** (self-award loyalty points, self-activate subscriptions,
customer-driven inventory manipulation, cross-tenant admin data bleed) plus a
**money-math regression** (per-store shipping fee silently reverted). None of
these are hard to fix — most are one migration and a handful of `.eq("store_id")`
filters — but every one of them is disqualifying for a platform that will hold
other businesses' money records.

---

## 1. Executive Summary

| Dimension | State |
|---|---|
| Single-store shop flow | Solid. Atomic checkout RPC, price recomputed server-side, stock ledger idempotent, cancel restocks + refunds credits. |
| Multi-tenant isolation | **Broken.** Admin pages leak other stores' products/coupons/inventory; storage buckets not tenant-scoped; staff can move themselves between stores. |
| Billing | **Bypassable.** Store owners can self-activate subscriptions and self-grant trials at the DB layer. Plan limits are enforced nowhere. |
| Loyalty | **Exploitable.** Any authenticated user can mint unlimited points (2 independent ways). |
| Accounting | Not present in a real sense: no cost price, no COGS, no tax, no cash drawer, no daily close, day-buckets in UTC not ICT. |
| Retail workflows | Missing: refunds/exchanges, supplier/PO/receiving, expiry/batch, stock transfer, cycle count, receipts (thermal), exports. |
| Code quality | High. Strict TS, clean layering, consistent idiom, good comments. Typecheck clean. |
| Testing | **Zero** JS/TS tests; the only test artifact is a pre-multi-tenant SQL smoke script. |

Recommended posture: treat Phase 14 as feature-complete but **security-incomplete**.
Run the P0/P1 remediation below (est. 1–2 focused weeks) before onboarding any
paying store beyond the owner's own shop.

---

## 2. Critical Issues (must fix before release)

### C1. Privileged SECURITY DEFINER functions are executable by any authenticated user
The following RPCs are `SECURITY DEFINER`, granted to `authenticated` (some to
`anon`), and perform **no caller authorization** internally. Anyone with the
public anon key + any customer session can call them via PostgREST directly:

| Function | Grant | Exploit |
|---|---|---|
| `earn_loyalty_points(p_user_id, p_order_id, p_total)` — `database/migrations/0020_loyalty_points.sql:63-108` | authenticated | Call with your own uid, `p_order_id = NULL`, `p_total = 1000000`. The idempotency guard (`where order_id = p_order_id`) never matches NULL, the FK allows NULL → **unlimited points minted** (points = money at checkout). |
| `redeem_loyalty_points(p_user_id, …)` — `0020:118-152` | authenticated | Drain any other user's points if their uid is known (griefing). |
| `activate_subscription(p_payment)` — `0037_billing.sql:128-170` | authenticated | Owner check is only `v_store = current_store_id()`. A store owner inserts a pending payment (allowed by `payments_insert_own`, status/amount unconstrained), then self-activates → **free subscription forever**, never touching Bakong. The app's Bakong check (`src/app/actions/subscriptions.ts:97-139`) is trivially bypassed. |
| `start_store_trial(p_store, p_plan_code)` — `0037:107-131` | authenticated | Owner self-grants a fresh 14-day trial, repeatedly — despite the documented "pay-first, no trial" model. Unlocks a locked store. |
| `unredeem_coupon(p_code)` — `0024_order_integrity…sql:301-309` | authenticated | Resets `redeemed_count` on **any** coupon, in **any** store (matches by code globally) → unlimited reuse of capped coupons. |
| `refund_order_credits(p_order_id)` — `0024:311-352` | authenticated | Call on your own **delivered** order → points + coupon refunded while you keep the goods (it doesn't check order status, only `credits_refunded`). |
| `apply_inventory_movement(...)` — `0040_functions_tenant_aware.sql:233-315` | authenticated (grant from 0017/0022 survives `create or replace`) | The tenant guard checks store match but **not role**. Any *customer* of a store can zero out or inflate that store's entire inventory and pollute the movement ledger. |
| `apply_order_inventory` / `restock_cancelled_order` — `0007:391-437`, `0023:57-105` | authenticated | Customers can force-deduct stock on their pending orders or restock others (same-store), corrupting stock counts. |

**Fix:** one migration — `revoke execute … from authenticated` on all of the
above; keep them callable only from triggers/other definer functions (no grant
needed for that) or add explicit `is_staff() and store match` / `is_superadmin()`
guards inside each body. `earn_loyalty_points` should also reject NULL order ids
and derive the user/total from the order row instead of trusting parameters.

### C2. Customers can UPDATE their own `loyalty_points` and `store_id` via PostgREST
`profiles_update_own` (`0008_rls_policies.sql:518-526`, kept by 0038) pins only
`role`. `loyalty_points` (added 0020) and `store_id` (added 0033) are freely
writable on your own row:
- `update profiles set loyalty_points = 1000000 where id = auth.uid()` → free money.
- A **staff/admin of store A sets `store_id` to store B** → instant full staff
  access to another tenant's orders, products, inventory (store ids are
  discoverable — they're on every publicly readable product row). Cross-tenant
  takeover with one API call.

**Fix:** a `BEFORE UPDATE` trigger (or revised policy) that rejects changes to
`role`, `store_id`, `loyalty_points` unless `is_superadmin()`.

### C3. Cross-tenant data exposure in the admin UI, views, and storage
The 0038 RLS pattern intentionally keeps *public* clauses (`is_active`,
`using (true)`) so anonymous storefronts work — but admin queries never add a
store filter, so those public clauses leak other tenants' rows into every
store's admin:

- `listProductsForAdmin` (`src/services/products-admin.ts:4-36`) — no
  `store_id` filter → a store's Products table shows **every other store's
  active products** (page: `src/app/(admin)/admin/products/page.tsx:19`).
- `listCoupons` (`src/services/coupons.ts:20-31`) → other stores' active
  coupon codes, values, windows visible in `/admin/coupons`.
- `listInventory` + `getInventoryStats` (`src/services/inventory.ts:47-121`) —
  `product_inventory` RLS is `using (true)` (`0038:71-84` keeps public read) →
  the Inventory page and `total_units` KPI aggregate **the entire platform's
  stock**; anon users can enumerate every store's stock/SKU/barcode via the
  REST API.
- `v_admin_dashboard` / `v_low_stock_products` (`0012_admin_views.sql`) are
  `security_invoker` but count products/inventory through those public-read
  policies → a store admin's `low_stock_count`, `out_of_stock_count`,
  `active_products` KPIs include **other stores' rows** (order KPIs are fine).
- `lookupProductByBarcodeAction` (`src/app/actions/scan.ts:27-45`) — no store
  filter; see H3.
- **Storage is not tenant-scoped at all:** `payment_proofs_select_owner_or_staff`
  (`0025:24-40`) lets staff of *any* store read *every* store's customer payment
  screenshots (financial PII). `product_images_*_staff` (`0013`) lets staff
  write/delete other stores' product images (client uploads at
  `src/components/admin/product-image-upload.tsx:40-56`). `branding_modify_admin`
  (`0028`) + flat logo paths `logo-<timestamp>.<ext>` with `upsert: true`
  (`src/app/actions/settings.ts:57-76`) mean two stores can overwrite each
  other's logos.

**Fix:** add `.eq("store_id", …)` to every admin service (defense in depth),
rebuild the four admin views store-scoped (or parameterize), split the "public
catalog read" from staff reads properly, and prefix all storage paths with
`stores/{store_id}/…` with path-checked policies.

### C4. Shipping fee regression — every store silently charges $2
Migration 0031 made `create_customer_order` read `store_settings.shipping_fee`.
Migration **0040 recreated the function from the 0024 body**, restoring
`c_shipping_fee constant numeric(10,2) := 2`
(`0040_functions_tenant_aware.sql:57`) and never reading `store_settings`.
Meanwhile the checkout UI shows the *configured* fee
(`useShippingFee()` → `src/lib/settings/store-config.tsx:70-72`). Any store
with a fee ≠ $2 shows one total on screen and stores a different total in the
DB. This is a live money bug in the primary revenue path.

**Fix:** re-apply the 0031 lookup inside the 0040 function body, per-store:
`select shipping_fee from store_settings where store_id = v_store`.

### C5. Tenant header spoofing through the middleware
`updateSession` copies **all inbound request headers**
(`src/lib/supabase/proxy.ts:51`) and only overwrites `x-store-id/slug/status`
when `resolve_store` succeeds (`:75-80`). When resolution fails — e.g.
`GET /s/does-not-exist/checkout` — or on `/superadmin` routes (resolution
skipped entirely), an attacker-supplied `x-store-id: <victim-store-uuid>`
survives into `getStoreContext()` (`src/lib/tenant/context.ts:44-56`), which
every service trusts. Effects include placing orders into a victim store and
signing up customers bound to it.

**Fix:** unconditionally `requestHeaders.delete(...)` all three `x-store-*`
headers before resolution.

### C6. Default credentials seeded and documented
`0030_reset_users_seed_admin.sql` and `0036_seed_superadmin.sql` create
`017552223 / 12345678` and `010552223 / 12345678`; both are printed in
`CLAUDE.md`. The platform superadmin — who can reassign any role and approve
any payment — is one guess away for anyone who reads the public repo. There is
also **no password reset flow** (removed by design) and no OTP, so a forgotten
owner password permanently locks a paying business out of its store.

_Reviewed 2026-07-13: owner opted to keep the fixed seed credentials for now
(convenience over hardening at this stage). A hardening approach (session-supplied
password via `SET app.seed_password`, plus a rotation migration for already-deployed
databases) was drafted and then intentionally reverted at the owner's request — revisit
before onboarding real store owners._

**Fix:** rotate both accounts now; add a forced-password-change flag on first
login; give the superadmin console a "reset user password" tool (service-role
`auth.admin.updateUserById`).

### C7. Zero automated tests
No test runner, no unit/integration/E2E tests (`package.json` has no test
script; no `*.test.*` files). The only artifact is
`database/tests/rls_smoke.sql`, which predates multi-tenancy (inserts products
without stores and tests none of the cross-store surfaces that are actually
broken). For a money-handling multi-tenant platform this alone blocks launch.

---

## 3. High Priority Improvements

- **H1 — Plan limits enforced nowhere.** `parsePlanLimits`
  (`src/lib/billing/plans.ts:33-59`) is imported only by the superadmin plans
  page and types. `createProductAction` has no `max_products` check
  (`src/app/actions/products.ts:33-84`), POS (`actions/pos.ts`) and coupons
  (`actions/coupons.ts`) only `requireStaff()`, `setCustomDomain`
  (`actions/domain.ts:26-56`) has no `custom_domain` gate, and nothing checks
  `max_staff`. All three tiers are functionally identical — Starter buyers get
  Pro for $9, and the pricing page is fiction.
- **H2 — Loyalty points are platform-global across independent merchants.**
  Balance lives on `profiles.loyalty_points`; a customer earns at store A and
  redeems at store B (`0040` scopes the *coupon* but not the points), i.e.
  store B funds store A's promotion. Points also accrue on `total` including
  shipping (`updateOrderStatusAction`, `src/app/actions/orders.ts:318-332`),
  and the earn call is fire-and-forget (silently lost on failure). Make points
  per-store (`(user_id, store_id)` balance table) and earn on the goods
  subtotal.
- **H3 — Barcode scanning breaks when two stores carry the same EAN.**
  `lookupProductByBarcodeAction` queries products by barcode with no store
  filter under RLS that exposes all stores' active products → `.maybeSingle()`
  errors on ≥2 matches ("Lookup failed") and can match another store's
  product on exactly 1 foreign match. Since tenants are cosmetic shops selling
  identical branded goods, collisions are the *expected* case. Filter by the
  caller's store.
- **H4 — Open redirect after login.** `signInAction` honors
  `formData.redirectTo` via `postLoginDestination`
  (`src/lib/auth/session.ts:37-43`), which returns any non-generic string —
  including `https://evil.example`. Validate it starts with a single `/`.
- **H5 — No stock reservation between order placement and confirmation.**
  Stock is checked at `create_customer_order` but deducted only at
  `payment_confirmed` (`0007:442-457`). Two paid-pending orders for the last
  unit → the second confirmation throws `insufficient stock` *after the
  customer already paid*; recovery is a manual refund outside the system.
  Either deduct at order creation with restock-on-cancel (simplest; cancel
  path already exists) or add a `reserved_stock` column.
- **H6 — POS is not transactional and workflow-incomplete.**
  `submitCounterSaleAction` (`src/app/actions/pos.ts:103-161`) does insert →
  items → status-flip with manual `discardOrder()` compensation; a crash
  mid-sequence leaves phantom pending orders. Counter sales terminate at
  `payment_confirmed`, permanently inflating the "active orders" KPI, and
  never earn loyalty. Missing for real retail: search-by-name fallback
  (barcode-less items are unsellable at the till — `pos-flow.tsx` is
  scan-only), cash-received/change calculation, line discounts, receipt
  (80mm/ESC-POS) printing, refund/void. Wrap it in one RPC like
  `create_customer_order` and add a `completed` semantic for counter sales.
- **H7 — Billing lifecycle gaps.** `activate_subscription` always extends
  +30 days, ignoring `subscription_plans.interval` (yearly plans exist in the
  CHECK but would be robbed of 11 months). `extendStorePeriod` updates only
  `stores`, letting the `subscriptions` row drift (two sources of truth). No
  scheduled job notifies owners before expiry — a store just flips to locked
  mid-day (grace = 3 days, then hard lock).
- **H8 — Queries that will not survive growth.** `countOrdersByStatus`
  (`src/services/orders-admin.ts:53-68`) selects **every order row** to count
  in JS on each orders-page load; `getInventoryStats` selects all inventory
  rows to sum, and includes a dead placeholder query (`inventory.ts:56-63`);
  admin lists hard-cap silently (products 100, orders 50) with **no
  pagination UI** — at 10k products a store simply cannot see product #101.
  At 100k orders the orders page transfers the whole table. Use
  `count/head:true`, group-by views, and cursor pagination (movements already
  do this correctly).
- **H9 — Custom-domain verification is decorative.** `resolve_store`
  (`0033:104-117`) routes on `custom_domain` regardless of `domain_verified`;
  the DNS check targets `cname.vercel-dns.com` by default while production is
  a Cloudflare tunnel (`actions/domain.ts:13-15`) so verification can never
  pass unconfigured — yet routing works anyway. Enforce `domain_verified` in
  `resolve_store` and set the correct CNAME target.
- **H10 — PostgREST `.or()` filter injection.** Admin search interpolates raw
  user input into `.or("name.ilike.%q%,…")` escaping only `%_`
  (`products-admin.ts:20-26`, `orders-admin.ts:19-25`); commas/parens in `q`
  corrupt the filter expression (errors or altered filters). Escape or switch
  to `textSearch`.
- **H11 — Broadcast notifications share one `read_at`.** One staff member's
  "mark all read" (`actions/notifications.ts:40-55`, acknowledged in its own
  comment) clears the badge for every user; customers can't mark broadcasts
  read at all (RLS `update` is owner-only) so their badge can never fully
  clear. Needs a `notification_reads(user_id, notification_id)` table.

---

## 4. Medium Priority Improvements

- **M1 — No cost price / COGS anywhere** (`products` has `price`,
  `discount_price` only). Margin, profit-per-product, and inventory valuation
  are impossible; the promised "advanced analytics" has no data to compute.
  Add `cost_price` + per-movement `unit_cost` (weighted average is enough).
- **M2 — No tax modeling.** Cambodia VAT (10%) for registered businesses:
  no tax fields on orders/items, no tax line on the invoice
  (`invoice-view.tsx`), no tax report. Even a store-level flat-rate field
  with an invoice line would unblock registered shops.
- **M3 — Dual-currency reality unsupported.** `store_settings.currency` only
  relabels the symbol via `Intl` (`src/lib/utils.ts:23-45`); amounts are not
  converted (set KHR and a $2 fee renders as ៛2). Cambodian retail quotes
  USD + KHR at ~4100; KHQR often settles in KHR. Support a KHR display rate
  at minimum.
- **M4 — No returns, refunds, or exchanges.** `delivered` is terminal
  (`src/lib/orders/transitions.ts:9-16`); the only reversal is full-order
  cancel. Real shops take partial returns and exchanges weekly; today those
  drift inventory and revenue apart with no record.
- **M5 — No supplier/PO/receiving, no expiry/batch tracking, no transfer,
  no cycle count.** Movement types are just `in|out|adjustment` with a free
  note — damaged/expired/theft can't be distinguished for shrinkage
  reporting. Expiry matters specifically for cosmetics.
- **M6 — Opening stock bypasses the ledger.** `createProductAction` seeds
  `products.stock` → copied by `handle_new_product` with **no
  inventory_movements row**, so the audit trail doesn't start at zero.
- **M7 — `product_inventory.barcode/sku` drift.** Product edits update
  `products.barcode/sku` only (`actions/products.ts:86-137`); the inventory
  copy is stamped once at insert (`0003:169-181`). The ledger logs the stale
  inventory barcode, and the per-store unique index on the stale value can
  block reuse. Sync via trigger or drop the duplicated columns.
- **M8 — Cart/wishlist leak across path-based tenants.** Zustand persists to
  one `csms-cart` localStorage key (`src/store/cart-store.ts:52`) shared by
  every `/s/{slug}` store on the platform origin; checkout then rejects the
  mixed cart with a confusing "product unavailable". Key by store slug.
- **M9 — PWA gaps on the primary platform.** The middleware matcher excludes
  `manifest.webmanifest` (`src/proxy.ts:9-11`) so the manifest never gets
  store headers → **per-store PWA branding never ships** (always default).
  `start_url: "/"` sends `/s/{slug}` installs to the default store. The
  notifications opt-in uses `new Notification(...)`
  (`enable-push-button.tsx:44-49`), which iOS does not support — no Web
  Push/VAPID subscription exists, so "push notifications" are effectively
  desktop-Chrome-only while the app is open. No background sync/offline queue
  for POS or movements.
- **M10 — Order UUID is a bearer token for PII.** `getOrderConfirmation`
  (`src/services/orders.ts:44-68`) reads any order + address/phone via the
  service role, keyed only by the UUID that appears in URLs/history/logs.
  Sign the confirmation link or scope it to a short-lived cookie.
- **M11 — Zoom disabled.** `userScalable: false, maximumScale: 1`
  (`src/app/layout.tsx:60-66`) fails WCAG 1.4.4 and hurts low-vision users.
- **M12 — Rate-limit bypasses.** `getClientIp` trusts `x-forwarded-for`
  (`src/lib/security/rate-limit.ts:24-29`) — spoofable for direct-to-origin
  hits; RPCs granted to `anon` (notably `create_customer_order`) are callable
  straight through PostgREST, skipping app-layer limits entirely (order/
  notification spam via the `notify_new_order` trigger). `rate_limits` rows
  also accumulate unbounded without pg_cron.
- **M13 — No admin/audit log.** Price changes, role changes, settings edits,
  order-status changes, superadmin payment approvals — none are recorded (only
  inventory has a ledger). Disputes between owner and staff are unresolvable.
- **M14 — No exports or real reports.** No CSV/Excel/PDF anywhere (grep-clean),
  no date-range sales report, no monthly close, no top-customers/slow-movers.
  Dashboard is a 30-day rolling window.
- **M15 — Raw DB errors surfaced.** `updateOrderStatusAction` returns
  `updateErr.message` verbatim to the UI (`actions/orders.ts:306`).
- **M16 — Onboarding leftovers.** If store creation fails after signup
  (`actions/onboarding.ts:66-104`), an orphan auth user remains (retry then
  hits "phone already registered"). Phone numbers are never verified (no OTP)
  → squatting on someone else's number is trivial.
- **M17 — Sales day-buckets are UTC.** `v_sales_by_day` truncates
  `at time zone 'UTC'` (`0012:792`); Cambodia is ICT (UTC+7), so up to 7h of
  evening sales land on the wrong business day — daily reconciliation will
  never match the till.
- **M18 — Two sources of truth for subscription state** (`stores` columns vs
  `subscriptions` rows) already diverge (`extendStorePeriod` vs
  `activate_subscription`); pick one.
- **M19 — Health check is shallow.** `/api/health` returns ok without touching
  the DB (`src/app/api/health/route.ts`), so deploys "pass" with a dead
  backend.

---

## 5. Nice-to-Have Enhancements

- Torch/flashlight toggle + manual barcode entry in the scanner overlay.
- Order-status webhooks or Telegram per-store (current Telegram helper is
  single-account, env-global — all stores' orders go to the platform owner's
  chat if configured).
- Print: 80mm thermal receipt template alongside the A4 invoice; auto-print on
  POS completion.
- Persist `redirectTo` through the register flow like login.
- `docs/06_KNOWN_ISSUES.md` hygiene is good — fold this audit's confirmed items
  in and delete the fixed ones.
- Remove dead code: `TRIAL_DAYS`, `redeem_coupon` RPC (superseded by
  `create_customer_order`), the placeholder query in `getInventoryStats`,
  orphaned `(auth)/reset-password/update` page.

## 6. Bugs Found (concrete, reproducible)

1. Shipping fee ≠ settings (C4) — place an order in any store with fee ≠ $2.
2. Barcode scan "Lookup failed" on cross-store duplicate EANs (H3).
3. Admin Products/Coupons/Inventory tables show other stores' rows (C3).
4. Dashboard low-stock / out-of-stock / active-products KPIs count the whole
   platform (C3, views).
5. PWA manifest always shows default branding; `/s/{slug}` installs open the
   wrong store (M9).
6. Search containing `,` or `(` breaks admin search (H10).
7. Marking notifications read clears them for all staff; customers' broadcast
   badge never clears (H11).
8. POS sale crash mid-submit leaves a phantom pending order (H6).
9. `getMySubscription` `.maybeSingle()` errors for superadmin (multiple rows)
   → billing page renders "no subscription" for superadmin visiting /admin.
10. Cart persists across `/s/{slug}` tenants → cross-store checkout rejection (M8).
11. Product-image "remove" deletes the file from storage immediately, before
    the form is saved — cancel leaves the product pointing at a dead URL
    (`product-image-upload.tsx:63-72`).
12. Daily sales chart splits days at 07:00 local (M17).

## 7. Business Logic Problems

- Loyalty: global wallet across independent merchants; earn-on-shipping;
  refundable on delivered orders via RPC (C1/H2).
- Billing: pay-first model undermined by trial/activate RPC backdoors (C1);
  plans don't gate anything (H1); 30-day hardcode vs plan interval (H7).
- Orders: no reservation (H5); no partial fulfilment/returns (M4); POS
  terminal-state mismatch (H6).
- Inventory: adjustments can't be reason-coded; opening stock unledgered (M6);
  no costing (M1).
- The `interval` CHECK admits `year` plans that the activation math ignores.

## 8. UI/UX Problems

The visual layer is genuinely strong — consistent shadcn-based system, large
touch targets, sticky mobile nav, skeleton/empty states, bilingual EN/KM
dictionaries. Remaining issues: no pagination anywhere (silent truncation);
POS lacks manual search/cash-change/receipt; no password recovery for
customers or owners (C6); checkout *requires* account creation (password
field) — a true guest path exists in the DB but not the UI; zoom disabled
(M11); broadcast read-state confusion (H11); locked-store redirect sends staff
to `/admin/billing` but customers to a dead-end page with no contact info.
First-time-owner onboarding after payment is bare: no guided "add your first
product / set shipping fee / print a test invoice" checklist.

## 9. Security Risks (ranked)

1. C1 RPC grants (money + data integrity, remote, authenticated-only).
2. C2 profiles column self-service (money + cross-tenant takeover).
3. C3 cross-tenant reads incl. payment-proof PII via staff of any store.
4. C6 default credentials for the platform superadmin.
5. C5 `x-store-id` spoofing (fails-open tenant binding).
6. H4 open redirect post-login.
7. M12 rate-limit bypass via direct PostgREST RPC (order spam).
8. M10 order-UUID bearer reads (PII).
9. Anon enumeration of all stores' inventory/settings/coupons (info leak).
10. CSP allows `unsafe-inline`/`unsafe-eval` (documented tradeoff; fine for
    now, nonce upgrade later). Headers otherwise good (HSTS, frame-deny,
    Permissions-Policy).

## 10. Performance Risks

Middleware does 2–3 Supabase round-trips per request (resolve_store +
getUser + profile) with no caching — on cloud Supabase from Cambodia that is
user-visible latency on every navigation (self-hosting will help). Unbounded
queries: `countOrdersByStatus`, `getInventoryStats`, superadmin `getAllUsers`
(500) / `getStores` (all). No pagination (H8). Realtime subscriptions
(`orders`, `product_inventory`, `inventory_movements`, `notifications` in one
publication) are not store-filtered by channel — every admin tab receives
every store's change events (also an info-leak channel: payloads for other
tenants). At 10 stores × boutique volume: fine. At 1,000 stores: the views,
counts, and realtime fan-out all need rework.

## 11. Code Smells

- Dead/vestigial: `TRIAL_DAYS`, `redeem_coupon`, `redeem_loyalty_points`
  (checkout no longer uses it), placeholder query in `getInventoryStats`,
  `reset-password/update` route, `products.category` legacy enum column.
- `as never` casts to bypass typed inserts (`actions/products.ts:66,118`) and
  `from("v_admin_dashboard" as never)` — regenerate `types/database.ts` to
  include views so the compiler sees them.
- Duplicated price-resolution logic in four places (DB trigger, RPC, POS
  action, PosFlow client) — extract one SQL function / one TS helper.
- `create_customer_order` body duplicated across 0024/0031/0040 with manual
  divergence — exactly how C4 happened. Keep one canonical definition file.
- Console.error-only error handling in services returning `[]` — silent
  failures render as "empty store" with no operator signal.

## 12. Database Problems

- Grant hygiene (C1) and policy gaps (C2, C3) above.
- `database/schema.sql` stale at migration 0015 (header claims "all
  migrations"; also flagged in 06_KNOWN_ISSUES).
- Admin views not tenant-scoped (C3); `v_sales_by_day` UTC (M17).
- `orders` has no `store_id`-leading index on `(store_id, created_at)` for the
  unfiltered admin list (only `(store_id, status, created_at)`); fine now,
  matters at scale.
- `notifications.store_id` nullable = platform broadcast, but nothing ever
  creates one; RLS branch is dead.
- `subscription_payments.amount_usd` accepts 0 with owner insert (C1 chain).
- `rate_limits` unbounded growth without pg_cron sweep.
- 0030 is a destructive `delete from auth.users` sitting in the ordered
  migration chain — a fresh-environment replay wipes accounts by design;
  gate it behind an explicit flag or move to `scripts/`.

## 13. Validation Problems

Zod coverage is consistently good (all actions parse before touching the DB).
Gaps: `redirectTo` unvalidated (H4); `q` search strings unescaped for
PostgREST syntax (H10); `currency` free-text (`settings/schema.ts:44`) rather
than an ISO allowlist (Intl fallback hides typos); coupon `expires_at` can be
set in the past with `is_active` true (harmless but confusing); no server-side
image dimension/content sniffing beyond MIME string on uploads; phone
uniqueness collides across tenants by design (one phone = one account
platform-wide — two stores cannot both have a customer record for the same
person with separate passwords).

## 14. Missing Features Required for Real Businesses

Priority-ordered for the Cambodian cosmetic-shop segment:
1. Refunds/returns/exchanges (with restock + reason codes).
2. Cost price + COGS + margin reporting; inventory valuation.
3. Cash management: cash-received/change at POS, drawer float, shift open/close
   (Z-report), daily reconciliation.
4. Supplier + purchase order + receiving (stock-in with cost and supplier ref).
5. Expiry/batch tracking with expiring-soon alerts.
6. Receipt printing (thermal) and invoice numbering (sequential, per store —
   UUIDs are not acceptable on tax invoices).
7. Date-range reports + CSV export (sales, movements, orders).
8. Password reset / account recovery (superadmin tool at minimum).
9. Per-store loyalty + optional per-store Telegram.
10. VAT field on invoices.

## 15. Recommended Refactoring

1. **Migration 0042 (security):** revoke C1 grants; add role guards in
   function bodies; pin profiles columns (C2); enforce `domain_verified` in
   `resolve_store`; re-add per-store shipping fee (C4). One file fixes the
   worst of the audit.
2. **Tenant-scope the read layer:** helper `withStore(qb)` used by every
   admin service; rebuild the 4 admin views with `where store_id =
   current_store_id() or is_superadmin()`; store-prefix storage paths.
3. **Plan-gate helper:** `requirePlanCapability("pos" | "coupons" | …)` used
   at the top of gated actions + hide gated nav items in `AdminShell`.
4. **Single canonical `create_customer_order`** definition (latest migration
   wins; add a comment-tag test that greps for drift).
5. **Introduce Vitest + Playwright:** unit-test money math (coupon/points
   clamps), integration-test RPCs against a local Supabase (the harness for
   cross-tenant assertions), one E2E happy path (browse → checkout → confirm →
   deliver) and one POS path.
6. Regenerate `types/database.ts` including views; delete `as never` casts.
7. Reg