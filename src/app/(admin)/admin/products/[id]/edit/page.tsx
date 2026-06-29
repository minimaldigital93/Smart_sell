import { notFound } from "next/navigation";
import { getProductByIdAdmin } from "@/services/products-admin";
import { listActiveCategories, getCategory } from "@/services/categories";
import { ProductForm } from "@/components/admin/product-form";
import { DeleteProductButton } from "@/components/admin/delete-product-button";
import type { ShopCategory } from "@/types";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Params }) {
  const { id } = await params;
  const product = await getProductByIdAdmin(id);
  if (!product) notFound();

  // Active categories drive the dropdown; if this product's category is
  // currently inactive, include it so the selection isn't silently lost.
  const categories = await listActiveCategories();
  let options: Pick<ShopCategory, "id" | "name">[] = categories;
  if (product.category_id && !categories.some((c) => c.id === product.category_id)) {
    const current = await getCategory(product.category_id);
    if (current) options = [current, ...categories];
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Edit product
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {product.name}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {product.id.slice(0, 8)}
          </p>
        </div>
        <DeleteProductButton productId={product.id} isActive={product.is_active} />
      </header>
      <ProductForm
        mode="edit"
        categories={options}
        defaults={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description ?? "",
          ingredients: product.ingredients ?? "",
          category_id: product.category_id,
          price: product.price,
          discount_price: product.discount_price ?? "",
          barcode: product.barcode ?? "",
          sku: product.sku ?? "",
          featured: product.featured,
          on_sale: product.on_sale,
          new_arrival: product.new_arrival,
          is_active: product.is_active,
          initial_stock: product.stock,
          images: product.images,
        }}
      />
    </div>
  );
}
