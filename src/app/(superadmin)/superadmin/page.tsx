import Link from "next/link";
import { DollarSign, Store, Clock, AlertTriangle } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import {
  getPlatformSummary,
  getStores,
  getMonthlyPnl,
} from "@/services/platform";
import { effectiveStoreStatus, storeStatusBadgeClass } from "@/lib/tenant/status";
import { KpiCard } from "@/components/admin/kpi-card";
import { PnlTable } from "@/components/superadmin/pnl-table";

export const dynamic = "force-dynamic";

export default async function SuperadminOverviewPage() {
  const year = new Date().getFullYear();
  const [summary, stores, pnl] = await Promise.all([
    getPlatformSummary(),
    getStores(),
    getMonthlyPnl(year),
  ]);

  const monthNet = summary.month_revenue - summary.month_expense;
  const recent = stores.slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Platform revenue, stores and subscriptions.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="MRR"
          value={formatPrice(summary.mrr)}
          hint="Active subscriptions"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KpiCard
          label="Active stores"
          value={String(summary.active_stores)}
          hint={`${summary.trial_stores} on trial`}
          icon={<Store className="h-4 w-4" />}
        />
        <KpiCard
          label="Overdue"
          value={String(summary.overdue_stores)}
          tone={summary.overdue_stores > 0 ? "warning" : "default"}
          hint="Grace or locked"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <KpiCard
          label="This month net"
          value={formatPrice(monthNet)}
          tone={monthNet < 0 ? "destructive" : "default"}
          hint={`${formatPrice(summary.month_revenue)} in · ${formatPrice(summary.month_expense)} out`}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            {year} monthly P&amp;L
          </h2>
          <Link
            href="/superadmin/finance"
            className="text-primary text-sm font-medium"
          >
            Manage finance →
          </Link>
        </div>
        <PnlTable rows={pnl} periodLabel="Month" />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Recent stores</h2>
          <Link
            href="/superadmin/stores"
            className="text-primary text-sm font-medium"
          >
            All stores →
          </Link>
        </div>
        <div className="bg-card overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Store</th>
                <th className="px-4 py-2 text-left font-medium">Plan</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recent.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="text-muted-foreground px-4 py-6 text-center"
                  >
                    No stores yet.
                  </td>
                </tr>
              ) : (
                recent.map((s) => {
                  const status = effectiveStoreStatus(s);
                  return (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <Link
                          href={`/superadmin/stores/${s.id}`}
                          className="font-medium hover:underline"
                        >
                          {s.name}
                        </Link>
                        <span className="text-muted-foreground ml-1 text-xs">
                          /{s.slug}
                        </span>
                      </td>
                      <td className="px-4 py-2">{s.plan?.name ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${storeStatusBadgeClass(status)}`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
