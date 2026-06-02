import type { Product } from "@/types";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/shop/empty-state";

export function ProductGrid({
  products,
  emptyTitle = "No products yet",
  emptyDescription,
}: {
  products: Product[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (products.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
