"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import {
  startSubscriptionCheckout,
  checkSubscriptionPayment,
} from "@/app/actions/subscriptions";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { KhqrDisplay } from "./khqr-display";
import { ManualProofForm } from "./manual-proof-form";

export type BillingPlan = {
  id: string;
  code: string;
  name: string;
  price_usd: number;
  features: string[];
};

type Phase = "idle" | "qr" | "manual" | "paid";

export function BillingClient({ plans }: { plans: BillingPlan[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BillingPlan | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const choose = (plan: BillingPlan) =>
    start(async () => {
      setError(null);
      setSelected(plan);
      const res = await startSubscriptionCheckout(plan.code);
      if (!res.ok) {
        setError(res.error ?? "Could not start checkout");
        setPhase("idle");
        return;
      }
      setPaymentId(res.paymentId ?? null);
      if (res.automated && res.qr) {
        setQr(res.qr);
        setPhase("qr");
        setPolling(true);
      } else {
        setPhase("manual");
      }
    });

  useEffect(() => {
    if (!polling || !paymentId) return;
    const timer = setInterval(async () => {
      const res = await checkSubscriptionPayment(paymentId);
      if (res.status === "paid") {
        setPolling(false);
        setPhase("paid");
        router.refresh();
      } else if (res.status === "unavailable") {
        setPolling(false);
        setPhase("manual");
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [polling, paymentId, router]);

  if (phase === "paid") {
    return (
      <div className="bg-card rounded-2xl border p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <p className="font-medium">Payment received — your plan is active.</p>
        <Button className="mt-4" onClick={() => router.refresh()}>
          Done
        </Button>
      </div>
    );
  }

  if (phase === "qr" && qr && selected) {
    return (
      <div className="bg-card flex flex-col items-center gap-3 rounded-2xl border p-6 text-center">
        <p className="text-sm font-medium">
          Scan to pay {formatPrice(selected.price_usd)} — {selected.name}
        </p>
        <KhqrDisplay value={qr} />
        <p className="text-muted-foreground text-sm">
          Waiting for payment… this updates automatically.
        </p>
        <button
          type="button"
          onClick={() => setPhase("manual")}
          className="text-muted-foreground text-sm underline"
        >
          Pay another way / upload a receipt
        </button>
      </div>
    );
  }

  if (phase === "manual" && selected) {
    return (
      <div className="bg-card flex flex-col gap-4 rounded-2xl border p-6">
        <div>
          <p className="text-sm font-medium">
            {selected.name} — {formatPrice(selected.price_usd)}/month
          </p>
          <p className="text-muted-foreground text-sm">
            Pay to the store&rsquo;s KHQR/bank account, then upload your receipt.
          </p>
        </div>
        <ManualProofForm planCode={selected.code} />
        <button
          type="button"
          onClick={() => setPhase("idle")}
          className="text-muted-foreground text-sm underline self-start"
        >
          ← Choose a different plan
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="bg-card flex flex-col gap-4 rounded-2xl border p-5"
          >
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                {plan.name}
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">
                {formatPrice(plan.price_usd)}
                <span className="text-muted-foreground text-sm font-normal">
                  /month
                </span>
              </p>
            </div>
            <ul className="flex flex-1 flex-col gap-1.5 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() => choose(plan)}
              disabled={pending}
              className="w-full"
            >
              {pending && selected?.code === plan.code
                ? "Starting…"
                : `Choose ${plan.name}`}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
