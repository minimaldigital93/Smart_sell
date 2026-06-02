import { notFound } from "next/navigation";
import { getCoupon } from "@/services/coupons";
import { CouponForm } from "@/components/admin/coupons/coupon-form";

export const metadata = { title: "Edit coupon" };

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coupon = await getCoupon(id);
  if (!coupon) notFound();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit coupon
        </h1>
        <p className="font-mono text-sm text-muted-foreground">{coupon.code}</p>
      </header>
      <CouponForm coupon={coupon} />
    </div>
  );
}
