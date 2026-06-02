import Link from "next/link";
import { Plus } from "lucide-react";
import { listCoupons } from "@/services/coupons";
import { CouponsTable } from "@/components/admin/coupons/coupons-table";

export const metadata = { title: "Coupons" };

export default async function CouponsPage() {
  const coupons = await listCoupons();
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coupons</h1>
          <p className="text-sm text-muted-foreground">
            Discount codes apply at checkout.
          </p>
        </div>
        <Link
          href="/admin/coupons/new"
          className="bg-primary text-primary-foreground inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium shadow-sm"
        >
          <Plus className="h-4 w-4" /> New
        </Link>
      </header>
      <CouponsTable coupons={coupons} />
    </div>
  );
}
