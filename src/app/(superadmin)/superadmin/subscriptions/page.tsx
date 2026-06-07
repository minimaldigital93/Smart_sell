import { getPayments } from "@/services/platform";
import { formatPrice } from "@/lib/utils";
import { PaymentActions } from "@/components/superadmin/payment-actions";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-rose-100 text-rose-700",
  expired: "bg-muted text-muted-foreground",
};

export default async function SubscriptionsPage() {
  const payments = await getPayments();
  const pending = payments.filter((p) => p.status === "pending");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {pending.length} pending · {payments.length} total payments.
        </p>
      </header>

      <div className="bg-card overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Date</th>
              <th className="px-4 py-2 text-left font-medium">Store</th>
              <th className="px-4 py-2 text-left font-medium">Plan</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 text-left font-medium">Method</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-4 py-6 text-center">
                  No payments yet.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="text-muted-foreground px-4 py-2 text-xs">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">{p.store?.name ?? "—"}</td>
                  <td className="px-4 py-2">{p.plan?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatPrice(p.amount_usd)}
                  </td>
                  <td className="px-4 py-2 capitalize">{p.method}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_TONE[p.status] ?? ""}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {p.status === "pending" ? (
                      <PaymentActions paymentId={p.id} />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
