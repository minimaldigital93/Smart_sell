import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getCurrentProfile } from "@/lib/auth/session";
import { getLoyaltyBalance } from "@/services/loyalty";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const session = await getCurrentProfile();
  const loyaltyPoints = session?.profile.id
    ? await getLoyaltyBalance(session.profile.id)
    : 0;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay, upload your receipt, and we’ll confirm by phone.
        </p>
      </header>
      <CheckoutForm
        defaultName={session?.profile.name}
        defaultPhone={session?.profile.phone}
        loyaltyPoints={loyaltyPoints}
      />
    </div>
  );
}
