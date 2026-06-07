import "server-only";
import { getBakongConfig } from "./config";

export type BakongCheckResult =
  | { status: "paid"; txnRef: string | null }
  | { status: "unpaid" }
  | { status: "unavailable" };

/**
 * Ask Bakong whether the payment for a given KHQR md5 has settled, via the
 * Bakong Open API. Returns "unavailable" when Bakong isn't configured or the
 * request errors, so the caller can keep polling or fall back to manual.
 *
 * Endpoint: POST {base}/v1/check_transaction_by_md5
 *   header: Authorization: Bearer <token>
 *   body:   { "md5": "<md5>" }
 *   responseCode === 0 means the transaction was found (paid).
 */
export async function checkTransactionByMd5(
  md5: string,
): Promise<BakongCheckResult> {
  const config = getBakongConfig();
  if (!config) return { status: "unavailable" };

  try {
    const res = await fetch(`${config.apiBase}/v1/check_transaction_by_md5`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiToken}`,
      },
      body: JSON.stringify({ md5 }),
      cache: "no-store",
    });

    if (!res.ok) return { status: "unavailable" };
    const json = (await res.json()) as {
      responseCode?: number;
      data?: { hash?: string; externalRef?: string } | null;
    };

    if (json.responseCode === 0) {
      return {
        status: "paid",
        txnRef: json.data?.externalRef ?? json.data?.hash ?? null,
      };
    }
    // Any non-zero responseCode (e.g. transaction not found yet) = still unpaid.
    return { status: "unpaid" };
  } catch {
    return { status: "unavailable" };
  }
}
