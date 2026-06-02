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

Last updated: 2026-05-23 (Phase 13 row + project structure refreshed against repo; loyalty points landed). Status reflects code present in the repo, not necessarily QA-verified.

| Phase | Area | Status |
|-------|------|--------|
| 1 | Project Foundation (Next.js 15, TS, Tailwind, shadcn, Supabase, PWA, ESLint, Prettier) | ✅ Done |
| 2 | Database Architecture (schema.sql, migrations/, policies/, seed/, tests/) | ✅ Done |
| 3 | Authentication (login, register, reset-password, callback, sign-out, lib/auth) | ✅ Done |
| 4 | Public Storefront (shop, category, product, search, account, wishlist) | ✅ Done |
| 5 | Cart + Checkout (cart, checkout, success page, KHQR upload) | ✅ Done |
| 6 | Admin Dashboard (admin layout, dashboard, sidebar) | ✅ Done |
| 7 | Product Management (admin/products CRUD, new/edit) | ✅ Done |
| 8 | Inventory Management (admin/inventory, movements, products) | ✅ Done |
| 9 | Barcode Scanner (admin/scan, html5-qrcode, components/admin/scanner) | ✅ Done |
| 10 | Order Management (admin/orders, print/orders/[id]) | ✅ Done |
| 11 | Notifications (admin + shop notifications, components/notifications) | ✅ Done |
| 12 | Security + Performance (lib/security, PWA manifest, offline page, sw.js) | ✅ Done |
| 13 | Optional Advanced — done: coupons (admin CRUD + checkout redeem), wishlist, Khmer i18n, POS (cash payment method + admin/pos), Telegram helper (`lib/notifications/telegram.ts`, best-effort, env-gated), loyalty points (earn on delivered, redeem at checkout — `lib/loyalty`, `services/loyalty.ts`, `actions/loyalty.ts`, migration 0020). Pending: supplier management, multi-store, expiration tracking, advanced analytics. | 🟡 Partial |

When asked to "continue", default to Phase 13 remaining items unless the user specifies otherwise.

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
  (admin)/admin/         # dashboard, products, inventory, orders, scan, coupons, pos, notifications
  (auth)/                # login, register, reset-password
  (shop)/                # shop, category, product, search, cart, checkout, wishlist, account, orders, notifications
  actions/               # server actions: auth, products, orders, inventory, scan, coupons, pos, loyalty, notifications
  api/health/            # health check route
  auth/                  # supabase auth callback / sign-out
  print/orders/[id]/     # printable invoice
  offline/, manifest.ts  # PWA
  layout.tsx, globals.css

src/components/
  ui/                    # shadcn primitives
  shared/                # cross-feature widgets
  admin/                 # admin-shell, kpi-card, sales-chart, products/orders/inventory/scanner/coupons/pos
  shop/                  # product-card, gallery, cart, wishlist-view, search-bar, favorite-button
  auth/, cart/, checkout/, notifications/, inventory/

src/lib/                 # auth, supabase, products, orders, inventory, checkout, coupons, loyalty, i18n, notifications, security
src/services/            # client/server data services per domain (incl. loyalty.ts)
src/hooks/  src/store/   # zustand + react-query glue
src/types/  src/utils/
src/proxy.ts             # supabase client proxy

database/
  migrations/            # 0001..0021 (extensions, profiles, products+inventory, orders, movements,
                         #   notifications, functions/triggers, RLS, realtime, ingredients,
                         #   payment-proofs bucket, admin views, product-images bucket,
                         #   notifications audience+triggers, coupons, movement barcode-proofs+bucket,
                         #   payment_method='cash' for POS, loyalty points,
                         #   drop ambiguous apply_inventory_movement overload)
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

Roles: admin, staff, customer
Generate: Login, Register, Password reset, Middleware, Route protection, Secure session handling

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
