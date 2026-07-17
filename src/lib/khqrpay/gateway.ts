import "server-only";
import { signCheckRequest, signQrRequest } from "@/lib/khqrpay/sign";
import type { KhqrCredentials } from "@/lib/khqrpay/types";

/**
 * khqr.cc (KHQRPay) gateway calls, ported from AMS KhqrPaymentService.
 *
 * khqr.cc is a HOSTED-CHECKOUT gateway: there is no headless "mint me a QR
 * image" API (the old qr-api-khqrcc endpoint 502s). The customer is redirected
 * to the signed checkout URL, pays on khqr.cc, and settlement returns via the
 * signed webhook — with check-transv2-khqrcc as the polling fallback.
 */

/**
 * Build the signed hosted-checkout URL:
 *   {baseUrl}/api/payment/request/{profileId}?transaction_id&amount&success_url&remark&hash
 * `success_url` is where khqr.cc sends the customer's browser back afterwards
 * (the webhook goes to the profile's Global Webhook URL, or success_url when
 * none is configured).
 */
export function hostedCheckoutUrl(
  creds: KhqrCredentials,
  opts: {
    transactionId: string;
    amount: number;
    successUrl: string;
    remark: string;
  },
): string {
  const params = {
    transaction_id: opts.transactionId,
    amount: opts.amount.toFixed(2),
    success_url: opts.successUrl,
    remark: opts.remark,
  };
  const hash = signQrRequest(params, creds.secret);
  const qs = new URLSearchParams({ ...params, hash });
  return `${creds.baseUrl}/api/payment/request/${creds.profileId}?${qs.toString()}`;
}

export type CheckTransactionResult = { paid: boolean };

/**
 * Ask khqr.cc whether the transaction has settled ("Check Transaction V2").
 * Any error / non-success / amount-currency mismatch reads as "unpaid" —
 * never confirm on ambiguity.
 */
export async function checkTransaction(
  creds: KhqrCredentials,
  opts: { transactionId: string; amount: number; currency: string },
): Promise<CheckTransactionResult> {
  const endpoint = `${creds.baseUrl}/api/${creds.profileId}/payment-gateway/v1/payments/check-transv2-khqrcc`;
  const body = new URLSearchParams({
    transaction_id: opts.transactionId,
    hash: signCheckRequest(creds.secret, opts.transactionId),
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
  } catch (err) {
    console.warn("[khqrpay.check] request failed", opts.transactionId, err);
    return { paid: false };
  }

  if (!response.ok) return { paid: false };

  let json: Record<string, unknown>;
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    return { paid: false };
  }

  // A non-zero responseCode (e.g. "transaction not found yet") means NOT
  // settled. responseCode === 0 only means the *query* succeeded — the real
  // paid state lives inside the data envelope.
  if (json.responseCode !== undefined && Number(json.responseCode) !== 0) {
    return { paid: false };
  }

  const data = (json.data ?? json) as Record<string, unknown>;
  const status = String(
    data.status ?? data.payment_status ?? data.transaction_status ?? "",
  ).toUpperCase();

  const paid =
    data.verified === true ||
    data.paid === true ||
    ["COMPLETED", "PAID", "SUCCESS", "PAID_SUCCESS"].includes(status);

  if (!paid) return { paid: false };

  // Mirror the webhook's defence: a "paid" that settled a different amount or
  // currency must never finalize this row.
  if (
    data.amount !== undefined &&
    Math.abs(Number(data.amount) - opts.amount) > 0.01
  ) {
    console.warn("[khqrpay.check] amount mismatch", {
      tran: opts.transactionId,
      got: data.amount,
      expected: opts.amount,
    });
    return { paid: false };
  }
  if (
    data.currency !== undefined &&
    String(data.currency).toUpperCase() !== opts.currency.toUpperCase()
  ) {
    console.warn("[khqrpay.check] currency mismatch", {
      tran: opts.transactionId,
      got: data.currency,
      expected: opts.currency,
    });
    return { paid: false };
  }

  return { paid: true };
}
