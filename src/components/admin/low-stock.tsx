import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/shop/empty-state";
import type { LowStockRow } from "@/services/admin";

export function LowStockList({ rows }: { rows: LowStockRow[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Low stock
        </h2>
        <Link
          href="/admin/inventory"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Manage
        </Link>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="All stocked"
          description="No products are at or below minimum."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.product_id} className="flex items-center gap-3">
              <span
                aria-hidden
                className={
                  r.is_out_of_stock
                    ? "grid h-7 w-7 place-items-center rounded-full bg-destructive/10 text-destructive"
                    : "grid h-7 w-7 place-items-center rounded-full bg-amber-100 text-amber-600"
                }
              >
                <AlertCircle className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.is_out_of_stock
                    ? "Out of stock"
                    : `${r.current_stock} left · min ${r.minimum_stock}`}
                </p>
              </div>
              <span className="font-mono text-sm tabular-nums">
                {r.current_stock}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
