import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types";
import type { ProductCategoryEnum } from "@/types/database";

export async function listProductsForAdmin(opts: {
  q?: string;
  category?: ProductCategoryEnum;
  includeInactive?: boolean;
  limit?: number;
}): Promise<Product[]> {
  const { q, category, includeInactive = true, limit = 100 } = opts;
  const supabase = await createClient();
  let qb = supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!includeInactive) qb = qb.eq("is_active", true);
  if (category) qb = qb.eq("category", category);
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
  return data ?? [];
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
