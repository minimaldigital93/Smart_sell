import { ProductForm } from "@/components/admin/product-form";
import { listActiveCategories } from "@/services/categories";
import { getMyStoreId } from "@/services/stores";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const [categories, storeId] = await Promise.all([
    listActiveCategories(),
    getMyStoreId(),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a product to your catalog. It will appear on the storefront once
          set to active.
        </p>
      </header>
      <ProductForm mode="new" categories={categories} storeId={storeId} />
    </div>
  );
}
