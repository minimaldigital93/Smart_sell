import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getMyOrders } from "@/services/orders";
import { formatPrice } from "@/lib/utils";
import { getStoreSettings } from "@/services/settings";
import { EmptyState } from "@/components/shop/empty-state";
import { ClientDate } from "@/components/shared/client-date";

export const metadata = { title: "My orders" };

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  payment_confirmed: "Payment confirmed",
  preparing: "Preparing",
  shipping: "Shipping",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-accent text-accent-foreground",
  payment_confirmed: "bg-success/15 text-success",
  preparing: "bg-secondary text-secondary-foreground",
  shipping: "bg-pink-100 text-pink-500",
  delivered: "bg-success/15 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const orders = await getMyOrders(user.id);
  const { currency } = await getStoreSettings();

  return (
    <div className="flex flex-col gap-5 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Your orders</h1>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Once you place an order, it’ll appear here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-soft transition-colors hover:bg-muted"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">
                    {o.id.slice(0, 8)}
                  </p>
                  <p className="mt-0.5 text-sm font-medium">
                    <ClientDate date={o.created_at} format="MMM d, yyyy · HH:mm" />
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatPrice(o.total, currency)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[o.status] ?? "bg-muted"}`}
                >
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
