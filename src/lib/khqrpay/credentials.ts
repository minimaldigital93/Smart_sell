import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { khqrpayBaseUrl } from "@/lib/khqrpay/config";
import type { KhqrCredentials } from "@/lib/khqrpay/types";

/**
 * Per-store khqr.cc merchant credentials, read through the SERVICE-ROLE client
 * only — store_payment_settings has RLS enabled with no policies, so the
 * secrets are unreachable from any anon/authenticated session. Never return
 * these to a client component.
 */
export async function credentialsForStore(
  storeId: string,
): Promise<KhqrCredentials | null> {
  const service = createServiceClient();
  if (!service) return null;

  const { data } = await service
    .from("store_payment_settings")
    .select("khqrpay_enabled, khqrpay_profile_id, khqrpay_secret, currency")
    .eq("store_id", storeId)
    .maybeSingle();

  if (
    !data?.khqrpay_enabled ||
    !data.khqrpay_profile_id ||
    !data.khqrpay_secret
  ) {
    return null;
  }

  return {
    baseUrl: khqrpayBaseUrl(),
    profileId: data.khqrpay_profile_id,
    secret: data.khqrpay_secret,
    currency: data.currency === "KHR" ? "KHR" : "USD",
  };
}
