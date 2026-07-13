# 03 — Feature Roadmap

_Status reflects code present in the repo as of 2026-07-13, not necessarily
QA-verified. This mirrors and supersedes the phase table in `CLAUDE.md` — update both
when phase status changes._

## Phase status

| Phase | Area | Status |
|---|---|---|
| 1 | Project Foundation (Next.js 15→16, TS, Tailwind, shadcn, Supabase, PWA, ESLint, Prettier) | ✅ Done |
| 2 | Database Architecture (schema, migrations, policies, seed, tests) | ✅ Done |
| 3 | Authentication — phone + password, synthetic email mapping, roles | ✅ Done |
| 4 | Public Storefront (shop, category, product, search, account, wishlist) | ✅ Done |
| 5 | Cart + Checkout (cart, checkout, success page, KHQR upload) | ✅ Done |
| 6 | Admin Dashboard (layout, dashboard, sidebar) | ✅ Done |
| 7 | Product Management (CRUD, new/edit) | ✅ Done |
| 8 | Inventory Management (inventory, movements, products) | ✅ Done |
| 9 | Barcode Scanner (`html5-qrcode`) | ✅ Done |
| 10 | Order Management (orders, print invoice) | ✅ Done |
| 11 | Notifications (admin + shop) | ✅ Done |
| 12 | Security + Performance (lib/security, PWA, offline, sw.js) | ✅ Done |
| 13 | Optional Advanced | 🟡 Partial (see below) |
| 14 | Multi-tenant SaaS Platform | ✅ Done |
| 15 | Self-hosted Supabase migration | 🟡 In progress — blocked (see [06_KNOWN_ISSUES.md](06_KNOWN_ISSUES.md)) |

## Phase 13 detail — Optional Advanced

Done:
- Coupons (admin CRUD + checkout redeem)
- Wishlist
- Khmer i18n
- POS (cash payment method + `admin/pos`)
- Telegram notification helper (best-effort, env-gated)
- Loyalty points (earn on delivered, redeem at checkout)
- Store settings + branding/theme (6 curated presets)
- Multi-store (graduated into full Phase 14)
- **Shop categories** (admin-managed per-store categories, replacing the fixed enum — added since last CLAUDE.md sync, not yet reflected there; migration `0041`)

Pending:
- Supplier management
- Expiration tracking
- Advanced analytics (a `advanced_analytics` capability flag already exists on
  subscription plan limits — see `src/lib/billing/plans.ts` — but no UI/feature
  consumes it yet)

## Default continuation point

When asked to "continue" with no further specifics, default to the Phase 13 pending
items above (supplier management, expiration tracking, advanced analytics) unless the
user directs otherwise — this matches the standing instruction in `CLAUDE.md`.

## Near-term priorities (suggested, not committed)

1. Unblock Phase 15 (self-hosted Supabase) — needs the cloud DB password from the
   store owner to run `pg_dump`.
2. Reconcile the `TRIAL_DAYS = 14` constant in `src/lib/constants.ts` against the
   documented "pay-first, no trial" onboarding flow (see
   [06_KNOWN_ISSUES.md](06_KNOWN_ISSUES.md)).
3. Build a UI for the `advanced_analytics` plan gate now that the flag exists but is
   unused.
