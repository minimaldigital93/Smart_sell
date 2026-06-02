import { Boxes, AlertCircle, Layers, ShoppingBag } from "lucide-react";
import { KpiCard } from "@/components/admin/kpi-card";
import type { InventoryStats } from "@/services/inventory";

export function InventoryStatsRow({ stats }: { stats: InventoryStats }) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiCard
        label="Active products"
        value={String(stats.active_products)}
        icon={<ShoppingBag className="h-4 w-4" />}
      />
      <KpiCard
        label="Total units"
        value={stats.total_units.toLocaleString("en-US")}
        icon={<Layers className="h-4 w-4" />}
      />
      <KpiCard
        label="Low stock"
        value={String(stats.low_stock_count)}
        tone={stats.low_stock_count > 0 ? "warning" : "default"}
        icon={<Boxes className="h-4 w-4" />}
      />
      <KpiCard
        label="Out of stock"
        value={String(stats.out_of_stock_count)}
        tone={stats.out_of_stock_count > 0 ? "destructive" : "default"}
        icon={<AlertCircle className="h-4 w-4" />}
      />
    </section>
  );
}
