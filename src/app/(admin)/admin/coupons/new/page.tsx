import { CouponForm } from "@/components/admin/coupons/coupon-form";

export const metadata = { title: "New coupon" };

export default function NewCouponPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New coupon</h1>
      </header>
      <CouponForm />
    </div>
  );
}
