import type { Json } from "@/types/database";

/** Per-plan capability gates. -1 means unlimited. Mirrors the `limits` jsonb. */
export type PlanLimits = {
  max_products: number;
  max_staff: number;
  coupons: boolean;
  loyalty: boolean;
  pos: boolean;
  custom_domain: boolean;
  advanced_analytics: boolean;
};

export const DEFAULT_PLAN_LIMITS: PlanLimits = {
  max_products: 50,
  max_staff: 1,
  coupons: false,
  loyalty: false,
  pos: false,
  custom_domain: false,
  advanced_analytics: false,
};

export const PLAN_CODES = ["starter", "growth", "pro"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export function isPlanCode(value: string): value is PlanCode {
  return (PLAN_CODES as readonly string[]).includes(value);
}

/** Safely coerce a plan's `limits` jsonb into a typed PlanLimits. */
export function parsePlanLimits(limits: Json | null | undefined): PlanLimits {
  if (!limits || typeof limits !== "object" || Array.isArray(limits)) {
    return DEFAULT_PLAN_LIMITS;
  }
  const l = limits as Record<string, Json | undefined>;
  const num = (v: Json | undefined, d: number) =>
    typeof v === "number" ? v : d;
  const bool = (v: Json | undefined, d: boolean) =>
    typeof v === "boolean" ? v : d;
  return {
    max_products: num(l.max_products, DEFAULT_PLAN_LIMITS.max_products),
    max_staff: num(l.max_staff, DEFAULT_PLAN_LIMITS.max_staff),
    coupons: bool(l.coupons, DEFAULT_PLAN_LIMITS.coupons),
    loyalty: bool(l.loyalty, DEFAULT_PLAN_LIMITS.loyalty),
    pos: bool(l.pos, DEFAULT_PLAN_LIMITS.pos),
    custom_domain: bool(l.custom_domain, DEFAULT_PLAN_LIMITS.custom_domain),
    advanced_analytics: bool(
      l.advanced_analytics,
      DEFAULT_PLAN_LIMITS.advanced_analytics,
    ),
  };
}

/** Plan `features` jsonb is a string[] of marketing bullet points. */
export function parsePlanFeatures(features: Json | null | undefined): string[] {
  if (!Array.isArray(features)) return [];
  return features.filter((f): f is string => typeof f === "string");
}
