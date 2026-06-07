import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/services/platform";
import { getPlans } from "@/services/subscriptions";
import { effectiveStoreStatus, storeStatusBadgeClass } from "@/lib/tenant/status";
import { formatPrice } from "@/lib/utils";
import { StoreActions } from "@/components/superadmin/store-actions";

export const dynamic = "force-dynamic";

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [store, plans] = await Promise.all([getStore(id), getPlans()]);
  if (!store) notFound();

  const status = effectiveStoreStatus(store);

  const facts: [string, string][] = [
    ["Slug", `/${store.slug}`],
    ["Custom domain", store.custom_domain ?? "—"],
    ["Owner", store.owner?.name ?? "—"],
    ["Owner phone", store.owner?.phone ?? "—"],
    ["Plan", store.plan ? `${store.plan.name} · ${formatPrice(store.plan.price_usd)}` : "—"],
    [
      "Trial ends",
      store.trial_ends_at
        ? new Date(store.trial_ends_at).toLocaleString()
        : "—",
    ],
    [
      "Period ends",
      store.current_period_end
        ? new Date(store.current_period_end).toLocaleString()
        : "—",
    ],
    ["Created", new Date(store.created_at).toLocaleDateString()],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/superadmin/stores" className="text-muted-foreground text-sm">
          ← Stores
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{store.name}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${storeStatusBadgeClass(status)}`}
          >
            {status}
          </span>
        </div>
      </div>

      <div className="bg-card rounded-2xl border p-5">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-muted-foreground text-xs uppercase tracking-wider">
                {label}
              </dt>
              <dd className="text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="bg-card rounded-2xl border p-5">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Manage</h2>
        <StoreActions
          storeId={store.id}
          currentPlanId={store.plan_id}
          plans={plans.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
        />
      </div>
    </div>
  );
}
