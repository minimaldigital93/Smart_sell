"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { movementSchema, minStockSchema } from "@/lib/inventory/schemas";
import { notifyLowStock } from "@/lib/notifications/telegram";

export type InventoryActionResult =
  | { ok: true; resultingStock?: number }
  | { ok: false; error: string };

export async function applyMovementAction(
  input: unknown,
): Promise<InventoryActionResult> {
  const { user } = await requireStaff();
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const v = parsed.data;

  // For 'in' and 'out', quantity must be > 0. For 'adjustment', quantity is
  // the absolute target stock (>= 0).
  if ((v.type === "in" || v.type === "out") && v.quantity <= 0) {
    return { ok: false, error: "Quantity must be positive." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_inventory_movement", {
    p_product_id: v.productId,
    p_movement: v.type,
    p_quantity: v.quantity,
    p_notes: v.notes && v.notes.length > 0 ? v.notes : null,
    p_order_id: null,
    p_created_by: user.id,
    p_barcode_image_url:
      v.barcodeImageUrl && v.barcodeImageUrl.length > 0
        ? v.barcodeImageUrl
        : null,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("insufficient stock")) {
      return { ok: false, error: "Not enough stock on hand." };
    }
    console.error("[inventory.apply]", error);
    return { ok: false, error: "Movement failed. Please retry." };
  }

  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/inventory/products/${v.productId}`);

  // Best-effort low-stock alert after stock-out/adjustment movements.
  const newStock = data as unknown as number;
  if (v.type === "out" || v.type === "adjustment") {
    void (async () => {
      const { data: row } = await supabase
        .from("product_inventory")
        .select("minimum_stock, products(name)")
        .eq("product_id", v.productId)
        .maybeSingle<{
          minimum_stock: number;
          products: { name: string } | null;
        }>();
      if (row && newStock <= row.minimum_stock) {
        await notifyLowStock({
          productId: v.productId,
          productName: row.products?.name ?? "Unknown product",
          currentStock: newStock,
          minimumStock: row.minimum_stock,
        });
      }
    })();
  }

  return { ok: true, resultingStock: newStock };
}

export async function updateMinStockAction(
  input: unknown,
): Promise<InventoryActionResult> {
  await requireStaff();
  const parsed = minStockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_inventory")
    .update({ minimum_stock: parsed.data.minimumStock })
    .eq("product_id", parsed.data.productId);
  if (error) {
    console.error("[inventory.minStock]", error);
    return { ok: false, error: "Could not update minimum stock." };
  }

  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/inventory/products/${parsed.data.productId}`);
  return { ok: true };
}
