import type { PaymentMethod } from "@/lib/constants";

export type PaymentInstruction = {
  label: string;
  bank?: string;
  accountName?: string;
  accountNumber?: string;
  note?: string;
};

// Edit these in production. The KHQR entry shows the static QR image at the
// path below — drop a real KHQR PNG at /public/payment/khqr.png.
export const PAYMENT_INSTRUCTIONS: Record<PaymentMethod, PaymentInstruction> = {
  khqr: {
    label: "KHQR",
    note: "Scan the QR with any KHQR-enabled bank app, then upload the receipt screenshot below.",
  },
  aba: {
    label: "ABA Bank",
    bank: "ABA",
    accountName: "Lumière Co., Ltd.",
    accountNumber: "000 123 456",
    note: "Transfer the total amount, then upload your receipt screenshot.",
  },
  acleda: {
    label: "ACLEDA",
    bank: "ACLEDA Bank",
    accountName: "Lumière Co., Ltd.",
    accountNumber: "0012-04-123456",
    note: "Transfer the total amount, then upload your receipt screenshot.",
  },
  wing: {
    label: "Wing",
    bank: "Wing",
    accountName: "Lumière",
    accountNumber: "012 345 678",
    note: "Send via Wing, then upload your receipt screenshot.",
  },
  cash: {
    label: "Cash",
    note: "Cash taken in-store at the counter.",
  },
};
