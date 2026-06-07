import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants";
import { passwordSchema, phoneSchema } from "@/lib/auth/schemas";

export const checkoutCustomerSchema = z.object({
  customer_name: z.string().trim().min(2, "Name is required").max(120),
  // Same rule as login/sign-up so the number always normalizes to a valid
  // phone-auth identity (see lib/auth/phone.ts).
  phone: phoneSchema,
  address: z.string().trim().min(5, "Address is required").max(500),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  payment_method: z.enum(PAYMENT_METHODS),
});

export type CheckoutCustomerValues = z.infer<typeof checkoutCustomerSchema>;

/**
 * Guest checkout schema: same as the customer schema plus a password. A guest
 * placing an order creates an account (phone + password) so they can log back
 * in and track the order. Logged-in customers use checkoutCustomerSchema.
 */
export const checkoutAccountSchema = checkoutCustomerSchema.extend({
  password: passwordSchema,
});

export type CheckoutAccountValues = z.infer<typeof checkoutAccountSchema>;

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(99),
});

export const submitOrderSchema = checkoutCustomerSchema.extend({
  items: z.array(cartItemSchema).min(1, "Your cart is empty"),
  coupon_code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid coupon code")
    .optional()
    .or(z.literal("")),
  points_to_redeem: z.coerce.number().int().min(0).max(100_000).optional(),
});

export type SubmitOrderValues = z.infer<typeof submitOrderSchema>;
