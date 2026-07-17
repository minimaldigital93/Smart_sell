import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_LIMITS,
  isPlanCode,
  parsePlanLimits,
} from "@/lib/billing/plans";

describe("parsePlanLimits", () => {
  it("falls back to restrictive defaults for missing/invalid input", () => {
    expect(parsePlanLimits(null)).toEqual(DEFAULT_PLAN_LIMITS);
    expect(parsePlanLimits(undefined)).toEqual(DEFAULT_PLAN_LIMITS);
    expect(parsePlanLimits("nope")).toEqual(DEFAULT_PLAN_LIMITS);
    expect(parsePlanLimits([1, 2])).toEqual(DEFAULT_PLAN_LIMITS);
  });

  it("coerces a full limits object", () => {
    expect(
      parsePlanLimits({
        max_products: -1,
        max_staff: 5,
        coupons: true,
        pos: true,
        custom_domain: false,
        advanced_analytics: true,
      }),
    ).toEqual({
      max_products: -1,
      max_staff: 5,
      coupons: true,
      pos: true,
      custom_domain: false,
      advanced_analytics: true,
    });
  });

  it("fills wrong-typed fields with defaults, field by field", () => {
    const parsed = parsePlanLimits({
      max_products: "many",
      coupons: "yes",
      pos: true,
    });
    expect(parsed.max_products).toBe(DEFAULT_PLAN_LIMITS.max_products);
    expect(parsed.coupons).toBe(DEFAULT_PLAN_LIMITS.coupons);
    expect(parsed.pos).toBe(true);
  });
});

describe("isPlanCode", () => {
  it("accepts only the three live plan codes", () => {
    expect(isPlanCode("starter")).toBe(true);
    expect(isPlanCode("growth")).toBe(true);
    expect(isPlanCode("pro")).toBe(true);
    expect(isPlanCode("enterprise")).toBe(false);
    expect(isPlanCode("")).toBe(false);
  });
});
