import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function CategoryPills({ activeSlug }: { activeSlug?: string }) {
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
      {CATEGORIES.map((c) => (
        <Link
          key={c.slug}
          href={`/category/${c.slug}`}
          className={cn(
            "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
            activeSlug === c.slug
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          {c.label}
        </Link>
      ))}
    </nav>
  );
}
