"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { movementSchema, type MovementValues } from "@/lib/inventory/schemas";
import { applyMovementAction } from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";

type FormInput = z.input<typeof movementSchema>;

type ProductOption = {
  id: string;
  name: string;
  current_stock: number;
};

export function QuickMovementForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [selected, setSelected] = useState<ProductOption | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, MovementValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: { productId: "", type: "in", quantity: 1, notes: "" },
  });

  const tooShort = query.trim().length < 2;

  // Lookup products by name/barcode whenever the query changes (debounced).
  useEffect(() => {
    if (tooShort) return;
    let cancelled = false;
    const supabase = createClient();
    const handle = setTimeout(async () => {
      const escaped = query.trim().replace(/[%_]/g, (m) => `\\${m}`);
      const pattern = `%${escaped}%`;
      const { data } = await supabase
        .from("product_inventory")
        .select("current_stock, products!inner(id, name, barcode)")
        .or(
          `name.ilike.${pattern},barcode.ilike.${pattern}`,
          { referencedTable: "products" },
        )
        .limit(8);
      if (cancelled) return;

      type Row = {
        current_stock: number;
        products: { id: string; name: string; barcode: string | null };
      };
      const opts: ProductOption[] = ((data ?? []) as unknown as Row[]).map((r) => ({
        id: r.products.id,
        name: r.products.name,
        current_stock: r.current_stock,
      }));
      setOptions(opts);
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, tooShort]);

  const shownOptions = tooShort ? [] : options;

  function pick(opt: ProductOption) {
    setSelected(opt);
    setValue("productId", opt.id, { shouldValidate: true });
    setOptions([]);
    setQuery(opt.name);
  }

  async function onSubmit(values: MovementValues) {
    if (!values.productId) {
      toast.error("Choose a product first.");
      return;
    }
    setPending(true);
    const result = await applyMovementAction(values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Stock updated · now ${result.resultingStock}`);
    setSelected(null);
    setQuery("");
    reset({ productId: "", type: "in", quantity: 1, notes: "" });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <input type="hidden" {...register("productId")} />

      <div className="relative">
        <Label htmlFor="quick-product">Product</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="quick-product"
            placeholder="Search by name or barcode…"
            className="pl-11"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setValue("productId", "");
            }}
            autoComplete="off"
          />
        </div>
        {shownOptions.length > 0 && !selected ? (
          <ul className="absolute z-10 mt-1 w-full divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-popover">
            {shownOptions.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
                  onClick={() => pick(opt)}
                >
                  <span className="line-clamp-1">{opt.name}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {opt.current_stock}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <FieldError message={errors.productId?.message} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="quick-type">Type</Label>
          <select
            id="quick-type"
            {...register("type")}
            className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-[15px] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="in">Stock in</option>
            <option value="out">Stock out</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </div>
        <div>
          <Label htmlFor="quick-qty">Quantity</Label>
          <Input
            id="quick-qty"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            {...register("quantity")}
          />
          <FieldError message={errors.quantity?.message} />
        </div>
      </div>

      <div>
        <Label htmlFor="quick-notes">Notes (optional)</Label>
        <Input id="quick-notes" {...register("notes")} />
      </div>

      <Button type="submit" size="md" disabled={pending || !selected}>
        {pending ? "Saving…" : "Apply movement"}
      </Button>
    </form>
  );
}
