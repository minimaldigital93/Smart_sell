import Link from "next/link";
import { listActiveCategories } from "@/services/categories";
import { cn } from "@/lib/utils";

export async function CategoryPills({ activeSlug }: { activeSlug?: string }) {
  const categories = await listActiveCategories();
  return (
    <nav
      aria-label="Categories"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar"
    >
      <Link
        href="/shop"
        className={cn(
          "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
          !activeSlug
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-card text-foreground hover:bg-muted",
        )}
      >
        All
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/category/${c.slug}`}
          className={cn(
            "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
            activeSlug === c.slug
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
