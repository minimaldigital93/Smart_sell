import { describe, expect, it } from "vitest";
import { ALLOWED_TRANSITIONS, canTransition } from "@/lib/orders/transitions";
import { ORDER_STATUSES } from "@/lib/constants";

describe("order status transitions", () => {
  it("follows the forward path", () => {
    expect(canTransition("pending", "payment_confirmed")).toBe(true);
    expect(canTransition("payment_confirmed", "preparing")).toBe(true);
    expect(canTransition("preparing", "shipping")).toBe(true);
    expect(canTransition("shipping", "delivered")).toBe(true);
  });

  it("never allows skipping ahead or moving backwards", () => {
    expect(canTransition("pending", "preparing")).toBe(false);
    expect(canTransition("pending", "shipping")).toBe(false);
    expect(canTransition("pending", "delivered")).toBe(false);
    expect(canTransition("preparing", "payment_confirmed")).toBe(false);
    expect(canTransition("shipping", "pending")).toBe(false);
  });

  it("allows cancel from any non-terminal state only", () => {
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("payment_confirmed", "cancelled")).toBe(true);
    expect(canTransition("preparing", "cancelled")).toBe(true);
    expect(canTransition("shipping", "cancelled")).toBe(true);
    expect(canTransition("delivered", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "cancelled")).toBe(false);
  });

  it("treats delivered and cancelled as terminal", () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition("delivered", to)).toBe(false);
      expect(canTransition("cancelled", to)).toBe(false);
    }
  });

  it("covers every status in the transition table", () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual(
      [...ORDER_STATUSES].sort(),
    );
  });
});
