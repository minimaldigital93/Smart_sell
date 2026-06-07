import { Check } from "lucide-react";
import { getPlans } from "@/services/subscriptions";
import { parsePlanFeatures, parsePlanLimits } from "@/lib/billing/plans";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const plans = await getPlans();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The subscription tiers stores can buy. Edit pricing/limits in the
          subscription_plans table.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => {
          const features = parsePlanFeatures(plan.features);
          const limits = parsePlanLimits(plan.limits);
          return (
            <div
              key={plan.id}
              className="bg-card flex flex-col gap-4 rounded-2xl border p-5"
            >
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  {plan.name}
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  {formatPrice(plan.price_usd)}
                  <span className="text-muted-foreground text-sm font-normal">
                    /{plan.interval}
                  </span>
                </p>
              </div>
              <ul className="flex flex-col gap-1.5 text-sm">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="text-muted-foreground mt-auto border-t pt-3 text-xs">
                <p>
                  Products:{" "}
                  {limits.max_products < 0 ? "Unlimited" : limits.max_products}
                </p>
                <p>Staff: {limits.max_staff < 0 ? "Unlimited" : limits.max_staff}</p>
                <p>
                  {[
                    limits.coupons && "Coupons",
                    limits.loyalty && "Loyalty",
                    limits.pos && "POS",
                    limits.custom_domain && "Custom domain",
                    limits.advanced_analytics && "Analytics",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Core features"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
