import { createHash, timingSafeEqual } from "node:crypto";
import type { KhqrCredentials } from "@/lib/khqrpay/types";

/**
 * khqr.cc (KHQRPay) request/callback signing, ported byte-for-byte from AMS
 * KhqrPaymentService. Pure functions — unit-tested with fixture secrets.
 */

function sha1Hex(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Hosted-checkout / QR request signature:
 *   sha1(secret + transaction_id + amount + success_url + remark)
 * `amount` must already be formatted with exactly two decimals.
 */
export function signQrRequest(
  params: {
    transaction_id: string;
    amount: string;
    success_url: string;
    remark: string;
  },
  secret: string,
): string {
  return sha1Hex(
    secret +
      params.transaction_id +
      params.amount +
      params.success_url +
      params.remark,
  );
}

/** Check-transaction signature: sha1(secret + transaction_id). */
export function signCheckRequest(secret: string, transactionId: string): string {
  return sha1Hex(secret + transactionId);
}

/**
 * Callback (webhook) signature:
 *   sha256(secret + req_time + transaction_id + amount + UPPER(status))
 */
export function signCallback(
  payload: {
    req_time?: string;
    transaction_id?: string;
    amount?: string;
    status?: string;
  },
  secret: string,
): string {
  return sha256Hex(
    secret +
      (payload.req_time ?? "") +
      (payload.transaction_id ?? "") +
      (payload.amount ?? "") +
      (payload.status ?? "").toUpperCase(),
  );
}

/** Constant-time comparison of the provided webhook hash against ours. */
export function verifyCallbackSignature(
  payload: Record<string, unknown>,
  secret: string,
): boolean {
  const provided = payload.hash;
  if (typeof provided !== "string" || provided.length === 0) return false;

  const expected = signCallback(
    {
      req_time: asString(payload.req_time),
      transaction_id: asString(payload.transaction_id),
      amount: asString(payload.amount),
      status: asString(payload.status),
    },
    secret,
  );

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function asString(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  return String(v);
}

/**
 * AMS isValidCallbackFor: status must be SUCCESS, the sha256 signature must
 * verify with the settling store's secret, and the paid transaction/amount/
 * currency must match the row — a valid signature on a $0.01 payment must
 * never finalize a $50 order.
 */
export function isValidCallbackFor(
  payload: Record<string, unknown>,
  creds: KhqrCredentials,
  row: { transactionId: string | null; amount: number; currency: string },
): boolean {
  if (String(payload.status ?? "").toUpperCase() !== "SUCCESS") return false;
  if (!verifyCallbackSignature(payload, creds.secret)) return false;

  if (
    payload.transaction_id !== undefined &&
    String(payload.transaction_id) !== String(row.transactionId ?? "")
  ) {
    return false;
  }
  if (
    payload.amount !== undefined &&
    Math.abs(Number(payload.amount) - row.amount) > 0.01
  ) {
    console.warn("[khqrpay.callback] amount mismatch", {
      tran: row.transactionId,
      got: payload.amount,
      expected: row.amount,
    });
    return false;
  }
  if (
    payload.currency !== undefined &&
    String(payload.currency).toUpperCase() !== row.currency.toUpperCase()
  ) {
    return false;
  }
  return true;
}
