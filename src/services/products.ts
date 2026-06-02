import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types";
import type { ProductCategoryEnum } from "@/types/database";

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[products.getFeatured]", error);
    return [];
  }
  return data ?? [];
}

export async function getPromoProducts(limit = 8): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .not("discount_price", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[products.getPromos]", error);
    return [];
  }
  return data ?? [];
}

export async function getAllProducts(limit = 48): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[products.getAll]", error);
    return [];
  }
  return data ?? [];
}

export async function getProductsByCategory(
  category: ProductCategoryEnum,
  limit = 48,
): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("category", category)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[products.byCategory]", error);
    return [];
  }
  return data ?? [];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[products.bySlug]", error);
    return null;
  }
  return data;
}

export async function getProductByBarcode(
  barcode: string,
): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("barcode", barcode)
    .maybeSingle();

  if (error) {
    console.error("[products.byBarcode]", error);
    return null;
  }
  return data;
}

export async function getRelatedProducts(
  product: Pick<Product, "id" | "category">,
  limit = 6,
): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("category", product.category)
    .neq("id", product.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[products.related]", error);
    return [];
  }
  return data ?? [];
}

export async function searchProducts(query: string, limit = 36): Promise<Product[]> {
  const q = query.trim();
  if (!q) return [];

  // ILIKE on name and description. Postgres handles the OR cleanly. Escape
  // % and _ to prevent unintended wildcards.
  const escaped = q.replace(/[%_]/g, (m) => `\\${m}`);
  const pattern = `%${escaped}%`;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .or(`name.ilike.${pattern},description.ilike.${pattern}`)
    .order("featured", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[products.search]", error);
    return [];
  }
  return data ?? [];
}
