import { cn } from "@/lib/utils";
import type { OrderStatusEnum } from "@/types/database";

const META: Record<OrderStatusEnum, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-accent text-accent-foreground",
  },
  payment_confirmed: {
    label: "Confirmed",
    className: "bg-success/15 text-success",
  },
  preparing: {
    label: "Preparing",
    className: "bg-secondary text-secondary-foreground",
  },
  shipping: {
    label: "Shipping",
    className: "bg-pink-100 text-pink-500",
  },
  delivered: {
    label: "Delivered",
    className: "bg-success/15 text-success",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive",
  },
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatusEnum;
  className?: string;
}) {
  const meta = META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
