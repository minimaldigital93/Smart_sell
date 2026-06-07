import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, AlertTriangle, Heart } from "lucide-react";
import { getProductBySlug, getRelatedProducts } from "@/services/products";
import { Price } from "@/components/shop/price";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductDetailActions } from "@/components/shop/product-detail-actions";
import { ProductCard } from "@/components/shop/product-card";
import { SectionHeader } from "@/components/shared/section-header";
import { CATEGORIES } from "@/lib/constants";
import { CATEGORY_META } from "@/lib/categories";
import { cn } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return {
    title: product?.name ?? "Product",
    description: product?.description ?? undefined,
  };
}

export const revalidate = 60;

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product, 4);
  const categoryLabel =
    CATEGORIES.find((c) => c.slug === product.category)?.label ?? product.category;
  const meta = CATEGORY_META[product.category as keyof typeof CATEGORY_META];
  const CategoryIcon = meta?.icon;
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;
  const cover = product.images[0] ?? null;
  const effectivePrice = product.discount_price ?? product.price;

  return (
    <div className="flex flex-col gap-6 pb-6 pt-2">
      <nav className="text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/shop" className="hover:text-foreground">
          Shop
        </Link>
        <span className="px-1">/</span>
        <Link
          href={`/category/${product.category}`}
          className="hover:text-foreground"
        >
          {categoryLabel}
        </Link>
      </nav>

      <ProductGallery images={product.images} alt={product.name} />

      <header className="flex flex-col gap-3">
        <Link
          href={`/category/${product.category}`}
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-secondary-foreground shadow-soft transition-transform active:scale-[0.97] bg-linear-to-r",
            meta?.bannerGradient ?? "from-pink-100 to-nude-100",
          )}
        >
          {CategoryIcon ? (
            <CategoryIcon className={cn("h-3.5 w-3.5", meta?.iconClass)} />
          ) : null}
          {categoryLabel}
        </Link>

        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          {product.name}
        </h1>
        <Price
          price={product.price}
          discount={product.discount_price}
          size="lg"
          showBadge
        />

        <span
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            outOfStock
              ? "bg-destructive/10 text-destructive"
              : lowStock
                ? "bg-warning/10 text-warning"
                : "bg-success/10 text-success",
          )}
        >
          {outOfStock ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {outOfStock
            ? "Out of stock"
            : lowStock
              ? `Only ${product.stock} left`
              : "In stock"}
        </span>
      </header>

      <ProductDetailActions
        productId={product.id}
        name={product.name}
        price={effectivePrice}
        image={cover}
        maxStock={product.stock}
        disabled={outOfStock}
      />

      {product.description ? (
        <section className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="h-3.5 w-1 rounded-full bg-primary" aria-hidden />
            Description
          </h2>
          <p className="text-sm leading-relaxed text-foreground/90">
            {product.description}
          </p>
        </section>
      ) : null}

      {product.ingredients ? (
        <section className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="h-3.5 w-1 rounded-full bg-primary" aria-hidden />
            Ingredients
          </h2>
          <p className="text-sm leading-relaxed text-foreground/90">
            {product.ingredients}
          </p>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeader icon={Heart} title="You may also like" />
          <div className="grid grid-cols-2 gap-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
