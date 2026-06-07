"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setStoreStatus,
  extendStorePeriod,
  changeStorePlan,
} from "@/app/actions/superadmin";

type Plan = { id: string; name: string; code: string };

export function StoreActions({
  storeId,
  currentPlanId,
  plans,
}: {
  storeId: string;
  currentPlanId: string | null;
  plans: Plan[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState(currentPlanId ?? "");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Action failed");
      else router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => extendStorePeriod(storeId, 30))}
          className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Reactivate +30 days
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setStoreStatus(storeId, "locked"))}
          className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Lock
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setStoreStatus(storeId, "cancelled"))}
          className="text-destructive rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="border-input bg-background rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">— Select plan —</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !planId || planId === currentPlanId}
          onClick={() => run(() => changeStorePlan(storeId, planId))}
          className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Change plan
        </button>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
