import type { PaymentStatus } from "@/lib/khqrpay/types";

/**
 * Pure mirror of the SQL order_payment_can_transition() (migration 0047) and
 * of AMS PaymentStatus::canTransitionTo. Keep the three in sync.
 */

export const OPEN_STATUSES: readonly PaymentStatus[] = [
  "pending",
  "qr_generated",
  "waiting_payment",
];

export const TERMINAL_STATUSES: readonly PaymentStatus[] = [
  "failed",
  "expired",
  "cancelled",
  "refunded",
  "rejected",
];

export function isOpen(status: PaymentStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ["qr_generated", "waiting_payment", "paid", "failed", "expired", "cancelled"],
  qr_generated: ["waiting_payment", "paid", "failed", "expired", "cancelled"],
  waiting_payment: ["paid", "failed", "expired", "cancelled"],
  paid: ["refunded"],
  failed: [],
  expired: [],
  cancelled: [],
  refunded: [],
  rejected: [],
};

export function canTransitionPayment(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
