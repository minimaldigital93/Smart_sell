"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";

/**
 * Rehydrates persisted Zustand stores after the first client paint. The stores
 * use `skipHydration: true` so SSR and the first client render both show the
 * empty initial state — preventing hydration mismatches — then we flip to the
 * persisted state here.
 */
export function StoreHydrator() {
  useEffect(() => {
    useCartStore.persist.rehydrate();
    useWishlistStore.persist.rehydrate();
  }, []);
  return null;
}
