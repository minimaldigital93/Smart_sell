import { Check } from "lucide-react";
import type { OrderStatusEnum } from "@/types/database";
import { STATUS_ORDER, STATUS_LABEL } from "@/lib/orders/transitions";
import { cn } from "@/lib/utils";

export function OrderTimeline({ status }: { status: OrderStatusEnum }) {
  if (status === "cancelled") {
    return (
      <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
        Order cancelled.
      </p>
    );
  }
  const idx = STATUS_ORDER.indexOf(status);

  return (
    <ol className="flex flex-col gap-3">
      {STATUS_ORDER.map((s, i) => {
        const done = i <= idx;
        const current = i === idx;
        return (
          <li key={s} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2",
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </span>
            <span
              className={cn(
                current && "font-semibold",
                !done && "text-muted-foreground",
              )}
            >
              {STATUS_LABEL[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
