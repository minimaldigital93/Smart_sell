import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, Phone, MapPin, BadgeCheck } from "lucide-react";
import { getOrderForAdmin } from "@/services/orders-admin";
import { formatPrice, cn } from "@/lib/utils";
import { getStoreSettings } from "@/services/settings";
import { buttonVariants } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { OrderStatusControl } from "@/components/admin/orders/order-status-control";
import { OrderTimeline } from "@/components/admin/orders/order-timeline";
import { PAYMENT_INSTRUCTIONS } from "@/lib/checkout/payment-instructions";
import { ClientDate } from "@/components/shared/client-date";
import { getSignedStorageUrl } from "@/lib/storage/signed-url";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const data = await getOrderForAdmin(id);
  if (!data) notFound();
  const { order, items } = data;
  const { currency } = await getStoreSettings();
  const receiptUrl = await getSignedStorageUrl(
    "payment-proofs",
    order.payment_image,
  );

  const isCounterSale = order.address === "In-store pickup";
  const isCompletedSale =
    order.status === "delivered" ||
    (isCounterSale && order.status === "payment_confirmed");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Order
          </p>
          <h1 className="mt-1 font-mono text-xl">{order.id.slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <ClientDate date={order.created_at} format="MMM d, yyyy · HH:mm" />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <Link
            href={`/print/orders/${order.id}`}
            target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "md" }))}
          >
            <Printer className="h-4 w-4" />
            Print
          </Link>
        </div>
      </header>

      {isCompletedSale ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-soft dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          <BadgeCheck className="h-5 w-5 shrink-0" />
          <span>
            <strong className="font-semibold">Sale complete.</strong>{" "}
            {isCounterSale
              ? "Recorded as a counter sale — stock has been deducted."
              : "Order delivered — recorded as a sale."}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Items
          </h2>
          <ul className="flex flex-col gap-3">
            {items.map((i) => (
              <li
                key={i.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="line-clamp-1">
                  {i.product_name}{" "}
                  <span className="text-muted-foreground">× {i.quantity}</span>
                </span>
                <span className="font-medium tabular-nums">
                  {formatPrice(i.price * i.quantity, currency)}
                </span>
              </li>
            ))}
          </ul>
          <hr className="my-4 border-border" />
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Subtotal" value={formatPrice(order.subtotal, currency)} />
            <Row label="Shipping" value={formatPrice(order.shipping_fee, currency)} />
            <Row label="Total" value={formatPrice(order.total, currency)} bold />
          </dl>
        </section>

        <section className="flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </h2>
            <OrderTimeline status={order.status} />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {isCounterSale ? "Actions" : "Move to"}
            </h2>
            <OrderStatusControl
              orderId={order.id}
              current={order.status}
              counterSale={isCounterSale}
            />
            {order.status === "pending" ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Processing the order also decrements inventory automatically.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Customer
        </h2>
        <p className="text-sm font-medium">{order.customer_name}</p>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <a
            href={`tel:${order.phone}`}
            className="inline-flex items-center gap-2 text-foreground underline-offset-4 hover:underline"
          >
            <Phone className="h-4 w-4" />
            {order.phone}
          </a>
          <p className="inline-flex items-start gap-2 text-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{order.address}</span>
          </p>
        </div>
        {order.note ? (
          <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            “{order.note}”
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Payment
        </h2>
        <p className="text-sm font-medium">
          {PAYMENT_INSTRUCTIONS[order.payment_method].label}
        </p>
        {receiptUrl ? (
          <a
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block overflow-hidden rounded-xl border border-border"
          >
            {/* Short-lived signed URL from the private payment-proofs bucket;
                img tag avoids configuring remotePatterns for storage subpaths. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptUrl}
              alt="Payment receipt screenshot"
              className="max-h-72 w-auto"
            />
          </a>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No screenshot uploaded.
          </p>
        )}
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={bold ? "font-semibold tabular-nums" : "font-medium tabular-nums"}>
        {value}
      </dd>
    </div>
  );
}
