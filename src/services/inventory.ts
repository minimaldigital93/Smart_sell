import { createClient } from "@/lib/supabase/server";
import { getSignedStorageUrl } from "@/lib/storage/signed-url";
import { getMyStoreId } from "@/services/stores";
import { escapeLikePattern } from "@/lib/utils";
import type { MovementTypeEnum } from "@/types/database";
import type { InventoryMovement, ProductInventory } from "@/types";

export type InventoryStats = {
  active_products: number;
  total_units: number;
  low_stock_count: number;
  out_of_stock_count: number;
};

export type InventoryRow = ProductInventory & {
  product: {
    id: string;
    name: string;
    slug: string;
    images: string[];
    category: string;
    is_active: boolean;
  } | null;
};

export type MovementWithProduct = InventoryMovement & {
  product: { id: string; name: string; slug: string; images: string[] } | null;
};

export async function applyInventoryMovement(params: {
  productId: string;
  type: MovementTypeEnum;
  quantity: number;
  notes?: string | null;
  orderId?: string | null;
}): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_inventory_movement", {
    p_product_id: params.productId,
    p_movement: params.type,
    p_quantity: params.quantity,
    p_notes: params.notes ?? null,
    p_order_id: params.orderId ?? null,
  });
  if (error) throw error;
  return data as unknown as number;
}

export async function getInventoryStats(): Promise<InventoryStats> {
  // v_admin_dashboard is store-scoped (0044) and already aggregates all four
  // numbers — one row instead of scanning product_inventory in JS.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_admin_dashboard")
    .select("active_products, total_units, low_stock_count, out_of_stock_count")
    .maybeSingle<InventoryStats>();

  if (error || !data) {
    if (error) console.error("[inventory.stats]", error);
    return {
      active_products: 0,
      total_units: 0,
      low_stock_count: 0,
      out_of_stock_count: 0,
    };
  }
  return {
    active_products: data.active_products ?? 0,
    total_units: Number(data.total_units ?? 0),
    low_stock_count: data.low_stock_count ?? 0,
    out_of_stock_count: data.out_of_stock_count ?? 0,
  };
}

export async function listInventory(opts: {
  q?: string;
  lowOnly?: boolean;
  limit?: number;
}): Promise<InventoryRow[]> {
  const { q, lowOnly = false, limit = 50 } = opts;
  const supabase = await createClient();
  // product_inventory is publicly readable (storefront stock badges), so the
  // store filter here is what keeps one store's inventory page from listing
  // the whole platform's stock (audit C3).
  const storeId = await getMyStoreId();
  let qb = supabase
    .from("product_inventory")
    .select(
      "*, product:products!inner(id, name, slug, images, category, is_active)",
    )
    .order("current_stock", { ascending: true })
    .limit(limit);

  if (storeId) qb = qb.eq("store_id", storeId);
  if (q && q.trim()) {
    const pattern = `%${escapeLikePattern(q)}%`;
    qb = qb.or(`name.ilike.${pattern}`, { referencedTable: "products" });
  }

  const { data, error } = await qb;
  if (error) {
    console.error("[inventory.list]", error);
    return [];
  }
  const rows = (data ?? []) as unknown as InventoryRow[];
  return lowOnly
    ? rows.filter((r) => r.current_stock <= r.minimum_stock)
    : rows;
}

export async function getInventory(productId: string): Promise<ProductInventory | null> {
  const supabase = await createClient();
  const storeId = await getMyStoreId();
  let qb = supabase
    .from("product_inventory")
    .select("*")
    .eq("product_id", productId);
  if (storeId) qb = qb.eq("store_id", storeId);
  const { data, error } = await qb.maybeSingle();
  if (error) {
    console.error("[inventory.get]", error);
    return null;
  }
  return data;
}

export async function listMovements(opts: {
  productId?: string;
  before?: string; // ISO timestamp cursor
  limit?: number;
}): Promise<MovementWithProduct[]> {
  const { productId, before, limit = 30 } = opts;
  const supabase = await createClient();
  const storeId = await getMyStoreId();
  let qb = supabase
    .from("inventory_movements")
    .select("*, product:products(id, name, slug, images)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (storeId) qb = qb.eq("store_id", storeId);
  if (productId) qb = qb.eq("product_id", productId);
  if (before) qb = qb.lt("created_at", before);

  const { data, error } = await qb;
  if (error) {
    console.error("[inventory.movements]", error);
    return [];
  }
  const rows = (data ?? []) as unknown as MovementWithProduct[];

  // movement-proofs is a private bucket — swap the stored reference for a
  // short-lived signed URL the (staff) viewer can actually load.
  return Promise.all(
    rows.map(async (m) => ({
      ...m,
      barcode_image_url: await getSignedStorageUrl(
        "movement-proofs",
        m.barcode_image_url,
      ),
    })),
  );
}
