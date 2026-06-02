"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import {
  couponFormSchema,
  validateCouponSchema,
  computeDiscount,
} from "@/lib/coupons/schemas";
import { findActiveCouponByCode } from "@/services/coupons";

export type ValidateCouponResult =
  | {
      ok: true;
      code: string;
      discount: number;
      discountType: "percent" | "fixed";
      discountValue: number;
    }
  | { ok: false; error: string };

export async function validateCouponAction(
  input: unknown,
): Promise<ValidateCouponResult> {
  const parsed = validateCouponSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid code" };
  }
  const { code, subtotal } = parsed.data;
  const coupon = await findActiveCouponByCode(code);
  if (!coupon) return { ok: false, error: "Code not found or expired" };
  if (
    coupon.max_redemptions !== null &&
    coupon.redeemed_count >= coupon.max_redemptions
  ) {
    return { ok: false, error: "This code has reached its limit" };
  }
  if (subtotal < coupon.min_subtotal) {
    return {
      ok: false,
      error: `Add $${(coupon.min_subtotal - subtotal).toFixed(2)} more to use this code`,
    };
  }
  const discount = computeDiscount(
    subtotal,
    coupon.discount_type,
    coupon.discount_value,
  );
  return {
    ok: true,
    code: coupon.code,
    discount,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
  };
}

// ----------------------------------------------------------------------------
// Admin CRUD
// ----------------------------------------------------------------------------

export type CouponMutationResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function parseForm(formData: FormData) {
  const num = (k: string) => {
    const v = formData.get(k);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return couponFormSchema.safeParse({
    code: String(formData.get("code") ?? "").toUpperCase().trim(),
    discountType: formData.get("discountType"),
    discountValue: num("discountValue") ?? 0,
    minSubtotal: num("minSubtotal") ?? 0,
    maxRedemptions: num("maxRedemptions") ?? null,
    startsAt: (formData.get("startsAt") as string) || null,
    expiresAt: (formData.get("expiresAt") as string) || null,
    isActive: formData.get("isActive") === "on",
  });
}

export async function createCouponAction(
  _prev: CouponMutationResult,
  formData: FormData,
): Promise<CouponMutationResult> {
  await requireStaff();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coupons")
    .insert({
      code: v.code,
      discount_type: v.discountType,
      discount_value: v.discountValue,
      min_subtotal: v.minSubtotal,
      max_redemptions: v.maxRedemptions ?? null,
      starts_at: v.startsAt ?? null,
      expires_at: v.expiresAt ?? null,
      is_active: v.isActive,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "Code already exists" };
    console.error("[coupons.create]", error);
    return { ok: false, error: "Could not create coupon" };
  }
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}

export async function updateCouponAction(
  id: string,
  _prev: CouponMutationResult,
  formData: FormData,
): Promise<CouponMutationResult> {
  await requireStaff();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("coupons")
    .update({
      code: v.code,
      discount_type: v.discountType,
      discount_value: v.discountValue,
      min_subtotal: v.minSubtotal,
      max_redemptions: v.maxRedemptions ?? null,
      starts_at: v.startsAt ?? null,
      expires_at: v.expiresAt ?? null,
      is_active: v.isActive,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Code already exists" };
    console.error("[coupons.update]", error);
    return { ok: false, error: "Could not update coupon" };
  }
  revalidatePath("/admin/coupons");
  revalidatePath(`/admin/coupons/${id}/edit`);
  redirect("/admin/coupons");
}

export async function deleteCouponAction(id: string): Promise<CouponMutationResult> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) {
    console.error("[coupons.delete]", error);
    return { ok: false, error: "Could not delete coupon" };
  }
  revalidatePath("/admin/coupons");
  return { ok: true };
}
