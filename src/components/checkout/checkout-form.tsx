"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { submitOrderAction } from "@/app/actions/orders";
import { useCartStore } from "@/store/cart-store";
import {
  checkoutCustomerSchema,
  checkoutAccountSchema,
  type CheckoutCustomerValues,
} from "@/lib/checkout/schemas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { PaymentMethodPicker } from "@/components/checkout/payment-method-picker";
import { OrderSummary } from "@/components/checkout/order-summary";
import { CartSummary } from "@/components/cart/cart-summary";
import { CouponField, type AppliedCoupon } from "@/components/checkout/coupon-field";
import { useFormatPrice } from "@/lib/settings/store-config";

type CheckoutFormValues = CheckoutCustomerValues & { password?: string };

export function CheckoutForm({
  defaultName,
  defaultPhone,
  isAuthenticated = false,
  khqrAvailable = false,
}: {
  defaultName?: string | null;
  defaultPhone?: string | null;
  isAuthenticated?: boolean;
  /** Whether this store can take dynamic KHQR payments. */
  khqrAvailable?: boolean;
}) {
  "use no memo";
  const router = useRouter();
  const formatPrice = useFormatPrice();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const [submitting, setSubmitting] = useState(false);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(
      isAuthenticated ? checkoutCustomerSchema : checkoutAccountSchema,
    ) as Resolver<CheckoutFormValues>,
    defaultValues: {
      customer_name: defaultName ?? "",
      phone: defaultPhone ?? "",
      address: "",
      note: "",
      payment_method: khqrAvailable ? "khqr" : "cash",
      password: "",
    },
  });

  async function onSubmit(values: CheckoutFormValues) {
    if (items.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.append("customer_name", values.customer_name);
    fd.append("phone", values.phone);
    fd.append("address", values.address);
    if (values.note) fd.append("note", values.note);
    fd.append("payment_method", values.payment_method);
    fd.append(
      "items",
      JSON.stringify(
        items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      ),
    );
    if (!isAuthenticated && values.password) {
      fd.append("password", values.password);
    }
    if (coupon) fd.append("coupon_code", coupon.code);

    const result = await submitOrderAction(fd);
    if (!result.ok) {
      setSubmitting(false);
      toast.error(result.error);
      return;
    }

    // KHQR: continue to the payment page (QR / checkout link + live status).
    // Cash: the order is placed — straight to the confirmation.
    if (result.payToken) {
      router.push(`/checkout/pay/${result.payToken}`);
    } else {
      router.push(`/checkout/success/${result.orderId}`);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
      noValidate
    >
      <OrderSummary />

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Delivery details
        </h2>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="customer_name">Full name</Label>
            <Input
              id="customer_name"
              autoComplete="name"
              {...register("customer_name")}
            />
            <FieldError message={errors.customer_name?.message} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="e.g. 012 345 678"
              {...register("phone")}
            />
            <FieldError message={errors.phone?.message} />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              autoComplete="street-address"
              placeholder="House, street, district, province"
              {...register("address")}
            />
            <FieldError message={errors.address?.message} />
          </div>
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              placeholder="Delivery instructions, gift message…"
              {...register("note")}
            />
            <FieldError message={errors.note?.message} />
          </div>
        </div>
      </section>

      {!isAuthenticated ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Create your account
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Set a password so you can log in with your phone and track this
            order.
          </p>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              {...register("password")}
            />
            <FieldError message={errors.password?.message} />
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Payment method
        </h2>
        <PaymentMethodPicker control={control} khqrAvailable={khqrAvailable} />
      </section>

      <CouponField subtotal={subtotal} onChange={setCoupon} />

      <CartSummary />

      {coupon && coupon.discount > 0 ? (
        <div className="-mt-3 rounded-2xl border border-success/30 bg-success/5 px-5 py-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">
              Discount (<span className="font-mono">{coupon.code}</span>)
            </span>
            <span className="font-medium text-success tabular-nums">
              −{formatPrice(coupon.discount)}
            </span>
          </div>
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={submitting || items.length === 0}
      >
        {submitting ? "Submitting…" : "Submit order"}
      </Button>
    </form>
  );
}
