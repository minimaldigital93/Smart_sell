"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { PAYMENT_METHODS } from "@/lib/constants";

const counterSaleSchema = z.object({
  payment_method: z.enum(PAYMENT_METHODS),
  customer_name: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .min(1, "Add at least one item"),
});

export type SubmitCounterSaleResult =
  | { ok: true; orderId: string; total: number }
  | { ok: false; error: string };

export async function submitCounterSaleAction(
  input: unknown,
): Promise<SubmitCounterSaleResult> {
  const { user } = await requireStaff();

  const parsed = counterSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid sale",
    };
  }
  const v = parsed.data;

  const supabase = await createClient();

  // Re-fetch prices server-side — never trust the client.
  const productIds = [...new Set(v.items.map((i) => i.productId))];
  const { data: products, error: productsErr } = await supabase
    .from("products")
    .select("id, name, price, discount_price, is_active")
    .in("id", productIds);
  if (productsErr || !products) {
    return { ok: false, error: "Could not load products." };
  }
  const byId = new Map(products.map((p) => [p.id, p]));

  // Pre-validate stock so we never create a phantom order we can't fulfil.
  const { data: invRows } = await supabase
    .from("product_inventory")
    .select("product_id, current_stock")
    .in("product_id", productIds);
  const stockById = new Map(
    (invRows ?? []).map((r) => [r.product_id, r.current_stock]),
  );

  let subtotal = 0;
  const lineItems: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    price: number;
  }> = [];
  for (const line of v.items) {
    const p = byId.get(line.productId);
    if (!p || !p.is_active) {
      return { ok: false, error: `${p?.name ?? "Item"} is unavailable.` };
    }
    // Postgres numeric → string; coerce, and treat a 0 discount as "no discount".
    const priceNum = Number(p.price);
    const discountNum = p.discount_price == null ? 0 : Number(p.discount_price);
    const unit =
      discountNum > 0 && discountNum < priceNum ? discountNum : priceNum;
    if (!(unit > 0)) {
      return { ok: false, error: `${p.name} has no price set.` };
    }
    const stock = stockById.get(p.id) ?? 0;
    if (stock < line.quantity) {
      return {
        ok: false,
        error: `Not enough stock for ${p.name} (${stock} left).`,
      };
    }
    subtotal += unit * line.quantity;
    lineItems.push({
      product_id: p.id,
      product_name: p.name,
      quantity: line.quantity,
      price: unit,
    });
  }
  subtotal = Number(subtotal.toFixed(2));
  const total = subtotal; // no shipping, no discount for counter sales

  const orderId = randomUUID();
  const customerName = v.customer_name?.trim() || "Walk-in customer";
  const phone = v.phone?.trim() || "—";
  const noteParts = ["Counter sale"];
  if (v.note?.trim()) noteParts.push(v.note.trim());

  // 1. Insert as pending so the inventory trigger fires on the status flip.
  const { error: orderErr } = await supabase.from("orders").insert({
    id: orderId,
    user_id: user.id,
    customer_name: customerName,
    phone,
    address: "In-store pickup",
    note: noteParts.join(" — "),
    subtotal,
    shipping_fee: 0,
    discount: 0,
    total,
    payment_method: v.payment_method,
    payment_image: null,
  });
  if (orderErr) {
    console.error("[pos.submit] order insert", orderErr);
    return {
      ok: false,
      error: `Could not save sale: ${orderErr.message}`,
    };
  }

  // Delete the half-built order (items cascade) so a failure never leaves a
  // phantom 'pending' sale polluting the orders list / dashboard KPIs.
  const discardOrder = () => supabase.from("orders").delete().eq("id", orderId);

  const { error: itemsErr } = await supabase
    .from("order_items")
    .insert(lineItems.map((li) => ({ ...li, order_id: orderId })));
  if (itemsErr) {
    console.error("[pos.submit] items insert", itemsErr);
    await discardOrder();
    return { ok: false, error: "Could not save sale items. Please retry." };
  }

  // 2. Flip status -> payment_confirmed; trigger decrements stock atomically.
  const { error: statusErr } = await supabase
    .from("orders")
    .update({ status: "payment_confirmed" })
    .eq("id", orderId);
  if (statusErr) {
    const msg = statusErr.message ?? "";
    await discardOrder();
    if (msg.includes("insufficient stock")) {
      return {
        ok: false,
        error: "Not enough stock for one or more items.",
      };
    }
    console.error("[pos.submit] status update", statusErr);
    return { ok: false, error: "Could not finalize sale." };
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");

  return { ok: true, orderId, total };
}
