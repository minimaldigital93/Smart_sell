import { formatPrice } from "@/lib/utils";
import type { PnlRow } from "@/services/platform";

export function PnlTable({
  rows,
  periodLabel,
}: {
  rows: PnlRow[];
  periodLabel: string;
}) {
  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      expense: acc.expense + r.expense,
      net: acc.net + r.net,
    }),
    { revenue: 0, expense: 0, net: 0 },
  );

  return (
    <div className="bg-card overflow-hidden rounded-2xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
          <tr>
            <th className="px-4 py-2 text-left font-medium">{periodLabel}</th>
            <th className="px-4 py-2 text-right font-medium">Revenue</th>
            <th className="px-4 py-2 text-right font-medium">Expense</th>
            <th className="px-4 py-2 text-right font-medium">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.period}>
              <td className="px-4 py-2">{r.period}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatPrice(r.revenue)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatPrice(r.expense)}
              </td>
              <td
                className={`px-4 py-2 text-right tabular-nums font-medium ${
                  r.net < 0 ? "text-destructive" : "text-emerald-600"
                }`}
              >
                {formatPrice(r.net)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/40 font-semibold">
          <tr>
            <td className="px-4 py-2">Total</td>
            <td className="px-4 py-2 text-right tabular-nums">
              {formatPrice(totals.revenue)}
            </td>
            <td className="px-4 py-2 text-right tabular-nums">
              {formatPrice(totals.expense)}
            </td>
            <td
              className={`px-4 py-2 text-right tabular-nums ${
                totals.net < 0 ? "text-destructive" : "text-emerald-600"
              }`}
            >
              {formatPrice(totals.net)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
