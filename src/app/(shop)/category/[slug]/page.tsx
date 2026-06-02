import { notFound } from "next/navigation";
import { CategoryPills } from "@/components/shop/category-pills";
import { ProductGrid } from "@/components/shop/product-grid";
import { getProductsByCategory } from "@/services/products";
import { CATEGORIES } from "@/lib/constants";
import type { ProductCategoryEnum } from "@/types/database";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const cat = CATEGORIES.find((c) => c.slug === slug);
  return { title: cat?.label ?? "Category" };
}

export const revalidate = 60;

export default async function CategoryPage({ params }: { params: Params }) {
  const { slug } = await params;
  const cat = CATEGORIES.find((c) => c.slug === slug);
  if (!cat) notFound();

  const products = await getProductsByCategory(
    cat.slug as ProductCategoryEnum,
    48,
  );

  return (
    <div className="flex flex-col gap-5 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{cat.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </header>
      <CategoryPills activeSlug={slug} />
      <ProductGrid
        products={products}
        emptyTitle={`No ${cat.label.toLowerCase()} yet`}
        emptyDescription="Check back soon — we're restocking."
      />
    </div>
  );
}
