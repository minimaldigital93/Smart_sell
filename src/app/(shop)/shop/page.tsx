import { CategoryPills } from "@/components/shop/category-pills";
import { ProductGrid } from "@/components/shop/product-grid";
import { getAllProducts } from "@/services/products";

export const revalidate = 60;

export const metadata = { title: "Shop" };

export default async function ShopAllPage() {
  const products = await getAllProducts(48);
  return (
    <div className="flex flex-col gap-5 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Shop</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every cosmetic in one place.
        </p>
      </header>
      <CategoryPills />
      <ProductGrid
        products={products}
        emptyTitle="No products yet"
        emptyDescription="Once you import your catalog, items appear here."
      />
    </div>
  );
}
