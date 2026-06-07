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

export const USER_ROLES = ["superadmin", "admin", "staff", "customer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SHIPPING_FEE_DEFAULT = 2;

/** Reserved store slug for the original single-tenant data (see migration 0033). */
export const DEFAULT_STORE_SLUG = "default";

/** Lifecycle states for a store/tenant. Mirrors stores.status + grace/lock. */
export const STORE_STATUSES = [
  "trial",
  "active",
  "grace",
  "locked",
  "cancelled",
] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

/** Free-trial length for a newly registered store (days). */
export const TRIAL_DAYS = 14;

/** Days a lapsed store stays usable (with a banner) before it locks. */
export const GRACE_DAYS = 3;
