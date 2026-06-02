import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/constants";

export const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
});

export type UpdateOrderStatusValues = z.infer<typeof updateOrderStatusSchema>;
