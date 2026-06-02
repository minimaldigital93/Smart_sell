"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { updateOrderStatusAction } from "@/app/actions/orders";
import {
  ALLOWED_TRANSITIONS,
  STATUS_LABEL,
  TRANSITION_VERB,
} from "@/lib/orders/transitions";
import type { OrderStatusEnum } from "@/types/database";
import { Button } from "@/components/ui/button";

export function OrderStatusControl({
  orderId,
  current,
}: {
  orderId: string;
  current: OrderStatusEnum;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const nextStates = ALLOWED_TRANSITIONS[current];

  if (nextStates.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
        Order is in a terminal state ({STATUS_LABEL[current]}).
      </div>
    );
  }

  function move(to: OrderStatusEnum) {
    if (to === "cancelled") {
      const sure = window.confirm(
        "Cancel this order? Any inventory already deducted will be put back automatically.",
      );
      if (!sure) return;
    }
    startTransition(async () => {
      const result = await updateOrderStatusAction({ orderId, status: to });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Moved to ${STATUS_LABEL[to]}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {nextStates.map((s) => (
        <Button
          key={s}
          type="button"
          size="md"
          variant={s === "cancelled" ? "destructive" : "default"}
          onClick={() => move(s)}
          disabled={pending}
          className="w-full"
        >
          {s === "cancelled" ? (
            <X className="h-4 w-4" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {TRANSITION_VERB[s]}
        </Button>
      ))}
    </div>
  );
}
