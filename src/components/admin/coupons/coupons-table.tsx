import Link from "next/link";
import { Pencil } from "lucide-react";
import type { CouponRow } from "@/services/coupons";
import { EmptyState } from "@/components/shop/empty-state";
import { DeleteCouponButton } from "./delete-coupon-button";

function formatDiscount(c: CouponRow): string {
  return c.discount_type === "percent"
    ? `${c.discount_value}%`
    : `$${Number(c.discount_value).toFixed(2)}`;
}

function formatWindow(c: CouponRow): string {
  const start = c.starts_at ? new Date(c.starts_at).toLocaleDateString("en-US") : "—";
  const end = c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-US") : "—";
  return `${start} → ${end}`;
}

function statusPill(c: CouponRow) {
  const now = Date.now();
  const inactive =
    !c.is_active ||
    (c.starts_at && new Date(c.starts_at).getTime() > now) ||
    (c.expires_at && new Date(c.expires_at).getTime() <= now) ||
    (c.max_redemptions !== null && c.redeemed_count >= c.max_redemptions);
  if (inactive) {
    return (
      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        Inactive
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
      Active
    </span>
  );
}

export function CouponsTable({ coupons }: { coupons: CouponRow[] }) {
  if (coupons.length === 0) {
    return (
      <EmptyState
        title="No coupons"
        description="Create your first discount code."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-3">Code</th>
            <th className="px-3 py-3">Discount</th>
            <th className="px-3 py-3">Min</th>
            <th className="px-3 py-3">Used</th>
            <th className="px-3 py-3">Window</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {coupons.map((c) => (
            <tr key={c.id} className="hover:bg-muted/40">
              <td className="px-3 py-3 font-mono font-medium">{c.code}</td>
              <td className="px-3 py-3">{formatDiscount(c)}</td>
              <td className="px-3 py-3">${Number(c.min_subtotal).toFixed(2)}</td>
              <td className="px-3 py-3">
                {c.redeemed_count}
                {c.max_redemptions !== null ? ` / ${c.max_redemptions}` : ""}
              </td>
              <td className="px-3 py-3 text-xs text-muted-foreground">
                {formatWindow(c)}
              </td>
              <td className="px-3 py-3">{statusPill(c)}</td>
              <td className="px-3 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/admin/coupons/${c.id}/edit`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
                    aria-label={`Edit ${c.code}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <DeleteCouponButton id={c.id} code={c.code} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
