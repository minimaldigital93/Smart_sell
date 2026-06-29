import { z } from "zod";

/**
 * Validation for the admin Shop Category create/edit form. Names are trimmed
 * before save; case-insensitive uniqueness is enforced at the DB level
 * (see migration 0041) and surfaced as a friendly message in the action.
 */
export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  icon: z.string().trim().max(40).optional().or(z.literal("")),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex color like #ec4899")
    .optional()
    .or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.coerce.boolean().default(true),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
