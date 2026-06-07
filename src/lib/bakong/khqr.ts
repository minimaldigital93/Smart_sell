import "server-only";
import { getBakongConfig } from "./config";

export type GeneratedKhqr = {
  /** The EMVCo/KHQR payload string to render as a QR code. */
  qr: string;
  /** md5 of the payload — used to poll Bakong for payment status. */
  md5: string;
  /** Our unique bill reference embedded in the QR. */
  billNumber: string;
};

/**
 * Generate a KHQR payment string for a subscription charge. Returns null when
 * Bakong isn't configured so callers can fall back to manual payment.
 * The SDK is imported lazily so it's only loaded on the automated path.
 */
export async function generateSubscriptionKhqr(opts: {
  amountUsd: number;
  billNumber: string;
  storeLabel?: string;
}): Promise<GeneratedKhqr | null> {
  const config = getBakongConfig();
  if (!config) return null;

  const { BakongKHQR, IndividualInfo, khqrData } = await import("bakong-khqr");

  const info = new IndividualInfo(
    config.accountId,
    config.merchantName,
    config.merchantCity,
    {
      currency: khqrData.currency.usd,
      amount: opts.amountUsd,
      billNumber: opts.billNumber,
      storeLabel: opts.storeLabel?.slice(0, 25),
      // 10-minute expiry so a stale QR can't be paid against a closed charge.
      expirationTimestamp: Date.now() + 10 * 60 * 1000,
    },
  );

  const response = new BakongKHQR().generateIndividual(info);
  if (!response.data) return null;

  return {
    qr: response.data.qr,
    md5: response.data.md5,
    billNumber: opts.billNumber,
  };
}

/** A short, unique bill reference: store prefix + timestamp + random. */
export function newBillNumber(storeId: string): string {
  const prefix = storeId.replace(/-/g, "").slice(0, 6);
  return `SUB${prefix}${Date.now().toString(36)}`.toUpperCase();
}
