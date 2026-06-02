"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  dictionaries,
  type Locale,
  type TranslationKey,
} from "./types";

type Ctx = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey, fallback?: string) => string;
};

const I18nContext = createContext<Ctx | null>(null);

const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${ONE_YEAR_SEC}; SameSite=Lax`;
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      locale,
      setLocale,
      t: (key, fallback) =>
        dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? fallback ?? key,
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Allow components to be used outside provider during static analysis;
    // fall back to English identity translation.
    return (key: TranslationKey, fallback?: string) =>
      dictionaries[DEFAULT_LOCALE][key] ?? fallback ?? key;
  }
  return ctx.t;
}

export function useLocale() {
  const ctx = useContext(I18nContext);
  return {
    locale: ctx?.locale ?? DEFAULT_LOCALE,
    setLocale: ctx?.setLocale ?? (() => {}),
  };
}
