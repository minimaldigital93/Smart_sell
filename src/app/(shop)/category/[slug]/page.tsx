import { notFound } from "next/navigation";
import { CategoryPills } from "@/components/shop/category-pills";
import { ProductGrid } from "@/components/shop/product-grid";
import { PageHero } from "@/components/shared/page-hero";
import { getProductsByCategory } from "@/services/products";
import { getActiveCategoryBySlug } from "@/services/categories";
import { categoryVisual } from "@/lib/categories";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const cat = await getActiveCategoryBySlug(slug);
  return { title: cat?.name ?? "Category" };
}

export const revalidate = 60;

export default async function CategoryPage({ params }: { params: Params }) {
  const { slug } = await params;
  const cat = await getActiveCategoryBySlug(slug);
  if (!cat) notFound();

  const products = await getProductsByCategory(cat.id, 48);
  const visual = categoryVisual({
    slug: cat.slug,
    icon: cat.icon,
    color: cat.color,
  });

  return (
    <div className="flex flex-col gap-5 pt-2">
      <PageHero
        icon={visual.Icon}
        iconClass={visual.iconClass}
        gradient={visual.bannerGradient}
        title={cat.name}
        subtitle={`${products.length} ${products.length === 1 ? "product" : "products"}`}
      />
      <CategoryPills activeSlug={slug} />
      <ProductGrid
        products={products}
        emptyTitle={`No ${cat.name.toLowerCase()} yet`}
        emptyDescription="Check back soon — we're restocking."
      />
    </div>
  );
}
