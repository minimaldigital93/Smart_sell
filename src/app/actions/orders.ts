"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { submitOrderSchema } from "@/lib/checkout/schemas";
import { SHIPPING_FEE_DEFAULT } from "@/lib/constants";
import { requireStaff } from "@/lib/auth/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { notifyNewOrder } from "@/lib/notifications/telegram";
import { findActiveCouponByCode } from "@/services/coupons";
import { computeDiscount } from "@/lib/coupons/schemas";
import { pointsToUsd, POINTS_PER_DOLLAR_CREDIT } from "@/lib/loyalty/constants";
import { updateOrderStatusSchema } from "@/lib/orders/schemas";
import { canTransition } from "@/lib/orders/transitions";

export type SubmitOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

export type UpdateOrderStatusResult =
  | { ok: true }
  | { ok: false; error: string };

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB (matches storage bucket)
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
]);

export async function submitOrderAction(
  formData: FormData,
): Promise<SubmitOrderResult> {
  const limited = await checkRateLimit("orders:submit", 10, 600);
  if (!limited.ok) {
    return { ok: false, error: rateLimitMessage(limited.retryAfterSec) };
  }
  // 1. Parse + validate form fields
  const itemsRaw = formData.get("items");
  let items: Array<{ productId: string; quantity: number }> = [];
  try {
    items = JSON.parse(typeof itemsRaw === "string" ? itemsRaw : "[]");
  } catch {
    return { ok: false, error: "Cart could not be read." };
  }

  const parsed = submitOrderSchema.safeParse({
    customer_name: formData.get("customer_name"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    note: formData.get("note") || undefined,
    payment_method: formData.get("payment_method"),
    items,
    coupon_code: (formData.get("coupon_code") as string | null) || undefined,
  points_to_redeem: Number(formData.get("points_to_redeem") ?? 0) || 0,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please review your details.",
    };
  }
  const values = parsed.data;

  // 2. Re-fetch products by ID — never trust client prices
  const supabase = await createClient();
  const productIds = [...new Set(values.items.map((i) => i.productId))];
  const { data: products, error: productsErr } = await supabase
    .from("products")
    .select("id, name, price, discount_price, is_active")
    .in("id", productIds);

  if (productsErr || !products) {
    return { ok: false, error: "Could not load products." };
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  let subtotal = 0;
  const lineItems = values.items.map((line) => {
    const p = byId.get(line.productId);
    if (!p || !p.is_active) {
      throw new Error(`Product ${line.productId} is no longer available.`);
    }
    // Postgres numeric → string; coerce, and treat a 0 discount as "no discount".
    const priceNum = Number(p.price);
    const discountNum = p.discount_price == null ? 0 : Number(p.discount_price);
    const unit =
      discountNum > 0 && discountNum < priceNum ? discountNum : priceNum;
    if (!(unit > 0)) {
      throw new Error(`${p.name} has no price set.`);
    }
    const totalLine = Number((unit * line.quantity).toFixed(2));
    subtotal += totalLine;
    return {
      product_id: p.id,
      product_name: p.name,
      quantity: line.quantity,
      price: unit,
    };
  });
  subtotal = Number(subtotal.toFixed(2));
  const shipping = SHIPPING_FEE_DEFAULT;

  // Resolve the logged-in user early — needed for both points and order insert.
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  // 2b. Validate coupon (server-side recompute — client value is untrusted).
  // We DO NOT increment redeemed_count yet; that happens after the order +
  // items have been persisted, so a later failure can't burn a redemption.
  let couponDiscount = 0;
  let couponId: string | null = null;
  let couponCode: string | null = null;
  const submittedCode = values.coupon_code?.toUpperCase();
  if (submittedCode) {
    const coupon = await findActiveCouponByCode(submittedCode);
    if (!coupon) {
      return { ok: false, error: "Coupon is invalid or expired." };
    }
    if (
      coupon.max_redemptions !== null &&
      coupon.redeemed_count >= coupon.max_redemptions
    ) {
      return { ok: false, error: "Coupon has reached its limit." };
    }
    if (subtotal < coupon.min_subtotal) {
      return {
        ok: false,
        error: `Coupon requires a $${coupon.min_subtotal.toFixed(2)} minimum.`,
      };
    }
    couponDiscount = computeDiscount(
      subtotal,
      coupon.discount_type,
      coupon.discount_value,
    );
    couponId = coupon.id;
    couponCode = coupon.code;
  }

  // 2c. Validate loyalty points (server-side re-validation — client untrusted).
  // Points are NOT deducted yet; deduction happens after the order succeeds.
  // Cap points discount so the combined discount can't drive total negative.
  let pointsRedeemed = 0;
  let pointsDiscount = 0;
  const requestedPoints = values.points_to_redeem ?? 0;
  if (requestedPoints > 0 && userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("loyalty_points")
      .eq("id", userId)
      .maybeSingle();
    const available = profile?.loyalty_points ?? 0;
    const capped = Math.min(requestedPoints, available);
    if (capped > 0) {
      const maxByRatio = Number((subtotal * 0.5).toFixed(2));
      const remainingAfterCoupon = Math.max(
        0,
        Number((subtotal + shipping - couponDiscount).toFixed(2)),
      );
      const wantedDiscount = pointsToUsd(capped);
      pointsDiscount = Math.min(wantedDiscount, maxByRatio, remainingAfterCoupon);
      pointsRedeemed = Math.ceil(pointsDiscount * POINTS_PER_DOLLAR_CREDIT);
    }
  }

  // Defense in depth: ensure total can never violate the orders_total_matches
  // CHECK (total = subtotal + shipping_fee - discount AND total >= 0).
  let discount = Number((couponDiscount + pointsDiscount).toFixed(2));
  const discountCap = Number((subtotal + shipping).toFixed(2));
  if (discount > discountCap) discount = discountCap;
  const total = Number((subtotal + shipping - discount).toFixed(2));

  // 3. Upload screenshot (required)
  const file = formData.get("screenshot");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please attach a payment screenshot." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Screenshot is larger than 5 MB." };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return {
      ok: false,
      error: "Screenshot must be a PNG, JPEG, WebP, or HEIC image.",
    };
  }

  const orderId = randomUUID();
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase().slice(0, 4);
  const path = `${orderId}/${randomUUID()}.${ext}`;

  const arrayBuf = await file.arrayBuffer();
  const { error: uploadErr } = await supabase.storage
    .from("payment-proofs")
    .upload(path, arrayBuf, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) {
    console.error("[orders.submit] upload", uploadErr);
    return { ok: false, error: "Could not upload screenshot. Please retry." };
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from("payment-proofs").getPublicUrl(path);

  // 5. Insert order
  const { error: orderErr } = await supabase.from("orders").insert({
    id: orderId,
    user_id: userId,
    customer_name: values.customer_name,
    phone: values.phone,
    address: values.address,
    note: values.note?.trim() ? values.note.trim() : null,
    subtotal,
    shipping_fee: shipping,
    discount,
    total,
    payment_method: values.payment_method,
    payment_image: publicUrl,
    coupon_id: couponId,
    coupon_code: couponCode,
    points_redeemed: pointsRedeemed,
  });
  if (orderErr) {
    console.error("[orders.submit] order insert", orderErr);
    // Orphan storage cleanup — the screenshot was uploaded before we knew the
    // order would fail. Best-effort; failures here are logged, not surfaced.
    await supabase.storage
      .from("payment-proofs")
      .remove([path])
      .catch((err) => console.error("[orders.submit] cleanup upload", err));
    return { ok: false, error: "Could not save your order. Please retry." };
  }

  // 6. Insert order_items. If this fails the order row is meaningless — delete
  //    it (and the upload) so we never leave an order with zero line items
  //    behind, and the payment-proofs bucket doesn't accumulate dead files.
  const { error: itemsErr } = await supabase.from("order_items").insert(
    lineItems.map((li) => ({ ...li, order_id: orderId })),
  );
  if (itemsErr) {
    console.error("[orders.submit] items insert", itemsErr);
    await supabase.from("orders").delete().eq("id", orderId);
    await supabase.storage
      .from("payment-proofs")
      .remove([path])
      .catch((err) => console.error("[orders.submit] cleanup upload", err));
    return { ok: false, error: "Could not save your order. Please retry." };
  }

  // 7. Order + items persisted — only now redeem the coupon counter and
  //    decrement loyalty points. If either fails, the order still stands
  //    with the discount the customer was promised; we just log it.
  if (couponCode) {
    const { data: redeemed, error: redeemErr } = await supabase.rpc(
      "redeem_coupon",
      { p_code: couponCode },
    );
    if (redeemErr || !redeemed || redeemed.length === 0) {
      console.error("[orders.submit] coupon redeem", redeemErr, redeemed);
    }
  }
  if (pointsRedeemed > 0 && userId) {
    const { error: pointsErr } = await supabase.rpc("redeem_loyalty_points", {
      p_user_id: userId,
      p_order_id: orderId,
      p_points: pointsRedeemed,
    });
    if (pointsErr) {
      console.error("[orders.submit] points redeem", pointsErr);
    }
  }

  // Best-effort Telegram ping to the shop owner.
  void notifyNewOrder({
    orderId,
    customerName: values.customer_name,
    phone: values.phone,
    total,
    paymentMethod: values.payment_method,
    itemCount: lineItems.length,
  });

  return { ok: true, orderId };
}

export async function updateOrderStatusAction(
  input: unknown,
): Promise<UpdateOrderStatusResult> {
  await requireStaff();
  const parsed = updateOrderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { orderId, status: nextStatus } = parsed.data;

  const supabase = await createClient();
  const { data: current, error: fetchErr } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr || !current) {
    return { ok: false, error: "Order not found." };
  }

  if (current.status === nextStatus) {
    return { ok: true };
  }
  if (!canTransition(current.status, nextStatus)) {
    return {
      ok: false,
      error: `Cannot move from ${current.status} to ${nextStatus}.`,
    };
  }

  const { data: updated, error: updateErr } = await supabase
    .from("orders")
    .update({ status: nextStatus })
    .eq("id", orderId)
    .select("id, status");

  if (updateErr) {
    if (updateErr.message?.includes("insufficient stock")) {
      return {
        ok: false,
        error: "Not enough stock for one or more items — adjust inventory first.",
      };
    }
    if (updateErr.message?.includes("no inventory row")) {
      return {
        ok: false,
        error:
          "One or more items have no inventory row — open them in Products and seed stock first.",
      };
    }
    console.error("[orders.updateStatus]", updateErr);
    return { ok: false, error: updateErr.message || "Could not update status." };
  }

  if (!updated || updated.length === 0) {
    // PostgREST returns no error when RLS silently drops the UPDATE.
    return {
      ok: false,
      error:
        "Update was blocked. Your account may not have staff permissions — check profiles.role.",
    };
  }

  // Earn loyalty points when an order is delivered (best-effort).
  if (nextStatus === "delivered") {
    const { data: order } = await supabase
      .from("orders")
      .select("user_id, total")
      .eq("id", orderId)
      .maybeSingle();
    if (order?.user_id) {
      await supabase.rpc("earn_loyalty_points", {
        p_user_id: order.user_id,
        p_order_id: orderId,
        p_total: order.total,
      });
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}
