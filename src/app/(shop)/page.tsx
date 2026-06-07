import Link from "next/link";
import {
  Search,
  Sparkles,
  Truck,
  QrCode,
  ShieldCheck,
  ArrowRight,
  BadgePercent,
  Flame,
  Clock,
} from "lucide-react";
import { CATEGORIES } from "@/lib/constants";
import { CATEGORY_META } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "@/components/shop/product-card";
import { SectionHeader } from "@/components/shared/section-header";
import {
  getFeaturedProducts,
  getPromoProducts,
  getNewArrivalProducts,
} from "@/services/products";

export const revalidate = 60;

const PERKS = [
  { icon: Truck, label: "Fast delivery" },
  { icon: QrCode, label: "KHQR checkout" },
  { icon: ShieldCheck, label: "100% authentic" },
] as const;

export default async function ShopHomePage() {
  const [featured, promos, latest] = await Promise.all([
    getFeaturedProducts(8),
    getPromoProducts(6),
    getNewArrivalProducts(6),
  ]);

  const isEmpty =
    featured.length === 0 && promos.length === 0 && latest.length === 0;

  return (
    <div className="flex flex-col gap-9 pt-2">
      {/* Prominent search entry — primary task: find a product fast */}
      <Link
        href="/search"
        aria-label="Search products"
        className="flex h-12 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 text-muted-foreground shadow-soft transition-colors active:bg-muted"
      >
        <Search className="h-5 w-5" />
        <span className="text-[15px]">Search lipstick, perfume…</span>
      </Link>

      {/* Hero */}
      <section
        className="relative isolate overflow-hidden rounded-2xl bg-linear-to-br from-pink-100 via-nude-50 to-pink-200 p-6 shadow-card"
        aria-label="Hero"
      >
        <div
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-pink-300/50 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-nude-300/40 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-pink-500 shadow-soft backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            New season
          </span>
          <h1 className="mt-4 text-[28px] font-semibold leading-[1.1] tracking-tight">
            Discover your
            <br />
            <span className="bg-linear-to-r from-pink-500 to-nude-500 bg-clip-text text-transparent">
              signature glow.
            </span>
          </h1>
          <p className="mt-3 max-w-[30ch] text-sm leading-relaxed text-muted-foreground">
            Curated cosmetics, fast delivery, and a seamless KHQR checkout —
            crafted for you.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link
              href="/shop"
              className={cn(buttonVariants({ size: "md" }), "shadow-soft")}
            >
              Shop now
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/wishlist"
              className="text-sm font-medium text-foreground/70 underline-offset-4 hover:underline"
            >
              My wishlist
            </Link>
          </div>
        </div>
      </section>

      {/* Perks / trust strip */}
      <section aria-label="Why shop with us" className="grid grid-cols-3 gap-2">
        {PERKS.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card px-2 py-3 text-center shadow-soft"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span className="text-[11px] font-medium leading-tight text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section aria-labelledby="categories-heading" className="flex flex-col gap-4">
        <div id="categories-heading">
          <SectionHeader title="Shop by category" href="/shop" />
        </div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
          {CATEGORIES.map((c) => {
            const meta = CATEGORY_META[c.slug];
            const Icon = meta.icon;
            return (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className={cn(
                  "group flex w-24 shrink-0 flex-col items-center gap-2.5 rounded-3xl bg-linear-to-b p-3 shadow-soft transition-transform active:scale-[0.97]",
                  meta.gradient,
                )}
              >
                <span className="grid h-14 w-14 place-items-center rounded-full bg-white/80 shadow-soft backdrop-blur transition-transform group-hover:scale-105">
                  <Icon className={cn("h-6 w-6", meta.iconClass)} />
                </span>
                <span className="text-center text-[12px] font-semibold leading-tight text-secondary-foreground">
                  {c.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured — horizontal carousel for a premium browse feel */}
      {featured.length > 0 ? (
        <section aria-labelledby="featured-heading" className="flex flex-col gap-4">
          <div id="featured-heading">
            <SectionHeader icon={Flame} title="Featured picks" href="/shop" />
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
            {featured.map((p) => (
              <div key={p.id} className="w-40 shrink-0 snap-start">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* On sale */}
      {promos.length > 0 ? (
        <section aria-labelledby="promos-heading" className="flex flex-col gap-4">
          <div
            id="promos-heading"
            className="relative overflow-hidden rounded-2xl bg-linear-to-r from-pink-400 to-nude-400 px-4 py-3.5 shadow-soft"
          >
            <div
              className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/20 blur-2xl"
              aria-hidden
            />
            <div className="relative flex items-center gap-2.5 text-white">
              <BadgePercent className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold leading-tight">On sale now</p>
                <p className="text-[11px] text-white/80">
                  Limited-time offers, while stocks last
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {promos.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* New arrivals */}
      {latest.length > 0 ? (
        <section aria-labelledby="latest-heading" className="flex flex-col gap-4">
          <div id="latest-heading">
            <SectionHeader icon={Clock} title="New arrivals" href="/shop" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {latest.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Browse all */}
      {!isEmpty ? (
        <Link
          href="/shop"
          className={cn(
            buttonVariants({ variant: "outline", size: "md" }),
            "w-full",
          )}
        >
          Browse all products
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-8 text-center text-sm text-muted-foreground">
          Catalog is empty. Apply{" "}
          <code className="rounded bg-background px-1.5 py-0.5 text-xs">
            database/schema.sql
          </code>{" "}
          and the demo seed to see products.
        </p>
      )}
    </div>
  );
}
