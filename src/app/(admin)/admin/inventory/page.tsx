import Link from "next/link";
import {
  getInventoryStats,
  listMovements,
  listInventory,
} from "@/services/inventory";
import { InventoryStatsRow } from "@/components/admin/inventory/inventory-stats";
import { MovementsTable } from "@/components/admin/inventory/movements-table";
import { QuickMovementForm } from "@/components/admin/inventory/quick-movement-form";
import { InventoryRealtimeRefresher } from "@/components/admin/inventory/inventory-realtime-refresher";
import { EmptyState } from "@/components/shop/empty-state";
import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InventoryOverviewPage() {
  const [stats, recentMovements, lowRows] = await Promise.all([
    getInventoryStats(),
    listMovements({ limit: 8 }),
    listInventory({ lowOnly: true, limit: 5 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <InventoryRealtimeRefresher />

      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stock levels update live.
          </p>
        </div>
        <Link
          href="/admin/inventory/movements"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Full log →
        </Link>
      </header>

      <InventoryStatsRow stats={stats} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft lg:col-span-2">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent movements
            </h2>
            <Link
              href="/admin/inventory/movements"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              View all
            </Link>
          </header>
          <MovementsTable rows={recentMovements} />
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Add movement
          </h2>
          <QuickMovementForm />
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Low stock alerts
          </h2>
        </header>
        {lowRows.length === 0 ? (
          <EmptyState
            title="Everything is stocked"
            description="No products are at or below their minimum threshold."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {lowRows.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <span
                  className={
                    r.current_stock === 0
                      ? "grid h-7 w-7 place-items-center rounded-full bg-destructive/10 text-destructive"
                      : "grid h-7 w-7 place-items-center rounded-full bg-amber-100 text-amber-600"
                  }
                >
                  <AlertCircle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/inventory/products/${r.product_id}`}
                    className="line-clamp-1 text-sm font-medium hover:underline"
                  >
                    {r.product?.name ?? "Unknown"}
                  </Link>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    on hand {r.current_stock} · min {r.minimum_stock}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
