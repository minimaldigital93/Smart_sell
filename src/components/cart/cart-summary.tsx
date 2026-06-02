"use client";

import { useCartStore } from "@/store/cart-store";
import { formatPrice } from "@/lib/utils";
import { SHIPPING_FEE_DEFAULT } from "@/lib/constants";

export function CartSummary({
  showShipping = true,
}: {
  showShipping?: boolean;
}) {
  const subtotal = useCartStore((s) => s.subtotal());
  const itemCount = useCartStore((s) => s.count());
  const shipping = subtotal > 0 ? SHIPPING_FEE_DEFAULT : 0;
  const total = subtotal + shipping;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Summary
      </h2>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        <Row label={`Subtotal (${itemCount} items)`} value={formatPrice(subtotal)} />
        {showShipping ? (
          <Row label="Shipping" value={formatPrice(shipping)} />
        ) : null}
      </dl>
      <hr className="my-3 border-border" />
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Total</span>
        <span className="text-lg font-semibold tabular-nums">
          {formatPrice(total)}
        </span>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
