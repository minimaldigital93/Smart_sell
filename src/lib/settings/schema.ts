import { z } from "zod";
import { APP_NAME, APP_TAGLINE, SHIPPING_FEE_DEFAULT } from "@/lib/constants";
import { DEFAULT_THEME_KEY, THEME_PRESETS } from "@/lib/theme/presets";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/types";

export type StoreSettings = {
  businessName: string;
  tagline: string;
  logoUrl: string | null;
  theme: string;
  defaultLocale: Locale;
  currency: string;
  shippingFee: number;
  contactPhone: string | null;
  contactAddress: string | null;
};

/** Fallback used before the row is read, or when the DB is unavailable. */
export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  businessName: APP_NAME,
  tagline: APP_TAGLINE,
  logoUrl: null,
  theme: DEFAULT_THEME_KEY,
  defaultLocale: DEFAULT_LOCALE,
  currency: "USD",
  shippingFee: SHIPPING_FEE_DEFAULT,
  contactPhone: null,
  contactAddress: null,
};

const themeKeys = THEME_PRESETS.map((p) => p.key) as [string, ...string[]];

export const storeSettingsFormSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(60),
  tagline: z.string().trim().max(120).optional().default(""),
  theme: z.enum(themeKeys),
  defaultLocale: z.enum(["en", "km"]),
  currency: z.string().trim().min(1).max(8).default("USD"),
  shippingFee: z.coerce.number().min(0, "Must be 0 or more").max(1000),
  contactPhone: z.string().trim().max(40).optional().default(""),
  contactAddress: z.string().trim().max(200).optional().default(""),
});

export type StoreSettingsFormValues = z.infer<typeof storeSettingsFormSchema>;
