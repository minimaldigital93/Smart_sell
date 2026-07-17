import { cn } from "@/lib/utils";
import type { OrderPaymentStatusEnum } from "@/types/database";

const TONE: Record<OrderPaymentStatusEnum, string> = {
  pending: "bg-muted text-muted-foreground",
  qr_generated: "bg-sky-100 text-sky-700",
  waiting_payment: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-violet-100 text-violet-700",
  rejected: "bg-rose-100 text-rose-700",
};

const LABEL: Record<OrderPaymentStatusEnum, string> = {
  pending: "Pending",
  qr_generated: "Awaiting scan",
  waiting_payment: "Waiting",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
  cancelled: "Cancelled",
  refunded: "Refunded",
  rejected: "Rejected",
};

export function PaymentStatusBadge({
  status,
}: {
  status: OrderPaymentStatusEnum;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        TONE[status],
      )}
    >
      {LABEL[status]}
    </span>
  );
}
