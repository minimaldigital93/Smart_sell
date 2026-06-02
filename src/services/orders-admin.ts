import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem } from "@/types";
import type { OrderStatusEnum } from "@/types/database";

export async function listOrdersForAdmin(opts: {
  status?: OrderStatusEnum | "all";
  q?: string;
  limit?: number;
}): Promise<Order[]> {
  const { status = "all", q, limit = 50 } = opts;
  const supabase = await createClient();
  let qb = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "all") qb = qb.eq("status", status);
  if (q && q.trim()) {
    const escaped = q.trim().replace(/[%_]/g, (m) => `\\${m}`);
    const pattern = `%${escaped}%`;
    qb = qb.or(
      `customer_name.ilike.${pattern},phone.ilike.${pattern},address.ilike.${pattern}`,
    );
  }

  const { data, error } = await qb;
  if (error) {
    console.error("[orders-admin.list]", error);
    return [];
  }
  return data ?? [];
}

export async function getOrderForAdmin(
  id: string,
): Promise<{ order: Order; items: OrderItem[] } | null> {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!order) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  return { order, items: items ?? [] };
}

export async function countOrdersByStatus(): Promise<
  Partial<Record<OrderStatusEnum, number>>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("status")
    .returns<Array<{ status: OrderStatusEnum }>>();
  if (error || !data) return {};
  const counts: Partial<Record<OrderStatusEnum, number>> = {};
  for (const row of data) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}
