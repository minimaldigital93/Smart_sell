"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Banknote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  markCashPaidAction,
  recheckOrderPaymentAction,
} from "@/app/actions/payments";
import type { OrderPaymentStatusEnum } from "@/types/database";

const OPEN: readonly OrderPaymentStatusEnum[] = [
  "pending",
  "qr_generated",
  "waiting_payment",
];

export function PaymentRowActions({
  paymentId,
  method,
  status,
}: {
  paymentId: string;
  method: string;
  status: OrderPaymentStatusEnum;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!OPEN.includes(status)) return null;

  async function run(
    action: () => Promise<{ ok: boolean } & { error?: string }>,
    successMsg: string,
  ) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      toast.error(("error" in result && result.error) || "Action failed.");
      return;
    }
    toast.success(successMsg);
    router.refresh();
  }

  if (method === "cash") {
    return (
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={() =>
          run(() => markCashPaidAction(paymentId), "Cash payment recorded")
        }
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Banknote className="h-3.5 w-3.5" />
        )}
        Mark paid
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() =>
        run(() => recheckOrderPaymentAction(paymentId), "Status refreshed")
      }
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      Recheck
    </Button>
  );
}
