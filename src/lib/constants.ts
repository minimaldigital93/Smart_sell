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

// The DB enum keeps aba/acleda/wing so historical orders stay valid, but new
// checkouts offer exactly two methods: dynamic KHQR and cash on delivery.
export const PAYMENT_METHODS = ["khqr", "aba", "acleda", "wing", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CHECKOUT_PAYMENT_METHODS = [
  "khqr",
  "cash",
] as const satisfies readonly PaymentMethod[];

/** Display labels for every method (incl. legacy ones on old orders). */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  khqr: "KHQR",
  aba: "ABA Bank (legacy)",
  acleda: "Acleda Bank (legacy)",
  wing: "Wing (legacy)",
  cash: "Cash",
};

export const ORDER_STATUSES = [
  "pending",
  "payment_confirmed",
  "preparing",
  "shipping",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const USER_ROLES = ["superadmin", "admin", "staff", "customer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SHIPPING_FEE_DEFAULT = 2;

/** Reserved store slug for the original single-tenant data (see migration 0033). */
export const DEFAULT_STORE_SLUG = "default";

/** Lifecycle states for a store/tenant. Mirrors stores.status + grace/lock. */
export const STORE_STATUSES = [
  "active",
  "grace",
  "locked",
  "cancelled",
] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

/** Days a lapsed store stays usable (with a banner) before it locks. */
export const GRACE_DAYS = 3;
