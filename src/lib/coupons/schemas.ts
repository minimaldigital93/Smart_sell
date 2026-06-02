import { z } from "zod";

export const couponCodeSchema = z
  .string()
  .trim()
  .min(3, "Code must be at least 3 characters")
  .max(32, "Code is too long")
  .regex(/^[A-Z0-9_-]+$/, "Use A-Z, 0-9, dash or underscore");

export const couponFormSchema = z
  .object({
    code: couponCodeSchema,
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.number().positive("Must be greater than 0"),
    minSubtotal: z.number().min(0).default(0),
    maxRedemptions: z.number().int().positive().nullable().optional(),
    startsAt: z.string().datetime().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (v) => v.discountType !== "percent" || v.discountValue <= 100,
    { path: ["discountValue"], message: "Percent must be between 1 and 100" },
  )
  .refine(
    (v) => !v.startsAt || !v.expiresAt || v.startsAt < v.expiresAt,
    { path: ["expiresAt"], message: "Expires must be after start" },
  );

export type CouponFormValues = z.infer<typeof couponFormSchema>;

export const validateCouponSchema = z.object({
  code: couponCodeSchema,
  subtotal: z.number().nonnegative(),
});

export function computeDiscount(
  subtotal: number,
  discountType: "percent" | "fixed",
  discountValue: number,
): number {
  const raw =
    discountType === "percent"
      ? (subtotal * discountValue) / 100
      : discountValue;
  // Cap at subtotal so total never goes negative.
  return Number(Math.min(raw, subtotal).toFixed(2));
}
