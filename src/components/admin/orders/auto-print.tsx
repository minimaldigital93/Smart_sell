"use client";

import { useEffect, useRef } from "react";

/** Triggers window.print() once after mount. Renders nothing. */
export function AutoPrint() {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const handle = setTimeout(() => {
      try {
        window.print();
      } catch {
        /* noop */
      }
    }, 400);
    return () => clearTimeout(handle);
  }, []);
  return null;
}
