import {
  listOrdersForAdmin,
  countOrdersByStatus,
} from "@/services/orders-admin";
import { OrdersFilterBar } from "@/components/admin/orders/orders-filter-bar";
import { OrdersTable } from "@/components/admin/orders/orders-table";
import { InventoryRealtimeRefresher } from "@/components/admin/inventory/inventory-realtime-refresher";
import type { OrderStatusEnum } from "@/types/database";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set<OrderStatusEnum>([
  "pending",
  "payment_confirmed",
  "preparing",
  "shipping",
  "delivered",
  "cancelled",
]);

type SearchParams = Promise<{ status?: string; q?: string }>;

export default async function AdminOrdersPage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const statusParam =
    sp.status && VALID_STATUSES.has(sp.status as OrderStatusEnum)
      ? (sp.status as OrderStatusEnum)
      : "all";

  const [orders, counts] = await Promise.all([
    listOrdersForAdmin({ status: statusParam, q: sp.q }),
    countOrdersByStatus(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <InventoryRealtimeRefresher />

      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </p>
        </div>
      </header>

      <OrdersFilterBar counts={counts} />
      <OrdersTable orders={orders} />
    </div>
  );
}
