import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStoreId } from "@/lib/tenant/context";
import type { Product } from "@/types";
import type { Database, ProductCategoryEnum } from "@/types/database";

/**
 * Base storefront query: active products scoped to the current store. Anonymous
 * RLS lets any store's active products be read, so the store filter is what
 * actually isolates one shop's catalog from another's. Synchronous (not async)
 * so the returned query builder isn't auto-resolved by an async return.
 */
function activeProducts(
  supabase: SupabaseClient<Database>,
  storeId: string | null,
) {
  const q = supabase.from("products").select("*").eq("is_active", true);
  return storeId ? q.eq("store_id", storeId) : q;
}

async function ctx() {
  return {
    supabase: await createClient(),
    storeId: await getCurrentStoreId(),
  };
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const { supabase, storeId } = await ctx();
  const { data, error } = await activeProducts(supabase, storeId)
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
  const { supabase, storeId } = await ctx();
  const { data, error } = await activeProducts(supabase, storeId)
    .eq("on_sale", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[products.getPromos]", error);
    return [];
  }
  return data ?? [];
}

export async function getNewArrivalProducts(limit = 8): Promise<Product[]> {
  const { supabase, storeId } = await ctx();
  const { data, error } = await activeProducts(supabase, storeId)
    .eq("new_arrival", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[products.getNewArrivals]", error);
    return [];
  }
  return data ?? [];
}

export async function getAllProducts(limit = 48): Promise<Product[]> {
  const { supabase, storeId } = await ctx();
  const { data, error } = await activeProducts(supabase, storeId)
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
  const { supabase, storeId } = await ctx();
  const { data, error } = await activeProducts(supabase, storeId)
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
  const { supabase, storeId } = await ctx();
  const { data, error } = await activeProducts(supabase, storeId)
    .eq("slug", slug)
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
  const { supabase, storeId } = await ctx();
  let q = supabase.from("products").select("*").eq("barcode", barcode);
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q.maybeSingle();
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
  const { supabase, storeId } = await ctx();
  const { data, error } = await activeProducts(supabase, storeId)
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
  const qstr = query.trim();
  if (!qstr) return [];

  // ILIKE on name and description. Escape % and _ to prevent unintended wildcards.
  const escaped = qstr.replace(/[%_]/g, (m) => `\\${m}`);
  const pattern = `%${escaped}%`;

  const { supabase, storeId } = await ctx();
  const { data, error } = await activeProducts(supabase, storeId)
    .or(`name.ilike.${pattern},description.ilike.${pattern}`)
    .order("featured", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[products.search]", error);
    return [];
  }
  return data ?? [];
}
