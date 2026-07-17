# CLAUDE.md

# COSMETIC STORE MANAGEMENT SYSTEM (CSMS_APP)

You are a senior full-stack engineer, system architect, UI/UX designer, and mobile-first SaaS expert.

Your task is to build a production-ready iPhone-first SaaS web application called:

# Cosmetic Store Management System

This platform is for cosmetic shops in Cambodia and combines:
- Online cosmetic store
- Inventory management
- Barcode stock management
- Admin dashboard
- Order management
- KHQR payment flow
- Mobile-first experience

The final application must feel:
- Premium
- Minimal
- Apple-inspired
- Fast
- Scalable
- Secure
- Native-like on iPhone

---

# PHASE PROGRESS

Last updated: 2026-07-17 (Phase 16 production refactor landed — migrations 0043–0048 and the app changes must be DEPLOYED TOGETHER; Phase 15 still blocked: migrating the database off Supabase cloud to a self-hosted Supabase stack on the production Mac mini — see **DEPLOYMENT & INFRASTRUCTURE**). Status reflects code present in the repo, not necessarily QA-verified.

| Phase | Area | Status |
|-------|------|--------|
| 1 | Project Foundation (Next.js 15, TS, Tailwind, shadcn, Supabase, PWA, ESLint, Prettier) | ✅ Done |
| 2 | Database Architecture (schema.sql, migrations/, policies/, seed/, tests/) | ✅ Done |
| 3 | Authentication — phone + password (synthetic email `<digits>@phone.csms.app`, `lib/auth/phone.ts`); login, register, callback, sign-out, lib/auth. Reset-password page/form removed. Roles: superadmin, admin, staff, customer. | ✅ Done |
| 4 | Public Storefront (shop, category, product, search, account, wishlist) | ✅ Done |
| 5 | Cart + Checkout (cart, checkout, success page, KHQR upload) | ✅ Done |
| 6 | Admin Dashboard (admin layout, dashboard, sidebar) | ✅ Done |
| 7 | Product Management (admin/products CRUD, new/edit) | ✅ Done |
| 8 | Inventory Management (admin/inventory, movements, products) | ✅ Done |
| 9 | Barcode Scanner (admin/scan, html5-qrcode, components/admin/scanner) | ✅ Done |
| 10 | Order Management (admin/orders, print/orders/[id]) | ✅ Done |
| 11 | Notifications (admin + shop notifications, components/notifications) | ✅ Done |
| 12 | Security + Performance (lib/security, PWA manifest, offline page, sw.js) | ✅ Done |
| 13 | Optional Advanced — done: coupons (admin CRUD + checkout redeem), wishlist, Khmer i18n, POS (cash payment method + admin/pos), Telegram helper (`lib/notifications/telegram.ts`, best-effort, env-gated), store settings + branding/theme (per-store `store_settings`, admin/settings page, `lib/settings`, `services/settings.ts`, `actions/settings.ts`, 6 curated theme presets in `lib/theme/presets.ts`, `branding` storage bucket, migrations 0028/0035), **multi-store** (see Phase 14). Loyalty points were REMOVED in Phase 16 (migration 0046 — orders.points_redeemed kept as a legacy column). Pending: supplier management, expiration tracking, advanced analytics. | 🟡 Partial |
| 14 | **Multi-tenant SaaS Platform** — superadmin role + `stores` tenant root; per-store scoping on every table with per-store unique slug/sku/barcode/coupon; tenant-aware RLS + SECURITY DEFINER helpers; subscription billing (3 plans; khqr.cc since Phase 16, manual proof fallback); store-owner onboarding (pay-first, no trial); custom domain / `/s/{slug}` routing; superadmin console (stores, subscriptions, plans, users, finance); platform finance (subscription revenue − platform expenses). Migrations 0033–0040. See **MULTI-TENANT SaaS PLATFORM** section. | ✅ Done |
| 15 | **Self-hosted Supabase migration** — move the backend from Supabase cloud (project `tpqyzuudllxdwqyurdfi`) to a self-hosted Supabase docker stack on the production Mac mini. No app code changes — env swap only. Stack configured and storage mirrored; blocked on cloud DB dump (needs owner's DB password), then restore → repoint app → tunnel cutover. See **DEPLOYMENT & INFRASTRUCTURE**. | 🟡 In progress |
| 16 | **Production refactor + khqr.cc payments** (2026-07-17, migrations 0043–0048) — security hardening from the docs/07 audit (C1 SECURITY DEFINER grants revoked/guarded, C2 profiles role/store_id pinned, C3 tenant-scoped admin services + views + storage paths, C5 tenant-header spoofing fixed, H3 store-scoped barcode lookup, H4 open-redirect guard, H8 count queries, H10 search escaping); minimal plan gating (`lib/billing/capabilities.ts` — max_products / pos / coupons / custom_domain); **loyalty removed entirely**; half-wired trial path removed (pay-first); Vitest bootstrapped (`npm test`, 38 unit tests); **khqr.cc (KHQRPay) payment platform** ported from AMS_APP for customer orders + POS + subscription billing — screenshot upload and ABA/Acleda/Wing removed from checkout (enum values kept for historical orders). See **PAYMENTS (khqr.cc)**. | ✅ Done |

When asked to "continue", default to Phase 13 remaining items (supplier management, expiration tracking, advanced analytics) unless the user specifies otherwise.

---

# CORE OBJECTIVES

Build:

1. Public storefront
2. Admin dashboard
3. Smart inventory system
4. Barcode scanner system
5. Order management
6. KHQR payment system
7. Real-time inventory updates
8. Mobile-first user experience

---

# TECH STACK

## Frontend
- Next.js 15 App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion

## Backend
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime

## Mobile Features
- PWA support
- iPhone optimization
- Camera barcode scanning
- Push notifications

## Recommended Libraries
- zod
- react-hook-form
- zustand
- tanstack-query
- react-hot-toast
- date-fns
- html5-qrcode OR zxing-js

---

# UI/UX DESIGN SYSTEM

## Design Style
- Apple-inspired UI
- Luxury cosmetic aesthetic
- White background
- Soft pink/nude accent colors
- Large rounded corners
- Soft shadows
- Smooth animations
- Modern typography
- Large touch-friendly controls

## UX Rules
- One-hand iPhone use
- Sticky mobile navigation
- Fast interactions
- Minimal clicks
- Smooth checkout
- Large product images
- Clean spacing
- Native-like experience

---

# DEVELOPMENT RULES

## IMPORTANT

Build the application phase-by-phase.

DO NOT generate the entire application at once.

For every phase:
1. Explain architecture
2. Explain folder structure
3. Explain data flow
4. Then generate implementation

Always prioritize:
- Scalability
- Reusability
- Performance
- Mobile UX
- Maintainability
- Production readiness

---

# PROJECT STRUCTURE

Actual layout (rooted at `src/`, plus top-level `database/`):

```bash
src/app/
  (admin)/admin/         # dashboard, products, inventory, orders, scan, payments, coupons, pos, notifications, settings, billing
  (superadmin)/superadmin/ # platform console: stores (+[id]), subscriptions, plans, users, finance
  (auth)/                # login, register, start (store-owner onboarding); phone + password
  (shop)/                # shop, category, product, search, cart, checkout (+pay/[token]), wishlist, account, orders, notifications
  store-unavailable/     # shown when a tenant store is locked/cancelled (billing lapsed)
  actions/               # server actions: auth, products, orders, inventory, scan, coupons, pos, payments,
                         #   notifications, settings, onboarding, subscriptions, superadmin, expenses, domain
  api/health/            # health check route
  api/khqr/              # webhook (signature-authed), status/[token] (customer poll), reconcile (cron, bearer)
  auth/                  # supabase auth callback / sign-out
  print/orders/[id]/     # printable invoice
  offline/, manifest.ts  # PWA
  layout.tsx, globals.css

src/components/
  ui/                    # shadcn primitives
  shared/                # cross-feature widgets (incl. brand.tsx)
  admin/                 # admin-shell, kpi-card, sales-chart, products/orders/inventory/scanner/coupons/pos/
                         #   payments (table, badge, row-actions)/settings (incl. payment-settings-form)
  superadmin/            # store-actions, payment-actions, user-role-select, pnl-table, expense-form/-delete
  billing/               # billing-client, manual-proof-form (store subscription checkout)
  payments/              # qr-image (local KHQR payload → QR data-url)
  settings/              # custom-domain (per-store custom domain config)
  shop/                  # product-card, gallery, cart, wishlist-view, search-bar, favorite-button
  auth/                  # incl. start-store-form.tsx (onboarding)
  cart/, checkout/ (incl. khqr-pay-panel), notifications/, inventory/

src/lib/                 # auth (incl. phone.ts, redirects.ts), supabase (incl. proxy.ts = tenant middleware),
                         #   products, orders, inventory, checkout, coupons, settings, theme (presets.ts),
                         #   i18n, notifications, security, http (request origin), constants.ts
  tenant/                # resolve.ts (host/slug → store via resolve_store RPC), context.ts (per-request store
                         #   headers), status.ts (effectiveStoreStatus mirror of SQL — no trial state)
  billing/               # plans.ts (plan codes/limits), capabilities.ts (requirePlanCapability / capacity)
  khqrpay/               # khqr.cc gateway port from AMS_APP: config, types, sign (sha1/sha256 + callback
                         #   validation), khqr-payload (EMV TLV + CRC16), status (state machine), gateway
                         #   (hosted checkout + check-transv2), credentials (per-store), webhook (ingest)
src/services/            # per-domain data services: products(-admin), orders(-admin), inventory, coupons,
                         #   payments (order payment ledger), subscription-billing, settings, admin,
                         #   notifications, stores (incl. getMyStoreId), subscriptions, platform
src/store/               # zustand stores (cart, wishlist)
src/types/               # database.ts (hand-written, incl. Views), index.ts
scripts/                 # khqr-reconcile launchd plist example

database/
  migrations/            # 0001..0048. Single-tenant base 0001..0032; multi-tenant SaaS 0033..0042
                         #   (0033 stores root, 0034 store scoping, 0035 per-store settings, 0036 seed
                         #   superadmin, 0037 billing, 0038 tenant RLS, 0039 platform finance,
                         #   0040 tenant-aware helpers, 0041 shop_categories, 0042 shipping-fee fix).
                         # Production refactor 0043..0048 (apply together with the app deploy):
                         #   0043 security hardening (C1 grants revoked/guarded, C2 profiles pinning,
                         #        trial path removed, activate_subscription_internal split)
                         #   0044 tenant-scoped admin views (ICT day buckets; drops v_best_sellers)
                         #   0045 tenant-scoped storage policies (stores/{id}/ path prefixes)
                         #   0046 loyalty dropped + CANONICAL v3 create_customer_order (no points,
                         #        p_payment_image optional/last)
                         #   0047 order payments: store_payment_settings, order_payments ledger,
                         #        payment_webhooks, service-role finalize/expire/retire/mark-cash RPCs
                         #   0048 subscription payments on khqr.cc (transaction ids, finalize RPC)
  policies/, seed/, tests/, _all_migrations.sql
```

Use:
- Reusable components
- Feature-based architecture
- Server actions where appropriate
- Clean API separation
- Strict TypeScript
- Scalable architecture

---

# PHASE 1 — PROJECT FOUNDATION

## Setup
Initialize:
- Next.js 15
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- PWA configuration
- ESLint
- Prettier

## Generate
- Folder architecture
- Theme system
- Mobile layout system
- Navigation system
- Environment setup
- Supabase client
- Authentication structure

## Requirements
- Production-ready setup
- Modular architecture
- Mobile-first foundation
- iPhone Safari optimization

---

# PHASE 2 — DATABASE ARCHITECTURE

Generate complete Supabase + PostgreSQL schema.

## TABLES

### Users
- id, role, name, email, phone, created_at

### Products
- id, name, slug, description, price, discount_price, stock, category, images, barcode, sku, featured, created_at

### Orders
- id, customer_name, phone, address, note, total, shipping_fee, payment_method, payment_image, status, created_at

### OrderItems
- id, order_id, product_id, quantity, price

### InventoryMovements
- id, product_id, barcode, movement_type, quantity, created_by, notes, created_at

### ProductInventory
- id, product_id, current_stock, minimum_stock, barcode, sku, updated_at

### Notifications
- id, title, message, type, created_at

## Requirements
Generate:
- SQL schema, Foreign keys, Indexes, RLS policies, Supabase migrations, Transaction-safe inventory logic

---

# PHASE 3 — AUTHENTICATION SYSTEM

Roles: superadmin (platform owner, store_id = NULL), admin (shop owner), staff, customer
Auth method: phone number + password (no email, no SMS provider). Each phone is mapped to a stable synthetic email `<normalized-digits>@phone.csms.app` for Supabase password auth — sign-up and sign-in must normalize the number identically (see `lib/auth/phone.ts`). No password-reset flow (removed).
Generate: Login, Register, Middleware, Route protection, Secure session handling

---

# PHASE 4 — PUBLIC STOREFRONT

Build premium mobile-first cosmetic shopping experience.

Home: Hero banner, Featured products, Categories, Promotions, Best sellers, Search bar
Categories: Skincare, Makeup, Perfume, Hair Care, Body Care
Product Detail: Product gallery, Description, Ingredients, Stock status, Related products, Quantity selector, Add to cart
Product Card: image, name, Price, Discount badge, Favorite, Add to cart

---

# PHASE 5 — CART + CHECKOUT

Cart: Update quantity, Remove item, Subtotal, Shipping fee, Final total
Checkout Form: name, phone, address, notes
Payment: KHQR, ABA, Acleda, Wing
Flow: Add → Checkout → KHQR → Upload screenshot → Submit → admin dashboard

---

# PHASE 6 — ADMIN DASHBOARD

Display: Revenue, Orders, Pending orders, Inventory alerts, Best sellers, Sales charts
Generate: Sidebar nav, Dashboard cards, Analytics charts, Responsive tables, Activity feed, Mobile admin layout

---

# PHASE 7 — PRODUCT MANAGEMENT

Full CRUD: Add/Edit/Delete, Upload images, Categories, Pricing, Discounts, Featured, Barcode generation
Generate: Product forms, Validation, Product tables, Image upload, Search/filter

---

# PHASE 8 — INVENTORY MANAGEMENT SYSTEM

Smart inventory optimized for iPhone.
Features: Stock in, Stock out, Inventory logs, Low stock alerts, Real-time updates
Dashboard: Total products, Total stock, Low stock, Out-of-stock, Movement history, Best-sellers

---

# PHASE 9 — BARCODE SCANNER SYSTEM

iPhone camera barcode scanning.
Formats: EAN-13, UPC, QR, Code128
Libraries: html5-qrcode OR zxing-js
UX: Fullscreen, Auto-focus, Vibrate on scan, Fast detection, Scanning animation, One-hand

STOCK IN: open inventory → stock in → scanner → scan → detect product → enter quantity → save
STOCK OUT: Auto on order confirm OR manual scan → quantity → confirm

---

# PHASE 10 — ORDER MANAGEMENT

Features: View orders, Update status, Confirm payments, Generate invoice, Print invoice, Shipping
Status: Pending, Payment Confirmed, Preparing, Shipping, Delivered, Cancelled

---

# PHASE 11 — NOTIFICATIONS SYSTEM

Order notifications, Inventory alerts, Promotions, Push notifications
Notification center, Real-time, Toast, Push

---

# PHASE 12 — SECURITY + PERFORMANCE

Security: Auth, Authorization, RLS, Protected admin routes, Secure uploads, API validation, Form validation, Transaction-safe inventory
Performance: iPhone Safari, Lazy loading, Image optimization, Smooth animations, PWA, Offline

---

# PHASE 13 — OPTIONAL ADVANCED

Khmer language, Wishlist, Loyalty points, Coupons, Telegram notifications, Supplier management, Multi-store, Expiration tracking, Advanced analytics

---

# PHASE 14 — MULTI-TENANT SaaS PLATFORM

The single-tenant store was transformed into a multi-tenant SaaS where many cosmetic
shops run on one deployment, each shop owner self-onboards and pays a monthly
subscription, and a platform `superadmin` oversees every store. Migrations 0033–0040.

## Tenancy model
- `stores` is the tenant root (created in 0033). Every shop owner (`admin`) owns exactly
  one store; staff and customers belong to a store via `profiles.store_id`.
- The `superadmin` (role added in 0033, seeded in 0036) has `store_id = NULL` and sits
  above all stores, bypassing tenant scoping everywhere.
- 0034 adds `store_id` to every tenant-owned table and makes formerly-global unique
  constraints (slug, sku, barcode, coupon code) **per-store**, so two shops can reuse
  the same slug/code.
- 0035 turns the singleton `store_settings` into one row per store (auto-created by
  trigger on store insert).

## Tenant resolution & routing (`src/lib/tenant/`, `src/lib/supabase/proxy.ts`)
- The middleware (`updateSession` in `proxy.ts`) resolves the incoming request to a
  store: a custom domain (Host) or a `/s/{slug}` path → `resolve_store` RPC. Platform
  hosts (localhost, `*.vercel.app`, the apex `NEXT_PUBLIC_PLATFORM_DOMAIN`) fall back to
  the **default store** so the original single-tenant shop keeps working.
- The resolved store id/slug/status is forwarded on request headers
  (`x-store-id` / `x-store-slug` / `x-store-status`); server components & actions read it
  via `getStoreContext()` (`tenant/context.ts`, cached per request).
- The superadmin area (`/superadmin`) is never store-bound.
- When a store's access has lapsed (locked/cancelled), the storefront/admin is redirected
  to `/store-unavailable`. `tenant/status.ts` (`effectiveStoreStatus`) mirrors the SQL
  `store_access_status()` so the UI can label state without a round-trip. Statuses:
  `trial | active | grace | locked | cancelled` (grace window = `GRACE_DAYS`).

## RLS & SECURITY DEFINER (0038, 0040)
- 0038 rewrites RLS on every tenant-owned table: reads/writes require
  `is_superadmin() OR (is_staff() AND store_id = current_store_id())`, keeping public
  catalog reads (active products/inventory, active coupons, store branding) open for
  anonymous storefront visitors (the app filters those by resolved store).
- 0040 makes the SECURITY DEFINER helpers store-aware so bypassing RLS stays isolated:
  `handle_new_user` (signup inherits `store_id` from metadata), `create_customer_order`
  (stamps order/items with the resolved store, scopes coupon, refuses cross-store carts),
  `apply_inventory_movement` (stamps movement, refuses cross-store adjustments).

## Subscription billing (0037/0048, `src/lib/billing/`, `src/services/subscription-billing.ts`)
- 3 plans, codes `starter | growth | pro` ($9 / $19 / $29). Each plan carries a `limits`
  jsonb (capability gates: `max_products`, `max_staff`, `coupons`, `pos`,
  `custom_domain`, `advanced_analytics`); `parsePlanLimits` coerces it and
  `lib/billing/capabilities.ts` ENFORCES it (product create, POS, coupons, custom
  domain; gated nav hidden in AdminShell). The `stores` row stays the source of truth
  for **access** (status + period dates the middleware reads);
  `activate_subscription_internal()` (0043) keeps it in sync and is superadmin/service-
  role only — owners can no longer self-activate.
- Payment: **khqr.cc hosted checkout with the PLATFORM profile** (`KHQRPAY_*` env; see
  **PAYMENTS (khqr.cc)**), settled by webhook/poll → `finalize_subscription_payment`.
  When the platform profile is unconfigured, the flow falls back to **manual screenshot
  proof + superadmin approval**. `subscription_payments` is the ledger (unique
  `SUB-…` transaction ids since 0048; `bakong_*` columns are legacy).
- Store-owner onboarding (`/start`, `actions/onboarding.ts`) is **pay-first, no free
  trial** (the trial code path was fully removed in 0043): create auth user → create
  store (service-role, since `stores` is superadmin-insert only) on the chosen plan →
  promote profile to `admin` → store starts locked → owner is sent to `/admin/billing`
  to pay before going live.

## Superadmin console (`src/app/(superadmin)/`, `services/platform.ts`)
- Pages: dashboard, stores (+ `[id]` detail), subscriptions, plans, users, finance.
- Platform finance (0039): subscription revenue (from paid `subscription_payments`)
  minus `platform_expenses` (hosting/server/other), rolled up by month/year via
  SECURITY DEFINER functions guarded by `is_superadmin()`.

## Credentials (CHANGE after first login)
- Superadmin: phone `010552223` / password `12345678` (seeded in 0036).
- Default-store admin: phone `017552223` / password `12345678` (seeded in 0030).

---

# PAYMENTS (khqr.cc) — Phase 16, migrations 0047/0048

Ported from AMS_APP's proven khqr.cc (KHQRPay) integration so both apps share one
payment architecture. khqr.cc is a **hosted-checkout** gateway (there is no headless
QR-mint API): the customer is redirected to a signed checkout URL, pays on khqr.cc,
and settlement returns via the signed webhook — with `check-transv2-khqrcc` polling
and a reconcile cron as fallbacks.

## Methods
- Customer checkout + POS offer exactly **KHQR** (dynamic, auto-verified) and
  **cash** (COD / at the till). ABA/Acleda/Wing and the screenshot upload were
  removed (enum values remain valid on historical orders; legacy `payment_image`
  screenshots still render on old orders).

## Data model (0047/0048)
- `store_payment_settings` — per-store khqr.cc `profile_id` + `secret` (entered in
  Admin → Settings; RLS with NO policies, service-role only, secret is write-only).
- `order_payments` — per-order ledger (khqr + cash), state machine
  `pending → qr_generated → waiting_payment → paid → refunded` (failed/expired/
  cancelled/rejected terminal), unique `transaction_id` (`ORD-…`), unguessable
  `public_token` for customer URLs, one PAID payment per order (unique index).
- `payment_webhooks` — audit of every delivery; unique `event_id` = replay idempotency.
- `subscription_payments` gained the same columns (`SUB-…` ids) in 0048.

## Flows
- **Checkout (khqr)**: `create_customer_order` (order stays `pending`) → mint payment
  (`services/payments.ts`) → customer lands on `/checkout/pay/[token]` (QR in demo,
  "Pay with KHQR" hosted-checkout link live; 4s poll of `/api/khqr/status/[token]`) →
  webhook/poll → `finalize_order_payment` RPC (row-locked, transition-guarded) flips
  the order to `payment_confirmed` → the 0007/0024 trigger deducts stock. Expired
  links re-mint via "Get a new payment link" (old attempts retired first).
- **COD**: order `pending` + pending cash payment row → staff process/deliver →
  "Mark cash paid" (Payments page or order detail) stamps cashier + `paid_at` and
  confirms a still-pending order through the same finalize path.
- **POS**: cash sales are confirmed immediately + a `paid` cash payment row (cashier
  stamped); khqr sales keep the order pending and show the QR panel in a dialog —
  settlement confirms the order (no manual status flip).
- **Webhook** `/api/khqr/webhook`: signature-authenticated (sha256 over
  `secret+req_time+transaction_id+amount+STATUS`), 3 guards before booking money —
  event_id idempotency, req_time freshness, signature+amount+currency vs the exact
  row (store secret for ORD-*, platform secret for SUB-*). A settled payment whose
  order can't confirm (insufficient stock) is kept open, marked `ignored` on the
  webhook, Telegram-alerted, and retried by the cron.
- **Reconcile** `/api/khqr/reconcile` (Bearer `KHQR_RECONCILE_SECRET`): sweeps open
  order + subscription payments every ~5 min (launchd plist example in `scripts/`).
- **Demo mode** (`KHQRPAY_DEMO=true`, dev-only, force-off in production): locally
  built EMV KHQR payloads (`lib/khqrpay/khqr-payload.ts`, CRC-16/CCITT-FALSE) rendered
  with `qrcode`, auto-confirm ~8s after mint — the full flow works with no gateway.

## Invariants (enforced in SQL, mirrored in `lib/khqrpay/status.ts`)
- One order = one settled payment; duplicate transaction ids impossible (unique);
  webhook replays acked without re-finalizing; finalize is idempotent under a row
  lock; a "paid" whose amount/currency mismatch the row never settles it.

---

# DEPLOYMENT & INFRASTRUCTURE

## Production serving (Mac mini)

- launchd service `com.minimaldigital.smartsell` runs `next start` on 127.0.0.1:3000 from
  `~/Smart_sell`; logs in `~/Smart_sell/logs/`. Deploy with `./deploy.sh` (git pull → npm
  install → build → restart → health check).
- Published via Cloudflare Tunnel (`~/.cloudflared/config.yml`, service
  `com.minimaldigital.cloudflared`): `smartsell.minimaldigital.dev` → localhost:3000. The
  subdomain resolves to the default store because it is set as that store's
  `custom_domain` in the DB (not via `NEXT_PUBLIC_PLATFORM_DOMAIN`, which is the apex
  `minimaldigital.dev`).
- Port 8000 on this machine belongs to an unrelated Laravel app (`ams.minimaldigital.dev`)
  — do not reuse it.
- **Build quirk:** this network's IPv6 route to Google is broken, which hangs `next/font`'s
  Google Fonts download. Always build with `NODE_OPTIONS="--dns-result-order=ipv4first"`
  (already baked into `deploy.sh`).
- `.env.local` (untracked) needs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (now REQUIRED — payment RPCs run through the service
  client), `NEXT_PUBLIC_APP_URL=https://smartsell.minimaldigital.dev`,
  `NEXT_PUBLIC_PLATFORM_DOMAIN=minimaldigital.dev`, `KHQR_RECONCILE_SECRET`; optional
  `TELEGRAM_*` and `KHQRPAY_*` (platform khqr.cc profile for subscription billing —
  manual-proof fallback when unset). See `.env.example`.
- **KHQR reconcile cron**: install
  `scripts/com.minimaldigital.smartsell.khqr-reconcile.plist.example` as a launchd
  agent (300s interval, curls `/api/khqr/reconcile` with the bearer secret).
- khqr.cc profiles must set their **Global Webhook URL** to
  `https://smartsell.minimaldigital.dev/api/khqr/webhook` (per-store merchant
  profiles and the platform profile alike).

## Phase 15 — self-hosted Supabase (in progress, 2026-07-08)
Goal: replace Supabase cloud with a self-hosted Supabase stack on the same Mac mini.
The app is unchanged — only `.env.local` values swap.

- Runtime: Colima VM (4 CPU / 6 GB) + Docker CLI; stack at `~/supabase-selfhost/docker`
  (official supabase/supabase docker compose, `supabase/postgres` 17), fresh secrets in
  its own `.env` (dashboard user `supabase`).
- Kong gateway on host port **8100** (8000 taken, see above); will be published as
  `https://supabase.minimaldigital.dev` via the existing Cloudflare tunnel.
- Auth config: `ENABLE_EMAIL_AUTOCONFIRM=true` (phone auth uses synthetic
  `@phone.csms.app` emails, no SMTP), `SITE_URL=https://smartsell.minimaldigital.dev`.
- Storage objects already mirrored from cloud to `~/supabase-selfhost/storage-mirror`
  (buckets: product-images, payment-proofs, movement-proofs, branding).
- Remaining steps: `pg_dump` the cloud DB via session pooler (**blocked: needs the DB
  password from the owner**) → restore into local stack → upload storage mirror →
  point `.env.local` at the new URL/keys → add tunnel ingress + DNS for
  `supabase.minimaldigital.dev` → rebuild, restart, verify → decommission cloud project.

---

# CODE QUALITY RULES

- Strict TypeScript
- Reusable components
- No duplicated logic
- Clean modular architecture
- Server actions where appropriate
- Production-ready quality

# UI STANDARDS

- iPhone first
- Smooth animations
- Large touch targets
- Clean spacing
- Premium consistency
- Fast interactions

# AI EXECUTION RULE

Work phase-by-phase. Never skip:
1. Architecture planning
2. Folder structure
3. Data flow explanation
4. Production-ready implementation
