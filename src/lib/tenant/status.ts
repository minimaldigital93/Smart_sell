import { GRACE_DAYS, type StoreStatus } from "@/lib/constants";

const DAY_MS = 86_400_000;

/**
 * Mirror of the SQL store_access_status() function so the UI can label a store's
 * effective state without an extra round-trip. Order: explicit cancelled/locked,
 * then active paid period, then trial, then a grace window, else locked.
 */
export function effectiveStoreStatus(store: {
  status: StoreStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
}): StoreStatus {
  if (store.status === "cancelled" || store.status === "locked") {
    return store.status;
  }
  const now = Date.now();
  const periodEnd = store.current_period_end
    ? Date.parse(store.current_period_end)
    : 0;
  const trialEnd = store.trial_ends_at ? Date.parse(store.trial_ends_at) : 0;

  if (periodEnd && now < periodEnd) return "active";
  if (trialEnd && now < trialEnd) return "trial";
  if (now < Math.max(periodEnd, trialEnd) + GRACE_DAYS * DAY_MS) return "grace";
  return "locked";
}

const STATUS_TONE: Record<StoreStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  trial: "bg-sky-100 text-sky-700",
  grace: "bg-amber-100 text-amber-700",
  locked: "bg-rose-100 text-rose-700",
  cancelled: "bg-muted text-muted-foreground",
};

export function storeStatusBadgeClass(status: StoreStatus): string {
  return STATUS_TONE[status];
}
