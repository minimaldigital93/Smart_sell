import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getOrderById } from "@/services/orders";
import { formatPrice } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ClearCartOnMount } from "@/components/cart/clear-cart-on-mount";
import { pointsToUsd } from "@/lib/loyalty/constants";

type Params = Promise<{ id: string }>;

export const metadata = { title: "Order placed" };

export default async function OrderSuccessPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getOrderById(id);
  if (!data) notFound();
  const { order, items } = data;

  return (
    <div className="flex flex-col gap-6 pt-2">
      <ClearCartOnMount />

      <header className="flex flex-col items-center gap-3 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-7 w-7" strokeWidth={1.6} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Order placed!</h1>
        <p className="text-sm text-muted-foreground">
          We received your screenshot and we’ll confirm your payment shortly.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Order
        </p>
        <p className="mt-1 font-mono text-sm">{order.id.slice(0, 8)}</p>

        <ul className="mt-5 flex flex-col gap-3">
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
          {(() => {
            // order.discount folds coupon + points cash value into one number.
            // Split it back out so the customer sees exactly what was applied.
            const pointsCash = order.points_redeemed > 0
              ? Math.min(pointsToUsd(order.points_redeemed), order.discount)
              : 0;
            const couponCash = Number(
              (order.discount - pointsCash).toFixed(2),
            );
            return (
              <>
                {couponCash > 0 ? (
                  <Row
                    label={
                      order.coupon_code
                        ? `Discount (${order.coupon_code})`
                        : "Discount"
                    }
                    value={`−${formatPrice(couponCash)}`}
                  />
                ) : null}
                {pointsCash > 0 ? (
                  <Row
                    label={`Points (${order.points_redeemed} pts)`}
                    value={`−${formatPrice(pointsCash)}`}
                  />
                ) : null}
              </>
            );
          })()}
          <Row label="Total" value={formatPrice(order.total)} bold />
        </dl>
      </section>

      <div className="flex flex-col gap-3">
        <Link
          href={`/orders/${order.id}`}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          View order details
        </Link>
        <Link
          href="/shop"
          className={cn(buttonVariants({ variant: "outline", size: "md" }), "w-full")}
        >
          Continue shopping
        </Link>
      </div>
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
