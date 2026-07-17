import "server-only";
import type { KhqrCredentials } from "@/lib/khqrpay/types";

/**
 * khqr.cc (KHQRPay) configuration. Platform-level credentials (used for store
 * subscription billing) come from env; per-store merchant credentials live in
 * store_payment_settings (see credentials.ts).
 */

export const KHQRPAY_DEFAULT_BASE_URL = "https://khqr.cc";

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Minutes a minted QR / checkout link stays payable. */
export function qrTtlMinutes(): number {
  return intEnv("KHQRPAY_QR_TTL_MINUTES", 30);
}

/** Minimum seconds between live verify calls for the same transaction. */
export function verifyCooldownSeconds(): number {
  return intEnv("KHQRPAY_VERIFY_COOLDOWN_SECONDS", 4);
}

/** Maximum accepted webhook req_time skew. */
export function webhookToleranceSeconds(): number {
  return intEnv("KHQRPAY_WEBHOOK_TOLERANCE_SECONDS", 600);
}

/**
 * Demo mode: local KHQR payloads + auto-confirm ~8s after mint. Force-disabled
 * in production builds regardless of env (mirrors AMS).
 */
export function isDemoMode(): boolean {
  return (
    process.env.KHQRPAY_DEMO === "true" && process.env.NODE_ENV !== "production"
  );
}

/** Seconds after mint at which a demo payment auto-confirms. */
export const DEMO_CONFIRM_AFTER_SECONDS = 8;

export function khqrpayBaseUrl(): string {
  return (process.env.KHQRPAY_BASE_URL || KHQRPAY_DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
}

/**
 * Platform khqr.cc credentials (subscription billing). Null when unconfigured
 * — callers fall back to the manual-proof flow.
 */
export function platformCredentials(): KhqrCredentials | null {
  const profileId = process.env.KHQRPAY_PROFILE_ID;
  const secret = process.env.KHQRPAY_SECRET;
  if (!profileId || !secret) return null;
  const currency = process.env.KHQRPAY_CURRENCY === "KHR" ? "KHR" : "USD";
  return { baseUrl: khqrpayBaseUrl(), profileId, secret, currency };
}
