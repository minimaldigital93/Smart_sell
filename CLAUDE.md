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

Last updated: 2026-06-07 (multi-tenant SaaS transformation: platform `superadmin` role, per-store tenancy, subscription billing via Bakong KHQR, platform finance; migrations 0031–0040). Status reflects code present in the repo, not necessarily QA-verified.

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
| 13 | Optional Advanced — done: coupons (admin CRUD + checkout redeem), wishlist, Khmer i18n, POS (cash payment method + admin/pos), Telegram helper (`lib/notifications/telegram.ts`, best-effort, env-gated), loyalty points (earn on delivered, redeem at checkout — `lib/loyalty`, `services/loyalty.ts`, `actions/loyalty.ts`, migration 0020), store settings + branding/theme (per-store `store_settings`, admin/settings page, `lib/settings`, `services/settings.ts`, `actions/settings.ts`, 6 curated theme presets in `lib/theme/presets.ts`, `branding` storage bucket, migrations 0028/0035), **multi-store** (see Phase 14). Pending: supplier management, expiration tracking, advanced analytics. | 🟡 Partial |
| 14 | **Multi-tenant SaaS Platform** — superadmin role + `stores` tenant root; per-store scoping on every table with per-store unique slug/sku/barcode/coupon; tenant-aware RLS + SECURITY DEFINER helpers; subscription billing (3 plans, Bakong KHQR or manual proof); store-owner onboarding (pay-first, no trial); custom domain / `/s/{slug}` routing; superadmin console (stores, subscriptions, plans, users, finance); platform finance (subscription revenue − platform expenses). Migrations 0033–0040. See **MULTI-TENANT SaaS PLATFORM** section. | ✅ Done |

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
  (admin)/admin/         # dashboard, products, inventory, orders, scan, coupons, pos, notifications, settings, billing
  (superadmin)/superadmin/ # platform console: stores (+[id]), subscriptions, plans, users, finance
  (auth)/                # login, register, start (store-owner onboarding); phone + password, no reset-password
  (shop)/                # shop, category, product, search, cart, checkout, wishlist, account, orders, notifications
  store-unavailable/     # shown when a tenant store is locked/cancelled (billing lapsed)
  actions/               # server actions: auth, products, orders, inventory, scan, coupons, pos, loyalty,
                         #   notifications, settings, onboarding, subscriptions, superadmin, expenses, domain
  api/health/            # health check route
  auth/                  # supabase auth callback / sign-out
  print/orders/[id]/     # printable invoice
  offline/, manifest.ts  # PWA
  layout.tsx, globals.css

src/components/
  ui/                    # shadcn primitives
  shared/                # cross-feature widgets (incl. brand.tsx, back-button.tsx)
  admin/                 # admin-shell, kpi-card, sales-chart, products/orders/inventory/scanner/coupons/pos/settings
  superadmin/            # store-actions, payment-actions, user-role-select, pnl-table, expense-form/-delete
  billing/               # billing-client, khqr-display, manual-proof-form (store subscription checkout)
  settings/              # custom-domain (per-store custom domain config)
  shop/                  # product-card, gallery, cart, wishlist-view, search-bar, favorite-button
  auth/                  # incl. start-store-form.tsx (onboarding)
  cart/, checkout/, notifications/, inventory/

src/lib/                 # auth (incl. phone.ts), supabase (incl. proxy.ts = tenant-resolving middleware),
                         #   products, orders, inventory, checkout, coupons, loyalty, settings, theme (presets.ts),
                         #   i18n, notifications, security, constants.ts (store status, plan/grace constants)
  tenant/                # resolve.ts (host/slug → store via resolve_store RPC), context.ts (per-request store
                         #   headers), status.ts (effectiveStoreStatus mirror of SQL)
  billing/               # plans.ts (plan codes starter/growth/pro, capability gates / limits)
  bakong/                # config.ts (env-gated), khqr.ts (KHQR string), verify.ts (Bakong API check)
src/services/            # per-domain data services: products(-admin), orders(-admin), inventory, coupons,
                         #   loyalty, settings, admin, notifications, stores, subscriptions, platform
src/hooks/  src/store/   # zustand + react-query glue
src/types/               # database.ts, index.ts, bakong-khqr.d.ts
src/utils/

database/
  migrations/            # 0001..0040. Single-tenant base 0001..0032 (extensions, profiles, products+inventory,
                         #   orders, movements, notifications, functions/triggers, RLS, realtime, ingredients,
                         #   storage buckets, admin views, coupons, POS cash, loyalty, audit fixes 0021..0027,
                         #   store_settings+branding 0028, phone-auth 0029, seed admin 0030,
                         #   store shipping fee in checkout 0031, product marketing flags 0032).
                         # Multi-tenant SaaS 0033..0040:
                         #   0033 superadmin role + stores tenant root
                         #   0034 store_id on every tenant table + per-store unique slug/sku/barcode/code
                         #   0035 store_settings → per-store rows (auto-created per store)
                         #   0036 seed superadmin (010552223 / 12345678)
                         #   0037 billing: subscription_plans, store subscriptions, subscription_payments
                         #   0038 tenant-aware RLS on every table (superadmin bypasses)
                         #   0039 platform finance: platform_expenses + superadmin P&L rollups
                         #   0040 tenant-aware SECURITY DEFINER helpers (handle_new_user,
                         #        create_customer_order, apply_inventory_movement)
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

## Subscription billing (0037, `src/lib/billing/`, `src/lib/bakong/`)
- 3 plans, codes `starter | growth | pro` ($9 / $19 / $29). Each plan carries a `limits`
  jsonb (capability gates: `max_products`, `max_staff`, `coupons`, `loyalty`, `pos`,
  `custom_domain`, `advanced_analytics`); `parsePlanLimits` coerces it. The `stores` row
  stays the source of truth for **access** (status + period dates the middleware reads);
  `activate_subscription()` keeps it in sync.
- Payment: **Bakong KHQR** (env-gated via `lib/bakong/config.ts` — `BAKONG_ACCOUNT_ID`,
  `BAKONG_MERCHANT_NAME`, `BAKONG_API_TOKEN`, optional city/base). When Bakong is
  unconfigured, the flow falls back to **manual screenshot proof + superadmin approval**
  (same pattern as the Telegram helper). `subscription_payments` is the ledger.
- Store-owner onboarding (`/start`, `actions/onboarding.ts`) is **pay-first, no free
  trial**: create auth user → create store (service-role, since `stores` is
  superadmin-insert only) on the chosen plan → promote profile to `admin` → store starts
  locked → owner is sent to `/admin/billing` to pay before going live.

## Superadmin console (`src/app/(superadmin)/`, `services/platform.ts`)
- Pages: dashboard, stores (+ `[id]` detail), subscriptions, plans, users, finance.
- Platform finance (0039): subscription revenue (from paid `subscription_payments`)
  minus `platform_expenses` (hosting/server/other), rolled up by month/year via
  SECURITY DEFINER functions guarded by `is_superadmin()`.

## Credentials (CHANGE after first login)
- Superadmin: phone `010552223` / password `12345678` (seeded in 0036).
- Default-store admin: phone `017552223` / password `12345678` (seeded in 0030).

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
