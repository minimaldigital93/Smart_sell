import { createClient } from "@/lib/supabase/server";
import { getMyStoreId } from "@/services/stores";
import { escapeLikePattern } from "@/lib/utils";
import type { Product, ProductWithCategory } from "@/types";

export async function listProductsForAdmin(opts: {
  q?: string;
  category?: string;
  includeInactive?: boolean;
  limit?: number;
}): Promise<ProductWithCategory[]> {
  const { q, category, includeInactive = true, limit = 100 } = opts;
  const supabase = await createClient();
  // Defense in depth vs. the public catalog-read RLS clause: without this a
  // store's product table would include every other store's active products
  // (audit C3). Superadmin (no store) keeps the platform-wide view.
  const storeId = await getMyStoreId();
  let qb = supabase
    .from("products")
    .select("*, shop_categories(id, name, slug, icon, color)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (storeId) qb = qb.eq("store_id", storeId);
  if (!includeInactive) qb = qb.eq("is_active", true);
  if (category) qb = qb.eq("category_id", category);
  if (q && q.trim()) {
    const pattern = `%${escapeLikePattern(q)}%`;
    qb = qb.or(
      `name.ilike.${pattern},description.ilike.${pattern},sku.ilike.${pattern},barcode.ilike.${pattern}`,
    );
  }

  const { data, error } = await qb;
  if (error) {
    console.error("[products-admin.list]", error);
    return [];
  }
  return (data ?? []) as ProductWithCategory[];
}

export async function getProductByIdAdmin(id: string): Promise<Product | null> {
  const supabase = await createClient();
  const storeId = await getMyStoreId();
  let qb = supabase.from("products").select("*").eq("id", id);
  if (storeId) qb = qb.eq("store_id", storeId);
  const { data, error } = await qb.maybeSingle();
  if (error) {
    console.error("[products-admin.byId]", error);
    return null;
  }
  return data;
}
