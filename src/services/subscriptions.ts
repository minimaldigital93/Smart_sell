import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  Subscription,
  SubscriptionPayment,
  SubscriptionPlan,
} from "@/types";

/** All active plans, cheapest first. Public (pricing page + admin billing). */
export const getPlans = cache(async (): Promise<SubscriptionPlan[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort", { ascending: true });
  return data ?? [];
});

export const getPlanByCode = cache(
  async (code: string): Promise<SubscriptionPlan | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    return data ?? null;
  },
);

/**
 * The current store's subscription row. Explicitly scoped to the caller's
 * store: RLS alone lets a superadmin (store_id null) see every row, which made
 * `.maybeSingle()` throw on /admin/billing for that account.
 */
export const getMySubscription = cache(
  async (): Promise<Subscription | null> => {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!profile?.store_id) return null;
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("store_id", profile.store_id)
      .maybeSingle();
    return data ?? null;
  },
);

/** Payment history for the caller's store (RLS-scoped), newest first. */
export const getMyPayments = cache(
  async (limit = 24): Promise<SubscriptionPayment[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("subscription_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  },
);
