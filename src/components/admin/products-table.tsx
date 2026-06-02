import Image from "next/image";
import Link from "next/link";
import { Pencil } from "lucide-react";
import type { Product } from "@/types";
import { CATEGORIES } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import { EmptyState } from "@/components/shop/empty-state";
import { SwipeableProductCard } from "@/components/admin/swipeable-product-card";

function categoryLabel(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

export function ProductsTable({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <EmptyState
        title="No products"
        description="Add your first product to populate the store."
      />
    );
  }

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3 text-right">Price</th>
              <th className="px-3 py-3 text-right">Stock</th>
              <th className="px-3 py-3 text-center">Status</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-muted/40">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.images[0] ? (
                        <Image
                          src={p.images[0]}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-1 font-medium">{p.name}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {p.sku ?? p.slug}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {categoryLabel(p.category)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  <span className="font-medium">
                    {formatPrice(p.discount_price ?? p.price)}
                  </span>
                  {p.discount_price ? (
                    <span className="ml-1 text-xs text-muted-foreground line-through">
                      {formatPrice(p.price)}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {p.stock}
                </td>
                <td className="px-3 py-3 text-center">
                  {p.is_active ? (
                    <span className="inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Hidden
                    </span>
                  )}
                  {p.featured ? (
                    <span className="ml-1 inline-flex rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-500">
                      Featured
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-right">
                  <Link
                    href={`/admin/products/${p.id}/edit`}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — swipe left on a card to reveal delete */}
      <ul className="flex flex-col gap-2 md:hidden">
        {products.map((p) => (
          <li key={p.id}>
            <SwipeableProductCard product={p} />
          </li>
        ))}
      </ul>
    </>
  );
}
