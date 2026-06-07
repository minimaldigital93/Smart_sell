"use client";

import { createContext, useContext, useMemo } from "react";
import { formatPrice as rawFormatPrice, DEFAULT_CURRENCY } from "@/lib/utils";
import { SHIPPING_FEE_DEFAULT } from "@/lib/constants";

/**
 * Client-side store config (currency + shipping fee) sourced once from the
 * singleton store_settings in the root layout. Client components read it via
 * the hooks below so money formatting and the cart's shipping line follow what
 * the admin configured in Settings — without each component fetching settings.
 */
export type StoreConfig = {
  currency: string;
  shippingFee: number;
};

const DEFAULT_CONFIG: StoreConfig = {
  currency: DEFAULT_CURRENCY,
  shippingFee: SHIPPING_FEE_DEFAULT,
};

const StoreConfigContext = createContext<StoreConfig>(DEFAULT_CONFIG);

export function StoreConfigProvider({
  config,
  children,
}: {
  config: StoreConfig;
  children: React.ReactNode;
}) {
  const value = useMemo<StoreConfig>(
    () => ({
      currency: config.currency || DEFAULT_CURRENCY,
      shippingFee: Number.isFinite(config.shippingFee)
        ? config.shippingFee
        : SHIPPING_FEE_DEFAULT,
    }),
    [config.currency, config.shippingFee],
  );
  return (
    <StoreConfigContext.Provider value={value}>
      {children}
    </StoreConfigContext.Provider>
  );
}

export function useStoreConfig(): StoreConfig {
  return useContext(StoreConfigContext);
}

/** Currency-aware price formatter bound to the store's configured currency. */
export function useFormatPrice() {
  const { currency } = useContext(StoreConfigContext);
  return useMemo(
    () =>
      (amount: number | string | null | undefined) =>
        rawFormatPrice(amount, currency),
    [currency],
  );
}

export function useShippingFee(): number {
  return useContext(StoreConfigContext).shippingFee;
}
