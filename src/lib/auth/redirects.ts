import type { UserRoleEnum } from "@/types/database";

/**
 * Pure post-auth routing helpers. Kept free of server-only imports (no
 * next/navigation, no Supabase) so they are unit-testable — lib/auth/session
 * re-exports them for app code.
 */

/**
 * The default landing path for a role after authentication:
 * superadmin → platform console, admin/staff → store dashboard, everyone
 * else → their account. Keep this in sync wherever we route post-login.
 */
export function dashboardPathForRole(
  role: UserRoleEnum | string | null | undefined,
): string {
  switch (role) {
    case "superadmin":
      return "/superadmin";
    case "admin":
    case "staff":
      return "/admin";
    default:
      return "/account";
  }
}

// Generic landing targets that any role can be bounced from (the storefront
// home and the customer account tab). For privileged roles these must defer to
// the role's own dashboard rather than pin them to a customer page.
const GENERIC_LANDING = new Set(["/", "/account"]);

/**
 * Only a same-origin path is a safe redirect target: exactly one leading
 * slash (`//evil.example` is protocol-relative) and no scheme.
 */
export function isSafeRedirectPath(requested: string): boolean {
  return /^\/(?!\/)/.test(requested);
}

/**
 * Where to send a freshly-authenticated user: honor an explicit deep-link the
 * user was bounced from (e.g. `/admin/orders`), but for the generic landing
 * targets ("/", "/account") route by role so admins/superadmins reach their
 * dashboard instead of the storefront/account page. External URLs are ignored
 * (open-redirect guard, audit H4).
 */
export function postLoginDestination(
  role: UserRoleEnum | string | null | undefined,
  requested?: string | null,
): string {
  if (requested && isSafeRedirectPath(requested) && !GENERIC_LANDING.has(requested)) {
    return requested;
  }
  return dashboardPathForRole(role);
}
