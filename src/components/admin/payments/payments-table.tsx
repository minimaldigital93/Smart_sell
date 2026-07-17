import Link from "next/link";
import { PaymentStatusBadge } from "@/components/admin/payments/payment-status-badge";
import { PaymentRowActions } from "@/components/admin/payments/payment-row-actions";
import { ClientDate } from "@/components/shared/client-date";
import { formatPrice } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import type { AdminPaymentRow } from "@/services/payments";

export function PaymentsTable({
  payments,
  currency,
}: {
  payments: AdminPaymentRow[];
  currency: string;
}) {
  if (payments.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No payments yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Order</th>
            <th className="px-4 py-2 text-left font-medium">Method</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="px-4 py-2 text-right font-medium">Amount</th>
            <th className="px-4 py-2 text-left font-medium">Paid</th>
            <th className="px-4 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2.5">
                <Link
                  href={`/admin/orders/${p.order_id}`}
                  className="font-mono text-xs hover:underline"
                >
                  {p.order_id.slice(0, 8)}
                </Link>
                {p.order ? (
                  <p className="text-xs text-muted-foreground">
                    {p.order.customer_name}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-2.5">{PAYMENT_METHOD_LABEL[p.method]}</td>
              <td className="px-4 py-2.5">
                <PaymentStatusBadge status={p.status} />
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {formatPrice(p.amount, currency)}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                {p.paid_at ? (
                  <>
                    <ClientDate date={p.paid_at} format="MMM d · HH:mm" />
                    {p.cashier?.name ? <> · {p.cashier.name}</> : null}
                  </>
                ) : (
                  <ClientDate date={p.created_at} format="MMM d · HH:mm" />
                )}
              </td>
              <td className="px-4 py-2.5 text-right">
                <PaymentRowActions
                  paymentId={p.id}
                  method={p.method}
                  status={p.status}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
