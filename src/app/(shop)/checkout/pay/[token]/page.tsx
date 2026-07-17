import { notFound } from "next/navigation";
import { getPaymentByToken } from "@/services/payments";
import { KhqrPayPanel } from "@/components/checkout/khqr-pay-panel";
import { ClearCartOnMount } from "@/components/cart/clear-cart-on-mount";
import type { OrderPaymentStatusEnum } from "@/types/database";

export const metadata = { title: "Pay your order" };
export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;

/**
 * Customer payment page for a KHQR order payment. Reached right after
 * checkout and again when khqr.cc redirects the browser back (success_url).
 * Auth = the payment's unguessable token (guests included).
 */
export default async function PayOrderPage({ params }: { params: Params }) {
  const { token } = await params;
  if (!/^[a-f0-9]{16,64}$/i.test(token)) notFound();

  const payment = await getPaymentByToken(token);
  if (!payment || payment.method !== "khqr") notFound();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 pt-2">
      {/* The order exists — the cart's job is done even before payment. */}
      <ClearCartOnMount />

      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Complete your payment
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order <span className="font-mono">{payment.order_id.slice(0, 8)}</span>
        </p>
      </header>

      <KhqrPayPanel
        token={payment.public_token}
        orderId={payment.order_id}
        amount={Number(payment.amount)}
        initialStatus={payment.status as OrderPaymentStatusEnum}
        expiresAt={payment.expires_at}
        checkoutUrl={payment.checkout_url}
        qrPayload={payment.qr_payload}
      />

      <p className="text-center text-xs text-muted-foreground">
        Payment is verified automatically — this page updates the moment your
        bank confirms.
      </p>
    </div>
  );
}
