import { DollarSign, TrendingDown, Wallet } from "lucide-react";
import {
  getPlatformSummary,
  getMonthlyPnl,
  getYearlyPnl,
  getExpenses,
} from "@/services/platform";
import { formatPrice } from "@/lib/utils";
import { KpiCard } from "@/components/admin/kpi-card";
import { PnlTable } from "@/components/superadmin/pnl-table";
import { ExpenseForm } from "@/components/superadmin/expense-form";
import { ExpenseDelete } from "@/components/superadmin/expense-delete";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const year = new Date().getFullYear();
  const [summary, monthly, yearly, expenses] = await Promise.all([
    getPlatformSummary(),
    getMonthlyPnl(year),
    getYearlyPnl(),
    getExpenses(),
  ]);

  const totalNet = summary.total_revenue - summary.total_expense;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Subscription revenue minus platform expenses.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard
          label="Total revenue"
          value={formatPrice(summary.total_revenue)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KpiCard
          label="Total expense"
          value={formatPrice(summary.total_expense)}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <KpiCard
          label="Net profit"
          value={formatPrice(totalNet)}
          tone={totalNet < 0 ? "destructive" : "default"}
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{year} by month</h2>
        <PnlTable rows={monthly} periodLabel="Month" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">By year</h2>
        {yearly.length === 0 ? (
          <p className="text-muted-foreground bg-card rounded-2xl border p-4 text-sm">
            No yearly data yet.
          </p>
        ) : (
          <PnlTable rows={yearly} periodLabel="Year" />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Expenses</h2>
        <ExpenseForm />
        <div className="bg-card overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Label</th>
                <th className="px-4 py-2 text-left font-medium">Category</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-4 py-6 text-center">
                    No expenses recorded.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="text-muted-foreground px-4 py-2 text-xs">
                      {new Date(e.incurred_on).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      {e.label}
                      {e.note ? (
                        <span className="text-muted-foreground ml-1 text-xs">
                          {e.note}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 capitalize">{e.category}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPrice(e.amount_usd)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <ExpenseDelete id={e.id} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
