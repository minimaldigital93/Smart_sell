import { createClient } from "@/lib/supabase/server";
import { getMyStoreId } from "@/services/stores";
import { escapeLikePattern } from "@/lib/utils";
import { ORDER_STATUSES } from "@/lib/constants";
import type { Order, OrderItem } from "@/types";
import type { OrderStatusEnum } from "@/types/database";

export async function listOrdersForAdmin(opts: {
  status?: OrderStatusEnum | "all";
  q?: string;
  limit?: number;
}): Promise<Order[]> {
  const { status = "all", q, limit = 50 } = opts;
  const supabase = await createClient();
  const storeId = await getMyStoreId();
  let qb = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (storeId) qb = qb.eq("store_id", storeId);
  if (status !== "all") qb = qb.eq("status", status);
  if (q && q.trim()) {
    const pattern = `%${escapeLikePattern(q)}%`;
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
  const storeId = await getMyStoreId();
  let qb = supabase.from("orders").select("*").eq("id", id);
  if (storeId) qb = qb.eq("store_id", storeId);
  const { data: order } = await qb.maybeSingle();
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
  const storeId = await getMyStoreId();
  // One head-only count per status instead of pulling every order row into JS
  // — the old approach transferred the whole table on each orders-page load.
  const results = await Promise.all(
    ORDER_STATUSES.map(async (status) => {
      let qb = supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", status);
      if (storeId) qb = qb.eq("store_id", storeId);
      const { count, error } = await qb;
      return { status, count: error ? 0 : (count ?? 0) };
    }),
  );
  const counts: Partial<Record<OrderStatusEnum, number>> = {};
  for (const { status, count } of results) counts[status] = count;
  return counts;
}
