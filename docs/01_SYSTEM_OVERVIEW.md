# 01 — System Overview

_Last synced with codebase: 2026-07-13._

## What this is

**Smart Sell** (working title in code: `smart_sell`; product name in spec: Cosmetic
Store Management System / CSMS) is a mobile-first, Apple-inspired SaaS platform for
cosmetic shops in Cambodia. It has grown from a single-tenant storefront + admin app
into a **multi-tenant SaaS platform**: many shops run on one deployment, each shop
owner self-onboards and pays a monthly subscription, and a platform `superadmin`
oversees every store from a separate console.

Core capabilities:
- Public storefront (browse, search, cart, checkout, wishlist, loyalty)
- Admin dashboard per store (products, inventory, orders, POS, coupons, settings)
- Barcode-driven inventory management (stock in/out via camera scan)
- KHQR / Bakong payment flow for both customer checkout and store subscription billing
- Superadmin console for managing stores, subscriptions, plans, users, and platform P&L

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4, shadcn/ui, Framer Motion |
| Backend | Supabase (Postgres 17, Auth, Storage, Realtime) |
| State/data | zustand, TanStack Query, react-hook-form + zod |
| Domain libs | `html5-qrcode` (barcode scanning), `bakong-khqr` + `qrcode` (KHQR payments), `date-fns` |
| PWA | manifest + service worker, offline page, iPhone Safari optimizations |

Dev server runs on HTTPS locally (`next dev --experimental-https`) on port **3001**
(see `package.json`), since camera access for barcode scanning requires a secure
context.

## Tenancy model

- `stores` is the tenant root. Every shop owner (`admin`) owns exactly one store;
  staff and customers belong to a store via `profiles.store_id`.
- `superadmin` has `store_id = NULL` and sits above all stores, bypassing tenant
  scoping in RLS and in the SECURITY DEFINER helper functions.
- Formerly-global unique constraints (slug, SKU, barcode, coupon code, category
  slug/name) are **per-store**, so two shops can reuse the same values.
- Tenant resolution happens in middleware (`src/lib/supabase/proxy.ts`): a custom
  domain (Host header) or a `/s/{slug}` path resolves to a store via the
  `resolve_store` RPC. Platform hosts (localhost, `*.vercel.app`, the apex domain)
  fall back to a reserved **default store** (slug `default`) so the original
  single-tenant shop keeps working. The resolved store is forwarded on request
  headers (`x-store-id` / `x-store-slug` / `x-store-status`) and read server-side via
  `getStoreContext()`.

See [04_BUSINESS_RULES.md](04_BUSINESS_RULES.md) for roles, billing, and lifecycle
rules, and [02_DATABASE_DESIGN.md](02_DATABASE_DESIGN.md) for the schema.

## High-level architecture

```
Browser (iPhone Safari / PWA)
  → Next.js App Router
      (shop)        — public storefront, cart, checkout, account
      (admin)       — per-store admin dashboard
      (superadmin)  — platform console (store-agnostic)
      (auth)        — phone+password login/register, store-owner onboarding (/start)
  → src/actions/*   — server actions (mutations), grouped by domain
  → src/services/*  — data-access layer (Supabase queries), one file per domain
  → src/lib/*       — cross-cutting: auth, tenant resolution, billing, bakong,
                       security, theming, i18n, notifications
  → Supabase        — Postgres (RLS-enforced), Auth (phone via synthetic email),
                       Storage (product/branding/payment-proof/movement-proof buckets),
                       Realtime (orders, inventory, notifications)
```

Route groups map directly to the three audiences of the app: shoppers, store staff,
and the platform operator. Each has its own layout and is protected by middleware +
RLS, not just client-side checks.

## Design system

Apple-inspired: white background, soft pink/nude accents, large rounded corners, soft
shadows, smooth Framer Motion transitions, large touch targets, one-hand iPhone
ergonomics, sticky mobile navigation. Per-store branding (logo, tagline, theme
preset, currency, shipping fee) is configurable via `store_settings` and 6 curated
theme presets (`src/lib/theme/presets.ts`).

## Deployment

Production runs on a Mac mini via `launchd` (`next start` on 127.0.0.1:3000),
published through a Cloudflare Tunnel at `smartsell.minimaldigital.dev`. Full
infrastructure detail — including the in-progress migration off Supabase cloud to a
self-hosted Supabase stack — lives in `CLAUDE.md` under **DEPLOYMENT &
INFRASTRUCTURE**, and current blockers are tracked in
[06_KNOWN_ISSUES.md](06_KNOWN_ISSUES.md).

## Where to look next

| Question | Doc |
|---|---|
| What tables exist and how do they relate? | [02_DATABASE_DESIGN.md](02_DATABASE_DESIGN.md) |
| What's built, what's next? | [03_FEATURE_ROADMAP.md](03_FEATURE_ROADMAP.md) |
| What are the rules of the domain (roles, billing, inventory, orders)? | [04_BUSINESS_RULES.md](04_BUSINESS_RULES.md) |
| What has changed recently? | [05_AI_CHANGE_LOG.md](05_AI_CHANGE_LOG.md) |
| What's broken or unresolved? | [06_KNOWN_ISSUES.md](06_KNOWN_ISSUES.md) |
| Full phase-by-phase spec, dev rules, credentials | `CLAUDE.md` (repo root) |
