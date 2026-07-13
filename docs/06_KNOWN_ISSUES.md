# 06 — Known Issues

_Compiled 2026-07-13 by reading the current codebase, not just `CLAUDE.md`. Update
this file as issues are fixed or new ones are found — don't let it go stale._

## Blocking

### Phase 15 self-hosted Supabase migration is stalled
The self-hosted Supabase stack on the Mac mini (`~/supabase-selfhost/docker`) is
configured and storage is already mirrored, but the migration cannot proceed because
`pg_dump` of the cloud database (project `tpqyzuudllxdwqyurdfi`) requires the
**owner's database password**, which has not been provided. Everything downstream
(restore → repoint `.env.local` → tunnel cutover → decommission cloud project) is
blocked on this one credential. See `CLAUDE.md` § DEPLOYMENT & INFRASTRUCTURE for the
full remaining checklist.

## Dead code / inconsistency

### Vestigial "trial" status path contradicts the documented pay-first onboarding
- `src/lib/constants.ts:53` defines `TRIAL_DAYS = 14`, but it is **never referenced
  anywhere else in `src/`** (only its own definition).
- `src/app/actions/onboarding.ts` explicitly implements "no free trial": new stores
  are created with `status: "locked"` and `trial_ends_at` is never set, then the
  owner is routed straight to `/admin/billing`.
- `src/lib/tenant/status.ts` (`effectiveStoreStatus`) still contains a live `trial`
  branch that returns `"trial"` when `trial_ends_at` is in the future — but since
  onboarding never sets that column, this branch is currently unreachable in
  practice, and the `trial` badge tone (`STATUS_TONE.trial`) is dead UI.
- `subscriptions.status` (migration `0037_billing.sql`) still defaults to
  `'trialing'`.
- **Impact:** low risk today (the branch is simply unreachable), but it's a trap for
  future changes — anyone who later re-introduces trial-granting logic will find
  half the plumbing already exists and half doesn't, and it's easy to wire it up
  inconsistently with the "pay-first" model documented in `CLAUDE.md` §
  MULTI-TENANT SaaS PLATFORM and [04_BUSINESS_RULES.md](04_BUSINESS_RULES.md).
- **Suggested resolution:** either (a) fully remove `TRIAL_DAYS`, the `trial` status
  branch, and the `trialing` default to match "no trial, ever," or (b) decide trials
  are coming back and wire onboarding to actually use them. Don't leave it half-wired.

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
- End-to-end Bakong KHQR verification (`src/lib/bakong/verify.ts`) against a live
  Bakong account — behavior when the API is unreachable/misconfigured vs. the manual
  proof fallback.
- Cross-store isolation under RLS for staff accounts specifically (the policy shape
  documented assumes `is_staff() AND store_id = current_store_id()` is airtight, but
  it hasn't been exercised with a penetration-style multi-tenant test per
  [04_BUSINESS_RULES.md](04_BUSINESS_RULES.md)).
- The `advanced_analytics` plan capability flag exists in
  `src/lib/billing/plans.ts` but has no consuming feature yet — confirm it isn't
  silently gating something unrelated.

## Not yet built (tracked in roadmap, not bugs)

Supplier management, expiration tracking, and advanced analytics remain unbuilt —
see [03_FEATURE_ROADMAP.md](03_FEATURE_ROADMAP.md) for the full pending list. Listed
here only for cross-reference; do not duplicate roadmap items as "issues."
