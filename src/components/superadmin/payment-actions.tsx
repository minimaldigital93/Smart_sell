"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approvePayment, rejectPayment } from "@/app/actions/superadmin";

export function PaymentActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Failed");
      else router.refresh();
    });

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => approvePayment(paymentId))}
        className="bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => rejectPayment(paymentId))}
        className="text-destructive rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        Reject
      </button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
}
