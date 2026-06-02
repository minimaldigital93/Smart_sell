import { z } from "zod";

export const movementSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(["in", "out", "adjustment"]),
  quantity: z.coerce.number().int().min(0).max(100000),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  barcodeImageUrl: z.url().optional().or(z.literal("")),
});
export type MovementValues = z.infer<typeof movementSchema>;

export const minStockSchema = z.object({
  productId: z.string().uuid(),
  minimumStock: z.coerce.number().int().min(0).max(100000),
});
export type MinStockValues = z.infer<typeof minStockSchema>;
