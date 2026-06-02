import type { Order, OrderItem } from "@/types";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { STATUS_LABEL } from "@/lib/orders/transitions";
import { PAYMENT_INSTRUCTIONS } from "@/lib/checkout/payment-instructions";
import { formatPrice } from "@/lib/utils";
import { ClientDate } from "@/components/shared/client-date";

export function InvoiceView({
  order,
  items,
}: {
  order: Order;
  items: OrderItem[];
}) {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-8 bg-white p-8 text-[13px] leading-relaxed text-black print:p-0">
      <header className="flex items-start justify-between gap-6 border-b border-black/10 pb-6">
        <div>
          <p className="text-xl font-semibold tracking-tight">{APP_NAME}</p>
          <p className="text-xs text-black/60">{APP_TAGLINE}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-black/50">
            Invoice
          </p>
          <p className="font-mono text-sm">{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-xs text-black/60">
            <ClientDate date={order.created_at} format="MMM d, yyyy · HH:mm" />
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-black/50">Billed to</p>
          <p className="mt-1 font-medium">{order.customer_name}</p>
          <p>{order.phone}</p>
          <p className="mt-1 whitespace-pre-line">{order.address}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-black/50">Status</p>
          <p className="mt-1 font-medium">{STATUS_LABEL[order.status]}</p>
          <p className="mt-3 text-xs uppercase tracking-wider text-black/50">
            Payment
          </p>
          <p>{PAYMENT_INSTRUCTIONS[order.payment_method].label}</p>
        </div>
      </section>

      <section>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black/15 text-left text-xs uppercase tracking-wider text-black/60">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-black/5">
                <td className="py-2.5">{i.product_name}</td>
                <td className="py-2.5 text-right tabular-nums">{i.quantity}</td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatPrice(i.price)}
                </td>
                <td className="py-2.5 text-right font-medium tabular-nums">
                  {formatPrice(i.price * i.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ml-auto flex w-full max-w-xs flex-col gap-2 text-sm">
        <Row label="Subtotal" value={formatPrice(order.subtotal)} />
        <Row label="Shipping" value={formatPrice(order.shipping_fee)} />
        <div className="mt-1 flex items-baseline justify-between border-t border-black/15 pt-2">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-base font-semibold tabular-nums">
            {formatPrice(order.total)}
          </span>
        </div>
      </section>

      {order.note ? (
        <section>
          <p className="text-xs uppercase tracking-wider text-black/50">Note</p>
          <p className="mt-1">{order.note}</p>
        </section>
      ) : null}

      <footer className="mt-4 border-t border-black/10 pt-4 text-center text-xs text-black/50">
        Thank you for shopping with {APP_NAME}.
      </footer>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-black/60">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
