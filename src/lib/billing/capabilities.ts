import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getMyStoreId } from "@/services/stores";
import {
  DEFAULT_PLAN_LIMITS,
  parsePlanLimits,
  type PlanLimits,
} from "@/lib/billing/plans";

/** Boolean capability gates carried in subscription_plans.limits. */
export type PlanCapability = "pos" | "coupons" | "custom_domain";

export type CapabilityCheck = { ok: true } | { ok: false; error: string };

/**
 * The caller's store plan limits. Returns null for platform accounts
 * (superadmin has no store and is never gated); a store without a plan gets
 * the most restrictive defaults.
 */
export const getMyPlanLimits = cache(async (): Promise<PlanLimits | null> => {
  const storeId = await getMyStoreId();
  if (!storeId) return null;

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("plan_id")
    .eq("id", storeId)
    .maybeSingle();
  if (!store?.plan_id) return DEFAULT_PLAN_LIMITS;

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("limits")
    .eq("id", store.plan_id)
    .maybeSingle();
  return parsePlanLimits(plan?.limits);
});

const CAPABILITY_LABEL: Record<PlanCapability, string> = {
  pos: "The POS register",
  coupons: "Coupons",
  custom_domain: "A custom domain",
};

/** Gate a server action on a boolean plan capability. */
export async function requirePlanCapability(
  cap: PlanCapability,
): Promise<CapabilityCheck> {
  const limits = await getMyPlanLimits();
  if (!limits || limits[cap]) return { ok: true };
  return {
    ok: false,
    error: `${CAPABILITY_LABEL[cap]} is not included in your plan. Upgrade in Billing to unlock it.`,
  };
}

/** Gate product creation on the plan's max_products (-1 = unlimited). */
export async function requireProductCapacity(): Promise<CapabilityCheck> {
  const limits = await getMyPlanLimits();
  if (!limits || limits.max_products === -1) return { ok: true };

  const storeId = await getMyStoreId();
  if (!storeId) return { ok: true };

  const supabase = await createClient();
  const { count } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId);

  if ((count ?? 0) >= limits.max_products) {
    return {
      ok: false,
      error: `Your plan allows up to ${limits.max_products} products. Upgrade in Billing to add more.`,
    };
  }
  return { ok: true };
}
