"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { requestOrigin } from "@/lib/http/origin";
import { getMyStoreId } from "@/services/stores";
import {
  getPaymentByToken,
  markCashPaid,
  mintOrderKhqrPayment,
  pollAndAdvance,
} from "@/services/payments";
import type { OrderPaymentStatusEnum } from "@/types/database";

export type PaymentActionResult =
  | { ok: true; status?: OrderPaymentStatusEnum }
  | { ok: false; error: string };

/** Staff guard shared by the admin payment actions: same store or superadmin. */
async function loadStaffPayment(paymentId: string) {
  const { profile } = await requireStaff();
  const supabase = await createClient();
  // The staff RLS policy already scopes reads to the caller's store.
  const { data: payment } = await supabase
    .from("order_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { payment: null, profile } as const;

  const myStore = await getMyStoreId();
  if (myStore && payment.store_id !== myStore) {
    return { payment: null, profile } as const;
  }
  return { payment, profile } as const;
}

/** Admin "Recheck" button: force a gateway verify past the cooldown. */
export async function recheckOrderPaymentAction(
  paymentId: string,
): Promise<PaymentActionResult> {
  const { payment } = await loadStaffPayment(paymentId);
  if (!payment) return { ok: false, error: "Payment not found." };

  const result = await pollAndAdvance(payment, { force: true });
  revalidatePath("/admin/payments");
  revalidatePath(`/admin/orders/${payment.order_id}`);
  return { ok: true, status: result.status };
}

/** Cash settlement: records the cashier + paid time, confirms a pending order. */
export async function markCashPaidAction(
  paymentId: string,
): Promise<PaymentActionResult> {
  const { payment, profile } = await loadStaffPayment(paymentId);
  if (!payment) return { ok: false, error: "Payment not found." };
  if (payment.method !== "cash") {
    return { ok: false, error: "Only cash payments can be settled here." };
  }
  if (payment.status === "paid") return { ok: true, status: "paid" };

  const result = await markCashPaid(paymentId, profile.id);
  if (!result.ok) return result;

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/orders/${payment.order_id}`);
  revalidatePath("/admin/orders");
  return { ok: true, status: "paid" };
}

export type RegenerateQrResult =
  | { ok: true; payToken: string }
  | { ok: false; error: string };

/**
 * Customer-side "Get a new payment link" after a QR/checkout link expired.
 * Authenticated by the old payment's unguessable token; only works while the
 * order is still awaiting payment.
 */
export async function regenerateOrderQrAction(
  publicToken: string,
): Promise<RegenerateQrResult> {
  const limited = await checkRateLimit("khqr:regenerate", 10, 600);
  if (!limited.ok) {
    return { ok: false, error: rateLimitMessage(limited.retryAfterSec) };
  }

  const old = await getPaymentByToken(publicToken);
  if (!old || old.method !== "khqr") {
    return { ok: false, error: "Payment not found." };
  }
  if (old.status === "paid") {
    return { ok: false, error: "This order is already paid." };
  }

  const service = createServiceClient();
  if (!service) return { ok: false, error: "Payments are not configured." };
  const { data: order } = await service
    .from("orders")
    .select("id, store_id, total, status")
    .eq("id", old.order_id)
    .maybeSingle();
  if (!order || order.status !== "pending") {
    return { ok: false, error: "This order is no longer awaiting payment." };
  }

  const minted = await mintOrderKhqrPayment(order, {
    origin: await requestOrigin(),
  });
  if (!minted.ok) return minted;
  return { ok: true, payToken: minted.payment.public_token };
}

// ---------------------------------------------------------------------------
// Store payment settings (khqr.cc merchant profile)
// ---------------------------------------------------------------------------

const paymentSettingsSchema = z.object({
  enabled: z.boolean(),
  profileId: z.string().trim().max(120).optional().or(z.literal("")),
  secret: z.string().trim().max(200).optional().or(z.literal("")),
  currency: z.enum(["USD", "KHR"]).default("USD"),
});

export type SavePaymentSettingsResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Save the store's khqr.cc merchant credentials. Service-role write — the
 * table has no RLS policies so the secret is unreachable from any client
 * session. A blank secret keeps the existing one (write-only field).
 */
export async function savePaymentSettingsAction(
  input: unknown,
): Promise<SavePaymentSettingsResult> {
  const { profile } = await requireAdmin();
  if (!profile.store_id) {
    return { ok: false, error: "No store is associated with this account." };
  }

  const parsed = paymentSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;

  const service = createServiceClient();
  if (!service) return { ok: false, error: "Payments are not configured." };

  const { data: existing } = await service
    .from("store_payment_settings")
    .select("khqrpay_secret")
    .eq("store_id", profile.store_id)
    .maybeSingle();

  const secret = v.secret?.trim() ? v.secret.trim() : (existing?.khqrpay_secret ?? null);
  if (v.enabled && (!v.profileId?.trim() || !secret)) {
    return {
      ok: false,
      error: "Enter your khqr.cc profile ID and secret before enabling KHQR.",
    };
  }

  const { error } = await service.from("store_payment_settings").upsert({
    store_id: profile.store_id,
    khqrpay_enabled: v.enabled,
    khqrpay_profile_id: v.profileId?.trim() || null,
    khqrpay_secret: secret,
    currency: v.currency,
    updated_by: profile.id,
  });
  if (error) {
    console.error("[payments.settings]", error);
    return { ok: false, error: "Could not save payment settings." };
  }

  revalidatePath("/admin/settings");
  return { ok: true };
}

export type MyPaymentSettings = {
  enabled: boolean;
  profileId: string;
  hasSecret: boolean;
  currency: "USD" | "KHR";
};

/** Settings-form state — never returns the secret itself. */
export async function getMyPaymentSettingsAction(): Promise<MyPaymentSettings | null> {
  const { profile } = await requireAdmin();
  if (!profile.store_id) return null;
  const service = createServiceClient();
  if (!service) return null;

  const { data } = await service
    .from("store_payment_settings")
    .select("khqrpay_enabled, khqrpay_profile_id, khqrpay_secret, currency")
    .eq("store_id", profile.store_id)
    .maybeSingle();

  return {
    enabled: data?.khqrpay_enabled ?? false,
    profileId: data?.khqrpay_profile_id ?? "",
    hasSecret: Boolean(data?.khqrpay_secret),
    currency: data?.currency === "KHR" ? "KHR" : "USD",
  };
}
