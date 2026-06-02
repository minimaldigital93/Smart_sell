"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useWishlistStore } from "@/store/wishlist-store";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/shop/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

export function WishlistView() {
  const ids = useWishlistStore((s) => s.ids);
  const clear = useWishlistStore((s) => s.clear);

  const { data: products = [], isFetching } = useQuery<Product[]>({
    queryKey: ["wishlist-products", ids],
    queryFn: async () => {
      if (ids.length === 0) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("*")
        .in("id", ids)
        .eq("is_active", true);
      return data ?? [];
    },
    staleTime: 30_000,
  });

  if (isFetching && ids.length > 0) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="aspect-3/4 animate-pulse rounded-2xl bg-muted"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title="Your wishlist is empty"
        description="Tap the heart on a product to save it."
        action={
          <Link href="/shop" className={cn(buttonVariants({ size: "md" }))}>
            Browse shop
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => clear()}
        className="mt-4 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Clear wishlist
      </button>
    </>
  );
}
