import Link from "next/link";
import type { Order } from "@/types";
import { formatPrice } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { EmptyState } from "@/components/shop/empty-state";
import { ClientDate } from "@/components/shared/client-date";

export function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders match"
        description="Try a different status or clear your search."
      />
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Order</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Payment</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((o) => (
              <tr
                key={o.id}
                className="relative cursor-pointer hover:bg-muted/40"
              >
                <td className="px-3 py-3">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="font-mono text-xs text-muted-foreground hover:text-foreground before:absolute before:inset-0 before:content-['']"
                  >
                    {o.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium">{o.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{o.phone}</p>
                </td>
                <td className="px-3 py-3 capitalize text-muted-foreground">
                  {o.payment_method}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-medium">
                  {formatPrice(o.total)}
                </td>
                <td className="px-3 py-3">
                  <OrderStatusBadge status={o.status} />
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  <ClientDate date={o.created_at} format="MMM d · HH:mm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {orders.map((o) => (
          <li key={o.id}>
            <Link
              href={`/admin/orders/${o.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft hover:bg-muted"
            >
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-medium">{o.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  <ClientDate date={o.created_at} format="MMM d · HH:mm" /> ·{" "}
                  {formatPrice(o.total)}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {o.id.slice(0, 8)}
                </p>
              </div>
              <OrderStatusBadge status={o.status} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
