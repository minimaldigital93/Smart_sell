import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStoreId } from "@/lib/tenant/context";
import type { ShopCategory } from "@/types";

export type CategorySortKey =
  | "order"
  | "name"
  | "created"
  | "updated"
  | "products";

export type ListCategoriesOptions = {
  q?: string;
  status?: "active" | "inactive" | "all";
  sort?: CategorySortKey;
  page?: number;
  pageSize?: number;
};

export type CategoryListItem = ShopCategory & { product_count: number };

export type ListCategoriesResult = {
  rows: CategoryListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const SORT_COLUMN: Record<
  Exclude<CategorySortKey, "products">,
  { column: string; ascending: boolean }
> = {
  order: { column: "display_order", ascending: true },
  name: { column: "name", ascending: true },
  created: { column: "created_at", ascending: false },
  updated: { column: "updated_at", ascending: false },
};

/**
 * Admin category list — store-scoped, excludes soft-deleted rows, with the
 * per-category assigned-product count, search, status filter, sort, and
 * pagination resolved server-side.
 */
export async function listCategoriesForAdmin(
  opts: ListCategoriesOptions = {},
): Promise<ListCategoriesResult> {
  const {
    q,
    status = "all",
    sort = "order",
    page = 1,
    pageSize = 20,
  } = opts;
  const supabase = await createClient();
  const storeId = await getCurrentStoreId();

  let query = supabase
    .from("shop_categories")
    .select("*", { count: "exact" })
    .is("deleted_at", null);
  if (storeId) query = query.eq("store_id", storeId);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);
  if (q && q.trim()) {
    const escaped = q.trim().replace(/[%_]/g, (m) => `\\${m}`);
    const pattern = `%${escaped}%`;
    query = query.or(`name.ilike.${pattern},description.ilike.${pattern}`);
  }

  // The "products" sort happens in JS after counts are merged in; for every
  // other sort we let Postgres order, with a stable secondary key on name.
  if (sort !== "products") {
    const { column, ascending } = SORT_COLUMN[sort];
    query = query.order(column, { ascending });
    if (column !== "name") query = query.order("name", { ascending: true });
  } else {
    query = query.order("display_order", { ascending: true });
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("[categories.listForAdmin]", error);
    return { rows: [], total: 0, page, pageSize };
  }

  const categories = (data ?? []) as ShopCategory[];
  const counts = await productCountsByCategory(
    storeId,
    categories.map((c) => c.id),
  );

  let rows: CategoryListItem[] = categories.map((c) => ({
    ...c,
    product_count: counts.get(c.id) ?? 0,
  }));
  if (sort === "products") {
    rows = rows.sort((a, b) => b.product_count - a.product_count);
  }

  return { rows, total: count ?? rows.length, page, pageSize };
}

/** Tally assigned products per category id, in one query, scoped to the store. */
async function productCountsByCategory(
  storeId: string | null,
  categoryIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (categoryIds.length === 0) return map;
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("category_id")
    .in("category_id", categoryIds);
  if (storeId) query = query.eq("store_id", storeId);
  const { data, error } = await query;
  if (error) {
    console.error("[categories.productCounts]", error);
    return map;
  }
  for (const row of (data ?? []) as { category_id: string | null }[]) {
    if (!row.category_id) continue;
    map.set(row.category_id, (map.get(row.category_id) ?? 0) + 1);
  }
  return map;
}

export async function getCategory(id: string): Promise<ShopCategory | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_categories")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<ShopCategory>();
  if (error) {
    console.error("[categories.get]", error);
    return null;
  }
  return data;
}

/** Active categories for the current store, ordered for dropdowns/storefront. */
export const listActiveCategories = cache(
  async (): Promise<ShopCategory[]> => {
    const supabase = await createClient();
    const storeId = await getCurrentStoreId();
    let query = supabase
      .from("shop_categories")
      .select("*")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    if (storeId) query = query.eq("store_id", storeId);
    const { data, error } = await query;
    if (error) {
      console.error("[categories.listActive]", error);
      return [];
    }
    return (data ?? []) as ShopCategory[];
  },
);

/** A single active category by slug, scoped to the store (storefront pages). */
export async function getActiveCategoryBySlug(
  slug: string,
): Promise<ShopCategory | null> {
  const supabase = await createClient();
  const storeId = await getCurrentStoreId();
  let query = supabase
    .from("shop_categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .is("deleted_at", null);
  if (storeId) query = query.eq("store_id", storeId);
  const { data, error } = await query.maybeSingle<ShopCategory>();
  if (error) {
    console.error("[categories.getBySlug]", error);
    return null;
  }
  return data;
}

/** Count of products assigned to a category (any status) — delete guard. */
export async function countProductsInCategory(id: string): Promise<number> {
  const supabase = await createClient();
  const storeId = await getCurrentStoreId();
  let query = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if (storeId) query = query.eq("store_id", storeId);
  const { count, error } = await query;
  if (error) {
    console.error("[categories.countProducts]", error);
    // Fail closed: treat as in-use so we never orphan products on error.
    return 1;
  }
  return count ?? 0;
}
