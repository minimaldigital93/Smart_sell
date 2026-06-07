import Link from "next/link";
import { getStores } from "@/services/platform";
import { effectiveStoreStatus, storeStatusBadgeClass } from "@/lib/tenant/status";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const stores = await getStores();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Stores</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {stores.length} registered {stores.length === 1 ? "store" : "stores"}.
        </p>
      </header>

      <div className="bg-card overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Store</th>
              <th className="px-4 py-2 text-left font-medium">Owner</th>
              <th className="px-4 py-2 text-left font-medium">Plan</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Renews</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {stores.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-4 py-6 text-center">
                  No stores yet.
                </td>
              </tr>
            ) : (
              stores.map((s) => {
                const status = effectiveStoreStatus(s);
                return (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Link
                        href={`/superadmin/stores/${s.id}`}
                        className="font-medium hover:underline"
                      >
                        {s.name}
                      </Link>
                      <span className="text-muted-foreground ml-1 text-xs">
                        /{s.slug}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {s.owner?.name ?? "—"}
                      {s.owner?.phone ? (
                        <span className="text-muted-foreground ml-1 text-xs">
                          {s.owner.phone}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      {s.plan ? (
                        <>
                          {s.plan.name}
                          <span className="text-muted-foreground ml-1 text-xs">
                            {formatPrice(s.plan.price_usd)}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${storeStatusBadgeClass(status)}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-2 text-xs">
                      {s.current_period_end
                        ? new Date(s.current_period_end).toLocaleDateString()
                        : s.trial_ends_at
                          ? `Trial ${new Date(s.trial_ends_at).toLocaleDateString()}`
                          : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
