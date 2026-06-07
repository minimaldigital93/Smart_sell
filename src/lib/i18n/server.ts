import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./types";

export async function getServerLocale(
  fallback: Locale = DEFAULT_LOCALE,
): Promise<Locale> {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  // An explicit visitor choice (cookie) wins; otherwise use the store default.
  return isLocale(raw) ? raw : fallback;
}
