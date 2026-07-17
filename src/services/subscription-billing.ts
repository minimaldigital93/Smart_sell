import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import {
  DEMO_CONFIRM_AFTER_SECONDS,
  isDemoMode,
  platformCredentials,
  qrTtlMinutes,
  verifyCooldownSeconds,
} from "@/lib/khqrpay/config";
import { checkTransaction, hostedCheckoutUrl } from "@/lib/khqrpay/gateway";
import { buildKhqrPayload } from "@/lib/khqrpay/khqr-payload";
import { isOpen } from "@/lib/khqrpay/status";
import type { Database, OrderPaymentStatusEnum } from "@/types/database";

export type SubscriptionPaymentRow =
  Database["public"]["Tables"]["subscription_payments"]["Row"];

export type SubscriptionMintResult =
  | { ok: true; payment: SubscriptionPaymentRow }
  | { ok: false; error: string };

export type SubscriptionPollResult = {
  status: OrderPaymentStatusEnum;
  paid: boolean;
  periodEnd: string | null;
};

/** 'SUB-<store8>-<YmdHis>-<rand>' — platform-settled transaction id. */
export function newSubscriptionTransactionId(storeId: string): string {
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `SUB-${storeId.slice(0, 8)}-${ts}-${randomInt(100, 1000)}`;
}

function service() {
  const client = createServiceClient();
  if (!client) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for subscription billing.",
    );
  }
  return client;
}

/** Whether automated KHQR subscription checkout is available at all. */
export function subscriptionKhqrAvailable(): boolean {
  return isDemoMode() || platformCredentials() !== null;
}

/**
 * Mint a khqr subscription payment for a store: retire open attempts, insert
 * the row with the platform's khqr.cc credentials (hosted checkout) or a
 * local demo QR payload.
 */
export async function mintSubscriptionKhqrPayment(opts: {
  storeId: string;
  planId: string;
  amountUsd: number;
  billingUrl: string;
}): Promise<SubscriptionMintResult> {
  const supabase = service();
  await supabase.rpc("retire_open_subscription_payments", {
    p_store: opts.storeId,
  });

  const transactionId = newSubscriptionTransactionId(opts.storeId);
  const publicToken = randomBytes(24).toString("hex");
  const expiresAt = new Date(
    Date.now() + qrTtlMinutes() * 60_000,
  ).toISOString();

  const base = {
    store_id: opts.storeId,
    plan_id: opts.planId,
    amount_usd: opts.amountUsd,
    method: "khqr" as const,
    status: "qr_generated" as const,
    bill_number: transactionId,
    transaction_id: transactionId,
    public_token: publicToken,
    expires_at: expiresAt,
  };

  if (isDemoMode()) {
    const { data, error } = await supabase
      .from("subscription_payments")
      .insert({
        ...base,
        provider_ref: `DEMO-${transactionId}`,
        qr_payload: buildKhqrPayload({
          transactionId,
          amount: opts.amountUsd,
        }),
      })
      .select("*")
      .single();
    if (error || !data) {
      console.error("[subscriptions.mint] demo insert", error);
      return { ok: false, error: "Could not start checkout." };
    }
    return { ok: true, payment: data };
  }

  const creds = platformCredentials();
  if (!creds) {
    return { ok: false, error: "KHQR billing is not configured." };
  }

  const checkout = hostedCheckoutUrl(creds, {
    transactionId,
    amount: opts.amountUsd,
    successUrl: opts.billingUrl,
    remark: `Subscription ${transactionId}`,
  });

  const { data, error } = await supabase
    .from("subscription_payments")
    .insert({ ...base, checkout_url: checkout })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[subscriptions.mint] insert", error);
    return { ok: false, error: "Could not start checkout." };
  }
  return { ok: true, payment: data };
}

/**
 * Advance an open khqr subscription payment: lazy expiry, waiting mark,
 * cooldown-gated gateway verify, then finalize (extends the store's period).
 */
export async function pollSubscriptionPayment(
  payment: SubscriptionPaymentRow,
  opts: { force?: boolean } = {},
): Promise<SubscriptionPollResult> {
  const supabase = service();
  const done = (
    status: OrderPaymentStatusEnum,
    periodEnd: string | null = null,
  ): SubscriptionPollResult => ({ status, paid: status === "paid", periodEnd });

  if (payment.status === "paid" || !isOpen(payment.status)) {
    return done(payment.status);
  }

  // Demo auto-confirm.
  if (isDemoMode() && payment.provider_ref?.startsWith("DEMO-")) {
    const age = Date.now() - new Date(payment.created_at).getTime();
    if (age >= DEMO_CONFIRM_AFTER_SECONDS * 1000) {
      return finalize(payment.id, done);
    }
    await markWaiting(payment.id);
    return done("waiting_payment");
  }

  // Lazy expiry (atomic conditional update — only open rows past their TTL).
  if (payment.expires_at && Date.parse(payment.expires_at) <= Date.now()) {
    await supabase
      .from("subscription_payments")
      .update({ status: "expired" })
      .eq("id", payment.id)
      .in("status", ["pending", "qr_generated", "waiting_payment"]);
    return done("expired");
  }

  await markWaiting(payment.id);

  if (!opts.force && payment.last_checked_at) {
    const since = Date.now() - new Date(payment.last_checked_at).getTime();
    if (since < verifyCooldownSeconds() * 1000) {
      return done("waiting_payment");
    }
  }
  await supabase
    .from("subscription_payments")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", payment.id);

  const creds = platformCredentials();
  if (!creds || !payment.transaction_id) return done("waiting_payment");

  const { paid } = await checkTransaction(creds, {
    transactionId: payment.transaction_id,
    amount: Number(payment.amount_usd),
    currency: creds.currency,
  });
  if (!paid) return done("waiting_payment");

  return finalize(payment.id, done);
}

async function markWaiting(paymentId: string): Promise<void> {
  await service()
    .from("subscription_payments")
    .update({ status: "waiting_payment" })
    .eq("id", paymentId)
    .in("status", ["pending", "qr_generated"]);
}

async function finalize(
  paymentId: string,
  done: (
    status: OrderPaymentStatusEnum,
    periodEnd?: string | null,
  ) => SubscriptionPollResult,
): Promise<SubscriptionPollResult> {
  const { data, error } = await service().rpc("finalize_subscription_payment", {
    p_payment: paymentId,
  });
  if (error) {
    console.error("[subscriptions.finalize]", paymentId, error);
    return done("waiting_payment");
  }
  return done("paid", (data as string | null) ?? null);
}
