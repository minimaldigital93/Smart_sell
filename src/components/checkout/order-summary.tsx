"use client";

import { useCartStore } from "@/store/cart-store";
import { useFormatPrice } from "@/lib/settings/store-config";

export function OrderSummary() {
  const formatPrice = useFormatPrice();
  const items = useCartStore((s) => s.items);

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Order summary"
      className="rounded-2xl border border-border bg-card p-4 shadow-soft"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Order
      </h3>
      <ul className="mt-3 flex flex-col gap-2.5">
        {items.map((i) => (
          <li
            key={i.productId}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="line-clamp-1 flex-1">
              {i.name}{" "}
              <span className="text-muted-foreground">× {i.quantity}</span>
            </span>
            <span className="font-medium tabular-nums">
              {formatPrice(i.price * i.quantity)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
