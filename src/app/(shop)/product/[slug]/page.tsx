import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug, getRelatedProducts } from "@/services/products";
import { Price } from "@/components/shop/price";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductDetailActions } from "@/components/shop/product-detail-actions";
import { ProductCard } from "@/components/shop/product-card";
import { CATEGORIES } from "@/lib/constants";

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
  const outOfStock = product.stock <= 0;
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

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          {product.name}
        </h1>
        <Price
          price={product.price}
          discount={product.discount_price}
          size="lg"
          showBadge
        />
        <p
          className={
            outOfStock
              ? "text-sm font-medium text-destructive"
              : "text-sm text-success"
          }
        >
          {outOfStock
            ? "Out of stock"
            : product.stock <= 5
              ? `Only ${product.stock} left`
              : "In stock"}
        </p>
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
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Description
          </h2>
          <p className="text-sm leading-relaxed text-foreground/90">
            {product.description}
          </p>
        </section>
      ) : null}

      {product.ingredients ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Ingredients
          </h2>
          <p className="text-sm leading-relaxed text-foreground/90">
            {product.ingredients}
          </p>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold tracking-tight">You may also like</h2>
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
