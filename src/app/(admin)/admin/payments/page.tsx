import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { listOrderPaymentsForAdmin } from "@/services/payments";
import { getStoreSettings } from "@/services/settings";
import { PaymentsTable } from "@/components/admin/payments/payments-table";
import { cn } from "@/lib/utils";
import type { OrderPaymentStatusEnum } from "@/types/database";

export const metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; method?: string }>;

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "paid", label: "Paid" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const METHOD_FILTERS = [
  { value: "all", label: "All methods" },
  { value: "khqr", label: "KHQR" },
  { value: "cash", label: "Cash" },
] as const;

export default async function AdminPaymentsPage(props: {
  searchParams: SearchParams;
}) {
  await requireStaff();
  const sp = await props.searchParams;
  const status = (STATUS_FILTERS.some((f) => f.value === sp.status)
    ? sp.status
    : "all") as OrderPaymentStatusEnum | "open" | "all";
  const method = (METHOD_FILTERS.some((f) => f.value === sp.method)
    ? sp.method
    : "all") as "khqr" | "cash" | "all";

  const [payments, settings] = await Promise.all([
    listOrderPaymentsForAdmin({ status, method }),
    getStoreSettings(),
  ]);

  const href = (s: string, m: string) =>
    `/admin/payments?status=${s}&method=${m}`;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order payments — KHQR settles automatically; cash is confirmed here
          or on the order.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href(f.value, method)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              status === f.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        {METHOD_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href(status, f.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              method === f.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <PaymentsTable payments={payments} currency={settings.currency} />
    </div>
  );
}
