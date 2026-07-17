"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { submitOrderSchema } from "@/lib/checkout/schemas";
import { requireStaff } from "@/lib/auth/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { normalizePhone, phoneToEmail } from "@/lib/auth/phone";
import { notifyNewOrder } from "@/lib/notifications/telegram";
import { updateOrderStatusSchema } from "@/lib/orders/schemas";
import { canTransition } from "@/lib/orders/transitions";
import { getCurrentStoreId } from "@/lib/tenant/context";
import { requestOrigin } from "@/lib/http/origin";
import { createCashPayment, mintOrderKhqrPayment } from "@/services/payments";

export type SubmitOrderResult =
  | { ok: true; orderId: string; payToken?: string }
  | { ok: false; error: string };

export type UpdateOrderStatusResult =
  | { ok: true }
  | { ok: false; error: string };

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
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please review your details.",
    };
  }
  const values = parsed.data;
  const supabase = await createClient();
  // The storefront the customer is checking out on determines the order's store.
  const storeId = await getCurrentStoreId();

  // 1b. Ensure the buyer has an account. Logged-in customers skip this; a guest
  //     creates one (phone + password) — or signs in if the phone is already
  //     registered — so the order is tied to a login they can return to. Done
  //     before any storage/order work so a bad password fails fast and cheap.
  const accountErr = await ensureCheckoutAccount(
    supabase,
    formData,
    values,
    storeId,
  );
  if (accountErr) return { ok: false, error: accountErr };

  // 2. Create the order atomically. The RPC re-fetches prices, verifies stock,
  //    and redeems the coupon in a single transaction — so a lost race (stock
  //    gone, coupon exhausted) rolls the whole order back instead of leaving a
  //    paid-but-unfulfillable order behind. No screenshot: payment is settled
  //    by the KHQR gateway (webhook/poll) or by staff for cash on delivery.
  const orderId = randomUUID();
  const { data: result, error: rpcErr } = await supabase.rpc(
    "create_customer_order",
    {
      p_order_id: orderId,
      p_customer_name: values.customer_name,
      p_phone: values.phone,
      p_address: values.address,
      p_note: values.note?.trim() ? values.note.trim() : null,
      p_payment_method: values.payment_method,
      p_items: values.items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
      })),
      p_coupon_code: values.coupon_code?.trim() || null,
      p_store_id: storeId,
    },
  );

  if (rpcErr || !result) {
    return { ok: false, error: mapOrderError(rpcErr?.message) };
  }

  const total = Number((result as { total?: number }).total ?? 0);

  // 3. Attach the payment: a pending cash row (settled by staff on delivery)
  //    or a fresh KHQR attempt whose pay page the client redirects to. The
  //    order's definitive store comes from the row the RPC stamped.
  let payToken: string | undefined;
  const service = createServiceClient();
  const { data: orderRow } = service
    ? await service
        .from("orders")
        .select("id, store_id, total")
        .eq("id", orderId)
        .single()
    : { data: null };

  if (orderRow) {
    if (values.payment_method === "cash") {
      await createCashPayment({
        id: orderRow.id,
        store_id: orderRow.store_id,
        total: Number(orderRow.total),
      });
    } else {
      const minted = await mintOrderKhqrPayment(
        {
          id: orderRow.id,
          store_id: orderRow.store_id,
          total: Number(orderRow.total),
        },
        { origin: await requestOrigin() },
      );
      if (minted.ok) {
        payToken = minted.payment.public_token;
      } else {
        // Store lost its KHQR config between page load and submit — the order
        // stands; staff follow up like a COD order.
        console.error("[orders.submit] khqr mint failed", minted.error);
      }
    }
  }

  // Best-effort Telegram ping to the shop owner.
  void notifyNewOrder({
    orderId,
    customerName: values.customer_name,
    phone: values.phone,
    total,
    paymentMethod: values.payment_method,
    itemCount: values.items.length,
  });

  return { ok: true, orderId, payToken };
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/**
 * Guarantee the buyer is authenticated before the order is created (the
 * create_customer_order RPC stamps the order with auth.uid()). Returns an error
 * string to surface to the customer, or null on success.
 *
 * - Already signed in → nothing to do.
 * - New phone → sign up with the supplied password (logs them in).
 * - Phone already registered → treat the password as a login; wrong password
 *   is rejected so we never hijack an existing account.
 */
async function ensureCheckoutAccount(
  supabase: SupabaseServer,
  formData: FormData,
  values: { customer_name: string; phone: string },
  storeId: string | null,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return null;

  const passwordRaw = formData.get("password");
  const password = typeof passwordRaw === "string" ? passwordRaw : "";
  if (password.length < 8) {
    return "Create a password (at least 8 characters) to place your order.";
  }

  const email = phoneToEmail(values.phone);
  const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: values.customer_name,
        phone: normalizePhone(values.phone),
        ...(storeId ? { store_id: storeId } : {}),
      },
    },
  });

  // New account created and signed in.
  if (!signUpErr && signUp.session) return null;

  // Either the phone is already registered, or "Confirm email" is on (signUp
  // returns no session). In both cases, treat the password as a login attempt
  // against the existing account.
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (!signInErr) return null;

  return "This phone already has an account. Enter its password to continue, or log in first.";
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
    // Never surface raw DB error text to the UI (audit M15).
    console.error("[orders.updateStatus]", updateErr);
    return { ok: false, error: "Could not update status. Please retry." };
  }

  if (!updated || updated.length === 0) {
    // PostgREST returns no error when RLS silently drops the UPDATE.
    return {
      ok: false,
      error:
        "Update was blocked. Your account may not have staff permissions — check profiles.role.",
    };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}
