import Link from "next/link";
import { Plus } from "lucide-react";
import { listProductsForAdmin } from "@/services/products-admin";
import { ProductsToolbar } from "@/components/admin/products-toolbar";
import { ProductsTable } from "@/components/admin/products-table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProductCategoryEnum } from "@/types/database";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; category?: ProductCategoryEnum }>;

export default async function AdminProductsPage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const products = await listProductsForAdmin({
    q: sp.q,
    category: sp.category,
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? "product" : "products"}
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className={cn(buttonVariants({ size: "md" }))}
        >
          <Plus className="h-4 w-4" />
          New
        </Link>
      </header>

      <ProductsToolbar />
      <ProductsTable products={products} />
    </div>
  );
}
