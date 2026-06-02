import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "@/components/shop/product-card";
import {
  getFeaturedProducts,
  getPromoProducts,
} from "@/services/products";

export const revalidate = 60;

export default async function ShopHomePage() {
  const [featured, promos] = await Promise.all([
    getFeaturedProducts(6),
    getPromoProducts(6),
  ]);

  return (
    <div className="flex flex-col gap-8 pt-2">
      <section
        className="relative overflow-hidden rounded-3xl bg-linear-to-br from-pink-100 via-nude-50 to-pink-200 p-6 shadow-soft"
        aria-label="Hero"
      >
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-pink-500">
          New season
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">
          Discover your<br />signature glow.
        </h1>
        <p className="mt-3 max-w-[28ch] text-sm text-muted-foreground">
          Curated cosmetics, fast delivery, and seamless KHQR checkout.
        </p>
        <Link href="/shop" className={cn(buttonVariants({ size: "md" }), "mt-5")}>
          Shop now
        </Link>
      </section>

      <section aria-labelledby="categories-heading" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 id="categories-heading" className="text-base font-semibold tracking-tight">
            Categories
          </h2>
          <Link
            href="/shop"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            See all
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="flex aspect-square flex-col items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-soft transition-transform active:scale-[0.98]"
            >
              <span className="text-sm font-medium">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 ? (
        <section aria-labelledby="featured-heading" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 id="featured-heading" className="text-base font-semibold tracking-tight">
              Featured
            </h2>
            <Link
              href="/shop"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              See all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {promos.length > 0 ? (
        <section aria-labelledby="promos-heading" className="flex flex-col gap-4">
          <h2 id="promos-heading" className="text-base font-semibold tracking-tight">
            On sale
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {promos.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {featured.length === 0 && promos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-8 text-center text-sm text-muted-foreground">
          Catalog is empty. Apply{" "}
          <code className="rounded bg-background px-1.5 py-0.5 text-xs">
            database/schema.sql
          </code>{" "}
          and the demo seed to see products.
        </p>
      ) : null}
    </div>
  );
}
