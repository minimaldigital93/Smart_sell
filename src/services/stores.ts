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

/** The store owned by / belonging to the currently signed-in admin or staff. */
export const getMyStore = cache(async (): Promise<Store | null> => {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.store_id) return null;
  return getStoreById(profile.store_id);
});
