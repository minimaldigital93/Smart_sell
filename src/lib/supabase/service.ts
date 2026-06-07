import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. Bypasses RLS — SERVER-ONLY. Never import this
 * into a client component and never expose the key to the browser.
 *
 * Used so privileged server actions (e.g. writing a payment screenshot to the
 * locked-down payment-proofs bucket) don't depend on an anon/authenticated
 * storage policy that a direct API call could also exploit.
 *
 * Returns null when the key isn't configured so callers can degrade gracefully
 * during a rollout rather than hard-failing.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
