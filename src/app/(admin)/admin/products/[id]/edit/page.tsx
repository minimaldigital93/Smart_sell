import { notFound } from "next/navigation";
import { getProductByIdAdmin } from "@/services/products-admin";
import { ProductForm } from "@/components/admin/product-form";
import { DeleteProductButton } from "@/components/admin/delete-product-button";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Params }) {
  const { id } = await params;
  const product = await getProductByIdAdmin(id);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-5">
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
        defaults={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description ?? "",
          ingredients: product.ingredients ?? "",
          category: product.category,
          price: product.price,
          discount_price: product.discount_price ?? "",
          barcode: product.barcode ?? "",
          sku: product.sku ?? "",
          featured: product.featured,
          is_active: product.is_active,
          initial_stock: product.stock,
          images: product.images,
        }}
      />
    </div>
  );
}
