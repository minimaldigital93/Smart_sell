import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Store } from "@/types";

// Re-export the pure resolver so callers have one import path; the actual impl
// lives in lib/tenant/resolve.ts to stay free of server-only imports (it is
// also used by middleware).
export { resolveStore } from "@/lib/tenant/resolve";
export type { ResolvedStore } from "@/lib/tenant/resolve";

/** Fetch a full store row by id (RLS: superadmin or the store's own members). */
export const getStoreById = cache(async (id: string): Promise<Store | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
});

/**
 * The signed-in user's own store id (profiles.store_id), or null for the
 * superadmin / signed-out visitors. This — not the request-header store — is
 * the tenant identity for ADMIN reads: RLS keys staff access off
 * profiles.store_id, and the platform host resolves headers to the default
 * store, which would be the wrong tenant for a visiting store admin.
 */
export const getMyStoreId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.store_id ?? null;
});

/** The store owned by / belonging to the currently signed-in admin or staff. */
export const getMyStore = cache(async (): Promise<Store | null> => {
  const storeId = await getMyStoreId();
  if (!storeId) return null;
  return getStoreById(storeId);
});
