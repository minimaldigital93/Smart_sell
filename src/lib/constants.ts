export const APP_NAME = "minimaldigital";
export const APP_TAGLINE = "Cosmetic Store Management";

export const CATEGORIES = [
  { slug: "skincare", label: "Skincare" },
  { slug: "makeup", label: "Makeup" },
  { slug: "perfume", label: "Perfume" },
  { slug: "haircare", label: "Hair Care" },
  { slug: "bodycare", label: "Body Care" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const PAYMENT_METHODS = ["khqr", "aba", "acleda", "wing", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ONLINE_PAYMENT_METHODS = [
  "khqr",
  "aba",
  "acleda",
  "wing",
] as const satisfies readonly PaymentMethod[];

export const ORDER_STATUSES = [
  "pending",
  "payment_confirmed",
  "preparing",
  "shipping",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const USER_ROLES = ["admin", "staff", "customer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SHIPPING_FEE_DEFAULT = 2;
