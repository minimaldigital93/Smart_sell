"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import type { Product, ProductInventory } from "@/types";

export type ScanLookupResult =
  | {
      ok: true;
      product: Pick<
        Product,
        | "id"
        | "name"
        | "slug"
        | "images"
        | "price"
        | "discount_price"
        | "barcode"
        | "sku"
        | "is_active"
      >;
      inventory: Pick<ProductInventory, "current_stock" | "minimum_stock">;
    }
  | { ok: false; error: string };

export async function lookupProductByBarcodeAction(
  barcode: string,
): Promise<ScanLookupResult> {
  await requireStaff();
  const normalized = barcode.trim();
  if (!normalized) return { ok: false, error: "Empty barcode" };

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, images, price, discount_price, barcode, sku, is_active",
    )
    .eq("barcode", normalized)
    .maybeSingle();

  if (error) {
    console.error("[scan.lookup]", error);
    return { ok: false, error: "Lookup failed. Please retry." };
  }
  if (!product) {
    return { ok: false, error: `No product with barcode ${normalized}` };
  }

  const { data: inv } = await supabase
    .from("product_inventory")
    .select("current_stock, minimum_stock")
    .eq("product_id", product.id)
    .maybeSingle();

  return {
    ok: true,
    product,
    inventory: { current_stock: inv?.current_stock ?? 0, minimum_stock: inv?.minimum_stock ?? 0 },
  };
}
