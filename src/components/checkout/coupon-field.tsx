"use client";

import { useState, useTransition } from "react";
import { validateCouponAction } from "@/app/actions/coupons";
import { useFormatPrice } from "@/lib/settings/store-config";

export type AppliedCoupon = {
  code: string;
  discount: number;
};

export function CouponField({
  subtotal,
  onChange,
}: {
  subtotal: number;
  onChange: (coupon: AppliedCoupon | null) => void;
}) {
  const formatPrice = useFormatPrice();
  const [input, setInput] = useState("");
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function apply() {
    setError(null);
    const code = input.trim().toUpperCase();
    if (!code) return;
    start(async () => {
      const res = await validateCouponAction({ code, subtotal });
      if (!res.ok) {
        setError(res.error);
        setApplied(null);
        onChange(null);
        return;
      }
      const next = { code: res.code, discount: res.discount };
      setApplied(next);
      onChange(next);
    });
  }

  function clear() {
    setApplied(null);
    setInput("");
    setError(null);
    onChange(null);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Coupon code
      </h2>
      {applied ? (
        <div className="flex items-center justify-between rounded-lg bg-success/10 px-3 py-2">
          <div className="text-sm">
            <span className="font-mono font-medium">{applied.code}</span>
            <span className="text-muted-foreground">
              {" "}
              applied · −{formatPrice(applied.discount)}
            </span>
          </div>
          <button
            type="button"
            onClick={clear}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="WELCOME10"
            className="border-input bg-background h-11 flex-1 rounded-lg border px-3 font-mono uppercase tracking-wide"
            maxLength={32}
          />
          <button
            type="button"
            onClick={apply}
            disabled={pending || !input.trim()}
            className="bg-secondary text-secondary-foreground h-11 rounded-full px-4 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "…" : "Apply"}
          </button>
        </div>
      )}
      {error ? (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      ) : null}
    </section>
  );
}
