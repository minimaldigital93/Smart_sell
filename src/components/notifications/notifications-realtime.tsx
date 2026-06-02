"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types";

/**
 * Subscribes to inserts on the notifications table. RLS lets staff *see* every
 * row (so the notifications page works), but a toast should only fire when the
 * row is actually addressed to the viewer — otherwise admins get a duplicate
 * toast for every customer-facing notification they trigger.
 */
export function NotificationsRealtime() {
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Resolve the user *before* subscribing — otherwise inserts that land
    // during the auth round-trip get dropped by the user-id filter below.
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const currentUserId = data.user?.id ?? null;

      const channelName = `notifications-feed-${
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2)
      }`;

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          (payload) => {
            const n = payload.new as unknown as Notification;
            // Targeted-at-someone-else: ignore. Broadcasts (user_id null) are
            // already gated by RLS, so they only arrive for viewers allowed
            // to see them.
            if (n.user_id && n.user_id !== currentUserId) return;
            toast(n.title, {
              description: n.message,
              duration: 6000,
            });
            try {
              if (
                typeof window !== "undefined" &&
                "Notification" in window &&
                Notification.permission === "granted" &&
                document.visibilityState !== "visible"
              ) {
                new Notification(n.title, {
                  body: n.message,
                  icon: "/icons/icon-192.png",
                  tag: n.id,
                });
              }
            } catch {
              /* ignore */
            }
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
