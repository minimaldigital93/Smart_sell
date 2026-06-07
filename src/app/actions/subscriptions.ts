"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/auth/session";
import { getMyStore } from "@/services/stores";
import { getPlanByCode } from "@/services/subscriptions";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { generateSubscriptionKhqr, newBillNumber } from "@/lib/bakong/khqr";
import { checkTransactionByMd5 } from "@/lib/bakong/verify";
import { isPlanCode } from "@/lib/billing/plans";

export type CheckoutResult = {
  ok: boolean;
  error?: string;
  paymentId?: string;
  qr?: string | null;
  md5?: string | null;
  amount?: number;
  /** true when a Bakong QR was generated (poll for status); false = manual. */
  automated?: boolean;
};

export type PollResult = {
  ok: boolean;
  status: "pending" | "paid" | "unavailable";
  periodEnd?: string | null;
  error?: string;
};

/**
 * Begin a subscription purchase: create a pending payment for the chosen plan
 * and, when Bakong is configured, a KHQR to scan. Owner-only.
 */
export async function startSubscriptionCheckout(
  planCode: string,
): Promise<CheckoutResult> {
  await requireAdmin();

  const limited = await checkRateLimit("billing:checkout", 10, 60);
  if (!limited.ok) {
    return { ok: false, error: rateLimitMessage(limited.retryAfterSec) };
  }
  if (!isPlanCode(planCode)) return { ok: false, error: "Unknown plan." };

  const [store, plan] = await Promise.all([
    getMyStore(),
    getPlanByCode(planCode),
  ]);
  if (!store) return { ok: false, error: "No store found for this account." };
  if (!plan) return { ok: false, error: "Plan not available." };

  const amount = Number(plan.price_usd);
  const billNumber = newBillNumber(store.id);
  const khqr = await generateSubscriptionKhqr({
    amountUsd: amount,
    billNumber,
    storeLabel: store.name,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscription_payments")
    .insert({
      store_id: store.id,
      plan_id: plan.id,
      amount_usd: amount,
      method: khqr ? "khqr" : "manual",
      bill_number: billNumber,
      bakong_md5: khqr?.md5 ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[billing.checkout] insert", error);
    return { ok: false, error: "Could not start checkout. Please retry." };
  }

  return {
    ok: true,
    paymentId: data.id,
    qr: khqr?.qr ?? null,
    md5: khqr?.md5 ?? null,
    amount,
    automated: !!khqr,
  };
}

/**
 * Poll Bakong for a pending KHQR payment. On success, activates the
 * subscription (extends the store's paid period by 30 days). Owner-only.
 */
export async function checkSubscriptionPayment(
  paymentId: string,
): Promise<PollResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("subscription_payments")
    .select("id, status, bakong_md5")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) return { ok: false, status: "pending", error: "Not found." };
  if (payment.status === "paid") return { ok: true, status: "paid" };
  if (!payment.bakong_md5) return { ok: true, status: "pending" };

  const result = await checkTransactionByMd5(payment.bakong_md5);
  if (result.status === "unavailable") {
    return { ok: true, status: "unavailable" };
  }
  if (result.status === "unpaid") {
    return { ok: true, status: "pending" };
  }

  // Paid: record the txn ref then activate via the SECURITY DEFINER RPC.
  await supabase
    .from("subscription_payments")
    .update({ bakong_txn_ref: result.txnRef })
    .eq("id", paymentId);

  const { data: periodEnd, error } = await supabase.rpc(
    "activate_subscription",
    { p_payment: paymentId },
  );
  if (error) {
    console.error("[billing.activate]", error);
    return { ok: false, status: "pending", error: "Activation failed." };
  }

  revalidatePath("/admin/billing");
  revalidatePath("/admin", "layout");
  return { ok: true, status: "paid", periodEnd: periodEnd ?? null };
}

export type ManualProofState = { ok: boolean; error?: string; message?: string };

/**
 * Manual fallback: upload a KHQR/transfer screenshot for a plan. Creates a
 * pending manual payment for the superadmin to approve. Owner-only.
 */
export async function submitManualSubscriptionProof(
  _prev: ManualProofState,
  formData: FormData,
): Promise<ManualProofState> {
  await requireAdmin();

  const limited = await checkRateLimit("billing:manual", 5, 60);
  if (!limited.ok) {
    return { ok: false, error: rateLimitMessage(limited.retryAfterSec) };
  }

  const planCode = String(formData.get("planCode") ?? "");
  const file = formData.get("proof");
  if (!isPlanCode(planCode)) return { ok: false, error: "Unknown plan." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please attach a payment screenshot." };
  }

  const [store, plan] = await Promise.all([
    getMyStore(),
    getPlanByCode(planCode),
  ]);
  if (!store || !plan) return { ok: false, error: "Store or plan not found." };

  const storageClient = createServiceClient() ?? (await createClient());
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase().slice(0, 4);
  const path = `subscriptions/${store.id}/${randomUUID()}.${ext}`;
  const { error: uploadErr } = await storageClient.storage
    .from("payment-proofs")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadErr) {
    console.error("[billing.manual] upload", uploadErr);
    return { ok: false, error: "Could not upload screenshot. Please retry." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("subscription_payments").insert({
    store_id: store.id,
    plan_id: plan.id,
    amount_usd: Number(plan.price_usd),
    method: "manual",
    bill_number: newBillNumber(store.id),
    proof_url: path,
    status: "pending",
  });
  if (error) {
    console.error("[billing.manual] insert", error);
    return { ok: false, error: "Could not submit. Please retry." };
  }

  revalidatePath("/admin/billing");
  return {
    ok: true,
    message: "Payment submitted. We'll activate your plan once confirmed.",
  };
}
