"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/auth/session";
import { getMyStore } from "@/services/stores";
import { getPlanByCode } from "@/services/subscriptions";
import {
  mintSubscriptionKhqrPayment,
  newSubscriptionTransactionId,
  pollSubscriptionPayment,
  subscriptionKhqrAvailable,
} from "@/services/subscription-billing";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { requestOrigin } from "@/lib/http/origin";
import { isPlanCode } from "@/lib/billing/plans";

export type CheckoutResult = {
  ok: boolean;
  error?: string;
  paymentId?: string;
  amount?: number;
  /** true = khqr.cc checkout (poll for status); false = manual proof. */
  automated?: boolean;
  /** Signed khqr.cc hosted-checkout URL (live mode). */
  checkoutUrl?: string | null;
  /** Local KHQR payload to render as a QR (demo mode). */
  qrPayload?: string | null;
};

export type PollResult = {
  ok: boolean;
  status: "pending" | "paid" | "expired" | "unavailable";
  periodEnd?: string | null;
  error?: string;
};

/**
 * Begin a subscription purchase: create a khqr.cc payment for the chosen plan
 * (hosted checkout, settled by webhook/poll) — or fall back to the manual
 * screenshot-proof flow while the platform's khqr.cc profile is unconfigured.
 * Owner-only.
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

  if (!subscriptionKhqrAvailable()) {
    // Manual fallback: the client shows the proof-upload form; the row is
    // created on submit (submitManualSubscriptionProof).
    return { ok: true, amount, automated: false };
  }

  const origin = await requestOrigin();
  const minted = await mintSubscriptionKhqrPayment({
    storeId: store.id,
    planId: plan.id,
    amountUsd: amount,
    billingUrl: `${origin}/admin/billing`,
  });
  if (!minted.ok) return { ok: false, error: minted.error };

  return {
    ok: true,
    paymentId: minted.payment.id,
    amount,
    automated: true,
    checkoutUrl: minted.payment.checkout_url,
    qrPayload: minted.payment.qr_payload,
  };
}

/**
 * Poll a pending khqr subscription payment. On settlement the store's paid
 * period extends via finalize_subscription_payment (service-role RPC).
 * Owner-only.
 */
export async function checkSubscriptionPayment(
  paymentId: string,
): Promise<PollResult> {
  await requireAdmin();
  const supabase = await createClient();

  // RLS scopes this read to the caller's own store.
  const { data: payment } = await supabase
    .from("subscription_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) return { ok: false, status: "pending", error: "Not found." };
  if (payment.status === "paid") return { ok: true, status: "paid" };

  const result = await pollSubscriptionPayment(payment);
  if (result.paid) {
    revalidatePath("/admin/billing");
    revalidatePath("/admin", "layout");
    return { ok: true, status: "paid", periodEnd: result.periodEnd };
  }
  if (result.status === "expired") return { ok: true, status: "expired" };
  return { ok: true, status: "pending" };
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
    bill_number: newSubscriptionTransactionId(store.id),
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
