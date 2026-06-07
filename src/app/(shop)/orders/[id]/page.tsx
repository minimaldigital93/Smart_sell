import { notFound } from "next/navigation";
import { getOrderById } from "@/services/orders";
import { requireUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/utils";
import { PAYMENT_INSTRUCTIONS } from "@/lib/checkout/payment-instructions";
import { ClientDate } from "@/components/shared/client-date";
import { getSignedStorageUrl } from "@/lib/storage/signed-url";

type Params = Promise<{ id: string }>;

export const metadata = { title: "Order" };

const STATUS_STEPS = [
  "pending",
  "payment_confirmed",
  "preparing",
  "shipping",
  "delivered",
] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  payment_confirmed: "Payment confirmed",
  preparing: "Preparing",
  shipping: "Shipping",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function OrderDetailPage({ params }: { params: Params }) {
  await requireUser();
  const { id } = await params;
  const data = await getOrderById(id);
  if (!data) notFound();
  const { order, items } = data;
  const receiptUrl = await getSignedStorageUrl(
    "payment-proofs",
    order.payment_image,
  );
  const reachedIndex = STATUS_STEPS.indexOf(
    order.status as (typeof STATUS_STEPS)[number],
  );

  return (
    <div className="flex flex-col gap-5 pt-2">
      <header>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Order
        </p>
        <h1 className="font-mono text-lg">{order.id.slice(0, 8)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <ClientDate date={order.created_at} format="MMM d, yyyy · HH:mm" />
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </h2>
        {order.status === "cancelled" ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            Cancelled
          </p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {STATUS_STEPS.map((s, i) => {
              const done = i <= reachedIndex;
              return (
                <li key={s} className="flex items-center gap-3 text-sm">
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${done ? "bg-primary" : "bg-border"}`}
                  />
                  <span
                    className={
                      done ? "font-medium" : "text-muted-foreground"
                    }
                  >
                    {STATUS_LABEL[s]}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
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
                {formatPrice(i.price * i.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <hr className="my-4 border-border" />
        <dl className="flex flex-col gap-2 text-sm">
          <Row label="Subtotal" value={formatPrice(order.subtotal)} />
          <Row label="Shipping" value={formatPrice(order.shipping_fee)} />
          <Row label="Total" value={formatPrice(order.total)} bold />
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Delivery
        </h2>
        <p className="text-sm font-medium">{order.customer_name}</p>
        <p className="text-sm text-muted-foreground">{order.phone}</p>
        <p className="mt-2 text-sm">{order.address}</p>
        {order.note ? (
          <p className="mt-2 text-sm text-muted-foreground">{order.note}</p>
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
            className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            View receipt screenshot →
          </a>
        ) : null}
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
