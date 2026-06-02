"use client";

import { useLocale } from "@/lib/i18n/provider";
import { dictionaries, LOCALES, type Locale } from "@/lib/i18n/types";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label="Language"
      className={`bg-secondary text-secondary-foreground inline-flex h-9 items-center rounded-full p-1 ${className}`}
    >
      {LOCALES.map((code: Locale) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={active}
            className={`h-7 rounded-full px-3 text-xs font-medium transition ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {dictionaries.en[`lang.${code}` as const]}
          </button>
        );
      })}
    </div>
  );
}
