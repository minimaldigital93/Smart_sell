import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getCurrentProfile } from "@/lib/auth/session";
import { getStoreContext } from "@/lib/tenant/context";
import { isDemoMode } from "@/lib/khqrpay/config";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const [session, store] = await Promise.all([
    getCurrentProfile(),
    getStoreContext(),
  ]);

  // KHQR is offered when the store has a khqr.cc merchant profile (anon-safe
  // boolean probe — never the credentials) or the platform runs in demo mode.
  let khqrAvailable = isDemoMode();
  if (!khqrAvailable && store?.storeId) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("store_khqr_configured", {
      p_store: store.storeId,
    });
    khqrAvailable = Boolean(data);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {khqrAvailable
            ? "Pay instantly with KHQR, or choose cash on delivery."
            : "Pay in cash when your order arrives."}
        </p>
      </header>
      <CheckoutForm
        defaultName={session?.profile.name}
        defaultPhone={session?.profile.phone}
        isAuthenticated={Boolean(session?.profile.id)}
        khqrAvailable={khqrAvailable}
      />
    </div>
  );
}
