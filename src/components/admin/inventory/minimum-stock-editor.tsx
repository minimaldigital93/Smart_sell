"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateMinStockAction } from "@/app/actions/inventory";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function MinimumStockEditor({
  productId,
  initialMinimum,
}: {
  productId: string;
  initialMinimum: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(initialMinimum));
  const [pending, startTransition] = useTransition();

  function save() {
    const minimumStock = Number(value);
    if (Number.isNaN(minimumStock) || minimumStock < 0) {
      toast.error("Enter a whole number.");
      return;
    }
    if (minimumStock === initialMinimum) return;
    startTransition(async () => {
      const result = await updateMinStockAction({ productId, minimumStock });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Threshold updated");
      router.refresh();
    });
  }

  const dirty = Number(value) !== initialMinimum;

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label
          htmlFor={`min-${productId}`}
          className="mb-1.5 block text-sm font-medium"
        >
          Minimum stock threshold
        </label>
        <Input
          id={`min-${productId}`}
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button
        type="button"
        size="md"
        variant={dirty ? "default" : "outline"}
        disabled={pending || !dirty}
        onClick={save}
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
