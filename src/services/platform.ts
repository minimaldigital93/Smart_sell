import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  PlatformExpense,
  Profile,
  Store,
  SubscriptionPayment,
  SubscriptionPlan,
} from "@/types";

export type PlatformSummary = {
  mrr: number;
  active_stores: number;
  trial_stores: number;
  overdue_stores: number;
  total_revenue: number;
  total_expense: number;
  month_revenue: number;
  month_expense: number;
};

const EMPTY_SUMMARY: PlatformSummary = {
  mrr: 0,
  active_stores: 0,
  trial_stores: 0,
  overdue_stores: 0,
  total_revenue: 0,
  total_expense: 0,
  month_revenue: 0,
  month_expense: 0,
};

export const getPlatformSummary = cache(async (): Promise<PlatformSummary> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("platform_summary");
  const row = data?.[0];
  if (!row) return EMPTY_SUMMARY;
  return {
    mrr: Number(row.mrr ?? 0),
    active_stores: row.active_stores ?? 0,
    trial_stores: row.trial_stores ?? 0,
    overdue_stores: row.overdue_stores ?? 0,
    total_revenue: Number(row.total_revenue ?? 0),
    total_expense: Number(row.total_expense ?? 0),
    month_revenue: Number(row.month_revenue ?? 0),
    month_expense: Number(row.month_expense ?? 0),
  };
});

export type StoreRow = Store & {
  owner: Pick<Profile, "name" | "phone"> | null;
  plan: Pick<SubscriptionPlan, "name" | "code" | "price_usd"> | null;
};

export const getStores = cache(async (): Promise<StoreRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select(
      "*, owner:profiles!stores_owner_id_fkey(name, phone), plan:subscription_plans(name, code, price_usd)",
    )
    .order("created_at", { ascending: false });
  return (data as StoreRow[] | null) ?? [];
});

export const getStore = cache(async (id: string): Promise<StoreRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select(
      "*, owner:profiles!stores_owner_id_fkey(name, phone), plan:subscription_plans(name, code, price_usd)",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as StoreRow | null) ?? null;
});

export type UserRow = Profile & {
  store: Pick<Store, "name" | "slug"> | null;
};

export const getAllUsers = cache(async (): Promise<UserRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*, store:stores(name, slug)")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data as UserRow[] | null) ?? [];
});

export type PaymentRow = SubscriptionPayment & {
  store: Pick<Store, "name" | "slug"> | null;
  plan: Pick<SubscriptionPlan, "name" | "code"> | null;
};

export const getPayments = cache(
  async (onlyPending = false): Promise<PaymentRow[]> => {
    const supabase = await createClient();
    let query = supabase
      .from("subscription_payments")
      .select("*, store:stores(name, slug), plan:subscription_plans(name, code)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (onlyPending) query = query.eq("status", "pending");
    const { data } = await query;
    return (data as PaymentRow[] | null) ?? [];
  },
);

export const getExpenses = cache(async (): Promise<PlatformExpense[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_expenses")
    .select("*")
    .order("incurred_on", { ascending: false })
    .limit(200);
  return data ?? [];
});

export type PnlRow = {
  period: string;
  revenue: number;
  expense: number;
  net: number;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const getMonthlyPnl = cache(
  async (year: number): Promise<PnlRow[]> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc("platform_pnl_monthly", {
      p_year: year,
    });
    return (data ?? []).map((r) => ({
      period: MONTHS[(r.month ?? 1) - 1] ?? String(r.month),
      revenue: Number(r.revenue ?? 0),
      expense: Number(r.expense ?? 0),
      net: Number(r.net ?? 0),
    }));
  },
);

export const getYearlyPnl = cache(async (): Promise<PnlRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("platform_pnl_yearly");
  return (data ?? []).map((r) => ({
    period: String(r.year),
    revenue: Number(r.revenue ?? 0),
    expense: Number(r.expense ?? 0),
    net: Number(r.net ?? 0),
  }));
});
