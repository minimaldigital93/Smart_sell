import { createClient } from "@/lib/supabase/server";
import type { Product, ProductWithCategory } from "@/types";

export async function listProductsForAdmin(opts: {
  q?: string;
  category?: string;
  includeInactive?: boolean;
  limit?: number;
}): Promise<ProductWithCategory[]> {
  const { q, category, includeInactive = true, limit = 100 } = opts;
  const supabase = await createClient();
  let qb = supabase
    .from("products")
    .select("*, shop_categories(id, name, slug, icon, color)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!includeInactive) qb = qb.eq("is_active", true);
  if (category) qb = qb.eq("category_id", category);
  if (q && q.trim()) {
    const escaped = q.trim().replace(/[%_]/g, (m) => `\\${m}`);
    const pattern = `%${escaped}%`;
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
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[products-admin.byId]", error);
    return null;
  }
  return data;
}
