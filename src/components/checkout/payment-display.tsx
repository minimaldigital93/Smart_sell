import Image from "next/image";
import { PAYMENT_INSTRUCTIONS } from "@/lib/checkout/payment-instructions";
import type { PaymentMethod } from "@/lib/constants";

export function PaymentDisplay({ method }: { method: PaymentMethod }) {
  const meta = PAYMENT_INSTRUCTIONS[method];

  return (
    <section
      className="rounded-2xl border border-border bg-card p-5 shadow-soft"
      aria-label={`${meta.label} payment instructions`}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {meta.label}
      </h3>

      {method === "khqr" ? (
        <div className="mt-3 flex flex-col items-center gap-3">
          <div className="relative h-56 w-56 overflow-hidden rounded-2xl bg-muted">
            {/* Drop a real KHQR PNG at public/payment/khqr.png in production. */}
            <Image
              src="/payment/khqr.png"
              alt="KHQR payment QR code"
              fill
              sizes="224px"
              className="object-contain"
              unoptimized
            />
          </div>
          <p className="max-w-[32ch] text-center text-xs text-muted-foreground">
            {meta.note}
          </p>
        </div>
      ) : (
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          {meta.accountName ? (
            <Row label="Account name" value={meta.accountName} />
          ) : null}
          {meta.accountNumber ? (
            <Row label="Account number" value={meta.accountNumber} mono />
          ) : null}
          {meta.note ? (
            <p className="mt-1 text-xs text-muted-foreground">{meta.note}</p>
          ) : null}
        </dl>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-sm font-semibold" : "font-medium"}>
        {value}
      </dd>
    </div>
  );
}
