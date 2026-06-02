"use client";

import { useEffect, useRef } from "react";
import { useCartStore } from "@/store/cart-store";

/**
 * Empties the cart once after this component mounts. Use on the order-success
 * page so reloading or revisiting via back button doesn't keep re-clearing —
 * the ref guards against React StrictMode double-effects.
 */
export function ClearCartOnMount() {
  const clear = useCartStore((s) => s.clear);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    clear();
  }, [clear]);

  return null;
}
