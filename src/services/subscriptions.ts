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

/** The current store's subscription row (RLS scopes it to the caller's store). */
export const getMySubscription = cache(
  async (): Promise<Subscription | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
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
