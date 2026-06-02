import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants";

export const checkoutCustomerSchema = z.object({
  customer_name: z.string().trim().min(2, "Name is required").max(120),
  phone: z
    .string()
    .trim()
    .min(6, "Phone is required")
    .max(32)
    .regex(/^[0-9+\s()\-]+$/, "Use digits, spaces, parentheses, + or -"),
  address: z.string().trim().min(5, "Address is required").max(500),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  payment_method: z.enum(PAYMENT_METHODS),
});

export type CheckoutCustomerValues = z.infer<typeof checkoutCustomerSchema>;

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
