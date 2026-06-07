import { z } from "zod";
import { CATEGORIES } from "@/lib/constants";

const categorySlugs = CATEGORIES.map((c) => c.slug) as [
  (typeof CATEGORIES)[number]["slug"],
  ...(typeof CATEGORIES)[number]["slug"][],
];

export const productInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, "Name is required").max(200),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(220)
      .regex(/^[a-z0-9-]*$/, "Use lowercase letters, digits, hyphens")
      .optional()
      .or(z.literal("")),
    description: z.string().trim().max(4000).optional().or(z.literal("")),
    ingredients: z.string().trim().max(4000).optional().or(z.literal("")),
    category: z.enum(categorySlugs),
    price: z.coerce.number().positive("Price must be greater than 0"),
    discount_price: z
      .union([z.coerce.number().nonnegative(), z.literal("")])
      .optional(),
    barcode: z.string().trim().max(64).optional().or(z.literal("")),
    sku: z.string().trim().max(64).optional().or(z.literal("")),
    featured: z.coerce.boolean().optional().default(false),
    on_sale: z.coerce.boolean().optional().default(false),
    new_arrival: z.coerce.boolean().optional().default(false),
    is_active: z.coerce.boolean().optional().default(true),
    initial_stock: z.coerce.number().int().nonnegative().default(0),
    images: z.array(z.string().url()).default([]),
  })
  .refine(
    (v) =>
      v.discount_price === undefined ||
      v.discount_price === "" ||
      Number(v.discount_price) < v.price,
    { path: ["discount_price"], message: "Discount must be less than price" },
  );

export type ProductInputValues = z.infer<typeof productInputSchema>;
