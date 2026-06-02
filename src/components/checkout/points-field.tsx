"use client";

import { useState } from "react";
import {
  pointsToUsd,
  MAX_POINTS_REDEMPTION_RATIO,
  POINTS_PER_DOLLAR_CREDIT,
} from "@/lib/loyalty/constants";
import { formatPrice } from "@/lib/utils";

export type AppliedPoints = {
  points: number;
  discount: number;
};

export function PointsField({
  balance,
  subtotal,
  onChange,
}: {
  balance: number;
  subtotal: number;
  onChange: (applied: AppliedPoints | null) => void;
}) {
  const maxDiscount = Number((subtotal * MAX_POINTS_REDEMPTION_RATIO).toFixed(2));
  const maxAffordablePoints = Math.floor(maxDiscount * POINTS_PER_DOLLAR_CREDIT);
  const maxUsable = Math.min(balance, maxAffordablePoints);

  const [input, setInput] = useState("");
  const [applied, setApplied] = useState<AppliedPoints | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (balance === 0) return null;

  function apply() {
    setError(null);
    const pts = parseInt(input, 10);
    if (isNaN(pts) || pts <= 0) {
      setError("Enter a valid number of points.");
      return;
    }
    if (pts > balance) {
      setError(`You only have ${balance} points available.`);
      return;
    }
    if (pts > maxUsable) {
      setError(
        `Max you can use here is ${maxUsable} points (50% of subtotal).`,
      );
      return;
    }
    const discount = pointsToUsd(pts);
    const next = { points: pts, discount };
    setApplied(next);
    onChange(next);
  }

  function useAll() {
    setError(null);
    if (maxUsable <= 0) return;
    const discount = pointsToUsd(maxUsable);
    const next = { points: maxUsable, discount };
    setApplied(next);
    setInput(String(maxUsable));
    onChange(next);
  }

  function clear() {
    setApplied(null);
    setInput("");
    setError(null);
    onChange(null);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Loyalty points
        </h2>
        <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-semibold text-pink-600">
          {balance} pts
        </span>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {POINTS_PER_DOLLAR_CREDIT} points = {formatPrice(1)} · up to{" "}
        {formatPrice(maxDiscount)} off this order
      </p>

      {applied ? (
        <div className="flex items-center justify-between rounded-lg bg-success/10 px-3 py-2">
          <div className="text-sm">
            <span className="font-medium">{applied.points} pts</span>
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
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`1–${maxUsable}`}
            min={1}
            max={maxUsable}
            className="border-input bg-background h-11 flex-1 rounded-lg border px-3 tabular-nums"
          />
          <button
            type="button"
            onClick={useAll}
            className="h-11 rounded-full bg-secondary px-3 text-xs font-medium text-secondary-foreground"
          >
            Use all
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!input.trim()}
            className="h-11 rounded-full bg-secondary px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}

      {error ? (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      ) : null}
    </section>
  );
}
