import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types";
import { Price } from "@/components/shop/price";
import { FavoriteButton } from "@/components/shop/favorite-button";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { discountPercent } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  // Postgres numeric → string at runtime; coerce so discount logic actually fires.
  const priceNum = Number(product.price);
  const discountNum =
    product.discount_price == null ? 0 : Number(product.discount_price);
  const hasDiscount =
    Number.isFinite(discountNum) &&
    discountNum > 0 &&
    discountNum < priceNum;
  const unitPrice = hasDiscount ? discountNum : priceNum;

  const outOfStock = Number(product.stock) <= 0;
  const cover = product.images[0] ?? null;

  return (
    <article className="group relative flex flex-col">
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-3/4 overflow-hidden rounded-2xl bg-muted shadow-soft"
        aria-label={product.name}
      >
        {cover ? (
          <Image
            src={cover}
            alt={product.name}
            fill
            sizes="(max-width: 600px) 50vw, 240px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
            No image
          </div>
        )}

        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {hasDiscount ? (
            <span className="rounded-full bg-pink-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-soft">
              −{discountPercent(priceNum, discountNum)}%
            </span>
          ) : product.on_sale ? (
            <span className="rounded-full bg-pink-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-soft">
              Sale
            </span>
          ) : null}
          {product.new_arrival ? (
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-soft">
              New
            </span>
          ) : null}
        </div>

        {outOfStock ? (
          <span className="absolute right-2 top-2 rounded-full bg-foreground/85 px-2 py-0.5 text-[11px] font-medium text-white">
            Sold out
          </span>
        ) : null}

        <FavoriteButton productId={product.id} className="absolute bottom-2 right-2" />
      </Link>

      <div className="mt-2 flex items-start justify-between gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <Link
            href={`/product/${product.slug}`}
            className="line-clamp-2 text-[13px] font-medium leading-snug hover:underline"
          >
            {product.name}
          </Link>
          <Price
            price={product.price}
            discount={product.discount_price}
            size="sm"
            className="mt-1"
          />
        </div>

        <AddToCartButton
          productId={product.id}
          name={product.name}
          price={unitPrice}
          image={cover}
          disabled={outOfStock}
          variant="icon"
        />
      </div>
    </article>
  );
}
