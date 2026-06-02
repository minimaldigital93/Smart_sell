"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck } from "lucide-react";
import { movementSchema, type MovementValues } from "@/lib/inventory/schemas";
import { applyMovementAction } from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";

type FormInput = z.input<typeof movementSchema>;

const TYPE_META = {
  in: { label: "Stock in", icon: ArrowDownToLine, helper: "Receive new units." },
  out: { label: "Stock out", icon: ArrowUpFromLine, helper: "Remove units." },
  adjustment: {
    label: "Adjustment",
    icon: ClipboardCheck,
    helper: "Set the current on-hand quantity (e.g. after a stocktake).",
  },
} as const;

export function MovementForm({
  productId,
  productName,
  currentStock,
  defaultType = "in",
}: {
  productId: string;
  productName?: string;
  currentStock?: number;
  defaultType?: "in" | "out" | "adjustment";
}) {
  "use no memo";
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, MovementValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      productId,
      type: defaultType,
      quantity: defaultType === "adjustment" ? (currentStock ?? 0) : 1,
      notes: "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const type = watch("type") as MovementValues["type"];
  const Meta = TYPE_META[type];

  async function onSubmit(values: MovementValues) {
    setPending(true);
    const result = await applyMovementAction(values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Stock ${type === "in" ? "added" : type === "out" ? "removed" : "set"} · now ${result.resultingStock}`,
    );
    reset({
      productId,
      type,
      quantity: type === "adjustment" ? (result.resultingStock ?? 0) : 1,
      notes: "",
    });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <input type="hidden" {...register("productId")} />

      <div>
        <Label>Movement type</Label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TYPE_META) as Array<keyof typeof TYPE_META>).map((k) => {
            const M = TYPE_META[k];
            const selected = type === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setValue("type", k, { shouldValidate: true });
                  if (k === "adjustment")
                    setValue("quantity", currentStock ?? 0, { shouldValidate: true });
                  else setValue("quantity", 1, { shouldValidate: true });
                }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl border px-3 py-3 text-xs font-medium transition-colors",
                  selected
                    ? "border-primary bg-accent text-foreground shadow-soft"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                <M.icon className="h-4 w-4" />
                {M.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{Meta.helper}</p>
      </div>

      <div>
        <Label htmlFor="quantity">
          {type === "adjustment" ? "New on-hand quantity" : "Quantity"}
        </Label>
        <Input
          id="quantity"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          {...register("quantity")}
        />
        <FieldError message={errors.quantity?.message} />
        {productName && type === "adjustment" && (
          <p className="mt-1 text-xs text-muted-foreground">
            Currently on-hand: {currentStock ?? 0}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input id="notes" placeholder="Supplier, PO #, reason…" {...register("notes")} />
        <FieldError message={errors.notes?.message as string | undefined} />
      </div>

      <Button type="submit" size="md" disabled={pending}>
        {pending ? "Saving…" : "Apply movement"}
      </Button>
    </form>
  );
}
