import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStoreId } from "@/lib/tenant/context";
import {
  DEFAULT_STORE_SETTINGS,
  type StoreSettings,
} from "@/lib/settings/schema";
import { isLocale } from "@/lib/i18n/types";

/**
 * Read the current store's settings. Cached per request so the root layout,
 * admin shell and storefront header don't each issue a query. Falls back to
 * {@link DEFAULT_STORE_SETTINGS} when the DB isn't reachable, there's no store
 * context, or the row is missing, so branding/theme never hard-fail the render.
 */
export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  try {
    const storeId = await getCurrentStoreId();
    if (!storeId) return DEFAULT_STORE_SETTINGS;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("store_settings")
      .select(
        "business_name, tagline, logo_url, theme, default_locale, currency, shipping_fee, contact_phone, contact_address",
      )
      .eq("store_id", storeId)
      .maybeSingle();

    if (error || !data) return DEFAULT_STORE_SETTINGS;

    return {
      businessName: data.business_name ?? DEFAULT_STORE_SETTINGS.businessName,
      tagline: data.tagline ?? DEFAULT_STORE_SETTINGS.tagline,
      logoUrl: data.logo_url,
      theme: data.theme ?? DEFAULT_STORE_SETTINGS.theme,
      defaultLocale: isLocale(data.default_locale)
        ? data.default_locale
        : DEFAULT_STORE_SETTINGS.defaultLocale,
      currency: data.currency ?? DEFAULT_STORE_SETTINGS.currency,
      shippingFee: Number(data.shipping_fee ?? DEFAULT_STORE_SETTINGS.shippingFee),
      contactPhone: data.contact_phone,
      contactAddress: data.contact_address,
    };
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
});
