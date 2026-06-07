import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Order, OrderItem } from "@/types";

export async function getMyOrders(userId: string): Promise<Order[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[orders.getMy]", error);
    return [];
  }
  return data ?? [];
}

export async function getOrderById(
  orderId: string,
): Promise<{ order: Order; items: OrderItem[] } | null> {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  return { order, items: items ?? [] };
}

/**
 * Fetch an order for the post-checkout confirmation page. Unlike getOrderById,
 * this bypasses RLS via the service-role client because guest (anonymous)
 * orders have user_id = null and would otherwise be unreadable — leaving the
 * buyer stranded on a 404 right after paying. The freshly minted, unguessable
 * order UUID acts as a capability token here. Falls back to the RLS client when
 * the service key isn't configured.
 */
export async function getOrderConfirmation(
  orderId: string,
): Promise<{ order: Order; items: OrderItem[] } | null> {
  const supabase = createServiceClient() ?? (await createClient());
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  return { order, items: items ?? [] };
}
