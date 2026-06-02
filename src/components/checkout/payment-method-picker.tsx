"use client";

import { Controller, type Control } from "react-hook-form";
import { ONLINE_PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { PAYMENT_INSTRUCTIONS } from "@/lib/checkout/payment-instructions";
import { cn } from "@/lib/utils";
import type { CheckoutCustomerValues } from "@/lib/checkout/schemas";

export function PaymentMethodPicker({
  control,
}: {
  control: Control<CheckoutCustomerValues>;
}) {
  return (
    <Controller
      control={control}
      name="payment_method"
      render={({ field }) => (
        <div className="flex flex-col gap-2">
          {ONLINE_PAYMENT_METHODS.map((m) => (
            <PaymentOption
              key={m}
              method={m}
              selected={field.value === m}
              onSelect={() => field.onChange(m)}
            />
          ))}
        </div>
      )}
    />
  );
}

function PaymentOption({
  method,
  selected,
  onSelect,
}: {
  method: PaymentMethod;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = PAYMENT_INSTRUCTIONS[method];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
        selected
          ? "border-primary bg-accent shadow-soft"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      <span>
        <span className="block text-sm font-semibold">{meta.label}</span>
        {meta.bank ? (
          <span className="block text-xs text-muted-foreground">{meta.bank}</span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "grid h-5 w-5 place-items-center rounded-full border-2",
          selected ? "border-primary" : "border-border",
        )}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
      </span>
    </button>
  );
}
