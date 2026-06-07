import { Store } from "lucide-react";
import { CategoryPills } from "@/components/shop/category-pills";
import { ProductGrid } from "@/components/shop/product-grid";
import { PageHero } from "@/components/shared/page-hero";
import { getAllProducts } from "@/services/products";

export const revalidate = 60;

export const metadata = { title: "Shop" };

export default async function ShopAllPage() {
  const products = await getAllProducts(48);
  return (
    <div className="flex flex-col gap-5 pt-2">
      <PageHero
        icon={Store}
        title="Shop"
        subtitle={`${products.length} ${products.length === 1 ? "product" : "products"} • every cosmetic in one place`}
      />
      <CategoryPills />
      <ProductGrid
        products={products}
        emptyTitle="No products yet"
        emptyDescription="Once you import your catalog, items appear here."
      />
    </div>
  );
}
