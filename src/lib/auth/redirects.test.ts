import { describe, expect, it } from "vitest";
import {
  dashboardPathForRole,
  isSafeRedirectPath,
  postLoginDestination,
} from "@/lib/auth/redirects";

describe("dashboardPathForRole", () => {
  it("routes each role to its home", () => {
    expect(dashboardPathForRole("superadmin")).toBe("/superadmin");
    expect(dashboardPathForRole("admin")).toBe("/admin");
    expect(dashboardPathForRole("staff")).toBe("/admin");
    expect(dashboardPathForRole("customer")).toBe("/account");
    expect(dashboardPathForRole(null)).toBe("/account");
    expect(dashboardPathForRole(undefined)).toBe("/account");
  });
});

describe("isSafeRedirectPath", () => {
  it("accepts same-origin paths", () => {
    expect(isSafeRedirectPath("/admin/orders")).toBe(true);
    expect(isSafeRedirectPath("/")).toBe(true);
    expect(isSafeRedirectPath("/checkout?step=2")).toBe(true);
  });

  it("rejects absolute and protocol-relative URLs (open redirect)", () => {
    expect(isSafeRedirectPath("https://evil.example")).toBe(false);
    expect(isSafeRedirectPath("http://evil.example/x")).toBe(false);
    expect(isSafeRedirectPath("//evil.example")).toBe(false);
    expect(isSafeRedirectPath("javascript:alert(1)")).toBe(false);
    expect(isSafeRedirectPath("")).toBe(false);
  });
});

describe("postLoginDestination", () => {
  it("honors a safe deep-link", () => {
    expect(postLoginDestination("customer", "/orders/abc")).toBe("/orders/abc");
    expect(postLoginDestination("admin", "/admin/orders")).toBe("/admin/orders");
  });

  it("ignores external URLs and falls back to the role home", () => {
    expect(postLoginDestination("customer", "https://evil.example")).toBe(
      "/account",
    );
    expect(postLoginDestination("admin", "//evil.example")).toBe("/admin");
    expect(postLoginDestination("superadmin", "https://evil.example")).toBe(
      "/superadmin",
    );
  });

  it("routes generic landings by role", () => {
    expect(postLoginDestination("admin", "/")).toBe("/admin");
    expect(postLoginDestination("superadmin", "/account")).toBe("/superadmin");
    expect(postLoginDestination("customer", "/")).toBe("/account");
    expect(postLoginDestination("customer", null)).toBe("/account");
  });
});
