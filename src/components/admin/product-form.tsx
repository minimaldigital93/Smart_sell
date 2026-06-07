"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ScanLine, Sparkles } from "lucide-react";
import type { z } from "zod";
import {
  productInputSchema,
  type ProductInputValues,
} from "@/lib/products/schemas";

type FormInput = z.input<typeof productInputSchema>;
import { generateEan13, slugify } from "@/lib/products/barcode";
import { CATEGORIES } from "@/lib/constants";
import {
  createProductAction,
  updateProductAction,
} from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { ProductImageUpload } from "@/components/admin/product-image-upload";
import { BarcodeScanner } from "@/components/admin/scanner/barcode-scanner";

type Props = {
  mode: "new" | "edit";
  defaults?: Partial<ProductInputValues> & { id?: string };
};

export function ProductForm({ mode, defaults }: Props) {
  "use no memo";
  const router = useRouter();
  const productId = useMemo(
    () => defaults?.id ?? crypto.randomUUID(),
    [defaults?.id],
  );
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FormInput, unknown, ProductInputValues>({
    resolver: zodResolver(productInputSchema),
    defaultValues: {
      id: productId,
      name: defaults?.name ?? "",
      slug: defaults?.slug ?? "",
      description: defaults?.description ?? "",
      ingredients: defaults?.ingredients ?? "",
      category: defaults?.category ?? "skincare",
      price: defaults?.price ?? 0,
      discount_price: defaults?.discount_price ?? "",
      barcode: defaults?.barcode ?? "",
      sku: defaults?.sku ?? "",
      featured: defaults?.featured ?? false,
      on_sale: defaults?.on_sale ?? false,
      new_arrival: defaults?.new_arrival ?? false,
      is_active: defaults?.is_active ?? true,
      initial_stock: defaults?.initial_stock ?? 0,
      images: defaults?.images ?? [],
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const images = watch("images");

  async function onSubmit(values: ProductInputValues) {
    setSubmitting(true);
    const action = mode === "new" ? createProductAction : updateProductAction;
    const result = await action({ ...values, id: productId });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(mode === "new" ? "Product created" : "Saved");
    router.push("/admin/products");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Images
        </h2>
        <Controller
          control={control}
          name="images"
          render={({ field }) => (
            <ProductImageUpload
              productId={productId}
              images={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <FieldError message={errors.images?.message as string | undefined} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Basics
        </h2>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoComplete="off"
              {...register("name", {
                onBlur: () => {
                  if (!getValues("slug")) {
                    setValue("slug", slugify(getValues("name")), {
                      shouldValidate: true,
                    });
                  }
                },
              })}
            />
            <FieldError message={errors.name?.message} />
          </div>
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              placeholder="auto-generated from name if blank"
              {...register("slug")}
            />
            <FieldError message={errors.slug?.message} />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              {...register("category")}
              className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-[15px] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
            <FieldError message={errors.category?.message} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pricing
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="price">Price (USD)</Label>
            <Input
              id="price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              {...register("price")}
            />
            <FieldError message={errors.price?.message} />
          </div>
          <div>
            <Label htmlFor="discount_price">Discount price (USD)</Label>
            <Input
              id="discount_price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="optional"
              {...register("discount_price")}
            />
            <FieldError message={errors.discount_price?.message as string | undefined} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Identification
        </h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" placeholder="internal stock-keeping unit" {...register("sku")} />
            <FieldError message={errors.sku?.message} />
          </div>
          <div>
            <Label htmlFor="barcode">Barcode</Label>
            <div className="flex items-center gap-2">
              <Input id="barcode" placeholder="EAN-13 / UPC" {...register("barcode")} />
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setScanning(true)}
                aria-label="Scan barcode with camera"
              >
                <ScanLine className="h-4 w-4" />
                Scan
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() =>
                  setValue("barcode", generateEan13(), { shouldValidate: true })
                }
              >
                <Sparkles className="h-4 w-4" />
                Generate
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Scan an existing barcode from packaging, or generate a fresh EAN-13.
            </p>
            <FieldError message={errors.barcode?.message} />
          </div>
        </div>
      </section>

      {mode === "new" ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Initial stock
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Starting on-hand quantity. After creation, manage stock via the
            Inventory tab.
          </p>
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            {...register("initial_stock")}
          />
          <FieldError message={errors.initial_stock?.message} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Content
        </h2>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              rows={4}
              {...register("description")}
              className="w-full rounded-2xl border border-input bg-background p-4 text-[15px] placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <Label htmlFor="ingredients">Ingredients</Label>
            <textarea
              id="ingredients"
              rows={3}
              {...register("ingredients")}
              className="w-full rounded-2xl border border-input bg-background p-4 text-[15px] placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Storefront status
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Curate where this product appears in the customer storefront.
        </p>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex items-center justify-between gap-3 rounded-xl px-1">
            <span>
              <span className="block font-medium">Featured</span>
              <span className="block text-xs text-muted-foreground">
                Shown in “Featured picks” on the home page
              </span>
            </span>
            <input
              type="checkbox"
              {...register("featured")}
              className="h-5 w-5 accent-pink-400"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl px-1">
            <span>
              <span className="block font-medium">On sale</span>
              <span className="block text-xs text-muted-foreground">
                Shown in “On sale now”; add a discount price for a badge
              </span>
            </span>
            <input
              type="checkbox"
              {...register("on_sale")}
              className="h-5 w-5 accent-pink-400"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl px-1">
            <span>
              <span className="block font-medium">New arrival</span>
              <span className="block text-xs text-muted-foreground">
                Shown in “New arrivals” with a “New” badge
              </span>
            </span>
            <input
              type="checkbox"
              {...register("new_arrival")}
              className="h-5 w-5 accent-pink-400"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border-t border-border/60 px-1 pt-3">
            <span>
              <span className="block font-medium">Active</span>
              <span className="block text-xs text-muted-foreground">
                Visible on the storefront
              </span>
            </span>
            <input
              type="checkbox"
              {...register("is_active")}
              className="h-5 w-5 accent-pink-400"
            />
          </label>
        </div>
      </section>

      {scanning ? (
        <BarcodeScanner
          onDecoded={(text) => {
            setValue("barcode", text.trim(), { shouldValidate: true });
            setScanning(false);
            toast.success("Barcode captured");
          }}
          onCancel={() => setScanning(false)}
        />
      ) : null}

      <div className="sticky bottom-3 z-10 flex gap-2 rounded-2xl border border-border bg-background/85 p-2 shadow-popover backdrop-blur-xl">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => router.push("/admin/products")}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="md"
          disabled={submitting || (images?.length ?? 0) === 0}
          className="flex-1"
        >
          {submitting
            ? "Saving…"
            : mode === "new"
              ? "Create product"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
