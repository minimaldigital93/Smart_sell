"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperadmin } from "@/lib/auth/session";
import { USER_ROLES, type UserRole, type StoreStatus } from "@/lib/constants";

export type ActionResult = { ok: boolean; error?: string };

function revalidateSuperadmin() {
  revalidatePath("/superadmin", "layout");
}

/** Set a store's coarse lifecycle state (lock / cancel / reactivate). */
export async function setStoreStatus(
  storeId: string,
  status: StoreStatus,
): Promise<ActionResult> {
  await requireSuperadmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ status })
    .eq("id", storeId);
  if (error) return { ok: false, error: error.message };
  revalidateSuperadmin();
  return { ok: true };
}

/** Extend a store's paid period and reactivate it. */
export async function extendStorePeriod(
  storeId: string,
  days: number,
): Promise<ActionResult> {
  await requireSuperadmin();
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("current_period_end")
    .eq("id", storeId)
    .maybeSingle();

  const base = Math.max(
    Date.now(),
    store?.current_period_end ? Date.parse(store.current_period_end) : 0,
  );
  const newEnd = new Date(base + days * 86_400_000).toISOString();

  const { error } = await supabase
    .from("stores")
    .update({ current_period_end: newEnd, status: "active" })
    .eq("id", storeId);
  if (error) return { ok: false, error: error.message };
  revalidateSuperadmin();
  return { ok: true };
}

/** Move a store onto a different plan. */
export async function changeStorePlan(
  storeId: string,
  planId: string,
): Promise<ActionResult> {
  await requireSuperadmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ plan_id: planId })
    .eq("id", storeId);
  if (error) return { ok: false, error: error.message };
  await supabase
    .from("subscriptions")
    .update({ plan_id: planId })
    .eq("store_id", storeId);
  revalidateSuperadmin();
  return { ok: true };
}

/** Approve a (manual or stuck) payment: marks it paid + extends the store. */
export async function approvePayment(paymentId: string): Promise<ActionResult> {
  await requireSuperadmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_subscription", {
    p_payment: paymentId,
  });
  if (error) return { ok: false, error: error.message };
  revalidateSuperadmin();
  return { ok: true };
}

/** Reject a pending payment. */
export async function rejectPayment(paymentId: string): Promise<ActionResult> {
  await requireSuperadmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("subscription_payments")
    .update({ status: "failed" })
    .eq("id", paymentId);
  if (error) return { ok: false, error: error.message };
  revalidateSuperadmin();
  return { ok: true };
}

/** Change a user's role across any store. */
export async function setUserRole(
  userId: string,
  role: UserRole,
): Promise<ActionResult> {
  await requireSuperadmin();
  if (!(USER_ROLES as readonly string[]).includes(role)) {
    return { ok: false, error: "Invalid role." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidateSuperadmin();
  return { ok: true };
}
