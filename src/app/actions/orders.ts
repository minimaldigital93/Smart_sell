"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { submitOrderSchema } from "@/lib/checkout/schemas";
import { requireStaff } from "@/lib/auth/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { notifyNewOrder } from "@/lib/notifications/telegram";
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
  const supabase = await createClient();

  // 2. Validate + size the payment screenshot BEFORE touching the order. The
  //    actual order (price recompute, stock check, coupon + points redemption)
  //    is created atomically by the create_customer_order RPC so the data layer
  //    — not just this action — owns price/stock/credit integrity.
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

  // 3. Upload the screenshot through the service-role client so the
  //    payment-proofs bucket can deny direct anon/authenticated inserts — a
  //    public anon upload policy would otherwise let anyone spam the bucket.
  //    Falls back to the request client if the service key isn't configured.
  const storageClient = createServiceClient() ?? supabase;
  const orderId = randomUUID();
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase().slice(0, 4);
  const path = `${orderId}/${randomUUID()}.${ext}`;
  const arrayBuf = await file.arrayBuffer();
  const { error: uploadErr } = await storageClient.storage
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
  // Store the bare object path (bucket is private); display sites mint a signed
  // URL via getSignedStorageUrl.
  const cleanupUpload = () =>
    storageClient.storage
      .from("payment-proofs")
      .remove([path])
      .catch((err) => console.error("[orders.submit] cleanup upload", err));

  // 4. Create the order atomically. The RPC re-fetches prices, verifies stock,
  //    and redeems the coupon + loyalty points in a single transaction — so a
  //    lost race (stock gone, points already spent) rolls the whole order back
  //    instead of leaving a paid-but-unfulfillable order behind.
  const { data: result, error: rpcErr } = await supabase.rpc(
    "create_customer_order",
    {
      p_order_id: orderId,
      p_customer_name: values.customer_name,
      p_phone: values.phone,
      p_address: values.address,
      p_note: values.note?.trim() ? values.note.trim() : null,
      p_payment_method: values.payment_method,
      p_payment_image: path,
      p_items: values.items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
      })),
      p_coupon_code: values.coupon_code?.trim() || null,
      p_points: values.points_to_redeem ?? 0,
    },
  );

  if (rpcErr || !result) {
    await cleanupUpload();
    return { ok: false, error: mapOrderError(rpcErr?.message) };
  }

  const total = Number((result as { total?: number }).total ?? 0);

  // Best-effort Telegram ping to the shop owner.
  void notifyNewOrder({
    orderId,
    customerName: values.customer_name,
    phone: values.phone,
    total,
    paymentMethod: values.payment_method,
    itemCount: values.items.length,
  });

  return { ok: true, orderId };
}

/** Translate raised RPC error codes into friendly, customer-facing copy. */
function mapOrderError(message?: string): string {
  const msg = message ?? "";
  const stock = msg.match(/INSUFFICIENT_STOCK:(.+?)(?:$|")/);
  if (stock) {
    return `Only limited stock left for ${stock[1].trim()} — reduce the quantity and try again.`;
  }
  if (msg.includes("COUPON_LIMIT")) return "Coupon has reached its limit.";
  if (msg.includes("COUPON_INVALID")) return "Coupon is invalid or expired.";
  if (msg.includes("COUPON_MIN")) {
    const min = msg.match(/COUPON_MIN:([\d.]+)/);
    return min
      ? `Coupon requires a $${Number(min[1]).toFixed(2)} minimum.`
      : "Your subtotal is below the coupon minimum.";
  }
  if (msg.includes("POINTS_CHANGED")) {
    return "Your points balance changed — please review and try again.";
  }
  if (msg.includes("no longer available") || msg.includes("not available")) {
    return "A product in your cart is no longer available.";
  }
  if (msg.includes("has no price")) return "A product in your cart has no price set.";
  console.error("[orders.submit] rpc", message);
  return "Could not place your order. Please retry.";
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
