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
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <CartLineItem key={item.productId} item={item} />
        ))}
      </ul>
      <div className="flex flex-col gap-4 lg:sticky lg:top-24">
        <CartSummary />
        <Link
          href="/checkout"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Proceed to checkout
        </Link>
      </div>
    </div>
  );
}
