import type { OrderStatusEnum } from "@/types/database";

/**
 * Allowed status transitions. `delivered` and `cancelled` are terminal.
 * Cancellation is allowed from any non-terminal state — admin handles refund
 * + manual inventory put-back if needed.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatusEnum, OrderStatusEnum[]> = {
  pending: ["payment_confirmed", "cancelled"],
  payment_confirmed: ["preparing", "cancelled"],
  preparing: ["shipping", "cancelled"],
  shipping: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransition(
  from: OrderStatusEnum,
  to: OrderStatusEnum,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export const STATUS_ORDER: OrderStatusEnum[] = [
  "pending",
  "payment_confirmed",
  "preparing",
  "shipping",
  "delivered",
];

export const STATUS_LABEL: Record<OrderStatusEnum, string> = {
  pending: "Pending",
  payment_confirmed: "Payment confirmed",
  preparing: "Preparing",
  shipping: "Shipping",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Verb shown on the action button to move TO this status from the prior one. */
export const TRANSITION_VERB: Record<OrderStatusEnum, string> = {
  pending: "Mark pending",
  payment_confirmed: "Process order",
  preparing: "Start preparing",
  shipping: "Mark shipping",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
};
