"use client";

import Link from "next/link";
import { useCartStore } from "@/store/cart-store";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { CartSummary } from "@/components/cart/cart-summary";
import { EmptyCart } from "@/components/cart/empty-cart";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CartView() {
  const items = useCartStore((s) => s.items);

  if (items.length === 0) return <EmptyCart />;

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <CartLineItem key={item.productId} item={item} />
        ))}
      </ul>
      <CartSummary />
      <Link
        href="/checkout"
        className={cn(buttonVariants({ size: "lg" }), "w-full")}
      >
        Proceed to checkout
      </Link>
    </div>
  );
}
