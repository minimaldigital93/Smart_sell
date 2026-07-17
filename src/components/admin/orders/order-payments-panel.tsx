import { PaymentStatusBadge } from "@/components/admin/payments/payment-status-badge";
import { PaymentRowActions } from "@/components/admin/payments/payment-row-actions";
import { ClientDate } from "@/components/shared/client-date";
import { formatPrice } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import type { AdminPaymentRow } from "@/services/payments";

/** Payment attempts for one order — settle cash, recheck open KHQR. */
export function OrderPaymentsPanel({
  payments,
  currency,
}: {
  payments: AdminPaymentRow[];
  currency: string;
}) {
  if (payments.length === 0) return null;

  return (
    <ul className="flex flex-col divide-y divide-border">
      {payments.map((p) => (
        <li
          key={p.id}
          className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {PAYMENT_METHOD_LABEL[p.method]}
              </span>
              <PaymentStatusBadge status={p.status} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatPrice(p.amount, currency)}
              {p.paid_at ? (
                <>
                  {" "}
                  · paid <ClientDate date={p.paid_at} format="MMM d · HH:mm" />
                  {p.cashier?.name ? <> by {p.cashier.name}</> : null}
                </>
              ) : (
                <>
                  {" "}
                  · created{" "}
                  <ClientDate date={p.created_at} format="MMM d · HH:mm" />
                </>
              )}
            </p>
          </div>
          <PaymentRowActions
            paymentId={p.id}
            method={p.method}
            status={p.status}
          />
        </li>
      ))}
    </ul>
  );
}
