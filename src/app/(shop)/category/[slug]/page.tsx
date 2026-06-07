import { notFound } from "next/navigation";
import { CategoryPills } from "@/components/shop/category-pills";
import { ProductGrid } from "@/components/shop/product-grid";
import { PageHero } from "@/components/shared/page-hero";
import { getProductsByCategory } from "@/services/products";
import { CATEGORIES } from "@/lib/constants";
import { CATEGORY_META } from "@/lib/categories";
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
  const meta = CATEGORY_META[cat.slug];

  return (
    <div className="flex flex-col gap-5 pt-2">
      <PageHero
        icon={meta.icon}
        iconClass={meta.iconClass}
        gradient={meta.bannerGradient}
        title={cat.label}
        subtitle={`${products.length} ${products.length === 1 ? "product" : "products"}`}
      />
      <CategoryPills activeSlug={slug} />
      <ProductGrid
        products={products}
        emptyTitle={`No ${cat.label.toLowerCase()} yet`}
        emptyDescription="Check back soon — we're restocking."
      />
    </div>
  );
}
