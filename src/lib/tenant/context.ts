import { cache } from "react";
import { headers } from "next/headers";
import type { StoreStatus } from "@/lib/constants";

/**
 * Per-request tenant context.
 *
 * The middleware (src/lib/supabase/proxy.ts) resolves the incoming Host or
 * `/s/{slug}` path to a store and forwards the result on these request headers.
 * Server components / actions read it back through {@link getStoreContext}.
 *
 * Header names are exported so the middleware and the reader stay in sync.
 */
export const STORE_ID_HEADER = "x-store-id";
export const STORE_SLUG_HEADER = "x-store-slug";
export const STORE_STATUS_HEADER = "x-store-status";

export type StoreContext = {
  storeId: string;
  slug: string;
  status: StoreStatus;
};

function isStoreStatus(value: string | null): value is StoreStatus {
  return (
    value === "trial" ||
    value === "active" ||
    value === "grace" ||
    value === "locked" ||
    value === "cancelled"
  );
}

/**
 * Resolve the current store from request headers, or null when the request is
 * not bound to a store (platform apex domain, superadmin area, onboarding).
 * Cached per request so multiple readers share one `headers()` lookup.
 */
export const getStoreContext = cache(async (): Promise<StoreContext | null> => {
  const h = await headers();
  const storeId = h.get(STORE_ID_HEADER);
  const slug = h.get(STORE_SLUG_HEADER);
  const status = h.get(STORE_STATUS_HEADER);
  if (!storeId || !slug) return null;
  return {
    storeId,
    slug,
    status: isStoreStatus(status) ? status : "active",
  };
});

/**
 * Like {@link getStoreContext} but returns just the store id, which is what
 * most data services need to scope a query. Null when there is no store.
 */
export async function getCurrentStoreId(): Promise<string | null> {
  const ctx = await getStoreContext();
  return ctx?.storeId ?? null;
}
