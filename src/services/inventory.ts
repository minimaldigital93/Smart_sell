import { createClient } from "@/lib/supabase/server";
import { getSignedStorageUrl } from "@/lib/storage/signed-url";
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
  const supabase = await createClient();
  const [{ count: active }, { data: stockAgg }, { count: low }, { count: out }] =
    await Promise.all([
      supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabase.from("product_inventory").select("current_stock"),
      supabase
        .from("product_inventory")
        .select("*", { count: "exact", head: true })
        .lte("current_stock", 999999) // placeholder; filtered in JS below
        .order("current_stock"),
      supabase
        .from("product_inventory")
        .select("*", { count: "exact", head: true })
        .eq("current_stock", 0),
    ]);

  const total_units =
    (stockAgg ?? []).reduce((s, r) => s + (r.current_stock ?? 0), 0) ?? 0;

  // Re-derive low-stock count properly (current_stock <= minimum_stock).
  const { count: lowExact } = await supabase
    .from("v_low_stock_products" as never)
    .select("*", { count: "exact", head: true });

  return {
    active_products: active ?? 0,
    total_units,
    low_stock_count: lowExact ?? low ?? 0,
    out_of_stock_count: out ?? 0,
  };
}

export async function listInventory(opts: {
  q?: string;
  lowOnly?: boolean;
  limit?: number;
}): Promise<InventoryRow[]> {
  const { q, lowOnly = false, limit = 50 } = opts;
  const supabase = await createClient();
  let qb = supabase
    .from("product_inventory")
    .select(
      "*, product:products!inner(id, name, slug, images, category, is_active)",
    )
    .order("current_stock", { ascending: true })
    .limit(limit);

  if (q && q.trim()) {
    const escaped = q.trim().replace(/[%_]/g, (m) => `\\${m}`);
    const pattern = `%${escaped}%`;
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
  const { data, error } = await supabase
    .from("product_inventory")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();
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
  let qb = supabase
    .from("inventory_movements")
    .select("*, product:products(id, name, slug, images)")
    .order("created_at", { ascending: false })
    .limit(limit);

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
