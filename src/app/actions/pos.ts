"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/auth/session";
import { requirePlanCapability } from "@/lib/billing/capabilities";
import { requestOrigin } from "@/lib/http/origin";
import { mintOrderKhqrPayment } from "@/services/payments";
import { CHECKOUT_PAYMENT_METHODS } from "@/lib/constants";

const counterSaleSchema = z.object({
  payment_method: z.enum(CHECKOUT_PAYMENT_METHODS),
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

export type PosKhqrPayment = {
  token: string;
  status: "pending" | "qr_generated" | "waiting_payment";
  expiresAt: string | null;
  checkoutUrl: string | null;
  qrPayload: string | null;
};

export type SubmitCounterSaleResult =
  | { ok: true; orderId: string; total: number; khqr?: PosKhqrPayment }
  | { ok: false; error: string };

export async function submitCounterSaleAction(
  input: unknown,
): Promise<SubmitCounterSaleResult> {
  const { user } = await requireStaff();
  const gate = await requirePlanCapability("pos");
  if (!gate.ok) return { ok: false, error: gate.error };

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

  // 2a. KHQR at the till: keep the order pending and mint a payment attempt —
  //     the QR panel polls it and finalize (webhook/poll) confirms the order,
  //     which deducts stock. No manual status flip.
  if (v.payment_method === "khqr") {
    const { data: orderRow } = await supabase
      .from("orders")
      .select("store_id")
      .eq("id", orderId)
      .single();
    if (!orderRow) {
      await discardOrder();
      return { ok: false, error: "Could not load the sale. Please retry." };
    }
    const minted = await mintOrderKhqrPayment(
      { id: orderId, store_id: orderRow.store_id, total },
      { origin: await requestOrigin() },
    );
    if (!minted.ok) {
      await discardOrder();
      return { ok: false, error: minted.error };
    }
    revalidatePath("/admin/orders");
    return {
      ok: true,
      orderId,
      total,
      khqr: {
        token: minted.payment.public_token,
        status: "qr_generated",
        expiresAt: minted.payment.expires_at,
        checkoutUrl: minted.payment.checkout_url,
        qrPayload: minted.payment.qr_payload,
      },
    };
  }

  // 2b. Cash: flip status -> payment_confirmed; trigger decrements stock
  //     atomically. Then record the settled cash payment (cashier + time).
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

  const service = createServiceClient();
  if (service) {
    const { data: orderRow } = await service
      .from("orders")
      .select("store_id")
      .eq("id", orderId)
      .single();
    if (orderRow) {
      const { error: payErr } = await service.from("order_payments").insert({
        store_id: orderRow.store_id,
        order_id: orderId,
        method: "cash",
        status: "paid",
        amount: total,
        paid_at: new Date().toISOString(),
        received_by: user.id,
      });
      if (payErr) console.error("[pos.submit] payment row", payErr);
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");

  return { ok: true, orderId, total };
}
