"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ShoppingCart,
  Boxes,
  Sparkles,
  Bell as BellIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  markAllReadAction,
  markReadAction,
} from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shop/empty-state";
import { ClientDate } from "@/components/shared/client-date";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

const ICON_BY_TYPE = {
  order: ShoppingCart,
  inventory: Boxes,
  promo: Sparkles,
  system: BellIcon,
} as const;

export function NotificationsList({
  notifications,
}: {
  notifications: Notification[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  function markOne(id: string) {
    startTransition(async () => {
      const r = await markReadAction(id);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  }

  function markAll() {
    startTransition(async () => {
      const r = await markAllReadAction();
      if (!r.ok) toast.error(r.error);
      else toast.success("All notifications marked as read");
      router.refresh();
    });
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        title="No notifications"
        description="You're all caught up. We'll buzz here when something happens."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {unreadCount > 0 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {unreadCount} unread
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={markAll}
          >
            Mark all read
          </Button>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {notifications.map((n) => {
          const Icon = ICON_BY_TYPE[n.type] ?? BellIcon;
          const href = hrefFor(n);
          const unread = !n.read_at;
          const body = (
            <span
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-4 shadow-soft transition-colors",
                unread
                  ? "border-primary/20 bg-pink-50/50"
                  : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                  n.type === "order" && "bg-pink-100 text-pink-500",
                  n.type === "inventory" && "bg-amber-100 text-amber-600",
                  n.type === "promo" && "bg-secondary text-secondary-foreground",
                  n.type === "system" && "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="line-clamp-1 text-sm font-semibold">
                    {n.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    <ClientDate date={n.created_at} mode="distance" />
                  </span>
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {n.message}
                </span>
              </span>
              {unread ? (
                <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
              ) : null}
            </span>
          );

          return (
            <li key={n.id}>
              {href ? (
                <Link href={href} onClick={() => unread && markOne(n.id)}>
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => unread && markOne(n.id)}
                  className="block w-full text-left"
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function hrefFor(n: Notification): string | null {
  const metadata = (n.metadata ?? {}) as Record<string, unknown>;
  if (n.type === "order" && typeof metadata.order_id === "string") {
    // Staff-audience links go to admin; user-targeted go to /orders.
    return n.user_id
      ? `/orders/${metadata.order_id}`
      : `/admin/orders/${metadata.order_id}`;
  }
  if (n.type === "inventory" && typeof metadata.product_id === "string") {
    return `/admin/inventory/products/${metadata.product_id}`;
  }
  return null;
}
