import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { credentialsForStore } from "@/lib/khqrpay/credentials";
import { checkTransaction, hostedCheckoutUrl } from "@/lib/khqrpay/gateway";
import { buildKhqrPayload } from "@/lib/khqrpay/khqr-payload";
import {
  DEMO_CONFIRM_AFTER_SECONDS,
  isDemoMode,
  qrTtlMinutes,
  verifyCooldownSeconds,
} from "@/lib/khqrpay/config";
import { isOpen } from "@/lib/khqrpay/status";
import { getMyStoreId } from "@/services/stores";
import type { Database, OrderPaymentStatusEnum } from "@/types/database";

export type OrderPayment =
  Database["public"]["Tables"]["order_payments"]["Row"];

export type MintResult =
  | { ok: true; payment: OrderPayment }
  | { ok: false; error: string };

export type PollResult = {
  status: OrderPaymentStatusEnum;
  paid: boolean;
  orderId: string;
  expiresAt: string | null;
};

/** 'ORD-<order8>-<YmdHis>-<rand>' — provider correlation id (AMS scheme). */
export function newOrderTransactionId(orderId: string): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14);
  return `ORD-${orderId.slice(0, 8)}-${ts}-${randomInt(100, 1000)}`;
}

function service() {
  const client = createServiceClient();
  if (!client) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for payment processing.",
    );
  }
  return client;
}

/** Record a cash (COD / at-store) payment attempt for an order. */
export async function createCashPayment(order: {
  id: string;
  store_id: string;
  total: number;
}): Promise<MintResult> {
  const { data, error } = await service()
    .from("order_payments")
    .insert({
      store_id: order.store_id,
      order_id: order.id,
      method: "cash",
      amount: order.total,
      status: "pending",
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[payments.cash] insert", error);
    return { ok: false, error: "Could not record the payment." };
  }
  return { ok: true, payment: data };
}

/**
 * Mint a fresh khqr payment attempt for an order: retire any open attempt,
 * insert the row, and attach the signed hosted-checkout URL (live) or a
 * locally-built KHQR payload (demo). khqr.cc is hosted-checkout only — the
 * customer pays on khqr.cc and settlement returns via webhook/poll. The
 * public token is generated here (not by the DB default) so the checkout
 * URL's success_url can point at the payment's own pay page in one pass.
 */
export async function mintOrderKhqrPayment(
  order: { id: string; store_id: string; total: number },
  opts: { origin: string },
): Promise<MintResult> {
  const supabase = service();
  await supabase.rpc("retire_open_order_payments", { p_order: order.id });

  const transactionId = newOrderTransactionId(order.id);
  const publicToken = randomBytes(24).toString("hex");
  const successUrl = `${opts.origin}/checkout/pay/${publicToken}`;
  const expiresAt = new Date(
    Date.now() + qrTtlMinutes() * 60_000,
  ).toISOString();

  if (isDemoMode()) {
    const { data, error } = await supabase
      .from("order_payments")
      .insert({
        store_id: order.store_id,
        order_id: order.id,
        method: "khqr",
        amount: order.total,
        currency: "USD",
        status: "qr_generated",
        transaction_id: transactionId,
        public_token: publicToken,
        provider: "demo",
        provider_ref: `DEMO-${transactionId}`,
        qr_payload: buildKhqrPayload({
          transactionId,
          amount: order.total,
        }),
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (error || !data) {
      console.error("[payments.mint] demo insert", error);
      return { ok: false, error: "Could not create the payment." };
    }
    return { ok: true, payment: data };
  }

  const creds = await credentialsForStore(order.store_id);
  if (!creds) {
    return {
      ok: false,
      error: "KHQR payment is not configured for this store.",
    };
  }

  const checkout = hostedCheckoutUrl(creds, {
    transactionId,
    amount: order.total,
    successUrl,
    remark: `Order payment ${transactionId}`,
  });

  const { data, error } = await supabase
    .from("order_payments")
    .insert({
      store_id: order.store_id,
      order_id: order.id,
      method: "khqr",
      amount: order.total,
      currency: creds.currency,
      status: "qr_generated",
      transaction_id: transactionId,
      public_token: publicToken,
      provider: "khqrpay",
      checkout_url: checkout,
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[payments.mint] insert", error);
    return { ok: false, error: "Could not create the payment." };
  }
  return { ok: true, payment: data };
}

/** Load a payment by its unguessable customer-facing token. */
export async function getPaymentByToken(
  token: string,
): Promise<OrderPayment | null> {
  const { data } = await service()
    .from("order_payments")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  return data ?? null;
}

/**
 * The latest still-payable KHQR attempt for an order (customer "Complete
 * payment" link). Caller must have already authorized access to the order.
 */
export async function getOpenKhqrPayment(
  orderId: string,
): Promise<OrderPayment | null> {
  const { data } = await service()
    .from("order_payments")
    .select("*")
    .eq("order_id", orderId)
    .eq("method", "khqr")
    .in("status", ["pending", "qr_generated", "waiting_payment"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/**
 * Advance an open payment one step: lazy-expire, mark waiting on first poll,
 * then (cooldown permitting) ask the gateway and finalize when settled.
 * Safe to call from the customer poll, admin recheck, and the reconcile cron
 * concurrently — every mutation happens in row-locked, transition-guarded RPCs.
 */
export async function pollAndAdvance(
  payment: OrderPayment,
  opts: { force?: boolean } = {},
): Promise<PollResult> {
  const supabase = service();
  const done = (status: OrderPaymentStatusEnum): PollResult => ({
    status,
    paid: status === "paid",
    orderId: payment.order_id,
    expiresAt: payment.expires_at,
  });

  if (payment.status === "paid" || !isOpen(payment.status)) {
    return done(payment.status);
  }

  // Demo: auto-confirm a few seconds after mint so the full scan → waiting →
  // paid flow can be demonstrated end-to-end without a gateway.
  if (payment.provider === "demo") {
    const age = Date.now() - new Date(payment.created_at).getTime();
    if (age >= DEMO_CONFIRM_AFTER_SECONDS * 1000) {
      return done(await finalize(payment.id));
    }
    await supabase.rpc("mark_order_payment_waiting", { p_id: payment.id });
    return done("waiting_payment");
  }

  // Lazy expiry.
  const { data: expired } = await supabase.rpc("expire_order_payment", {
    p_id: payment.id,
  });
  if (expired) return done("expired");

  await supabase.rpc("mark_order_payment_waiting", { p_id: payment.id });

  // Cooldown: the customer page polls every few seconds — never hit the live
  // gateway more than once per window. DB-backed so it survives restarts and
  // is shared with the cron path.
  if (!opts.force && payment.last_checked_at) {
    const since = Date.now() - new Date(payment.last_checked_at).getTime();
    if (since < verifyCooldownSeconds() * 1000) {
      return done("waiting_payment");
    }
  }
  await supabase
    .from("order_payments")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", payment.id);

  if (!payment.transaction_id) return done("waiting_payment");
  const creds = await credentialsForStore(payment.store_id);
  if (!creds) return done("waiting_payment");

  const { paid } = await checkTransaction(creds, {
    transactionId: payment.transaction_id,
    amount: Number(payment.amount),
    currency: payment.currency,
  });
  if (!paid) return done("waiting_payment");

  return done(await finalize(payment.id));
}

/**
 * Settle via the row-locked RPC. An INSUFFICIENT_STOCK raise from the order
 * trigger rolls the whole thing back — the payment stays open, the reconcile
 * cron retries, and staff see the stuck row on the Payments page.
 */
async function finalize(paymentId: string): Promise<OrderPaymentStatusEnum> {
  const { data, error } = await service().rpc("finalize_order_payment", {
    p_id: paymentId,
  });
  if (error) {
    console.error("[payments.finalize]", paymentId, error);
    return "waiting_payment";
  }
  return (data as OrderPaymentStatusEnum | null) ?? "waiting_payment";
}

/** Cash settlement: stamps the cashier and confirms the order if pending. */
export async function markCashPaid(
  paymentId: string,
  cashierId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await service().rpc("mark_cash_order_payment_paid", {
    p_id: paymentId,
    p_cashier: cashierId,
  });
  if (error) {
    console.error("[payments.markCashPaid]", paymentId, error);
    const msg = error.message ?? "";
    if (msg.includes("insufficient stock")) {
      return {
        ok: false,
        error: "Not enough stock to confirm this order — adjust inventory first.",
      };
    }
    return { ok: false, error: "Could not mark the payment as paid." };
  }
  return { ok: true };
}

export type AdminPaymentRow = OrderPayment & {
  order: {
    id: string;
    customer_name: string;
    status: string;
    total: number;
  } | null;
  cashier: { name: string | null } | null;
};

/**
 * Admin payment list — reads with the CALLER's client so the staff RLS policy
 * scopes rows to their store (superadmin sees all); plus the explicit store
 * filter for defense in depth.
 */
export async function listOrderPaymentsForAdmin(opts: {
  status?: OrderPaymentStatusEnum | "open" | "all";
  method?: "khqr" | "cash" | "all";
  limit?: number;
}): Promise<AdminPaymentRow[]> {
  const { status = "all", method = "all", limit = 50 } = opts;
  const supabase = await createClient();
  const storeId = await getMyStoreId();

  let qb = supabase
    .from("order_payments")
    .select(
      "*, order:orders(id, customer_name, status, total), cashier:profiles!order_payments_received_by_fkey(name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (storeId) qb = qb.eq("store_id", storeId);
  if (status === "open") {
    qb = qb.in("status", ["pending", "qr_generated", "waiting_payment"]);
  } else if (status !== "all") {
    qb = qb.eq("status", status);
  }
  if (method !== "all") qb = qb.eq("method", method);

  const { data, error } = await qb;
  if (error) {
    console.error("[payments.adminList]", error);
    return [];
  }
  return (data ?? []) as unknown as AdminPaymentRow[];
}

/** Payment history for one order (caller's client — staff RLS applies). */
export async function listPaymentsForOrder(
  orderId: string,
): Promise<AdminPaymentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_payments")
    .select(
      "*, order:orders(id, customer_name, status, total), cashier:profiles!order_payments_received_by_fkey(name)",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[payments.forOrder]", error);
    return [];
  }
  return (data ?? []) as unknown as AdminPaymentRow[];
}
