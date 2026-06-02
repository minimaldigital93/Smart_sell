import { ProductForm } from "@/components/admin/product-form";

export const metadata = { title: "New product" };

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a product to your catalog. It will appear on the storefront once
          set to active.
        </p>
      </header>
      <ProductForm mode="new" />
    </div>
  );
}
