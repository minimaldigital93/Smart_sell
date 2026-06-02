"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max ?? value + 1, value + 1));

  return (
    <div
      className={cn(
        "inline-flex h-12 items-center rounded-2xl border border-border bg-card shadow-soft",
        className,
      )}
      aria-label="Quantity"
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="grid h-full w-12 place-items-center text-muted-foreground disabled:opacity-40"
      >
        <Minus className="h-5 w-5" />
      </button>
      <span className="w-10 text-center text-base font-semibold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={max != null && value >= max}
        aria-label="Increase quantity"
        className="grid h-full w-12 place-items-center text-muted-foreground disabled:opacity-40"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
