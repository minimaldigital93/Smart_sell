import { SearchBar } from "@/components/shop/search-bar";
import { ProductGrid } from "@/components/shop/product-grid";
import { searchProducts } from "@/services/products";

export const metadata = { title: "Search" };

type SearchParams = Promise<{ q?: string }>;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const products = q ? await searchProducts(q, 48) : [];

  return (
    <div className="flex flex-col gap-5 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
      </header>
      <SearchBar initialQuery={q} />
      {q ? (
        <p className="text-xs text-muted-foreground">
          {products.length} {products.length === 1 ? "result" : "results"} for “
          {q}”
        </p>
      ) : null}
      {q ? (
        <ProductGrid
          products={products}
          emptyTitle="Nothing matches"
          emptyDescription="Try a broader term or browse a category."
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Type at least one character to search.
        </p>
      )}
    </div>
  );
}
