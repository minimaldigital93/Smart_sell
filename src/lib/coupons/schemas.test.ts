import { describe, expect, it } from "vitest";
import { computeDiscount } from "@/lib/coupons/schemas";

// TS mirror of the SQL clamp in create_customer_order — if these rules change,
// change both together.
describe("computeDiscount", () => {
  it("computes percent discounts to cents", () => {
    expect(computeDiscount(100, "percent", 10)).toBe(10);
    expect(computeDiscount(19.99, "percent", 15)).toBe(3);
    expect(computeDiscount(33.33, "percent", 50)).toBe(16.67);
  });

  it("applies fixed discounts as-is", () => {
    expect(computeDiscount(100, "fixed", 5)).toBe(5);
    expect(computeDiscount(100, "fixed", 0.5)).toBe(0.5);
  });

  it("caps the discount at the subtotal (total never negative)", () => {
    expect(computeDiscount(10, "fixed", 25)).toBe(10);
    expect(computeDiscount(10, "percent", 100)).toBe(10);
    expect(computeDiscount(0, "fixed", 5)).toBe(0);
  });
});
