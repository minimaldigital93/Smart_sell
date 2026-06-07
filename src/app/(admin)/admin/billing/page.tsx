import { requireAdmin } from "@/lib/auth/session";
import { getMyStore } from "@/services/stores";
import { getPlans, getMyPayments } from "@/services/subscriptions";
import { parsePlanFeatures } from "@/lib/billing/plans";
import { effectiveStoreStatus, storeStatusBadgeClass } from "@/lib/tenant/status";
import { formatPrice } from "@/lib/utils";
import { BillingClient } from "@/components/billing/billing-client";

export const dynamic = "force-dynamic";

const STATUS_BLURB: Record<string, string> = {
  trial: "You're on a free trial. Subscribe to keep your store live after it ends.",
  active: "Your subscription is active.",
  grace: "Your subscription has lapsed. Renew now to avoid your store being hidden.",
  locked: "Your store is paused. Renew to bring it back online.",
  cancelled: "Your subscription was cancelled. Choose a plan to reactivate.",
};

export default async function BillingPage() {
  await requireAdmin();
  const [store, plans, payments] = await Promise.all([
    getMyStore(),
    getPlans(),
    getMyPayments(),
  ]);

  const status = store ? effectiveStoreStatus(store) : "locked";
  const currentPlan =
    store?.plan_id != null
      ? (plans.find((p) => p.id === store.plan_id) ?? null)
      : null;
  // A store that has never had a paid period yet is brand-new, not "lapsed".
  const neverActivated = !store?.current_period_end;
  const blurb =
    status === "locked" && neverActivated
      ? "Choose your plan below and complete payment to launch your store."
      : STATUS_BLURB[status];
  const renews = store?.current_period_end
    ? new Date(store.current_period_end).toLocaleDateString()
    : store?.trial_ends_at
      ? new Date(store.trial_ends_at).toLocaleDateString()
      : null;

  const billingPlans = plans.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    price_usd: Number(p.price_usd),
    features: parsePlanFeatures(p.features),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your store&rsquo;s subscription.
        </p>
      </header>

      <div className="bg-card rounded-2xl border p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${storeStatusBadgeClass(status)}`}
              >
                {status}
              </span>
              {currentPlan ? (
                <span className="text-muted-foreground text-xs">
                  Plan:{" "}
                  <span className="text-foreground font-medium">
                    {currentPlan.name}
                  </span>
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm">{blurb}</p>
          </div>
          {renews ? (
            <div className="text-right">
              <p className="text-muted-foreground text-xs uppercase tracking-wider">
                {status === "trial" ? "Trial ends" : "Renews"}
              </p>
              <p className="text-sm font-medium">{renews}</p>
            </div>
          ) : null}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {status === "active" ? "Renew or change plan" : "Choose a plan"}
        </h2>
        <BillingClient plans={billingPlans} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Payment history</h2>
        <div className="bg-card overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-left font-medium">Method</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center">
                    No payments yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-muted-foreground px-4 py-2 text-xs">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPrice(p.amount_usd)}
                    </td>
                    <td className="px-4 py-2 capitalize">{p.method}</td>
                    <td className="px-4 py-2 capitalize">{p.status}</td>
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
