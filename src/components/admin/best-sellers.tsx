import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { getStoreSettings } from "@/services/settings";
import { EmptyState } from "@/components/shop/empty-state";
import type { BestSeller } from "@/services/admin";

export async function BestSellersList({ products }: { products: BestSeller[] }) {
  const { currency } = await getStoreSettings();
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Best sellers
      </h2>

      {products.length === 0 ? (
        <EmptyState
          title="No sales yet"
          description="Confirmed orders will rank products here."
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {products.map((p, i) => (
            <li key={p.product_id} className="flex items-center gap-3">
              <span className="w-5 text-center text-xs font-semibold text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                {p.images[0] ? (
                  <Image
                    src={p.images[0]}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/${p.slug}`}
                  className="line-clamp-1 text-sm font-medium hover:underline"
                >
                  {p.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {p.total_sold} sold · {formatPrice(p.total_revenue, currency)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
