# 06 — Known Issues

_Compiled 2026-07-13 by reading the current codebase, not just `CLAUDE.md`. Updated
2026-07-17 after the Phase 16 refactor (migrations 0043–0048). Update this file as
issues are fixed or new ones are found — don't let it go stale._

## Blocking

### Phase 15 self-hosted Supabase migration is stalled
The self-hosted Supabase stack on the Mac mini (`~/supabase-selfhost/docker`) is
configured and storage is already mirrored, but the migration cannot proceed because
`pg_dump` of the cloud database (project `tpqyzuudllxdwqyurdfi`) requires the
**owner's database password**, which has not been provided. Everything downstream
(restore → repoint `.env.local` → tunnel cutover → decommission cloud project) is
blocked on this one credential. See `CLAUDE.md` § DEPLOYMENT & INFRASTRUCTURE for the
full remaining checklist.

## Deploy coupling (Phase 16)

### Migrations 0043–0048 must ship WITH the matching app build
`create_customer_order` changed signature (points removed, `p_payment_image`
optional/last), loyalty RPCs were dropped, and payment processing requires
`SUPABASE_SERVICE_ROLE_KEY` + the new `order_payments` schema. An app build from
before Phase 16 running against a post-0046 database (or vice versa) breaks
checkout. Deploy via `deploy.sh` immediately after applying the migrations.

## Residual gaps accepted in Phase 16 (documented, not fixed)

- **No stock reservation between order placement and confirmation (audit H5).**
  A settled KHQR payment whose order can't confirm (stock sold in between) stays
  open: the webhook is marked `ignored`, staff get a Telegram alert, and the
  reconcile cron retries. Recovery (refund) is manual.
- **Rate limits are app-side only (audit M12).** RPCs granted to `anon`
  (`create_customer_order`) remain callable via PostgREST directly, skipping the
  app-layer limiter.
- **Default seeded credentials (audit C6) kept** per the owner's documented
  decision — rotate before onboarding real store owners.
- **Legacy flat storage paths** (product images, logos, movement proofs uploaded
  before 0045) stay readable but can no longer be overwritten; new uploads use
  `stores/{store_id}/…` prefixes.

## Dead code / inconsistency

### ~~Vestigial "trial" status path~~ — FIXED in Phase 16
Resolved 2026-07-17 (option a): migration 0043 removed `start_store_trial`, the
`trialing` default, and the trial branch of `store_access_status()`;
`TRIAL_DAYS`, the `trial` status literal, and the trial badge are gone from
`src/`. The platform is pay-first, period.

### `database/schema.sql` is stale and will mislead anyone who reads it first
It only concatenates migrations `0001`–`0009` (the original Phase 2 single-tenant
base schema) and predates `stores`, billing, coupons, loyalty, store settings, and
shop categories entirely. `database/README.md` still describes it as "all migrations
concatenated." Anyone applying `schema.sql` to a fresh database would get a
pre-multi-tenant schema with 7 tables instead of the current ~15.
**Suggested resolution:** regenerate `schema.sql` from all 41 migrations (or add a
build step that does so), or update `database/README.md` to stop claiming it's
current and point at the migrations folder instead.

### `CLAUDE.md` phase table doesn't mention shop categories
Migration `0041_shop_categories.sql` and its admin UI (Settings → Shop Categories,
commit `146b969`) exist in the repo but aren't listed under Phase 13 in `CLAUDE.md`'s
progress table (only reflected here in
[03_FEATURE_ROADMAP.md](03_FEATURE_ROADMAP.md)). Not a functional bug, just a spec
doc lagging the code — worth folding into `CLAUDE.md` next time it's touched.

## Unverified / needs QA

Per `CLAUDE.md`'s own status note, phase completion reflects **code present**, not
QA-verified behavior. In particular, flag these for manual verification before
relying on them:
- End-to-end khqr.cc settlement against the LIVE gateway (webhook delivery to
  `/api/khqr/webhook`, `check-transv2-khqrcc` polling, hosted-checkout redirect) —
  Phase 16 was verified in demo mode + unit tests only; the signing/endpoints are a
  byte-for-byte port of the working AMS_APP integration but have not yet been
  exercised with a real khqr.cc profile from this app.
- Cross-store isolation under RLS for staff accounts specifically — Phase 16 added
  explicit store filters everywhere, but a penetration-style multi-tenant test per
  [04_BUSINESS_RULES.md](04_BUSINESS_RULES.md) is still pending.
- The `advanced_analytics` plan capability flag exists in
  `src/lib/billing/plans.ts` but has no consuming feature yet — confirm it isn't
  silently gating something unrelated.
- Migrations 0043–0048 were written against the migration files (no local Postgres
  in the dev loop) — run them in the Supabase SQL editor in order and watch for
  errors before deploying the app build.

## Not yet built (tracked in roadmap, not bugs)

Supplier management, expiration tracking, and advanced analytics remain unbuilt —
see [03_FEATURE_ROADMAP.md](03_FEATURE_ROADMAP.md) for the full pending list. Listed
here only for cross-reference; do not duplicate roadmap items as "issues."
