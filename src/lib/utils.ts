import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_CURRENCY = "USD";

// Cache one Intl formatter per currency code. Decimal places follow the
// currency's own convention (USD → 2, KHR → 0) rather than being forced.
const formatterCache = new Map<string, Intl.NumberFormat>();

function priceFormatter(currency: string): Intl.NumberFormat {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  let f = formatterCache.get(code);
  if (!f) {
    try {
      f = new Intl.NumberFormat("en-US", { style: "currency", currency: code });
    } catch {
      // Invalid/unknown currency code from settings — fall back to USD so a
      // typo never throws in the render path.
      f =
        formatterCache.get(DEFAULT_CURRENCY) ??
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: DEFAULT_CURRENCY,
        });
    }
    formatterCache.set(code, f);
  }
  return f;
}

export function formatPrice(
  amount: number | string | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string {
  if (amount === null || amount === undefined) return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return "—";
  return priceFormatter(currency).format(n);
}

export function discountPercent(price: number, discount: number): number {
  if (price <= 0 || discount >= price) return 0;
  return Math.round(((price - discount) / price) * 100);
}
