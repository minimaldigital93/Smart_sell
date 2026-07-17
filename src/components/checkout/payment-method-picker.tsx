"use client";

import { Controller, type Control } from "react-hook-form";
import { QrCode, Banknote, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckoutCustomerValues } from "@/lib/checkout/schemas";

const OPTIONS: ReadonlyArray<{
  method: "khqr" | "cash";
  label: string;
  hint: string;
  icon: LucideIcon;
}> = [
  {
    method: "khqr",
    label: "KHQR",
    hint: "Pay now by scanning with your banking app",
    icon: QrCode,
  },
  {
    method: "cash",
    label: "Cash on delivery",
    hint: "Pay when your order arrives",
    icon: Banknote,
  },
];

export function PaymentMethodPicker({
  control,
  khqrAvailable = true,
}: {
  control: Control<CheckoutCustomerValues>;
  /** False when the store hasn't configured its KHQR merchant profile. */
  khqrAvailable?: boolean;
}) {
  const options = OPTIONS.filter((o) => o.method !== "khqr" || khqrAvailable);
  return (
    <Controller
      control={control}
      name="payment_method"
      render={({ field }) => (
        <div className="flex flex-col gap-2">
          {options.map((o) => (
            <button
              key={o.method}
              type="button"
              onClick={() => field.onChange(o.method)}
              aria-pressed={field.value === o.method}
              className={cn(
                "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
                field.value === o.method
                  ? "border-primary bg-accent shadow-soft"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                  <o.icon className="h-4.5 w-4.5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {o.hint}
                  </span>
                </span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full border-2",
                  field.value === o.method ? "border-primary" : "border-border",
                )}
              >
                {field.value === o.method ? (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                ) : null}
              </span>
            </button>
          ))}
        </div>
      )}
    />
  );
}
