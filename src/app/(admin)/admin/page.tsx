import { Clock, ShoppingCart, DollarSign, Boxes } from "lucide-react";
import {
  getDashboardSummary,
  getLowStock,
  getSalesByDay,
} from "@/services/admin";
import { formatPrice } from "@/lib/utils";
import { getStoreSettings } from "@/services/settings";
import { KpiCard } from "@/components/admin/kpi-card";
import { SalesChart } from "@/components/admin/sales-chart";
import { LowStockList } from "@/components/admin/low-stock";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [summary, salesByDay, lowStock, { currency }] = await Promise.all([
    getDashboardSummary(),
    getSalesByDay(14),
    getLowStock(5),
    getStoreSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live snapshot of your store.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Revenue"
          value={formatPrice(summary.total_revenue, currency)}
          hint={`${summary.total_orders} total orders`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KpiCard
          label="Pending"
          value={String(summary.pending_orders)}
          hint="awaiting confirmation"
          tone={summary.pending_orders > 0 ? "warning" : "default"}
          icon={<Clock className="h-4 w-4" />}
        />
        <KpiCard
          label="Active"
          value={String(summary.active_orders)}
          hint="confirmed → shipping"
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <KpiCard
          label="Low stock"
          value={String(summary.low_stock_count)}
          hint={
            summary.out_of_stock_count > 0
              ? `${summary.out_of_stock_count} out of stock`
              : `${summary.active_products} active products`
          }
          tone={
            summary.out_of_stock_count > 0
              ? "destructive"
              : summary.low_stock_count > 0
                ? "warning"
                : "default"
          }
          icon={<Boxes className="h-4 w-4" />}
        />
      </section>

      <SalesChart data={salesByDay} />

      <LowStockList rows={lowStock} />
    </div>
  );
}
