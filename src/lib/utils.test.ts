import { describe, expect, it } from "vitest";
import { discountPercent, escapeLikePattern, formatPrice } from "@/lib/utils";

describe("escapeLikePattern", () => {
  it("escapes LIKE wildcards", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
    expect(escapeLikePattern("c\\d")).toBe("c\\\\d");
  });

  it("neutralizes PostgREST or() syntax characters", () => {
    // A raw comma/paren would end the ilike pattern and inject a new filter.
    expect(escapeLikePattern("lip, stick")).toBe("lip stick");
    expect(escapeLikePattern("serum(50ml)")).toBe("serum 50ml");
    expect(escapeLikePattern('say "hi"')).toBe("say hi");
  });

  it("collapses whitespace and trims", () => {
    expect(escapeLikePattern("  rose   water  ")).toBe("rose water");
    expect(escapeLikePattern("(,)")).toBe("");
  });
});

describe("formatPrice", () => {
  it("formats USD by default and falls back for invalid currency", () => {
    expect(formatPrice(12.5)).toBe("$12.50");
    expect(formatPrice("3")).toBe("$3.00");
    expect(formatPrice(2, "NOPE")).toBe("$2.00");
  });

  it("renders em dash for missing values", () => {
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(undefined)).toBe("—");
    expect(formatPrice("abc")).toBe("—");
  });
});

describe("discountPercent", () => {
  it("computes the badge percentage", () => {
    expect(discountPercent(100, 75)).toBe(25);
    expect(discountPercent(80, 60)).toBe(25);
  });

  it("returns 0 for non-discounts", () => {
    expect(discountPercent(0, 10)).toBe(0);
    expect(discountPercent(50, 50)).toBe(0);
    expect(discountPercent(50, 60)).toBe(0);
  });
});
