"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QrImage } from "@/components/payments/qr-image";
import { regenerateOrderQrAction } from "@/app/actions/payments";
import { useFormatPrice } from "@/lib/settings/store-config";
import type { OrderPaymentStatusEnum } from "@/types/database";

const POLL_MS = 4_000;
const OPEN: readonly OrderPaymentStatusEnum[] = [
  "pending",
  "qr_generated",
  "waiting_payment",
];

export function KhqrPayPanel({
  token,
  orderId,
  amount,
  initialStatus,
  expiresAt,
  checkoutUrl,
  qrPayload,
  successHref,
  checkoutTarget = "_self",
}: {
  token: string;
  orderId: string;
  amount: number;
  initialStatus: OrderPaymentStatusEnum;
  expiresAt: string | null;
  checkoutUrl: string | null;
  qrPayload: string | null;
  /** Where to go once paid; defaults to the customer success page. */
  successHref?: string;
  /** POS opens the hosted checkout in a new tab so the till keeps polling. */
  checkoutTarget?: "_self" | "_blank";
}) {
  const router = useRouter();
  const formatPrice = useFormatPrice();
  const [status, setStatus] = useState<OrderPaymentStatusEnum>(initialStatus);
  const [regenerating, setRegenerating] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const redirected = useRef(false);

  const paidHref = successHref ?? `/checkout/success/${orderId}`;
  const isOpen = OPEN.includes(status);
  // Expiry countdown (display only — the server is authoritative).
  const secondsLeft =
    expiresAt && isOpen
      ? Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000))
      : null;

  // Live status poll — also advances the payment server-side (lazy expiry,
  // gateway verify behind the cooldown).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/khqr/status/${token}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          status: OrderPaymentStatusEnum;
          paid: boolean;
        };
        if (cancelled) return;
        setStatus(data.status);
        if (data.paid && !redirected.current) {
          redirected.current = true;
          toast.success("Payment received!");
          router.replace(paidHref);
        }
      } catch {
        // Transient network error — next tick retries.
      }
    };

    void tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isOpen, token, paidHref, router]);

  // Tick the countdown once a second while the payment is open.
  useEffect(() => {
    if (!expiresAt || !isOpen) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt, isOpen]);

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    const result = await regenerateOrderQrAction(token);
    setRegenerating(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.replace(`/checkout/pay/${result.payToken}`);
    router.refresh();
  }, [token, router]);

  if (status === "paid") {
    return (
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-success/30 bg-success/5 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-success" strokeWidth={1.6} />
        <p className="text-sm font-medium">Payment received!</p>
        <Button onClick={() => router.replace(paidHref)}>View the order</Button>
      </section>
    );
  }

  if (!isOpen) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
        <p className="text-sm font-medium">
          {status === "expired"
            ? "This payment link expired."
            : "This payment attempt was closed."}
        </p>
        <p className="text-xs text-muted-foreground">
          Your order is still reserved — get a new payment link to finish
          paying.
        </p>
        <Button onClick={regenerate} disabled={regenerating} size="lg">
          {regenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Get a new payment link
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Amount to pay
      </p>
      <p className="text-3xl font-semibold tabular-nums">{formatPrice(amount)}</p>

      {qrPayload ? (
        <>
          <QrImage value={qrPayload} />
          <p className="text-xs text-muted-foreground">
            Scan with your banking app (ABA, Acleda, Wing… any Bakong member).
          </p>
        </>
      ) : null}

      {checkoutUrl ? (
        <a
          href={checkoutUrl}
          target={checkoutTarget}
          rel={checkoutTarget === "_blank" ? "noopener" : undefined}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <ExternalLink className="h-4 w-4" />
          Pay with KHQR
        </a>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Waiting for your payment…
        {secondsLeft !== null ? (
          <span className="tabular-nums">
            · link expires in {Math.floor(secondsLeft / 60)}:
            {String(secondsLeft % 60).padStart(2, "0")}
          </span>
        ) : null}
      </div>
    </section>
  );
}
