"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to product_inventory + inventory_movements changes and calls
 * router.refresh() so server components re-fetch without a full reload.
 * Throttled to one refresh per second to avoid hammering during burst writes.
 */
export function InventoryRealtimeRefresher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let last = 0;
    const triggerRefresh = () => {
      const now = Date.now();
      if (now - last < 1000) return;
      last = now;
      router.refresh();
    };

    const channel = supabase
      .channel("admin-inventory")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_inventory" },
        triggerRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_movements" },
        triggerRefresh,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
