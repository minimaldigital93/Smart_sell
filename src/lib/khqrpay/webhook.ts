import "server-only";
import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { credentialsForStore } from "@/lib/khqrpay/credentials";
import { platformCredentials, webhookToleranceSeconds } from "@/lib/khqrpay/config";
import { isValidCallbackFor } from "@/lib/khqrpay/sign";
import { sendTelegram } from "@/lib/notifications/telegram";

/**
 * Inbound khqr.cc webhook ingestion, ported from AMS WebhookIngestService.
 * Three independent guards before any money is booked:
 *
 *   1. event_id idempotency — a duplicate/replayed delivery is acked (200)
 *      without re-running finalize (unique index on payment_webhooks.event_id).
 *   2. req_time freshness — deliveries older than the tolerance window are
 *      rejected even with a valid signature (captured-and-replayed payloads).
 *   3. signature + amount + currency + status, verified against the SPECIFIC
 *      row the charge was minted for (the owning store's secret).
 *
 * finalize then applies its own row lock, so even a race past (1)/(2) cannot
 * double-book. Unknown transaction and bad signature return the same 403 so
 * the endpoint never reveals which transaction ids exist.
 */
export async function ingestKhqrWebhook(
  payload: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const supabase = createServiceClient();
  if (!supabase) {
    console.error("[khqr.webhook] service client unavailable");
    return { status: 500, body: { message: "Server not configured" } };
  }

  const eventId = String(
    payload.event_id ?? payload.hash ?? `nohash-${randomBytes(12).toString("hex")}`,
  );
  const transactionId =
    typeof payload.transaction_id === "string" ? payload.transaction_id : null;

  // (1) Idempotency — the unique index is the source of truth; a raced
  // duplicate insert is acked exactly like a pre-checked one.
  const { data: webhook, error: insertErr } = await supabase
    .from("payment_webhooks")
    .insert({
      provider: "khqrpay",
      event_id: eventId,
      transaction_id: transactionId,
      payload: payload as never,
    })
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return { status: 200, body: { ok: true, duplicate: true } };
    }
    console.error("[khqr.webhook] insert", insertErr);
    return { status: 500, body: { message: "Could not record webhook" } };
  }

  const reject = async (reason: string) => {
    await supabase
      .from("payment_webhooks")
      .update({ status: "invalid", http_status: 403, error: reason })
      .eq("id", webhook.id);
    console.warn("[khqr.webhook] rejected", { eventId, transactionId, reason });
    return { status: 403, body: { message: "Invalid signature" } };
  };

  // Resolve the row FIRST so the signature is checked against the right
  // store's secret. ORD-* → order payment (SUB-* → subscription payment).
  if (!transactionId) return reject("unknown transaction");

  const { data: orderPayment } = await supabase
    .from("order_payments")
    .select("*")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (!orderPayment) {
    // SUB-* transaction ids settle subscription payments (platform-signed).
    // Anything else is unknown — same 403 either way, so the endpoint never
    // reveals which transaction ids exist.
    const { data: subPayment } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("transaction_id", transactionId)
      .maybeSingle();
    if (!subPayment) return reject("unknown transaction");

    await supabase
      .from("payment_webhooks")
      .update({ subscription_payment_id: subPayment.id })
      .eq("id", webhook.id);

    if (!isFresh(payload)) return reject("stale req_time");

    const platformCreds = platformCredentials();
    if (!platformCreds) return reject("platform khqr credentials missing");
    if (
      !isValidCallbackFor(payload, platformCreds, {
        transactionId: subPayment.transaction_id,
        amount: Number(subPayment.amount_usd),
        currency: platformCreds.currency,
      })
    ) {
      return reject("invalid signature/amount/currency/status");
    }

    const { error: subFinalizeErr } = await supabase.rpc(
      "finalize_subscription_payment",
      { p_payment: subPayment.id },
    );
    if (subFinalizeErr) {
      await supabase
        .from("payment_webhooks")
        .update({
          status: "ignored",
          signature_valid: true,
          http_status: 200,
          error: subFinalizeErr.message,
        })
        .eq("id", webhook.id);
      console.error(
        "[khqr.webhook] subscription finalize failed",
        transactionId,
        subFinalizeErr,
      );
      return { status: 200, body: { ok: false, deferred: true } };
    }

    await supabase
      .from("payment_webhooks")
      .update({
        status: "processed",
        signature_valid: true,
        http_status: 200,
        processed_at: new Date().toISOString(),
      })
      .eq("id", webhook.id);
    return { status: 200, body: { ok: true } };
  }

  await supabase
    .from("payment_webhooks")
    .update({ order_payment_id: orderPayment.id })
    .eq("id", webhook.id);

  // (2) Freshness.
  if (!isFresh(payload)) return reject("stale req_time");

  // (3) Signature + status + amount/currency, against this exact row.
  const creds = await credentialsForStore(orderPayment.store_id);
  if (!creds) return reject("store has no khqr credentials");
  if (
    !isValidCallbackFor(payload, creds, {
      transactionId: orderPayment.transaction_id,
      amount: Number(orderPayment.amount),
      currency: orderPayment.currency,
    })
  ) {
    return reject("invalid signature/amount/currency/status");
  }

  const { error: finalizeErr } = await supabase.rpc("finalize_order_payment", {
    p_id: orderPayment.id,
  });

  if (finalizeErr) {
    // Most likely INSUFFICIENT_STOCK from the order-confirm trigger: the money
    // arrived but the order can't be fulfilled. Keep the payment open, alert
    // staff, and ack — the reconcile cron keeps retrying finalize via poll.
    await supabase
      .from("payment_webhooks")
      .update({
        status: "ignored",
        signature_valid: true,
        http_status: 200,
        error: finalizeErr.message,
      })
      .eq("id", webhook.id);
    console.error("[khqr.webhook] finalize failed", transactionId, finalizeErr);
    void sendTelegram(
      `⚠️ KHQR payment ${transactionId} settled but the order could not be confirmed: ${finalizeErr.message}`,
    );
    return { status: 200, body: { ok: false, deferred: true } };
  }

  await supabase
    .from("payment_webhooks")
    .update({
      status: "processed",
      signature_valid: true,
      http_status: 200,
      processed_at: new Date().toISOString(),
    })
    .eq("id", webhook.id);

  return { status: 200, body: { ok: true } };
}

/**
 * True when req_time is within the tolerance window (or absent/unparseable —
 * the signature stays the authoritative check).
 */
function isFresh(payload: Record<string, unknown>): boolean {
  const reqTime = payload.req_time;
  if (reqTime === null || reqTime === undefined || reqTime === "") return true;

  let ts: number;
  if (typeof reqTime === "number" || /^\d+$/.test(String(reqTime))) {
    const n = Number(reqTime);
    // Seconds vs milliseconds epoch.
    ts = n > 10_000_000_000 ? n : n * 1000;
  } else {
    ts = Date.parse(String(reqTime));
  }
  if (!Number.isFinite(ts)) {
    console.warn("[khqr.webhook] req_time unparseable", reqTime);
    return true;
  }

  return Math.abs(Date.now() - ts) <= webhookToleranceSeconds() * 1000;
}
