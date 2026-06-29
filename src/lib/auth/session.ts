import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";
import type { UserRoleEnum } from "@/types/database";

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
 * Where to send a freshly-authenticated user: honor an explicit deep-link the
 * user was bounced from (e.g. `/admin/orders`), but for the generic landing
 * targets ("/", "/account") route by role so admins/superadmins reach their
 * dashboard instead of the storefront/account page.
 */
export function postLoginDestination(
  role: UserRoleEnum | string | null | undefined,
  requested?: string | null,
): string {
  if (requested && !GENERIC_LANDING.has(requested)) return requested;
  return dashboardPathForRole(role);
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getCurrentProfile(): Promise<{
  user: User;
  profile: Profile;
} | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;
  return { user, profile };
}

/** Redirects to /login if no user. Returns the user otherwise. */
export async function requireUser(redirectTo = "/"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const params = new URLSearchParams({ redirectTo });
    redirect(`/login?${params.toString()}`);
  }
  return user;
}

/** Redirects home if the user's role is not in `allowed`. */
export async function requireRole(
  allowed: readonly UserRoleEnum[],
  redirectTo = "/",
): Promise<{ user: User; profile: Profile }> {
  const result = await getCurrentProfile();
  if (!result) {
    const params = new URLSearchParams({ redirectTo });
    redirect(`/login?${params.toString()}`);
  }
  if (!allowed.includes(result.profile.role)) {
    redirect("/");
  }
  return result;
}

export const requireStaff = (redirectTo = "/admin") =>
  requireRole(["admin", "staff", "superadmin"], redirectTo);
export const requireAdmin = (redirectTo = "/admin") =>
  requireRole(["admin", "superadmin"], redirectTo);

/** Redirects home unless the signed-in user is the platform superadmin. */
export const requireSuperadmin = (redirectTo = "/superadmin") =>
  requireRole(["superadmin"], redirectTo);
