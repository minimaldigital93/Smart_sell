import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { StoreStatus } from "@/lib/constants";

/**
 * Pure tenant-resolution helper (no server-only imports) so it is safe to call
 * from middleware as well as server components. Maps an incoming Host (custom
 * domain) or `/s/{slug}` path to a store via the anon-safe resolve_store RPC.
 */
export type ResolvedStore = {
  id: string;
  slug: string;
  status: StoreStatus;
};

export async function resolveStore(
  client: SupabaseClient<Database>,
  opts: { host?: string | null; slug?: string | null },
): Promise<ResolvedStore | null> {
  const host = opts.host ?? null;
  const slug = opts.slug ?? null;
  if (!host && !slug) return null;

  const { data, error } = await client.rpc("resolve_store", {
    p_host: host,
    p_slug: slug,
  });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return { id: row.id, slug: row.slug, status: row.status };
}
