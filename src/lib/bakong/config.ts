/**
 * Bakong KHQR configuration. Reads merchant + API credentials from the
 * environment. When any required value is missing, isBakongConfigured() returns
 * false and the subscription flow falls back to manual upload + superadmin
 * approval (same env-gated pattern as lib/notifications/telegram.ts).
 *
 * Required env (server-only):
 *   BAKONG_ACCOUNT_ID     e.g. "yourname@aclb" (Bakong account that receives pay)
 *   BAKONG_MERCHANT_NAME  display name on the QR
 *   BAKONG_API_TOKEN      developer token from api-bakong.nbc.gov.kh
 * Optional:
 *   BAKONG_MERCHANT_CITY  default "Phnom Penh"
 *   BAKONG_API_BASE       default "https://api-bakong.nbc.gov.kh"
 */
export type BakongConfig = {
  accountId: string;
  merchantName: string;
  merchantCity: string;
  apiToken: string;
  apiBase: string;
};

export function getBakongConfig(): BakongConfig | null {
  const accountId = process.env.BAKONG_ACCOUNT_ID;
  const merchantName = process.env.BAKONG_MERCHANT_NAME;
  const apiToken = process.env.BAKONG_API_TOKEN;
  if (!accountId || !merchantName || !apiToken) return null;
  return {
    accountId,
    merchantName,
    merchantCity: process.env.BAKONG_MERCHANT_CITY || "Phnom Penh",
    apiToken,
    apiBase: process.env.BAKONG_API_BASE || "https://api-bakong.nbc.gov.kh",
  };
}

export function isBakongConfigured(): boolean {
  return getBakongConfig() !== null;
}
