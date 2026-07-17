# 05 — AI Change Log

_Backfilled from `git log` on 2026-07-13, then intended to be appended to going
forward whenever an AI-assisted session makes a non-trivial change. Newest first.
Each entry: date, commit(s), what changed, why it mattered._

## How to maintain this file

Add an entry after any AI-assisted session that changes behavior, schema, or
architecture (not for pure formatting/typo fixes). Keep entries to 2-4 lines:
what changed, and the reason if it's not obvious from the diff. Link to the relevant
migration number or `CLAUDE.md` phase where useful.

---

## 2026-07-17 — Phase 16: production refactor + khqr.cc payments (migrations 0043–0048)

Uncommitted at time of writing. The full production-readiness refactor driven by
`docs/07_PRODUCTION_READINESS_AUDIT.md` plus the payment-platform replacement:

- **Security (0043–0045)**: C1 SECURITY DEFINER grants revoked/guarded
  (`activate_subscription` superadmin/service-only + idempotent, staff-only
  `apply_inventory_movement`, trigger-only helpers, dead RPCs dropped); C2 profiles
  `role`/`store_id` pinned by trigger; C3 admin services/views/storage tenant-scoped
  (`getMyStoreId()` filters, store-prefixed storage paths, ICT sales buckets);
  C5 inbound `x-store-*` headers stripped in middleware; H3/H4/H8/H10 fixed.
- **Plan gating (H1)**: `lib/billing/capabilities.ts` enforces max_products / pos /
  coupons / custom_domain; gated nav hidden.
- **Loyalty removed (0046)**: exploit-prone global wallet deleted end-to-end;
  `create_customer_order` rewritten as the single CANONICAL v3 definition.
- **Trial path removed (0043)**: pay-first only; `platform_summary` reports
  total_stores instead of trial_stores.
- **khqr.cc payments (0047/0048)**: AMS_APP's KHQRPay architecture ported —
  `store_payment_settings`, `order_payments` ledger + state machine,
  `payment_webhooks`, signature-authed webhook, status poll, reconcile cron,
  hosted checkout + demo mode; checkout/POS methods reduced to KHQR + cash;
  screenshot upload and `lib/bakong` (official Bakong API) removed; subscriptions
  settle through the same gateway with the platform profile.
- **Testing/quality**: Vitest bootstrapped (38 unit tests: money math, transitions,
  redirects, plan limits, CRC16/TLV, signing, webhook validation, state machine);
  `types/database.ts` gained Views + payment tables; `as never` view casts removed;
  fixed a 1-cent preview/charge divergence in `computeDiscount` rounding.

**Deploy note: migrations 0043–0048 and this app build MUST ship together**
(`create_customer_order` signature changed; loyalty RPCs dropped).

## 2026-07-13 — Project rename

`f870ba9` Renamed project from its working name to `smart_sell` to match the GitHub
repository name. No functional change.

## 2026-07-08 — CLAUDE.md authored

`9ee5838` Authored the master `CLAUDE.md` spec: full phase plan (1–15), tech stack,
design system, project structure, and the Phase 15 self-hosted Supabase migration
plan. This is the canonical spec document; these `docs/0X_*` files summarize and
cross-reference it rather than duplicating it.

## 2026-07-01 — Git housekeeping

`3f15be7` Repo/git configuration cleanup, no feature change.

## 2026-06-29 — Shop categories + sub-path deploy support

`146b969` Added manual, per-store product categories (Settings → Shop Categories),
replacing the fixed `product_category` enum as the catalog's source of truth
(migration `0041_shop_categories.sql`). Products gained `category_id`; the legacy enum
column stays for back-compat. See [02_DATABASE_DESIGN.md](02_DATABASE_DESIGN.md).

`97c6689` Added `NEXT_PUBLIC_BASE_PATH` sub-path hosting support and moved the dev
server to port 3001 (needed for HTTPS + camera access during barcode-scanner
development).

`6a39fd4` Deploy commit — production rollout of the above.

`c1a8c89` Fixed superadmin/admin route resolution bugs surfaced after the
multi-tenant split (Phase 14).

## 2026-06-07 — Multi-tenant SaaS platform (Phase 14) + phone auth

`dcefe32` Introduced the `superadmin` role and `stores` tenant root — the
foundational change for turning the single-tenant app into a multi-tenant SaaS
platform (migrations `0033`–`0040`: per-store scoping, tenant-aware RLS, subscription
billing, superadmin console). See [04_BUSINESS_RULES.md](04_BUSINESS_RULES.md) and
`CLAUDE.md` § MULTI-TENANT SaaS PLATFORM.

`8d5f8f3`, `9d61a21` Bug fixes and route corrections following the multi-tenant
rollout.

`31d7286` Switched authentication from email to **phone number + password**, using
the synthetic-email mapping described in [04_BUSINESS_RULES.md](04_BUSINESS_RULES.md)
— this is why there is no password-reset flow (a phone number can't receive a reset
link without an SMS provider).

`f8a364f` Follow-up bug fixes for the phone-auth switch.

## 2026-06-02 — Initial build-out (Phases 1–13)

`e2a1587` Built out the Cosmetic Store Management System through Phase 13: project
foundation, database schema, phone/email auth scaffolding, public storefront, cart +
checkout, admin dashboard, product/inventory management, barcode scanner, order
management, notifications, security/performance hardening, and the Phase 13 optional
extras (coupons, wishlist, Khmer i18n, POS, Telegram notifications, loyalty points,
store settings/branding). This is the single largest commit in the repo's history —
effectively the MVP.

`7ec8699` First commit of actual project content (post scaffold).

## 2026-05-16 — Scaffold

`70d08f1` Initial commit from `create-next-app`.
