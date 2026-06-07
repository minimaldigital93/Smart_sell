import Link from "next/link";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { formatPrice } from "@/lib/utils";
import { getStoreSettings } from "@/services/settings";
import { EmptyState } from "@/components/shop/empty-state";
import { ClientDate } from "@/components/shared/client-date";
import type { RecentOrder } from "@/services/admin";

export async function RecentOrders({ orders }: { orders: RecentOrder[] }) {
  const { currency } = await getStoreSettings();
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recent orders
        </h2>
        <Link
          href="/admin/orders"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      </header>

      {orders.length === 0 ? (
        <EmptyState title="No orders yet" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/orders/${o.id}`}
                className="flex items-center justify-between gap-3 py-3 -mx-1 rounded-xl px-1 hover:bg-muted"
              >
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-medium">
                    {o.customer_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <ClientDate date={o.created_at} format="MMM d · HH:mm" /> ·{" "}
                    {formatPrice(o.total, currency)}
                  </p>
                </div>
                <OrderStatusBadge status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
