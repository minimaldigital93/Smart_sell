import { en, type Dict, type TranslationKey } from "./dictionaries/en";
import { km } from "./dictionaries/km";

export type Locale = "en" | "km";
export const LOCALES: Locale[] = ["en", "km"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "csms_lang";

export const dictionaries: Record<Locale, Dict> = { en, km };

export type { TranslationKey };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "km";
}
