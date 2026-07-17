/** Shared khqr.cc types — pure module, safe to import anywhere. */

export type KhqrCredentials = {
  baseUrl: string;
  profileId: string;
  secret: string;
  currency: "USD" | "KHR";
};

/**
 * Payment lifecycle, ported from AMS PaymentStatus. `pending → qr_generated →
 * waiting_payment → paid → refunded`; failed/expired/cancelled/rejected are
 * terminal. Mirrors the SQL order_payment_can_transition() — keep in sync.
 */
export type PaymentStatus =
  | "pending"
  | "qr_generated"
  | "waiting_payment"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"
  | "rejected";
