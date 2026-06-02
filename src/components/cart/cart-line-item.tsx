"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";
import type { CartItem } from "@/types";
import { useCartStore } from "@/store/cart-store";
import { formatPrice } from "@/lib/utils";
import { QuantityStepper } from "@/components/shop/quantity-stepper";

export function CartLineItem({ item }: { item: CartItem }) {
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);

  return (
    <li className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.image ? (
          <Image
            src={item.image}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug">
          {item.name}
        </p>
        <p className="text-sm font-semibold tabular-nums">
          {formatPrice(item.price)}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <QuantityStepper
            value={item.quantity}
            onChange={(q) => setQuantity(item.productId, q)}
            min={1}
            max={99}
            className="!h-9"
          />
          <button
            type="button"
            onClick={() => remove(item.productId)}
            aria-label="Remove from cart"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
